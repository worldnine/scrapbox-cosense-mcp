import { patch } from '@cosense/std/websocket';
import { getPage } from '../../cosense.js';
import { formatError, stringifyError } from '../../utils/format.js';
import { checkProjectAllowed } from '../../utils/project.js';

export interface DeletePageParams {
  pageTitle: string;
  projectName?: string | undefined;
  dryRun?: boolean | undefined;
  compact?: boolean | undefined;
}

// ドライランで返す冒頭行の数
const PREVIEW_LINE_COUNT = 5;

export function isDeleteEnabled(): boolean {
  return process.env.COSENSE_ENABLE_DELETE === 'true';
}

export async function handleDeletePage(
  defaultProjectName: string,
  cosenseSid: string | undefined,
  params: DeletePageParams
) {
  const projectName = params.projectName || defaultProjectName;
  const errorDetails = () => ({
    Operation: 'delete_page',
    Project: projectName,
    Page: params.pageTitle,
    Timestamp: new Date().toISOString(),
  });

  const notAllowed = checkProjectAllowed(projectName);
  if (notAllowed) {
    return formatError(notAllowed, errorDetails(), params.compact);
  }

  try {
    // ツール登録側でもゲートしているが、CLIや直接呼び出しに備えて実行時にも確認する
    if (!isDeleteEnabled()) {
      return formatError(
        'Page deletion is disabled. Set COSENSE_ENABLE_DELETE=true to enable delete_page.',
        errorDetails(),
        params.compact
      );
    }

    if (!cosenseSid) {
      return formatError(
        'Authentication required: COSENSE_SID is needed for deleting pages',
        errorDetails(),
        params.compact
      );
    }

    // 存在チェック。create_page の persistent チェックと対称にする。
    // 存在しないページでもAPIはタイトル行だけを持つレスポンスを返すため、
    // 行数だけでは存在を判定できない
    const existingPage = await getPage(projectName, params.pageTitle, cosenseSid);
    if (!existingPage || !existingPage.persistent) {
      return formatError(
        `Page not found: ${params.pageTitle}`,
        errorDetails(),
        params.compact
      );
    }

    const lines = existingPage.lines ?? [];
    const lineCount = lines.length;
    const preview = lines.slice(0, PREVIEW_LINE_COUNT).map(line => line.text);

    if (params.dryRun) {
      if (params.compact) {
        return {
          content: [{
            type: "text",
            text: `dry-run: ${params.pageTitle} (${lineCount} lines) | ${preview.join(' / ')}`
          }]
        };
      }

      return {
        content: [{
          type: "text",
          text: [
            'Dry run: no changes were made',
            `Operation: delete_page`,
            `Project: ${projectName}`,
            `Page: ${params.pageTitle}`,
            `Lines to be removed: ${lineCount}`,
            `First ${preview.length} line(s):`,
            ...preview.map(text => `  ${text}`),
            `Timestamp: ${new Date().toISOString()}`
          ].join('\n')
        }]
      };
    }

    // 全行を空配列にする。Cosenseは全ての行が空になったページを自動的に削除する
    const result = await patch(projectName, params.pageTitle, () => [], {
      sid: cosenseSid,
    });

    if (!result.ok) {
      throw new Error(`WebSocket patch failed: ${stringifyError(result.err)}`);
    }

    if (params.compact) {
      return {
        content: [{
          type: "text",
          text: `deleted: ${params.pageTitle} (${lineCount} lines)`
        }]
      };
    }

    return {
      content: [{
        type: "text",
        text: [
          'Successfully deleted page',
          `Operation: delete_page`,
          `Project: ${projectName}`,
          `Page: ${params.pageTitle}`,
          `Removed lines: ${lineCount}`,
          `Timestamp: ${new Date().toISOString()}`
        ].join('\n')
      }]
    };

  } catch (error) {
    return formatError(
      error instanceof Error ? error.message : 'Unknown error',
      errorDetails(),
      params.compact
    );
  }
}
