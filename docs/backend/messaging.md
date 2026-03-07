# マルチチャネルメッセージング

> このドキュメントは [backend-architecture.md](../../.claude/rules/backend-architecture.md) から切り出した詳細仕様。

---

## 1. 対応チャネル

| チャネル | 送信 API | 受信方式 | 署名検証 | スレッディング |
| --- | --- | --- | --- | --- |
| Email | Resend API | Resend Webhook (Inbound) | svix 署名検証 | RFC 2822 ヘッダ（Message-ID / In-Reply-To / References） |
| LINE | LINE Messaging API (`/v2/bot/message/reply`, `/push`) | LINE Webhook | `X-Line-Signature`（HMAC-SHA256） | `replyToken` / ユーザー単位で会話を紐付け |
| Instagram | Instagram Graph API (`/me/messages`) | Instagram Webhook (Webhooks for Instagram) | `X-Hub-Signature-256`（HMAC-SHA256） | スレッド ID（`thread_id`）で紐付け |
| Facebook | Messenger Platform API (`/me/messages`) | Facebook Webhook (Webhooks for Messenger) | `X-Hub-Signature-256`（HMAC-SHA256） | 送信者 PSID 単位で会話を紐付け |

## 2. 統一メッセージングアーキテクチャ（ChannelGateway）

チャネル固有のロジックを `ChannelGateway` インターフェースで抽象化し、MessageService がチャネルの違いを意識しない設計にする。

```typescript
// packages/api/src/services/channels/ChannelGateway.ts
export type SendMessageParams = {
  readonly accountId: AccountId
  readonly conversationId: ConversationId
  readonly content: string
  readonly attachments?: readonly AttachmentRef[]
  readonly cc?: readonly string[]
  readonly bcc?: readonly string[]
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

### チャネル別実装

```text
packages/api/src/services/channels/
├── ChannelGateway.ts          # 型定義（上記）
├── ChannelRouter.ts           # channel 種別に応じた Gateway 解決
├── EmailGateway.ts            # Resend API 実装
├── LineGateway.ts             # LINE Messaging API 実装
├── InstagramGateway.ts        # Instagram Graph API 実装
└── FacebookGateway.ts         # Facebook Messenger API 実装
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

## 3. メッセージ送信フロー

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
  └─ ConversationRepo.updateStatusIfNeeded(conversationId)  ← ステータス遷移（last_message_at は messages から導出）
```

> 全体がトランザクション内で実行される（外部 API 呼び出しはトランザクション外、DB 操作のみトランザクション内）。

## 4. Webhook 受信フロー（共通）

### 署名検証と Account 解決の実行順序

チャネルによって署名検証に必要な情報の取得元が異なるため、実行順序がチャネル別に分かれる。

| チャネル | 署名検証シークレットの取得元 | 実行順序 |
| --- | --- | --- |
| **LINE** | `accounts.config->>'channelSecret'`（DB） | Account 解決 → 署名検証 |
| **Instagram** | `INSTAGRAM_APP_SECRET`（環境変数） | 署名検証 → Account 解決 |
| **Facebook** | `FACEBOOK_APP_SECRET`（環境変数） | 署名検証 → Account 解決 |
| **Resend** | svix 署名（Resend SDK） | 署名検証 → Account 解決 |
| **Stripe** | `STRIPE_WEBHOOK_SECRET`（環境変数） | 署名検証（Account 解決不要） |

**LINE の場合**: ペイロードの `destination`（Bot userId）で `accounts` テーブルを引き、`channelSecret` を取得してから署名検証する。Account が見つからない場合は 404 で即座に拒否（DB クエリは 1 回のみ）。不正リクエストによる DB 負荷を最小限に抑える。

**その他のチャネル**: 環境変数のシークレットで署名検証を先に行い、不正リクエストを DB クエリ前に排除する。

```text
POST /webhooks/:channel
  │
  ├─ [LINE] AccountResolver → 署名検証 / [その他] 署名検証 → AccountResolver
  ├─ AccountResolver.resolveByWebhook(channel, webhookPayload) → account, tenantId
  │    └─ Webhook ペイロードから account を特定し、tenant_id を取得して RequestContext に設定
  ├─ IdempotencyService.processOnce(webhookEventId)  ← 冪等性
  ├─ ChannelGateway.parseWebhook(rawBody, headers) → InboundMessage[]
  │
  │  各 InboundMessage に対して:
  ├─ ContactResolver.resolve(channel, senderHandle)
  │    ├─ contact_channel_handles から既存コンタクトを検索
  │    └─ 未登録の場合: 新規コンタクト + ハンドル自動作成
  ├─ ConversationResolver.resolve(channel, contact, threadingKey, account)
  │    ├─ 共通: 前回メッセージから 7日以内 かつ ステータスが new/in_progress の会話を検索
  │    ├─ [Email]      → email_thread_id でマッチング（In-Reply-To/References）+ 7日ウィンドウ
  │    ├─ [LINE]       → account_id + contact_id で検索 + 7日ウィンドウ
  │    ├─ [Instagram]  → account_id + contact_id で検索 + 7日ウィンドウ
  │    ├─ [Facebook]   → account_id + contact_id で検索 + 7日ウィンドウ
  │    ├─ ステータスが completed/no_action の会話がマッチした場合:
  │    │    └─ スレッド条件を満たす → 同一スレッドに追加 + ステータスを new に再浮上
  │    │    └─ スレッド条件を超過（7日以上） → 新規会話作成
  │    └─ マッチなし → 新規会話作成（番号採番含む）
  ├─ MessageRepo.insert({ ..., is_inbound: true })
  ├─ ConversationRepo.updateStatusIfNeeded + StatusMachine（new/in_progress → 変化なし, completed/no_action → new に再浮上）
  └─ 完了（通知機能は requirements 外のため未実装）
```

> **テナント解決**: Webhook エンドポイントは認証ミドルウェアの対象外のため、`tenantId` は Webhook ペイロード内の識別情報から `accounts` テーブルを逆引きして取得する。
> - LINE: `destination`（Bot userId）→ `accounts.config->>'botUserId'`
> - Instagram: 受信先 Page ID → `accounts.config->>'igUserId'`
> - Facebook: 受信先 Page ID → `accounts.config->>'pageId'`
> - Email: 受信先メールアドレス → `accounts.config->>'fromEmail'`

## 5. チャネル別の詳細

### Email（Resend）

- **チャネル接続方式**: Resend でドメインを設定（DNS レコード追加）。ユーザーは管理画面で送信元アドレス（例: `support@yourcompany.com`）を登録
- **送信**: Resend API (`resend.emails.send()`) で HTML/テキストメール送信
- **受信**: Resend Inbound Webhook（`email.received` イベント）
- **スレッディング**: RFC 2822 準拠。`Message-ID`, `In-Reply-To`, `References` ヘッダでマッチング + 7日ウィンドウ。ステータスが completed/no_action の場合、スレッド条件を満たせば再浮上、超過していれば新規会話
- **メッセージ固有カラム**: `messages.email_message_id`, `email_in_reply_to`, `email_references`
- **添付ファイル**: Resend が提供する Base64 データを R2 にアップロード
- **CC/BCC**: メール送信時に CC/BCC を指定可能。CC 受信者は `contact_channel_handles` で自動追跡しない（送信専用）
- **アカウント設定（`accounts.config` JSONB）**:
  ```json
  {
    "resendApiKey": "encrypted:...",
    "fromEmail": "support@example.com",
    "fromName": "サポートチーム"
  }
  ```

### LINE Messaging API

- **送信**:
  - `replyToken` がある場合（受信直後の返信）: Reply API (`/v2/bot/message/reply`)
  - `replyToken` がない場合（能動的送信）: Push API (`/v2/bot/message/push`)
- **受信**: LINE Webhook（`message` イベント）
- **署名検証**: `X-Line-Signature` ヘッダを Channel Secret で HMAC-SHA256 検証
- **スレッディング**: LINE にはスレッド概念がないため、`account_id` + `contact_id` で一意の会話にマッピング。前回メッセージから7日以内かつステータスが new/in_progress の会話があればそこに追加。completed/no_action の会話が7日以内にある場合は同一スレッドに追加しステータスを new に再浮上。7日超過またはマッチなしの場合は新規会話作成
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

### Instagram Graph API

- **送信**: `POST /{page-id}/messages` （Instagram Graph API v21.0+）
- **受信**: Instagram Webhooks（`messaging` フィールド）
- **署名検証**: `X-Hub-Signature-256` ヘッダを App Secret で HMAC-SHA256 検証
- **スレッディング**: Instagram は `thread_id` を提供するが、他チャネルと同様に `account_id` + `contact_id` で検索 + 7日ウィンドウ + ステータスベースのロジックを適用。`conversations` テーブルに `instagram_thread_id` カラムで保持。前回メッセージから7日以内かつ new/in_progress の会話があればそこに追加。completed/no_action の場合は再浮上。7日超過またはマッチなしの場合は新規会話作成
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

### Facebook Messenger

- **送信**: `POST /me/messages`（Messenger Platform Send API）
- **受信**: Facebook Webhooks（`messaging` フィールド）
- **署名検証**: `X-Hub-Signature-256` ヘッダを App Secret で HMAC-SHA256 検証（Instagram と同一方式）
- **スレッディング**: Messenger にはスレッド概念がないため、LINE と同様に `account_id` + `contact_id` でマッピング + 7日ウィンドウ + ステータスベースのロジックを適用。前回メッセージから7日以内かつ new/in_progress の会話があればそこに追加。completed/no_action の場合は再浮上。7日超過またはマッチなしの場合は新規会話作成
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

## 6. DB スキーマ追加・変更

conversations テーブルに Instagram 用スレッド ID カラムを追加:

| テーブル | 追加カラム | 説明 |
| --- | --- | --- |
| conversations | `instagram_thread_id` | Instagram のスレッド ID（Instagram チャネルのみ使用） |
| conversations | `line_user_id` | ※不要。`contact_channel_handles` で解決するため |
| messages | `external_message_id` | チャネル側で採番されたメッセージ ID（冪等性・重複排除用） |
| --- | `channel_metadata` (R2) | チャネル固有のメタデータ（LINE スタンプ情報、Instagram メディア等）。R2 に `{tenant_id}/messages/{message_id}/channel_metadata.json` として保存 |

> `contact_channel_handles` テーブルが各チャネルのユーザー識別子（メールアドレス、LINE userId、IGSID、PSID）を統一的に管理する。

## 7. インデックス追加

```sql
-- Instagram スレッド解決
CREATE INDEX idx_conversations_tenant_instagram_thread
  ON conversations (tenant_id, instagram_thread_id)
  WHERE instagram_thread_id IS NOT NULL;

-- LINE/Instagram/Facebook: account + contact で既存会話検索（7日ウィンドウ + ステータス再浮上対応）
CREATE INDEX idx_conversations_tenant_account_contact
  ON conversations (tenant_id, account_id, contact_id);

-- メッセージ重複排除（Webhook 冪等性の補助）
CREATE UNIQUE INDEX idx_messages_tenant_external_id
  ON messages (tenant_id, external_message_id)
  WHERE external_message_id IS NOT NULL;
```

## 8. エラー定義

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

## 9. Webhook ルートの実装パターン

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
          IdempotencyService.processOnce(
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
