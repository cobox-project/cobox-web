# インフラ・DB 接続・開発環境

> このドキュメントは [backend-architecture.md](../../.claude/rules/backend-architecture.md) から切り出した詳細仕様。

---

## 1. DB 接続: Hyperdrive

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
    db: drizzle(postgres(hyperdrive.connectionString), { schema }),
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

## 2. インフラ管理

### 方針

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

## 3. リトライ・バックオフ（外部サービス呼び出し）

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

## 4. ページネーション

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
| `GET /conversations` | `last_message_id DESC`（LATERAL JOIN で導出） | `(last_message_id, id)` |
| `GET /contacts` | `name ASC` | `(name, id)` |
| `GET /contacts/:id/conversations` | `last_message_id DESC`（LATERAL JOIN で導出） | `(last_message_id, id)` |
| `GET /templates` | `sort_order ASC` | `(sort_order, id)` |
| `GET /team/members` | `name ASC` | `(name, id)` |
| `GET /contact-groups` | `name ASC` | `(name, id)` |
| `GET /bulk-email/drafts` | `updated_at DESC` | `(updated_at, id)` |

### カーソルのエンコード/デコード

```typescript
// packages/api/src/lib/cursor.ts

// カーソルは Base64 エンコードされた JSON
// { s: sortValue, id: recordId }
const CursorSchema = z.object({ s: z.string(), id: z.string() })

export const encodeCursor = (sortValue: string, id: string): string =>
  btoa(JSON.stringify({ s: sortValue, id }))

export const decodeCursor = (cursor: string): { s: string; id: string } | null => {
  try {
    return CursorSchema.parse(JSON.parse(atob(cursor)))
  } catch {
    return null  // 不正カーソルは無視（先頭ページから取得）
  }
}
```

### SQL パターン

```sql
-- 注: 実装では SELECT * ではなく明示的にカラムを指定する（マイグレーション安全性のため）
-- ここでは簡略化のため SELECT * で記載

-- カーソルなし（初回リクエスト）
-- last_message_id は messages テーブルから LATERAL JOIN で導出
SELECT c.*, lm.last_message_id
FROM conversations c
LEFT JOIN LATERAL (
  SELECT id AS last_message_id FROM messages
  WHERE tenant_id = c.tenant_id AND conversation_id = c.id
  ORDER BY id DESC LIMIT 1
) lm ON true
WHERE c.tenant_id = $1 AND c.state != 'deleted'
ORDER BY lm.last_message_id DESC NULLS LAST, c.id DESC
LIMIT $2 + 1  -- +1 で hasMore を判定

-- カーソルあり（2 ページ目以降）
SELECT c.*, lm.last_message_id
FROM conversations c
LEFT JOIN LATERAL (
  SELECT id AS last_message_id FROM messages
  WHERE tenant_id = c.tenant_id AND conversation_id = c.id
  ORDER BY id DESC LIMIT 1
) lm ON true
WHERE c.tenant_id = $1 AND c.state != 'deleted'
  AND (lm.last_message_id, c.id) < ($3, $4)  -- Row Value 比較
ORDER BY lm.last_message_id DESC NULLS LAST, c.id DESC
LIMIT $2 + 1
```

- `LIMIT + 1` で取得し、余分な 1 件があれば `hasMore: true`
- Row Value 比較（`(col1, col2) < (val1, val2)`）で正確なページ境界を実現
- LATERAL JOIN は `messages(tenant_id, conversation_id, id DESC)` インデックスにより各会話 1 件のインデックスルックアップで効率的に動作

---

## 5. 開発環境（Dev Container）

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
