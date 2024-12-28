#!/usr/bin/env node

const API_DOMAIN = process.env.API_DOMAIN || "cosen.se";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { listPages, getPage, toReadablePage, createPageUrl, searchPages } from "./cosense.js";
import { convertMarkdownToScrapbox } from './utils/markdown-converter.js';

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
  // URLデコードを追加
  const title = decodeURIComponent(url.pathname.replace(/^\//, ""));
  
  const getPageResult = await getPage(projectName, title, cosenseSid);
  if (!getPageResult) {
    throw new Error(`Page ${title} not found`);
  }
  const readablePage = toReadablePage(getPageResult);
  const formattedText = `
${readablePage.title}
作成日時: ${new Date(readablePage.created * 1000).toLocaleString()}
更新日時: ${new Date(readablePage.updated * 1000).toLocaleString()}

${readablePage.lines.map(line => line.text).join('\n')}

リンク:
${getPageResult.links.length > 0 ? getPageResult.links.map((link: string) => `- ${link}`).join('\n') : '(なし)'}

最新の編集者:
- ${readablePage.user.displayName}

その他の編集者:
${readablePage.collaborators
  .filter(collab => collab.id !== readablePage.user.id)
  .map(user => `- ${user.displayName}`)
  .join('\n')}
`;

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
        description: `List known cosense pages from ${projectName} project on ${API_DOMAIN}`,
        inputSchema: {
          type: "object",
          properties: {},
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

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  switch (request.params.name) {
    case "get_page": {
      try {
        const pageTitle = String(request.params.arguments?.pageTitle);
        const page = await getPage(projectName, pageTitle, cosenseSid);
        
        if (!page) {
          return {
            content: [
              {
                type: "text",
                text: `ページ「${pageTitle}」が見つかりませんでした。\nプロジェクト: ${projectName}`,
              },
            ],
            isError: true,
          };
        }

        const readablePage = toReadablePage(page);
        const formattedText = `
${readablePage.title}
作成日時: ${new Date(readablePage.created * 1000).toLocaleString()}
更新日時: ${new Date(readablePage.updated * 1000).toLocaleString()}

${readablePage.lines.map(line => line.text).join('\n')}

リンク:
${readablePage.links.length > 0 ? readablePage.links.map((link: string) => `- ${link}`).join('\n') : '(なし)'}

最新の編集者:
- ${readablePage.user.displayName}

その他の編集者:
${readablePage.collaborators
  .filter(collab => collab.id !== readablePage.user.id)
  .map(user => `- ${user.displayName}`)
  .join('\n')}
`;
        return {
          content: [
            {
              type: "text",
              text: formattedText,
            },
          ],
        };
      } catch (error) {
        console.error('Error in get_page:', error);
        return {
          content: [
            {
              type: "text",
              text: `ページの取得中にエラーが発生しました: ${error instanceof Error ? error.message : '不明なエラー'}`,
            },
          ],
          isError: true,
        };
      }
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

    case "search_pages": {
      try {
        const query = String(request.params.arguments?.query);
        const results = await searchPages(projectName, query, cosenseSid);
        
        if (!results) {
          return {
            content: [
              {
                type: "text",
                text: `検索中にエラーが発生しました。\nプロジェクト: ${projectName}\nクエリ: ${query}`,
              },
            ],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                query: results.searchQuery,
                total_count: results.count,
                pages: results.pages.map(page => ({
                  title: page.title,
                  content: page.lines.join('\n'),
                  matched_words: page.words
                }))
              }, null, 2)
            }
          ],
        };
      } catch (error) {
        console.error('Error in search_pages:', error);
        return {
          content: [
            {
              type: "text",
              text: `検索中にエラーが発生しました: ${error instanceof Error ? error.message : '不明なエラー'}`,
            },
          ],
          isError: true,
        };
      }
    }

    case "create_page": {
      const title = String(request.params.arguments?.title);
      const body = request.params.arguments?.body as string | undefined;
      
      // Markdownテキストを変換
      const convertedBody = body ? await convertMarkdownToScrapbox(body) : undefined;
      const url = createPageUrl(projectName, title, convertedBody);
      
      // ブラウザでURLを開く
      const { exec } = await import("child_process");
      exec(`open "${url}"`);

      return {
        content: [
          {
            type: "text",
            text: `Opening new page: ${title}\nURL: ${url}`,
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
