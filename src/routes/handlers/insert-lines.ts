import { patch } from '@cosense/std/websocket';
import type { BaseLine } from '@cosense/types/rest';
import { convertMarkdownToScrapbox } from '../../utils/markdown-converter.js';

export interface InsertLinesParams {
  pageTitle: string;
  targetLineText: string;
  text: string;
  projectName?: string | undefined;
}

export async function handleInsertLines(
  defaultProjectName: string,
  cosenseSid: string | undefined,
  params: InsertLinesParams
) {
  try {
    const projectName = params.projectName || defaultProjectName;
    
    if (!cosenseSid) {
      return {
        content: [{
          type: "text",
          text: [
            'Error: Authentication required',
            'Operation: insert_lines',
            'Message: COSENSE_SID environment variable is required for page editing',
            `Project: ${projectName}`,
            `Page: ${params.pageTitle}`,
            `Timestamp: ${new Date().toISOString()}`
          ].join('\n')
        }],
        isError: true
      };
    }

    // 環境変数から設定を取得
    const convertNumberedLists = process.env.COSENSE_CONVERT_NUMBERED_LISTS === 'true';
    
    // マークダウンをScrapbox記法に変換
    const convertedText = await convertMarkdownToScrapbox(params.text, {
      convertNumberedLists
    });

    // WebSocket経由でページを更新
    const result = await patch(projectName, params.pageTitle, (lines: BaseLine[]) => {
      // 対象行を検索
      const targetIndex = lines.findIndex((line: BaseLine) => 
        line.text.includes(params.targetLineText)
      );
      
      // 挿入位置を決定（見つからない場合は末尾）
      const insertIndex = targetIndex >= 0 ? targetIndex + 1 : lines.length;
      
      // 新しいテキストを行に分割
      const newLines = convertedText.split('\n').map(text => ({ text }));
      
      // 行を再構築
      return [
        ...lines.slice(0, insertIndex),
        ...newLines,
        ...lines.slice(insertIndex)
      ];
    }, {
      sid: cosenseSid
    });

    // 成功時のレスポンス
    const insertedLinesCount = convertedText.split('\n').length;
    const targetLineFound = result ? "found" : "not found (appended to end)";
    
    return {
      content: [{
        type: "text",
        text: [
          'Successfully inserted lines into page',
          `Operation: insert_lines`,
          `Project: ${projectName}`,
          `Page: ${params.pageTitle}`,
          `Target line: "${params.targetLineText}" (${targetLineFound})`,
          `Inserted lines: ${insertedLinesCount}`,
          `Timestamp: ${new Date().toISOString()}`
        ].join('\n')
      }]
    };

  } catch (error) {
    return {
      content: [{
        type: "text",
        text: [
          'Error details:',
          `Message: ${error instanceof Error ? error.message : 'Unknown error'}`,
          `Operation: insert_lines`,
          `Project: ${params.projectName || defaultProjectName}`,
          `Page: ${params.pageTitle}`,
          `Target line: "${params.targetLineText}"`,
          `Timestamp: ${new Date().toISOString()}`
        ].join('\n')
      }],
      isError: true
    };
  }
}