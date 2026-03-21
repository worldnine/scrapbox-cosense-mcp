import { getPage, toReadablePage } from "../../cosense.js";
import { formatYmd, formatError } from '../../utils/format.js';

export interface GetPageParams {
  pageTitle: string;
  projectName?: string | undefined;
  compact?: boolean | undefined;
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
      return formatError(`Page "${params.pageTitle}" not found`, {
        Operation: 'get_page',
        Project: projectName,
        Status: '404',
        Timestamp: new Date().toISOString(),
      }, params.compact);
    }

        const readablePage = toReadablePage(page);

    // ページが未保存（persistent=false）かつタイトル行のみの場合は未作成として扱う
    const hasContent = readablePage.lines.length > 1
      || readablePage.links.length > 0;
    if (!hasContent && page.persistent === false) {
      return formatError(`Page "${params.pageTitle}" not found`, {
        Operation: 'get_page',
        Project: projectName,
        Status: '404',
        Timestamp: new Date().toISOString(),
      }, params.compact);
    }

    const contentText = readablePage.lines.map(line => line.text).join('\n');
    let fullText: string;

    if (params.compact) {
      const header = `${readablePage.title} | updated:${formatYmd(new Date(readablePage.updated * 1000))}`;
      const links = readablePage.links.length > 0
        ? `\nlinks: ${readablePage.links.join(', ')}`
        : '';
      fullText = `${header}\n${contentText}${links}`;
    } else {
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

      const linksText = `\nLinks:\n${readablePage.links.length > 0
        ? readablePage.links.map((link: string) => `- ${link}`).join('\n')
        : '(None)'}`;

      fullText = `${formattedText}\n\n${contentText}\n${linksText}`;
    }
    return {
      content: [{
        type: "text",
        text: fullText
      }]
    };
  } catch (error) {
    return formatError(
      error instanceof Error ? error.message : 'Unknown error',
      {
        Operation: 'get_page',
        Project: params.projectName || defaultProjectName,
        Page: params.pageTitle,
        Timestamp: new Date().toISOString(),
      },
      params.compact
    );
  }
}
