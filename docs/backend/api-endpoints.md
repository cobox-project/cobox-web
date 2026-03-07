# API エンドポイント一覧

> このドキュメントは [backend-architecture.md](../../.claude/rules/backend-architecture.md) から切り出した詳細仕様。

---

## API バージョニング

URL プレフィックス方式（`/api/v1/...`）を採用する。

```text
/api/v1/conversations
/api/v1/contacts
/api/v1/m2m-apps
```

- フロントエンド（`hc` クライアント）も `/api/v1` を使用
- 新フィールドの追加は後方互換のため `v1` 内で実施可能
- 破壊的変更が必要な場合のみ `v2` を作成
- 旧バージョンは最低 12 ヶ月サポート、`Sunset` ヘッダーで非推奨を通知

OpenAPI SecurityScheme:

| スキーム名 | 対象 | 方式 |
| --- | --- | --- |
| `cookieAuth` | フロントエンド（session） | Cookie: `access_token` |
| `bearerAuth` | OAuth 委任 / M2M | `Authorization: Bearer <token>`（WorkOS が発行） |

---

## エンドポイント一覧

### 認証

| Method | Path | 説明 |
|--------|------|------|
| POST | `/auth/callback` | WorkOS OAuth コールバック |
| POST | `/auth/refresh` | トークンリフレッシュ |
| POST | `/auth/logout` | セッション無効化 |

### M2M アプリケーション管理

| Method | Path | 説明 |
|--------|------|------|
| GET | `/m2m-apps` | M2M アプリケーション一覧（WorkOS API 経由） |
| POST | `/m2m-apps` | M2M アプリケーション作成（管理者のみ、WorkOS API 経由） |
| DELETE | `/m2m-apps/:id` | M2M アプリケーション無効化（WorkOS API 経由） |
| POST | `/m2m-apps/:id/rotate` | クライアントシークレットローテーション（WorkOS API 経由） |

### 会話

| Method | Path | 説明 |
|--------|------|------|
| GET | `/conversations` | 一覧（status, channel, assignee, mentioned, favorite でフィルタ） |
| GET | `/conversations/:id` | 詳細（メッセージ付き） |
| PATCH | `/conversations/:id/status` | ステータス変更（アクションベース） |
| PATCH | `/conversations/:id/assign` | アサイン追加/削除 |
| POST | `/conversations/:id/self-assign` | 入力開始時の自分アサイン（未アサインでも追加アサイン） |
| PATCH | `/conversations/:id/favorite` | お気に入りトグル |
| POST | `/conversations/:id/link` | 会話リンク |
| DELETE | `/conversations/:id/link/:linkedId` | リンク解除 |
| DELETE | `/conversations/:id` | 削除（ソフトデリート） |
| POST | `/conversations/:id/typing/start` | 入力ロック開始 |
| POST | `/conversations/:id/typing/stop` | 入力ロック解除 |

### メッセージ

| Method | Path | 説明 |
|--------|------|------|
| POST | `/conversations/:id/messages` | 返信送信 |
| POST | `/conversations/:id/messages/internal` | チーム内メモ |

### コンタクト

| Method | Path | 説明 |
|--------|------|------|
| GET | `/contacts` | 一覧（検索、グループフィルタ） |
| GET | `/contacts/:id` | 詳細（会話履歴付き） |
| POST | `/contacts` | 作成 |
| PATCH | `/contacts/:id` | 更新 |
| DELETE | `/contacts/:id` | 削除 |

### コンタクトグループ

| Method | Path | 説明 |
|--------|------|------|
| GET | `/contact-groups` | 一覧 |
| POST | `/contact-groups` | 作成 |
| PATCH | `/contact-groups/:id` | 更新 |
| DELETE | `/contact-groups/:id` | 削除 |
| POST | `/contact-groups/:id/members` | メンバー追加/削除 |

### アカウント（チャネル接続）

| Method | Path | 説明 |
|--------|------|------|
| GET | `/accounts` | 一覧 |
| GET | `/accounts/:id` | 詳細 |
| POST | `/accounts` | 接続追加 |
| PATCH | `/accounts/:id` | 更新 |
| DELETE | `/accounts/:id` | 削除 |

### テンプレート

| Method | Path | 説明 |
|--------|------|------|
| GET | `/templates` | 一覧 |
| POST | `/templates` | 作成 |
| PATCH | `/templates/:id` | 更新 |
| DELETE | `/templates/:id` | 削除 |
| PATCH | `/templates/reorder` | 並び替え |

### カスタム変数

| Method | Path | 説明 |
|--------|------|------|
| GET | `/variables` | 一覧 |
| POST | `/variables` | 作成 |
| PATCH | `/variables/:id` | 更新 |
| DELETE | `/variables/:id` | 削除 |

### チーム

| Method | Path | 説明 |
|--------|------|------|
| GET | `/team/members` | メンバー一覧 |
| POST | `/team/invite` | 招待（WorkOS 経由） |
| PATCH | `/team/members/:id/permissions` | チャネル権限変更 |
| DELETE | `/team/members/:id` | メンバー削除 |

### 一括メール

| Method | Path | 説明 |
|--------|------|------|
| POST | `/bulk-email/send` | 送信（Queues 経由） |
| POST | `/bulk-email/drafts` | 下書き保存 |
| GET | `/bulk-email/drafts` | 下書き一覧 |
| PATCH | `/bulk-email/drafts/:id` | 下書き更新 |
| DELETE | `/bulk-email/drafts/:id` | 下書き削除 |
| POST | `/bulk-email/validate-variables` | 本文中の未定義変数を検出 |
| GET | `/bulk-email/sends` | 送信履歴一覧 |
| GET | `/bulk-email/sends/:id` | 送信結果詳細（成功/失敗件数、バウンス等） |

### 課金

| Method | Path | 説明 |
|--------|------|------|
| GET | `/billing/subscription` | 現在のサブスクリプション情報 |
| POST | `/billing/checkout` | Stripe Checkout Session 作成 |
| POST | `/billing/portal` | Stripe Customer Portal セッション作成 |

### Webhook（認証なし、署名検証あり）

| Method | Path | 説明 |
|--------|------|------|
| POST | `/webhooks/resend` | メール受信 |
| POST | `/webhooks/line` | LINE メッセージ |
| POST | `/webhooks/instagram` | Instagram メッセージ |
| POST | `/webhooks/facebook` | Facebook Messenger |
| POST | `/webhooks/stripe` | Stripe イベント（サブスクリプション変更、支払い等） |

### レポート

| Method | Path | 説明 |
|--------|------|------|
| GET | `/reports/metrics` | ダッシュボード用集計メトリクス |

---

## フロントエンドからの利用

```typescript
// packages/web/src/lib/api-client.ts
import { hc } from "hono/client"
import type { AppType } from "@cobox/api/src/app"

export const api = hc<AppType>(process.env.NEXT_PUBLIC_API_URL!)
```
