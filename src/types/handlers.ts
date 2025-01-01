/**
 * MCPリクエストハンドラー関連の型定義
 */

import { ErrorResponse } from './error.js';
import {
  ListPagesResponse,
  SearchPagesResponse,
  CreatePageResponse,
  ScrapboxPage,
} from './api.js';

/**
 * MCPハンドラーの共通レスポンス型
 * 成功時のレスポンスまたはエラーレスポンスを返す
 */
export type HandlerResponse<T> = T | ErrorResponse;

/**
 * ページ一覧取得ハンドラーの入力パラメータ
 */
export interface ListPagesHandlerParams {
  cosenseSid: string;
  projectName: string;
}

/**
 * ページ検索ハンドラーの入力パラメータ
 */
export interface SearchPagesHandlerParams {
  cosenseSid: string;
  projectName: string;
  query: string;
}

/**
 * ページ取得ハンドラーの入力パラメータ
 */
export interface GetPageHandlerParams {
  pageId: string;
  projectName: string;
  cookie: string;
}

/**
 * ページ作成ハンドラーの入力パラメータ
 */
export interface CreatePageHandlerParams {
  title: string;
  content: string;
  projectName: string;
  cookie: string;
}

/**
 * 各ハンドラーのレスポンス型
 */
export type ListPagesHandlerResponse = HandlerResponse<ListPagesResponse>;
export type SearchPagesHandlerResponse = HandlerResponse<SearchPagesResponse>;
export type GetPageHandlerResponse = HandlerResponse<ScrapboxPage>;
export type CreatePageHandlerResponse = HandlerResponse<CreatePageResponse>;

/**
 * ハンドラー関数の型定義
 */
export type RequestHandler<P, R> = (params: P) => Promise<R>;
