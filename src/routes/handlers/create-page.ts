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
    
    // 環境変数から設定を取得
    const convertNumberedLists = process.env.COSENSE_CONVERT_NUMBERED_LISTS !== 'false';
    const removeTitle = process.env.COSENSE_REMOVE_TITLE_FROM_BODY !== 'false';
    
    const convertedBody = body ? await convertMarkdownToScrapbox(body, {
      convertNumberedLists,
      removeTitle
    }) : undefined;
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
