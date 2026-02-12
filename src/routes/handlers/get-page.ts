import { getPage, toReadablePage } from "../../cosense.js";
import { formatYmd } from '../../utils/format.js';

export interface GetPageParams {
  pageTitle: string;
  projectName?: string | undefined;
}

export async function handleGetPage(
  defaultProjectName: string,
  cosenseSid: string | undefined,
  params: GetPageParams
) {
  try {
    const projectName = params.projectName || defaultProjectName;
    const page = await getPage(projectName, params.pageTitle, cosenseSid);
    
    if (!page) {
      return {
        content: [{
          type: "text",
          text: [
            `Error: Page "${params.pageTitle}" not found`,
            `Operation: get_page`,
            `Project: ${params.projectName || defaultProjectName}`,
            `Status: 404`,
            `Timestamp: ${new Date().toISOString()}`
          ].join('\n')
        }],
        isError: true
      };
    }

        const readablePage = toReadablePage(page);
    
    // ページ情報を整形
    const formattedText = [
      `Title: ${readablePage.title}`,
      `Created: ${formatYmd(new Date(readablePage.created * 1000))}`,
      `Updated: ${formatYmd(new Date(readablePage.updated * 1000))}`,
      `Created user: ${readablePage.lastUpdateUser?.displayName || readablePage.user.displayName}`,
      `Last editor: ${readablePage.user.displayName}`,
      `Other editors: ${(readablePage.collaborators ?? [])
        .filter(collab =>
          collab.id !== readablePage.user.id &&
          collab.id !== readablePage.lastUpdateUser?.id
        )
        .map(user => user.displayName)
        .join(', ')}`
    ].join('\n');

    // 本文を追加
    const contentText = readablePage.lines.map(line => line.text).join('\n');

    // リンク情報を追加
    const linksText = `\nLinks:\n${readablePage.links.length > 0 
      ? readablePage.links.map((link: string) => `- ${link}`).join('\n') 
      : '(None)'}`;

    const fullText = `${formattedText}\n\n${contentText}\n${linksText}`;
    return {
      content: [{
        type: "text",
        text: fullText
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: [
          'Error details:',
          `Message: ${error instanceof Error ? error.message : 'Unknown error'}`,
          `Operation: get_page`,
          `Project: ${params.projectName || defaultProjectName}`,
          `Page: ${params.pageTitle}`,
          `Timestamp: ${new Date().toISOString()}`
        ].join('\n')
      }],
      isError: true
    };
  }
}
