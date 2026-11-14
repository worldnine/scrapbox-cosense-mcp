import { type ListPagesResponse } from "../../cosense.js";
import { listPages, listPagesWithSort, withUserNames } from "../../cosense.js";
import { formatPageOutput, formatPageCompact, formatError, getSortDescription, getSortValue } from '../../utils/format.js';
import { checkProjectAllowed } from '../../utils/project.js';

export interface ListPagesParams {
  sort?: string;
  limit?: number;
  skip?: number;
  excludePinned?: boolean;
  projectName?: string | undefined;
  compact?: boolean | undefined;
}

export async function handleListPages(
  defaultProjectName: string,
  cosenseSid: string | undefined,
  params: ListPagesParams
) {
  try {
    const {
      sort = 'updated',
      limit = 1000,
      skip = 0,  // デフォルト値を設定
      excludePinned = false,
      projectName: paramsProjectName,
      compact = false
    } = params;
    const projectName = paramsProjectName || defaultProjectName;

    const notAllowed = checkProjectAllowed(projectName);
    if (notAllowed) {
      return formatError(notAllowed, {
        Operation: 'list_pages',
        Project: projectName,
        Timestamp: new Date().toISOString(),
      }, compact);
    }

    let pages;

    if (excludePinned) {
      const targetLimit = limit || 10;
      let unpinnedPages: ListPagesResponse['pages'] = [];
      let currentSkip = skip || 0;
      let firstResponse: ListPagesResponse | undefined;
      
      while (unpinnedPages.length < targetLimit) {
        const fetchedPages = await listPages(projectName, cosenseSid, {
          sort,
          limit: Math.min(targetLimit * 3, 1000),
          skip: currentSkip
        });
        
        firstResponse ??= fetchedPages;
        const newUnpinned = fetchedPages.pages.filter(page => !page.pin || page.pin === 0);
        unpinnedPages = unpinnedPages.concat(newUnpinned);
        
        currentSkip += fetchedPages.pages.length;
        if (fetchedPages.pages.length === 0 || currentSkip >= fetchedPages.count) break;
      }
      
      const actualPages = unpinnedPages.slice(0, targetLimit);
      pages = {
        ...firstResponse!,
        pages: actualPages,
        limit: actualPages.length,
        skip: skip || 0
      };
    } else {
      pages = await listPagesWithSort(
        projectName,
        {
          sort,
          limit: limit || 10,
          skip,
        },
        cosenseSid
      );
    }

    // 作成者・編集者の名前は、名前を出す通常の表示のときだけ引く（compact には出さないので要求を増やさない）
    if (!compact) {
      pages = { ...pages, pages: await withUserNames(projectName, pages.pages, cosenseSid) };
    }

    let output: string;

    const countLabel = excludePinned
      ? `${pages.pages.length} unpinned (${pages.count} total)`
      : `${pages.count}`;

    if (compact) {
      const header = `${projectName} | ${countLabel} pages | sort:${sort || 'updated'}`;
      const lines = pages.pages.map((page) => {
        const sortValue = getSortValue(page, sort);
        return formatPageCompact(page, { sortValue: sortValue.formatted });
      });
      output = [header, ...lines].join('\n');
    } else {
      output = [
        `Project: ${projectName}`,
        `Total pages: ${countLabel}`,
        `Pages fetched: ${pages.pages.length}`,
        `Pages skipped: ${pages.skip}`,
        `Sort method: ${getSortDescription(sort)}`,
        '---'
      ].join('\n') + '\n';

      output += pages.pages.map((page, index) => {
        const sortValue = getSortValue(page, sort);
        return formatPageOutput(page, index, {
          skip: skip || 0,
          showSort: true,
          sortValue: sortValue.formatted,
          showDescriptions: true
        }) + '\n---';
      }).join('\n');
    }

    return {
      content: [{
        type: "text",
        text: output
      }]
    };
  } catch (error) {
    return formatError(
      error instanceof Error ? error.message : 'Unknown error',
      {
        Operation: 'list_pages',
        Project: params.projectName || defaultProjectName,
        Sort: params.sort || 'updated',
        Limit: String(params.limit || 'default'),
        Skip: String(params.skip || '0'),
        Timestamp: new Date().toISOString(),
      },
      params.compact
    );
  }
}
