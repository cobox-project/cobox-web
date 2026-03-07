# Cobox バックエンド コーディング規約

本ドキュメントは、コードを書く際に従うべきルールとパターンを定義する。
アーキテクチャ上の意思決定（「なぜ」）は [backend-architecture.md](./backend-architecture.md) を参照。

---

## 1. TypeScript 一般

### 1.1 `type` に統一

オブジェクト型の定義には `interface` ではなく `type` を使用する。
declaration merging が必要なケース（外部ライブラリの型拡張等）を除き、全て `type` で統一する。

```typescript
// Good
export type ConversationService = {
  readonly findAll: (filters: Filters) => Effect.Effect<Conversation[], never>
}

// Bad
export interface ConversationService {
  readonly findAll: (filters: Filters) => Effect.Effect<Conversation[], never>
}
```

### 1.2 パスエイリアス

各パッケージ内の import は相対パスではなく `@/` プレフィックスで root から参照する。

```jsonc
// 各パッケージの tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### 1.3 import 規約

```typescript
// パッケージ内の参照は @/ プレフィックス
import { ConversationService } from "@/services/ConversationService"
import { ConversationRepo } from "@/repositories/ConversationRepo"
import { createDb } from "@/db/client"
import { authMiddleware } from "@/middleware/auth"
import { requireAction } from "@/middleware/authorize"
import { RequestContext } from "@/effect/request-context"
import { ActionContext } from "@/effect/action-context"

// 別パッケージの参照はパッケージ名で
import type { Action } from "@cobox/shared/types/actions"
import type { Subject } from "@cobox/shared/types/subjects"
import type { Conversation } from "@cobox/shared/types/conversation"
```

### 1.4 日時は `Temporal` を使用

日時の操作には `Date` ではなく **`Temporal` API** を使用する。

- タイムスタンプには `Temporal.Instant`（UTC の絶対時刻）
- 日付のみの比較には `Temporal.PlainDate`
- `new Date()` は使用禁止。`Temporal.Now.instant()` を使う

```typescript
// Good
const now = Temporal.Now.instant()
const requestedAt: Temporal.Instant = Temporal.Now.instant()

// Bad
const now = new Date()
const requestedAt: Date = new Date()
```

> **polyfill**: Temporal API がランタイムで未サポートの場合、`temporal-polyfill` を使用する。

### 1.5 Branded Types（プリミティブの型付け）

外部から受け取るデータ（ID、メールアドレス等）はプリミティブ型（`string`, `number`）をそのまま使わず、Effect の `Brand` で意味のある型を定義する。異なるドメインの ID を取り違えるバグをコンパイル時に防ぐ。

```typescript
// packages/shared/src/types/branded.ts
import { Brand } from "effect"

export type TenantId = string & Brand.Brand<"TenantId">
export const TenantId = Brand.nominal<TenantId>()

export type UserId = string & Brand.Brand<"UserId">
export const UserId = Brand.nominal<UserId>()

export type ConversationId = string & Brand.Brand<"ConversationId">
export const ConversationId = Brand.nominal<ConversationId>()

export type ContactId = string & Brand.Brand<"ContactId">
export const ContactId = Brand.nominal<ContactId>()

export type AccountId = string & Brand.Brand<"AccountId">
export const AccountId = Brand.nominal<AccountId>()

export type MessageId = string & Brand.Brand<"MessageId">
export const MessageId = Brand.nominal<MessageId>()

export type TemplateId = string & Brand.Brand<"TemplateId">
export const TemplateId = Brand.nominal<TemplateId>()

export type EmailAddress = string & Brand.Brand<"EmailAddress">
export const EmailAddress = Brand.refined<EmailAddress>(
  (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s),
  (s) => Brand.error(`Invalid email: ${s}`),
)
```

使用例:

```typescript
// Good: 型が異なるので取り違えがコンパイルエラーになる
const findById = (tenantId: TenantId, id: ConversationId) => ...

// Bad: string 同士で取り違えてもコンパイルが通る
const findById = (tenantId: string, id: string) => ...
```

外部からの入力（リクエストパラメータ、DB の結果等）を Branded Type に変換する箇所で、バリデーションを行う。

```typescript
// Zod スキーマで Branded Type に変換
const ConversationIdSchema = z.string().uuid().transform((s) => ConversationId(s))
```

### 1.6 `Option` / `Either` の使用

`null` / `undefined` の代わりに Effect の `Option` を使用する。
エラーを返す可能性がある処理には `Either` または Effect の型付きエラーを使用する。

```typescript
import { Option, Either } from "effect"

// Good: Option で「値がない」ことを明示
export type ConversationService = {
  readonly findByEmail: (email: EmailAddress) => Effect.Effect<Option.Option<Conversation>, never>
}

// Bad: null で「値がない」ことを暗黙的に表現
export type ConversationService = {
  readonly findByEmail: (email: string) => Effect.Effect<Conversation | null, never>
}
```

#### 使い分けガイドライン

| ケース | 使用する型 | 例 |
| --- | --- | --- |
| 値が存在しない可能性 | `Option<T>` | `findByEmail` → `Option<Contact>` |
| 必ず見つかるべき（見つからなければエラー） | `Effect<T, NotFoundError>` | `findById` → `Effect<Conversation, ConversationNotFound>` |
| 成功 or 失敗の結果を返す（Effect 外） | `Either<E, A>` | 純粋関数のバリデーション結果 |
| Effect 内のエラー | 型付きエラー（`Data.TaggedError`） | Service / Repository のエラー |

```typescript
// Option の使用例
import { Option, pipe } from "effect"

// Repository: 見つからなければ None
const findByHandle = (tenantId: TenantId, handle: string): Effect.Effect<Option.Option<Contact>> =>
  Effect.gen(function* () {
    const rows = yield* Effect.promise(() =>
      db.select().from(contacts)
        .where(and(eq(contacts.tenantId, tenantId), eq(contacts.handle, handle)))
        .limit(1)
    )
    return Option.fromNullable(rows[0])
  })

// Either の使用例（純粋関数）
import { Either } from "effect"

const parseMessageNumber = (input: string): Either.Either<string, MessageNumber> =>
  /^#\d{5}$/.test(input)
    ? Either.right(MessageNumber(input))
    : Either.left(`Invalid message number: ${input}`)
```

#### `null` / `undefined` を使ってよいケース

- 外部ライブラリの API に渡す/受け取る境界（即座に `Option.fromNullable` で変換する）
- DB のカラム値（Drizzle の結果を受け取った直後に `Option` に変換する）

```typescript
// DB 境界: null → Option に即変換
const row = yield* Effect.promise(() => db.select().from(contacts).where(...).limit(1))
const contact = Option.fromNullable(row[0])
```

### 1.7 Lint / Format（Biome）

Biome で lint と format を一元管理する。ESLint / Prettier は使用しない。

```jsonc
// biome.json（モノレポルート）
{
  "$schema": "https://biomejs.dev/schemas/2.0.0/schema.json",
  "organizeImports": { "enabled": true },
  "formatter": {
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true
    }
  }
}
```

- `biome check --write` で lint + format を一括実行
- CI で `biome check` を実行し、未フォーマットのコードをブロック
- エディタ連携: VS Code の Biome 拡張でオンセーブフォーマット

---

## 2. Effect 実装パターン

### 2.1 Service 定義

`Context.Tag` で型定義と tag を同名で定義する。実装は `*Live` Layer として分離する。

```typescript
// packages/api/src/services/ConversationService.ts
import { Context, Effect, Layer } from "effect"

// 型定義: 実装の詳細を知らない
export type ConversationService = {
  readonly findAll: (filters: Filters, pagination: PaginationParams) => Effect.Effect<PaginatedResponse<Conversation>, never>
  readonly findById: (id: ConversationId) => Effect.Effect<Conversation, ConversationNotFound>
  readonly updateStatus: (id: ConversationId, action: StatusAction) =>
    Effect.Effect<Conversation, ConversationNotFound | InvalidStatusTransition>
  readonly assign: (id: ConversationId, memberId: UserId) =>
    Effect.Effect<Conversation, ConversationNotFound>
}

export const ConversationService =
  Context.GenericTag<ConversationService>("ConversationService")

// 実装: Repository（型定義）に依存。実装には直接依存しない。
export const ConversationServiceLive = Layer.effect(
  ConversationService,
  Effect.gen(function* () {
    const repo = yield* ConversationRepo      // 型定義への依存
    const ctx = yield* RequestContext          // 型定義への依存
    return ConversationService.of({
      findAll: (filters, pagination) => repo.findAll(ctx.tenantId, filters, pagination),
      findById: (id) => repo.findById(ctx.tenantId, id),
      // ...
    })
  })
)
```

### 2.2 Repository 定義

Drizzle を使用した Repository 実装。全クエリに `tenant_id` を必ず含める。

```typescript
// packages/api/src/repositories/ConversationRepo.ts
export const ConversationRepoLive = Layer.effect(
  ConversationRepo,
  Effect.gen(function* () {
    const { db } = yield* DrizzleClient
    return {
      findAll: (tenantId: TenantId, filters) =>
        Effect.promise(() =>
          db.select().from(conversations)
            .where(and(
              eq(conversations.tenantId, tenantId),  // 必ず tenant_id でフィルタ
              ...buildFilterConditions(filters)
            ))
            .orderBy(desc(conversations.lastMessageAt))
        ),
      findById: (tenantId: TenantId, id: ConversationId) =>
        Effect.gen(function* () {
          const rows = yield* Effect.promise(() =>
            db.select().from(conversations)
              .where(and(
                eq(conversations.tenantId, tenantId),
                eq(conversations.id, id)
              ))
              .limit(1)
          )
          if (rows.length === 0) {
            return yield* new ConversationNotFound({ conversationId: id })
          }
          return rows[0]
        }),
    }
  })
)
```

### 2.3 RequestContext

リクエスト毎に生成されるコンテキスト。テナント情報とリクエスト受付時刻を保持する。

```typescript
// packages/api/src/effect/request-context.ts
import { Context, Layer } from "effect"

export type CallerType = "session" | "oauth" | "api_key"

export type RequestContext = {
  readonly tenantId: TenantId
  readonly userId: UserId
  readonly userRole: "admin" | "member" | "api_key"
  readonly callerType: CallerType
  readonly requestedAt: Temporal.Instant  // リクエスト受付時刻（タイムスタンプに使用）
  // M2M の場合のみ（WorkOS M2M アプリケーション ID）
  readonly m2mClientId?: string
}

export const RequestContext =
  Context.GenericTag<RequestContext>("RequestContext")

export const makeRequestLayer = (params: RequestContext) =>
  Layer.succeed(RequestContext, params)
```

### 2.4 CallerIdentification ミドルウェア

リクエストの認証情報から CallerType を判別するミドルウェア。認証ミドルウェアの前に実行する。

```typescript
// packages/api/src/middleware/caller-identification.ts
import { createMiddleware } from "hono/factory"
import { getCookie } from "hono/cookie"

// Bearer トークンの type クレームで oauth / m2m を判別
export const callerIdentification = createMiddleware(async (c, next) => {
  const authHeader = c.req.header("Authorization")
  const sessionCookie = getCookie(c, "access_token")

  if (authHeader?.startsWith("Bearer ")) {
    // WorkOS トークンの type クレームで oauth / m2m を判別（認証MW で解決）
    c.set("caller", { type: "bearer" as const, credential: authHeader.slice(7) })
  } else if (sessionCookie) {
    c.set("caller", { type: "session" as const, credential: sessionCookie })
  } else {
    return c.json({ error: "No credentials provided" }, 401)
  }

  await next()
})
```

### 2.5 Hono + Effect 統合

```typescript
// packages/api/src/effect/runtime.ts
export const runEffect = <A, E>(
  c: HonoContext,
  effect: Effect.Effect<A, E, /* requirements */>,
) => {
  const requestCtx = c.get("requestContext") as RequestContext  // 認証ミドルウェアで生成済み
  const requestLayer = makeRequestLayer(requestCtx)
  const fullLayer = AppLayer.pipe(Layer.provideMerge(requestLayer))
  return Effect.runPromise(effect.pipe(Effect.provide(fullLayer)))
}
```

ルートハンドラでの使用:

```typescript
app.get("/conversations", async (c) => {
  const filters = parseFilters(c.req.query())
  const result = await runEffect(c, Effect.gen(function* () {
    const svc = yield* ConversationService
    return yield* svc.findAll(filters)
  }))
  return c.json(result)
})
```

### 2.6 型付きエラー

```typescript
// packages/shared/src/errors/conversation.ts
import { Data } from "effect"

export class ConversationNotFound extends Data.TaggedError("ConversationNotFound")<{
  readonly conversationId: ConversationId
}> {}

export class InvalidStatusTransition extends Data.TaggedError("InvalidStatusTransition")<{
  readonly from: string
  readonly action: string
}> {}
```

エラーハンドラミドルウェアで HTTP レスポンスにマッピング:

```typescript
// packages/api/src/middleware/error-handler.ts
const errorToStatus = {
  ConversationNotFound: 404,
  InvalidStatusTransition: 422,
  Unauthorized: 401,
  PermissionDenied: 403,
} as const
```

### 2.7 ドメインロジックは純粋関数

ビジネスルール（ステータス遷移、バリデーション等）は Effect に依存しない純粋関数として切り出す。

```typescript
// ステータス遷移ロジック
// 詳細実装: backend-architecture.md セクション 6.5 参照
export const transition = (
  current: ConversationStatus,
  event: StatusEvent,
): ConversationStatus | null => { /* ... */ }
// null = 変化なし
```

### 2.8 外部サービスのラップ

外部サービス（Resend, WorkOS 等）は `Context.Tag` でラップし、テスト時に fake に差し替え可能にする。

```typescript
// 外部サービスの型定義
export type EmailService = {
  readonly send: (params: SendEmailParams) => Effect.Effect<void, EmailSendError>
}
export const EmailService = Context.GenericTag<EmailService>("EmailService")

// 本番実装（リトライ付き）
export const EmailServiceLive = Layer.succeed(EmailService, {
  send: (params) =>
    Effect.tryPromise({
      try: () => resend.emails.send(params),
      catch: (e) => new ExternalServiceError({
        service: "resend",
        status: (e as any)?.statusCode,
        cause: e,
      }),
    }).pipe(
      Effect.retry({
        schedule: standardRetry,
        while: (err) => err.isRetryable,
      }),
    ),
})

// テスト用 fake（送信をキャプチャして検証可能にする）
export const makeEmailServiceFake = () => {
  const sent: SendEmailParams[] = []
  const layer = Layer.succeed(EmailService, {
    send: (params) => Effect.sync(() => { sent.push(params) }),
  })
  return { sent, layer }
}
```

### 2.9 Stripe 連携パターン

Stripe SDK は `Context.Tag` でラップし、テスト時に fake に差し替え可能にする。

```typescript
// packages/api/src/services/BillingService.ts
import Stripe from "stripe"

export type StripeClient = {
  readonly createCheckoutSession: (params: {
    tenantId: TenantId
    priceId: string
    successUrl: string
    cancelUrl: string
  }) => Effect.Effect<{ url: string }, BillingError>
  readonly createPortalSession: (params: {
    customerId: string
    returnUrl: string
  }) => Effect.Effect<{ url: string }, BillingError>
}

export const StripeClient = Context.GenericTag<StripeClient>("StripeClient")
```

#### Stripe Webhook の署名検証

Webhook エンドポイントは認証ミドルウェアの対象外とし、Stripe の署名検証で真正性を確認する。

> **注**: 以下は署名検証のパターン例。本番実装では IdempotencyService と組み合わせる（[6.2 Webhook ハンドラでの使用](#62-webhook-ハンドラでの使用) を参照）。

```typescript
// packages/api/src/routes/webhooks/stripe.ts
app.post("/webhooks/stripe", async (c) => {
  const signature = c.req.header("stripe-signature")
  if (!signature) return c.json({ error: "Missing signature" }, 400)

  const body = await c.req.text()
  const stripe = new Stripe(c.env.STRIPE_SECRET_KEY)

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, c.env.STRIPE_WEBHOOK_SECRET)
  } catch {
    return c.json({ error: "Invalid signature" }, 400)
  }

  await runEffect(c, Effect.gen(function* () {
    const billing = yield* BillingService
    yield* billing.handleWebhookEvent(event)
  }))

  return c.json({ received: true })
})
```

#### PlanContext（機能制限の判定）

```typescript
// packages/api/src/effect/plan-context.ts
export type PlanContext = {
  readonly plan: Plan
  readonly limits: PlanLimits
  readonly checkLimit: (
    resource: LimitableResource,
    current: number,
  ) => Effect.Effect<void, PlanLimitExceeded>
}

export const PlanContext = Context.GenericTag<PlanContext>("PlanContext")

// Service 層での使用例
const create = (data: NewContact) =>
  Effect.gen(function* () {
    const planCtx = yield* PlanContext
    const currentCount = yield* repo.count(ctx.tenantId)
    yield* planCtx.checkLimit("contacts", currentCount)  // 制限超過で PlanLimitExceeded
    return yield* repo.create(ctx.tenantId, data, ctx.requestedAt)
  })
```

### 2.10 Hono Zod OpenAPI ルート定義

`@hono/zod-openapi` を使用し、Zod スキーマでバリデーション + OpenAPI スキーマ自動生成を行う。

```typescript
// packages/api/src/routes/contacts.ts
import { createRoute, z } from "@hono/zod-openapi"

const ContactSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
}).openapi("Contact")

const CreateContactSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
}).openapi("CreateContact")

const createContactRoute = createRoute({
  method: "post",
  path: "/contacts",
  tags: ["Contacts"],
  summary: "コンタクトを作成",
  request: {
    body: {
      content: { "application/json": { schema: CreateContactSchema } },
    },
  },
  responses: {
    201: {
      content: { "application/json": { schema: ContactSchema } },
      description: "作成されたコンタクト",
    },
    422: {
      description: "バリデーションエラー",
    },
  },
})

// ルートハンドラ（バリデーション済みのデータを受け取る）
app.openapi(createContactRoute, async (c) => {
  const body = c.req.valid("json")  // 型安全（CreateContactSchema の型）
  const result = await runEffect(c, Effect.gen(function* () {
    const svc = yield* ContactService
    return yield* svc.create(body)
  }))
  return c.json(result, 201)
})
```

### 2.11 Scalar API ドキュメント

```typescript
// packages/api/src/app.ts
import { apiReference } from "@scalar/hono-api-reference"

// OpenAPI スキーマエンドポイント
app.doc("/openapi.json", {
  openapi: "3.1.0",
  info: { title: "Cobox API", version: "1.0.0" },
})

// Scalar UI（開発・ステージング環境のみ）
if (env !== "production") {
  app.get("/docs", apiReference({ spec: { url: "/openapi.json" } }))
}
```

### 2.12 Zod スキーマの配置

```text
packages/api/src/
  schemas/              # Zod スキーマ定義
    contact.ts          # ContactSchema, CreateContactSchema, UpdateContactSchema
    conversation.ts
    message.ts
    template.ts
    common.ts           # PaginationSchema, IdParamSchema 等
```

- Zod スキーマは `packages/api/src/schemas/` に配置
- `.openapi()` メソッドで OpenAPI メタデータを付与
- リクエスト/レスポンスの両方で使用し、型の一貫性を保つ

---

## 3. データ操作

### 3.1 タイムスタンプ

**全てのタイムスタンプは `RequestContext.requestedAt` を使用する。DB の `now()` は使わない。**

DDL にも `DEFAULT now()` を定義しない。全カラムを `NOT NULL` とし、アプリケーションから明示的に値を渡すことを強制する。
これにより、タイムスタンプの渡し忘れがコンパイル時に検出される。

```typescript
// Repository での使用例
const create = (data: NewContact, requestedAt: Temporal.Instant) =>
  db.insert(contacts).values({
    ...data,
    recorded_at: requestedAt.toString(),  // ISO 8601 文字列で DB に渡す
    superseded_at: requestedAt.toString(),
  })
```

### 3.2 Temporal センチネル値

`superseded_at` には NULL ではなく `TEMPORAL_INFINITY` を使用する。
B-tree インデックスが NULL を含む行で効率が落ちることを防ぐ。
現行行（最新バージョン）は `superseded_at = TEMPORAL_INFINITY` で識別する。

```typescript
// packages/shared/src/types/temporal.ts

/** Uni-temporal カラムのセンチネル値（「現行バージョン」を表す） */
export const TEMPORAL_INFINITY = Temporal.Instant.from("9999-12-31T23:59:59Z")

/** 現行バージョンかどうかを判定 */
export const isCurrent = (instant: Temporal.Instant): boolean =>
  Temporal.Instant.compare(instant, TEMPORAL_INFINITY) === 0
```

### 3.3 ソフトデリート

- `findAll` / `findById`: デフォルトで `state = 'deleted'` のレコードを除外する
- 削除済みデータは API からはアクセス不可。必要な場合は DB 直接参照で対応
- 「削除」API は `UPDATE SET state = 'deleted', superseded_at = requestedAt` を実行（`requestedAt` は `RequestContext` から取得）

---

## 4. 認可の実装パターン

### 4.1 ルートへの requireAction 適用

認証済みの全 API ルートに `requireAction` ミドルウェアを適用する。

```typescript
// packages/api/src/middleware/authorize.ts
import { createMiddleware } from "hono/factory"
import { ForbiddenError } from "@casl/ability"
import type { Action } from "@cobox/shared/types/actions"
import type { Subject } from "@cobox/shared/types/subjects"
import { buildAbility } from "@/auth/ability"

export const requireAction = (
  action: Action,
  subjectType: Subject,
  resolveAttrs?: (c: HonoContext) => Record<string, unknown>,
) => createMiddleware(async (c, next) => {
  const auth = c.get("auth")
  const ability = buildAbility(auth)

  const attrs = resolveAttrs?.(c) ?? {}
  const sub = Object.keys(attrs).length > 0
    ? subject(subjectType, attrs)
    : subjectType

  if (!ability.can(action, sub)) {
    return c.json({
      error: "Forbidden",
      action,
      subject: subjectType,
    }, 403)
  }

  c.set("ability", ability)
  await next()
})
```

ルートハンドラでの使用:

```typescript
// packages/api/src/routes/conversations.ts
import { requireAction } from "@/middleware/authorize"

const app = new Hono()

// 一覧取得: subject タイプレベルのチェック
app.get(
  "/conversations",
  requireAction("conversation:list", "Conversation"),
  async (c) => { /* handler */ }
)

// 詳細取得: インスタンスレベルのチェック（id 属性付き）
app.get(
  "/conversations/:id",
  requireAction("conversation:read", "Conversation", (c) => ({
    id: c.req.param("id"),
  })),
  async (c) => { /* handler */ }
)

// メッセージ送信: 親リソース（会話）の subject で権限チェック
app.post(
  "/conversations/:id/messages",
  requireAction("message:send", "Message", (c) => ({
    conversationId: c.req.param("id"),
  })),
  async (c) => { /* handler */ }
)
```

### 4.2 ActionContext（Effect 統合）

CASL の `Ability` を Effect の Service として提供し、Service 層で利用する。

```typescript
// packages/api/src/effect/action-context.ts
import { Context, Effect, Layer } from "effect"
import type { AppAbility } from "@/auth/ability"
import type { Action } from "@cobox/shared/types/actions"
import type { Subject } from "@cobox/shared/types/subjects"

export type ActionContext = {
  readonly ability: AppAbility
  readonly authorize: (
    action: Action,
    sub: Subject | { kind: Subject; [key: string]: unknown },
  ) => Effect.Effect<void, PermissionDenied>
}

export const ActionContext = Context.GenericTag<ActionContext>("ActionContext")

export const makeActionLayer = (ability: AppAbility) =>
  Layer.succeed(ActionContext, {
    ability,
    authorize: (action, sub) =>
      ability.can(action, sub as any)
        ? Effect.void
        : Effect.fail(new PermissionDenied({ action, subject: String(sub) })),
  })
```

### 4.3 Service 層の defense in depth

Service メソッド内で `actions.authorize()` を呼び出し、ミドルウェアとの二重チェックを行う。
DB から取得した実エンティティの属性（チャネル種別、アサイン状態等）で、より精密なインスタンスレベルのチェックが可能。

```typescript
// packages/api/src/services/ConversationService.ts
import { subject } from "@casl/ability"

export const ConversationServiceLive = Layer.effect(
  ConversationService,
  Effect.gen(function* () {
    const repo = yield* ConversationRepo
    const ctx = yield* RequestContext
    const actions = yield* ActionContext

    return ConversationService.of({
      findAll: (filters) =>
        Effect.gen(function* () {
          yield* actions.authorize("conversation:list", "Conversation")
          return yield* repo.findAll(ctx.tenantId, filters)
        }),

      findById: (id) =>
        Effect.gen(function* () {
          const conv = yield* repo.findById(ctx.tenantId, id)
          yield* actions.authorize(
            "conversation:read",
            subject("Conversation", conv),  // channel, assignees 等の属性付き
          )
          return conv
        }),

      updateStatus: (id, statusAction) =>
        Effect.gen(function* () {
          const conv = yield* repo.findById(ctx.tenantId, id)
          yield* actions.authorize(
            "conversation:updateStatus",
            subject("Conversation", conv),
          )
          // ...
        }),
    })
  })
)
```

### 4.4 新機能追加時の必須手順

新しいリソースや操作を追加する際、以下を **必ず** 実施する。

1. **Action 定義の追加** — `packages/shared/src/types/actions.ts` の `Actions` オブジェクトに新しい action を追加
2. **Subject 定義の追加** — `packages/shared/src/types/subjects.ts` に新しい Subject 型を追加
3. **ルートに requireAction ミドルウェアを適用** — 新しいルートハンドラに `requireAction` を必ず付与
4. **Service 層に defense in depth を実装** — Service メソッド内で `actions.authorize()` を呼び出す
5. **ルート - Action マッピング一覧テーブルを更新** — `backend-architecture.md` のマッピング表に新しいエンドポイントを追記
6. **CASL Ability ルールの確認** — `buildAbility` で新しい Action / Subject が正しく許可/拒否されることを確認

```typescript
// 例: Notification 機能を追加する場合

// 1. Action 定義
export const Actions = {
  // ... 既存 ...
  "notification:list":           "通知一覧の取得",
  "notification:read":           "通知の既読マーク",
  "notification:updateSettings": "通知設定の変更",
} as const

// 2. Subject 定義
export type Subject =
  | "Conversation"
  // ... 既存 ...
  | "Notification"   // 新規追加
  | "all"

// 3. ルートに requireAction
app.get(
  "/notifications",
  requireAction("notification:list", "Notification"),
  async (c) => { /* handler */ }
)
```

---

## 5. テストの書き方

### 5.1 ドメインロジック（純粋関数テスト）

Effect に依存しない純粋関数は、通常のユニットテストで直接テストする。

```typescript
// packages/api/src/domain/conversation.test.ts
import { canTransition } from "@/domain/conversation"

describe("canTransition", () => {
  it("new -> complete で completed に遷移する", () => {
    expect(canTransition("new", "complete")).toBe("completed")
  })

  it("completed -> complete は無効な遷移", () => {
    expect(canTransition("completed", "complete")).toBeNull()
  })
})
```

### 5.2 Service テスト（Effect Layer 差し替え）

Repository や外部サービスを fake Layer に差し替えてテストする。

```typescript
const FakeConversationRepo = Layer.succeed(ConversationRepo, {
  findAll: () => Effect.succeed([mockConversation]),
  findById: (_, id) =>
    id === "exists"
      ? Effect.succeed(mockConversation)
      : Effect.fail(new ConversationNotFound({ conversationId: id })),
  // ...
})

const TestLayer = ConversationServiceLive.pipe(
  Layer.provide(FakeConversationRepo),
  Layer.provide(Layer.succeed(RequestContext, {
    tenantId: TenantId("test-tenant"),
    userId: UserId("test-user"),
    userRole: "admin",
    requestedAt: Temporal.Instant.from("2026-01-01T00:00:00Z"),
  })),
  Layer.provide(Layer.succeed(ActionContext, {
    ability: buildAbility({ userId: "test-user", userRole: "admin" }),
    authorize: () => Effect.void,
  })),
)

it("assigns and transitions to in_progress", async () => {
  const result = await Effect.runPromise(
    Effect.gen(function* () {
      const svc = yield* ConversationService
      return yield* svc.assign(ConversationId("exists"), UserId("user-1"))
    }).pipe(Effect.provide(TestLayer))
  )
  expect(result.status).toBe("in_progress")
})
```

---

## 6. 冪等性の実装パターン

### 6.1 IdempotencyService

Webhook 受信およびクライアント API の冪等性を統一的に処理する Service。

```typescript
// packages/api/src/services/IdempotencyService.ts
import { Context, Effect, Layer } from "effect"

export type IdempotencySource = "stripe" | "resend" | "line" | "instagram" | "facebook" | "client"

export type IdempotencyService = {
  readonly processOnce: <A>(
    key: string,
    source: IdempotencySource,
    execute: () => Effect.Effect<A, unknown>,
  ) => Effect.Effect<A, IdempotencyError>
}

export const IdempotencyService =
  Context.GenericTag<IdempotencyService>("IdempotencyService")
```

### 6.2 Webhook ハンドラでの使用

```typescript
// packages/api/src/routes/webhooks/stripe.ts
app.post("/webhooks/stripe", async (c) => {
  const signature = c.req.header("stripe-signature")
  if (!signature) return c.json({ error: "Missing signature" }, 400)

  const body = await c.req.text()
  const stripe = new Stripe(c.env.STRIPE_SECRET_KEY)

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, c.env.STRIPE_WEBHOOK_SECRET)
  } catch {
    return c.json({ error: "Invalid signature" }, 400)
  }

  await runEffect(c, Effect.gen(function* () {
    const idempotency = yield* IdempotencyService
    yield* idempotency.processOnce(event.id, "stripe", () =>
      Effect.gen(function* () {
        const billing = yield* BillingService
        yield* billing.handleWebhookEvent(event)
      })
    )
  }))

  return c.json({ received: true })
})
```

### 6.3 クライアント API の Idempotency-Key ミドルウェア

```typescript
// packages/api/src/middleware/idempotency.ts
import { createMiddleware } from "hono/factory"

export const idempotencyKey = () => createMiddleware(async (c, next) => {
  const key = c.req.header("idempotency-key")
  if (!key) {
    await next()
    return
  }

  // IdempotencyService で重複チェック
  // 既存のキーがあれば前回のレスポンスを返却
  // なければ処理を実行して結果をキャッシュ
  c.set("idempotencyKey", key)
  await next()
})
```

### 6.4 楽観的ロックのエラー

```typescript
// packages/shared/src/errors/common.ts
import { Data } from "effect"

export class ConflictError extends Data.TaggedError("ConflictError")<{
  readonly resource: string
  readonly id: string
}> {}
```

エラーハンドラで `409 Conflict` にマッピング:

```typescript
// packages/api/src/middleware/error-handler.ts
const errorToStatus = {
  // ... 既存 ...
  ConflictError: 409,
} as const
```

---

## 7. ページネーションの実装パターン

### 7.1 カーソルユーティリティ

```typescript
// packages/api/src/lib/cursor.ts

export const encodeCursor = (sortValue: string, id: string): string =>
  btoa(JSON.stringify({ s: sortValue, id }))

export const decodeCursor = (cursor: string): { s: string; id: string } =>
  JSON.parse(atob(cursor))

/**
 * 取得結果から PaginatedResponse を構築する。
 * Repository は limit + 1 件を取得し、この関数で hasMore を判定する。
 */
export const paginate = <T extends { id: string }>(
  rows: T[],
  limit: number,
  getSortValue: (item: T) => string,
): PaginatedResponse<T> => {
  const hasMore = rows.length > limit
  const data = hasMore ? rows.slice(0, limit) : rows
  const lastItem = data.at(-1)
  return {
    data,
    nextCursor: lastItem && hasMore ? encodeCursor(getSortValue(lastItem), lastItem.id) : null,
    hasMore,
  }
}
```

### 7.2 Repository でのカーソルクエリ

```typescript
// packages/api/src/repositories/ConversationRepo.ts
const findAll = (tenantId: TenantId, filters: Filters, pagination: PaginationParams) =>
  Effect.gen(function* () {
    const conditions = [
      eq(conversations.tenantId, tenantId),
      ne(conversations.state, "deleted"),
      ...buildFilterConditions(filters),
    ]

    // カーソルがある場合、Row Value 比較で絞り込み
    if (pagination.cursor) {
      const { s, id } = decodeCursor(pagination.cursor)
      conditions.push(
        sql`(${conversations.lastMessageAt}, ${conversations.id}) < (${s}, ${id})`
      )
    }

    const rows = yield* Effect.promise(() =>
      db.select().from(conversations)
        .where(and(...conditions))
        .orderBy(desc(conversations.lastMessageAt), desc(conversations.id))
        .limit(pagination.limit + 1)  // +1 で hasMore 判定
    )

    return paginate(rows, pagination.limit, (r) => r.lastMessageAt)
  })
```

### 7.3 Zod スキーマ

```typescript
// packages/api/src/schemas/common.ts
import { z } from "@hono/zod-openapi"

export const PaginationQuerySchema = z.object({
  cursor: z.string().optional().openapi({ description: "次ページのカーソル" }),
  limit: z.coerce.number().int().min(1).max(100).default(25).openapi({ description: "取得件数（最大100）" }),
}).openapi("PaginationQuery")

// レスポンス用のヘルパー
export const paginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    data: z.array(itemSchema),
    nextCursor: z.string().nullable(),
    hasMore: z.boolean(),
  })
```

---

## 8. リトライの実装パターン

### 8.1 リトライスケジュール定義

```typescript
// packages/api/src/lib/retry.ts
import { Schedule, Duration } from "effect"

export const standardRetry = Schedule.intersect(
  Schedule.exponential(Duration.millis(500)),
  Schedule.recurs(3),
).pipe(Schedule.jittered)

export const webhookRetry = Schedule.intersect(
  Schedule.exponential(Duration.seconds(1)),
  Schedule.recurs(5),
).pipe(Schedule.jittered)
```

### 8.2 リトライ可能なエラーの判定

```typescript
// packages/api/src/lib/retry.ts

/** HTTP ステータスコードからリトライ可能か判定 */
export const isRetryableStatus = (status: number): boolean =>
  status >= 500 || status === 429 || status === 408

/** 外部サービスのエラー基底型 */
export class ExternalServiceError extends Data.TaggedError("ExternalServiceError")<{
  readonly service: string
  readonly status?: number
  readonly cause: unknown
}> {
  get isRetryable(): boolean {
    return this.status === undefined || isRetryableStatus(this.status)
  }
}
```

### 8.3 外部サービス Layer での適用

```typescript
// packages/api/src/services/external/ResendService.ts
export const ResendServiceLive = Layer.succeed(EmailService, {
  send: (params) =>
    Effect.tryPromise({
      try: () => resend.emails.send(params),
      catch: (e) => new ExternalServiceError({
        service: "resend",
        status: (e as any)?.statusCode,
        cause: e,
      }),
    }).pipe(
      Effect.retry({
        schedule: standardRetry,
        while: (err) => err.isRetryable,
      }),
    ),
})
```

### 8.4 チャネル Gateway のリトライパターン

各チャネル Gateway の `send` メソッドにも同一のリトライパターンを適用する。

```typescript
// packages/api/src/services/channels/LineGateway.ts
const sendLineMessage = (
  channelAccessToken: string,
  params: LineSendParams,
) =>
  Effect.tryPromise({
    try: () =>
      fetch("https://api.line.me/v2/bot/message/push", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${channelAccessToken}`,
        },
        body: JSON.stringify(params),
      }).then(async (res) => {
        if (!res.ok) throw { statusCode: res.status, body: await res.text() }
        return res.json()
      }),
    catch: (e) => new ExternalServiceError({
      service: "line",
      status: (e as any)?.statusCode,
      cause: e,
    }),
  }).pipe(
    Effect.retry({
      schedule: standardRetry,
      while: (err) => err.isRetryable,
    }),
  )
```

> Instagram / Facebook も同一パターン。`service` 名と API エンドポイントのみ異なる。

---

## 9. レビューチェックリスト

コードレビュー・実装時に確認する項目。CLAUDE.md にも転記してエージェントが自動参照するようにする。

### セキュリティ

- [ ] 全 Repository メソッドが `WHERE tenant_id = ?` を含むか
- [ ] 新規ルートが `@hono/zod-openapi` の `createRoute` で定義されているか（Zod スキーマ + OpenAPI メタデータ）
- [ ] リクエストの入力バリデーション（Zod スキーマ）が漏れていないか
- [ ] 生 SQL（`db.execute()`）を使っていないか
- [ ] エラーレスポンスに内部情報（スタックトレース、DB エラー詳細）が含まれていないか
- [ ] Webhook エンドポイントの署名検証が実装されているか（Resend: svix, LINE: HMAC-SHA256, Instagram/Facebook: X-Hub-Signature-256）
- [ ] 新規エンドポイントに認証ミドルウェアが適用されているか
- [ ] 認可チェック（ロール、チャネル権限）が実装されているか
- [ ] ファイルアップロードのサイズ・MIME タイプ検証があるか
- [ ] 環境変数・シークレットがコードにハードコードされていないか

### データモデル

- [ ] ソフトデリート対象エンティティで物理削除（DELETE）を使っていないか
- [ ] ソフトデリート対象の `findAll` / `findById` が `state != 'deleted'` を含むか
- [ ] タイムスタンプ（`created_at`, `updated_at`, `recorded_at` 等）に DB の `now()` ではなく `RequestContext.requestedAt` を使用しているか
- [ ] Uni-temporal カラム（`superseded_at`）に NULL ではなく `TEMPORAL_INFINITY`（`9999-12-31 23:59:59Z`）を使用しているか

### 冪等性・並行制御

- [ ] Webhook ハンドラが `IdempotencyService.processOnce()` を使用しているか
- [ ] 副作用のある POST エンドポイントが `Idempotency-Key` ヘッダーに対応しているか
- [ ] 更新系エンドポイントが楽観的ロック（`superseded_at` チェック）を実装しているか
- [ ] `ConflictError` が `409 Conflict` にマッピングされているか
- [ ] 冪等な操作（self-assign, favorite, read mark）が `ON CONFLICT DO NOTHING` / UPSERT を使用しているか
- [ ] ステータス遷移が WHERE に `status = $expectedCurrentStatus` を含む CAS パターンか
- [ ] アサイン操作が親テーブル（`conversations.superseded_at`）の楽観的ロックを併用しているか
- [ ] 会話一覧の最終メッセージ取得が LATERAL JOIN で `messages.id`（μs タイムスタンプ）から導出されているか（`conversations` テーブルに非正規化しない）
- [ ] フロントエンドが 409 Conflict 時にデータ再取得 + ユーザー通知を行うか

### ページネーション

- [ ] 一覧 API がカーソルベースのページネーションを使用しているか
- [ ] Repository が `LIMIT + 1` で取得し `hasMore` を判定しているか
- [ ] レスポンスが `PaginatedResponse<T>` 形式（`data`, `nextCursor`, `hasMore`）か
- [ ] ソートキーに対応するインデックスが存在するか

### リトライ・外部サービス

- [ ] 外部サービス呼び出しに `standardRetry` または適切なリトライスケジュールが適用されているか
- [ ] 4xx エラー（バリデーションエラー等）がリトライ対象から除外されているか
- [ ] 外部サービスのエラーが `ExternalServiceError` でラップされているか

### マイグレーション

- [ ] 破壊的スキーマ変更（カラム削除・名変更・型変更・NOT NULL 追加）が Expand-Contract で 2 段階に分かれているか
- [ ] Expand マイグレーションが後方互換か（旧コードが新スキーマで動作するか）
- [ ] Contract マイグレーションが Expand のデプロイ完了後に別リリースで適用される計画になっているか
- [ ] マイグレーションファイル名に `expand_` / `contract_` 接頭辞が付いているか（破壊的変更の場合）
- [ ] バックフィルが必要な場合、バッチ処理で実装されているか（テーブルロック回避）
- [ ] `SELECT *` を使っていないか（カラム削除時に壊れるため、明示的にカラムを指定）

### 認可

- [ ] 新規ルートに `requireAction` ミドルウェアが適用されているか
- [ ] `requireAction` の resource 解決がリクエストパラメータと一致しているか
- [ ] Service メソッドに `actions.authorize(action, resource)` が含まれているか（defense in depth）
- [ ] 新しい操作を追加した場合、`Actions` 定義に action が追加されているか
- [ ] 新しいリソースを追加した場合、`Subject` 型に subject が追加されているか
- [ ] 「ルート - Action マッピング一覧」テーブルが更新されているか
- [ ] `buildAbility` で新しい Action / Subject が正しくカバーされているか
- [ ] 新しいリソースに対して CASL 条件ベースのフィルタリングが必要か検討されているか
