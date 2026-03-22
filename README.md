# scrapbox-cosense-mcp

[日本語ドキュメント / Japanese](./docs/README_ja.md)

## Overview

MCP server for [Cosense (formerly Scrapbox)](https://cosen.se).

| Tool | Description | Auth Required |
|------|-------------|:---:|
| `get_page` | Get page content, metadata, and links | For private projects |
| `list_pages` | Browse pages with sorting and pagination (max 1000) | For private projects |
| `search_pages` | Full-text search with keyword highlighting (max 100 results) | For private projects |
| `create_page` | Create a page via WebSocket API with Markdown/Scrapbox body | Yes |
| `get_page_url` | Generate direct URL for a page | No |
| `insert_lines` | Insert text after a specified line in a page | Yes |

`create_page` and `insert_lines` support a `format` parameter (`"markdown"` or `"scrapbox"`) to control content conversion.

## Quick Start

### Desktop Extension (.mcpb) — Easiest

1. Download `scrapbox-cosense-mcp.mcpb` from [GitHub Releases](https://github.com/worldnine/scrapbox-cosense-mcp/releases)
2. Double-click — Claude Desktop opens an install dialog
3. Enter your project name (and Session ID for private projects)

### Claude Code Plugin

1. Add the marketplace:
   ```
   /plugin marketplace add worldnine/scrapbox-cosense-mcp
   ```
2. Install the plugin:
   ```
   /plugin install scrapbox-cosense@worldnine-scrapbox-cosense-mcp
   ```

The plugin includes MCP server configuration and a `/cosense` skill for CLI operations.

### Claude Code (Manual MCP Setup)

If you prefer manual configuration over the plugin:

```bash
claude mcp add scrapbox-cosense-mcp \
  -e COSENSE_PROJECT_NAME=your_project \
  -e COSENSE_SID=your_sid \
  -- npx -y scrapbox-cosense-mcp
```

### Claude Desktop / Other MCP Clients

Add to your config file:

| Client | Config File |
|--------|-------------|
| Claude Desktop (macOS) | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Claude Desktop (Windows) | `%APPDATA%/Claude/claude_desktop_config.json` |
| Cursor | `.cursor/mcp.json` (project root) |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` |

```json
{
  "mcpServers": {
    "scrapbox-cosense-mcp": {
      "command": "npx",
      "args": ["-y", "scrapbox-cosense-mcp"],
      "env": {
        "COSENSE_PROJECT_NAME": "your_project_name",
        "COSENSE_SID": "your_sid"
      }
    }
  }
}
```

### Build from Source

```bash
git clone https://github.com/worldnine/scrapbox-cosense-mcp.git
cd scrapbox-cosense-mcp
npm install && npm run build
```

## Configuration

### Required

| Variable | Description |
|----------|-------------|
| `COSENSE_PROJECT_NAME` | Your Scrapbox/Cosense project name |
| `COSENSE_SID` | Session ID (`connect.sid` cookie) for private projects — [How to get it](./docs/authentication.md) |

### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `API_DOMAIN` | `scrapbox.io` | API domain |
| `SERVICE_LABEL` | `cosense (scrapbox)` | Display name in tool descriptions |
| `COSENSE_PAGE_LIMIT` | `100` | Initial page fetch limit (1–1000) |
| `COSENSE_SORT_METHOD` | `updated` | Initial sort: updated, created, accessed, linked, views, title |
| `COSENSE_TOOL_SUFFIX` | — | Tool name suffix for multiple instances (e.g. `main` → `get_page_main`) |
| `COSENSE_CONVERT_NUMBERED_LISTS` | `false` | Convert numbered lists to bullet lists in Markdown conversion |
| `COSENSE_EXCLUDE_PINNED` | `false` | Exclude pinned pages from initial resource list |

## CLI Usage

The same binary also works as a standalone CLI:

```bash
scrapbox-cosense-mcp get "Page Title"
scrapbox-cosense-mcp search "keyword"
scrapbox-cosense-mcp list --sort=updated --limit=20
scrapbox-cosense-mcp create "New Page" --body="Markdown content"
scrapbox-cosense-mcp insert "Page" --after="target line" --text="new text"
scrapbox-cosense-mcp url "Page Title"
```

| Flag | Description |
|------|-------------|
| `--compact` | Token-efficient compact output (recommended for AI agents) |
| `--project=NAME` | Override project name |
| `--json` | Output as JSON |
| `--help` | Show help (supports `<command> --help` for details) |

## Multiple Projects

All tools accept an optional `projectName` parameter to target a different project from a single server. For multiple private projects with different credentials, run separate server instances with `COSENSE_TOOL_SUFFIX`.

See [docs/multiple-projects.md](./docs/multiple-projects.md) for detailed configuration examples.

## Development

| Command | Description |
|---------|-------------|
| `npm run build` | Build (TypeScript → JavaScript) |
| `npm run watch` | Auto-rebuild during development |
| `npm test` | Run test suite |
| `npm run lint` | Run ESLint |
| `npm run inspector` | Debug with MCP Inspector |

### Contributing

1. Create a feature branch from `main`
2. Add tests for your changes
3. Run `npm run lint && npm test`
4. Create a pull request — CI runs automatically

## License

MIT

---

[![MseeP.ai Security Assessment Badge](https://mseep.net/pr/worldnine-scrapbox-cosense-mcp-badge.png)](https://mseep.ai/app/worldnine-scrapbox-cosense-mcp)
<a href="https://glama.ai/mcp/servers/8huixkwpe2"><img width="380" height="200" src="https://glama.ai/mcp/servers/8huixkwpe2/badge" alt="Scrapbox Cosense Server MCP server" /></a>
