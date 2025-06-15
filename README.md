# scrapbox-cosense-mcp

[![MseeP.ai Security Assessment Badge](https://mseep.net/pr/worldnine-scrapbox-cosense-mcp-badge.png)](https://mseep.ai/app/worldnine-scrapbox-cosense-mcp)

<a href="https://glama.ai/mcp/servers/8huixkwpe2"><img width="380" height="200" src="https://glama.ai/mcp/servers/8huixkwpe2/badge" alt="Scrapbox Cosense Server MCP server" /></a>


[English](#english) | [日本語](#日本語)

## English

MCP server for [cosense/scrapbox](https://cosen.se).

### Features

- `get_page`
  - Get page content from cosense/Scrapbox
    - Input: Page title, optional project name
    - Output: Page content, metadata, links, and editor information
- `list_pages`
  - Browse and list pages with flexible sorting and pagination
    - Purpose: Discover pages by recency, popularity, or alphabetically
    - Input: Sorting options, pagination, optional project name
    - Output: Page metadata and first 5 lines of content
    - Max: 1000 pages per request
    - Sorting: updated, created, accessed, linked, views, title
- `search_pages`
  - Search for content within pages using keywords or phrases
    - Purpose: Find pages containing specific keywords or phrases
    - Input: Search query, optional project name
    - Output: Matching pages with highlighted search terms and content snippets
    - Max: 100 results (API limitation)
    - Supports: basic search, AND search, exclude search, exact phrases
- `create_page`
  - Create a new page in the project
    - Input: Page title, optional markdown body text, optional project name
    - Output: Returns the page creation URL without opening browser
    - Note: Markdown content is converted to Scrapbox format
    - Feature: Automatically converts numbered lists to bullet lists (configurable)
    - Feature: Option to remove title from body to avoid duplication
- `get_page_url`
  - Generate URL for a page in the project
    - Input: Page title, optional project name
    - Output: Direct URL to the specified page

### Installation

```bash
git clone https://github.com/worldnine/scrapbox-cosense-mcp.git
cd scrapbox-cosense-mcp
npm install
npm run build
```

### Basic Setup

To use with Claude Desktop, add the server configuration as follows:

For MacOS: `~/Library/Application\ Support/Claude/claude_desktop_config.json`
For Windows: `%APPDATA%/Claude/claude_desktop_config.json`

**Single Project Configuration:**
```json
{
  "mcpServers": {
    "scrapbox-cosense-mcp": {
      "command": "npx",
      "args": ["github:worldnine/scrapbox-cosense-mcp"],
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

### Usage Examples

Once configured, you can use the tools in Claude:

```
# Get a specific page
Please get the content of page "Meeting Notes" using get_page.

# List recent pages  
Please list the 10 most recently updated pages using list_pages.

# Search for content
Please search for pages containing "JavaScript tutorial" using search_pages.

# Create a new page
Please create a new page titled "Today's Learning" using create_page.

# Get page URL
Please get the URL for page "Project Plan" using get_page_url.
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
- `COSENSE_TOOL_SUFFIX`: Tool name suffix for multiple server instances (e.g., "main" creates "get_page_main")
- `COSENSE_CONVERT_NUMBERED_LISTS`: Convert numbered lists to bullet lists in Markdown (true/false, default: true)
- `COSENSE_REMOVE_TITLE_FROM_BODY`: Remove the first heading from the body when creating pages (true/false, default: true)

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

### Multiple Project Support (Advanced)

#### Method 1: Single Server with Optional Parameters

All tools support an optional `projectName` parameter to target different projects from a single server:

- **Default behavior**: Uses `COSENSE_PROJECT_NAME` environment variable when no project is specified
- **Multi-project usage**: Specify `projectName` parameter to access different projects  
- **Backward compatibility**: Existing configurations work unchanged

**Usage Examples:**

```
# Get page from default project
Please get the content of page "Meeting Notes" using get_page.

# Get page from specific project  
Please get the content of page "Design Guidelines" from project "help-ja" using get_page.

# Search in different project
Please search for pages containing "API documentation" in project "developer-docs" using search_pages.

# Create page in specific project
Please create a new page titled "Weekly Report" in project "team-updates" using create_page.
```

**Important Limitations:**

This approach works best with public projects or projects that share the same authentication. For multiple private projects with different access credentials, use Method 2 below.

#### Method 2: Multiple MCP Server Instances (Recommended for Private Projects)

For best user experience with multiple private projects, run separate MCP server instances for each project:

```json
{
  "mcpServers": {
    "main-scrapbox": {
      "command": "npx",
      "args": ["github:worldnine/scrapbox-cosense-mcp"],
      "env": {
        "COSENSE_PROJECT_NAME": "main-project",        // Actual project name for API calls
        "COSENSE_SID": "s:main_sid_here...",           // Session ID for this project
        "COSENSE_TOOL_SUFFIX": "main",                 // Creates tools like get_page_main
        "SERVICE_LABEL": "Main Scrapbox"               // Human-readable label in tool descriptions
      }
    },
    "team-cosense": {
      "command": "npx",
      "args": ["github:worldnine/scrapbox-cosense-mcp"],
      "env": {
        "COSENSE_PROJECT_NAME": "team-workspace",      // Actual project name for API calls
        "COSENSE_SID": "s:team_sid_here...",           // Session ID for this project
        "COSENSE_TOOL_SUFFIX": "team",                 // Creates tools like get_page_team
        "SERVICE_LABEL": "Team Cosense"                // Human-readable label in tool descriptions
      }
    }
  }
}
```

**Key Configuration Points:**
- **COSENSE_PROJECT_NAME**: The actual project name used in API calls (e.g., `scrapbox.io/main-project`)
- **SERVICE_LABEL**: Display name shown in tool descriptions (e.g., "Create page on Main Scrapbox")
- **COSENSE_TOOL_SUFFIX**: Creates unique tool names like `get_page_main` and `get_page_team`
- **Different service names**: Using "Scrapbox" and "Cosense" helps distinguish between projects

This creates tools like `get_page_main`, `list_pages_main`, `get_page_team`, `list_pages_team`, allowing LLMs to automatically select the appropriate project.

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

### Debugging

Since MCP servers communicate via stdio, debugging can be challenging. This server includes comprehensive debug logging to help troubleshoot issues.

#### Debug Logs

The server outputs detailed debug information to help identify configuration and API issues:

- **Server Configuration**: Project name, tool suffix, SID presence, limits
- **Tool Generation**: List of generated tools with their names
- **Tool Calls**: Requested vs normalized tool names, arguments
- **API Requests**: URLs, project names, authentication status
- **API Errors**: Detailed error information with context

#### Using MCP Inspector

Using [MCP Inspector](https://github.com/modelcontextprotocol/inspector) is recommended for interactive debugging:

```bash
npm run inspector
```

The Inspector provides a URL to access debugging tools in the browser.

#### Troubleshooting Multiple Servers

When running multiple server instances, check the debug logs for:

1. **Tool Name Conflicts**: Ensure `COSENSE_TOOL_SUFFIX` is set differently for each server
2. **API Access**: Verify SID authentication works for each project
3. **Project Names**: Confirm project names are correctly configured

## 日本語

[cosense/scrapbox](https://cosen.se) 用のMCPサーバーです。

## 機能

- `get_page`
  - cosense/Scrapboxからページコンテンツを取得
    - 入力: ページタイトル、オプションのプロジェクト名
    - 出力: ページコンテンツ、メタデータ、リンク、編集者の情報
- `list_pages`
  - 柔軟なソートとページネーションによるページ一覧の閲覧
    - 用途: 最新性、人気度、アルファベット順でページを発見
    - 入力: ソートオプション、ページネーション、オプションのプロジェクト名
    - 出力: ページのメタデータと冒頭5行の内容
    - 最大: 1リクエスト当たり1000件
    - ソート: updated, created, accessed, linked, views, title
- `search_pages`
  - キーワードやフレーズを使用したページ内コンテンツの検索
    - 用途: 特定のキーワードやフレーズを含むページを発見
    - 入力: 検索クエリ、オプションのプロジェクト名
    - 出力: マッチしたページとハイライトされた検索語句、コンテンツスニペット
    - 最大: 100件（API制限）
    - サポート: 基本検索、AND検索、除外検索、完全一致フレーズ
- `create_page`
  - プロジェクトに新しいページを作成
    - 入力: ページタイトル、オプションのマークダウン本文テキスト、オプションのプロジェクト名
    - 出力: ブラウザを開かずにページ作成URLを返す
    - 注意: マークダウンコンテンツはScrapbox形式に変換されます
    - 機能: 数字付きリストを自動的に箇条書きに変換（設定可能）
    - 機能: タイトル重複を避けるため本文からタイトルを除去するオプション
- `get_page_url`
  - プロジェクト内のページのURLを生成
    - 入力: ページタイトル、オプションのプロジェクト名
    - 出力: 指定されたページへの直接URL

## インストール方法

```bash
git clone https://github.com/worldnine/scrapbox-cosense-mcp.git
cd scrapbox-cosense-mcp
npm install
npm run build
```

## 基本設定

Claude Desktopで使用するには、以下のようにサーバー設定を追加してください:

MacOSの場合: `~/Library/Application\ Support/Claude/claude_desktop_config.json`
Windowsの場合: `%APPDATA%/Claude/claude_desktop_config.json`

**単一プロジェクト設定:**
```json
{
  "mcpServers": {
    "scrapbox-cosense-mcp": {
      "command": "npx",
      "args": ["github:worldnine/scrapbox-cosense-mcp"],
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

## 使用例

設定完了後、Claudeで以下のようにツールを使用できます：

```
# 特定のページを取得
get_page を使用してページ「会議メモ」の内容を取得してください。

# 最近のページ一覧
list_pages を使用して最近更新された10件のページを一覧表示してください。

# コンテンツ検索
search_pages を使用して「JavaScript チュートリアル」を含むページを検索してください。

# 新しいページを作成
create_page を使用して「今日の学び」というタイトルでページを作成してください。

# ページURLを取得
get_page_url を使用してページ「プロジェクト計画」のURLを取得してください。
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
- `COSENSE_TOOL_SUFFIX`: 複数サーバーインスタンス用のツール名サフィックス（例："main"で"get_page_main"が作成されます）

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

## 複数プロジェクト対応（高度な機能）

### 方法1: オプショナルパラメータを使用した単一サーバー

すべてのツールで、単一サーバーから異なるプロジェクトを対象とするオプションの`projectName`パラメータをサポートしています：

- **デフォルト動作**: プロジェクトが指定されていない場合は`COSENSE_PROJECT_NAME`環境変数を使用
- **複数プロジェクト使用**: `projectName`パラメータを指定して異なるプロジェクトにアクセス
- **後方互換性**: 既存の設定は変更なしで動作

**使用例:**

```
# デフォルトプロジェクトからページを取得
get_page を使用してページ「会議メモ」の内容を取得してください。

# 特定のプロジェクトからページを取得  
get_page を使用して、プロジェクト名「help-ja」からページ「使い方」の内容を取得してください。

# 異なるプロジェクトでページを検索
search_pages を使用して、プロジェクト名「developer-docs」で「API ドキュメント」を含むページを検索してください。

# 特定のプロジェクトにページを作成
create_page を使用して、プロジェクト名「team-updates」に「週次レポート」というタイトルでページを作成してください。
```

**重要な制限事項:**

この方法は、パブリックプロジェクトや同じ認証情報を共有するプロジェクトで最も効果的です。異なるアクセス認証情報を持つ複数のプライベートプロジェクトには、以下の方法2をご利用ください。

### 方法2: 複数MCPサーバーインスタンス（プライベートプロジェクト推奨）

複数のプライベートプロジェクトで最良のユーザー体験を得るには、プロジェクトごとに別々のMCPサーバーインスタンスを実行します：

```json
{
  "mcpServers": {
    "main-scrapbox": {
      "command": "npx",
      "args": ["github:worldnine/scrapbox-cosense-mcp"],
      "env": {
        "COSENSE_PROJECT_NAME": "main-project",        // API呼び出しで使用される実際のプロジェクト名
        "COSENSE_SID": "s:main_sid_here...",           // このプロジェクト用のセッションID
        "COSENSE_TOOL_SUFFIX": "main",                 // get_page_main のようなツール名を作成
        "SERVICE_LABEL": "Main Scrapbox"               // ツール説明で表示される人間向けの名前
      }
    },
    "team-cosense": {
      "command": "npx",
      "args": ["github:worldnine/scrapbox-cosense-mcp"],
      "env": {
        "COSENSE_PROJECT_NAME": "team-workspace",      // API呼び出しで使用される実際のプロジェクト名
        "COSENSE_SID": "s:team_sid_here...",           // このプロジェクト用のセッションID
        "COSENSE_TOOL_SUFFIX": "team",                 // get_page_team のようなツール名を作成
        "SERVICE_LABEL": "Team Cosense"                // ツール説明で表示される人間向けの名前
      }
    }
  }
}
```

**設定のポイント:**
- **COSENSE_PROJECT_NAME**: API呼び出しで使用される実際のプロジェクト名（例: `scrapbox.io/main-project`）
- **SERVICE_LABEL**: ツール説明で表示される名前（例: 「Main Scrapboxでページを作成」）
- **COSENSE_TOOL_SUFFIX**: `get_page_main` や `get_page_team` のような固有のツール名を作成
- **サービス名の使い分け**: 「Scrapbox」と「Cosense」を使い分けることでプロジェクトを区別

これにより `get_page_main`、`list_pages_main`、`get_page_team`、`list_pages_team` のようなツールが作成され、LLMが自動的に適切なプロジェクトを選択できるようになります。

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

### デバッグ方法

MCPサーバーはstdioを介して通信を行うため、デバッグが難しい場合があります。[MCP Inspector](https://github.com/modelcontextprotocol/inspector)の使用を推奨します。以下のコマンドで実行できます：

```bash
npm run inspector
```

InspectorはブラウザでデバッグツールにアクセスするためのURLを提供します。
