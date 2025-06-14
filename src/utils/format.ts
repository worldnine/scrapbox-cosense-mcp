// 基本的なページ型を定義
export interface BasePage {
  title: string;
  created?: number | undefined;
  updated?: number | undefined;
  pin?: number | undefined;
  user?: {
    id: string;
    name: string;
    displayName: string;
    photo: string;
  } | undefined;
  lastUpdateUser?: {
    id: string;
    name: string;
    displayName: string;
    photo: string;
  } | undefined;
  lastAccessed?: number | undefined;
  accessed?: number | undefined;
  views?: number | undefined;
  linked?: number | undefined;
}

// 検索結果用の拡張ページ型
interface ExtendedPage extends BasePage {
  words?: string[] | undefined;
  lines?: string[] | undefined;
  collaborators?: Array<{
    id: string;
    name: string;
    displayName: string;
    photo: string;
  }> | undefined;
  descriptions?: string[] | undefined;  // 冒頭5行を追加
}

export interface PageMetadata {
  title: string;
  created?: number | undefined;
  updated?: number | undefined;
  pin?: number | boolean | undefined;
  user?: {
    id: string;
    name: string;
    displayName: string;
    photo: string;
  } | undefined;
  lastUpdateUser?: {
    id: string;
    name: string;
    displayName: string;
    photo: string;
  } | undefined;
  collaborators?: Array<{
    id: string;
    displayName: string;
  }> | undefined;
  words?: string[] | undefined;
  lines?: string[] | undefined;
  debug?: {
    warning?: string;
    error?: string;
  } | undefined;
}

export interface FormatPageOptions {
  skip?: number;
  showSort?: boolean;
  showMatches?: boolean;
  sortValue?: string | null;
  showSnippet?: boolean;
}

export function formatYmd(date: Date): string {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  return `${y}/${m}/${d}`;
}

export function getSortDescription(sortMethod: string | undefined): string {
  const base = {
    updated: "Sorted by last updated",
    created: "Sorted by creation date",
    accessed: "Sorted by last accessed",
    linked: "Sorted by number of incoming links",
    views: "Sorted by view count",
    title: "Sorted by title"
  }[sortMethod || ''] || "Default order";

  return `${base}`;
}

export function getSortValue(page: ScrapboxPage, sortMethod: string | undefined): { 
  value: number | string | null; 
  formatted: string;
} {
  switch (sortMethod) {
    case 'updated':
      return { 
        value: page.updated || 0, 
        formatted: page.updated ? formatYmd(new Date(page.updated * 1000)) : 'Not available' 
      };
    case 'created':
      return { 
        value: page.created || 0, 
        formatted: page.created ? formatYmd(new Date(page.created * 1000)) : 'Not available' 
      };
    case 'accessed':
      const accessTime = page.accessed || page.lastAccessed || 0;
      return { 
        value: accessTime, 
        formatted: accessTime ? formatYmd(new Date(accessTime * 1000)) : 'Not available' 
      };
    case 'linked':
      return { 
        value: page.linked || 0, 
        formatted: String(page.linked || 0) 
      };
    case 'views':
      return { 
        value: page.views || 0, 
        formatted: String(page.views || 0) 
      };
    case 'title':
      return { 
        value: page.title, 
        formatted: page.title 
      };
    default:
      return { 
        value: null, 
        formatted: 'Not specified' 
      };
  }
}

export function formatPageOutput(
  page: ExtendedPage,
  index: number,
  options: {
    skip?: number,
    showSort?: boolean,
    sortValue?: string,
    showMatches?: boolean,
    showSnippet?: boolean,
    isSearchResult?: boolean,  // 追加: 検索結果かどうかのフラグ
    showDescriptions?: boolean  // 冒頭5行表示オプションを追加
  } = {}
): string {
  const lines = [
    `Page number: ${(options.skip || 0) + index + 1}`,
    `Title: ${page.title}`
  ];

  // 検索結果以外の場合のみ日付を表示
  if (!options.isSearchResult) {
    lines.push(
      `Created: ${formatYmd(new Date((page.created || 0) * 1000))}`,
      `Updated: ${formatYmd(new Date((page.updated || 0) * 1000))}`
    );
  }

  lines.push(`Pinned: ${page.pin ? 'Yes' : 'No'}`);

  if (options.showMatches && page.words) {
    lines.push(`Matched words: ${page.words.join(', ')}`);
  }

  if (options.showSort && options.sortValue) {
    lines.push(`Sort value: ${options.sortValue}`);
  }

  // 作成者の表示
  if (page.user) {
    lines.push(`Created user: ${page.user.displayName}`);
  }

  // 最終更新者の表示
  if (page.lastUpdateUser) {
    lines.push(`Last editor: ${page.lastUpdateUser.displayName}`);
  }

  if (page.collaborators && page.collaborators.length > 0) {
    const uniqueCollaborators = page.collaborators
      .filter(collab => 
        collab.id !== page.user?.id && 
        collab.id !== page.lastUpdateUser?.id
      )
      .map(collab => collab.displayName)
      .filter((value, index, self) => self.indexOf(value) === index);

    if (uniqueCollaborators.length > 0) {
      lines.push(`Other editors: ${uniqueCollaborators.join(', ')}`);
    }
  }

  if (options.showSnippet && page.lines) {
    lines.push('Snippet:');
    lines.push(page.lines.join('\n'));
  }

  if (options.showDescriptions && page.descriptions?.length) {
    lines.push('Description:');
    lines.push(page.descriptions.join('\n'));
  }

  return lines.join('\n');
}

// ScrapboxPageインターフェースをBasePageから継承
export interface ScrapboxPage extends BasePage {}
