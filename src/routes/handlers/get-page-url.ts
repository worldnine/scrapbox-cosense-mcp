import { createPageUrl } from "../../cosense.js";

export interface GetPageUrlParams {
  title: string;
  projectName?: string | undefined;
}

export async function handleGetPageUrl(
  defaultProjectName: string,
  _cosenseSid: string | undefined,
  params: GetPageUrlParams
) {
  try {
    const projectName = params.projectName || defaultProjectName;
    const title = String(params.title);
    const url = createPageUrl(projectName, title);
    
    return {
      content: [{
        type: "text",
        text: url
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: [
          'Error details:',
          `Message: ${error instanceof Error ? error.message : 'Unknown error'}`,
          `Operation: get_page_url`,
          `Project: ${params.projectName || defaultProjectName}`,
          `Title: ${params.title}`,
          `Timestamp: ${new Date().toISOString()}`
        ].join('\n')
      }],
      isError: true
    };
  }
}