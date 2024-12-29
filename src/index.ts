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

function formatYmd(date: Date): string {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  return `${y}/${m}/${d}`;
}

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
Created: ${formatYmd(new Date(readablePage.created * 1000))}
Updated: ${formatYmd(new Date(readablePage.updated * 1000))}

${readablePage.lines.map(line => line.text).join('\n')}

Links:
${getPageResult.links.length > 0 ? getPageResult.links.map((link: string) => `- ${link}`).join('\n') : '(None)'}

Last editor:
- ${readablePage.user.displayName}

Other editors:
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

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  switch (request.params.name) {
    case "list_pages": {
      try {
        const sort = request.params.arguments?.sort as string | undefined;
        const limit = request.params.arguments?.limit as number | undefined;
        const skip = request.params.arguments?.skip as number | undefined;

        const pages = await listPages(projectName, cosenseSid, { sort, limit, skip });
        
        // ソート方法に応じた説明を生成する関数を先に定義
        const getSortDescription = (sortMethod: string | undefined) => {
          const base = {
            updated: "Sorted by last updated",
            created: "Sorted by creation date",
            accessed: "Sorted by last accessed",
            linked: "Sorted by number of incoming links",
            views: "Sorted by view count",
            title: "Sorted by title"
          }[sortMethod || ''] || "Default order";

          return `${base} (Pinned pages are shown first)`;
        };

        // ソート方法に応じた値を取得する関数
        const getSortValue = (page: any, sortMethod: string | undefined) => {
          switch (sortMethod) {
            case 'updated':
              return { value: page.updated, formatted: formatYmd(new Date(page.updated * 1000)) };
            case 'created':
              return { value: page.created, formatted: formatYmd(new Date(page.created * 1000)) };
            case 'accessed':
              return { value: page.accessed || page.lastAccessed, formatted: formatYmd(new Date((page.accessed || page.lastAccessed) * 1000)) };
            case 'linked':
              return { value: page.linked, formatted: String(page.linked) };
            case 'views':
              return { value: page.views, formatted: String(page.views) };
            case 'title':
              return { value: page.title, formatted: page.title };
            default:
              return { value: null, formatted: 'Not specified' };
          }
        };

        // シンプルなKEY: value形式の出力を構築
        let output = `Project: ${projectName}\n`;
        output += `Total pages: ${pages.count}\n`;
        output += `Pages fetched: ${pages.limit}\n`;
        output += `Pages skipped: ${pages.skip}\n`;
        output += `Sort method: ${getSortDescription(sort)}\n`;
        output += `Note: Pinned pages are always shown first due to API specifications\n`;
        output += '---\n';
        
        // Page information
        pages.pages.forEach((page, index) => {
          const sortValue = getSortValue(page, sort);
          output += `Page number: ${skip ? skip + index + 1 : index + 1}\n`;
          output += `Title: ${page.title}\n`;
          output += `Sort value: ${sortValue.formatted}\n`;
          output += `Pinned: ${page.pin ? 'Yes' : 'No'}\n`;
          output += '---\n';
        });

        return {
          content: [{
            type: "text",
            text: output
          }]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: {
                  message: error instanceof Error ? error.message : 'Unknown error',
                  type: error instanceof Error ? error.constructor.name : 'Unknown',
                  timestamp: new Date().toISOString()
                }
              }, null, 2)
            }
          ],
          isError: true,
        };
      }
    }

    case "get_page": {
      try {
        const pageTitle = String(request.params.arguments?.pageTitle);
        const page = await getPage(projectName, pageTitle, cosenseSid);
        
        if (!page) {
          return {
            content: [
              {
                type: "text",
                text: `Page "${pageTitle}" not found.\nProject: ${projectName}`,
              },
            ],
            isError: true,
          };
        }

        const readablePage = toReadablePage(page);
        const formattedText = `
${readablePage.title}
Created: ${formatYmd(new Date(readablePage.created * 1000))}
Updated: ${formatYmd(new Date(readablePage.updated * 1000))}

${readablePage.lines.map(line => line.text).join('\n')}

Links:
${readablePage.links.length > 0 ? readablePage.links.map((link: string) => `- ${link}`).join('\n') : '(None)'}

Last editor:
- ${readablePage.user.displayName}

Other editors:
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
              text: `Error occurred while fetching page: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
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
                text: `An error occurred while searching.\nProject: ${projectName}\nQuery: ${query}`,
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
              text: `Error occurred while searching: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
