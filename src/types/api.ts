/**
 * Scrapbox API関連の型定義
 */

/**
 * Scrapboxページの基本情報
 */
export interface ScrapboxPage {
  id: string;
  title: string;
  created: number;
  updated: number;
  accessed: number;
  persistent: boolean;
  lines: ScrapboxLine[];
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