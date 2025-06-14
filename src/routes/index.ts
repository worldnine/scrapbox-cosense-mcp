import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { handleListPages } from '@/routes/handlers/list-pages.js';
import { handleGetPage } from '@/routes/handlers/get-page.js';
import { handleSearchPages } from '@/routes/handlers/search-pages.js';
import { handleCreatePage } from '@/routes/handlers/create-page.js';

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
          request.params.arguments || {}
        );

      case "get_page":
        return handleGetPage(
          projectName,
          cosenseSid,
          {
            pageTitle: String(request.params.arguments?.pageTitle)
          }
        );

      case "search_pages":
        return handleSearchPages(
          projectName,
          cosenseSid,
          {
            query: String(request.params.arguments?.query)
          }
        );

      case "create_page":
        return handleCreatePage(
          projectName,
          cosenseSid,
          {
            title: String(request.params.arguments?.title),
            body: (request.params.arguments?.body as string | undefined) ?? undefined
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
