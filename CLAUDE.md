# CLAUDE.md

MCP server for Cosense (Scrapbox). Also works as a CLI.

## Commands

```bash
npm run build        # TypeScript → JavaScript (uses tsconfig.build.json)
npm run watch        # Auto-rebuild during development
npm run test         # Run Jest tests
npm run lint         # ESLint (console.log triggers warning)
npm run inspector    # Debug with MCP Inspector
```

## Architecture

### Tools (11, or 9 without `COSENSE_ENABLE_DELETE`)

| Tool | Description | Auth |
|---|---|---|
| `get_page` | Retrieve page content, metadata, and links | - |
| `list_pages` | List pages with sorting and pagination (max 1000) | - |
| `search_pages` | Keyword search (API limit: 100 results) | - |
| `create_page` | Create new page. Rejects if page already exists | SID |
| `get_page_url` | Generate URL from page title | - |
| `insert_lines` | Insert text after a target line (exact match). Appends to end if not found | SID |
| `edit_lines` | Replace target line(s) (exact match, multi-line block supported). Errors if not found. `matchAll` replaces every occurrence | SID |
| `delete_lines` | Delete target line(s) (exact match, multi-line block supported). Refuses to delete the title line. Errors if not found. `matchAll` deletes every occurrence | SID |
| `delete_page` | Delete a page by emptying every line. Registered only when `COSENSE_ENABLE_DELETE=true`. Errors if the page does not exist. `dryRun` previews | SID |
| `rewrite_page` | Replace a page's entire content. Registered only when `COSENSE_ENABLE_DELETE=true`. Errors if the page does not exist or content is empty. `dryRun` previews before/after | SID |
| `get_smart_context` | Get page + linked pages (1-hop/2-hop) in AI-optimized format | SID |

### CLI

All tools are also available as CLI subcommands (`get`, `list`, `search`, `create`, `url`, `insert`, `edit`, `delete-lines`, `delete`, `rewrite`, `context`). `delete` and `rewrite` require `COSENSE_ENABLE_DELETE=true` and support `--dry-run`. Run `scrapbox-cosense-mcp <command> --help` for usage. Key flags:

- `--compact` — Token-efficient output (85% smaller for list)
- `--json` — JSON output
- `--project=NAME` — Override project name

### Skill (SKILL.md)

`skills/scrapbox/SKILL.md` defines a Claude Code skill that wraps the CLI. When users invoke `/cosense`, Claude Code reads SKILL.md and executes CLI commands via Bash. Keep SKILL.md concise — details should be discoverable via `--help`.

### Claude Code Plugin

`.claude-plugin/` (plugin.json + marketplace.json) enables installation via `/plugin marketplace add worldnine/scrapbox-cosense-mcp`. The marketplace resolves the plugin from the **npm package**, so `.claude-plugin/`, `.mcp.json`, and `skills/` must be listed in package.json `files` — a plugin fix only takes effect after the next npm release.

### Desktop Extensions (.mcpb)

`manifest.json` + `.mcpbignore` enable Claude Desktop Extensions packaging. The `.mcpb` file is auto-built and attached to GitHub Releases by `release-mcpb.yml`. To build locally: `npm install --omit=dev && npx @anthropic-ai/mcpb pack`.

### Directory Structure

- `src/cosense.ts` — Scrapbox REST API client
- `src/routes/handlers/` — One handler module per tool
- `src/utils/format.ts` — Response formatting, `stringifyError`, `formatError`
- `src/utils/sort.ts` — Sorting with pinned page filtering
- `src/utils/project.ts` — `COSENSE_PROJECT_ALLOW_LIST` check (`checkProjectAllowed`)
- `src/utils/markdown-converter.ts` — Markdown → Scrapbox conversion (uses `md2sb`)
- `src/types/` — API response and MCP request/response type definitions
- `src/cli.ts` — CLI entry point (args → CLI mode, no args → MCP server)
- `src/index.ts` — Server entry point

### Design Decisions

- **WebSocket API (`@cosense/std`)** is used for all page writes (`create_page` / `insert_lines` / `edit_lines` / `delete_lines` / `delete_page` / `rewrite_page`) because the REST API has no page creation/editing endpoints
- **`create_page` rejects existing pages** (`persistent === true`). Without this check, `patch()` silently replaces all content since it's a diff-update API
- **`insert_lines` uses exact match**. Partial match risks inserting at unintended lines
- **`edit_lines` / `delete_lines` default to `matchAll: false`**. Repeated lines (bullet markers, blank lines) are common, so replacing/deleting every occurrence by default would exceed what the caller asked for
- **`edit_lines` / `delete_lines` treat a newline-containing `targetLineText` as a contiguous block**. Matching is non-overlapping with `matchAll`, so n lines can become m lines (edit) or be removed together (delete)
- **`delete_lines` refuses to delete the title line (the first line)**. Deleting it would rename the page — or remove it entirely if nothing else remains — which would bypass the `COSENSE_ENABLE_DELETE` gate on `delete_page`. It returns an error pointing to `delete_page` instead
- **`delete_page` and `rewrite_page` are gated by `COSENSE_ENABLE_DELETE`** at tool-registration time, not just at call time. This server is often placed in a shared MCP configuration, so an unset variable means the tools never appear in the tool list and cannot be called by mistake. The handlers check the variable again, so the CLI and direct calls are covered too
- **The gate boundary is "does the caller have to name the content it destroys"**. `insert_lines` / `edit_lines` / `delete_lines` require exact matches, which only succeed if the caller has read the page. `delete_page` / `rewrite_page` act on the whole page regardless, so they get the opt-in gate
- **`delete_page` checks existence before deleting**. The REST API returns a title line even for a page that was never created, so line count cannot tell existence apart — `persistent` does, the same way `create_page` decides. Without this check a delete against a missing page reports success
- **`rewrite_page` inverts the existence check**: it rejects pages that do NOT exist (`persistent !== true`). A title typo must not silently create a new page, and it must reject empty content (deletion is `delete_page`'s job)
- **`delete_page` and `rewrite_page` support `dryRun`**, which report the line counts (and previews) without calling `patch()` at all. There is no undo, so an agent should be able to look before it acts
- **`insert_lines` and `edit_lines`/`delete_lines` differ when the target is missing**, deliberately. `insert_lines` appends to the end, since "add this text" still has a sensible landing spot. `edit_lines`/`delete_lines` error and leave the page untouched, since "replace/delete this line" has no fallback
- **`COSENSE_PROJECT_ALLOW_LIST` is checked in every handler**, right after the project name is resolved, via `checkProjectAllowed()` in `src/utils/project.ts`. Handlers are the only point shared by the MCP dispatcher, the CLI, and direct calls, so a check in the dispatcher alone would miss the other two. The helper returns an error message instead of throwing because four handlers resolve the project name outside their `try`. `src/__tests__/handlers/project-allow-list.test.ts` enumerates every handler file, so adding a tool without the check fails the test
- **The implicit allowance of the default project reads `process.env.COSENSE_PROJECT_NAME`, not the handler's `defaultProjectName` argument**. The CLI passes `--project=NAME` as `defaultProjectName` too, so comparing against the argument would let every CLI call through
- **An allow list that is set but empty (`""`, `",,,"`) restricts to the default project** rather than falling back to unrestricted. Whoever set the variable meant to restrict, and only an unset variable means "no fence"
- **`patch()` returns `Result<string, PushError>`**, not throw. Must check `result.ok`
- **Default sort is `updated`**. Aligned across API, display, and user expectations

### Environment Variables

See README.md. Key variables:

- `COSENSE_PROJECT_NAME` — Target project (required)
- `COSENSE_SID` — Session ID for private projects and write operations
- `COSENSE_TOOL_SUFFIX` — Tool name suffix for multiple server instances
- `COSENSE_CONVERT_NUMBERED_LISTS` — Convert numbered lists to bullet lists
- `COSENSE_ENABLE_DELETE` — Register `delete_page`/`rewrite_page` and the `delete`/`rewrite` CLI commands (opt-in)
- `COSENSE_PROJECT_ALLOW_LIST` — Comma-separated projects that `projectName`/`--project` may target. `COSENSE_PROJECT_NAME` is always allowed. Unset = unrestricted; set but empty = default project only (opt-in)

## CI/CD & Release

### GitHub Actions

- **pr.yml** — Quality check on PRs (lint → test → build)
- **security-scan.yml** — Security scan
- **auto-release.yml** — `release/v*` PR merge → auto-create tag + GitHub Release
- **publish-npm.yml** — `v*` tag push → auto-publish to npm
- **release-mcpb.yml** — GitHub Release → auto-build and attach .mcpb

### Release Process

1. Create `release/vX.Y.Z` branch, bump version in `package.json` + `manifest.json` + `.claude-plugin/plugin.json`
   - Note: the MCP `serverInfo.version` is read from `package.json` at runtime, so no separate bump is needed for `src/index.ts`
2. Create PR → CI passes → merge
3. Everything after merge is automatic (tag → npm → GitHub Release → .mcpb)

## TypeScript

- **Strict mode**: includes `exactOptionalPropertyTypes: true`
- **Path aliases**: `@/` → `src/` (configured in both TypeScript and Jest; runtime uses relative paths)
- **ESM**: imports use `.js` extensions
- **Dual config**: `tsconfig.json` (dev) and `tsconfig.build.json` (prod, excludes tests)
