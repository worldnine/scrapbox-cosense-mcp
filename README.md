# scrapbox-cosense-mcp

[English](#english) | [日本語](#日本語)

## English

[![smithery badge](https://smithery.ai/badge/scrapbox-cosense-mcp)](https://smithery.ai/server/scrapbox-cosense-mcp)

MCP server for [cosense/scrapbox](https://cosen.se).

<a href="https://glama.ai/mcp/servers/8huixkwpe2"><img width="380" height="200" src="https://glama.ai/mcp/servers/8huixkwpe2/badge" alt="Scrapbox Cosense Server MCP server" /></a>

### Features

- `get_page`
  - Get page content from cosense/Scrapbox
    - Input: Page title
    - Output: Page content, metadata, links, and editor information
- `list_pages`
  - Get a list of pages in the project (max 1000 pages)
    - Output: List of page titles in the project
- `search_pages`
  - Full-text search across all pages in the project (max 100 pages)
    - Supports basic search, AND search, OR search, and NOT search
    - Output: List of page titles in search results
- `create_pages`
  - Generate page URLs
    - Input: Page title and optional body text
    - Output: URL that can be opened in a browser

### Development

Install dependencies:

```bash
npm install
```

Build the server:

```bash
npm run build
```

Auto-rebuild during development:

```bash
npm run watch
```

### Installation

### Installing via Smithery

To install Scrapbox Cosense for Claude Desktop automatically via [Smithery](https://smithery.ai/server/scrapbox-cosense-mcp):

```bash
npx -y @smithery/cli install scrapbox-cosense-mcp --client claude
```

### Installing Manually
```bash
git clone https://github.com/worldnine/scrapbox-cosense-mcp.git
cd scrapbox-cosense-mcp
npm install
npm run build
```

To use with Claude Desktop, add the server configuration as follows:

For MacOS: `~/Library/Application\ Support/Claude/claude_desktop_config.json`
For Windows: `%APPDATA%/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "scrapbox-cosense-mcp": {
      "command": "node",
      "args": ["/path/to/scrapbox-cosense-mcp/build/index.js"],
      "env": {
        "COSENSE_PROJECT_NAME": "your_project_name",
        "COSENSE_SID": "your_sid", // Required for private projects
        "COSENSE_PAGE_LIMIT": "25", // Optional (default: 100)
        "COSENSE_SORT_METHOD": "created", // Optional (default: "updated")
        "SERVICE_LABEL": "scrapbox(cosense)" // Optional (default: "cosense(scrapbox)")
      }
    }
  }
}
```

### Environment Variables

This server uses the following environment variables:

#### Required Environment Variables

- `COSENSE_PROJECT_NAME`: Project name
- `COSENSE_SID`: Session ID for Scrapbox/Cosense authentication (required for private projects)

#### Optional Environment Variables

- `API_DOMAIN`: API domain (default: "scrapbox.io")
- `SERVICE_LABEL`: Service identifier (default: "cosense (scrapbox)")
- `COSENSE_PAGE_LIMIT`: Initial page fetch limit (1-1000, default: 100)
- `COSENSE_SORT_METHOD`: Initial page fetch order (updated/created/accessed/linked/views/title, default: updated)

#### Environment Variable Behavior

- **COSENSE_PROJECT_NAME**: Required environment variable. Server will exit with an error if not set.
- **COSENSE_SID**: Required for accessing private projects. If not set, only public projects are accessible.
- **API_DOMAIN**:
  - Uses "scrapbox.io" if not set
  - While unverified with domains other than "scrapbox.io" in the author's environment, this option exists in case some environments require "cosen.se"
- **COSENSE_PAGE_LIMIT**:
  - Uses 100 if not set
  - Uses 100 if value is invalid (non-numeric or out of range)
  - Valid range: 1-1000
- **COSENSE_SORT_METHOD**:
  - Uses 'updated' if not set
  - Uses 'updated' if value is invalid
  - Does not affect list_pages tool behavior (only used for initial resource fetch)

### Debugging

Since MCP servers communicate via stdio, debugging can be challenging. Using [MCP Inspector](https://github.com/modelcontextprotocol/inspector) is recommended. You can run it with:

```bash
npm run inspector
```

The Inspector provides a URL to access debugging tools in the browser.

## 日本語

[![smithery badge](https://smithery.ai/badge/scrapbox-cosense-mcp)](https://smithery.ai/server/scrapbox-cosense-mcp)

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

### Smitheryを通したインストール

[Smithery](https://smithery.ai/server/scrapbox-cosense-mcp)でClaude Desktop用にScrapbox Cosenseを自動インストールするためには：

```bash
npx -y @smithery/cli install scrapbox-cosense-mcp --client claude
```

### 手動インストール

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
