# Multiple Project Support

## Method 1: Single Server with Optional Parameters

All tools accept an optional `projectName` parameter to target different projects from a single server instance.

```
# Default project (uses COSENSE_PROJECT_NAME)
get_page "Meeting Notes"

# Specific project
get_page "Design Guidelines" projectName="help-ja"
```

**Limitation**: Works best with public projects or projects sharing the same authentication credentials.

## Method 2: Multiple Server Instances (Recommended for Private Projects)

Run separate MCP server instances with unique `COSENSE_TOOL_SUFFIX` values:

```json
{
  "mcpServers": {
    "main-scrapbox": {
      "command": "npx",
      "args": ["-y", "scrapbox-cosense-mcp"],
      "env": {
        "COSENSE_PROJECT_NAME": "main-project",
        "COSENSE_SID": "s:main_sid_here...",
        "COSENSE_TOOL_SUFFIX": "main",
        "SERVICE_LABEL": "Main Scrapbox"
      }
    },
    "team-cosense": {
      "command": "npx",
      "args": ["-y", "scrapbox-cosense-mcp"],
      "env": {
        "COSENSE_PROJECT_NAME": "team-workspace",
        "COSENSE_SID": "s:team_sid_here...",
        "COSENSE_TOOL_SUFFIX": "team",
        "SERVICE_LABEL": "Team Cosense"
      }
    }
  }
}
```

This creates distinct tools like `get_page_main` and `get_page_team`, allowing LLMs to automatically select the correct project.

### Configuration Guide

| Variable | Purpose | Example |
|----------|---------|---------|
| `COSENSE_PROJECT_NAME` | Actual project name for API calls | `main-project` |
| `COSENSE_SID` | Session ID for this project | `s:xxx...` |
| `COSENSE_TOOL_SUFFIX` | Unique suffix for tool names | `main` |
| `SERVICE_LABEL` | Display name in tool descriptions | `Main Scrapbox` |
