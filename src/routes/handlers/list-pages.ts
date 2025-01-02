import { type ListPagesResponse } from "../../cosense.js";
import { listPages, listPagesWithSort } from "../../cosense.js";
import { formatPageOutput, getSortDescription, getSortValue } from '../../utils/format.js';

export interface ListPagesParams {
  sort?: string;
  limit?: number;
  skip?: number;
  excludePinned?: boolean;
}

export async function handleListPages(
  projectName: string,
  cosenseSid: string | undefined,
  params: ListPagesParams
) {
  try {
    const {
      sort,
      limit = 1000,
      skip = 0,  // デフォルト値を設定
      excludePinned = false
    } = params;
    let pages;

    if (excludePinned) {
      const targetLimit = limit || 10;
      let unpinnedPages: ListPagesResponse['pages'] = [];
      let currentSkip = skip || 0;
      
      while (unpinnedPages.length < targetLimit) {
        const fetchedPages = await listPages(projectName, cosenseSid, {
          sort,
          limit: targetLimit * 3,
          skip: currentSkip
        });
        
        const newUnpinned = fetchedPages.pages.filter(page => !page.pin || page.pin === 0);
        unpinnedPages = unpinnedPages.concat(newUnpinned);
        
        if (fetchedPages.pages.length === 0) break;
        currentSkip += fetchedPages.pages.length;
      }
      
      pages = {
        ...await listPages(projectName, cosenseSid, { limit: 1 }),
        pages: unpinnedPages.slice(0, targetLimit),
        limit: targetLimit,
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

    let output = [
      `Project: ${projectName}`,
      `Total pages: ${pages.count}`,
      `Pages fetched: ${pages.limit}`,
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
        showDescriptions: true  // 冒頭5行を表示するオプションを有効化
      }) + '\n---';
    }).join('\n');

    return {
      content: [{
        type: "text",
        text: output
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: [
          'Error details:',
          `Message: ${error instanceof Error ? error.message : 'Unknown error'}`,
          `Operation: list_pages`,
          `Project: ${projectName}`,
          `Sort: ${params.sort || 'default'}`,
          `Limit: ${params.limit || 'default'}`,
          `Skip: ${params.skip || '0'}`,
          `ExcludePinned: ${params.excludePinned}`,
          `Timestamp: ${new Date().toISOString()}`
        ].join('\n')
      }],
      isError: true
    };
  }
}
