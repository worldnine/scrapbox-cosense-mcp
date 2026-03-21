---
name: scrapbox
description: Interact with Scrapbox/Cosense pages - read, search, list, create, and edit pages. Use when the user mentions Scrapbox, Cosense, or wants to work with wiki pages.
allowed-tools: Bash(scrapbox-cosense-mcp *)
argument-hint: <operation or natural language request>
---

# Scrapbox/Cosense

Scrapbox ページの取得・検索・作成・編集。CLI 経由で実行。

## コマンド

- `scrapbox-cosense-mcp get <title>` — ページ取得
- `scrapbox-cosense-mcp search <query>` — キーワード検索
- `scrapbox-cosense-mcp list [--sort=X --limit=N]` — ページ一覧
- `scrapbox-cosense-mcp create <title> [--body=TEXT]` — ページ作成（markdown自動変換）
- `scrapbox-cosense-mcp insert <title> --after=TEXT --text=TEXT` — 行挿入
- `scrapbox-cosense-mcp url <title>` — URL生成

詳細は `scrapbox-cosense-mcp <command> --help` で確認。

全コマンド共通: `--compact` でトークン効率の高い出力、`--project=NAME` でプロジェクト指定、`--json` でJSON出力。

## 環境変数の設定

### 必要な環境変数

| 変数名 | 説明 | 必須 |
|---|---|---|
| `COSENSE_PROJECT_NAME` | 対象プロジェクト名（`--project` で上書き可） | はい |
| `COSENSE_SID` | セッションID（プライベートプロジェクト、create/insert 操作に必要） | 条件付き |

### 永続化方法

Claude Code のローカル設定（gitignore 対象）の `env` キーに追加してください。

```json
{
  "env": {
    "COSENSE_PROJECT_NAME": "your-project-name",
    "COSENSE_SID": "s:your-session-id"
  }
}
```

### SID の取得方法

1. ブラウザで Scrapbox/Cosense にログイン
2. 開発者ツール → Application → Cookies
3. `connect.sid` の値をコピー
