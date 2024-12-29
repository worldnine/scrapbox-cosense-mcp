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
  collaborators: {
    id: string;
    name: string;
    displayName: string;
    photo: string;
  }[];
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
      console.error('Invalid page response format: lines is not an array');
      return null;
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
    collaborators: page.collaborators,
    links: page.links,
  };
}

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
    return {
      ...(pages as ListPagesResponse),
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

    const result = await response.json();
    return result as SearchQueryResponse;
  } catch (error) {
    console.error('Error searching pages:', error);
    return null;
  }
}

export { getPage, listPages, toReadablePage, createPageUrl, searchPages };
