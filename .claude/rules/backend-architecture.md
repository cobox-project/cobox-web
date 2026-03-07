# Cobox バックエンド アーキテクチャ仕様

> **詳細仕様は `docs/backend/` に分離。** このファイルはコーディング時に常に参照すべき原則・構造・判断基準のみを記載する。

## Context

cobox-web は現在フロントエンド（Next.js 16 + React 19）のみで、mock データで動作している。
マルチテナント型のカスタマーコミュニケーションプラットフォーム（Email, LINE, Instagram, Facebook）のバックエンドを構築する。

---

## 技術スタック

| 項目 | 選定 | 備考 |
|------|------|------|
| APIフレームワーク | Hono on Cloudflare Workers | エッジ最適化、Effect との相性良好 |
| フロントエンド | Next.js on Cloudflare Pages | OpenNext 経由でデプロイ |
| 型安全ロジック | Effect（バックエンド全体） | Service, Repository, エラーハンドリング, DI |
| ORM | Drizzle ORM | 軽量、型安全、Workers互換 |
| DB | Nile Database（PostgreSQL互換） | ネイティブマルチテナント対応 |
| DB接続 | Cloudflare Hyperdrive | コネクションプーリング |
| 認証 | WorkOS | SSO, AuthKit |
| 決済 | Stripe | サブスクリプション管理、Webhook で状態同期 |
| メール送受信 | Resend | Webhook は同一サービス内 |
| ファイルストレージ | Cloudflare R2 | 添付ファイル保存 |
| 非同期処理 | Cloudflare Queues | 一括メール送信等 |
| バリデーション | Zod + Hono Zod OpenAPI | 型安全バリデーション + OpenAPI スキーマ自動生成 |
| API ドキュメント | Scalar | OpenAPI スキーマから UI を自動生成 |
| 日時操作 | Temporal API | `Date` 不使用、`Temporal.Instant` で統一 |
| Observability | OpenTelemetry + Grafana Cloud | OTel SDK → Grafana Cloud（メトリクス / ログ / トレース / アラート） |
| Lint / Format | Biome | lint + formatter 一体型、高速 |
| テスト | Vitest | `@cloudflare/vitest-pool-workers` |

---

## 1. プロジェクト構成

### pnpm Workspaces モノレポ

```
cobox/
├── package.json                   # pnpm workspace root
├── pnpm-workspace.yaml
├── tsconfig.base.json             # 共通 TypeScript 設定（paths エイリアス含む）
├── packages/
│   ├── shared/                    # @cobox/shared
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── types/             # ドメイン型（現 src/data/types.ts を発展）
│   │       │   ├── index.ts
│   │       │   ├── conversation.ts
│   │       │   ├── contact.ts
│   │       │   ├── account.ts
│   │       │   ├── message.ts
│   │       │   ├── template.ts
│   │       │   └── auth.ts
│   │       ├── errors/            # Effect TaggedError 定義
│   │       │   ├── index.ts
│   │       │   ├── conversation.ts
│   │       │   ├── contact.ts
│   │       │   └── auth.ts
│   │       ├── schema/            # バリデーションスキーマ（Zod）
│   │       │   ├── index.ts
│   │       │   ├── conversation.ts
│   │       │   ├── contact.ts
│   │       │   └── message.ts
│   │       └── constants.ts       # STATUS_TRANSITIONS, CHANNEL_TYPES 等
│   │
│   ├── api/                       # @cobox/api
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── wrangler.json          # Workers 用設定（Hyperdrive, R2, Queues）
│   │   ├── drizzle.config.ts
│   │   ├── vitest.config.ts
│   │   └── src/
│   │       ├── index.ts           # Worker エントリポイント
│   │       ├── app.ts             # Hono インスタンス + ミドルウェア登録
│   │       ├── middleware/
│   │       │   ├── auth.ts        # WorkOS JWT 検証
│   │       │   ├── authorize.ts   # IAM アクション・リソース認可チェック
│   │       │   ├── tenant.ts      # テナントコンテキスト抽出
│   │       │   ├── security.ts    # CORS, CSRF, セキュリティヘッダ
│   │       │   └── error-handler.ts  # Effect エラー → HTTP レスポンス変換
│   │       ├── routes/
│   │       │   ├── conversations.ts
│   │       │   ├── messages.ts
│   │       │   ├── contacts.ts
│   │       │   ├── accounts.ts
│   │       │   ├── templates.ts
│   │       │   ├── team.ts
│   │       │   ├── auth.ts
│   │       │   ├── billing.ts            # Checkout, Portal, プラン情報
│   │       │   ├── reports.ts
│   │       │   └── webhooks/
│   │       │       ├── resend.ts
│   │       │       ├── line.ts
│   │       │       ├── instagram.ts
│   │       │       ├── facebook.ts
│   │       │       └── stripe.ts         # Stripe Webhook（署名検証）
│   │       ├── services/
│   │       │   ├── ConversationService.ts
│   │       │   ├── MessageService.ts
│   │       │   ├── ContactService.ts
│   │       │   ├── AccountService.ts
│   │       │   ├── TemplateService.ts
│   │       │   ├── TeamService.ts
│   │       │   ├── BillingService.ts     # Stripe API 操作、プラン状態管理
│   │       │   ├── ThreadingService.ts   # 7日ウィンドウ、メールスレッディング
│   │       │   ├── StatusMachine.ts      # ステータス遷移ロジック
│   │       │   ├── IdempotencyService.ts
│   │       │   └── channels/
│   │       │       ├── ChannelGateway.ts     # 統一送受信インターフェース
│   │       │       ├── ChannelRouter.ts      # チャネル種別→Gateway 解決
│   │       │       ├── EmailGateway.ts       # Resend API 実装
│   │       │       ├── LineGateway.ts        # LINE Messaging API 実装
│   │       │       ├── InstagramGateway.ts   # Instagram Graph API 実装
│   │       │       └── FacebookGateway.ts    # Facebook Messenger API 実装
│   │       ├── repositories/
│   │       │   ├── ConversationRepo.ts
│   │       │   ├── MessageRepo.ts
│   │       │   ├── ContactRepo.ts
│   │       │   ├── AccountRepo.ts
│   │       │   ├── TemplateRepo.ts
│   │       │   ├── TeamRepo.ts
│   │       │   ├── SubscriptionRepo.ts   # サブスクリプション状態の永続化
│   │       │   ├── PermissionRepo.ts
│   │       │   └── IdempotencyRepo.ts
│   │       ├── db/
│   │       │   ├── client.ts             # Drizzle + Hyperdrive クライアント
│   │       │   ├── schema/
│   │       │   │   ├── index.ts
│   │       │   │   ├── workspaces.ts
│   │       │   │   ├── users.ts
│   │       │   │   ├── accounts.ts
│   │       │   │   ├── contacts.ts
│   │       │   │   ├── conversations.ts
│   │       │   │   ├── messages.ts
│   │       │   │   ├── templates.ts
│   │       │   │   ├── permissions.ts
│   │       │   │   ├── contact-groups.ts
│   │       │   │   └── subscriptions.ts
│   │       │   ├── migrations/
│   │       │   └── backfill/           # バックフィルスクリプト
│   │       ├── lib/
│   │       │   ├── cursor.ts           # カーソルページネーション
│   │       │   └── retry.ts            # リトライスケジュール
│   │       ├── domain/
│   │       │   └── conversation.ts     # ドメインロジック（純粋関数）
│   │       └── effect/
│   │           ├── layers.ts             # Layer 合成
│   │           ├── runtime.ts            # リクエスト毎の Effect 実行ヘルパー
│   │           └── request-context.ts    # RequestContext Service
│   │
│   └── web/                       # @cobox/web
│       ├── package.json
│       ├── tsconfig.json
│       ├── wrangler.json          # Pages 用設定（現行を移動）
│       ├── next.config.ts
│       ├── open-next.config.ts
│       └── src/                   # 現行の src/ を移動
│           └── lib/
│               └── api-client.ts  # Hono RPC クライアント（hc）
```

### パッケージ間の依存関係

```
@cobox/web  ──→  @cobox/shared
@cobox/api  ──→  @cobox/shared
```

- `@cobox/shared`: 型、エラー定義、バリデーションスキーマ。Effect の `Data` モジュールのみ依存。Drizzle には依存しない。
- `@cobox/api`: Hono, Effect, Drizzle に依存。
- `@cobox/web`: Next.js に依存。API との通信は Hono RPC クライアント経由。

### パスエイリアス

各パッケージ内の import は相対パスではなく `@/` プレフィックスで root から参照する。
別パッケージの参照はパッケージ名（`@cobox/shared/types/actions` 等）で行う。

> 詳細: [coding-conventions.md - 1.2 パスエイリアス / 1.3 import 規約](./coding-conventions.md)

### マイグレーション手順

1. pnpm workspaces 初期化（`pnpm-workspace.yaml`）
2. 現行の `src/`, `next.config.ts`, `open-next.config.ts`, Pages 用 `wrangler.json` を `packages/web/` へ移動
3. `src/data/types.ts` の型を `packages/shared/src/types/` へ抽出・発展
4. `packages/api/` を新規作成

---

## 2. Effect パターン

### 設計方針: テスタビリティのための依存性逆転

Effect の `Context.Tag` + `Layer` により、依存性逆転原則（DIP）を実現する。

```text
依存の方向（内側のみに依存）:

  Route Handler → Service（型定義） → Repository（型定義）
                   ↑ Layer で実装を注入    ↑ Layer で実装を注入
                   ServiceLive             RepoLive（Drizzle）
                                           RepoFake（テスト用）
```

- Service / Repository は `Context.Tag` の型定義に依存し、実装に直接依存しない
- 実装の注入は Layer の合成でのみ行う
- 外部サービス（Resend, WorkOS, R2 等）も `Context.Tag` でラップし差し替え可能にする
- ドメインロジック（ステータス遷移等）は純粋関数として切り出し、Effect なしで単体テスト可能にする

### レイヤー構成

```text
Hono Route Handler
  └→ runEffect(c, effect)
       ├→ RequestContext Layer（リクエスト毎: tenantId, userId, requestedAt）
       ├→ ActionContext Layer（リクエスト毎: CASL Ability）
       └→ App Layer（アプリ全体で共有）
            ├→ *ServiceLive Layers
            │    └→ *RepoLive Layers
            │         └→ DrizzleClient Layer
            └→ External Service Layers（Resend, WorkOS 等）
```

- **RequestContext**: テナント情報 + リクエスト受付時刻（`requestedAt`）を保持
- **ActionContext**: CASL Ability を Effect Service として提供

### 型付きエラー

Effect の `Data.TaggedError` でドメインエラーを定義し、エラーハンドラミドルウェアで HTTP ステータスにマッピングする。

> 実装パターン: [coding-conventions.md - 2. Effect 実装パターン](./coding-conventions.md)

---

## 3. 認証（サマリー）

Unified API (API-First) 設計。全呼び出し元（session / oauth / api_key）で同一 API を共有する。
認証は全て WorkOS に委任。CallerType で判別し、RequestContext を生成。

- **session**: HTTP-only Cookie（WorkOS JWT）。フロントエンド用
- **oauth**: Authorization: Bearer（WorkOS OAuth トークン）。サードパーティ用
- **api_key**: Authorization: Bearer（WorkOS M2M トークン）。スクリプト/Terraform 用

> 詳細（ミドルウェアチェーン、M2M 認証、レート制限）: [docs/backend/auth.md](../../docs/backend/auth.md)

---

## 4. API 設計（サマリー）

`@hono/zod-openapi` で Zod バリデーション + OpenAPI スキーマ自動生成 + Hono RPC 型安全通信を一つのルート定義で実現。
URL プレフィックス方式（`/api/v1/...`）でバージョニング。Scalar で API ドキュメント UI を提供。

> エンドポイント一覧: [docs/backend/api-endpoints.md](../../docs/backend/api-endpoints.md)

---

## 5. データモデル（サマリー）

- **Uni-temporal**: `recorded_at` / `superseded_at` で履歴追跡。センチネル値 `9999-12-31T23:59:59Z`（NULL 不使用）
- **ソフトデリート**: `state = 'deleted'` で管理。デフォルトクエリから除外
- **タイムスタンプ**: 全て `RequestContext.requestedAt` を使用（DB の `now()` 不使用）
- **ID 生成**: UUIDv7（デフォルト）、μs UNIX タイムスタンプ（messages / attachments）
- **マイグレーション**: Expand-Contract パターンで破壊的変更を安全に実行
- **ステータス遷移**: `StatusMachine` 純粋関数で管理（new → in_progress → completed/no_action）

> 詳細（DB スキーマ、テーブル一覧、制約、インデックス、遷移表）: [docs/backend/data-model.md](../../docs/backend/data-model.md)

---

## 6. 認可モデル（サマリー）

CASL で IAM ライクな `action + subject` ベースの認可。`requireAction` ミドルウェア + Service 層の defense in depth で二重チェック。

- Phase 1 では全ユーザーに全操作を許可。将来的にポリシーベースで制限を追加
- M2M は WorkOS M2M トークンの `permissions` クレームを CASL Ability に変換

> 詳細（Action 一覧、Subject 定義、ルート-Action マッピング）: [docs/backend/authorization.md](../../docs/backend/authorization.md)

---

## 7. セキュリティ

### 実装に組み込むセキュリティ対策

| カテゴリ | 対策 | 実装箇所 |
|----------|------|----------|
| 認証 | WorkOS JWT 検証（全 API ルート） | `middleware/auth.ts` |
| 認可 | テナント分離 + ロールベースアクセス制御 | `RequestContext` + `middleware/authorize.ts` |
| 入力検証 | Zod + `@hono/zod-openapi` で全リクエストを検証 | 各ルートハンドラ |
| SQL インジェクション | Drizzle ORM のパラメータバインディング（生 SQL 禁止） | Repository 層 |
| テナント漏洩防止 | 全クエリに tenant_id 条件を強制 + Nile RLS | Repository 層 |
| Webhook 検証 | Resend の署名検証（svix）、LINE の署名検証 | `routes/webhooks/` |
| CORS | Hono の CORS ミドルウェア（許可オリジン制限） | `app.ts` |
| レート制限 | Cloudflare Rate Limiting Rules | Cloudflare ダッシュボード |
| 秘密情報管理 | Cloudflare Workers Secrets | `wrangler secret put` |
| チャネルトークン暗号化 | `accounts.config` 内のトークンを AES-256-GCM で暗号化。暗号化キーは Workers Secrets で管理（`CHANNEL_ENCRYPTION_KEY`） | Repository 層（encrypt/decrypt ヘルパー） |
| CSRF | SameSite Cookie + Origin ヘッダ検証 | `middleware/security.ts` |
| XSS | Content-Type 強制 + CSP ヘッダ | `middleware/security.ts` |
| テンプレート変数エスケープ | HTML メール送信時、`{{変数}}` の展開値を HTML エスケープする。テキストメール・LINE・Instagram・Facebook はプレーンテキストのためエスケープ不要 | テンプレート展開処理（Service 層） |
| ログ | 機密情報をログに含めない（PII マスキング） | 全レイヤー |

### 暗号化キーローテーション

`CHANNEL_ENCRYPTION_KEY` が漏洩した場合に備え、キーローテーションに対応する。

- **キーバージョンプレフィックス**: 暗号化時にバージョンを付与（例: `v1:Base64暗号文`）。復号時にプレフィックスから使用するキーを判別
- **Workers Secrets**: `CHANNEL_ENCRYPTION_KEY_V1`（現行）、`CHANNEL_ENCRYPTION_KEY_V2`（新キー）を並行で保持
- **ローテーション手順**:
  1. 新キー（`CHANNEL_ENCRYPTION_KEY_V2`）を Workers Secrets に追加
  2. アプリケーションをデプロイ（新規暗号化は `v2:` で実行、復号は `v1:` / `v2:` 両方に対応）
  3. バックフィルスクリプトで全 `accounts.config` を `v2:` で再暗号化
  4. 再暗号化完了を確認後、旧キー（`CHANNEL_ENCRYPTION_KEY_V1`）を Workers Secrets から削除

### レビューチェックリスト

> [coding-conventions.md - 9. レビューチェックリスト](./coding-conventions.md) に一元管理。
> CLAUDE.md にも転記してコーディングエージェントが自動参照するようにする。

---

## 8. テスト戦略

Effect の Layer 差し替えにより、各層を独立してテスト可能にする。
外部サービスへの依存は全て `Context.Tag` 経由とし、テスト時に fake 実装を注入する。

| レイヤー | 方式 | 依存 | ツール |
|----------|------|------|--------|
| ドメインロジック（純粋関数） | 入力→出力の直接テスト | なし | Vitest |
| Service（単体） | Effect Layer を fake に差し替え | fake Repo / fake 外部サービス | Vitest |
| Repository（統合） | テスト用 DB でスキーマ検証 | テスト DB | Vitest + テスト DB |
| API（E2E） | `app.request()` でリクエスト/レスポンス検証 | fake or テスト DB | Vitest |
| Workers ランタイム | Workers 環境での統合テスト | テスト DB | `@cloudflare/vitest-pool-workers` |

> テストの書き方: [coding-conventions.md - 5. テストの書き方](./coding-conventions.md)

---

## 9. 冪等性・並行制御（サマリー）

- **Webhook 重複排除**: `idempotency_keys` テーブル + `IdempotencyService.processOnce()`
- **クライアント冪等性**: `Idempotency-Key` ヘッダー対応（POST 系エンドポイント）
- **楽観的ロック**: `superseded_at` ベースの CAS パターン。不一致時は `409 Conflict`
- **リアルタイム通信**: SSE（Durable Objects）で新着メッセージ・ステータス変更・入力ロック通知
- **入力ロック**: Durable Objects のインメモリ状態で管理（DB 保存なし）。30秒タイムアウト

> 詳細（SSE 設計、各操作の競合制御、コード例）: [docs/backend/concurrency.md](../../docs/backend/concurrency.md)

---

## 10. マルチチャネルメッセージング（サマリー）

`ChannelGateway` インターフェースで Email/LINE/Instagram/Facebook を統一抽象化。`ChannelRouter` でチャネル種別に応じた Gateway を解決。

- **Webhook 受信**: 署名検証 → Account 解決 → コンタクト解決 → 会話解決（7日ウィンドウ + ステータス再浮上） → メッセージ保存
- **スレッディング**: Email は RFC 2822 ヘッダ。LINE/Instagram/Facebook は account_id + contact_id + 7日ウィンドウ

> 詳細（チャネル別仕様、送受信フロー、accounts.config 構造）: [docs/backend/messaging.md](../../docs/backend/messaging.md)

---

## 11. 課金（サマリー）

Stripe を Single Source of Truth とし、Webhook で DB に状態同期。`PlanContext` Service で機能制限を判定。
LINE 従量課金は月次バッチで Stripe に Usage Record を報告（冪等設計 + フォールバック Cron）。

> 詳細（プランモデル、Webhook イベント、Feature Gate、LINE 従量課金）: [docs/backend/billing.md](../../docs/backend/billing.md)

---

## 12. Observability（サマリー）

OpenTelemetry で統一。Workers の `waitUntil()` + OTLP/HTTP で Grafana Cloud に送信。Effect の `withSpan` でトレーシング。
全 span/ログに `tenant.id`, `user.id` を付与。PII マスキング必須。

> 詳細（アラートルール、データフロー）: [docs/backend/observability.md](../../docs/backend/observability.md)

---

## 13. インフラ・開発環境（サマリー）

- **DB 接続**: Hyperdrive でコネクションプーリング。テナント分離は全クエリに `WHERE tenant_id = ?` を強制（`SET nile.tenant_id` は使わない）
- **インフラ管理**: 別リポジトリで Terraform 管理。このリポジトリにはアプリケーションコードのみ
- **リトライ**: 外部サービスに `standardRetry`（指数バックオフ、最大3回）。4xx はリトライしない
- **ページネーション**: カーソルベース。`LIMIT + 1` で `hasMore` 判定。Row Value 比較
- **開発環境**: Dev Container（PostgreSQL）+ `wrangler dev`

> 詳細（wrangler.json、DB クライアント、リトライポリシー、カーソル設計、Dev Container 構成）: [docs/backend/infrastructure.md](../../docs/backend/infrastructure.md)

---

## 14. 実装フェーズ

> 別ファイルに切り出し済み: [implementation-phases.md](./implementation-phases.md)
