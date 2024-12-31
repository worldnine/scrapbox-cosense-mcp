import { getPage, toReadablePage } from "../../cosense.js";
import { formatYmd } from '../../utils/format.js';

export interface GetPageParams {
  pageTitle: string;
}

export async function handleGetPage(
  projectName: string,
  cosenseSid: string | undefined,
  params: GetPageParams
) {
  try {
    const page = await getPage(projectName, params.pageTitle, cosenseSid);
    
    if (!page) {
      return {
        content: [{
          type: "text",
          text: [
            `Error: Page "${params.pageTitle}" not found`,
            `Operation: get_page`,
            `Project: ${projectName}`,
            `Status: 404`,
            `Timestamp: ${new Date().toISOString()}`
          ].join('\n')
        }],
        isError: true
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
      content: [{
        type: "text",
        text: formattedText
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
          `Project: ${projectName}`,
          `Page: ${params.pageTitle}`,
          `Timestamp: ${new Date().toISOString()}`
        ].join('\n')
      }],
      isError: true
    };
  }
}
