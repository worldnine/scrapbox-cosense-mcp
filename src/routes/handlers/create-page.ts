import { createPageUrl, getPage } from "../../cosense.js";
import { convertMarkdownToScrapbox } from '../../utils/markdown-converter.js';
import { formatError } from '../../utils/format.js';
import { checkProjectAllowed } from '../../utils/project.js';
import { writePage } from '../../page-writer.js';
import { resolveCredential } from '../../utils/auth.js';
import type { BaseLine } from '@cosense/types/rest';

export interface CreatePageParams {
  title: string;
  body?: string | undefined;
  projectName?: string | undefined;
  createActually?: boolean | undefined;
  format?: "markdown" | "scrapbox" | undefined;
  compact?: boolean | undefined;
}

export async function handleCreatePage(
  defaultProjectName: string,
  cosenseSid: string | undefined,
  params: CreatePageParams
) {
  try {
    const projectName = params.projectName || defaultProjectName;

    const notAllowed = checkProjectAllowed(projectName);
    if (notAllowed) {
      return formatError(notAllowed, {
        Operation: 'create_page',
        Project: projectName,
        Title: String(params.title),
        Timestamp: new Date().toISOString(),
      }, params.compact);
    }

    const title = String(params.title);
    const body = params.body;
    const createActually = params.createActually !== false; // デフォルトtrue

    // 環境変数から設定を取得
    const convertNumberedLists = process.env.COSENSE_CONVERT_NUMBERED_LISTS === 'true';

    let convertedBody: string | undefined;
    if (body) {
      if (params.format === 'scrapbox') {
        convertedBody = body;
      } else {
        convertedBody = await convertMarkdownToScrapbox(body, { convertNumberedLists });
      }
    }

    // 実際にページを作成する（PAT は編集 API、SID は websocket。page-writer.ts）
    if (createActually) {
      if (!resolveCredential(projectName, cosenseSid)) {
        return formatError('Authentication required: COSENSE_PAT or COSENSE_SID is needed for creating pages', {
          Operation: 'create_page',
          Project: projectName,
          Title: title,
          Timestamp: new Date().toISOString(),
        }, params.compact);
      }

      // 既存ページの存在チェック
      const existingPage = await getPage(projectName, title, cosenseSid);
      if (existingPage && existingPage.persistent) {
        return formatError(`Page already exists: ${title}. Use insert_lines to modify existing pages.`, {
          Operation: 'create_page',
          Project: projectName,
          Title: title,
          Timestamp: new Date().toISOString(),
        }, params.compact);
      }

      const lines = convertedBody ? convertedBody.split('\n') : [];
      const allLines = [title, ...lines];

      const result = await writePage(projectName, title, (_existingLines: BaseLine[]) => {
        return allLines.map(text => ({ text }));
      }, cosenseSid);

      if (!result.ok) {
        throw new Error(`Page write failed: ${result.err}`);
      }

      const url = createPageUrl(projectName, title);
      if (params.compact) {
        return {
          content: [{
            type: "text",
            text: `created: ${title} | ${url}`
          }]
        };
      }
      return {
        content: [{
          type: "text",
          text: [
            'Successfully created page',
            `Operation: create_page`,
            `Project: ${projectName}`,
            `Title: ${title}`,
            `Lines: ${allLines.length}`,
            `URL: ${url}`,
            `Timestamp: ${new Date().toISOString()}`
          ].join('\n')
        }]
      };
    }

    // 従来のURL生成のみの動作
    const url = createPageUrl(projectName, title, convertedBody);
    if (params.compact) {
      return {
        content: [{
          type: "text",
          text: `created: ${title} | ${url}`
        }]
      };
    }
    return {
      content: [{
        type: "text",
        text: `Created page: ${title}\nURL: ${url}`
      }]
    };
  } catch (error) {
    return formatError(
      error instanceof Error ? error.message : 'Unknown error',
      {
        Operation: 'create_page',
        Project: params.projectName || defaultProjectName,
        Title: params.title,
        Timestamp: new Date().toISOString(),
      },
      params.compact
    );
  }
}
