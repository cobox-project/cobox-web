# プラン・課金（Stripe）

> このドキュメントは [backend-architecture.md](../../.claude/rules/backend-architecture.md) から切り出した詳細仕様。

---

## 課金の方針

テナント（ワークスペース）単位でサブスクリプションプランを管理する。
課金・決済は **Stripe** に完全に委譲し、アプリケーション側はプランの状態を同期して機能制限の判定に使用する。

Stripe を **Single Source of Truth** とし、アプリケーション DB にはキャッシュとしてプラン状態を保持する。
状態の同期は Stripe Webhook で行い、DB の状態は Webhook イベントで上書きされる。

## プランモデル

| プラン | 説明 | 制限例 |
| --- | --- | --- |
| Free | 無料 (¥0/月) | メンバー 1 名、チャネル 1 個、LINE 利用不可、一括送信 50 宛先/回 |
| Starter | スターター (¥980/月) | チャネル 5 個まで、LINE 無料枠 200通/月（超過 3円/通）、一括送信 500 宛先/回 |
| Pro | プロ (¥2,980/月) | チャネル無制限、LINE 無料枠 1,000通/月（超過 3円/通）、一括送信 5,000 宛先/回 |

## Stripe リソースマッピング

| Cobox 概念 | Stripe リソース | 備考 |
| --- | --- | --- |
| ワークスペース（テナント） | Customer | `metadata.tenant_id` でマッピング |
| プラン | Product + Price | 月額 / 年額の Price を定義 |
| サブスクリプション | Subscription | 1 テナント = 1 アクティブ Subscription |
| 支払い方法 | PaymentMethod | Customer に紐付け |
| 請求書 | Invoice | Stripe が自動生成 |

## アーキテクチャ

```text
[Stripe Dashboard / API]
     ↑ API 呼び出し          ↓ Webhook
     |                       |
[BillingService]        [POST /webhooks/stripe]
     ↑                       |
     |                  署名検証 → BillingService
     |                       |
[BillingRepo]           状態を DB に同期
     ↓
[subscriptions テーブル]
```

## Stripe Webhook で同期するイベント

| Stripe イベント | アプリケーションの処理 |
| --- | --- |
| `customer.subscription.created` | サブスクリプションレコード作成 |
| `customer.subscription.updated` | プラン変更・ステータス更新 |
| `customer.subscription.deleted` | サブスクリプション終了 |
| `invoice.payment_succeeded` | 支払い成功の記録、サービス有効化 |
| `invoice.payment_failed` | 支払い失敗の記録、猶予期間の開始 |
| `customer.subscription.trial_will_end` | トライアル終了通知（3 日前） |

## プラン状態の判定

```text
リクエスト
  ↓
[auth middleware]
  ↓
[plan middleware]  ← subscriptions テーブルからプラン状態を取得
  ↓                  status: active / trialing / past_due / canceled / unpaid
[route handler]
  ↓
[Service]         ← PlanContext から機能制限を判定
```

- `active` / `trialing`: 全機能利用可能（プランの制限内）
- `past_due`: 猶予期間中。機能は利用可能だが管理画面に警告を表示
- `canceled` / `unpaid`: 読み取り専用モード（新規作成・送信を制限）

## 機能制限（Feature Gate）

プランに応じた機能制限は `PlanContext` Service で判定する。

```typescript
export type PlanContext = {
  readonly plan: Plan
  readonly limits: PlanLimits
  readonly checkLimit: (resource: LimitableResource, current: number) => Effect.Effect<void, PlanLimitExceeded>
}

export type PlanLimits = {
  readonly maxMembers: number
  readonly maxChannels: number
  readonly maxMonthlyMessages: number
  readonly maxBulkEmailRecipients: number  // 1回の一括送信の最大宛先数
  readonly bulkEmailEnabled: boolean
  readonly lineEnabled: boolean
  readonly monthlyFreeLineMessages: number
  readonly lineOverageUnitPrice: number  // 円/通
}

export type LimitableResource = "members" | "channels" | "monthlyMessages" | "monthlyLineMessages" | "bulkEmailRecipients"
```

Service 層で `planCtx.checkLimit()` を呼び出し、制限超過時は `PlanLimitExceeded` エラーを返す。

## LINE 従量課金

LINE メッセージの送信数をテナント単位で月次カウントし、無料枠超過分を Stripe の従量課金（Usage-based billing）で請求する。

| Stripe リソース | 用途 |
| --- | --- |
| Metered Price | LINE 超過分の従量課金（3円/通） |
| Usage Record | 月次の LINE 送信数を記録 |

```typescript
// MessageService 内で LINE 送信時のフロー
const sendLineMessage = (params) =>
  pipe(
    // 1. LINE API 呼び出し（トランザクション外）
    ChannelRouter.resolve("line").send(params),
    // 2. DB トランザクション内で messages INSERT + conversations UPDATE + カウント更新
    Effect.flatMap((result) =>
      withTransaction((tx) =>
        pipe(
          MessageRepo.insert(tx, ...),
          Effect.tap(() => ConversationRepo.updateStatusIfNeeded(tx, ...)),
          Effect.tap(() => LineUsageRepo.increment(tx, params.tenantId, currentMonth)),
        )
      )
    ),
  )
```

- `line_message_usage` のカウント更新はメッセージ保存と同一トランザクション内で実行し、課金漏れを防止する
- Stripe への Usage Record 報告は月次バッチ（定期ジョブ）で `line_message_usage.count` を元に実行する。DB のカウントが Single Source of Truth

### 月次バッチの技術設計

**トリガー:** Cloudflare Workers Cron Triggers（`wrangler.json` の `triggers.crons` で設定）

**重要: Cron Triggers は実行保証がない（best-effort）。** Cloudflare 側の障害等でスケジュール通りに実行されない可能性がある。このため、冪等性 + 未報告検知による自動リカバリを必須とする。

**冪等設計:**
- `stripe_usage_reports` テーブル（非temporal）を追加し、報告済みの月を記録する
  - カラム: `id`, `tenant_id`, `month(YYYY-MM)`, `count_reported`, `stripe_usage_record_id`, `reported_at`
  - UNIQUE: `(tenant_id, month)`
- バッチ実行時の処理フロー:
  1. `line_message_usage` から全テナントの当月分を取得
  2. `stripe_usage_reports` と突合し、**未報告の月**を検出（当月だけでなく過去月も含む）
  3. 未報告分を Stripe に Usage Record として報告
  4. 報告成功後に `stripe_usage_reports` に INSERT（`ON CONFLICT DO NOTHING` で冪等性を担保）
- Cron が複数回実行されても、報告済みの月は `stripe_usage_reports` で検知しスキップ
- Cron が失敗・未実行の場合、次回実行時に未報告月をまとめて報告

**スケジュール:** 毎月1日 00:00 UTC（前月分を報告）+ 毎日 06:00 UTC（未報告検知のフォールバック）

## Checkout / Portal フロー

| フロー | 説明 | 実装 |
| --- | --- | --- |
| 新規サブスクリプション | Stripe Checkout Session を作成し、フロントエンドをリダイレクト | `POST /billing/checkout` → Stripe Checkout |
| プラン変更 | Stripe Customer Portal にリダイレクト | `POST /billing/portal` → Stripe Portal |
| 請求書・支払い履歴 | Stripe Customer Portal で閲覧 | Portal URL を返す |

Stripe Checkout / Customer Portal を使用することで、PCI DSS 準拠の支払いフォームを自前で実装する必要がない。
