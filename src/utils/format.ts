export interface PageMetadata {
  title: string;
  created?: number;
  updated?: number;
  pin?: number | boolean;
  user?: {
    id: string;
    displayName: string;
  };
  collaborators?: Array<{
    id: string;
    displayName: string;
  }>;
  words?: string[];
  lines?: string[];
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

  return `${base} (Pinned pages are shown first)`;
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
  page: PageMetadata,
  index: number,
  options: FormatPageOptions = {}
): string {
  const {
    skip = 0,
    showSort = false,
    showMatches = false,
    sortValue = null,
    showSnippet = false
  } = options;

  const lines = [
    `Page number: ${skip + index + 1}`,
    `Title: ${page.title}`
  ];

  if (page.created) {
    lines.push(`Created: ${formatYmd(new Date(page.created * 1000))}`);
  }
  if (page.updated) {
    lines.push(`Updated: ${formatYmd(new Date(page.updated * 1000))}`);
  }

  if (page.pin !== undefined) {
    lines.push(`Pinned: ${page.pin ? 'Yes' : 'No'}`);
  }

  if (showSort && sortValue) {
    lines.push(`Sort value: ${sortValue}`);
  }

  if (showMatches && page.words) {
    lines.push(`Matched words: ${page.words.join(', ')}`);
  }

  if (page.user) {
    lines.push(`Last editor: ${page.user.displayName}`);
  }

  if (page.collaborators?.length) {
    lines.push('Other editors:');
    page.collaborators
      .filter(collab => collab.id !== page.user?.id)
      .forEach(user => lines.push(`- ${user.displayName}`));
  }

  if (showSnippet && page.lines) {
    lines.push('Snippet:');
    lines.push(page.lines.join('\n'));
  }

  return lines.join('\n');
}

export interface ScrapboxPage {
  title: string;
  lastAccessed?: number;
  created?: number;
  updated?: number;
  accessed?: number;
  views?: number;
  linked?: number;
  pin?: number;
}
