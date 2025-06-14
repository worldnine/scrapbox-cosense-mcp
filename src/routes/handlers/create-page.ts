import { createPageUrl } from "@/cosense.js";
import { convertMarkdownToScrapbox } from '@/utils/markdown-converter.js';

export interface CreatePageParams {
  title: string;
  body?: string | undefined;
}

export async function handleCreatePage(
  projectName: string,
  _cosenseSid: string | undefined,
  params: CreatePageParams
) {
  try {
    const title = String(params.title);
    const body = params.body;
    
    const convertedBody = body ? await convertMarkdownToScrapbox(body) : undefined;
    const url = createPageUrl(projectName, title, convertedBody);
    
    const { exec } = await import("child_process");
    exec(`open "${url}"`);

    return {
      content: [{
        type: "text",
        text: `Opening new page: ${title}\nURL: ${url}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: [
          'Error details:',
          `Message: ${error instanceof Error ? error.message : 'Unknown error'}`,
          `Operation: create_page`,
          `Project: ${projectName}`,
          `Title: ${params.title}`,
          `Timestamp: ${new Date().toISOString()}`
        ].join('\n')
      }],
      isError: true
    };
  }
}
