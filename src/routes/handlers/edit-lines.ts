import { patch } from '@cosense/std/websocket';
import type { BaseLine } from '@cosense/types/rest';
import { convertMarkdownToScrapbox } from '../../utils/markdown-converter.js';
import { formatError, stringifyError } from '../../utils/format.js';
import { checkProjectAllowed } from '../../utils/project.js';

export interface EditLinesParams {
  pageTitle: string;
  targetLineText: string;
  newText: string;
  projectName?: string | undefined;
  format?: "markdown" | "scrapbox" | undefined;
  matchAll?: boolean | undefined;
  compact?: boolean | undefined;
}

export async function handleEditLines(
  defaultProjectName: string,
  cosenseSid: string | undefined,
  params: EditLinesParams
) {
  const projectName = params.projectName || defaultProjectName;

  const notAllowed = checkProjectAllowed(projectName);
  if (notAllowed) {
    return formatError(notAllowed, {
      Operation: 'edit_lines',
      Project: projectName,
      Page: params.pageTitle,
      Timestamp: new Date().toISOString(),
    }, params.compact);
  }

  try {
    if (!cosenseSid) {
      return formatError('Authentication required: COSENSE_SID is needed for editing pages', {
        Operation: 'edit_lines',
        Project: projectName,
        Page: params.pageTitle,
        Timestamp: new Date().toISOString(),
      }, params.compact);
    }

    const convertNumberedLists = process.env.COSENSE_CONVERT_NUMBERED_LISTS === 'true';

    let convertedText: string;
    if (params.format === 'scrapbox') {
      convertedText = params.newText;
    } else {
      convertedText = await convertMarkdownToScrapbox(params.newText, { convertNumberedLists });
    }

    const replacementLines = convertedText.split('\n').map(text => ({ text }));
    // 改行を含む targetLineText は連続する行ブロックの完全一致として扱う。
    // 改行を含まない場合は従来どおり単一行の完全一致（targetLines の長さが 1）になる。
    const targetLines = params.targetLineText.split('\n');
    let replacedCount = 0;

    const result = await patch(projectName, params.pageTitle, (lines: BaseLine[]) => {
      // patchがコンフリクトでリトライした場合に前回の結果が残らないようリセットする
      replacedCount = 0;
      // ブロックの開始行インデックスを前から走査・非重複で収集する。
      const matchedStarts: number[] = [];
      let i = 0;
      while (i + targetLines.length <= lines.length) {
        let matched = true;
        for (let j = 0; j < targetLines.length; j++) {
          if (lines[i + j]?.text !== targetLines[j]) {
            matched = false;
            break;
          }
        }
        if (matched) {
          matchedStarts.push(i);
          if (!params.matchAll) break;
          // 非重複: マッチしたブロックの直後の行から次の探索を再開する。
          i += targetLines.length;
        } else {
          i++;
        }
      }

      if (matchedStarts.length === 0) {
        return lines;
      }

      // Replace matches from the back so indices on the left stay valid.
      let next = lines.slice() as Array<BaseLine | { text: string }>;
      for (let k = matchedStarts.length - 1; k >= 0; k--) {
        const idx = matchedStarts[k]!;
        next = [
          ...next.slice(0, idx),
          ...replacementLines,
          ...next.slice(idx + targetLines.length),
        ];
      }
      replacedCount = matchedStarts.length;
      return next as BaseLine[];
    }, {
      sid: cosenseSid,
    });

    if (!result.ok) {
      throw new Error(`WebSocket patch failed: ${stringifyError(result.err)}`);
    }

    if (replacedCount === 0) {
      return formatError(`Target line not found: "${params.targetLineText}"`, {
        Operation: 'edit_lines',
        Project: projectName,
        Page: params.pageTitle,
        Timestamp: new Date().toISOString(),
      }, params.compact);
    }

    if (params.compact) {
      return {
        content: [{
          type: "text",
          text: `edited: ${replacedCount} line(s) in ${params.pageTitle}`
        }]
      };
    }

    return {
      content: [{
        type: "text",
        text: [
          'Successfully edited line(s)',
          `Operation: edit_lines`,
          `Project: ${projectName}`,
          `Page: ${params.pageTitle}`,
          `Target line: "${params.targetLineText}"`,
          `Matches replaced: ${replacedCount}`,
          `Replacement lines: ${replacementLines.length}`,
          `Timestamp: ${new Date().toISOString()}`
        ].join('\n')
      }]
    };

  } catch (error) {
    return formatError(
      error instanceof Error ? error.message : 'Unknown error',
      {
        Operation: 'edit_lines',
        Project: projectName,
        Page: params.pageTitle,
        'Target line': `"${params.targetLineText}"`,
        Timestamp: new Date().toISOString(),
      },
      params.compact
    );
  }
}
