import type { ScrapboxPage } from '../types/api.js';

export interface SortOptions {
  sort?: string | undefined;
  excludePinned?: boolean | undefined;
}

// 数値は降順、タイトルは従来のlocaleCompareによる昇順で比較する
export function comparePages(a: ScrapboxPage, b: ScrapboxPage, sort = 'updated'): number {
  switch (sort) {
    case 'created':
      return (b.created || 0) - (a.created || 0);
    case 'accessed':
      return (b.accessed || 0) - (a.accessed || 0);
    case 'linked':
      return (b.linked || 0) - (a.linked || 0);
    case 'views':
      return (b.views || 0) - (a.views || 0);
    case 'title':
      // APIの照合規則は未確認のため、既存の比較方法を維持する
      return a.title.localeCompare(b.title);
    default:
      return (b.updated || 0) - (a.updated || 0);
  }
}

export function sortPages(pages: ScrapboxPage[], options: SortOptions = {}): ScrapboxPage[] {
  const filteredPages = options.excludePinned ? pages.filter(page => !page.pin) : pages;
  return [...filteredPages].sort((a, b) => comparePages(a, b, options.sort));
}

// ピン留めだけを並べ直し、それ以外のAPI順を保って2列をマージする
export function mergePinnedPages<T extends ScrapboxPage>(pages: T[], sort = 'updated'): T[] {
  const pinned: T[] = [];
  const unpinned: T[] = [];
  for (const page of pages) {
    (page.pin != null && page.pin !== 0 ? pinned : unpinned).push(page);
  }
  pinned.sort((a, b) => comparePages(a, b, sort));

  const merged: T[] = [];
  let pinnedIndex = 0;
  for (const page of unpinned) {
    // 同値なら元の応答で先にいたピン留めを先にし、それぞれの列内の順は保つ
    while (pinnedIndex < pinned.length && comparePages(pinned[pinnedIndex]!, page, sort) <= 0) {
      merged.push(pinned[pinnedIndex++]!);
    }
    merged.push(page);
  }
  return merged.concat(pinned.slice(pinnedIndex));
}
