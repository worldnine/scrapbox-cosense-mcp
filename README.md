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
| `edit_lines` | Replace exact-match line(s), including a multi-line block (first match, or all with `matchAll`) | Yes |
| `delete_lines` | Delete exact-match line(s), including a multi-line block (first match, or all with `matchAll`) | Yes |
| `delete_page` | Delete a page by emptying every line — opt-in, see below | Yes |
| `rewrite_page` | Replace a page's entire content — opt-in, see below | Yes |
| `get_smart_context` | Get a page and its linked pages (1-hop/2-hop) in AI-optimized format | Yes |

`create_page`, `insert_lines`, `edit_lines`, and `rewrite_page` support a `format` parameter (`"markdown"` or `"scrapbox"`) to control content conversion.

`edit_lines` replaces only the first matching line by default. Set `matchAll: true` to replace every occurrence. The default is deliberately conservative: a line such as a bullet marker or a blank line can repeat many times in a page, and replacing all of them at once is rarely what the caller intended.

`targetLineText` may contain newlines to match a contiguous block of lines. The block is replaced as a whole, so n lines can become m lines (for example, collapsing several lines into one). Block matches with `matchAll: true` are non-overlapping.

`delete_lines` uses the same exact-match (and block) semantics but removes the matched lines instead of replacing them. It refuses to delete the title line (the first line), because that would rename or remove the page itself — use `delete_page` for that.

### `delete_page` and `rewrite_page` are opt-in

`delete_page` and `rewrite_page` are **not registered unless `COSENSE_ENABLE_DELETE=true` is set**. Without it neither tool appears in the tool list at all, so an agent cannot call them even by mistake. This server is often added to a shared MCP configuration, so whole-page destruction is exposed only to those who deliberately turn it on.

The reasoning: `insert_lines`, `edit_lines`, and `delete_lines` all require an exact match, which is only possible if the caller has actually read the page — they can only destroy lines they already know. `delete_page` and `rewrite_page` act on the entire page regardless of whether the caller has read it, so they get a separate opt-in gate.

`delete_page` empties every one of a page's lines, and Cosense removes a page once all of its lines are empty. There is no undo. Two further guards are built in:

- The page must already exist. A missing page returns an error rather than a silent success. (The REST API returns a title line even for a page that was never created, so the check looks at `persistent`, the same way `create_page` does.)
- `dryRun: true` reports how many lines would be removed and shows the first five of them, without touching the page.

### `COSENSE_PROJECT_ALLOW_LIST` limits reachable projects

Every tool accepts a `projectName` override, which is how one server serves several projects. A session ID often reaches more projects than the default one, so without a limit an agent that names the wrong project can read or write there. `COSENSE_PROJECT_ALLOW_LIST` is the opt-in fence: when set, only the listed projects and `COSENSE_PROJECT_NAME` are accepted, and anything else fails before a request is sent. Names are matched exactly, including case, so a spelling variant cannot slip through. Setting the variable to an empty value restricts to the default project alone. Unset keeps the old unrestricted behavior.

`rewrite_page` replaces a page's entire content (the title is preserved as the first line). It has the same guards, plus two of its own:

- The page must already exist — the `persistent` check is inverted relative to `create_page`, so a typo cannot silently create a new page.
- Empty content is rejected — removing a page is `delete_page`'s job.
- `dryRun: true` reports the before/after line counts and previews without touching the page.

When you run several instances of this server for different projects, set the variable on each instance that should be allowed to delete:

```json
{
  "mcpServers": {
    "cosense-notes": {
      "command": "npx",
      "args": ["-y", "scrapbox-cosense-mcp"],
      "env": {
        "COSENSE_PROJECT_NAME": "notes",
        "COSENSE_SID": "s:your-session-id",
        "COSENSE_TOOL_SUFFIX": "notes",
        "COSENSE_ENABLE_DELETE": "true"
      }
    },
    "cosense-archive": {
      "command": "npx",
      "args": ["-y", "scrapbox-cosense-mcp"],
      "env": {
        "COSENSE_PROJECT_NAME": "archive",
        "COSENSE_SID": "s:your-session-id",
        "COSENSE_TOOL_SUFFIX": "archive"
      }
    }
  }
}
```

Here the `notes` instance exposes `delete_page_notes`, while the `archive` instance exposes no deletion tool at all.

Note that `insert_lines` and `edit_lines` behave differently when the target line is absent. `insert_lines` appends to the end of the page, because "add this text somewhere" still has a reasonable outcome. `edit_lines` returns an error and leaves the page untouched, because "replace this specific line" has no meaningful fallback — appending the replacement would silently produce a page the caller never asked for.

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
   Installs globally by default. Use `--scope project` or `--scope local` for other scopes.
3. Set environment variables in your settings file:
   ```json
   {
     "env": {
       "COSENSE_PROJECT_NAME": "your_project_name",
       "COSENSE_SID": "your_sid"
     }
   }
   ```
   | File | Scope |
   |------|-------|
   | `~/.claude/settings.json` | All projects (global) |
   | `.claude/settings.local.json` | This project only (gitignored) |

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
| `COSENSE_ENABLE_DELETE` | `false` | Register the `delete_page` and `rewrite_page` tools (and the `delete` / `rewrite` CLI commands). Without it, none are available |
| `COSENSE_PROJECT_ALLOW_LIST` | — | Comma-separated project names that `projectName` / `--project` may target. `COSENSE_PROJECT_NAME` is always allowed. Unset means no restriction; set to an empty value means the default project only |

## CLI Usage

The same binary also works as a standalone CLI:

```bash
scrapbox-cosense-mcp get "Page Title"
scrapbox-cosense-mcp search "keyword"
scrapbox-cosense-mcp list --sort=updated --limit=20
scrapbox-cosense-mcp create "New Page" --body="Markdown content"
scrapbox-cosense-mcp insert "Page" --after="target line" --text="new text"
scrapbox-cosense-mcp edit "Page" --target="old line" --text="new text"
scrapbox-cosense-mcp delete-lines "Page" --target="old line"
scrapbox-cosense-mcp delete "Page" --dry-run   # needs COSENSE_ENABLE_DELETE=true
scrapbox-cosense-mcp rewrite "Page" --body="new content" --dry-run   # needs COSENSE_ENABLE_DELETE=true
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

To limit which projects an agent can reach, set `COSENSE_PROJECT_ALLOW_LIST` (comma-separated). Requests naming any other project are rejected before any API call, and the error lists the permitted projects. Matching is case-sensitive.

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
