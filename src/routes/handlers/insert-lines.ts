import { patch } from '@cosense/std/websocket';
import type { BaseLine } from '@cosense/types/rest';
import { convertMarkdownToScrapbox } from '../../utils/markdown-converter.js';
import { formatError } from '../../utils/format.js';

export interface InsertLinesParams {
  pageTitle: string;
  targetLineText: string;
  text: string;
  projectName?: string | undefined;
  format?: "markdown" | "scrapbox" | undefined;
  compact?: boolean | undefined;
}

export async function handleInsertLines(
  defaultProjectName: string,
  cosenseSid: string | undefined,
  params: InsertLinesParams
) {
  try {
    const projectName = params.projectName || defaultProjectName;

    if (!cosenseSid) {
      return formatError('Authentication required: COSENSE_SID is needed for page editing', {
        Operation: 'insert_lines',
        Project: projectName,
        Page: params.pageTitle,
        Timestamp: new Date().toISOString(),
      }, params.compact);
    }

    // 環境変数から設定を取得
    const convertNumberedLists = process.env.COSENSE_CONVERT_NUMBERED_LISTS === 'true';

    let convertedText: string;
    if (params.format === 'scrapbox') {
      convertedText = params.text;
    } else {
      convertedText = await convertMarkdownToScrapbox(params.text, { convertNumberedLists });
    }

    // WebSocket経由でページを更新
    let foundTarget = false;
    const result = await patch(projectName, params.pageTitle, (lines: BaseLine[]) => {
      // 対象行を検索（完全一致）
      const targetIndex = lines.findIndex((line: BaseLine) =>
        line.text === params.targetLineText
      );

      if (targetIndex >= 0) {
        foundTarget = true;
      }

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

    // patchのResult型を正しく判定
    if (!result.ok) {
      throw new Error(`WebSocket patch failed: ${String(result.err)}`);
    }

    // 成功時のレスポンス
    const insertedLinesCount = convertedText.split('\n').length;
    const targetLineFound = foundTarget ? "found" : "not found (appended to end)";

    if (params.compact) {
      return {
        content: [{
          type: "text",
          text: `inserted: ${insertedLinesCount} lines into ${params.pageTitle}`
        }]
      };
    }

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
    return formatError(
      error instanceof Error ? error.message : 'Unknown error',
      {
        Operation: 'insert_lines',
        Project: params.projectName || defaultProjectName,
        Page: params.pageTitle,
        'Target line': `"${params.targetLineText}"`,
        Timestamp: new Date().toISOString(),
      },
      params.compact
    );
  }
}
