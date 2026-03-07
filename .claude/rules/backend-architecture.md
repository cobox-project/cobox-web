# Cobox バックエンド アーキテクチャ仕様

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
| Observability | OpenTelemetry | トレース・メトリクス・ログの標準化 |
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
│   │       │   ├── NotificationService.ts
│   │       │   ├── StatusMachine.ts      # ステータス遷移ロジック
│   │       │   ├── IdempotencyService.ts
│   │       │   └── channels/
│   │       │       ├── ChannelGateway.ts     # 統一送受信インターフェース
│   │       │       ├── ChannelRouter.ts      # チャネル種別→Gateway 解決
│   │       │       ├── EmailGateway.ts       # Resend 実装
│   │       │       ├── LineGateway.ts        # LINE Messaging API 実装
│   │       │       ├── InstagramGateway.ts   # Instagram Graph API 実装
│   │       │       └── FacebookGateway.ts    # Facebook Messenger 実装
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

## 2. DB 接続: Hyperdrive

### 背景

Cloudflare Workers は V8 isolate でリクエスト毎に起動されるため、直接 DB 接続するとコネクションが爆発する。
Hyperdrive でコネクションプーリングを行う。

参考: https://www.thenile.dev/docs/integrations/cloudflare

### wrangler.json（API Worker）

wrangler.json にはアプリケーションコードに関わる設定のみ記載する。
Hyperdrive, R2, Queues 等のリソース作成・設定は別リポジトリの Terraform で管理する（後述）。

```json
{
  "name": "cobox-api",
  "main": "src/index.ts",
  "compatibility_date": "2025-12-30",
  "compatibility_flags": ["nodejs_compat"],
  "hyperdrive": [
    { "binding": "HYPERDRIVE", "id": "<terraform で作成された hyperdrive-config-id>" }
  ],
  "r2_buckets": [
    { "binding": "ATTACHMENTS", "bucket_name": "cobox-attachments" }
  ]
}
```

### Drizzle + Hyperdrive クライアント

```typescript
// packages/api/src/db/client.ts
import { Context, Layer } from "effect"
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as schema from "@/db/schema"

export type DrizzleClient = {
  readonly db: ReturnType<typeof drizzle>
}

export const DrizzleClient = Context.GenericTag<DrizzleClient>("DrizzleClient")

// 本番: Hyperdrive 経由
export const DrizzleClientLive = (hyperdrive: Hyperdrive) =>
  Layer.succeed(DrizzleClient, {
    db: drizzle(hyperdrive, { schema }),
  })

// ローカル開発: postgres.js 直接接続
export const DrizzleClientDev = (databaseUrl: string) =>
  Layer.succeed(DrizzleClient, {
    db: drizzle(postgres(databaseUrl), { schema }),
  })
```

### テナント分離の方針

Hyperdrive はコネクションプーラーのため `SET nile.tenant_id` が別リクエストに漏れるリスクがある。

**採用する方式:**
- 全クエリに `WHERE tenant_id = ?` を Drizzle のクエリビルダで明示的に付与
- Effect の `RequestContext` Service で tenant_id をリクエストスコープで管理
- Repository 層で全メソッドに tenant_id を自動適用
- Nile の RLS は追加の防御層として活用（`SET` は使わない）

---

## 3. Effect パターン

### 3.1 設計方針: テスタビリティのための依存性逆転

Effect の `Context.Tag` + `Layer` により、依存性逆転原則（DIP）を実現する。
厳密なレイヤー分離（domain / use case / infrastructure）は行わないが、以下の原則でテスタビリティを確保する。

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

### 3.2 レイヤー構成

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

### 3.3 型付きエラー

Effect の `Data.TaggedError` でドメインエラーを定義し、エラーハンドラミドルウェアで HTTP ステータスにマッピングする。

> 実装パターン: [coding-conventions.md - 2. Effect 実装パターン](./coding-conventions.md)

---

## 4. 認証: Unified API (API-First)

### 4.1 設計方針

**単一の API を全ての呼び出し元（フロントエンド、OAuth、API Key）で共有する。**
AWS マネジメントコンソールが AWS API を使うのと同じアプローチ（Dogfooding）。

これにより:

- CASL の認可ロジックが一元化される
- 将来の Terraform プロバイダー / SDK がフロントエンドと同一 API を使える
- コード重複がなく、全エンドポイントが同一基準で保護される

### 4.2 呼び出し元の識別（CallerType）

```typescript
type CallerType = "session" | "oauth" | "api_key"
```

| CallerType | 用途 | 認証情報 | テナント解決 |
| --- | --- | --- | --- |
| `session` | フロントエンド（Next.js） | HTTP-only Cookie（WorkOS JWT） | JWT の `org_id` |
| `oauth` | OAuth 委任（サードパーティアプリ） | `Authorization: Bearer` ヘッダー（WorkOS OAuth トークン） | トークンの `org_id` |
| `api_key` | M2M（Terraform、スクリプト等） | `Authorization: Bearer` ヘッダー（WorkOS M2M トークン） | トークンの `org_id` |

全ての CallerType で WorkOS が認証情報を管理する。判別の優先順位: `Authorization: Bearer`（トークンの `type` クレームで oauth/m2m を区別） → Cookie

### 4.3 ミドルウェアチェーン

```text
リクエスト
  │
  ▼
┌─────────────────────────────────┐
│  1. CallerIdentification MW     │  ← Cookie / Bearer を判別
│     → CallerContext を生成       │     Bearer: WorkOS トークンの type で oauth/m2m を区別
└─────────────┬───────────────────┘
              ▼
┌─────────────────────────────────┐
│  2. RateLimiting MW             │  ← CallerType に基づく制限
│     (Cloudflare Rate Limiting)  │
└─────────────┬───────────────────┘
              ▼
┌─────────────────────────────────┐
│  3. Authentication MW           │  ← 全方式で WorkOS SDK によるトークン検証
│     → RequestContext を生成      │     session: Cookie JWT / oauth,m2m: Bearer JWT
└─────────────┬───────────────────┘
              ▼
┌─────────────────────────────────┐
│  4. requireAction MW (CASL)     │  ← Ability 構築 → ActionContext 生成
│     session/oauth: role ベース   │
│     api_key: scopes ベース       │
└─────────────┬───────────────────┘
              ▼
┌─────────────────────────────────┐
│  5. Route Handler → Service     │  ← defense in depth (CASL 再チェック)
│     → Repository (tenant_id)    │
└─────────────────────────────────┘
```

### 4.4 セッション認証（フロントエンド）

1. フロントエンド → WorkOS AuthKit にリダイレクト
2. WorkOS → コールバック URL に認可コードを返す
3. `POST /auth/callback` で WorkOS API からトークン交換
4. JWT（access token）を HTTP-only Secure Cookie に設定
5. 以降のリクエストで Cookie から JWT を取り出し検証
6. JWT の `org_id` = テナントID、`sub` = ユーザーID

### 4.5 OAuth 認証（サードパーティアプリ）

**WorkOS Connect** の OAuth アプリケーション機能を利用する。
ユーザーが権限を委任したサードパーティアプリからの API アクセスを `Authorization: Bearer <token>` で許可する。

- WorkOS が OAuth 2.0 Authorization Code フローを提供
- アクセストークンは WorkOS が発行・管理（JWT 形式）
- トークンの検証は WorkOS SDK で実施
- Organization スコープのトークンにより `org_id` からテナントを解決

### 4.6 M2M 認証（API Key）

**WorkOS Connect** の M2M アプリケーション機能を利用する。
スクリプト・Terraform・CI/CD 等のプログラムからのアクセスに使用する。

- WorkOS が OAuth 2.0 Client Credentials フローを提供
- `client_id` + `client_secret` で WorkOS からアクセストークンを取得
- トークンは Organization スコープで発行され、`org_id` クレームからテナントを解決
- アプリケーション側での API Key ハッシュ管理・DB 保存は不要（WorkOS が管理）

詳細は「セクション 14. M2M 認証（WorkOS Connect）」を参照。

### 4.7 WorkOS Organization マッピング

- 1 Cobox ワークスペース = 1 WorkOS Organization
- ワークスペース作成時に WorkOS Organization と Nile テナントを同一 ID で作成
- チーム招待は WorkOS Organization Membership API 経由

### 4.8 RequestContext の拡張

全ての CallerType で同一の `RequestContext` を生成する。

```typescript
export type CallerType = "session" | "oauth" | "api_key"

export type RequestContext = {
  readonly tenantId: TenantId
  readonly userId: UserId
  readonly userRole: "admin" | "member" | "api_key"
  readonly callerType: CallerType
  readonly requestedAt: Temporal.Instant
  // M2M の場合のみ（WorkOS M2M アプリケーション ID）
  readonly m2mClientId?: string
}
```

- `session` / `oauth`: WorkOS JWT の `sub` → userId、`org_id` → tenantId
- `api_key`（M2M）: WorkOS M2M トークンの `sub` → m2mClientId、`org_id` → tenantId。userId は M2M アプリ作成者を紐付け
- M2M の権限スコープは WorkOS M2M アプリケーション設定で管理し、トークンの `permissions` クレームから取得

> 実装パターン: [coding-conventions.md - 2.3 RequestContext](./coding-conventions.md)

### 4.9 レート制限

Cloudflare Rate Limiting を使用し、CallerType に応じた制限を適用する。

| CallerType | 制限 | キー | 備考 |
| --- | --- | --- | --- |
| `session` | 1000 req/min | userId | フロントエンド。緩め |
| `oauth` | 300 req/min | userId | OAuth 委任。中程度 |
| `api_key` | プランに応じて可変 | m2mClientId | Free: 60/min, Pro: 300/min, Enterprise: カスタム |

レスポンスヘッダー: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

---

## 5. API 設計

### 型安全な通信とバリデーション

**`@hono/zod-openapi`** を使用し、以下を一つのルート定義で実現する:

1. **Zod によるリクエスト/レスポンスバリデーション** — サーバーは公開 API のため、全入力を厳密に検証
2. **Hono RPC（`hc` クライアント）による型安全な通信** — コード生成不要でフロントエンドから型付きで呼び出し
3. **OpenAPI スキーマの自動生成** — Zod スキーマから OpenAPI 3.1 仕様を自動出力
4. **Scalar による API ドキュメント UI** — 生成された OpenAPI スキーマを `/docs` で閲覧可能

> バリデーションライブラリの選定: `@effect/schema` ではなく **Zod** を採用する。`@hono/zod-openapi` との統合により OpenAPI スキーマ自動生成が可能になるため。Effect との統合は Service 層以降で行う。

### API ドキュメント

`/docs` エンドポイントで Scalar UI を提供する。開発環境・ステージング環境で有効化し、本番環境では無効化する。

> 実装パターン: [coding-conventions.md - 2.10 Hono Zod OpenAPI ルート定義](./coding-conventions.md)

### API バージョニング

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

### エンドポイント一覧

#### 認証

| Method | Path | 説明 |
|--------|------|------|
| POST | `/auth/callback` | WorkOS OAuth コールバック |
| POST | `/auth/refresh` | トークンリフレッシュ |
| POST | `/auth/logout` | セッション無効化 |

#### M2M アプリケーション管理

| Method | Path | 説明 |
|--------|------|------|
| GET | `/m2m-apps` | M2M アプリケーション一覧（WorkOS API 経由） |
| POST | `/m2m-apps` | M2M アプリケーション作成（管理者のみ、WorkOS API 経由） |
| DELETE | `/m2m-apps/:id` | M2M アプリケーション無効化（WorkOS API 経由） |
| POST | `/m2m-apps/:id/rotate` | クライアントシークレットローテーション（WorkOS API 経由） |

#### 会話

| Method | Path | 説明 |
|--------|------|------|
| GET | `/conversations` | 一覧（status, channel, assignee, search でフィルタ） |
| GET | `/conversations/:id` | 詳細（メッセージ付き） |
| PATCH | `/conversations/:id/status` | ステータス変更（アクションベース） |
| PATCH | `/conversations/:id/assign` | アサイン追加/削除 |
| PATCH | `/conversations/:id/favorite` | お気に入りトグル |
| POST | `/conversations/:id/link` | 会話リンク |
| DELETE | `/conversations/:id/link/:linkedId` | リンク解除 |

#### メッセージ

| Method | Path | 説明 |
|--------|------|------|
| POST | `/conversations/:id/messages` | 返信送信 |
| POST | `/conversations/:id/messages/internal` | チーム内メモ |
| POST | `/conversations/:id/messages/read` | 既読マーク |

#### コンタクト

| Method | Path | 説明 |
|--------|------|------|
| GET | `/contacts` | 一覧（検索、グループフィルタ） |
| GET | `/contacts/:id` | 詳細（会話履歴付き） |
| POST | `/contacts` | 作成 |
| PATCH | `/contacts/:id` | 更新 |
| DELETE | `/contacts/:id` | 削除 |

#### コンタクトグループ

| Method | Path | 説明 |
|--------|------|------|
| GET | `/contact-groups` | 一覧 |
| POST | `/contact-groups` | 作成 |
| PATCH | `/contact-groups/:id` | 更新 |
| DELETE | `/contact-groups/:id` | 削除 |
| POST | `/contact-groups/:id/members` | メンバー追加/削除 |

#### アカウント（チャネル接続）

| Method | Path | 説明 |
|--------|------|------|
| GET | `/accounts` | 一覧 |
| POST | `/accounts` | 接続追加 |
| PATCH | `/accounts/:id` | 更新 |
| DELETE | `/accounts/:id` | 削除 |

#### テンプレート

| Method | Path | 説明 |
|--------|------|------|
| GET | `/templates` | 一覧 |
| POST | `/templates` | 作成 |
| PATCH | `/templates/:id` | 更新 |
| DELETE | `/templates/:id` | 削除 |
| PATCH | `/templates/reorder` | 並び替え |

#### カスタム変数

| Method | Path | 説明 |
|--------|------|------|
| GET | `/variables` | 一覧 |
| POST | `/variables` | 作成 |
| PATCH | `/variables/:id` | 更新 |
| DELETE | `/variables/:id` | 削除 |

#### チーム

| Method | Path | 説明 |
|--------|------|------|
| GET | `/team/members` | メンバー一覧 |
| POST | `/team/invite` | 招待（WorkOS 経由） |
| PATCH | `/team/members/:id/permissions` | チャネル権限変更 |
| DELETE | `/team/members/:id` | メンバー削除 |

#### 一括メール

| Method | Path | 説明 |
|--------|------|------|
| POST | `/bulk-email/send` | 送信（Queues 経由） |
| POST | `/bulk-email/drafts` | 下書き保存 |
| GET | `/bulk-email/drafts` | 下書き一覧 |
| PATCH | `/bulk-email/drafts/:id` | 下書き更新 |
| DELETE | `/bulk-email/drafts/:id` | 下書き削除 |

#### 課金

| Method | Path | 説明 |
|--------|------|------|
| GET | `/billing/subscription` | 現在のサブスクリプション情報 |
| POST | `/billing/checkout` | Stripe Checkout Session 作成 |
| POST | `/billing/portal` | Stripe Customer Portal セッション作成 |

#### Webhook（認証なし、署名検証あり）

| Method | Path | 説明 |
|--------|------|------|
| POST | `/webhooks/resend` | メール受信 |
| POST | `/webhooks/line` | LINE メッセージ |
| POST | `/webhooks/instagram` | Instagram メッセージ |
| POST | `/webhooks/facebook` | Facebook Messenger |
| POST | `/webhooks/stripe` | Stripe イベント（サブスクリプション変更、支払い等） |

#### レポート

| Method | Path | 説明 |
|--------|------|------|
| GET | `/reports/metrics` | ダッシュボード用集計メトリクス |

### フロントエンドからの利用

```typescript
// packages/web/src/lib/api-client.ts
import { hc } from "hono/client"
import type { AppType } from "@cobox/api/src/app"

export const api = hc<AppType>(process.env.NEXT_PUBLIC_API_URL!)
```

---

## 6. データモデル方針

### 6.1 Temporal データモデル

履歴が必要なエンティティや state が変化するエンティティには temporal データモデルを採用する。

#### タイムスタンプの取得方針

**全てのタイムスタンプは `RequestContext.requestedAt`（リクエスト受付時刻）を使用する。DB の `now()` は使わない。**

理由: 1つのリクエスト内で複数テーブルに書き込む場合、DB の `now()` はクエリ実行タイミングによって微妙にズレる。リクエスト受付時刻を統一的に使うことで、同一操作に起因する全レコードのタイムスタンプが一致する。

DDL にも `DEFAULT now()` を定義しない。全カラムを `NOT NULL` とし、アプリケーションから明示的に値を渡すことを強制する（渡し忘れはコンパイルエラー）。

> 実装パターン: [coding-conventions.md - 3.1 タイムスタンプ](./coding-conventions.md)

#### Uni-temporal（トランザクション時間のみ）

「いつ DB に記録されたか」を追跡する。state 変化の履歴を保持する必要があるが、
「実世界でいつ起きたか」と「DB に記録された時刻」の区別が不要なエンティティに適用。

対象: conversations, contacts, accounts, users, channel_permissions, compose_templates

```sql
共通カラム:
  recorded_at    TIMESTAMPTZ NOT NULL  -- レコード作成時刻（アプリから渡す）
  superseded_at    TIMESTAMPTZ NOT NULL  -- 最終更新時刻（アプリから渡す）
  state         TEXT NOT NULL DEFAULT 'active'  -- エンティティのライフサイクル状態
```

#### Bi-temporal（トランザクション時間 + 有効時間）

「実世界でいつ有効だったか」と「いつ DB に記録されたか」の両方を追跡する。
遡及的な修正（過去の事実の訂正）や監査で「いつ時点の認識ではどうだったか」を
再現する必要があるエンティティに適用。

対象: conversation ステータス変更履歴, メンバー権限変更履歴

```sql
共通カラム:
  valid_from       TIMESTAMPTZ NOT NULL  -- 実世界での有効開始時刻（アプリから渡す）
  valid_to         TIMESTAMPTZ NOT NULL DEFAULT '9999-12-31 23:59:59Z'  -- 実世界での有効終了時刻（センチネル値 = 現在有効）
  recorded_at      TIMESTAMPTZ NOT NULL  -- DB 記録時刻（アプリから渡す = requestedAt）
  superseded_at    TIMESTAMPTZ NOT NULL DEFAULT '9999-12-31 23:59:59Z'  -- この記録が訂正された時刻（センチネル値 = 最新）
```

> **NULL の代わりにセンチネル値を使用**: `valid_to` や `superseded_at` に NULL を使うと B-tree インデックスが効かないケースがある。`9999-12-31 23:59:59Z`（`TEMPORAL_INFINITY`）をセンチネル値として使用し、全カラムを `NOT NULL` にすることでインデックスの効率を保証する。
> 実装: [coding-conventions.md - 3.2 Bi-temporal センチネル値](./coding-conventions.md)

#### Temporal 適用ルール

| エンティティ | Temporal モデル | 理由 |
|-------------|----------------|------|
| conversations | uni-temporal | status 遷移の追跡が必要 |
| conversation_status_history | bi-temporal | ステータス変更の完全な監査証跡 |
| users | uni-temporal | アカウント状態のライフサイクル管理 |
| contacts | uni-temporal | 顧客情報の変更追跡 |
| accounts | uni-temporal | チャネル接続のライフサイクル |
| channel_permissions | uni-temporal + 履歴テーブル | 権限変更の監査 |
| messages | 非 temporal（イミュータブル） | 送信済みメッセージは変更不可 |
| attachments | 非 temporal（イミュータブル） | 添付ファイルは変更不可 |
| contact_groups | uni-temporal | グループのライフサイクル |
| compose_templates | uni-temporal | テンプレートの変更追跡 |

### 6.2 ソフトデリート（State ベース）

仕様上「削除」と表現されるが監査的にデータ保持が必要なエンティティは、
DB から物理削除せず `state` カラムで管理する。

#### ソフトデリート適用ルール

| エンティティ | 削除方式 | State 値 | 理由 |
|-------------|---------|----------|------|
| users | ソフトデリート | active / suspended / deleted | メンバー削除後もメッセージ履歴に名前表示が必要 |
| contacts | ソフトデリート | active / archived / deleted | 過去の会話履歴とのリレーション保持 |
| accounts | ソフトデリート | active / disconnected / deleted | チャネル切断後もメッセージ履歴を参照可能 |
| conversations | ソフトデリート | open / completed / no_action / archived | ビジネスデータとして保持必須 |
| compose_templates | ソフトデリート | active / deleted | テンプレート削除後も送信済みメッセージとの関連を保持 |
| contact_groups | ソフトデリート | active / deleted | グループ削除後も監査証跡として保持 |
| channel_permissions | ソフトデリート | active / revoked | 権限変更の監査 |
| messages | 物理削除なし | N/A（イミュータブル） | メッセージは削除不可 |
| attachments | 物理削除なし | N/A（イミュータブル） | 添付ファイルは削除不可 |
| conversation_assignees | 物理削除 | N/A | 監査不要、現在の状態のみ重要 |
| conversation_links | 物理削除 | N/A | 監査不要 |
| conversation_read_status | 物理削除（UPSERT） | N/A | 監査不要 |
| contact_group_members | 物理削除 | N/A | 監査不要 |

#### Repository 層のデフォルト動作

- `findAll` / `findById`: デフォルトで `state != 'deleted'` 条件を付与
- 管理者向けAPIや監査用途では `includeDeleted: true` オプションで全件取得可能
- 「削除」API は `state = 'deleted'` への更新で実行

> 実装パターン: [coding-conventions.md - 3.3 ソフトデリート](./coding-conventions.md)

### 6.3 マイグレーション戦略（Expand-Contract パターン）

#### 背景: デプロイとマイグレーションのタイミングギャップ

Nile Database は物理的には同一 PostgreSQL インスタンス上の共有スキーマであり、DDL は全テナントに一括適用される。
しかし、マイグレーション適用とアプリケーションデプロイ（Cloudflare Workers）の間には必ずタイミングギャップが発生する。

```text
時刻  DB スキーマ          アプリケーション（Workers）
─────────────────────────────────────────────
T1    v1（旧）             v1（旧）          ← 安定
T2    v2（新）に一括適用    v1（旧）がまだ稼働 ← 危険
T3    v2（新）             v2（新）デプロイ   ← 安定
```

T2 の間に旧アプリケーションが新スキーマに対してクエリを発行すると障害が発生する。
これを防ぐため、**全ての破壊的スキーマ変更を Expand-Contract パターンで 2 段階に分けて行う**。

#### Expand-Contract パターン

```text
Phase 1: Expand（拡張）
  マイグレーション: 後方互換な変更のみ（カラム追加 nullable、新テーブル作成等）
  デプロイ: 新コードをデプロイ（新旧スキーマ両対応）

Phase 2: Contract（収縮）
  マイグレーション: 不要になった旧カラム/テーブルの削除、NOT NULL 制約追加等
  ※ Phase 1 のデプロイが完了し、旧コードが完全に消えた後に実行
```

#### 実行順序

**原則: マイグレーションを先に実行し、デプロイを後に行う。**

```text
1. Expand マイグレーション実行（後方互換）
   ↓ 旧コードは影響なく動作し続ける
2. アプリケーションデプロイ（新コード）
   ↓ 新コードは新旧スキーマ両対応で動作
3. Contract マイグレーション実行（不要な旧要素の削除）
   ↓ 旧要素を参照するコードはもう存在しない
4. 安定状態
```

#### 操作別の手順テンプレート

##### カラム追加（NOT NULL）

```text
❌ 1ステップ: ALTER TABLE ADD COLUMN new_col TEXT NOT NULL
   → 旧コードが INSERT 時に new_col を渡さずエラー

✅ Expand:  ALTER TABLE ADD COLUMN new_col TEXT  (nullable)
   Deploy:  新コードは new_col を書き込み + 読み取り時は NULL を考慮
   Data:    既存レコードの new_col を埋める（バックフィル）
   Contract: ALTER TABLE ALTER COLUMN new_col SET NOT NULL
```

##### カラム名変更

```text
❌ 1ステップ: ALTER TABLE RENAME COLUMN old_name TO new_name
   → 旧コードが old_name を参照してエラー

✅ Expand:  ALTER TABLE ADD COLUMN new_name ...
   Deploy:  新コードは new_name を読み書き + old_name からのデータコピーロジック
   Data:    old_name → new_name のバックフィル
   Contract: ALTER TABLE DROP COLUMN old_name
```

##### カラム削除

```text
❌ 1ステップ: ALTER TABLE DROP COLUMN old_col
   → 旧コードが old_col を参照してエラー

✅ Deploy:  新コードから old_col の参照を全て削除（SELECT * を使わない）
   Contract: ALTER TABLE DROP COLUMN old_col
```

##### カラムの型変更

```text
❌ 1ステップ: ALTER TABLE ALTER COLUMN col TYPE new_type
   → 旧コードが旧型を前提とした処理でエラー

✅ Expand:  ALTER TABLE ADD COLUMN col_new new_type
   Deploy:  新コードは col_new を読み書き + col からの変換ロジック
   Data:    col → col_new のバックフィル
   Contract: ALTER TABLE DROP COLUMN col
             ALTER TABLE RENAME COLUMN col_new TO col（必要に応じて）
```

##### テーブル削除

```text
✅ Deploy:  新コードからテーブルへの参照を全て削除
   Contract: DROP TABLE old_table（十分な期間を置く）
```

#### 禁止操作（1ステップで実行してはならない変更）

以下の操作は**必ず Expand-Contract で 2 段階に分ける**:

| 禁止操作 | 理由 | 代替手順 |
| --- | --- | --- |
| `ALTER TABLE ADD COLUMN ... NOT NULL` (デフォルトなし) | 旧コードが値を渡さず INSERT 失敗 | nullable で追加 → バックフィル → NOT NULL 追加 |
| `ALTER TABLE DROP COLUMN` | 旧コードが参照してエラー | コードから参照削除 → カラム削除 |
| `ALTER TABLE RENAME COLUMN` | 旧コードが旧名で参照してエラー | 新カラム追加 → コード移行 → 旧カラム削除 |
| `ALTER TABLE ALTER COLUMN TYPE` (非互換) | 旧コードが旧型を前提 | 新カラム追加 → コード移行 → 旧カラム削除 |
| `DROP TABLE` | 旧コードが参照してエラー | コードから参照削除 → テーブル削除 |
| `ALTER TABLE RENAME` | 旧コードが旧名で参照してエラー | 新テーブル作成 → コード移行 → 旧テーブル削除 |

#### 安全な操作（1ステップで実行可能）

| 操作 | 理由 |
| --- | --- |
| `CREATE TABLE` | 旧コードは新テーブルを参照しない |
| `ADD COLUMN ... NULL` (nullable) | 旧コードは新カラムを無視できる |
| `ADD COLUMN ... DEFAULT val` | 旧コードが INSERT しても DEFAULT が適用される |
| `CREATE INDEX` | 旧コードに影響なし |
| `DROP INDEX` | クエリ性能に影響するが機能的には壊れない |
| `ADD CONSTRAINT ... NOT VALID` | 既存データを検証しない（後で `VALIDATE` を実行） |

#### バックフィルの実行方法

既存レコードのデータ埋め（バックフィル）は、大量のレコードがある場合に注意が必要。

```typescript
// packages/api/src/db/backfill/example.ts
// バッチ処理でバックフィル（テーブルロックを避ける）
const BATCH_SIZE = 1000

const backfillNewColumn = async (db: DrizzleClient) => {
  let updated = 0
  do {
    const result = await db.execute(sql`
      UPDATE contacts
      SET new_col = compute_value(old_col)
      WHERE new_col IS NULL
      LIMIT ${BATCH_SIZE}
    `)
    updated = result.rowCount ?? 0
  } while (updated === BATCH_SIZE)
}
```

- `LIMIT` 付きのバッチで処理し、テーブルロック・長時間トランザクションを防ぐ
- 本番環境ではピーク時間を避けて実行
- 進捗をログに出力し、中断・再開可能にする

#### Drizzle マイグレーションファイルの命名規則

```text
packages/api/src/db/migrations/
  0001_create_workspaces.sql
  0002_create_users.sql
  ...
  0042_expand_add_contacts_phone_normalized.sql    ← Expand
  0043_contract_drop_contacts_phone_old.sql        ← Contract（次リリースで適用）
```

- Expand と Contract のマイグレーションには接頭辞 `expand_` / `contract_` を付与し、意図を明示する
- Contract マイグレーションは Expand のデプロイが完了するまで適用しない

#### CI/CD でのマイグレーション実行

```text
GitHub Actions ワークフロー:

1. PR マージ → main ブランチ
2. マイグレーション実行（drizzle-kit migrate）
   ├─ 成功 → 次のステップへ
   └─ 失敗 → デプロイを中止、アラート通知
3. アプリケーションデプロイ（wrangler deploy）
4. ヘルスチェック
   ├─ 成功 → 完了
   └─ 失敗 → ロールバック（※マイグレーションは戻さない）
```

- マイグレーションは常にデプロイ前に実行
- マイグレーションが Expand-Contract に従っていれば、ロールバック時にマイグレーションを巻き戻す必要がない（旧コードは新スキーマでも動作する）
- Contract マイグレーションは別の PR / リリースサイクルで手動実行

#### ロールバック方針

**原則: Expand マイグレーションは巻き戻さない。アプリケーションコードのみロールバックする。**

Expand-Contract に従っていれば、Expand 後のスキーマは旧コードとの後方互換性が保たれている。
そのため、アプリケーションのロールバック時にマイグレーションを巻き戻す必要はない。

```text
障害発生時:
1. アプリケーションを前バージョンにロールバック（wrangler rollback）
2. 旧コードは Expand 後のスキーマで問題なく動作
3. 原因を調査・修正
4. 修正版を再デプロイ
```

マイグレーション自体に不具合があった場合（例: 誤ったデフォルト値）は、**修正用のマイグレーションを追加で作成**する。
`drizzle-kit` の `DROP` + 再作成ではなく、補正 ALTER を追記する。

### 6.4 トランザクション管理

#### 方針

複数テーブルにまたがる操作はデータベーストランザクションで原子性を保証する。
Drizzle の `db.transaction()` を使用し、Effect と統合する。

#### Effect との統合パターン

```typescript
// packages/api/src/db/transaction.ts
export const withTransaction = <A, E>(
  effect: (tx: DrizzleTransaction) => Effect.Effect<A, E>,
): Effect.Effect<A, E, DrizzleClient> =>
  Effect.gen(function* () {
    const { db } = yield* DrizzleClient
    return yield* Effect.promise(() =>
      db.transaction(async (tx) =>
        Effect.runPromise(effect(tx))
      )
    )
  })
```

#### トランザクションが必要な操作

| 操作 | 関連テーブル | 理由 |
| --- | --- | --- |
| メッセージ送信 | `messages` INSERT + `conversations.last_message_at` UPDATE + ステータス遷移 | 部分的な更新でデータ不整合 |
| 冪等性処理 | ビジネスロジック + `idempotency_keys` INSERT | 処理完了とキー記録の原子性 |
| 楽観的ロック付き更新 | 対象テーブル UPDATE + 履歴テーブル INSERT | 履歴の欠落防止 |
| コンタクト削除 | `contacts` UPDATE + `contact_channel_handles` 関連処理 | 親子の整合性 |
| 会話番号の採番 | `workspaces.next_message_number` UPDATE + `conversations` INSERT | 番号の重複防止 |

#### トランザクションを使わないケース

- 単一テーブルの単一行 INSERT / UPDATE（原子性が自明）
- 読み取り専用クエリ（一覧取得、詳細取得）
- 外部サービス呼び出しを含む処理（トランザクション内で長時間保持しない）

---

## 7. 認可モデル（IAM + CASL）

### 認可の方針

全ての read / write 操作に AWS IAM ポリシーに準じた **action** を定義する。
現時点では監査ログの実装は行わないが、全 Service メソッドに action を紐付けておき、
将来的にオペレーター/グループ毎の権限管理に使用する。

認可エンジンには **CASL**（https://casl.js.org/）を採用する。

- 6KB と軽量で Cloudflare Workers で動作可能
- `action` + `subject` + `conditions` + `fields` の ABAC モデルが IAM と合致
- TypeScript ネイティブ、型安全な能力定義
- `can()` / `cannot()` による直感的な権限チェック
- 条件ベースのフィルタリング対応

> CASL がユースケースに合わない場合は internal ライブラリとして自作することも可。
> CASL の `subject` を我々の `resource` に、CASL の `action` を我々の IAM action にマッピングする。

### Action 命名規則

```text
<service>:<operation>
```

- `service`: リソースのドメイン名（小文字）
- `operation`: 操作の動詞（小文字）

### Action 一覧

```typescript
// packages/shared/src/types/actions.ts

export const Actions = {
  // Conversation
  "conversation:list":           "会話一覧の取得",
  "conversation:read":           "会話詳細の取得",
  "conversation:updateStatus":   "会話ステータスの変更",
  "conversation:assign":         "会話のアサイン変更",
  "conversation:favorite":       "会話のお気に入りトグル",
  "conversation:link":           "会話のリンク",
  "conversation:unlink":         "会話のリンク解除",

  // Message
  "message:list":                "メッセージ一覧の取得",
  "message:send":                "メッセージの送信（返信）",
  "message:sendInternal":        "チーム内メモの送信",
  "message:markRead":            "メッセージの既読マーク",

  // Contact
  "contact:list":                "コンタクト一覧の取得",
  "contact:read":                "コンタクト詳細の取得",
  "contact:create":              "コンタクトの作成",
  "contact:update":              "コンタクトの更新",
  "contact:delete":              "コンタクトの削除（ソフトデリート）",

  // Contact Group
  "contactGroup:list":           "コンタクトグループ一覧の取得",
  "contactGroup:read":           "コンタクトグループ詳細の取得",
  "contactGroup:create":         "コンタクトグループの作成",
  "contactGroup:update":         "コンタクトグループの更新",
  "contactGroup:delete":         "コンタクトグループの削除",
  "contactGroup:addMember":      "コンタクトグループへのメンバー追加",
  "contactGroup:removeMember":   "コンタクトグループからのメンバー削除",

  // Account (Channel)
  "account:list":                "チャネルアカウント一覧の取得",
  "account:read":                "チャネルアカウント詳細の取得",
  "account:create":              "チャネルアカウントの接続",
  "account:update":              "チャネルアカウントの更新",
  "account:delete":              "チャネルアカウントの削除",

  // Template
  "template:list":               "テンプレート一覧の取得",
  "template:read":               "テンプレート詳細の取得",
  "template:create":             "テンプレートの作成",
  "template:update":             "テンプレートの更新",
  "template:delete":             "テンプレートの削除",
  "template:reorder":            "テンプレートの並び替え",

  // Custom Variable
  "variable:list":               "カスタム変数一覧の取得",
  "variable:create":             "カスタム変数の作成",
  "variable:update":             "カスタム変数の更新",
  "variable:delete":             "カスタム変数の削除",

  // Team
  "team:listMembers":            "チームメンバー一覧の取得",
  "team:invite":                 "チームメンバーの招待",
  "team:updatePermissions":      "チームメンバーの権限変更",
  "team:removeMember":           "チームメンバーの削除",

  // Bulk Email
  "bulkEmail:send":              "一括メールの送信",
  "bulkEmail:listDrafts":        "一括メール下書き一覧の取得",
  "bulkEmail:createDraft":       "一括メール下書きの作成",
  "bulkEmail:updateDraft":       "一括メール下書きの更新",
  "bulkEmail:deleteDraft":       "一括メール下書きの削除",

  // Report
  "report:readMetrics":          "レポートメトリクスの取得",

  // M2M App
  "m2mApp:list":                 "M2M アプリケーション一覧の取得",
  "m2mApp:create":               "M2M アプリケーションの作成",
  "m2mApp:revoke":               "M2M アプリケーションの無効化",
  "m2mApp:rotate":               "M2M クライアントシークレットのローテーション",

  // Billing
  "billing:readSubscription":    "サブスクリプション情報の取得",
  "billing:createCheckout":      "Checkout セッションの作成",
  "billing:createPortal":        "Customer Portal セッションの作成",

  // Webhook (system actions)
  "webhook:receiveEmail":        "メール受信 Webhook の処理",
  "webhook:receiveLine":         "LINE Webhook の処理",
  "webhook:receiveInstagram":    "Instagram Webhook の処理",
  "webhook:receiveFacebook":     "Facebook Webhook の処理",
  "webhook:receiveStripe":       "Stripe Webhook の処理",
} as const

export type Action = keyof typeof Actions
```

### CASL Subject（リソース）定義

CASL の `subject` を我々のドメインエンティティにマッピングする。
CASL はインスタンスレベルのチェック（特定リソース ID）と条件ベースのフィルタリングをネイティブにサポートする。

```typescript
// packages/shared/src/types/subjects.ts

// CASL の subject として使用するリソースタイプ
export type Subject =
  | "Conversation"
  | "Message"
  | "Contact"
  | "ContactGroup"
  | "Account"
  | "Template"
  | "Variable"
  | "Team"
  | "BulkEmail"
  | "Report"
  | "Billing"
  | "M2mApp"
  | "all"          // CASL の特殊 subject: 全リソースを表す
```

### CASL Ability

- `AppAbility = PureAbility<[Action, Subject]>` 型で権限を表現
- Phase 1 では全ユーザーに全操作を許可。将来的にポリシーベースで制限を追加
- `buildAbility(userContext)` でユーザーの Ability を構築

#### CallerType 別の Ability 構築

| CallerType | Ability の構築元 | 備考 |
| --- | --- | --- |
| `session` / `oauth` | ユーザーのロール + ポリシー | 既存ロジック |
| `api_key` | WorkOS M2M トークンの `permissions` クレーム | permissions = Action のサブセット |

> 詳細: [セクション 14. M2M 認証（WorkOS Connect）](#14-m2m-認証workos-connect)

### リクエストレベルの認可（ミドルウェア）

認証済みの全 API ルートに `requireAction(action, subject, resolveAttrs?)` ミドルウェアを適用する。
ルートハンドラに到達する前に CASL で IAM チェックを行い、権限がなければ 403 で早期拒否する。

> 実装パターン: [coding-conventions.md - 4.1 ルートへの requireAction 適用](./coding-conventions.md)

### ルート ← Action マッピング一覧

全認証済みエンドポイントに `requireAction` を適用する。

| エンドポイント | Action | Subject | 属性解決 |
|---------------|--------|---------|---------|
| `GET /conversations` | `conversation:list` | `Conversation` | なし |
| `GET /conversations/:id` | `conversation:read` | `Conversation` | `{ id }` |
| `PATCH /conversations/:id/status` | `conversation:updateStatus` | `Conversation` | `{ id }` |
| `PATCH /conversations/:id/assign` | `conversation:assign` | `Conversation` | `{ id }` |
| `PATCH /conversations/:id/favorite` | `conversation:favorite` | `Conversation` | `{ id }` |
| `POST /conversations/:id/link` | `conversation:link` | `Conversation` | `{ id }` |
| `DELETE /conversations/:id/link/:lid` | `conversation:unlink` | `Conversation` | `{ id }` |
| `POST /conversations/:id/messages` | `message:send` | `Message` | `{ conversationId }` |
| `POST /conversations/:id/messages/internal` | `message:sendInternal` | `Message` | `{ conversationId }` |
| `POST /conversations/:id/messages/read` | `message:markRead` | `Message` | `{ conversationId }` |
| `GET /contacts` | `contact:list` | `Contact` | なし |
| `GET /contacts/:id` | `contact:read` | `Contact` | `{ id }` |
| `POST /contacts` | `contact:create` | `Contact` | なし |
| `PATCH /contacts/:id` | `contact:update` | `Contact` | `{ id }` |
| `DELETE /contacts/:id` | `contact:delete` | `Contact` | `{ id }` |
| `GET /accounts` | `account:list` | `Account` | なし |
| `POST /accounts` | `account:create` | `Account` | なし |
| `PATCH /accounts/:id` | `account:update` | `Account` | `{ id }` |
| `DELETE /accounts/:id` | `account:delete` | `Account` | `{ id }` |
| `GET /templates` | `template:list` | `Template` | なし |
| `POST /templates` | `template:create` | `Template` | なし |
| `PATCH /templates/:id` | `template:update` | `Template` | `{ id }` |
| `DELETE /templates/:id` | `template:delete` | `Template` | `{ id }` |
| `GET /team/members` | `team:listMembers` | `Team` | なし |
| `POST /team/invite` | `team:invite` | `Team` | なし |
| `PATCH /team/members/:id/permissions` | `team:updatePermissions` | `Team` | `{ id }` |
| `DELETE /team/members/:id` | `team:removeMember` | `Team` | `{ id }` |
| `POST /bulk-email/send` | `bulkEmail:send` | `BulkEmail` | なし |
| `GET /reports/metrics` | `report:readMetrics` | `Report` | なし |
| `GET /m2m-apps` | `m2mApp:list` | `M2mApp` | なし |
| `POST /m2m-apps` | `m2mApp:create` | `M2mApp` | なし |
| `DELETE /m2m-apps/:id` | `m2mApp:revoke` | `M2mApp` | `{ id }` |
| `POST /m2m-apps/:id/rotate` | `m2mApp:rotate` | `M2mApp` | `{ id }` |
| `GET /billing/subscription` | `billing:readSubscription` | `Billing` | なし |
| `POST /billing/checkout` | `billing:createCheckout` | `Billing` | なし |
| `POST /billing/portal` | `billing:createPortal` | `Billing` | なし |

> Webhook エンドポイント（`/webhooks/*`）は認証不要（署名検証のみ）のため `requireAction` の対象外。

### 認可の二重チェック（Defense in Depth）

```text
リクエスト
  ↓
[auth middleware]       ← JWT 検証、ユーザー特定
  ↓
[requireAction middleware] ← CASL で action + subject チェック（早期拒否）
  ↓
[route handler]        ← リクエスト処理
  ↓
[Service layer]        ← ability.can() による再確認（属性付きインスタンスチェック）
  ↓
[Repository layer]     ← tenant_id 強制
  ↓
[Nile RLS]             ← DB レベルの防御
```

ミドルウェアでの事前チェックと Service 層での再確認で二重に認可を行う。
ミドルウェアはルーティング時点で早期拒否（リクエストパラメータのみ）。
Service 層は DB から取得した実エンティティの属性（チャネル種別、アサイン状態等）で
より精密なインスタンスレベルの CASL チェックが可能。

### Effect との統合（ActionContext）

CASL の `Ability` を Effect の `ActionContext` Service として提供し、Service 層で `actions.authorize()` による defense in depth を行う。

> 実装パターン: [coding-conventions.md - 4.2 ActionContext / 4.3 Service 層の defense in depth](./coding-conventions.md)

### 新機能追加時の必須手順

新しいリソースや操作を追加する際は、Action 定義・Subject 定義・requireAction 適用・Service 層 defense in depth・マッピング表更新・CASL Ability ルール確認を **必ず** 実施する。

> 詳細手順: [coding-conventions.md - 4.4 新機能追加時の必須手順](./coding-conventions.md)

---

### 将来の拡張: ロール/グループ別ポリシー

CASL の `AbilityBuilder` でロール/グループ別のルールを構築する。

```typescript
// 将来実装: ポリシーベースの Ability 構築
export const buildAbilityFromPolicies = (
  userContext: { userId: string; userRole: string },
  policies: PolicyDocument[],
): AppAbility => {
  const { can, cannot, build } = new AbilityBuilder<AppAbility>(PureAbility)

  for (const doc of policies) {
    for (const stmt of doc.statements) {
      const method = stmt.effect === "allow" ? can : cannot

      for (const action of stmt.actions) {
        for (const sub of stmt.subjects) {
          // CASL conditions で属性ベースのフィルタリング
          method(action as Action, sub as Subject, stmt.conditions)
        }
      }
    }
  }

  return build()
}

// ポリシードキュメント（DB に保存、ユーザー/グループに紐付け）
type PolicyDocument = {
  version: "2025-01-01"
  statements: PolicyStatement[]
}

type PolicyStatement = {
  sid?: string
  effect: "allow" | "deny"
  actions: string[]              // e.g. ["conversation:*", "message:send"]
  subjects: string[]             // e.g. ["Conversation", "Message"]
  conditions?: Record<string, any>  // CASL 条件（MongoDB-like クエリ）
}

// ポリシー例: 「Email チャネルの会話のみ閲覧・返信可」
const emailOnlyPolicy: PolicyStatement = {
  sid: "AllowEmailOnly",
  effect: "allow",
  actions: ["conversation:list", "conversation:read", "message:send"],
  subjects: ["Conversation", "Message"],
  conditions: { channel: "email" },   // CASL が conv.channel === "email" をチェック
}

// ポリシー例: 「自分にアサインされた会話のみ操作可」
const assignedOnlyPolicy: PolicyStatement = {
  sid: "AllowAssignedOnly",
  effect: "allow",
  actions: ["conversation:read", "conversation:updateStatus", "message:send"],
  subjects: ["Conversation", "Message"],
  conditions: { "assigneeIds": { "$in": ["{{userId}}"] } },  // ランタイムで userId を注入
}

// ポリシー例: 「設定系は全て拒否（閲覧専用オペレーター）」
const denySettingsPolicy: PolicyStatement = {
  sid: "DenySettings",
  effect: "deny",
  actions: ["account:create", "account:update", "account:delete",
            "template:create", "template:update", "template:delete",
            "team:invite", "team:removeMember", "team:updatePermissions"],
  subjects: ["Account", "Template", "Team"],
}

// 評価順序: CASL のデフォルト動作
// 後に定義されたルールが優先（cannot で上書き可能）
// → ポリシーの順序: allow → deny の順で定義し、deny が最終的に勝つ
```

---

## 8. DB スキーマ

全テナントスコープテーブルに `tenant_id` カラムを持つ。
Temporal モデルとソフトデリートの方針は「6. データモデル方針」に従う。

### テーブル一覧

| テーブル | 主要カラム | Temporal | 削除方式 |
|----------|-----------|----------|----------|
| workspaces | tenant_id(PK), name, slug, plan, next_message_number, state, recorded_at, superseded_at | uni | ソフト |
| users | id, tenant_id, workos_user_id, name, state(active/suspended/deleted), recorded_at, superseded_at | uni | ソフト |
| accounts | id, tenant_id, channel, name, config(JSONB), state(active/disconnected/deleted), recorded_at, superseded_at | uni | ソフト |
| contacts | id, tenant_id, name, company, email, phone, state, recorded_at, superseded_at | uni | ソフト |
| contact_channel_handles | id, tenant_id, contact_id, channel, handle, recorded_at | 非temporal | 物理（親に従う） |
| contact_groups | id, tenant_id, name, description, state, recorded_at, superseded_at | uni | ソフト |
| contact_group_members | contact_group_id, contact_id, tenant_id | 非temporal | 物理 |
| conversations | id, tenant_id, message_number, account_id, contact_id, channel, status, subject, email_thread_id, last_message_at, recorded_at, superseded_at | uni | ソフト（archived） |
| conversation_status_history | id, tenant_id, conversation_id, status, changed_by, valid_from, valid_to, recorded_at, superseded_at | **bi** | 物理削除なし（イミュータブル） |
| conversation_assignees | conversation_id, user_id, tenant_id, assigned_at | 非temporal | 物理 |
| conversation_links | conversation_a_id, conversation_b_id, tenant_id | 非temporal | 物理 |
| conversation_read_status | conversation_id, user_id, tenant_id, last_read_at | 非temporal | UPSERT |
| conversation_favorites | conversation_id, user_id, tenant_id, recorded_at | 非temporal | 物理 |
| messages | id, tenant_id, conversation_id, content, is_inbound, is_internal, sender_*, email_*, recorded_at | 非temporal（イミュータブル） | 削除不可 |
| attachments | id, tenant_id, message_id, name, type, url, recorded_at | 非temporal（イミュータブル） | 削除不可 |
| bulk_email_drafts | id, tenant_id, subject, body, recipient_group_id, created_by, state(draft/sent/deleted), recorded_at, superseded_at | uni | ソフト |
| compose_templates | id, tenant_id, name, subject, body, sort_order, state, recorded_at, superseded_at | uni | ソフト |
| custom_variables | id, tenant_id, key, value, sort_order, recorded_at, superseded_at | uni | ソフト |
| channel_permissions | id, tenant_id, user_id, account_id, can_view, can_reply, state(active/revoked), recorded_at, superseded_at | uni | ソフト |
| channel_permissions_history | id, tenant_id, permission_id, can_view, can_reply, state, changed_by, valid_from, valid_to, recorded_at, superseded_at | **bi** | 物理削除なし（イミュータブル） |
| notifications | id, tenant_id, user_id, type, title, body, is_read, recorded_at | 非temporal | ソフト |
| subscriptions | id, tenant_id, stripe_customer_id, stripe_subscription_id, stripe_price_id, plan, status(active/trialing/past_due/canceled/unpaid), current_period_start, current_period_end, cancel_at, recorded_at, superseded_at | uni | ソフト |
| idempotency_keys | key(PK), source, processed_at, response(JSONB) | 非temporal | 定期パージ（30日） |

### 設計上の判断

- **会話番号**: `workspaces.next_message_number` を `UPDATE ... RETURNING` でアトミックにインクリメント（#00001 形式）
- **メールスレッディング**: `conversations.email_thread_id` と `messages.email_message_id` / `email_in_reply_to` / `email_references` で RFC 準拠のスレッドマッチング
- **既読管理**: ユーザー毎の別テーブルで非正規化を回避
- **双方向リンク**: `conversation_links` は A < B の順序ペアで複合PK
- **添付ファイル**: メタデータは DB、実ファイルは R2
- **Bi-temporal テーブル**: ステータス変更履歴・権限変更履歴はイミュータブル。訂正は `superseded_at` を `requestedAt` に更新して新レコードを INSERT。`valid_to` / `superseded_at` は NULL ではなくセンチネル値 `9999-12-31 23:59:59Z` を使用（インデックス効率のため）
- **ソフトデリート**: `state = 'deleted'` のレコードはデフォルトクエリから除外。管理・監査用途では全件取得可能

---

## 9. セキュリティ

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
| CSRF | SameSite Cookie + Origin ヘッダ検証 | `middleware/security.ts` |
| XSS | Content-Type 強制 + CSP ヘッダ | `middleware/security.ts` |
| ログ | 機密情報をログに含めない（PII マスキング） | 全レイヤー |

### レビューチェックリスト

> [coding-conventions.md - 9. レビューチェックリスト](./coding-conventions.md) に一元管理。
> CLAUDE.md にも転記してコーディングエージェントが自動参照するようにする。

---

## 10. テスト戦略

Effect の Layer 差し替えにより、各層を独立してテスト可能にする。
外部サービスへの依存は全て `Context.Tag` 経由とし、テスト時に fake 実装を注入する。

### レイヤー別テスト

| レイヤー | 方式 | 依存 | ツール |
|----------|------|------|--------|
| ドメインロジック（純粋関数） | 入力→出力の直接テスト | なし | Vitest |
| Service（単体） | Effect Layer を fake に差し替え | fake Repo / fake 外部サービス | Vitest |
| Repository（統合） | テスト用 DB でスキーマ検証 | テスト DB | Vitest + テスト DB |
| API（E2E） | `app.request()` でリクエスト/レスポンス検証 | fake or テスト DB | Vitest |
| Workers ランタイム | Workers 環境での統合テスト | テスト DB | `@cloudflare/vitest-pool-workers` |

> テストの書き方: [coding-conventions.md - 5. テストの書き方](./coding-conventions.md)

---

## 11. Observability（OpenTelemetry）

### Observability の方針

アプリケーション全体で OpenTelemetry（OTel）を導入し、トレース・メトリクス・ログを標準化する。
将来のバックエンド変更（Datadog, Grafana, etc.）に依存しないよう、OTel SDK のみに依存する。

### 導入範囲

| シグナル | 内容 | 実装箇所 |
|----------|------|----------|
| トレース | リクエスト全体の処理フロー（ミドルウェア→Service→Repository→DB） | Hono ミドルウェア + Effect span |
| メトリクス | リクエスト数、レスポンス時間、エラー率 | Hono ミドルウェア |
| ログ | 構造化ログ（JSON 形式、trace_id 付与） | 全レイヤー |

### Cloudflare Workers での制約

Workers は長時間バックグラウンド処理ができないため、テレメトリデータのエクスポートには以下の方式を採用する:

- **Cloudflare Workers Trace Events** を利用し、`waitUntil()` でリクエスト処理後にテレメトリを非同期送信
- OTel Collector へ OTLP/HTTP で送信（Collector のホスティングはインフラリポジトリで管理）

### Effect との統合

Effect の `Span` / `withSpan` を使用し、Service / Repository の各操作にトレーシングを付与する。
Effect の span は OTel span にブリッジ可能。

### 属性の標準化

全 span / ログに以下の属性を付与する:

- `tenant.id` — テナント識別（`RequestContext` から取得）
- `user.id` — ユーザー識別
- `http.method`, `http.route`, `http.status_code` — HTTP コンテキスト

> **PII マスキング**: ログ・トレースにメールアドレス、メッセージ本文等の個人情報を含めない。

---

## 12. プラン・課金（Stripe）

### 課金の方針

テナント（ワークスペース）単位でサブスクリプションプランを管理する。
課金・決済は **Stripe** に完全に委譲し、アプリケーション側はプランの状態を同期して機能制限の判定に使用する。

Stripe を **Single Source of Truth** とし、アプリケーション DB にはキャッシュとしてプラン状態を保持する。
状態の同期は Stripe Webhook で行い、DB の状態は Webhook イベントで上書きされる。

### プランモデル

| プラン | 説明 | 制限例 |
| --- | --- | --- |
| Free | 無料トライアル / 個人利用 | メンバー 1 名、チャネル 1 個、月間メッセージ数制限 |
| Pro | 小〜中規模チーム | メンバー数制限、チャネル数制限、一括メール機能 |
| Enterprise | 大規模・カスタム | 制限なし、SLA、優先サポート |

> プラン名・制限値は仮。実際のプランは事業要件に応じて決定する。

### Stripe リソースマッピング

| Cobox 概念 | Stripe リソース | 備考 |
| --- | --- | --- |
| ワークスペース（テナント） | Customer | `metadata.tenant_id` でマッピング |
| プラン | Product + Price | 月額 / 年額の Price を定義 |
| サブスクリプション | Subscription | 1 テナント = 1 アクティブ Subscription |
| 支払い方法 | PaymentMethod | Customer に紐付け |
| 請求書 | Invoice | Stripe が自動生成 |

### アーキテクチャ

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

### Stripe Webhook で同期するイベント

| Stripe イベント | アプリケーションの処理 |
| --- | --- |
| `customer.subscription.created` | サブスクリプションレコード作成 |
| `customer.subscription.updated` | プラン変更・ステータス更新 |
| `customer.subscription.deleted` | サブスクリプション終了 |
| `invoice.payment_succeeded` | 支払い成功の記録、サービス有効化 |
| `invoice.payment_failed` | 支払い失敗の記録、猶予期間の開始 |
| `customer.subscription.trial_will_end` | トライアル終了通知（3 日前） |

### プラン状態の判定

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

### 機能制限（Feature Gate）

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
  readonly bulkEmailEnabled: boolean
}

export type LimitableResource = "members" | "channels" | "monthlyMessages"
```

Service 層で `planCtx.checkLimit()` を呼び出し、制限超過時は `PlanLimitExceeded` エラーを返す。

### Checkout / Portal フロー

| フロー | 説明 | 実装 |
| --- | --- | --- |
| 新規サブスクリプション | Stripe Checkout Session を作成し、フロントエンドをリダイレクト | `POST /billing/checkout` → Stripe Checkout |
| プラン変更 | Stripe Customer Portal にリダイレクト | `POST /billing/portal` → Stripe Portal |
| 請求書・支払い履歴 | Stripe Customer Portal で閲覧 | Portal URL を返す |

Stripe Checkout / Customer Portal を使用することで、PCI DSS 準拠の支払いフォームを自前で実装する必要がない。

---

## 13. インフラ管理

### インフラ管理の方針

Cloudflare 等の外部サービスのインフラ設定は**別リポジトリで Terraform 管理**する。
このリポジトリ（cobox-web）にはアプリケーションコードのみを含め、インフラの作成・設定は行わない。

### 責務の分離

| 管轄 | このリポジトリ（cobox-web） | インフラリポジトリ（Terraform） |
|------|---------------------------|-------------------------------|
| Workers / Pages | アプリケーションコード、wrangler.json のバインディング参照 | Workers / Pages プロジェクト作成、カスタムドメイン設定 |
| Hyperdrive | wrangler.json に ID を記載して参照 | Hyperdrive 設定の作成（接続文字列管理） |
| R2 | wrangler.json にバケット名を記載して参照 | R2 バケットの作成、CORS ポリシー、ライフサイクルルール |
| Queues | wrangler.json にキュー名を記載して参照 | Queue の作成、DLQ 設定 |
| Rate Limiting | なし | Rate Limiting Rules の定義 |
| Secrets | なし（コードで `c.env.SECRET_NAME` として参照） | `wrangler secret put` または Terraform で設定 |
| Nile Database | Drizzle マイグレーション（スキーマ管理） | DB インスタンスのプロビジョニング |
| WorkOS | なし（SDK で API Key を使用） | Organization 設定、リダイレクト URI 等 |
| Resend | なし（SDK で API Key を使用） | ドメイン認証、Webhook エンドポイント登録 |
| DNS | なし | ドメイン、DNS レコード管理 |

### wrangler.json の扱い

wrangler.json にはバインディング名とリソース ID の参照のみを記載する。
リソース ID は Terraform の output から取得し、環境変数またはファイルで注入する。

```json
{
  "name": "cobox-api",
  "main": "src/index.ts",
  "compatibility_date": "2025-12-30",
  "compatibility_flags": ["nodejs_compat"],
  "hyperdrive": [
    { "binding": "HYPERDRIVE", "id": "$HYPERDRIVE_ID" }
  ]
}
```

### デプロイフロー

1. **Terraform** でインフラリソースを作成（Hyperdrive, R2, Queues, Secrets 等）
2. Terraform output からリソース ID を取得
3. **CI/CD**（GitHub Actions）で `wrangler deploy` を実行、リソース ID を注入

---

## 14. M2M 認証（WorkOS Connect）

### 方針

M2M（Machine-to-Machine）認証には **WorkOS Connect** の M2M アプリケーション機能を使用する。
自前での API Key 生成・ハッシュ管理・DB 保存は行わない。WorkOS がクライアントクレデンシャルの管理を担う。

### WorkOS M2M アプリケーションの仕組み

1. 管理者が Cobox の管理画面（または WorkOS ダッシュボード）で M2M アプリケーションを作成
2. WorkOS が `client_id` + `client_secret` を発行
3. プログラム（スクリプト、Terraform 等）は `client_id` + `client_secret` で WorkOS に OAuth 2.0 Client Credentials リクエスト
4. WorkOS がアクセストークン（JWT）を発行（Organization スコープ付き）
5. プログラムはアクセストークンを `Authorization: Bearer` ヘッダーで Cobox API に送信
6. Cobox API は WorkOS SDK でトークンを検証し、`org_id` からテナントを解決

```text
プログラム                     WorkOS                    Cobox API
  │                             │                         │
  │─── client_id + secret ─────→│                         │
  │                             │                         │
  │←── access_token (JWT) ──────│                         │
  │                             │                         │
  │─── Authorization: Bearer ───────────────────────────→│
  │                             │                         │── JWT 検証（WorkOS SDK）
  │                             │                         │── org_id → tenantId
  │←── API レスポンス ───────────────────────────────────│
```

### スコープ（権限）管理

M2M アプリケーションの権限は WorkOS の `permissions` で管理する。
Cobox の Action 定義と WorkOS permissions を 1:1 でマッピングする。

```typescript
// WorkOS M2M トークンの permissions クレーム
{
  "sub": "m2m_app_01H...",
  "org_id": "org_01H...",
  "permissions": [
    "conversation:list",
    "conversation:read",
    "message:send",
    "contact:list",
    "contact:read"
  ]
}
```

permissions は CASL Ability に直接変換される:

```text
WorkOS permissions: ["conversation:list", "conversation:read", "message:send"]
         ↓
CASL Ability:
  can("conversation:list", "Conversation")
  can("conversation:read", "Conversation")
  can("message:send", "Message")
         ↓
requireAction("conversation:list", "Conversation") → PASS
requireAction("conversation:delete", "Conversation") → 403 Forbidden
```

### Cobox API 経由の M2M アプリケーション管理

WorkOS の M2M アプリケーション CRUD を Cobox API でプロキシし、管理画面から操作可能にする。

| Method | Path | 説明 | WorkOS API |
| --- | --- | --- | --- |
| GET | `/m2m-apps` | M2M アプリケーション一覧 | List M2M Applications |
| POST | `/m2m-apps` | M2M アプリケーション作成（管理者のみ） | Create M2M Application |
| DELETE | `/m2m-apps/:id` | M2M アプリケーション無効化 | Delete M2M Application |
| POST | `/m2m-apps/:id/rotate` | クライアントシークレットローテーション | Rotate M2M Client Secret |

- `client_secret` は作成時のレスポンスでのみ返却（1 回限り表示）
- ローテーション時は WorkOS が新しい `client_secret` を発行し、猶予期間を設定可能

### セキュリティ要件

- クライアントクレデンシャルの管理は WorkOS に委任（アプリケーション DB に保存しない）
- M2M アプリケーション作成は管理者（admin）のみ許可
- アクセストークンの有効期限は WorkOS の設定に従う（デフォルト: 短命トークン）
- スコープ（permissions）は管理者が付与した範囲に制限
- 将来的に IP 制限（allowlist）の追加を検討（WorkOS 側の機能）

---

## 15. 冪等性（Idempotency）

### 方針

外部からのイベント受信（Webhook）およびクライアントからの副作用のある API 呼び出しにおいて、同一リクエストの重複実行を防止する。

### Webhook の重複排除

Stripe, Resend, LINE 等の外部サービスは同一イベントを複数回送信する可能性がある。
イベント ID をキーとして重複を検出・排除する。

```
idempotency_keys テーブル:
  key           TEXT PRIMARY KEY        -- イベント ID（例: Stripe の event.id）
  source        TEXT NOT NULL           -- "stripe" | "resend" | "line" | "instagram" | "facebook"
  processed_at  TIMESTAMPTZ NOT NULL    -- 処理完了時刻
  response      JSONB                   -- 処理結果のキャッシュ（任意）
```

処理フロー:

```text
Webhook 受信
  ↓
署名検証
  ↓
idempotency_keys に key が存在するか？
  ├─ 存在する → 200 OK を即返却（再処理しない）
  └─ 存在しない → トランザクション内で処理 + key を INSERT
```

```typescript
// packages/api/src/services/IdempotencyService.ts
export type IdempotencyService = {
  readonly processOnce: <A>(
    key: string,
    source: IdempotencySource,
    execute: () => Effect.Effect<A, unknown>,
  ) => Effect.Effect<A, IdempotencyError>
}
```

- INSERT は `ON CONFLICT DO NOTHING` で競合を安全に処理
- `processed_at` から一定期間（例: 30 日）経過したレコードは定期パージ

### クライアント API の冪等性

メッセージ送信など副作用のある POST エンドポイントで、クライアントが `Idempotency-Key` ヘッダーを送信可能にする。

| エンドポイント | 冪等性 | 方式 |
| --- | --- | --- |
| `POST /conversations/:id/messages` | `Idempotency-Key` ヘッダー | クライアント生成の UUID |
| `POST /bulk-email/send` | `Idempotency-Key` ヘッダー | クライアント生成の UUID |
| `POST /billing/checkout` | Stripe 側で管理 | Stripe の冪等性キー |
| `PATCH` 系 | 楽観的ロック | `updated_at` ベース |

```typescript
// ミドルウェアでの処理
// Idempotency-Key が存在する場合、idempotency_keys テーブルで重複チェック
// 存在すれば前回のレスポンスを返却、なければ処理を実行して結果を保存
```

### 楽観的ロック

複数オペレーターが同一リソースを同時に更新するケースに対応する。
`updated_at` を使用した楽観的ロックを実装する。

```typescript
// Repository での実装
const update = (tenantId: TenantId, id: ConversationId, data: UpdateData, expectedUpdatedAt: Temporal.Instant) =>
  Effect.gen(function* () {
    const result = yield* Effect.promise(() =>
      db.update(conversations)
        .set({ ...data, updated_at: ctx.requestedAt.toString() })
        .where(and(
          eq(conversations.tenantId, tenantId),
          eq(conversations.id, id),
          eq(conversations.updatedAt, expectedUpdatedAt.toString()),  // 楽観的ロック
        ))
        .returning()
    )
    if (result.length === 0) {
      return yield* new ConflictError({ resource: "Conversation", id })
    }
    return result[0]
  })
```

- クライアントは取得時の `updated_at` を更新リクエストに含める
- 不一致時は `409 Conflict` を返し、クライアントに再取得を促す

---

## 16. ページネーション

### 方針

一覧 API は**カーソルベース**のページネーションを採用する。
オフセットベースはページが深くなるとパフォーマンスが劣化するため使用しない。

### カーソル設計

カーソルは「ソートキーの値 + ID」のペアを Base64 エンコードした不透明文字列とする。

```typescript
// packages/shared/src/types/pagination.ts
export type PaginatedResponse<T> = {
  readonly data: T[]
  readonly nextCursor: string | null  // null = 最終ページ
  readonly hasMore: boolean
}

export type PaginationParams = {
  readonly cursor?: string   // 前回レスポンスの nextCursor
  readonly limit: number     // デフォルト 25, 最大 100
}
```

### ソートキーとカーソルのマッピング

| エンドポイント | デフォルトソート | カーソルキー |
| --- | --- | --- |
| `GET /conversations` | `last_message_at DESC` | `(last_message_at, id)` |
| `GET /contacts` | `name ASC` | `(name, id)` |
| `GET /contacts/:id/conversations` | `last_message_at DESC` | `(last_message_at, id)` |
| `GET /templates` | `sort_order ASC` | `(sort_order, id)` |
| `GET /team/members` | `name ASC` | `(name, id)` |
| `GET /contact-groups` | `name ASC` | `(name, id)` |
| `GET /bulk-email/drafts` | `updated_at DESC` | `(updated_at, id)` |

### カーソルのエンコード/デコード

```typescript
// packages/api/src/lib/cursor.ts

// カーソルは Base64 エンコードされた JSON
// { s: sortValue, id: recordId }
export const encodeCursor = (sortValue: string, id: string): string =>
  btoa(JSON.stringify({ s: sortValue, id }))

export const decodeCursor = (cursor: string): { s: string; id: string } =>
  JSON.parse(atob(cursor))
```

### SQL パターン

```sql
-- 注: 実装では SELECT * ではなく明示的にカラムを指定する（マイグレーション安全性のため）
-- ここでは簡略化のため SELECT * で記載

-- カーソルなし（初回リクエスト）
SELECT * FROM conversations
WHERE tenant_id = $1 AND state != 'deleted'
ORDER BY last_message_at DESC, id DESC
LIMIT $2 + 1  -- +1 で hasMore を判定

-- カーソルあり（2 ページ目以降）
SELECT * FROM conversations
WHERE tenant_id = $1 AND state != 'deleted'
  AND (last_message_at, id) < ($3, $4)  -- Row Value 比較
ORDER BY last_message_at DESC, id DESC
LIMIT $2 + 1
```

- `LIMIT + 1` で取得し、余分な 1 件があれば `hasMore: true`
- Row Value 比較（`(col1, col2) < (val1, val2)`）で正確なページ境界を実現

### Zod スキーマ

```typescript
// packages/api/src/schemas/common.ts
export const PaginationQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
}).openapi("PaginationQuery")
```

---

## 17. インデックス戦略

### 方針

全テナントスコープテーブルに `tenant_id` を先頭に含む複合インデックスを定義する。
カーソルベースページネーションのソートキーに対応するインデックスを用意する。

### インデックス一覧

#### conversations

```sql
-- 一覧取得（ステータスフィルタ + ページネーション）
CREATE INDEX idx_conversations_tenant_status_last_msg
  ON conversations (tenant_id, status, last_message_at DESC, id DESC)
  WHERE state != 'deleted';

-- チャネルフィルタ
CREATE INDEX idx_conversations_tenant_channel
  ON conversations (tenant_id, channel, last_message_at DESC, id DESC)
  WHERE state != 'deleted';

-- コンタクト別会話一覧
CREATE INDEX idx_conversations_tenant_contact
  ON conversations (tenant_id, contact_id, last_message_at DESC, id DESC);

-- メールスレッドマッチング
CREATE INDEX idx_conversations_tenant_thread
  ON conversations (tenant_id, email_thread_id)
  WHERE email_thread_id IS NOT NULL;

-- アサイニーでのフィルタ（JOIN 用）
CREATE INDEX idx_conv_assignees_tenant_user
  ON conversation_assignees (tenant_id, user_id, conversation_id);
```

#### messages

```sql
-- 会話内メッセージ一覧（時系列）
CREATE INDEX idx_messages_tenant_conv_created
  ON messages (tenant_id, conversation_id, created_at ASC, id ASC);

-- メールヘッダマッチング
CREATE INDEX idx_messages_tenant_email_msg_id
  ON messages (tenant_id, email_message_id)
  WHERE email_message_id IS NOT NULL;
```

#### contacts

```sql
-- 名前順一覧 + ページネーション
CREATE INDEX idx_contacts_tenant_name
  ON contacts (tenant_id, name ASC, id ASC)
  WHERE state != 'deleted';

-- メールアドレス検索
CREATE INDEX idx_contacts_tenant_email
  ON contacts (tenant_id, email)
  WHERE state != 'deleted' AND email IS NOT NULL;
```

#### contact_channel_handles

```sql
-- チャネルハンドルからコンタクト解決（Webhook 受信時）
CREATE INDEX idx_channel_handles_tenant_channel_handle
  ON contact_channel_handles (tenant_id, channel, handle);
```

#### conversation_status_history（Bi-temporal）

```sql
-- 現在有効なステータスの取得
CREATE INDEX idx_status_history_current
  ON conversation_status_history (tenant_id, conversation_id, superseded_at, valid_to)
  WHERE superseded_at = '9999-12-31 23:59:59Z' AND valid_to = '9999-12-31 23:59:59Z';
```

#### compose_templates

```sql
-- ソート順での一覧取得
CREATE INDEX idx_templates_tenant_sort
  ON compose_templates (tenant_id, sort_order ASC, id ASC)
  WHERE state != 'deleted';
```

#### subscriptions

```sql
-- テナントのアクティブサブスクリプション取得
CREATE INDEX idx_subscriptions_tenant_status
  ON subscriptions (tenant_id, status)
  WHERE status IN ('active', 'trialing', 'past_due');
```

#### idempotency_keys

```sql
-- パージ用（processed_at ベースで古いレコードを削除）
CREATE INDEX idx_idempotency_keys_processed_at
  ON idempotency_keys (processed_at);
```

### 部分インデックス（Partial Index）の活用

ソフトデリートされたレコードを除外する部分インデックスを積極的に使用する。
`WHERE state != 'deleted'` を付与することで、インデックスサイズを抑え、クエリ性能を維持する。

### インデックス追加のルール

- 新しいクエリパターンを追加する際は、`EXPLAIN ANALYZE` で実行計画を確認する
- 不要なインデックスは削除する（書き込み性能への影響を考慮）
- カバリングインデックス（`INCLUDE`）はクエリ頻度が高い場合にのみ検討

---

## 18. リトライ・バックオフ（外部サービス呼び出し）

### 方針

外部サービス（Resend, LINE API, Instagram API, Stripe 等）の呼び出しは一時的な障害を想定し、リトライ + 指数バックオフを適用する。
Effect の `Schedule` / `retry` を使用して宣言的にリトライポリシーを定義する。

### リトライポリシー

```typescript
// packages/api/src/lib/retry.ts
import { Schedule, Effect, Duration } from "effect"

/**
 * 外部サービス呼び出し用の標準リトライスケジュール
 * - 最大 3 回リトライ（初回 + 3 回 = 合計 4 回）
 * - 指数バックオフ: 500ms → 1s → 2s
 * - ジッター付き（±20%）
 */
export const standardRetry = Schedule.intersect(
  Schedule.exponential(Duration.millis(500)),
  Schedule.recurs(3),
).pipe(Schedule.jittered)

/**
 * Webhook 送信用（非同期・許容度高め）
 * - 最大 5 回リトライ
 * - 指数バックオフ: 1s → 2s → 4s → 8s → 16s
 */
export const webhookRetry = Schedule.intersect(
  Schedule.exponential(Duration.seconds(1)),
  Schedule.recurs(5),
).pipe(Schedule.jittered)

/**
 * 注意: Cloudflare Workers の CPU 時間制限（有料プラン: 30 秒）を考慮し、
 * webhookRetry は Workers 内では使用しない。Queues 経由の非同期処理で使用する。
 * Workers 内の同期リトライには standardRetry（合計 ~3.5 秒）を使用すること。
 */
```

### 適用対象と方式

| 外部サービス | リトライ対象のエラー | ポリシー | 備考 |
| --- | --- | --- | --- |
| Resend（メール送信） | 5xx, タイムアウト, ネットワークエラー | `standardRetry` | 4xx（バリデーションエラー）はリトライしない |
| LINE Messaging API | 5xx, 429, タイムアウト | `standardRetry` | 429 は `Retry-After` ヘッダーを尊重 |
| Instagram Graph API | 5xx, タイムアウト | `standardRetry` | |
| Stripe API | Stripe SDK の自動リトライに委任 | Stripe SDK 内蔵 | `maxNetworkRetries: 3` |
| WorkOS API | 5xx, タイムアウト | `standardRetry` | |

### Effect での実装パターン

```typescript
// 外部サービス Layer での使用例
export const EmailServiceLive = Layer.succeed(EmailService, {
  send: (params) =>
    Effect.tryPromise({
      try: () => resend.emails.send(params),
      catch: (e) => new EmailSendError({ cause: e }),
    }).pipe(
      Effect.retry({
        schedule: standardRetry,
        while: (err) => err.isRetryable,  // 4xx はリトライしない
      }),
    ),
})
```

### リトライ不可のエラー

以下のエラーはリトライせず即座に失敗させる:

- `400 Bad Request` — リクエストの構造が不正
- `401 Unauthorized` — 認証情報が無効
- `403 Forbidden` — 権限不足
- `404 Not Found` — リソースが存在しない
- `422 Unprocessable Entity` — バリデーションエラー

### Cloudflare Queues のリトライ

一括メール送信など Queues 経由の非同期処理は、Queues のリトライ機能を使用する。

```text
Queue メッセージ受信
  ↓
処理実行
  ├─ 成功 → ack
  └─ 失敗
      ├─ リトライ可能 → nack（Queues が自動リトライ、最大 3 回）
      └─ リトライ不可 or 最大回数到達 → DLQ（Dead Letter Queue）へ
```

DLQ のメッセージは管理者が手動で確認・再処理する。
将来的に DLQ ダッシュボードを管理画面に追加することを想定する。

---

## 19. 開発環境（Dev Container）

### 方針

ローカル開発に必要な外部サービス（DB 等）を Dev Container で提供し、開発者が個別にサービスをセットアップする必要をなくす。
Cloudflare Workers のローカル開発は `wrangler dev` で行う。

### Dev Container 構成

```
.devcontainer/
├── devcontainer.json
├── docker-compose.yml
└── scripts/
    └── post-create.sh     # 初期セットアップスクリプト
```

### devcontainer.json

```jsonc
{
  "name": "cobox-dev",
  "dockerComposeFile": "docker-compose.yml",
  "service": "app",
  "workspaceFolder": "/workspace",
  "features": {
    "ghcr.io/devcontainers/features/node:1": { "version": "22" }
  },
  "postCreateCommand": ".devcontainer/scripts/post-create.sh",
  "forwardPorts": [
    5432,   // PostgreSQL
    8787,   // Wrangler dev (API)
    3000    // Next.js dev
  ],
  "customizations": {
    "vscode": {
      "extensions": [
        "biomejs.biome",
        "bradlc.vscode-tailwindcss"
      ]
    }
  }
}
```

### docker-compose.yml

```yaml
services:
  app:
    build:
      context: ..
      dockerfile: .devcontainer/Dockerfile
    volumes:
      - ..:/workspace:cached
    command: sleep infinity

  postgres:
    image: postgres:17
    environment:
      POSTGRES_USER: cobox
      POSTGRES_PASSWORD: cobox
      POSTGRES_DB: cobox_dev
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

### ローカル環境変数

```bash
# packages/api/.dev.vars（wrangler dev 用、Git 管理外）
DATABASE_URL=postgres://cobox:cobox@localhost:5432/cobox_dev
WORKOS_API_KEY=sk_test_...
WORKOS_CLIENT_ID=client_...
RESEND_API_KEY=re_test_...
LINE_CHANNEL_SECRET=...
LINE_CHANNEL_ACCESS_TOKEN=...
INSTAGRAM_APP_SECRET=...
FACEBOOK_APP_SECRET=...
WEBHOOK_VERIFY_TOKEN=local_verify_token
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_test_...
```

### ローカル DB クライアント

Hyperdrive はローカルで使用できないため、環境に応じて DB 接続方式を切り替える。

```typescript
// packages/api/src/db/client.ts
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as schema from "@/db/schema"

export type DrizzleClient = {
  readonly db: ReturnType<typeof drizzle>
}

export const DrizzleClient = Context.GenericTag<DrizzleClient>("DrizzleClient")

// 本番: Hyperdrive 経由
export const DrizzleClientLive = (hyperdrive: Hyperdrive) =>
  Layer.succeed(DrizzleClient, {
    db: drizzle(hyperdrive, { schema }),
  })

// ローカル開発: postgres.js 直接接続
export const DrizzleClientDev = (databaseUrl: string) =>
  Layer.succeed(DrizzleClient, {
    db: drizzle(postgres(databaseUrl), { schema }),
  })
```

### 外部サービスのローカル代替

| サービス | ローカル開発時 | 備考 |
| --- | --- | --- |
| Nile Database | ローカル PostgreSQL | RLS なし、`tenant_id WHERE` のみで分離 |
| Hyperdrive | 不使用（直接接続） | `DrizzleClientDev` を使用 |
| WorkOS | テスト用 API キー or fake Layer | WorkOS Sandbox 環境 |
| Resend | テスト用 API キー or fake Layer | Resend のテストモード |
| LINE Messaging API | fake Layer（ChannelGateway） | LINE Bot のテスト用チャネルは制限あり。ローカルでは fake で代替 |
| Instagram Graph API | fake Layer（ChannelGateway） | テスト用アカウントか fake Layer |
| Facebook Messenger | fake Layer（ChannelGateway） | テスト用ページか fake Layer |
| Stripe | テスト用 API キー + Stripe CLI | `stripe listen --forward-to localhost:8787/webhooks/stripe` |
| R2 | ローカルファイルシステム or Miniflare | `wrangler dev` が R2 をローカルエミュレート |
| Queues | Miniflare | `wrangler dev` がローカルエミュレート |

### 開発用コマンド

```jsonc
// package.json (root)
{
  "scripts": {
    "dev": "pnpm --parallel -r dev",
    "dev:api": "pnpm --filter @cobox/api dev",
    "dev:web": "pnpm --filter @cobox/web dev",
    "db:generate": "pnpm --filter @cobox/api drizzle-kit generate",
    "db:migrate": "pnpm --filter @cobox/api drizzle-kit migrate",
    "db:seed": "pnpm --filter @cobox/api tsx src/db/seed.ts",
    "db:studio": "pnpm --filter @cobox/api drizzle-kit studio",
    "check": "biome check --write",
    "typecheck": "tsc -b",
    "test": "pnpm --parallel -r test",
    "test:api": "pnpm --filter @cobox/api test"
  }
}
```

### Seed データ

開発用の初期データ投入スクリプトを用意する。

```typescript
// packages/api/src/db/seed.ts
// - テストテナント（workspace）作成
// - テストユーザー作成（admin, member）
// - サンプルコンタクト作成
// - サンプル会話・メッセージ作成
// - サンプルテンプレート作成
```

フロントエンドの現行 mock データ（`src/data/mock.ts`）と一致させ、移行をスムーズにする。

---

## 20. マルチチャネルメッセージング

### 20.1 対応チャネル

| チャネル | 送信 API | 受信方式 | 署名検証 | スレッディング |
| --- | --- | --- | --- | --- |
| Email | Resend API | Resend Webhook (Inbound) | svix 署名検証 | RFC 2822 ヘッダ（Message-ID / In-Reply-To / References） |
| LINE | LINE Messaging API (`/v2/bot/message/reply`, `/push`) | LINE Webhook | `X-Line-Signature`（HMAC-SHA256） | `replyToken` / ユーザー単位で会話を紐付け |
| Instagram | Instagram Graph API (`/me/messages`) | Instagram Webhook (Webhooks for Instagram) | `X-Hub-Signature-256`（HMAC-SHA256） | スレッド ID（`thread_id`）で紐付け |
| Facebook | Messenger Platform API (`/me/messages`) | Facebook Webhook (Webhooks for Messenger) | `X-Hub-Signature-256`（HMAC-SHA256） | 送信者 PSID 単位で会話を紐付け |

### 20.2 統一メッセージングアーキテクチャ（ChannelGateway）

チャネル固有のロジックを `ChannelGateway` インターフェースで抽象化し、MessageService がチャネルの違いを意識しない設計にする。

```typescript
// packages/api/src/services/channels/ChannelGateway.ts
export type SendMessageParams = {
  readonly accountId: AccountId
  readonly conversationId: ConversationId
  readonly content: string
  readonly attachments?: readonly AttachmentRef[]
}

export type InboundMessage = {
  readonly channel: ChannelType
  readonly externalId: string          // チャネル側のメッセージID
  readonly senderHandle: string        // メールアドレス、LINE userId、PSID 等
  readonly content: string
  readonly attachments?: readonly InboundAttachment[]
  readonly threadingKey: string        // スレッド解決用のキー（後述）
  readonly rawPayload: unknown         // デバッグ用の生ペイロード
  readonly receivedAt: Temporal.Instant
}

export type ChannelGateway = {
  readonly send: (params: SendMessageParams) => Effect.Effect<
    { externalMessageId: string },
    ChannelSendError,
    DrizzleClient | AccountRepo
  >
  readonly parseWebhook: (rawBody: string, headers: Record<string, string>) => Effect.Effect<
    readonly InboundMessage[],
    WebhookParseError | WebhookSignatureError
  >
}

export const ChannelGateway = Context.GenericTag<ChannelGateway>("ChannelGateway")
```

#### チャネル別実装

```text
packages/api/src/services/channels/
├── ChannelGateway.ts          # 型定義（上記）
├── EmailGateway.ts            # Resend 実装
├── LineGateway.ts             # LINE Messaging API 実装
├── InstagramGateway.ts        # Instagram Graph API 実装
├── FacebookGateway.ts         # Facebook Messenger API 実装
└── ChannelRouter.ts           # channel 種別に応じた Gateway 解決
```

```typescript
// packages/api/src/services/channels/ChannelRouter.ts
export type ChannelRouter = {
  readonly resolve: (channel: ChannelType) => ChannelGateway
}

export const ChannelRouter = Context.GenericTag<ChannelRouter>("ChannelRouter")

export const ChannelRouterLive = Layer.succeed(ChannelRouter, {
  resolve: (channel) => {
    switch (channel) {
      case "email": return EmailGatewayImpl
      case "line": return LineGatewayImpl
      case "instagram": return InstagramGatewayImpl
      case "facebook": return FacebookGatewayImpl
    }
  },
})
```

### 20.3 メッセージ送信フロー

```text
MessageService.send(conversationId, content)
  │
  ├─ ConversationRepo.findById(conversationId) → channel, accountId を取得
  ├─ ChannelRouter.resolve(channel) → ChannelGateway
  ├─ ChannelGateway.send({ accountId, conversationId, content })
  │    ├─ [Email]     → Resend API 呼び出し（In-Reply-To ヘッダ付与）
  │    ├─ [LINE]      → LINE reply/push API 呼び出し
  │    ├─ [Instagram]  → Instagram Graph API 呼び出し
  │    └─ [Facebook]   → Messenger Send API 呼び出し
  ├─ MessageRepo.insert({ ..., is_inbound: false, external_message_id })
  └─ ConversationRepo.updateLastMessageAt(conversationId)
```

> 全体がトランザクション内で実行される（外部 API 呼び出しはトランザクション外、DB 操作のみトランザクション内）。

### 20.4 Webhook 受信フロー（共通）

```text
POST /webhooks/:channel
  │
  ├─ 署名検証（チャネル別）
  ├─ IdempotencyService.checkOrProcess(webhookEventId)  ← 冪等性
  ├─ ChannelGateway.parseWebhook(rawBody, headers) → InboundMessage[]
  │
  │  各 InboundMessage に対して:
  ├─ ContactResolver.resolve(channel, senderHandle)
  │    ├─ contact_channel_handles から既存コンタクトを検索
  │    └─ 未登録の場合: 新規コンタクト + ハンドル自動作成
  ├─ ConversationResolver.resolve(channel, contact, threadingKey)
  │    ├─ [Email]     → email_thread_id + 7日ウィンドウでマッチング
  │    ├─ [LINE]      → account_id + contact_id で既存 open 会話を検索
  │    ├─ [Instagram]  → thread_id で既存会話を検索
  │    └─ [Facebook]   → account_id + contact_id で既存 open 会話を検索
  │    └─ マッチなし → 新規会話作成（番号採番含む）
  ├─ MessageRepo.insert({ ..., is_inbound: true })
  ├─ ConversationRepo.updateLastMessageAt + StatusMachine（→ open）
  └─ NotificationService.notify(assignees)
```

### 20.5 チャネル別の詳細

#### Email（Resend）

- **送信**: `resend.emails.send()` で HTML/テキストメール送信
- **受信**: Resend Inbound Webhook（`email.received` イベント）
- **スレッディング**: RFC 2822 準拠。`Message-ID`, `In-Reply-To`, `References` ヘッダでマッチング + 7日ウィンドウ
- **メッセージ固有カラム**: `messages.email_message_id`, `email_in_reply_to`, `email_references`
- **添付ファイル**: Resend が提供する Base64 データを R2 にアップロード

#### LINE Messaging API

- **送信**:
  - `replyToken` がある場合（受信直後の返信）: Reply API (`/v2/bot/message/reply`)
  - `replyToken` がない場合（能動的送信）: Push API (`/v2/bot/message/push`)
- **受信**: LINE Webhook（`message` イベント）
- **署名検証**: `X-Line-Signature` ヘッダを Channel Secret で HMAC-SHA256 検証
- **スレッディング**: LINE にはスレッド概念がないため、`account_id` + `contact_id` で一意の会話にマッピング。既存の open/pending 会話があればそこに追加、なければ新規作成
- **コンタクト解決**: LINE `userId` を `contact_channel_handles.handle` に格納
- **アカウント設定（`accounts.config` JSONB）**:
  ```json
  {
    "channelAccessToken": "encrypted:...",
    "channelSecret": "..."
  }
  ```
- **replyToken の有効期限**: 受信から一定時間で失効するため、Reply API は Webhook ハンドラ内で即時使用。非同期返信は Push API を使用
- **メッセージ種別**: テキスト、画像、スタンプ等。初期実装ではテキストのみ対応し、他はコンテンツ種別をメタデータとして保存

#### Instagram Graph API

- **送信**: `POST /{page-id}/messages` （Instagram Graph API v21.0+）
- **受信**: Instagram Webhooks（`messaging` フィールド）
- **署名検証**: `X-Hub-Signature-256` ヘッダを App Secret で HMAC-SHA256 検証
- **スレッディング**: Instagram は `thread_id` を提供。`conversations` テーブルに `instagram_thread_id` カラムで保持
- **コンタクト解決**: Instagram Scoped User ID (IGSID) を `contact_channel_handles.handle` に格納
- **Webhook 検証チャレンジ**: 初回登録時に `GET /webhooks/instagram?hub.mode=subscribe&hub.verify_token=...` に応答する必要がある
- **アカウント設定（`accounts.config` JSONB）**:
  ```json
  {
    "pageAccessToken": "encrypted:...",
    "appSecret": "...",
    "igUserId": "..."
  }
  ```

#### Facebook Messenger

- **送信**: `POST /me/messages`（Messenger Platform Send API）
- **受信**: Facebook Webhooks（`messaging` フィールド）
- **署名検証**: `X-Hub-Signature-256` ヘッダを App Secret で HMAC-SHA256 検証（Instagram と同一方式）
- **スレッディング**: Messenger にはスレッド概念がないため、LINE と同様に `account_id` + `contact_id` でマッピング
- **コンタクト解決**: Page-Scoped User ID (PSID) を `contact_channel_handles.handle` に格納
- **Webhook 検証チャレンジ**: Instagram と同様の `hub.verify_token` 方式
- **アカウント設定（`accounts.config` JSONB）**:
  ```json
  {
    "pageAccessToken": "encrypted:...",
    "appSecret": "...",
    "pageId": "..."
  }
  ```

### 20.6 DB スキーマ追加・変更

conversations テーブルに Instagram 用スレッド ID カラムを追加:

| テーブル | 追加カラム | 説明 |
| --- | --- | --- |
| conversations | `instagram_thread_id` | Instagram のスレッド ID（Instagram チャネルのみ使用） |
| conversations | `line_user_id` | ※不要。`contact_channel_handles` で解決するため |
| messages | `external_message_id` | チャネル側で採番されたメッセージ ID（冪等性・重複排除用） |
| messages | `channel_metadata` (JSONB) | チャネル固有のメタデータ（LINE スタンプ情報、Instagram メディア等） |

> `contact_channel_handles` テーブルが各チャネルのユーザー識別子（メールアドレス、LINE userId、IGSID、PSID）を統一的に管理する。

### 20.7 インデックス追加

```sql
-- Instagram スレッド解決
CREATE INDEX idx_conversations_tenant_instagram_thread
  ON conversations (tenant_id, instagram_thread_id)
  WHERE instagram_thread_id IS NOT NULL;

-- LINE/Facebook: account + contact で既存会話検索
CREATE INDEX idx_conversations_tenant_account_contact_status
  ON conversations (tenant_id, account_id, contact_id, status)
  WHERE status IN ('open', 'pending');

-- メッセージ重複排除（Webhook 冪等性の補助）
CREATE UNIQUE INDEX idx_messages_tenant_external_id
  ON messages (tenant_id, external_message_id)
  WHERE external_message_id IS NOT NULL;
```

### 20.8 エラー定義

```typescript
// packages/shared/src/errors/channel.ts
export class ChannelSendError extends Data.TaggedError("ChannelSendError")<{
  readonly channel: ChannelType
  readonly cause: unknown
  readonly isRetryable: boolean
}> {}

export class WebhookParseError extends Data.TaggedError("WebhookParseError")<{
  readonly channel: ChannelType
  readonly reason: string
}> {}

export class WebhookSignatureError extends Data.TaggedError("WebhookSignatureError")<{
  readonly channel: ChannelType
}> {}

export class ContactResolveError extends Data.TaggedError("ContactResolveError")<{
  readonly channel: ChannelType
  readonly handle: string
}> {}
```

### 20.9 Webhook ルートの実装パターン

```typescript
// packages/api/src/routes/webhooks/line.ts
app.post("/webhooks/line", async (c) => {
  const signature = c.req.header("x-line-signature")
  if (!signature) return c.json({ error: "Missing signature" }, 400)

  const body = await c.req.text()

  return runEffect(c, pipe(
    // LINE Gateway が署名検証 + パース
    LineGateway.parseWebhook(body, { "x-line-signature": signature }),
    Effect.flatMap((messages) =>
      Effect.forEach(messages, (msg) =>
        pipe(
          IdempotencyService.checkOrProcess(
            `line:${msg.externalId}`,
            "line_webhook",
            pipe(
              ContactResolver.resolve("line", msg.senderHandle),
              Effect.flatMap((contact) =>
                ConversationResolver.resolve("line", contact, msg.threadingKey),
              ),
              Effect.flatMap((conversation) =>
                MessageService.createInbound(conversation.id, msg),
              ),
            ),
          ),
        ),
        { concurrency: 1 },  // 順序保証
      ),
    ),
    Effect.map(() => c.json({ ok: true })),
  ))
})
```

> Instagram / Facebook も同一パターン。署名検証方式と Gateway 実装が異なるのみ。
> Facebook / Instagram は同一 App の Webhook で `hub.verify_token` チャレンジ応答が必要なため、GET ハンドラも実装する。

```typescript
// packages/api/src/routes/webhooks/instagram.ts（Facebook も同様）
app.get("/webhooks/instagram", (c) => {
  const mode = c.req.query("hub.mode")
  const token = c.req.query("hub.verify_token")
  const challenge = c.req.query("hub.challenge")

  if (mode === "subscribe" && token === c.env.WEBHOOK_VERIFY_TOKEN) {
    return c.text(challenge ?? "", 200)
  }
  return c.text("Forbidden", 403)
})
```

---

## 21. 実装フェーズ

> 別ファイルに切り出し済み: [implementation-phases.md](./implementation-phases.md)
