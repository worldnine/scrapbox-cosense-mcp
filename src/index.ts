#!/usr/bin/env node

// CLI mode detection: 引数があればCLIモード、なければMCPサーバーモード
const _firstArg = process.argv[2];
if (_firstArg) {
  const { runCli } = await import('./cli.js');
  await runCli(process.argv.slice(2));
  process.exit(0);
}

const SERVICE_LABEL = process.env.SERVICE_LABEL || "cosense (scrapbox)";
const TOOL_SUFFIX = process.env.COSENSE_TOOL_SUFFIX;
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListPromptsRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { createRequire } from "node:module";

// package.json を唯一のバージョン情報源にする（リリース時のズレ防止）
const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };
import { listPages, getPage, toReadablePage, withUserNames } from "./cosense.js";
import { isDeleteEnabled } from "./routes/handlers/delete-page.js";
import { formatYmd, formatEditorLines } from './utils/format.js';
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

/**
 * MCP サーバーを1つ組み立てる。トランスポートにはつながない。
 *
 * 関数にしてあるのは、HTTP のようにセッションごとに独立した Server が要る
 * トランスポートを足せるようにするため。stdio は従来どおり1つだけ作って使う。
 * プロセス全体で共有する設定（プロジェクト名・SID・resources の初期一覧）は
 * モジュール直下のまま、ここでは組み立てだけを行う。
 * （関数宣言ではなく式にしているのは、上の `projectName` 未設定チェックによる型の絞り込みを
 * 関数の中でも効かせるため。宣言は巻き上げられるので絞り込みが引き継がれない。）
 */
const createServer = (): Server => {
  const server = new Server(
    {
      name: "scrapbox-cosense-mcp",
      version,
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
    const [named] = await withUserNames(projectName, [getPageResult], cosenseSid);
    const formattedText = [
      `Title: ${readablePage.title}`,
      `Created: ${formatYmd(new Date(readablePage.created * 1000))}`,
      `Updated: ${formatYmd(new Date(readablePage.updated * 1000))}`,
      ...formatEditorLines(named ?? getPageResult),
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

  // この SDK は capabilities で宣言したメソッドしかハンドラ登録できないため、
  // prompts / resource templates は宣言とセットで空の list ハンドラを用意する。
  // （未登録のままにするとクライアントの probes が -32601 Method not found を受ける）
  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return { prompts: [] };
  });

  server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => {
    return { resourceTemplates: [] };
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
                description: "Content in markdown format (default) or Scrapbox syntax (when format is 'scrapbox'). Avoid duplicating the title in the body since it's automatically displayed at the top. Supports links, code blocks, lists, and emphasis.",
              },
              projectName: {
                type: "string",
                description: `Target project name. If not specified, defaults to '${projectName}'.`,
              },
              createActually: {
                type: "boolean",
                description: "Whether to actually create the page using WebSocket API. If true (default), creates the page immediately. If false, returns only the creation URL.",
              },
              format: {
                type: "string",
                enum: ["markdown", "scrapbox"],
                description: "Content format of the body. 'markdown' (default) converts Markdown to Scrapbox syntax. 'scrapbox' passes content through as-is, preserving Scrapbox-native indentation and syntax.",
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
          name: getToolName("get_smart_context"),
          description: `Get smart context for a page on ${SERVICE_LABEL}. Returns the target page and its linked pages (1-hop or 2-hop) with full content in AI-optimized format. Useful for understanding the context and related knowledge around a specific topic. Requires COSENSE_SID authentication. Uses ${projectName} project as default if projectName is not specified.`,
          inputSchema: {
            type: "object",
            properties: {
              title: {
                type: "string",
                description: "Title of the page to get context for",
              },
              hopCount: {
                type: "number",
                enum: [1, 2],
                description: "Number of link hops to include. 1 (default) returns directly linked pages. 2 returns pages linked from linked pages (larger response).",
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
          name: getToolName("insert_lines"),
          description: `Insert text after a specified line in a Scrapbox page on ${SERVICE_LABEL}. If target line not found, text is appended to the end of the page. Uses ${projectName} project as default if projectName is not specified.`,
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
                description: "Text to insert in markdown format (default) or Scrapbox syntax (when format is 'scrapbox'). Can contain multiple lines separated by newline characters.",
              },
              projectName: {
                type: "string",
                description: `Target project name. If not specified, defaults to '${projectName}'.`,
              },
              format: {
                type: "string",
                enum: ["markdown", "scrapbox"],
                description: "Content format of the text. 'markdown' (default) converts Markdown to Scrapbox syntax. 'scrapbox' passes content through as-is, preserving Scrapbox-native indentation and syntax.",
              },
            },
            required: ["pageTitle", "targetLineText", "text"],
          },
        },
        {
          name: getToolName("edit_lines"),
          description: `Replace one or more lines in a Scrapbox page on ${SERVICE_LABEL}. Matches the target by exact text and substitutes it with new content (which may span multiple lines). If targetLineText contains newline characters, it is matched as a contiguous block of lines, so any n lines can be replaced with m lines. By default only the first match is replaced; set matchAll to replace every (non-overlapping) occurrence. Returns an error if no match is found. Requires COSENSE_SID. Uses ${projectName} project as default if projectName is not specified.`,
          inputSchema: {
            type: "object",
            properties: {
              pageTitle: {
                type: "string",
                description: "Title of the page to modify",
              },
              targetLineText: {
                type: "string",
                description: "Exact text of the line(s) to replace. Matching is case-sensitive and requires full-line exact matches. If it contains newline characters, the consecutive lines are matched as a contiguous block and replaced as a whole.",
              },
              newText: {
                type: "string",
                description: "Replacement content in markdown format (default) or Scrapbox syntax (when format is 'scrapbox'). May contain multiple lines separated by newline characters.",
              },
              projectName: {
                type: "string",
                description: `Target project name. If not specified, defaults to '${projectName}'.`,
              },
              format: {
                type: "string",
                enum: ["markdown", "scrapbox"],
                description: "Content format of newText. 'markdown' (default) converts Markdown to Scrapbox syntax. 'scrapbox' passes content through as-is, preserving Scrapbox-native indentation and syntax.",
              },
              matchAll: {
                type: "boolean",
                description: "If true, replace every occurrence of the target (a single line or a contiguous block). Block matches are non-overlapping. Defaults to false (replace only the first match).",
              },
            },
            required: ["pageTitle", "targetLineText", "newText"],
          },
        },
        {
          name: getToolName("delete_lines"),
          description: `Delete one or more lines from a Scrapbox page on ${SERVICE_LABEL}. Matches the target by exact text. If targetLineText contains newline characters, it is matched as a contiguous block of lines and removed as a whole. By default only the first match is removed; set matchAll to remove every (non-overlapping) occurrence. Refuses to delete the title line (the first line), which would rename or remove the page — use delete_page for that. Returns an error if no match is found. Requires COSENSE_SID. Uses ${projectName} project as default if projectName is not specified.`,
          inputSchema: {
            type: "object",
            properties: {
              pageTitle: {
                type: "string",
                description: "Title of the page to modify",
              },
              targetLineText: {
                type: "string",
                description: "Exact text of the line(s) to delete. Matching is case-sensitive and requires full-line exact matches. If it contains newline characters, the consecutive lines are matched as a contiguous block and removed as a whole.",
              },
              projectName: {
                type: "string",
                description: `Target project name. If not specified, defaults to '${projectName}'.`,
              },
              matchAll: {
                type: "boolean",
                description: "If true, delete every occurrence of the target (a single line or a contiguous block). Block matches are non-overlapping. The operation is atomic: if any match includes the title line, the whole call is refused. Defaults to false (delete only the first match).",
              },
            },
            required: ["pageTitle", "targetLineText"],
          },
        },
        // delete_page / rewrite_page は COSENSE_ENABLE_DELETE=true のときだけ登録する。
        // ページ全体を破壊しうる操作なので、共有のMCP設定では有効にした利用者にだけ露出させる
        ...(isDeleteEnabled() ? [{
          name: getToolName("delete_page"),
          description: `Delete a page in Scrapbox project on ${SERVICE_LABEL}. Empties every line of the target page via the WebSocket patch API; Cosense automatically removes a page once all of its lines are empty. There is no undo — pass dryRun to preview what would be removed first. Errors if the page does not exist. Requires COSENSE_SID. Uses ${projectName} project as default if projectName is not specified.`,
          inputSchema: {
            type: "object",
            properties: {
              pageTitle: {
                type: "string",
                description: "Title of the page to delete",
              },
              projectName: {
                type: "string",
                description: `Target project name. If not specified, defaults to '${projectName}'.`,
              },
              dryRun: {
                type: "boolean",
                description: "If true, report the number of lines and the first few lines that would be removed without deleting anything. Defaults to false.",
              },
            },
            required: ["pageTitle"],
          },
        }, {
          name: getToolName("rewrite_page"),
          description: `Replace the entire content of a Scrapbox page on ${SERVICE_LABEL} with new content (the page title is preserved as the first line). This is a destructive, whole-page operation. Errors if the page does not exist, and rejects empty content (use delete_page to remove a page). Pass dryRun to preview before/after without changing anything. Requires COSENSE_SID and COSENSE_ENABLE_DELETE=true. Uses ${projectName} project as default if projectName is not specified.`,
          inputSchema: {
            type: "object",
            properties: {
              pageTitle: {
                type: "string",
                description: "Title of the page to rewrite",
              },
              body: {
                type: "string",
                description: "New page content in markdown format (default) or Scrapbox syntax (when format is 'scrapbox'). Do not repeat the title — it is preserved as the first line. Must not be empty.",
              },
              projectName: {
                type: "string",
                description: `Target project name. If not specified, defaults to '${projectName}'.`,
              },
              format: {
                type: "string",
                enum: ["markdown", "scrapbox"],
                description: "Content format of body. 'markdown' (default) converts Markdown to Scrapbox syntax. 'scrapbox' passes content through as-is, preserving Scrapbox-native indentation and syntax.",
              },
              dryRun: {
                type: "boolean",
                description: "If true, report the current and new line counts and previews without changing anything. Defaults to false.",
              },
            },
            required: ["pageTitle", "body"],
          },
        }] : []),
      ];
  
  
    return { tools };
  });


  // ルートのセットアップ
  setupRoutes(server, {
    projectName,
    cosenseSid: cosenseSid ?? undefined,
    toolSuffix: TOOL_SUFFIX,
  });

  return server;
};

async function main() {
  if (process.env.TRANSPORT === "http") {
    const { startHttpServer } = await import("./http-server.js");
    const allowedHosts = process.env.MCP_ALLOWED_HOSTS?.split(",").map((h) => h.trim()).filter(Boolean);
    startHttpServer(createServer, {
      port: parseInt(process.env.PORT || "3000", 10),
      ...(process.env.MCP_HTTP_HOST ? { host: process.env.MCP_HTTP_HOST } : {}),
      allowedHosts,
      allowUnauthenticated: process.env.MCP_ALLOW_UNAUTHENTICATED === "true",
    });
    return;
  }
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  // 起動拒否の理由（認証なしでの起動など）が見えるよう、stderr に出す。
  // stdio では stdout を使えないので console.error にしてある。
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
