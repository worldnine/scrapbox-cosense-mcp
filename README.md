# scrapbox-cosense-mcp MCP Server

MCP server for [cosense/scrapbox](https://cosen.se)

## Features

- `get_page` 
  - Get page content from cosense/Scrapbox
    - Input: page title
    - Returns: page content, metadata, links and collaborators
- `list_pages`
  - List all pages in the project
    - Returns: list of page titles in the project
- `search_pages`
  - Full-text search across pages
    - Supports basic search, phrase search, and exclusion search
    - Returns: matching pages with snippets
- `create_pages`
  - Generate URL for a page
    - Input: page title and optional body text
    - Returns: URL that can be opened in browser

## Development

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


### Debugging

Since MCP servers communicate over stdio, debugging can be challenging. We recommend using the [MCP Inspector](https://github.com/modelcontextprotocol/inspector), which is available as a package script:

```bash
npm run inspector
```

The Inspector will provide a URL to access debugging tools in your browser.
