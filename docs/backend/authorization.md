# 認可モデル（IAM + CASL）詳細仕様

> このドキュメントは [backend-architecture.md](../../.claude/rules/backend-architecture.md) から切り出した詳細仕様。

---

## 認可の方針

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

---

## Action 命名規則

```text
<service>:<operation>
```

- `service`: リソースのドメイン名（小文字）
- `operation`: 操作の動詞（小文字）

---

## Action 一覧

```typescript
// packages/shared/src/types/actions.ts

export const Actions = {
  // Conversation
  "conversation:list":           "会話一覧の取得",
  "conversation:read":           "会話詳細の取得",
  "conversation:updateStatus":   "会話ステータスの変更",
  "conversation:assign":         "会話のアサイン変更",
  "conversation:selfAssign":     "入力開始時の自動自分アサイン",
  "conversation:favorite":       "会話のお気に入りトグル",
  "conversation:link":           "会話のリンク",
  "conversation:unlink":         "会話のリンク解除",
  "conversation:delete":         "会話の削除（ソフトデリート）",
  "conversation:typingStart":    "入力ロック開始",
  "conversation:typingStop":     "入力ロック解除",

  // Message
  "message:list":                "メッセージ一覧の取得",
  "message:send":                "メッセージの送信（返信）",
  "message:sendInternal":        "チーム内メモの送信",
  "message:parseMentions":       "メッセージ内メンション解析",

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
  "bulkEmail:validateVariables": "一括メール変数の検証",
  "bulkEmail:listSends":         "一括メール送信履歴一覧の取得",
  "bulkEmail:readSend":          "一括メール送信結果詳細の取得",

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

---

## CASL Subject（リソース）定義

```typescript
// packages/shared/src/types/subjects.ts

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

---

## CASL Ability

- `AppAbility = PureAbility<[Action, Subject]>` 型で権限を表現
- Phase 1 では全ユーザーに全操作を許可。将来的にポリシーベースで制限を追加
- `buildAbility(userContext)` でユーザーの Ability を構築

### CallerType 別の Ability 構築

| CallerType | Ability の構築元 | 備考 |
| --- | --- | --- |
| `session` / `oauth` | ユーザーのロール + ポリシー | 既存ロジック |
| `api_key` | WorkOS M2M トークンの `permissions` クレーム | permissions = Action のサブセット |

---

## ルート - Action マッピング一覧

全認証済みエンドポイントに `requireAction` を適用する。

| エンドポイント | Action | Subject | 属性解決 |
|---------------|--------|---------|---------|
| `GET /conversations` | `conversation:list` | `Conversation` | なし |
| `GET /conversations/:id` | `conversation:read` | `Conversation` | `{ id }` |
| `PATCH /conversations/:id/status` | `conversation:updateStatus` | `Conversation` | `{ id }` |
| `PATCH /conversations/:id/assign` | `conversation:assign` | `Conversation` | `{ id }` |
| `POST /conversations/:id/self-assign` | `conversation:selfAssign` | `Conversation` | `{ id }` |
| `PATCH /conversations/:id/favorite` | `conversation:favorite` | `Conversation` | `{ id }` |
| `POST /conversations/:id/link` | `conversation:link` | `Conversation` | `{ id }` |
| `DELETE /conversations/:id/link/:lid` | `conversation:unlink` | `Conversation` | `{ id }` |
| `POST /conversations/:id/typing/start` | `conversation:typingStart` | `Conversation` | `{ id }` |
| `POST /conversations/:id/typing/stop` | `conversation:typingStop` | `Conversation` | `{ id }` |
| `POST /conversations/:id/messages` | `message:send` | `Message` | `{ conversationId }` |
| `POST /conversations/:id/messages/internal` | `message:sendInternal` | `Message` | `{ conversationId }` |
| `GET /contacts` | `contact:list` | `Contact` | なし |
| `GET /contacts/:id` | `contact:read` | `Contact` | `{ id }` |
| `POST /contacts` | `contact:create` | `Contact` | なし |
| `PATCH /contacts/:id` | `contact:update` | `Contact` | `{ id }` |
| `DELETE /contacts/:id` | `contact:delete` | `Contact` | `{ id }` |
| `GET /accounts` | `account:list` | `Account` | なし |
| `POST /accounts` | `account:create` | `Account` | なし |
| `PATCH /accounts/:id` | `account:update` | `Account` | `{ id }` |
| `DELETE /accounts/:id` | `account:delete` | `Account` | `{ id }` |
| `GET /accounts/:id` | `account:read` | `Account` | `{ id }` |
| `GET /templates` | `template:list` | `Template` | なし |
| `POST /templates` | `template:create` | `Template` | なし |
| `PATCH /templates/:id` | `template:update` | `Template` | `{ id }` |
| `DELETE /templates/:id` | `template:delete` | `Template` | `{ id }` |
| `PATCH /templates/reorder` | `template:reorder` | `Template` | なし |
| `GET /team/members` | `team:listMembers` | `Team` | なし |
| `POST /team/invite` | `team:invite` | `Team` | なし |
| `PATCH /team/members/:id/permissions` | `team:updatePermissions` | `Team` | `{ id }` |
| `DELETE /team/members/:id` | `team:removeMember` | `Team` | `{ id }` |
| `POST /bulk-email/send` | `bulkEmail:send` | `BulkEmail` | なし |
| `POST /bulk-email/drafts` | `bulkEmail:createDraft` | `BulkEmail` | なし |
| `GET /bulk-email/drafts` | `bulkEmail:listDrafts` | `BulkEmail` | なし |
| `PATCH /bulk-email/drafts/:id` | `bulkEmail:updateDraft` | `BulkEmail` | `{ id }` |
| `DELETE /bulk-email/drafts/:id` | `bulkEmail:deleteDraft` | `BulkEmail` | `{ id }` |
| `POST /bulk-email/validate-variables` | `bulkEmail:validateVariables` | `BulkEmail` | なし |
| `GET /bulk-email/sends` | `bulkEmail:listSends` | `BulkEmail` | なし |
| `GET /bulk-email/sends/:id` | `bulkEmail:readSend` | `BulkEmail` | `{ id }` |
| `GET /reports/metrics` | `report:readMetrics` | `Report` | なし |
| `GET /m2m-apps` | `m2mApp:list` | `M2mApp` | なし |
| `POST /m2m-apps` | `m2mApp:create` | `M2mApp` | なし |
| `DELETE /m2m-apps/:id` | `m2mApp:revoke` | `M2mApp` | `{ id }` |
| `POST /m2m-apps/:id/rotate` | `m2mApp:rotate` | `M2mApp` | `{ id }` |
| `GET /billing/subscription` | `billing:readSubscription` | `Billing` | なし |
| `POST /billing/checkout` | `billing:createCheckout` | `Billing` | なし |
| `POST /billing/portal` | `billing:createPortal` | `Billing` | なし |
| `GET /contact-groups` | `contactGroup:list` | `ContactGroup` | なし |
| `POST /contact-groups` | `contactGroup:create` | `ContactGroup` | なし |
| `PATCH /contact-groups/:id` | `contactGroup:update` | `ContactGroup` | `{ id }` |
| `DELETE /contact-groups/:id` | `contactGroup:delete` | `ContactGroup` | `{ id }` |
| `POST /contact-groups/:id/members` | `contactGroup:addMember` | `ContactGroup` | `{ id }` |
| `GET /variables` | `variable:list` | `Variable` | なし |
| `POST /variables` | `variable:create` | `Variable` | なし |
| `PATCH /variables/:id` | `variable:update` | `Variable` | `{ id }` |
| `DELETE /variables/:id` | `variable:delete` | `Variable` | `{ id }` |
| `DELETE /conversations/:id` | `conversation:delete` | `Conversation` | `{ id }` |

> Webhook エンドポイント（`/webhooks/*`）は認証不要（署名検証のみ）のため `requireAction` の対象外。

---

## 認可の二重チェック（Defense in Depth）

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

> 実装パターン: [coding-conventions.md - 4.2 ActionContext / 4.3 Service 層の defense in depth](../../.claude/rules/coding-conventions.md)

---

## 将来の拡張: ロール/グループ別ポリシー

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
  conditions: { channel: "email" },
}

// ポリシー例: 「自分にアサインされた会話のみ操作可」
const assignedOnlyPolicy: PolicyStatement = {
  sid: "AllowAssignedOnly",
  effect: "allow",
  actions: ["conversation:read", "conversation:updateStatus", "message:send"],
  subjects: ["Conversation", "Message"],
  conditions: { "assigneeIds": { "$in": ["{{userId}}"] } },
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
