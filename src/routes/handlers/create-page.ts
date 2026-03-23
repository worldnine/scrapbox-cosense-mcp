import { createPageUrl, getPage } from "../../cosense.js";
import { convertMarkdownToScrapbox } from '../../utils/markdown-converter.js';
import { formatError } from '../../utils/format.js';
import { patch } from '@cosense/std/websocket';
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

    // WebSocket APIで実際にページを作成
    if (createActually) {
      if (!cosenseSid) {
        return formatError('Authentication required: COSENSE_SID is needed for creating pages', {
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

      // ハイブリッド方式: URL作成 → WebSocket更新
      const lines = convertedBody ? convertedBody.split('\n') : [];
      const allLines = [title, ...lines];

      // WebSocket経由でページ作成
      const result = await patch(projectName, title, (_existingLines: BaseLine[]) => {
        return allLines.map(text => ({ text }));
      }, {
        sid: cosenseSid
      });

      if (!result.ok) {
        throw new Error(`WebSocket patch failed: ${String(result.err)}`);
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
