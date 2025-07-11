import { createPageUrl } from "../../cosense.js";
import { convertMarkdownToScrapbox } from '../../utils/markdown-converter.js';
import { patch } from '@cosense/std/websocket';
import type { BaseLine } from '@cosense/types/rest';

export interface CreatePageParams {
  title: string;
  body?: string | undefined;
  projectName?: string | undefined;
  createActually?: boolean | undefined;
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
    
    const convertedBody = body ? await convertMarkdownToScrapbox(body, {
      convertNumberedLists
    }) : undefined;
    
    // WebSocket APIで実際にページを作成
    if (createActually) {
      if (!cosenseSid) {
        return {
          content: [{
            type: "text",
            text: [
              'Error: Authentication required',
              'Operation: create_page',
              'Message: COSENSE_SID environment variable is required for creating pages',
              `Project: ${projectName}`,
              `Title: ${title}`,
              `Timestamp: ${new Date().toISOString()}`
            ].join('\n')
          }],
          isError: true
        };
      }

      // ハイブリッド方式: URL作成 → WebSocket更新
      const lines = convertedBody ? convertedBody.split('\n') : [];
      const allLines = [title, ...lines];
      
      // WebSocket経由でページ作成・更新
      await patch(projectName, title, (_existingLines: BaseLine[]) => {
        // 空ページまたは既存ページの場合、内容を置き換える
        return allLines.map(text => ({ text }));
      }, {
        sid: cosenseSid
      });

      const url = createPageUrl(projectName, title);
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
