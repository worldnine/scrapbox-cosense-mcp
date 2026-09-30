import { fetch } from "@whatwg-node/fetch";
import { sortPages } from './utils/sort.js';
import { credentialHeaders, resolveCredential } from './utils/auth.js';
const API_DOMAIN = process.env.API_DOMAIN || "scrapbox.io";

/**
 * 資格情報（PAT・Service Account・SID）を付けて GET する。
 * 資格情報が無ければ何も付けない（公開プロジェクトはそのまま読める）。
 */
function fetchWithCredential(url: string, sid?: string) {
  const headers = credentialHeaders(resolveCredential(sid));
  return Object.keys(headers).length > 0 ? fetch(url, { headers }) : fetch(url);
}

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
  debug?: {  // デバッグ情報を追加
    request_url?: string;
    query?: string;
    total_results?: number;
    error?: string;
  };
};

// /api/pages/v2/:projectname/:pagetitle
// v1 との違いは relatedPages（関連ページリスト）を返さないことだけ。使っていない上に応答の大半を占めるため v2 を使う
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
  } | undefined;
  collaborators: {
    id: string;
    name: string;
    displayName: string;
    photo: string;
  }[];
  /** このページを編集した人。API は ID だけを返す（名前は withUserNames で付ける） */
  users?: { id: string }[] | undefined;
  persistent?: boolean | undefined;
  debug?: {
    error?: string;
    warning?: string;
  } | undefined;
};

async function getPage(
  projectName: string,
  pageName: string,
  sid?: string,
): Promise<GetPageResponse | null> {
  try {
    const url = `https://${API_DOMAIN}/api/pages/v2/${projectName}/${encodeURIComponent(pageName)}`;

    const response = await fetchWithCredential(url, sid);

    if (!response.ok) {
      return null;
    }

    const page = await response.json();
    
    // レスポンスの型チェック
    if (!page || typeof page !== 'object') {
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

    // userとlastUpdateUserの整合性チェック
    if (!typedPage.user && typedPage.lastUpdateUser) {
      // lastUpdateUserが存在するがuserが存在しない場合
      return {
        ...typedPage,
        user: typedPage.lastUpdateUser,
        debug: {
          warning: `Using lastUpdateUser as fallback for user information on page: ${typedPage.title}`
        }
      };
    } else if (!typedPage.user) {
      // どちらの情報も存在しない場合
      return {
        ...typedPage,
        debug: {
          warning: `Missing both user and lastUpdateUser information for page: ${typedPage.title}`
        }
      };
    }

    return typedPage;
  } catch (error) {
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
  } | undefined;
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
    lastUpdateUser: page.lastUpdateUser ?? undefined,
    collaborators: page.collaborators ?? [],
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
    lastAccessed?: number | undefined;
    created?: number | undefined;
    updated?: number | undefined;
    accessed?: number | undefined;
    views?: number | undefined;
    linked?: number | undefined;
    pin?: number | undefined;
    /** 冒頭の最大5行（ページのカードに出る本文） */
    descriptions?: string[] | undefined;
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
    /** このページを編集した人。一覧の API は ID だけを返す */
    users?: { id: string }[] | undefined;
    /** users を名前に引き直したもの（withUserNames が付ける） */
    collaborators?: {
      id: string;
      name: string;
      displayName: string;
      photo: string;
    }[] | undefined;
  }[];
};

// デバッグ情報の型を拡張
type DebugInfo = {
  request_url?: string;
  params?: Record<string, string>;
  error?: string;
  originalCount?: number;
  filteredCount?: number;
  appliedSort?: string;
  excludedPinned?: boolean;
  total_results?: number;
};

async function listPages(
  projectName: string,
  sid?: string,
  options: { limit?: number | undefined; skip?: number | undefined; sort?: string | undefined; excludePinned?: boolean | undefined } = {}
): Promise<ListPagesResponse & { debug?: DebugInfo }> {
  try {
    const { sort, excludePinned } = options;
    
    // クエリパラメータの構築
    const sortValue = options.sort || 'updated';
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

    const response = await fetchWithCredential(url, sid);
    
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

    // 一覧の API は冒頭5行（descriptions）・作成日・更新日・ピン・閲覧数などを最初から返す。
    // 以前はページごとに詳細を取り直していたが、1回の一覧が数百〜千件の要求になり、
    // サーバー起動のたびにも100件が一斉に飛んでいた。一覧に無いのは作成者と編集者だけで、
    // それは get_page で見られる
    const pages = await response.json() as ListPagesResponse;

    // ソートとフィルタリングを適用
    const sortedPages = sortPages(pages.pages, { 
      sort: sort ?? undefined, 
      excludePinned: excludePinned ?? undefined 
    });

    return {
      ...pages,
      pages: sortedPages,
      debug: {
        ...debugInfo,
        originalCount: pages.pages.length,
        filteredCount: sortedPages.length,
        appliedSort: sort || 'created',
        excludedPinned: excludePinned || false
      }
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
  sid?: string
): Promise<SearchQueryResponse | null> {
  const encodedQuery = encodeURIComponent(query);
  const url = `https://${API_DOMAIN}/api/pages/${projectName}/search/query?q=${encodedQuery}`;
  
  const debugInfo = {
    request_url: url,
    searchQuery: query,
  };

  const response = await fetchWithCredential(url, sid);

  if (!response.ok) {
    return {
      projectName,
      searchQuery: query,
      query: { words: [], excludes: [] },
      limit: 0,
      count: 0,
      existsExactTitleMatch: false,
      backend: 'elasticsearch',
      pages: [],
      debug: {
        ...debugInfo,
        error: `Search API error: ${response.status} ${response.statusText}`
      }
    };
  }

  const result = await response.json();
  return {
    projectName,
    searchQuery: query,
    query: result.query,
    limit: result.limit,
    count: result.count,
    existsExactTitleMatch: result.existsExactTitleMatch,
    backend: result.backend,
    pages: result.pages,
    debug: {
      ...debugInfo,
      total_results: result.pages.length
    }
  };
}

/**
 * ピン留めページを考慮してソートされたページリストを取得する
 */
async function listPagesWithSort(
  projectName: string,
  options: {
    limit: number;
    skip: number;
    sort?: string | undefined;
    excludePinned?: boolean | undefined;
  },
  sid?: string
): Promise<ListPagesResponse> {
  const skip = options.skip || 0;
  const limit = options.limit;
  const fetchSize = limit + skip + 100; // skip + limit + 余裕を持って取得

  // 1. より多くのページを一度に取得
  const response = await listPages(projectName, sid, {
    limit: fetchSize,
    skip: 0, // 最初から取得して後でskipを適用
    excludePinned: options.excludePinned ?? false
  });

  // 2. 取得したページをメモリ上でソート
  const sortedPages = sortPages(response.pages, { 
    sort: options.sort ?? undefined, 
    excludePinned: options.excludePinned ?? undefined 
  });

  // 3. skip位置から必要な件数を切り出し
  const resultPages = sortedPages.slice(skip, skip + limit);

  // 4. 結果を返す
  return {
    ...response,
    pages: resultPages,
    limit: resultPages.length,
    skip: skip
  };
}

type SmartContextResult =
  | { ok: true; text: string }
  | { ok: false; error: string };

/**
 * Smart Context APIでページとリンク先ページのコンテンツを一括取得する
 * @param projectName プロジェクト名
 * @param title ページタイトル
 * @param hopCount リンクのホップ数（1 or 2）
 * @param sid セッションID。PAT（`COSENSE_MCP_PAT` や `~/.cosense/settings.json`）があれば無くてよい
 * @returns 成功時はテキスト、失敗時はエラーメッセージ
 */
async function getSmartContext(
  projectName: string,
  title: string,
  hopCount: 1 | 2,
  sid?: string,
): Promise<SmartContextResult> {
  try {
    const url = `https://${API_DOMAIN}/api/smart-context/export-${hopCount}hop-links/${projectName}.txt?title=${encodeURIComponent(title)}`;

    const response = await fetchWithCredential(url, sid);

    if (!response.ok) {
      return { ok: false, error: `API error: ${response.status} ${response.statusText}` };
    }

    return { ok: true, text: await response.text() };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Unknown network error' };
  }
}

type ProjectMember = { id: string; name: string; displayName: string; photo: string };

/**
 * プロジェクトのメンバーを ID で引ける形にする。引けなければ空（資格情報なしの公開プロジェクトなど）。
 *
 * `/api/projects/:project` ではなく `/users` を使うのは、こちらが PAT でも通るため（公式 CLI と同じ）。
 * 応答にはメールアドレスも入っているが、名前と写真だけを取り出す。
 */
// メンバー一覧を覚えておく時間。get_page は呼ばれる回数が多く、毎回引くと要求が倍になる。
// 引けなかった結果（空）も覚える。資格情報なしで非公開プロジェクトを見るたびに無駄打ちしないため
const MEMBERS_TTL_MS = 5 * 60 * 1000;
// 取得中の Promise を覚えるので、同時に来た呼び出しも同じ1回の要求を待つ
const membersCache = new Map<string, { members: Promise<Map<string, ProjectMember>>; expiresAt: number }>();

/** テスト用: 覚えておいたメンバー一覧を捨てる */
function clearMembersCache(): void {
  membersCache.clear();
}

function getProjectMembers(projectName: string, sid?: string): Promise<Map<string, ProjectMember>> {
  const key = `${projectName}\n${sid ?? ''}`;
  const cached = membersCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.members;
  const members = fetchProjectMembers(projectName, sid);
  membersCache.set(key, { members, expiresAt: Date.now() + MEMBERS_TTL_MS });
  return members;
}

async function fetchProjectMembers(projectName: string, sid?: string): Promise<Map<string, ProjectMember>> {
  const members = new Map<string, ProjectMember>();
  try {
    const url = `https://${API_DOMAIN}/api/projects/${projectName}/users`;
    const response = sid
      ? await fetch(url, { headers: { Cookie: `connect.sid=${sid}` } })
      : await fetch(url);
    if (!response.ok) return members;
    const body = await response.json() as { users?: ProjectMember[] } | ProjectMember[];
    const users = Array.isArray(body) ? body : body.users ?? [];
    for (const { id, name, displayName, photo } of users) {
      if (id && displayName) members.set(id, { id, name, displayName, photo });
    }
  } catch {
    // 名前が引けなくても一覧は返せるので、ここでは諦める
  }
  return members;
}

/**
 * ページ（一覧の各ページや get_page のページ）に、作成者・最終編集者・他の編集者の名前を付ける。
 *
 * ページと一覧の API はユーザーを ID だけで返す（2026年1月に本家が名前を外した）。
 * 本家の web と同じく、名前はメンバー一覧から引く。ページごとに詳細を取り直すのと違い、
 * 何ページあっても要求は1回で済む。メンバー一覧が引けなければ、ページはそのまま返す。
 */
type UserRefs = {
  user?: { id: string } | undefined;
  lastUpdateUser?: { id: string } | undefined;
  users?: { id: string }[] | undefined;
};

async function withUserNames<T extends UserRefs>(
  projectName: string,
  pages: T[],
  sid?: string,
): Promise<T[]> {
  if (pages.length === 0) return pages;
  const members = await getProjectMembers(projectName, sid);
  if (members.size === 0) return pages;
  const named = (ref: { id: string } | undefined) => (ref ? members.get(ref.id) : undefined);
  return pages.map(page => ({
    ...page,
    user: named(page.user) ?? page.user,
    lastUpdateUser: named(page.lastUpdateUser) ?? page.lastUpdateUser,
    collaborators: (page.users ?? []).map(named).filter((m): m is ProjectMember => m !== undefined),
  }));
}

// 型のエクスポート
export type { ListPagesResponse };

// 関数のエクスポート
export { getPage, listPages, listPagesWithSort, toReadablePage, createPageUrl, searchPages, getSmartContext, withUserNames, clearMembersCache };
