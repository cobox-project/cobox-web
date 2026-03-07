# Observability（OpenTelemetry）

> このドキュメントは [backend-architecture.md](../../.claude/rules/backend-architecture.md) から切り出した詳細仕様。

---

## 方針

アプリケーション全体で OpenTelemetry（OTel）を導入し、トレース・メトリクス・ログを標準化する。
アプリケーションコードは OTel SDK のみに依存し、エクスポート先の変更に影響されない設計とする。

## 導入範囲

| シグナル | 内容 | 実装箇所 |
|----------|------|----------|
| トレース | リクエスト全体の処理フロー（ミドルウェア→Service→Repository→DB） | Hono ミドルウェア + Effect span |
| メトリクス | リクエスト数、レスポンス時間、エラー率 | Hono ミドルウェア |
| ログ | 構造化ログ（JSON 形式、trace_id 付与） | 全レイヤー |

## Cloudflare Workers での制約

Workers は長時間バックグラウンド処理ができないため、テレメトリデータのエクスポートには以下の方式を採用する:

- **Cloudflare Workers Trace Events** を利用し、`waitUntil()` でリクエスト処理後にテレメトリを非同期送信
- Cloudflare Workers は OTLP エクスポートをネイティブサポートしており、OTLP/HTTP で直接 Grafana Cloud に送信する（OTel Collector の自前ホスティングは不要）

## Effect との統合

Effect の `Span` / `withSpan` を使用し、Service / Repository の各操作にトレーシングを付与する。
Effect の span は OTel span にブリッジ可能。

## 属性の標準化

全 span / ログに以下の属性を付与する:

- `tenant.id` — テナント識別（`RequestContext` から取得）
- `user.id` — ユーザー識別
- `http.method`, `http.route`, `http.status_code` — HTTP コンテキスト

> **PII マスキング**: ログ・トレースにメールアドレス、メッセージ本文等の個人情報を含めない。

## テレメトリ基盤: Grafana Cloud

テレメトリデータのエクスポート先として **Grafana Cloud**（Free tier）を採用する。

**選定理由:**
- Cloudflare Workers からの OTLP エクスポートを公式サポート
- Free tier でメトリクス（10,000シリーズ）、ログ（50GB）、トレース（50GB）、**アラート機能**が利用可能
- Datadog 等の高額サービスを避けつつ、本番運用に必要な監視・アラートを実現

**データフロー:**

```
Workers (OTel SDK)
  ↓ OTLP/HTTP (waitUntil)
Grafana Cloud
  ├── Prometheus (メトリクス)
  ├── Loki (ログ)
  ├── Tempo (トレース)
  └── Grafana Alerting (アラート)
```

**設定するアラートルール:**

| アラート | 条件 | 重要度 |
|---------|------|--------|
| Cron バッチ未実行 | `stripe_usage_reports` に月初3日経過しても当月レコードがない | Critical |
| Workers エラー率上昇 | エラー率が 5% を超過（5分間平均） | Warning |
| Webhook 処理失敗 | Webhook エンドポイントのエラー率上昇 | Warning |
| DB レイテンシ劣化 | Hyperdrive 経由のクエリ p95 が閾値超過 | Warning |
| Queue DLQ 滞留 | 一括メール送信の DLQ にメッセージが滞留 | Critical |

> アラートルールは運用開始後に閾値を調整する。上記は初期設定の目安。
