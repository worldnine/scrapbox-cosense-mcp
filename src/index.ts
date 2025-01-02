#!/usr/bin/env node

const API_DOMAIN = process.env.API_DOMAIN || "scrapbox.io";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { listPages, getPage, toReadablePage } from "./cosense.js";
import { formatYmd } from './utils/format.js';
import { setupRoutes } from './routes/index.js';

const cosenseSid: string | undefined = process.env.COSENSE_SID;
const projectName: string | undefined = process.env.COSENSE_PROJECT_NAME;
if (!projectName) {
  throw new Error("COSENSE_PROJECT_NAME is not set");
}

const resources = await listPages(projectName, cosenseSid).then((pages) =>
  pages.pages.map((page) => ({
    uri: `cosense:///${page.title}`,
    mimeType: "text/plain",
    name: page.title,
    description: `A text page: ${page.title}`,
  })),
);

const server = new Server(
  {
    name: "scrapbox-cosense-mcp",
    version: "0.1.0",
  },
  {
    capabilities: {
      resources: {},
      tools: {},
      prompts: {},
    },
  },
);

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources,
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const url = new URL(request.params.uri);
  const title = decodeURIComponent(url.pathname.replace(/^\//, ""));
  
  const getPageResult = await getPage(projectName, title, cosenseSid);
  if (!getPageResult) {
    throw new Error(`Page ${title} not found`);
  }
  const readablePage = toReadablePage(getPageResult);
  const formattedText = [
    `Title: ${readablePage.title}`,
    `Created: ${formatYmd(new Date(readablePage.created * 1000))}`,
    `Updated: ${formatYmd(new Date(readablePage.updated * 1000))}`,
    `Created user: ${readablePage.lastUpdateUser?.displayName || readablePage.user.displayName}`,
    `Last editor: ${readablePage.user.displayName}`,
    `Other editors: ${readablePage.collaborators
      .filter(collab => 
        collab.id !== readablePage.user.id && 
        collab.id !== readablePage.lastUpdateUser?.id
      )
      .map(user => user.displayName)
      .join(', ')}`,
    '',
    readablePage.lines.map(line => line.text).join('\n'),
    '',
    `Links:\n${getPageResult.links.length > 0 
      ? getPageResult.links.map((link: string) => `- ${link}`).join('\n') 
      : '(None)'}`
  ].join('\n');

  return {
    contents: [
      {
        uri: request.params.uri,
        mimeType: "text/plain",
        text: formattedText,
      },
    ],
  };
});

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "create_page",
        description: `
        Create a new page in ${projectName} project on ${API_DOMAIN}
        
        Creates a new page with the specified title and optional body text.
        The page will be opened in your default browser.
        `,
        inputSchema: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description: "Title of the new page",
            },
            body: {
              type: "string",
              description: "Content in markdown format that will be converted to Scrapbox format. Supports standard markdown syntax including links, code blocks, lists, and emphasis.",
            },
          },
          required: ["title"],
        },
      },
      {
        name: "get_page",
        description: `
        Get a page from ${projectName} project on ${API_DOMAIN}
        Returns page content and its linked pages.
        Page content includes title and description in plain text format.
        `,
        inputSchema: {
          type: "object",
          properties: {
            pageTitle: {
              type: "string",
              description: "Title of the page",
            },
          },
          required: ["pageTitle"],
        },
      },
      {
        name: "list_pages",
        description: `
        List pages from ${projectName} project on ${API_DOMAIN} with flexible sorting options.
        
        Available sorting methods:
        - updated: Sort by last update time
        - created: Sort by creation time
        - accessed: Sort by access time
        - linked: Sort by number of incoming links
        - views: Sort by view count
        - title: Sort by page title
        `,
        inputSchema: {
          type: "object",
          properties: {
            sort: {
              type: "string",
              enum: ["updated", "created", "accessed", "linked", "views", "title"],
              description: "Sort method for the page list",
            },
            limit: {
              type: "number",
              minimum: 1,
              maximum: 1000,
              description: "Maximum number of pages to return (1-1000)",
            },
            skip: {
              type: "number",
              minimum: 0,
              description: "Number of pages to skip",
            },
            excludePinned: {
              type: "boolean",
              description: "Whether to exclude pinned pages from the results",
            },
          },
          required: [],
        },
      },
      {
        name: "search_pages",
        description: `
        Search pages in ${projectName} project on ${API_DOMAIN}
        
        Supports various search features:
        - Basic search: "keyword"
        - Multiple keywords: "word1 word2" (AND search)
        - Exclude words: "word1 -word2"
        - Exact phrase: "\\"exact phrase\\""
        `,
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query string",
            },
          },
          required: ["query"],
        },
      },
    ],
  };
});

// ルートのセットアップ
setupRoutes(server, {
  projectName,
  cosenseSid,
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error([
    'Fatal Error:',
    `Message: ${error instanceof Error ? error.message : 'Unknown error'}`,
    `Timestamp: ${new Date().toISOString()}`
  ].join('\n'));
  process.exit(1);
});
