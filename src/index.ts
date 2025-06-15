#!/usr/bin/env node

const SERVICE_LABEL = process.env.SERVICE_LABEL || "cosense (scrapbox)";
const TOOL_SUFFIX = process.env.COSENSE_TOOL_SUFFIX;
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

// 環境変数のデフォルト値と検証用の定数
const FETCH_PAGE_LIMIT = 100;  // 固定で100件取得
const DEFAULT_PAGE_LIMIT = FETCH_PAGE_LIMIT;  // デフォルトは取得上限と同じ
const DEFAULT_SORT_METHOD = 'updated';
const MIN_PAGE_LIMIT = 1;
const MAX_PAGE_LIMIT = 1000;

// 有効なソート方法の定義
const VALID_SORT_METHODS = ['updated', 'created', 'accessed', 'linked', 'views', 'title'] as const;

// ツール名生成ヘルパー
function getToolName(baseName: string): string {
  return TOOL_SUFFIX ? `${baseName}_${TOOL_SUFFIX}` : baseName;
}

// resourcesの初期取得用の設定
const cosenseSid: string | undefined = process.env.COSENSE_SID;
const projectName: string | undefined = process.env.COSENSE_PROJECT_NAME;
const initialPageLimit: number = (() => {
  const limit = process.env.COSENSE_PAGE_LIMIT ? 
    parseInt(process.env.COSENSE_PAGE_LIMIT, 10) : 
    DEFAULT_PAGE_LIMIT;

  if (isNaN(limit) || limit < MIN_PAGE_LIMIT || limit > MAX_PAGE_LIMIT) {
    return DEFAULT_PAGE_LIMIT;
  }
  return limit;
})();

const initialSortMethod: string = (() => {
  const sort = process.env.COSENSE_SORT_METHOD;

  if (!sort) return DEFAULT_SORT_METHOD;
  if (!VALID_SORT_METHODS.includes(sort as any)) {
    return DEFAULT_SORT_METHOD;
  }
  return sort;
})();

if (!projectName) {
  throw new Error("COSENSE_PROJECT_NAME is not set");
}


// resourcesの初期化（100件取得してソート）
const resources = await (async () => {
  try {
    // 常に100件取得
    const result = await listPages(
      projectName, 
      cosenseSid,
      {
        limit: FETCH_PAGE_LIMIT,  // 固定で100件
        skip: 0,
        sort: initialSortMethod,
        excludePinned: process.env.COSENSE_EXCLUDE_PINNED === 'true'
      }
    );

    // ソート済みのページから必要な件数だけを使用
    return result.pages
      .slice(0, Math.min(initialPageLimit, FETCH_PAGE_LIMIT))  // 環境変数で指定された件数か100件の小さい方
      .map((page) => ({
        uri: `cosense:///${page.title}`,
        mimeType: "text/plain",
        name: page.title,
        description: `A text page: ${page.title}`,
      }));

  } catch (error) {
    return [];  // 空の配列を返してサーバーは起動を継続
  }
})();

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
  const tools = [
      {
        name: getToolName("create_page"),
        description: `Create a new page in Scrapbox project on ${SERVICE_LABEL}. Creates a new page with the specified title and optional body text. Returns the page creation URL without opening browser. Uses ${projectName} project as default if projectName is not specified.`,
        inputSchema: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description: "Title of the new page",
            },
            body: {
              type: "string",
              description: "Content in markdown format. Avoid duplicating the title in the body since it's automatically displayed at the top. Supports links, code blocks, lists, and emphasis.",
            },
            projectName: {
              type: "string",
              description: `Target project name. If not specified, defaults to '${projectName}'.`,
            },
          },
          required: ["title"],
        },
      },
      {
        name: getToolName("get_page_url"),
        description: `Generate URL for a page in Scrapbox project on ${SERVICE_LABEL}. Returns the direct URL to the specified page without opening it in browser. Uses ${projectName} project as default if projectName is not specified.`,
        inputSchema: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description: "Title of the page",
            },
            projectName: {
              type: "string",
              description: `Target project name. If not specified, defaults to '${projectName}'.`,
            },
          },
          required: ["title"],
        },
      },
      {
        name: getToolName("get_page"),
        description: `Get a page from Scrapbox project on ${SERVICE_LABEL}. Returns page content and its linked pages. Page content includes title and description in plain text format. Uses ${projectName} project as default if projectName is not specified.`,
        inputSchema: {
          type: "object",
          properties: {
            pageTitle: {
              type: "string",
              description: "Title of the page",
            },
            projectName: {
              type: "string",
              description: `Target project name. If not specified, defaults to '${projectName}'.`,
            },
          },
          required: ["pageTitle"],
        },
      },
      {
        name: getToolName("list_pages"),
        description: `Browse and list pages from Scrapbox project on ${SERVICE_LABEL} with flexible sorting and pagination. Use this tool to discover pages by recency, popularity, or alphabetically. Returns page metadata and first 5 lines of content. Available sorting methods: updated (last update time), created (creation time), accessed (access time), linked (number of incoming links), views (view count), title (alphabetical). Different from search_pages which finds content by keywords. Uses ${projectName} project as default if projectName is not specified.`,
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
            projectName: {
              type: "string",
              description: `Target project name. If not specified, defaults to '${projectName}'.`,
            },
          },
          required: [],
        },
      },
      {
        name: getToolName("search_pages"),
        description: `Search for content within pages in Scrapbox project on ${SERVICE_LABEL}. Use this tool to find pages containing specific keywords or phrases. Returns matching pages with highlighted search terms and content snippets. Limited to 100 results maximum. Supports basic search ("keyword"), multiple keywords ("word1 word2" for AND search), exclude words ("word1 -word2"), and exact phrases ("\\"exact phrase\\""). Different from list_pages which browses pages by metadata. Uses ${projectName} project as default if projectName is not specified.`,
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query string",
            },
            projectName: {
              type: "string",
              description: `Target project name. If not specified, defaults to '${projectName}'.`,
            },
          },
          required: ["query"],
        },
      },
      {
        name: getToolName("insert_lines"),
        description: `Insert text after a specified line in a Scrapbox page on ${SERVICE_LABEL}. Directly modifies the page content via WebSocket API. Requires COSENSE_SID authentication. Uses ${projectName} project as default if projectName is not specified.`,
        inputSchema: {
          type: "object",
          properties: {
            pageTitle: {
              type: "string",
              description: "Title of the page to modify",
            },
            targetLineText: {
              type: "string",
              description: "Text content of the line after which to insert new text. If not found, text will be appended to the end of the page.",
            },
            text: {
              type: "string",
              description: "Text to insert. Can contain multiple lines separated by newline characters.",
            },
            projectName: {
              type: "string",
              description: `Target project name. If not specified, defaults to '${projectName}'.`,
            },
          },
          required: ["pageTitle", "targetLineText", "text"],
        },
      },
    ];
  
  
  return { tools };
});


// ルートのセットアップ
setupRoutes(server, {
  projectName,
  cosenseSid: cosenseSid ?? undefined,
  toolSuffix: TOOL_SUFFIX,
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(() => {
  process.exit(1);
});
