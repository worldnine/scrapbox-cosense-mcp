---
name: cosense
description: Interact with Cosense (Scrapbox) pages - read, search, list, create, edit, delete, and rewrite pages. Use when the user mentions Cosense, Scrapbox, or wants to work with wiki pages.
allowed-tools: Bash(npx -y scrapbox-cosense-mcp *), Bash(scrapbox-cosense-mcp *)
argument-hint: <operation or natural language request>
---

# Cosense (Scrapbox)

Cosense ページの取得・検索・作成・編集・削除・書き換え。CLI 経由で実行。

## コマンド

`npx -y scrapbox-cosense-mcp` で実行する（グローバルインストール済みなら `scrapbox-cosense-mcp` 直接でもよい）。

- `npx -y scrapbox-cosense-mcp get <title>` — ページ取得
- `npx -y scrapbox-cosense-mcp search <query>` — キーワード検索
- `npx -y scrapbox-cosense-mcp list [--sort=X --limit=N]` — ページ一覧
- `npx -y scrapbox-cosense-mcp create <title> [--body=TEXT]` — ページ作成（markdown自動変換）
- `npx -y scrapbox-cosense-mcp insert <title> --after=TEXT --text=TEXT` — 行挿入
- `npx -y scrapbox-cosense-mcp edit <title> --target=TEXT --text=TEXT [--all]` — 行置換（完全一致、複数行ブロック対応、既定は最初の1件のみ）
- `npx -y scrapbox-cosense-mcp delete-lines <title> --target=TEXT [--all]` — 行削除（完全一致、複数行ブロック対応）
- `npx -y scrapbox-cosense-mcp delete <title> [--dry-run]` — ページ削除（`COSENSE_ENABLE_DELETE=true` が必要。取り消せないので、まず `--dry-run` で確認する）
- `npx -y scrapbox-cosense-mcp rewrite <title> --body=TEXT [--dry-run]` — ページ全体の書き換え（`COSENSE_ENABLE_DELETE=true` が必要。取り消せないので、まず `--dry-run` で確認する）
- `npx -y scrapbox-cosense-mcp url <title>` — URL生成
- `npx -y scrapbox-cosense-mcp context <title> [--hop=1|2]` — 関連ページ一括取得（Smart Context）

詳細は `npx -y scrapbox-cosense-mcp <command> --help` で確認。

全コマンド共通: `--compact` でトークン効率の高い出力、`--project=NAME` でプロジェクト指定、`--json` でJSON出力。

## 環境変数の設定

### 必要な環境変数

| 変数名 | 説明 | 必須 |
|---|---|---|
| `COSENSE_PROJECT_NAME` | 対象プロジェクト名（`--project` で上書き可） | はい |
| `COSENSE_PAT` | Personal Access Token（おすすめ）。非公開プロジェクトと、create/insert/edit/delete-lines/delete/rewrite/contextに必要 | 条件付き |
| `COSENSE_SID` | セッションID（`connect.sid`）。`COSENSE_PAT`が無いときに使う | いいえ |
| `COSENSE_ENABLE_DELETE` | `true` のときだけ `delete` / `rewrite` サブコマンドが使える | いいえ |
| `COSENSE_PROJECT_ALLOW_LIST` | `--project` で指定できるプロジェクトをカンマ区切りで制限する。`COSENSE_PROJECT_NAME` は常に許可。未設定なら無制限 | いいえ |

### 永続化方法

`.claude/settings.local.json`（gitignore対象）の `env` キーに追加してください。

```json
{
  "env": {
    "COSENSE_PROJECT_NAME": "your-project-name",
    "COSENSE_PAT": "your-personal-access-token"
  }
}
```

全プロジェクト共通で使う場合は `~/.claude/settings.json` に設定することもできます。

### PATの取得方法

1. https://scrapbox.io/settings/personal-access-tokens でトークンを発行
2. `COSENSE_PAT`に設定

公式CLIの`cosense login`を済ませていれば、`~/.cosense/settings.json`のトークンを使うので設定は要らない。SIDを使う場合の取り方は[認証](https://github.com/worldnine/scrapbox-cosense-mcp/blob/main/docs/authentication.md)を参照。
