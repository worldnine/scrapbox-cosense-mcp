/** 雑な型を使っている */
import { fetch } from "@whatwg-node/fetch";
const API_DOMAIN = process.env.API_DOMAIN || "coseen.ce";

// /api/pages/:projectname/search/query の型定義
type SearchQueryResponse = {
  projectName: string; // data取得先のproject名
  searchQuery: string; // 検索語句
  query: {
    words: string[]; // AND検索に使った語句
    excludes: string[]; // NOT検索に使った語句
  };
  limit: number; // 検索件数の上限
  count: number; // 検索件数
  existsExactTitleMatch: boolean;
  backend: 'elasticsearch';
  pages: {
    id: string;
    title: string;
    image: string;
    words: string[];
    lines: string[];
    created?: number;
    updated?: number;
    user?: {
      id: string;
      name: string;
      displayName: string;
      photo: string;
    };
    lastUpdateUser?: {
      id: string;
      name: string;
      displayName: string;
      photo: string;
    };
    collaborators?: {
      id: string;
      name: string;
      displayName: string;
      photo: string;
    }[];
  }[];
};

// /api/pages/:projectname/:pagetitle
type GetPageResponse = {
  id: string;
  title: string;
  lines: {
    id: string;
    text: string;
    userId: string;
    created: number;
    updated: number;
  }[];
  created: number;
  updated: number;
  links: string[];
  relatedPages: {
    links1hop: {
      title: string;
      descriptions: string[];
    }[];
  };
  user: {              // 追加: 最新の編集者情報
    id: string;
    name: string;
    displayName: string;
    photo: string;
  };
  lastUpdateUser?: {
    id: string;
    name: string;
    displayName: string;
    photo: string;
  };
  collaborators: {
    id: string;
    name: string;
    displayName: string;
    photo: string;
  }[];
  debug?: {
    error?: string;
    warning?: string;
  };
};

async function getPage(
  projectName: string,
  pageName: string,
  sid?: string,
): Promise<GetPageResponse | null> {
  try {
    const response = sid
      ? await fetch(`https://${API_DOMAIN}/api/pages/${projectName}/${encodeURIComponent(pageName)}`, {
          headers: { Cookie: `connect.sid=${sid}` },
        })
      : await fetch(
          `https://${API_DOMAIN}/api/pages/${projectName}/${encodeURIComponent(pageName)}`,
        );

    if (!response.ok) {
      console.error(`API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const page = await response.json();
    
    // レスポンスの型チェック
    if (!page || typeof page !== 'object') {
      console.error('Invalid page response format: not an object');
      return null;
    }

    const typedPage = page as GetPageResponse;
    if (!Array.isArray(typedPage.lines)) {
      return {
        ...typedPage,
        debug: {
          error: 'Invalid page response format: lines is not an array'
        }
      };
    }

    // 編集者情報が存在しない場合にデバッグ情報を追加
    if (!typedPage.user) {
      return {
        ...typedPage,
        debug: {
          warning: `Missing user information for page: ${typedPage.title}`
        }
      };
    }

    return typedPage;
  } catch (error) {
    console.error('Error fetching page:', error);
    return null;
  }
}

function toReadablePage(page: GetPageResponse): {
  title: string;
  lines: {
    id: string;
    text: string;
    userId: string;
    created: number;
    updated: number;
  }[];
  created: number;
  updated: number;
  user: {
    id: string;
    name: string;
    displayName: string;
    photo: string;
  };
  lastUpdateUser?: {
    id: string;
    name: string;
    displayName: string;
    photo: string;
  };
  collaborators: {
    id: string;
    name: string;
    displayName: string;
    photo: string;
  }[];
  links: string[];
} {
  return {
    title: page.title,
    lines: page.lines,
    created: page.created,
    updated: page.updated,
    user: page.user,
    lastUpdateUser: page.lastUpdateUser,
    collaborators: page.collaborators,
    links: page.links,
  };
}

// Scrapboxのページ型定義
type ScrapboxPage = {
  title: string;
  lastAccessed?: number;
  created?: number;
  updated?: number;
  accessed?: number;
  views?: number;
  linked?: number;
  pin?: number;
  user?: {
    id: string;
    name: string;
    displayName: string;
    photo: string;
  };
  lastUpdateUser?: {
    id: string;
    name: string;
    displayName: string;
    photo: string;
  };
};

// /api/pages/:projectname
type ListPagesResponse = {
  limit: number;
  count: number;
  skip: number;
  projectName: string;
  pages: {
    title: string;
    lastAccessed?: number;
    created?: number;
    updated?: number;
    accessed?: number;
    views?: number;
    linked?: number;
    pin?: number;
    user?: {
      id: string;
      name: string;
      displayName: string;
      photo: string;
    };
    lastUpdateUser?: {
      id: string;
      name: string;
      displayName: string;
      photo: string;
    };
  }[];
};

// デバッグ情報の型を定義
type DebugInfo = {  // 'b' が誤って入力されていたのを修正
  request_url?: string;
  params?: Record<string, string>;
  error?: string;
};

async function listPages(
  projectName: string,
  sid?: string,
  options: { limit?: number; skip?: number; sort?: string } = {}
): Promise<ListPagesResponse & { debug?: DebugInfo }> {
  try {
    // クエリパラメータの構築
    const sortValue = options.sort || 'created';
    const params = new URLSearchParams({
      limit: (options.limit || 1000).toString(),
      skip: (options.skip || 0).toString(),
      sort: sortValue
    });

    const url = `https://${API_DOMAIN}/api/pages/${projectName}?${params}`;
    
    // デバッグ情報を含めるための変数
    const debugInfo: DebugInfo = {
      request_url: url,
      params: Object.fromEntries(params.entries())
    };

    const response = sid
      ? await fetch(url, {
          headers: { Cookie: `connect.sid=${sid}` },
        })
      : await fetch(url);
    
    if (!response.ok) {
      return {
        limit: 0,
        count: 0,
        skip: 0,
        projectName: projectName,
        pages: [],
        debug: {
          ...debugInfo,
          error: `API error: ${response.status} ${response.statusText}`
        }
      };
    }

    const pages = await response.json();
    
    // 各ページの詳細情報を取得
    const pagesWithDetails = await Promise.all(
      (pages as ListPagesResponse).pages.map(async (page) => {
        const pageDetails = await getPage(projectName, page.title, sid);
        if (pageDetails) {
          return {
            ...page,
            user: pageDetails.user,
            lastUpdateUser: pageDetails.lastUpdateUser
          };
        }
        return page;
      })
    );

    return {
      ...(pages as ListPagesResponse),
      pages: pagesWithDetails,
      debug: debugInfo
    };
  } catch (error) {
    return {
      limit: 0,
      count: 0,
      skip: 0,
      projectName: projectName,
      pages: [],
      debug: {
        error: error instanceof Error ? error.message : '不明なエラー'
      }
    };
  }
}

function encodeScrapboxBody(body: string): string {
  // Scrapboxの本文用にエンコード
  return encodeURIComponent(body);
}

function createPageUrl(projectName: string, title: string, body?: string): string {
  const baseUrl = `https://${API_DOMAIN}/${projectName}/${encodeURIComponent(title)}`;
  return body ? `${baseUrl}?body=${encodeScrapboxBody(body)}` : baseUrl;
}

/**
 * プロジェクト内のページを全文検索します
 * @param projectName プロジェクト名
 * @param query 検索クエリ
 * @param sid セッションID（オプション）
 * @returns 検索結果
 * 
 * 使用例:
 * - 基本的な検索: searchPages("projectname", "検索語句")
 * - 複数語句での検索: searchPages("projectname", "word1 word2")
 * - 除外検索: searchPages("projectname", "word1 -word2")
 * - フレーズ検索: searchPages("projectname", '"exact phrase"')
 */
async function searchPages(
  projectName: string,
  query: string,
  sid?: string,
): Promise<SearchQueryResponse | null> {
  try {
    const encodedQuery = encodeURIComponent(query);
    const url = `https://${API_DOMAIN}/api/pages/${projectName}/search/query?q=${encodedQuery}`;
    
    const response = sid
      ? await fetch(url, {
          headers: { Cookie: `connect.sid=${sid}` },
        })
      : await fetch(url);

    if (!response.ok) {
      console.error(`Search API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const result = await response.json() as SearchQueryResponse;
    
    // 各ページのメタ情報を取得
    for (const page of result.pages) {
      const pageDetails = await getPage(projectName, page.title, sid);
      if (pageDetails) {
        page.created = pageDetails.created;
        page.updated = pageDetails.updated;
        page.user = pageDetails.user;
        page.lastUpdateUser = pageDetails.lastUpdateUser;
        page.collaborators = pageDetails.collaborators;
      }
    }
    
    return result;
  } catch (error) {
    console.error('Error searching pages:', error);
    return null;
  }
}

/**
 * ピン留めページを考慮してソートされたページリストを取得する
 */
async function listPagesWithSort(
  projectName: string,
  options: {
    limit: number;
    skip?: number;
    sort?: string;
  },
  sid?: string
): Promise<ListPagesResponse> {
  // 1. まず最初のlimit件を取得
  const firstResponse = await listPages(projectName, sid, {
    limit: options.limit,
    skip: options.skip || 0,
    sort: options.sort
  });

  // ピン留めページが含まれていない、もしくは
  // 要求された件数より少ない結果の場合は、
  // この結果をそのまま返す
  const pinnedPagesCount = firstResponse.pages.filter(p => (p.pin ?? 0) > 0).length;
  if (pinnedPagesCount === 0 || firstResponse.pages.length < options.limit) {
    return firstResponse;
  }

  // 2. ピン留めページが含まれている場合、
  // limit + 100件（最大ピン留め数）を取得して
  // 正確なソートを行う
  const expandedResponse = await listPages(projectName, sid, {
    limit: options.limit + 100,
    skip: options.skip || 0,
    sort: options.sort
  });

  // ソートして最初のlimit件を返す
  return {
    ...expandedResponse,
    pages: sortPages(expandedResponse.pages, options.sort).slice(0, options.limit)
  };
}

/**
 * ページリストをソートする内部関数
 */
function sortPages(pages: ScrapboxPage[], sortType?: string): ScrapboxPage[] {
  if (!sortType) return pages;

  return [...pages].sort((a, b) => {
    switch (sortType) {
      case 'updated':
        return (b.updated || 0) - (a.updated || 0);
      case 'created':
        return (b.created || 0) - (a.created || 0);
      case 'accessed':
        const aAccess = a.accessed || a.lastAccessed || 0;
        const bAccess = b.accessed || b.lastAccessed || 0;
        return bAccess - aAccess;
      case 'linked':
        return (b.linked || 0) - (a.linked || 0);
      case 'views':
        return (b.views || 0) - (a.views || 0);
      case 'title':
        return a.title.localeCompare(b.title);
      default:
        return 0;
    }
  });
}

// 型のエクスポート
export type { ListPagesResponse, ScrapboxPage };

// 関数のエクスポート
export { getPage, listPages, listPagesWithSort, toReadablePage, createPageUrl, searchPages };
