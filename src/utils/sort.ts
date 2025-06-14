import type { ScrapboxPage } from '../cosense.js';

export interface SortOptions {
  sort?: string | undefined;
  excludePinned?: boolean | undefined;
}

export function sortPages(pages: ScrapboxPage[], options: SortOptions = {}): ScrapboxPage[] {
  const { sort, excludePinned } = options;
  
  // ピン留めページのフィルタリング
  let filteredPages = excludePinned 
    ? pages.filter(page => !page.pin) 
    : pages;

  // ソート処理
  return [...filteredPages].sort((a, b) => {
    // ピン留めを考慮しないソート
    const compareValues = () => {
      switch (sort) {
        case 'updated':
          return (b.updated || 0) - (a.updated || 0);
        case 'created':
          return (b.created || 0) - (a.created || 0);
        case 'accessed':
          const aAccess = a.accessed || 0;
          const bAccess = b.accessed || 0;
          return bAccess - aAccess;
        case 'linked':
          return (b.linked || 0) - (a.linked || 0);
        case 'views':
          return (b.views || 0) - (a.views || 0);
        case 'title':
          return a.title.localeCompare(b.title);
        default:
          return (b.created || 0) - (a.created || 0);
      }
    };

    return compareValues();
  });
}
