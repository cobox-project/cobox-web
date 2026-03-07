# 冪等性・並行制御

> このドキュメントは [backend-architecture.md](../../.claude/rules/backend-architecture.md) から切り出した詳細仕様。

---

## 1. 冪等性（Idempotency）

### 方針

外部からのイベント受信（Webhook）およびクライアントからの副作用のある API 呼び出しにおいて、同一リクエストの重複実行を防止する。

### Webhook の重複排除

Stripe, Resend, LINE 等の外部サービスは同一イベントを複数回送信する可能性がある。
イベント ID をキーとして重複を検出・排除する。

```
idempotency_keys テーブル:
  tenant_id     TEXT NOT NULL           -- テナント ID
  key           TEXT NOT NULL           -- イベント ID（例: Stripe の event.id）またはクライアント生成 UUID
  source        TEXT NOT NULL           -- "stripe" | "resend" | "line" | "instagram" | "facebook" | "client"
  processed_at  TIMESTAMPTZ NOT NULL    -- 処理完了時刻
  response      JSONB                   -- 処理結果のキャッシュ（任意）
  PRIMARY KEY (tenant_id, key)
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
| `PATCH` 系 | 楽観的ロック | `superseded_at` ベース |

### 楽観的ロック

複数オペレーターが同一リソースを同時に更新するケースに対応する。
`superseded_at` を使用した楽観的ロックを実装する。

```typescript
// Repository での実装
const update = (tenantId: TenantId, id: ConversationId, data: UpdateData, expectedSupersededAt: Temporal.Instant) =>
  Effect.gen(function* () {
    const result = yield* Effect.promise(() =>
      db.update(conversations)
        .set({ ...data, superseded_at: ctx.requestedAt.toString() })
        .where(and(
          eq(conversations.tenantId, tenantId),
          eq(conversations.id, id),
          eq(conversations.supersededAt, expectedSupersededAt.toString()),  // 楽観的ロック
        ))
        .returning()
    )
    if (result.length === 0) {
      return yield* new ConflictError({ resource: "Conversation", id })
    }
    return result[0]
  })
```

- クライアントは取得時の `superseded_at` を更新リクエストに含める
- 不一致時は `409 Conflict` を返し、クライアントに再取得を促す

---

## 2. 並行操作の安全性（複数タブ・複数ユーザー）

複数のブラウザタブや複数ユーザーが同一リソースを同時に操作するケースに対応する。

### リアルタイム通信（SSE）

リアルタイム通信には **SSE（Server-Sent Events）** を採用する。Cloudflare Durable Objects でコネクション管理を行う。

**SSE を選択した理由:**
- サーバー → クライアントの通知がメイン（新着メッセージ、ステータス変更、入力ロック通知等）
- ブラウザの `EventSource` API が切断時に自動再接続してくれる
- HTTP の延長で認証・ミドルウェアがそのまま使える
- 入力ロック機能（ユーザーAが入力開始 → 他ユーザーの入力をロック）に対応。クライアント起点のイベント（入力開始/終了）は REST API 経由で送信し、他クライアントへの通知は SSE で配信する

**SSE の認証・認可・テナント分離:**

- SSE エンドポイント（`GET /sse`）は **Cookie ベースの認証**を使用する。`EventSource` API はカスタムヘッダーを送れないため、Bearer トークンは使用不可
- 接続確立時に Cookie から JWT を検証し、`tenantId` / `userId` を確定。無効な場合は接続を拒否（401）
- Durable Objects のルームを **`tenantId` 単位で分離**し、テナント間のイベント漏洩を防止
- イベント配信前に **チャネル権限（`channel_permissions`）をチェック**し、閲覧権限のないチャネルの会話に関するイベント（`message:created`, `conversation:updated`, `typing:started/stopped`）は配信しない
- M2M（`api_key`）からの SSE 接続は非対応（M2M はポーリングまたは Webhook で対応）

**SSE イベント種別:**

| イベント | ペイロード | 用途 |
| --- | --- | --- |
| `message:created` | `{ conversationId, message }` | 新着メッセージ通知 |
| `conversation:updated` | `{ conversationId, changes }` | ステータス変更・アサイン変更等 |
| `contact:updated` | `{ contactId, changes }` | コンタクト情報の変更 |
| `typing:started` | `{ conversationId, userId, userName }` | 入力開始（入力ロック用） |
| `typing:stopped` | `{ conversationId, userId }` | 入力終了（入力ロック解除用） |

**フォールバック:**

SSE 接続が切断された場合、ブラウザの自動再接続に加え、再接続時にフォーカス時再取得（`revalidateOnFocus` / `revalidateOnReconnect`）でデータの整合性を保つ。

**入力ロック（タイピングロック）の技術設計:**

入力ロックの状態は **Durable Objects のインメモリ状態** で管理する（DB に保存しない）。

- **API エンドポイント:**
  - `POST /conversations/:id/typing/start` — 入力開始を通知
  - `POST /conversations/:id/typing/stop` — 入力終了を通知
- **Durable Objects 側の状態管理:**
  - 会話ごとに `{ userId, userName, lastActivityAt }` を保持
  - `typing:started` 受信時に状態をセットし、同一テナントの他クライアントに SSE で `typing:started` を配信
  - `typing:stopped` 受信時に状態をクリアし、`typing:stopped` を配信
- **タイムアウト（30秒）:**
  - Durable Objects の `alarm()` API で 30秒タイマーをセット
  - `typing/start` を受信するたびにタイマーをリセット
  - 30秒間追加の `typing/start` がなければ、自動的に `typing:stopped` を配信し状態をクリア
- **接続切断時の自動解除:**
  - Durable Objects が WebSocket / SSE 接続の切断を検知した場合、そのユーザーが入力中であればロックを自動解除
- **チーム内メモはロック対象外:**
  - 入力ロックは返信（`is_internal = false`）のみに適用。チーム内メモ（`is_internal = true`）は複数スタッフが同時入力可能
- **同一ユーザーの複数タブ:**
  - 同一ユーザーからの `typing/start` は冪等に処理（既にそのユーザーがロック中なら状態を更新するのみ）
  - 異なるタブからの `typing/stop` は、現在のロック保持者が同一ユーザーの場合のみ解除

### 操作の分類と競合制御

| 操作 | 競合制御方式 | 理由 |
| --- | --- | --- |
| PATCH（ステータス変更、コンタクト更新等） | 楽観的ロック（`superseded_at`） | 古いデータで上書きを防止 |
| POST（メッセージ送信、一括メール送信） | `Idempotency-Key` ヘッダ | 重複送信を防止 |
| self-assign | 冪等な UPSERT | ロック不要。既にアサイン済みなら何もしない |
| favorite トグル | 冪等な UPSERT / DELETE | `ON CONFLICT DO NOTHING` で重複を許容 |
| typing 開始/停止 | Durable Objects のインメモリ状態 | DB 書き込み不要。SSE 配信のみ |
| アサイン追加/削除 | 楽観的ロック（`conversations.superseded_at`） | `conversation_assignees` 操作時に親の `superseded_at` もチェック |

### ステータス遷移の原子性

ステータス変更は「現在のステータスを読む → StatusMachine で遷移計算 → 更新」の3ステップ。
楽観的ロック（`superseded_at`）による検出に加え、DB レベルで原子性を保証する。

```sql
-- ステータス遷移の原子的更新（SELECT FOR UPDATE は不要）
-- WHERE に現在のステータスを含めることで CAS（Compare-And-Swap）を実現
UPDATE conversations
SET status = $new_status, superseded_at = $requestedAt
WHERE tenant_id = $tenantId
  AND id = $conversationId
  AND status = $expectedCurrentStatus
  AND superseded_at = $expectedSupersededAt
RETURNING *;
-- 0 rows → 別の操作が先行。409 Conflict を返す
```

### アサイン操作のレース保護

`conversation_assignees` は物理 INSERT / DELETE のため、楽観的ロックの対象外。
代わりに `conversations.superseded_at` を親レコードのバージョンとして利用する。

```typescript
// アサイン操作は conversations テーブルの superseded_at を同時に更新
const assignUser = (conversationId, userId, expectedSupersededAt) =>
  withTransaction((tx) =>
    pipe(
      // 1. 親の楽観的ロックチェック + superseded_at 更新
      tx.update(conversations)
        .set({ superseded_at: ctx.requestedAt })
        .where(and(
          eq(conversations.id, conversationId),
          eq(conversations.supersededAt, expectedSupersededAt),
        ))
        .returning(),
      // 2. アサイン追加（ON CONFLICT DO NOTHING で冪等に）
      tx.insert(conversationAssignees)
        .values({ conversationId, userId, tenantId, assignedAt: ctx.requestedAt })
        .onConflictDoNothing(),
    )
  )
```

### self-assign の冪等性

フロントエンドが入力開始時に呼び出すため、連打・複数タブから同時に呼ばれる可能性が高い。
楽観的ロックは使用せず、`ON CONFLICT DO NOTHING` で冪等に処理する。

```typescript
// POST /conversations/:id/self-assign
// 楽観的ロック不要 — 追加的な操作で他ユーザーの操作と競合しない
const selfAssign = (conversationId, userId) =>
  db.insert(conversationAssignees)
    .values({ conversationId, userId, tenantId, assignedAt: ctx.requestedAt })
    .onConflictDoNothing()  // 既にアサイン済みなら何もしない（冪等）
```

### favorite トグルのレース保護

同一ユーザーが複数タブから同時にトグルした場合のレースを防ぐ。

```typescript
// PATCH /conversations/:id/favorite
// トランザクション内で DELETE → 条件付き INSERT
const toggleFavorite = (conversationId, userId) =>
  withTransaction((tx) =>
    Effect.gen(function* () {
      const deleted = yield* Effect.promise(() =>
        tx.delete(conversationFavorites)
          .where(and(
            eq(conversationFavorites.conversationId, conversationId),
            eq(conversationFavorites.userId, userId),
            eq(conversationFavorites.tenantId, tenantId),
          ))
          .returning()
      )
      if (deleted.length === 0) {
        // 存在しなかった → 追加
        yield* Effect.promise(() =>
          tx.insert(conversationFavorites)
            .values({ conversationId, userId, tenantId, recordedAt: ctx.requestedAt })
            .onConflictDoNothing()  // レース時の二重 INSERT を防止
        )
      }
      // deleted.length > 0 なら削除済み（トグルオフ）
    })
  )
```

### 同一会話への同時返信

複数ユーザーが同じ会話で同時に返信する場合、メッセージ自体は INSERT（競合なし）だが、
`conversations.status` の更新が競合する可能性がある。

```sql
-- ステータス遷移のみ（last_message_at は messages テーブルから LATERAL JOIN で導出するため不要）
UPDATE conversations
SET status = CASE
      WHEN status IN ('completed', 'no_action') THEN 'in_progress'
      WHEN status = 'new' THEN 'in_progress'
      ELSE status
    END,
    superseded_at = $requestedAt
WHERE tenant_id = $tenantId AND id = $conversationId;
```

この UPDATE は楽観的ロックを使用しない（メッセージ送信は「追加的」操作のため、他ユーザーの送信と競合しても両方成功すべき）。

### 409 Conflict 時のフロントエンド対応

- ユーザーの入力内容はそのまま保持する（フォームをクリアしない）
- トーストで通知: 「他のユーザーが先に内容を変更しました。ページを再読み込み後、もう一度変更をお試しください。」
