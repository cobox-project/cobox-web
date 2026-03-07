# 実装フェーズ

> このドキュメントは [backend-architecture.md](./backend-architecture.md) から切り出したもの。

## Phase 1: 基盤構築

1. Dev Container セットアップ（PostgreSQL + 開発用コマンド）
2. pnpm モノレポ化 + パッケージ分割
3. `@cobox/shared` に型・エラー定義を抽出
4. `@cobox/api` に Hono スケルトン + Effect Layer 構造
5. Drizzle スキーマ定義 + マイグレーション + インデックス作成
6. IdempotencyService + カーソルページネーション基盤
7. CLAUDE.md にセキュリティチェックリストを記載

> **注**: Nile DB プロビジョニング、Hyperdrive 設定、R2 バケット作成等のインフラ作業は別リポジトリの Terraform で実施する。

## Phase 2: 認証 + コア CRUD

1. WorkOS 認証ミドルウェア
2. Conversation / Message / Contact の Service + Repository
3. Hono RPC ルート実装（ページネーション付き）
4. 楽観的ロックの実装
5. Next.js フロントエンドを API に接続

## Phase 3: メッセージングチャネル

1. Resend 統合（送信 + Webhook 受信 + 署名検証 + 冪等性）
2. ThreadingService（7日ウィンドウ、メールヘッダマッチング）
3. StatusMachine（requirements.md の遷移表を実装）
4. LINE Messaging API 統合（送信 + Webhook 受信 + 署名検証）
5. Instagram Graph API 統合（送信 + Webhook 受信 + 検証）
6. Facebook Messenger API 統合（送信 + Webhook 受信 + 検証）
7. ChannelGateway による統一メッセージ送信インターフェース
8. チャネル別コンタクト解決（contact_channel_handles）

## Phase 4: 機能追加

1. テンプレート + 変数補間
2. 一括メール送信（Cloudflare Queues + DLQ）
3. チーム権限管理
4. コンタクトグループ
5. ファイル添付（R2）

## Phase 5: 課金・プラン

1. Stripe Customer 作成（ワークスペース作成時）
2. subscriptions テーブル + BillingRepo + BillingService
3. Stripe Webhook 受信 + 署名検証 + 状態同期（冪等性付き）
4. Checkout / Customer Portal フロー
5. PlanContext + Feature Gate（機能制限の判定）
6. プラン超過時の制限 UI（フロントエンド）

## Phase 6: Public API / M2M

1. CallerIdentification ミドルウェア（Cookie / Bearer / API Key 判別）
2. Authentication ミドルウェアの CallerType 分岐対応
3. API Key テーブル + CRUD エンドポイント + BillingService 連携
4. API Key スコープ → CASL Ability マッピング
5. CallerType 別レート制限（Cloudflare Rate Limiting）
6. API バージョニング（`/api/v1` プレフィックス）+ フロントエンド URL 更新
7. OpenAPI SecurityScheme 整備 + Scalar ドキュメント更新
8. SDK 自動生成の検証（openapi-typescript 等）
