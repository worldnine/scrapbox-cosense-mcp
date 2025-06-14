import { createPageUrl } from "../../cosense.js";
import { convertMarkdownToScrapbox } from '../../utils/markdown-converter.js';

export interface CreatePageParams {
  title: string;
  body?: string | undefined;
  projectName?: string | undefined;
}

export async function handleCreatePage(
  defaultProjectName: string,
  _cosenseSid: string | undefined,
  params: CreatePageParams
) {
  try {
    const projectName = params.projectName || defaultProjectName;
    const title = String(params.title);
    const body = params.body;
    
    const convertedBody = body ? await convertMarkdownToScrapbox(body) : undefined;
    const url = createPageUrl(projectName, title, convertedBody);
    
    return {
      content: [{
        type: "text",
        text: `Created page: ${title}\nURL: ${url}`
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
          `Project: ${params.projectName || defaultProjectName}`,
          `Title: ${params.title}`,
          `Timestamp: ${new Date().toISOString()}`
        ].join('\n')
      }],
      isError: true
    };
  }
}
