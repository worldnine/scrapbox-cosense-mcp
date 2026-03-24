import { type ListPagesResponse } from "../../cosense.js";
import { listPages, listPagesWithSort } from "../../cosense.js";
import { formatPageOutput, formatPageCompact, formatError, getSortDescription, getSortValue } from '../../utils/format.js';

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
      sort,
      limit = 1000,
      skip = 0,  // デフォルト値を設定
      excludePinned = false,
      projectName: paramsProjectName,
      compact = false
    } = params;
    const projectName = paramsProjectName || defaultProjectName;
    let pages;

    if (excludePinned) {
      const targetLimit = limit || 10;
      let unpinnedPages: ListPagesResponse['pages'] = [];
      let currentSkip = skip || 0;
      
      while (unpinnedPages.length < targetLimit) {
        const fetchedPages = await listPages(projectName, cosenseSid, {
          ...(sort !== undefined && { sort }),
          limit: targetLimit * 3,
          skip: currentSkip
        });
        
        const newUnpinned = fetchedPages.pages.filter(page => !page.pin || page.pin === 0);
        unpinnedPages = unpinnedPages.concat(newUnpinned);
        
        if (fetchedPages.pages.length === 0) break;
        currentSkip += fetchedPages.pages.length;
      }
      
      const actualPages = unpinnedPages.slice(0, targetLimit);
      pages = {
        ...await listPages(projectName, cosenseSid, { limit: 1 }),
        pages: actualPages,
        limit: actualPages.length,
        skip: skip || 0
      };
    } else {
      pages = await listPagesWithSort(
        projectName,
        {
          ...(sort !== undefined && { sort }),
          limit: limit || 10,
          skip,
        },
        cosenseSid
      );
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
        Sort: params.sort || 'default',
        Limit: String(params.limit || 'default'),
        Skip: String(params.skip || '0'),
        Timestamp: new Date().toISOString(),
      },
      params.compact
    );
  }
}
