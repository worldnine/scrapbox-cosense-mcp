---
name: scrapbox
description: Interact with Scrapbox/Cosense pages - read, search, list, create, and edit pages. Use when the user mentions Scrapbox, Cosense, or wants to work with wiki pages.
allowed-tools: Bash(scrapbox-cosense-mcp *)
argument-hint: <operation or natural language request>
---

# Scrapbox/Cosense

Scrapbox (Cosense) のページ操作を行うスキルです。CLI 経由で全操作を実行します。

## コマンド一覧

```
scrapbox-cosense-mcp get <title>                      ページ内容を取得
scrapbox-cosense-mcp search <query>                   キーワード検索（最大100件）
scrapbox-cosense-mcp list [options]                    ページ一覧を取得
scrapbox-cosense-mcp create <title> [--body=TEXT]      新規ページ作成
scrapbox-cosense-mcp insert <title> --after=TEXT --text=TEXT  行の挿入
scrapbox-cosense-mcp url <title>                       ページURLを生成
```

## 使い方

ユーザーのリクエストに応じて適切なコマンドを選択・実行してください。

**ページを読む:**
```bash
scrapbox-cosense-mcp get "ページタイトル"
```

**検索する:**
```bash
scrapbox-cosense-mcp search "キーワード"
```
AND検索（複数語）、除外（-word）、完全一致（"phrase"）に対応。

**一覧を見る:**
```bash
scrapbox-cosense-mcp list --sort=updated --limit=20
```
ソート: updated, created, accessed, linked, views, title

**ページを作成する:**
```bash
scrapbox-cosense-mcp create "新ページ" --body="本文（markdown）"
```
本文は markdown で記述すると自動的に Scrapbox 記法に変換されます。タイトルを本文に重複させないでください。`--format=scrapbox` で Scrapbox 記法をそのまま使えます。

**テキストを挿入する:**
```bash
scrapbox-cosense-mcp insert "ページ名" --after="対象行のテキスト" --text="挿入するテキスト"
```
対象行が見つからない場合はページ末尾に追加されます。

**URLを取得する:**
```bash
scrapbox-cosense-mcp url "ページタイトル"
```

## 共通オプション

- `--project=NAME` : プロジェクト名を上書き（デフォルト: COSENSE_PROJECT_NAME 環境変数）
- `--json` : JSON 形式で出力
- `--help` : ヘルプを表示

## 注意事項

- create と insert には COSENSE_SID 環境変数が必要です
- search は API の制限で最大100件までです
- ファイルからの内容読み込み: `--body-file=PATH` / `--text-file=PATH`
