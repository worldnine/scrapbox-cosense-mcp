# scrapbox-cosense-mcp

[cosense/scrapbox](https://cosen.se) 用のMCPサーバーです。

## 機能

- `get_page`
  - cosense/Scrapboxからページコンテンツを取得
    - 入力: ページタイトル
    - 出力: ページコンテンツ、メタデータ、リンク、編集者の情報
- `list_pages`
  - プロジェクト内のページ一覧を取得（最大1000件）
    - 出力: プロジェクト内のページタイトル一覧
- `search_pages`
  - プロジェクト内のページ全体を対象とした全文検索（最大100件）
    - 基本検索、AND検索、OR検索、NOT検索をサポート
    - 出力: 検索結果のページタイトル一覧
- `create_pages`
  - ページのURLを生成
    - 入力: ページタイトルとオプションの本文テキスト
    - 出力: ブラウザで開くことができるURL

## 開発方法

依存関係のインストール:

```bash
npm install
```

サーバーのビルド:

```bash
npm run build
```

開発時の自動リビルド:

```bash
npm run watch
```

## インストール方法

```bash
git clone https://github.com/worldnine/scrapbox-cosense-mcp.git
cd scrapbox-cosense-mcp
npm install
npm run build
```

Claude Desktopで使用するには、以下のようにサーバー設定を追加してください:

MacOSの場合: `~/Library/Application\ Support/Claude/claude_desktop_config.json`
Windowsの場合: `%APPDATA%/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "scrapbox-cosense-mcp": {
      "command": "node",
      "args": ["/path/to/scrapbox-cosense-mcp/build/index.js"],
      "env": {
        "COSENSE_PROJECT_NAME": "your_project_name",
        "COSENSE_SID": "your_sid", // プライベートプロジェクトの場合は必須
        "COSENSE_PAGE_LIMIT": "25", // オプション（デフォルト: 100）
        "COSENSE_SORT_METHOD": "created", // オプション（デフォルト: "updated"）
        "SERVICE_LABEL": "scrapbox(cosense)" // オプション（デフォルト: "cosense(scrapbox)"）
      }
    }
  }
}
```

## 環境変数

このサーバーは以下の環境変数を使用します：

### 必須の環境変数

- `COSENSE_PROJECT_NAME`: プロジェクト名
- `COSENSE_SID`: Scrapbox/Cosenseの認証用セッションID（プライベートプロジェクトの場合は必須）

### オプションの環境変数

- `API_DOMAIN`: APIドメイン（デフォルト: "scrapbox.io"）
- `SERVICE_LABEL`: サービスの識別名（デフォルト: "cosense (scrapbox)"）
- `COSENSE_PAGE_LIMIT`: 初期取得時のページ数（1-1000、デフォルト: 100）
- `COSENSE_SORT_METHOD`: 初期取得時の取得ページ順（updated/created/accessed/linked/views/title、デフォルト: updated）

### 環境変数の挙動について

- **COSENSE_PROJECT_NAME**: 必須の環境変数です。未設定の場合、サーバーは起動時にエラーで終了します。
- **COSENSE_SID**: プライベートプロジェクトへのアクセスに必要です。未設定の場合、パブリックプロジェクトのみアクセス可能です。
- **API_DOMAIN**:
  - 未設定時は"scrapbox.io"を使用
  - 作者の環境では"scrapbox.io"以外の値は未検証ですが、"cosen.se"でないと動作しない環境が存在する可能性があるため念のためのオプションです。
- **COSENSE_PAGE_LIMIT**:
  - 未設定時は100を使用
  - 無効な値（数値以外や範囲外）の場合は100を使用
  - 有効範囲: 1-1000
- **COSENSE_SORT_METHOD**:
  - 未設定時は'updated'を使用
  - 無効な値の場合は'updated'を使用
  - list_pagesツールの動作には影響しません（初期リソース取得時のみ使用）

### デバッグ方法

MCPサーバーはstdioを介して通信を行うため、デバッグが難しい場合があります。[MCP Inspector](https://github.com/modelcontextprotocol/inspector)の使用を推奨します。以下のコマンドで実行できます：

```bash
npm run inspector
```

InspectorはブラウザでデバッグツールにアクセスするためのURLを提供します。
