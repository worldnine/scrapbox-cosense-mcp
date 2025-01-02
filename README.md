# scrapbox-cosense-mcp

[cosense/scrapbox](https://cosen.se) 用のMCPサーバーです。

## 機能

- `get_page`
  - cosense/Scrapboxからベージコンテンツを取得
    - Input: ページタイトル
    - Returns: ページコンテンツ、メタデータ、リンク、編集者の情報
- `list_pages`
  - プロジェクト内のページを一覧表示（最大1000件）
    - Returns: プロジェクト内のページタイトルの一覧（最大1000件）
- `search_pages`
  - プロジェクト内のページ全体を対象とした全文検索（最大100件）
    - Supports 基本検索、AND検索、OR検索、NOT検索をサポート
    - Returns: 検索結果のページタイトルの一覧（最大100件）
- `create_pages`
  - Generate URL for a page
    - Input: page title and optional body text
    - Returns: URL that can be opened in browser

## Developmentbbbb

Install dependencies:

```bash
npm install
```

Build the server:

```bash
npm run build
```

For development with auto-rebuild:

```bash
npm run watch
```

## Installation

```bash
git clone https://github.com/funwarioisii/cosense-mcp-server.git
cd cosense-mcp-server
npm run install
npm run build
```

To use with Claude Desktop, add the server config:

On MacOS: `~/Library/Application\ Support/Claude/claude_desktop_config.json`
On Windows: `%APPDATA%/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "scrapbox-cosense-mcp": {
      "command": "node",
      "args": ["/path/to/cosense-mcp-server/build/index.js"],
      "env": {
        "COSENSE_PROJECT_NAME": "your_project_name",
        "COSENSE_SID": "your_sid",
        "API_DOMAIN": "scrapbox.io"
      }
    }
  }
}
```

`COSENSE_SID` is optional.
If you want to use this server towards a private project, you need to set `COSENSE_SID`.

`API_DOMAIN` is optional. If not set, it defaults to "cosen.se". Setting it to "scrapbox.io" will change both the API domain and the service name handled by this server.

Note: This configuration has only been tested and verified to work with "scrapbox.io" in my environment.

## 環境変数

このサーバーは以下の環境変数で動作をカスタマイズできます：

| 環境変数 | 説明 | デフォルト値 | 有効な値 |
|----------|------|--------------|----------|
| COSENSE_PROJECT_NAME | Scrapboxのプロジェクト名 | - | 必須（未設定時は起動エラー） |
| COSENSE_SID | Scrapboxの認証Cookie | なし | オプション（未設定時は非認証で動作） |
| COSENSE_PAGE_LIMIT | 初期リソース取得時のページ数上限 | 100 | 1-1000（無効な値の場合はデフォルト値を使用） |
| COSENSE_SORT_METHOD | 初期リソース取得時の並び順 | created | updated, created, accessed, linked, views, title（無効な値の場合はデフォルト値を使用） |
| API_DOMAIN | APIのドメイン | scrapbox.io | scrapbox.io, cosen.se |

### 環境変数の挙動について

- **COSENSE_PROJECT_NAME**: 必須の環境変数です。未設定の場合、サーバーは起動時にエラーで終了します。
- **COSENSE_SID**: オプションです。未設定の場合、パブリックプロジェクトのみアクセス可能です。
- **COSENSE_PAGE_LIMIT**:
  - 未設定時は100を使用
  - 無効な値（数値以外や範囲外）の場合は100を使用
  - 有効範囲: 1-1000
- **COSENSE_SORT_METHOD**:
  - 未設定時は'created'を使用
  - 無効な値の場合は'created'を使用
  - list_pagesツールの動作には影響しません（初期リソース取得時のみ使用）

### Debugging

Since MCP servers communicate over stdio, debugging can be challenging. We recommend using the [MCP Inspector](https://github.com/modelcontextprotocol/inspector), which is available as a package script:

```bash
npm run inspector
```

The Inspector will provide a URL to access debugging tools in your browser.
