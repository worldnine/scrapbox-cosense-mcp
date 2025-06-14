import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { handleListPages } from './handlers/list-pages.js';
import { handleGetPage } from './handlers/get-page.js';
import { handleSearchPages } from './handlers/search-pages.js';
import { handleCreatePage } from './handlers/create-page.js';
import { handleGetPageUrl } from './handlers/get-page-url.js';

export function setupRoutes(
  server: Server,
  config: {
    projectName: string;
    cosenseSid?: string | undefined;
  }
) {
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { projectName, cosenseSid } = config;

    switch (request.params.name) {
      case "list_pages":
        return handleListPages(
          projectName,
          cosenseSid,
          {
            ...request.params.arguments || {},
            projectName: request.params.arguments?.projectName as string | undefined
          }
        );

      case "get_page":
        return handleGetPage(
          projectName,
          cosenseSid,
          {
            pageTitle: String(request.params.arguments?.pageTitle),
            projectName: request.params.arguments?.projectName as string | undefined
          }
        );

      case "search_pages":
        return handleSearchPages(
          projectName,
          cosenseSid,
          {
            query: String(request.params.arguments?.query),
            projectName: request.params.arguments?.projectName as string | undefined
          }
        );

      case "create_page":
        return handleCreatePage(
          projectName,
          cosenseSid,
          {
            title: String(request.params.arguments?.title),
            body: (request.params.arguments?.body as string | undefined) ?? undefined,
            projectName: request.params.arguments?.projectName as string | undefined
          }
        );

      case "get_page_url":
        return handleGetPageUrl(
          projectName,
          cosenseSid,
          {
            title: String(request.params.arguments?.title),
            projectName: request.params.arguments?.projectName as string | undefined
          }
        );

      default:
        return {
          content: [{
            type: "text",
            text: [
              'Error details:',
              'Message: Unknown tool requested',
              `Tool: ${request.params.name}`,
              `Timestamp: ${new Date().toISOString()}`
            ].join('\n')
          }],
          isError: true
        };
    }
  });
}
