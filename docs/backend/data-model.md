# データモデル・DB スキーマ・インデックス 詳細仕様

> このドキュメントは [backend-architecture.md](../../.claude/rules/backend-architecture.md) から切り出した詳細仕様。

---

## 1. Temporal データモデル

履歴が必要なエンティティや state が変化するエンティティには temporal データモデルを採用する。

### タイムスタンプの取得方針

**全てのタイムスタンプは `RequestContext.requestedAt`（リクエスト受付時刻）を使用する。DB の `now()` は使わない。**

理由: 1つのリクエスト内で複数テーブルに書き込む場合、DB の `now()` はクエリ実行タイミングによって微妙にズレる。リクエスト受付時刻を統一的に使うことで、同一操作に起因する全レコードのタイムスタンプが一致する。

DDL に `DEFAULT now()` のような動的デフォルトは定義しない。タイムスタンプは全て `NOT NULL` とし、アプリケーションから明示的に値を渡すことを強制する（渡し忘れはコンパイルエラー）。ただし、センチネル値（`DEFAULT '9999-12-31 23:59:59Z'`）やエンティティの初期状態（`DEFAULT 'active'`）など、ビジネスルール上一意に決まる静的デフォルトは DDL で定義してよい。

> 実装パターン: [coding-conventions.md - 3.1 タイムスタンプ](../../.claude/rules/coding-conventions.md)

### Uni-temporal（トランザクション時間のみ）

「いつ DB に記録されたか」を追跡する。state 変化の履歴を保持する必要があるが、
「実世界でいつ起きたか」と「DB に記録された時刻」の区別が不要なエンティティに適用。

対象: conversations, contacts, accounts, users, channel_permissions, compose_templates

```sql
共通カラム:
  recorded_at    TIMESTAMPTZ NOT NULL  -- レコード作成時刻（アプリから渡す）
  superseded_at    TIMESTAMPTZ NOT NULL  -- 最終更新時刻（アプリから渡す）
  state         TEXT NOT NULL DEFAULT 'active'  -- エンティティのライフサイクル状態
```

> **NULL の代わりにセンチネル値を使用**: `superseded_at` に NULL を使うと B-tree インデックスが効かないケースがある。`9999-12-31 23:59:59Z`（`TEMPORAL_INFINITY`）をセンチネル値として使用し、全カラムを `NOT NULL` にすることでインデックスの効率を保証する。

### Temporal 適用ルール

全テーブルは **uni-temporal** または **非 temporal** のいずれかとする。Bi-temporal は採用しない（遡及的な修正が必要なユースケースが存在しないため）。

Uni-temporal テーブルは更新のたびに行が蓄積され、`superseded_at` で現行（センチネル値）と過去バージョンを区別する。これにより、ステータス変更や権限変更の履歴は該当テーブル自体で追跡可能であり、別途の履歴テーブルは不要。

| エンティティ | Temporal モデル | 理由 |
|-------------|----------------|------|
| conversations | uni-temporal | status 遷移・アサイン変更等の履歴を自テーブルで追跡 |
| users | uni-temporal | アカウント状態のライフサイクル管理 |
| contacts | uni-temporal | 顧客情報の変更追跡 |
| accounts | uni-temporal | チャネル接続のライフサイクル |
| channel_permissions | uni-temporal | 権限変更の履歴を自テーブルで追跡 |
| contact_groups | 非 temporal | 変更履歴不要。直接 UPDATE |
| compose_templates | uni-temporal | テンプレートの変更追跡 |
| messages | 非 temporal（イミュータブル） | 送信済みメッセージは変更不可 |
| attachments | 非 temporal（イミュータブル） | 添付ファイルは変更不可 |

将来的に uni-temporal テーブルの過去バージョンが肥大化した場合、アーカイブ（古い行の別テーブル/ストレージへの退避）またはパーティショニングを検討する。

---

## 2. ソフトデリート（State ベース）

仕様上「削除」と表現されるが監査的にデータ保持が必要なエンティティは、
DB から物理削除せず `state` カラムで管理する。

### ソフトデリート適用ルール

| エンティティ | 削除方式 | State 値 | 理由 |
|-------------|---------|----------|------|
| users | ソフトデリート | active / suspended / deleted | メンバー削除後もメッセージ履歴に名前表示が必要 |
| contacts | ソフトデリート | active / archived / deleted | 過去の会話履歴とのリレーション保持 |
| accounts | ソフトデリート | active / disconnected / deleted | チャネル切断後もメッセージ履歴を参照可能 |
| conversations | ソフトデリート | active / deleted | ビジネスステータスは `status`（new/in_progress/completed/no_action）で管理、ソフトデリートは `state` で管理 |
| compose_templates | ソフトデリート | active / deleted | テンプレート削除後も送信済みメッセージとの関連を保持 |
| contact_groups | ソフトデリート | active / deleted | グループ削除後も監査証跡として保持 |
| channel_permissions | ソフトデリート | active / revoked | 権限変更の監査 |
| messages | 物理削除なし | N/A（イミュータブル） | メッセージは削除不可 |
| attachments | 物理削除なし | N/A（イミュータブル） | 添付ファイルは削除不可 |
| conversation_assignees | 物理削除 | N/A | 監査不要、現在の状態のみ重要 |
| conversation_links | 物理削除 | N/A | 監査不要 |
| contact_group_members | 物理削除 | N/A | 監査不要 |

### Repository 層のデフォルト動作

- `findAll` / `findById`: デフォルトで `state = 'deleted'` のレコードを除外する。ソフトデリートは物理削除ではなく状態遷移であり、削除済みデータには API 経由でアクセスさせない
- 「削除」API は `state = 'deleted'` への更新で実行
- 削除済みデータの参照が必要な場合（例: DB の直接クエリによる監査）は、運用チームが DB に直接アクセスして行う。アプリケーション API では提供しない

> 実装パターン: [coding-conventions.md - 3.3 ソフトデリート](../../.claude/rules/coding-conventions.md)

---

## 3. マイグレーション戦略（Expand-Contract パターン）

### 背景: デプロイとマイグレーションのタイミングギャップ

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

### Expand-Contract パターン

```text
Phase 1: Expand（拡張）
  マイグレーション: 後方互換な変更のみ（カラム追加 nullable、新テーブル作成等）
  デプロイ: 新コードをデプロイ（新旧スキーマ両対応）

Phase 2: Contract（収縮）
  マイグレーション: 不要になった旧カラム/テーブルの削除、NOT NULL 制約追加等
  ※ Phase 1 のデプロイが完了し、旧コードが完全に消えた後に実行
```

### 実行順序

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

### 操作別の手順テンプレート

#### カラム追加（NOT NULL）

```text
❌ 1ステップ: ALTER TABLE ADD COLUMN new_col TEXT NOT NULL
   → 旧コードが INSERT 時に new_col を渡さずエラー

✅ Expand:  ALTER TABLE ADD COLUMN new_col TEXT  (nullable)
   Deploy:  新コードは new_col を書き込み + 読み取り時は NULL を考慮
   Data:    既存レコードの new_col を埋める（バックフィル）
   Contract: ALTER TABLE ALTER COLUMN new_col SET NOT NULL
```

#### カラム名変更

```text
❌ 1ステップ: ALTER TABLE RENAME COLUMN old_name TO new_name
   → 旧コードが old_name を参照してエラー

✅ Expand:  ALTER TABLE ADD COLUMN new_name ...
   Deploy:  新コードは new_name を読み書き + old_name からのデータコピーロジック
   Data:    old_name → new_name のバックフィル
   Contract: ALTER TABLE DROP COLUMN old_name
```

#### カラム削除

```text
❌ 1ステップ: ALTER TABLE DROP COLUMN old_col
   → 旧コードが old_col を参照してエラー

✅ Deploy:  新コードから old_col の参照を全て削除（SELECT * を使わない）
   Contract: ALTER TABLE DROP COLUMN old_col
```

#### カラムの型変更

```text
❌ 1ステップ: ALTER TABLE ALTER COLUMN col TYPE new_type
   → 旧コードが旧型を前提とした処理でエラー

✅ Expand:  ALTER TABLE ADD COLUMN col_new new_type
   Deploy:  新コードは col_new を読み書き + col からの変換ロジック
   Data:    col → col_new のバックフィル
   Contract: ALTER TABLE DROP COLUMN col
             ALTER TABLE RENAME COLUMN col_new TO col（必要に応じて）
```

#### テーブル削除

```text
✅ Deploy:  新コードからテーブルへの参照を全て削除
   Contract: DROP TABLE old_table（十分な期間を置く）
```

### 禁止操作（1ステップで実行してはならない変更）

以下の操作は**必ず Expand-Contract で 2 段階に分ける**:

| 禁止操作 | 理由 | 代替手順 |
| --- | --- | --- |
| `ALTER TABLE ADD COLUMN ... NOT NULL` (デフォルトなし) | 旧コードが値を渡さず INSERT 失敗 | nullable で追加 → バックフィル → NOT NULL 追加 |
| `ALTER TABLE DROP COLUMN` | 旧コードが参照してエラー | コードから参照削除 → カラム削除 |
| `ALTER TABLE RENAME COLUMN` | 旧コードが旧名で参照してエラー | 新カラム追加 → コード移行 → 旧カラム削除 |
| `ALTER TABLE ALTER COLUMN TYPE` (非互換) | 旧コードが旧型を前提 | 新カラム追加 → コード移行 → 旧カラム削除 |
| `DROP TABLE` | 旧コードが参照してエラー | コードから参照削除 → テーブル削除 |
| `ALTER TABLE RENAME` | 旧コードが旧名で参照してエラー | 新テーブル作成 → コード移行 → 旧テーブル削除 |

### 安全な操作（1ステップで実行可能）

| 操作 | 理由 |
| --- | --- |
| `CREATE TABLE` | 旧コードは新テーブルを参照しない |
| `ADD COLUMN ... NULL` (nullable) | 旧コードは新カラムを無視できる |
| `ADD COLUMN ... DEFAULT val` | 旧コードが INSERT しても DEFAULT が適用される |
| `CREATE INDEX` | 旧コードに影響なし |
| `DROP INDEX` | クエリ性能に影響するが機能的には壊れない |
| `ADD CONSTRAINT ... NOT VALID` | 既存データを検証しない（後で `VALIDATE` を実行） |

### バックフィルの実行方法

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

### Drizzle マイグレーションファイルの命名規則

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

### CI/CD でのマイグレーション実行

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

### ロールバック方針

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

---

## 4. トランザクション管理

### 方針

複数テーブルにまたがる操作はデータベーストランザクションで原子性を保証する。
Drizzle の `db.transaction()` を使用し、Effect と統合する。

### Effect との統合パターン

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

### トランザクションが必要な操作

| 操作 | 関連テーブル | 理由 |
| --- | --- | --- |
| メッセージ送信 | `messages` INSERT + ステータス遷移 | 部分的な更新でデータ不整合 |
| 冪等性処理 | ビジネスロジック + `idempotency_keys` INSERT | 処理完了とキー記録の原子性 |
| 楽観的ロック付き更新 | 対象テーブル UPDATE + 履歴テーブル INSERT | 履歴の欠落防止 |
| コンタクト削除 | `contacts` UPDATE + `contact_channel_handles` 関連処理 | 親子の整合性 |
| 会話番号の採番 | `workspaces.next_message_number` UPDATE + `conversations` INSERT | 番号の重複防止 |

### トランザクションを使わないケース

- 単一テーブルの単一行 INSERT / UPDATE（原子性が自明）
- 読み取り専用クエリ（一覧取得、詳細取得）
- 外部サービス呼び出しを含む処理（トランザクション内で長時間保持しない）

---

## 5. ステータス遷移（StatusMachine）

requirements.md のステータス遷移表を純粋関数として実装する。

### ステータス定義

| ステータス | 内部値 | 意味 |
|-----------|--------|------|
| 新着 | `new` | まだ誰も対応していない |
| 対応中 | `in_progress` | 誰かが対応を開始した |
| 完了 | `completed` | 対応が終了した |
| 対応なし | `no_action` | 対応不要と判断した |

### 遷移表

| イベント | new → | in_progress → | completed → | no_action → |
|---------|--------|---------------|-------------|-------------|
| アサイン | in_progress | 変化なし | 変化なし | 変化なし |
| アサイン全員解除 | — | in_progress（維持） | — | — |
| スタッフ返信 | in_progress | 変化なし | in_progress | in_progress |
| 完了ボタン | completed | completed | in_progress（トグル） | completed |
| 対応なしボタン | no_action | no_action | no_action | in_progress（トグル） |
| 顧客メッセージ受信 | 変化なし | 変化なし | new（再浮上） | new（再浮上） |

### 重要ルール

1. **アサインを外しても対応中のまま** — 一度 `in_progress` になったら、アサイン解除では `new` に戻らない
2. **返信 = 対応開始** — アサインなしでも返信時点で `in_progress` に移行
3. **完了/対応なしからの再浮上** — 顧客からの再メッセージで自動的に `new` に戻す。アサイン情報は保持
4. **完了/対応なしのトグル** — 完了状態で完了を再押下 → `in_progress` に戻す。対応なしも同様
5. **スタッフ返信による復帰** — completed/no_action から直接 `in_progress` に移行

### 実装

```typescript
// packages/api/src/domain/status-machine.ts（純粋関数、Effect 不要）

export type ConversationStatus = "new" | "in_progress" | "completed" | "no_action"

export type StatusEvent =
  | "assign"
  | "unassign_all"
  | "staff_reply"
  | "complete"
  | "no_action"
  | "customer_message"

export const transition = (
  current: ConversationStatus,
  event: StatusEvent,
): ConversationStatus | null => {
  const table: Record<ConversationStatus, Partial<Record<StatusEvent, ConversationStatus>>> = {
    new: {
      assign: "in_progress",
      staff_reply: "in_progress",
      complete: "completed",
      no_action: "no_action",
    },
    in_progress: {
      // assign, unassign_all, staff_reply, customer_message → 変化なし
      complete: "completed",
      no_action: "no_action",
    },
    completed: {
      staff_reply: "in_progress",
      complete: "in_progress",  // トグル
      no_action: "no_action",
      customer_message: "new",   // 再浮上
    },
    no_action: {
      staff_reply: "in_progress",
      complete: "completed",
      no_action: "in_progress",  // トグル
      customer_message: "new",   // 再浮上
    },
  }
  return table[current]?.[event] ?? null  // null = 変化なし
}
```

---

## 6. DB スキーマ

全テナントスコープテーブルに `tenant_id` カラムを持つ。
Temporal モデルとソフトデリートの方針はセクション 1, 2 に従う。

### ID 生成方針

テーブルごとに適切な ID 型を使い分ける。

#### UUIDv7（デフォルト）

`messages` / `attachments` 以外の全テーブルの `id` カラム（および `tenant_id`）に **UUIDv7**（RFC 9562）を採用する。

- **時刻順ソート**: UUIDv7 はタイムスタンプを先頭に含むため、B-tree インデックスへの挿入が末尾追記になりページ分割を抑制する
- **PostgreSQL `uuid` 型**: ネイティブの `uuid` 型（16 bytes）でそのまま格納。変換レイヤー不要
- **外部サービスとの一貫性**: WorkOS, Stripe 等が返す ID も UUID 形式
- **生成方法**: Cloudflare Workers の `crypto.randomUUID()` は UUIDv4 のため、`uuidv7` パッケージでアプリケーション側で生成する

#### μs UNIX タイムスタンプ（messages / attachments）

`messages` および `attachments` テーブルの `id` には **マイクロ秒精度の UNIX タイムスタンプ**（`BIGINT`）を採用する。

- **理由**: messages は最も高頻度に INSERT されるテーブル。`id` がそのまま時系列順序になるため、会話内メッセージ取得が `ORDER BY id ASC` だけで済む
- **型**: `BIGINT`（8 bytes）。PostgreSQL の `BIGINT` は -9.2×10^18 〜 9.2×10^18 で μs タイムスタンプに十分
- **衝突対策**: `(tenant_id, id)` に UNIQUE 制約。同一 μs に衝突した場合はアプリケーション側で +1μs ずらす
- **エンドユーザーへの露出**: なし。ユーザーに見える識別子は会話の `message_number`（#00001）のみ
- **FK 参照**: `attachments.message_id` および `message_mentions.message_id` は `BIGINT` で参照

### スキーマドキュメント生成

Drizzle スキーマから **DBML** を自動生成し、テーブル間のリレーションを ER 図として可視化する。

- **ツール**: `drizzle-docs-generator`
- **コマンド**: `drizzle-docs generate ./src/db/schema/ -d postgresql -f dbml -o schema.dbml`
- **可視化**: 生成した DBML を dbdiagram.io にインポートして ER 図を閲覧
- **運用**: Drizzle スキーマの JSDoc コメントが DBML の Note として出力されるため、スキーマファイルにカラムの説明を JSDoc で記述する

```jsonc
// package.json (root)
{
  "scripts": {
    "db:docs": "pnpm --filter @cobox/api drizzle-docs generate ./src/db/schema/ -d postgresql -f dbml -o schema.dbml"
  }
}
```

### テーブル一覧

| テーブル | 主要カラム | Temporal | 削除方式 |
|----------|-----------|----------|----------|
| workspaces | tenant_id(PK), name, plan, next_message_number, state, recorded_at, superseded_at | uni | ソフト |
| users | id, tenant_id, workos_user_id, name, state(active/suspended/deleted), recorded_at, superseded_at | uni | ソフト |
| accounts | id, tenant_id, channel, name, config(JSONB), state(active/disconnected/deleted), recorded_at, superseded_at | uni | ソフト |
| contacts | id, tenant_id, name, furigana, company, company_furigana, email, phone, memo, state, recorded_at, superseded_at | uni | ソフト |
| contact_channel_handles | id, tenant_id, contact_id, channel, handle, is_auto_linked, recorded_at | 非temporal | 物理（親に従う） |
| contact_groups | id, tenant_id, name, description, state, recorded_at, updated_at | 非temporal | ソフト |
| contact_group_members | contact_group_id, contact_id, tenant_id | 非temporal | 物理 |
| conversations | id, tenant_id, message_number, account_id, contact_id, channel, status(new/in_progress/completed/no_action), subject, email_thread_id, state(active/deleted), recorded_at, superseded_at | uni | ソフト |
| conversation_assignees | conversation_id, user_id, tenant_id, assigned_at | 非temporal | 物理 |
| conversation_links | conversation_a_id, conversation_b_id, contact_id, tenant_id | 非temporal | 物理 |
| conversation_favorites | conversation_id, user_id, tenant_id, recorded_at | 非temporal | 物理 |
| messages | id(BIGINT μs), tenant_id, conversation_id, content, is_inbound, is_internal, sender_*, email_*, recorded_at ※channel_metadataはR2 | 非temporal（イミュータブル） | 削除不可 |
| attachments | id(BIGINT μs), tenant_id, message_id(BIGINT), name, type, url, recorded_at | 非temporal（イミュータブル） | 削除不可 |
| bulk_email_drafts | id, tenant_id, subject, body, recipient_count, created_by, state(draft/sent/deleted), recorded_at, superseded_at ※recipient詳細はR2 | uni | ソフト |
| bulk_email_sends | id, tenant_id, draft_id, total_count, success_count, failure_count, bounce_count, sent_by, state(sending/completed/failed), recorded_at, updated_at | 非temporal | ソフト |
| compose_templates | id, tenant_id, name, subject, body, sort_order, state, recorded_at, superseded_at | uni | ソフト |
| custom_variables | id, tenant_id, key, value, sort_order, recorded_at, superseded_at | uni | ソフト |
| channel_permissions | id, tenant_id, user_id, account_id, can_view, can_reply, state(active/revoked), recorded_at, superseded_at | uni | ソフト |
| subscriptions | id, tenant_id, stripe_customer_id, stripe_subscription_id, stripe_price_id, plan, status(active/trialing/past_due/canceled/unpaid), current_period_start, current_period_end, cancel_at, recorded_at, superseded_at | uni | ソフト |
| message_mentions | message_id, user_id, tenant_id | 非temporal | 物理 |
| line_message_usage | id, tenant_id, month(YYYY-MM), count, recorded_at, updated_at | 非temporal | 物理 |
| stripe_usage_reports | id, tenant_id, month(YYYY-MM), count_reported, stripe_usage_record_id, reported_at | 非temporal | 物理 |
| idempotency_keys | key, tenant_id, source, processed_at, response(JSONB) — PK: (tenant_id, key) | 非temporal | 定期パージ（30日） |

### DB 制約方針

**ユニーク制約・複合ユニーク制約・FK は DB で担保する。CHECK 制約（値の妥当性）はアプリケーション側で担保する。**

Service 層でのバリデーションに加え、DB 制約を最終防御として必ず定義する。

#### テンポラルテーブルのユニーク制約ルール

テンポラルテーブルでは履歴行が存在するため、ユニーク制約にセンチネル値カラムを含める必要がある。

- **Uni-temporal**: `superseded_at` を複合キーに追加。現行行（`superseded_at = '9999-12-31 23:59:59Z'`）の一意性を保証し、過去の履歴行とは競合しない

#### ユニーク制約・複合ユニーク制約

**Uni-temporal テーブル（`superseded_at` を含む）:**

| テーブル | 制約種別 | カラム | 目的 |
| --- | --- | --- | --- |
| `users` | UNIQUE | `(tenant_id, workos_user_id, superseded_at)` | 同一テナント内のユーザー重複防止 |
| `custom_variables` | UNIQUE | `(tenant_id, key, superseded_at)` | 同一テナント内のキー名重複防止 |
| `channel_permissions` | UNIQUE | `(tenant_id, user_id, account_id, superseded_at)` | 同一ユーザー×アカウントの重複防止 |
| `subscriptions` | UNIQUE | `(tenant_id, stripe_subscription_id, superseded_at)` | サブスクリプションの重複防止 |

**非 temporal テーブル（センチネル値なし）:**

| テーブル | 制約種別 | カラム | 目的 |
| --- | --- | --- | --- |
| `contact_channel_handles` | UNIQUE | `(tenant_id, channel, handle)` | 同一チャネルで同一ハンドルの重複防止 |
| `line_message_usage` | UNIQUE | `(tenant_id, month)` | 月次カウントの重複防止 |
| `stripe_usage_reports` | UNIQUE | `(tenant_id, month)` | 同一月の二重報告防止（冪等性の前提） |
| `contact_group_members` | PK | `(tenant_id, contact_group_id, contact_id)` | メンバーの重複防止 |
| `conversation_assignees` | PK | `(tenant_id, conversation_id, user_id)` | アサインの重複防止（`ON CONFLICT DO NOTHING` の前提） |
| `conversation_links` | PK | `(tenant_id, conversation_a_id, conversation_b_id)` | リンクの重複防止（A < B の順序） |
| `conversation_favorites` | PK | `(tenant_id, conversation_id, user_id)` | お気に入りの重複防止（`ON CONFLICT DO NOTHING` の前提） |
| `message_mentions` | PK | `(tenant_id, message_id, user_id)` | メンションの重複防止 |

#### conversation_links の contact_id 制約

`conversation_links` に `contact_id` カラムを追加し、両方の会話が同一コンタクトに属することを FK で保証する。

```sql
CREATE TABLE conversation_links (
  tenant_id       TEXT NOT NULL,
  conversation_a_id TEXT NOT NULL,
  conversation_b_id TEXT NOT NULL,
  contact_id      TEXT NOT NULL,  -- 両会話の共通 contact_id
  PRIMARY KEY (tenant_id, conversation_a_id, conversation_b_id),
  FOREIGN KEY (tenant_id, conversation_a_id) REFERENCES conversations (tenant_id, id),
  FOREIGN KEY (tenant_id, conversation_b_id) REFERENCES conversations (tenant_id, id),
  FOREIGN KEY (tenant_id, contact_id) REFERENCES contacts (tenant_id, id)
);
```

Service 層で INSERT 時に `conversation_a.contact_id === conversation_b.contact_id === contact_id` を検証する。DB の FK が最終防御として整合性を保証する。

#### 外部キー制約一覧

全ての FK は `tenant_id` を含む複合キーとし、テナント境界を超えた参照を DB レベルで防止する。

| 子テーブル | 親テーブル | FK カラム |
| --- | --- | --- |
| `conversations` | `accounts` | `(tenant_id, account_id)` |
| `conversations` | `contacts` | `(tenant_id, contact_id)` |
| `messages` | `conversations` | `(tenant_id, conversation_id)` |
| `attachments` | `messages` | `(tenant_id, message_id)` |
| `contact_channel_handles` | `contacts` | `(tenant_id, contact_id)` |
| `contact_group_members` | `contact_groups` | `(tenant_id, contact_group_id)` |
| `contact_group_members` | `contacts` | `(tenant_id, contact_id)` |
| `conversation_assignees` | `conversations` | `(tenant_id, conversation_id)` |
| `conversation_assignees` | `users` | `(tenant_id, user_id)` |
| `conversation_favorites` | `conversations` | `(tenant_id, conversation_id)` |
| `conversation_favorites` | `users` | `(tenant_id, user_id)` |
| `conversation_links` | `conversations` | `(tenant_id, conversation_a_id)` |
| `conversation_links` | `conversations` | `(tenant_id, conversation_b_id)` |
| `conversation_links` | `contacts` | `(tenant_id, contact_id)` |
| `message_mentions` | `messages` | `(tenant_id, message_id)` |
| `message_mentions` | `users` | `(tenant_id, user_id)` |
| `channel_permissions` | `users` | `(tenant_id, user_id)` |
| `channel_permissions` | `accounts` | `(tenant_id, account_id)` |
| `bulk_email_sends` | `bulk_email_drafts` | `(tenant_id, draft_id)` |

> **注意**: ソフトデリートの親レコードを参照する FK は、親の `state` が `deleted` になっても FK 違反にならない（物理削除されないため）。これはソフトデリート方式の利点の一つ。

### 設計上の判断

- **会話番号**: `workspaces.next_message_number` を `UPDATE ... RETURNING` でアトミックにインクリメント（#00001 形式）
- **メールスレッディング**: `conversations.email_thread_id` と `messages.email_message_id` / `email_in_reply_to` / `email_references` で RFC 準拠のスレッドマッチング
- **双方向リンク**: `conversation_links` は A < B の順序ペアで複合PK + `contact_id` カラムで同一コンタクト制約を DB レベルで保証
- **添付ファイル**: メタデータは DB、実ファイルは R2
- **Uni-temporal の履歴追跡**: ステータス変更・権限変更等の履歴は、各テーブル自体の uni-temporal モデルで追跡する（別途の履歴テーブルは不要）。現行行は `superseded_at = '9999-12-31 23:59:59Z'`（センチネル値）で識別。`superseded_at` は NULL ではなくセンチネル値を使用（インデックス効率のため）
- **ソフトデリート**: `state = 'deleted'` のレコードはデフォルトクエリから除外。管理・監査用途では全件取得可能
- **自動連携**: チャネル受信時に自動作成された `contact_channel_handles` は `is_auto_linked = true` で編集不可。手動追加分は `false`
- **メンション**: チーム内メモ（`is_internal = true`）の本文中の `@ユーザー名` をパースし、`message_mentions` テーブルに保存。メンションされたユーザーへの通知と「メンションされた」フォルダクエリに使用
- **自動アサイン**: フロントエンドが返信テキストボックスに1文字入力した時点で `POST /conversations/:id/self-assign` を呼び出す。既にアサインされていても自分を追加アサインする。冪等な操作（既に自分がアサイン済みの場合は何もしない）
- **会話の件名（subject）**: Email は受信メールの件名を使用。LINE/Instagram/Facebook は最初の受信メッセージ本文の先頭50文字を `subject` に設定（一覧表示用）
- **`messages` テーブルの肥大化対策**: 削除不可のイミュータブルテーブルのため最も速く肥大化する。将来的にデータ量が問題になった場合、`tenant_id` でのハッシュパーティションまたは `recorded_at`（UUIDv7 の `id`）でのレンジパーティションを検討する
- **カラム長制限**: DB の CHECK 制約は使用せず、アプリケーション側（Zod スキーマ）で最大長を定義する。初期値は `name: 100`, `subject: 200`, `content: 10,000`, `memo: 5,000` 文字を目安とするが、運用状況に応じて緩めても問題ない。Zod スキーマの変更のみで調整可能（DB マイグレーション不要）
- **JSONB カラムの型安全性**: DB に残す JSONB カラム（`accounts.config`, `idempotency_keys.response`）は、`@cobox/shared` に TypeScript 型を定義し、Repository 層で Zod バリデーションを適用する。DB には生の JSONB として格納するが、読み書き時にアプリケーション側で構造を保証する
- **JSON データの格納先方針（DB vs R2）**: DB の課金はオブジェクトストレージより高いため、以下の方針でデータの格納先を決定する:
  - **DB に残す条件**: WHERE / ORDER BY で使用する値、またはアクセス頻度が高くレイテンシが重要なデータ
  - **R2 に移す条件**: アクセス頻度が低い JSON データ、WHERE / ORDER BY に使わないデータ
  - **DB には参照キーのみ保持**: R2 に移したデータへの参照は、R2 のオブジェクトキー（例: `{tenant_id}/{table}/{record_id}.json`）で辿る。DB 側にオブジェクトキーカラムは不要（命名規則から導出可能）
  - **適用例**:
    - `accounts.config`（JSONB） → **DB 維持**（Webhook 受信のたびに参照、低レイテンシ必要）
    - `idempotency_keys.response`（JSONB） → **DB 維持**（重複リクエスト検知時に即座に返却が必要）
    - `bulk_email_drafts.recipient_group_ids` / `recipient_contact_ids`（JSONB） → **R2 に移行**（下書き編集・送信時のみ参照）。DB には送信先件数等のサマリカラムのみ保持
    - `messages.channel_metadata`（JSONB） → **R2 に移行**（メッセージ詳細表示時のみ参照）。DB には格納しない
- **非正規化の回避**: DB に導出可能な値を非正規化して保存することは最終手段とする。まず LATERAL JOIN 等の SQL パターンやキャッシュ（Cloudflare Workers KV 等）で対応を検討する。例: 会話一覧の最終メッセージ日時は `conversations` テーブルに持たず、`messages.id`（μs タイムスタンプ）から LATERAL JOIN で導出する

---

## 7. インデックス戦略

### 方針

全テナントスコープテーブルに `tenant_id` を先頭に含む複合インデックスを定義する。
カーソルベースページネーションのソートキーに対応するインデックスを用意する。

### インデックス一覧

#### conversations

```sql
-- 一覧取得（ステータスフィルタ）
CREATE INDEX idx_conversations_tenant_status
  ON conversations (tenant_id, status)
  WHERE state != 'deleted';

-- チャネルフィルタ
CREATE INDEX idx_conversations_tenant_channel
  ON conversations (tenant_id, channel)
  WHERE state != 'deleted';

-- コンタクト別会話一覧
CREATE INDEX idx_conversations_tenant_contact
  ON conversations (tenant_id, contact_id);

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
-- 会話内メッセージ一覧（時系列）+ LATERAL JOIN での最新メッセージ取得
-- id が μs タイムスタンプのため、id の順序 = 時系列順序
CREATE INDEX idx_messages_tenant_conv_id
  ON messages (tenant_id, conversation_id, id DESC);

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
