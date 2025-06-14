/**
 * Scrapbox API関連の型定義
 */

/**
 * Scrapboxページの基本情報（実際のAPI形式）
 */
export interface ScrapboxPage {
  title: string;
  lastAccessed?: number | undefined;
  created?: number | undefined;
  updated?: number | undefined;
  accessed?: number | undefined;
  views?: number | undefined;
  linked?: number | undefined;
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
}

/**
 * Scrapboxページの行
 */
export interface ScrapboxLine {
  id: string;
  text: string;
  created: number;
  updated: number;
}

/**
 * ページ一覧取得APIのレスポンス
 */
export interface ListPagesResponse {
  pages: Array<{
    id: string;
    title: string;
    updated: number;
    accessed: number;
    created: number;
    persistent: boolean;
    descriptions?: string[];  // 冒頭5行を追加
  }>;
  skip?: number;
  limit?: number;
  count?: number;
}

/**
 * ページ検索APIのレスポンス
 */
export interface SearchPagesResponse {
  pages: Array<{
    id: string;
    title: string;
    updated: number;
    accessed: number;
    created: number;
    persistent: boolean;
    match?: string[];
  }>;
}

/**
 * ページ作成APIのリクエストパラメータ
 */
export interface CreatePageParams {
  title: string;
  lines: string[];
}

/**
 * ページ作成APIのレスポンス
 */
export interface CreatePageResponse {
  id: string;
  title: string;
  created: number;
  updated: number;
  accessed: number;
  persistent: boolean;
}

/**
 * APIリクエストの共通パラメータ
 */
export interface CommonApiParams {
  projectName: string;
  cookie: string;
}

/**
 * ページ一覧取得APIのパラメータ
 */
export interface ListPagesParams extends CommonApiParams {
  skip?: number;
  limit?: number;
}

/**
 * ページ検索APIのパラメータ
 */
export interface SearchPagesParams extends CommonApiParams {
  query: string;
}

/**
 * ページ取得APIのパラメータ
 */
export interface GetPageParams extends CommonApiParams {
  pageId: string;
}
