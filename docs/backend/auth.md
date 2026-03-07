# 認証・M2M 認証 詳細仕様

> このドキュメントは [backend-architecture.md](../../.claude/rules/backend-architecture.md) から切り出した詳細仕様。

---

## 1. Unified API (API-First) 設計方針

**単一の API を全ての呼び出し元（フロントエンド、OAuth、API Key）で共有する。**
AWS マネジメントコンソールが AWS API を使うのと同じアプローチ（Dogfooding）。

これにより:

- CASL の認可ロジックが一元化される
- 将来の Terraform プロバイダー / SDK がフロントエンドと同一 API を使える
- コード重複がなく、全エンドポイントが同一基準で保護される

---

## 2. 呼び出し元の識別（CallerType）

```typescript
type CallerType = "session" | "oauth" | "api_key"
```

| CallerType | 用途 | 認証情報 | テナント解決 |
| --- | --- | --- | --- |
| `session` | フロントエンド（Next.js） | HTTP-only Cookie（WorkOS JWT） | JWT の `org_id` |
| `oauth` | OAuth 委任（サードパーティアプリ） | `Authorization: Bearer` ヘッダー（WorkOS OAuth トークン） | トークンの `org_id` |
| `api_key` | M2M（Terraform、スクリプト等） | `Authorization: Bearer` ヘッダー（WorkOS M2M トークン） | トークンの `org_id` |

全ての CallerType で WorkOS が認証情報を管理する。判別の優先順位: `Authorization: Bearer`（トークンの `type` クレームで oauth/m2m を区別） → Cookie

---

## 3. ミドルウェアチェーン

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

---

## 4. セッション認証（フロントエンド）

1. フロントエンド → WorkOS AuthKit にリダイレクト
2. WorkOS → コールバック URL に認可コードを返す
3. `POST /auth/callback` で WorkOS API からトークン交換
4. JWT（access token）を HTTP-only Secure Cookie に設定
5. 以降のリクエストで Cookie から JWT を取り出し検証
6. JWT の `org_id` = テナントID、`sub` = ユーザーID

---

## 5. OAuth 認証（サードパーティアプリ）

**WorkOS Connect** の OAuth アプリケーション機能を利用する。
ユーザーが権限を委任したサードパーティアプリからの API アクセスを `Authorization: Bearer <token>` で許可する。

- WorkOS が OAuth 2.0 Authorization Code フローを提供
- アクセストークンは WorkOS が発行・管理（JWT 形式）
- トークンの検証は WorkOS SDK で実施
- Organization スコープのトークンにより `org_id` からテナントを解決

---

## 6. WorkOS Organization マッピング

- 1 Cobox ワークスペース = 1 WorkOS Organization
- ワークスペース作成時に WorkOS Organization と Nile テナントを同一 ID で作成
- チーム招待は WorkOS Organization Membership API 経由

---

## 7. RequestContext の拡張

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

> 実装パターン: [coding-conventions.md - 2.3 RequestContext](../../.claude/rules/coding-conventions.md)

---

## 8. レート制限

Cloudflare Rate Limiting を使用し、CallerType に応じた制限を適用する。

| CallerType | 制限 | キー | 備考 |
| --- | --- | --- | --- |
| `session` | 1000 req/min | userId | フロントエンド。緩め |
| `oauth` | 300 req/min | userId | OAuth 委任。中程度 |
| `api_key` | プランに応じて可変 | m2mClientId | Free: 60/min, Pro: 300/min, Enterprise: カスタム |

レスポンスヘッダー: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

---

## 9. M2M 認証（WorkOS Connect）

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
