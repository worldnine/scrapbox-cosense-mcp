# cosense-mcp-server MCP Server

MCP server for [cosense](https://cosen.se)

## Features

- Get Page

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
    "cosense-mcp-server": {
      "command": "node",
      "args": ["/path/to/cosense-mcp-server/build/index.js"],
      "env": {
        "COSENSE_PROJECT_NAME": "your_project_name",
        "COSENSE_SID": "your_sid"
      }
    }
  }
}
```

`COSENSE_SID` is optional.
If you want to use this server towards a private project, you need to set `COSENSE_SID`.

### Debugging

Since MCP servers communicate over stdio, debugging can be challenging. We recommend using the [MCP Inspector](https://github.com/modelcontextprotocol/inspector), which is available as a package script:

```bash
npm run inspector
```

The Inspector will provide a URL to access debugging tools in your browser.
