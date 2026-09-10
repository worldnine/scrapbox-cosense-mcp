import { patch } from '@cosense/std/websocket';
import { getPage } from '../../cosense.js';
import { convertMarkdownToScrapbox } from '../../utils/markdown-converter.js';
import { formatError, stringifyError } from '../../utils/format.js';
import { checkProjectAllowed } from '../../utils/project.js';
import { isDeleteEnabled } from './delete-page.js';

export interface RewritePageParams {
  pageTitle: string;
  body: string;
  projectName?: string | undefined;
  format?: "markdown" | "scrapbox" | undefined;
  dryRun?: boolean | undefined;
  compact?: boolean | undefined;
}

// ドライランやレスポンスで返す冒頭行の数
const PREVIEW_LINE_COUNT = 5;

export async function handleRewritePage(
  defaultProjectName: string,
  cosenseSid: string | undefined,
  params: RewritePageParams
) {
  const projectName = params.projectName || defaultProjectName;
  const errorDetails = () => ({
    Operation: 'rewrite_page',
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
        'Page rewrite is disabled. Set COSENSE_ENABLE_DELETE=true to enable rewrite_page.',
        errorDetails(),
        params.compact
      );
    }

    if (!cosenseSid) {
      return formatError(
        'Authentication required: COSENSE_SID is needed for rewriting pages',
        errorDetails(),
        params.compact
      );
    }

    // 空内容は削除の意図と区別するため拒否する（削除は delete_page の仕事）。
    // typeof で判定するのは、スキーマを無視して非文字列（数値など）が渡された場合に
    // .trim() で TypeError になるのを防ぎ、同じエラーに合流させるため
    const body = typeof params.body === 'string' ? params.body : '';
    if (body.trim() === '') {
      return formatError(
        'Empty content is not allowed. Use delete_page to remove a page.',
        errorDetails(),
        params.compact
      );
    }

    // create_page と対称に、rewrite は「存在しなければ拒否」する。
    // タイトルの typo が新規ページを黙って生む事故を防ぐ。
    const existingPage = await getPage(projectName, params.pageTitle, cosenseSid);
    if (!existingPage || !existingPage.persistent) {
      return formatError(
        `Page not found: ${params.pageTitle}`,
        errorDetails(),
        params.compact
      );
    }

    const convertNumberedLists = process.env.COSENSE_CONVERT_NUMBERED_LISTS === 'true';
    let convertedBody: string;
    if (params.format === 'scrapbox') {
      convertedBody = body;
    } else {
      convertedBody = await convertMarkdownToScrapbox(body, { convertNumberedLists });
    }

    // 先頭行はタイトル。呼び出し側の表記ではなく実際のタイトルを使う。
    // Scrapbox のページ解決は大文字小文字に寛容なため、params.pageTitle を使うと
    // タイポ表記で黙ってリネームされる可能性がある。
    const newLines = [existingPage.title, ...convertedBody.split('\n')];
    const oldLines = (existingPage.lines ?? []).map(line => line.text);
    const oldLineCount = oldLines.length;
    const newLineCount = newLines.length;
    const oldPreview = oldLines.slice(0, PREVIEW_LINE_COUNT);
    const newPreview = newLines.slice(0, PREVIEW_LINE_COUNT);

    if (params.dryRun) {
      if (params.compact) {
        return {
          content: [{
            type: "text",
            text: `dry-run: ${params.pageTitle} (${oldLineCount} -> ${newLineCount} lines)`
          }]
        };
      }

      return {
        content: [{
          type: "text",
          text: [
            'Dry run: no changes were made',
            `Operation: rewrite_page`,
            `Project: ${projectName}`,
            `Page: ${params.pageTitle}`,
            `Current lines: ${oldLineCount}`,
            `First ${oldPreview.length} current line(s):`,
            ...oldPreview.map(text => `  ${text}`),
            `New lines: ${newLineCount}`,
            `First ${newPreview.length} new line(s):`,
            ...newPreview.map(text => `  ${text}`),
            `Timestamp: ${new Date().toISOString()}`
          ].join('\n')
        }]
      };
    }

    const result = await patch(projectName, params.pageTitle, () => {
      return newLines.map(text => ({ text }));
    }, {
      sid: cosenseSid,
    });

    if (!result.ok) {
      throw new Error(`WebSocket patch failed: ${stringifyError(result.err)}`);
    }

    if (params.compact) {
      return {
        content: [{
          type: "text",
          text: `rewrote: ${params.pageTitle} (${oldLineCount} -> ${newLineCount} lines)`
        }]
      };
    }

    return {
      content: [{
        type: "text",
        text: [
          'Successfully rewrote page',
          `Operation: rewrite_page`,
          `Project: ${projectName}`,
          `Page: ${params.pageTitle}`,
          `Previous lines: ${oldLineCount}`,
          `New lines: ${newLineCount}`,
          `First ${oldPreview.length} previous line(s) (for reference):`,
          ...oldPreview.map(text => `  ${text}`),
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
