#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { listPages, getPage, toReadablePage } from "./cosense.js";

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

console.info(`Found ${resources.length} resources`);

const server = new Server(
  {
    name: "cosense-mcp-server",
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
  const title = url.pathname.replace(/^\//, "");
  let page = resources.find((resource) => resource.uri === request.params.uri);
  if (!page) {
    const getPageResult = await getPage(projectName, title, cosenseSid);
    if (!getPageResult) {
      throw new Error(`Page ${title} not found`);
    }
    const readablePage = toReadablePage(getPageResult);
    page = {
      uri: request.params.uri,
      mimeType: "text/plain",
      name: readablePage.title,
      description: readablePage.description,
    };
    resources.push(page);
  }

  if (!page) {
    throw new Error(`Page ${title} not found`);
  }

  return {
    contents: [
      {
        uri: request.params.uri,
        mimeType: "text/plain",
        text: page.description,
      },
    ],
  };
});

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_page",
        description: `
        Get a page from ${projectName} project on cosen.se

        In cosense, a page is a cosense-style document with a title and a description.
        Bracket Notation makes links between pages.
        Example: [Page Title]
        -> "/${projectName}/Page Title"

        A page may have links to other pages.
        Links are rendered at the bottom of the page.
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
        description: `List known cosense pages from ${projectName} project on cosen.se`,
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  switch (request.params.name) {
    case "get_page": {
      const pageTitle = String(request.params.arguments?.pageTitle);
      const page = await getPage(projectName, pageTitle, cosenseSid);
      if (!page) {
        throw new Error(`Page ${pageTitle} not found`);
      }
      const readablePage = toReadablePage(page);

      return {
        content: [
          {
            type: "text",
            text: readablePage.description,
          },
        ],
      };
    }

    case "list_pages": {
      return {
        content: [
          {
            type: "text",
            text: resources.map((resource) => resource.name).join("\n"),
          },
        ],
      };
    }

    default:
      throw new Error("Unknown tool");
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
