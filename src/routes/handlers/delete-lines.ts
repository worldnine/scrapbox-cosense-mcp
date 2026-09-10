import { patch } from '@cosense/std/websocket';
import type { BaseLine } from '@cosense/types/rest';
import { formatError, stringifyError } from '../../utils/format.js';
import { checkProjectAllowed } from '../../utils/project.js';

export interface DeleteLinesParams {
  pageTitle: string;
  targetLineText: string;
  projectName?: string | undefined;
  matchAll?: boolean | undefined;
  compact?: boolean | undefined;
}

export async function handleDeleteLines(
  defaultProjectName: string,
  cosenseSid: string | undefined,
  params: DeleteLinesParams
) {
  const projectName = params.projectName || defaultProjectName;

  const notAllowed = checkProjectAllowed(projectName);
  if (notAllowed) {
    return formatError(notAllowed, {
      Operation: 'delete_lines',
      Project: projectName,
      Page: params.pageTitle,
      Timestamp: new Date().toISOString(),
    }, params.compact);
  }

  try {
    if (!cosenseSid) {
      return formatError('Authentication required: COSENSE_SID is needed for editing pages', {
        Operation: 'delete_lines',
        Project: projectName,
        Page: params.pageTitle,
        Timestamp: new Date().toISOString(),
      }, params.compact);
    }

    // 改行を含む targetLineText は連続する行ブロックの完全一致として扱う。
    const targetLines = params.targetLineText.split('\n');
    let deletedMatchCount = 0;
    let deletedLineCount = 0;
    let wouldDeleteTitle = false;

    const result = await patch(projectName, params.pageTitle, (lines: BaseLine[]) => {
      // patch がコンフリクトでリトライした場合に前回の結果が残らないようリセットする
      deletedMatchCount = 0;
      deletedLineCount = 0;
      wouldDeleteTitle = false;

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

      const indicesToDelete = new Set<number>();
      for (const start of matchedStarts) {
        for (let j = 0; j < targetLines.length; j++) {
          indicesToDelete.add(start + j);
        }
      }

      // 先頭行はタイトル。削除するとページのリネーム（または全行削除による消滅）になるため拒否する。
      // delete_lines はオプトイン制でないので、ここが delete_page への抜け穴になってはならない。
      if (indicesToDelete.has(0)) {
        wouldDeleteTitle = true;
        return lines;
      }

      const next = lines.filter((_, idx) => !indicesToDelete.has(idx));

      // 念のため: 全行が消える削除も拒否する（Cosense がページを自動削除するため）。
      if (next.length === 0) {
        wouldDeleteTitle = true;
        return lines;
      }

      deletedMatchCount = matchedStarts.length;
      deletedLineCount = indicesToDelete.size;
      return next;
    }, {
      sid: cosenseSid,
    });

    if (!result.ok) {
      throw new Error(`WebSocket patch failed: ${stringifyError(result.err)}`);
    }

    if (wouldDeleteTitle) {
      return formatError(
        'Refusing to delete the title line: this would rename or remove the page itself. Use delete_page (requires COSENSE_ENABLE_DELETE=true) to remove a page.',
        {
          Operation: 'delete_lines',
          Project: projectName,
          Page: params.pageTitle,
          'Target line': `"${params.targetLineText}"`,
          Timestamp: new Date().toISOString(),
        },
        params.compact
      );
    }

    if (deletedMatchCount === 0) {
      return formatError(`Target line not found: "${params.targetLineText}"`, {
        Operation: 'delete_lines',
        Project: projectName,
        Page: params.pageTitle,
        Timestamp: new Date().toISOString(),
      }, params.compact);
    }

    if (params.compact) {
      return {
        content: [{
          type: "text",
          text: `deleted: ${deletedLineCount} line(s) in ${params.pageTitle}`
        }]
      };
    }

    return {
      content: [{
        type: "text",
        text: [
          'Successfully deleted line(s)',
          `Operation: delete_lines`,
          `Project: ${projectName}`,
          `Page: ${params.pageTitle}`,
          `Target: "${params.targetLineText}"`,
          `Matches removed: ${deletedMatchCount}`,
          `Lines removed: ${deletedLineCount}`,
          `Timestamp: ${new Date().toISOString()}`
        ].join('\n')
      }]
    };

  } catch (error) {
    return formatError(
      error instanceof Error ? error.message : 'Unknown error',
      {
        Operation: 'delete_lines',
        Project: projectName,
        Page: params.pageTitle,
        'Target line': `"${params.targetLineText}"`,
        Timestamp: new Date().toISOString(),
      },
      params.compact
    );
  }
}
