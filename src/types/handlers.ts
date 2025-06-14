import type { AuthParams, PaginationParams } from '@/types/common.js';
import type { ErrorResponse } from '@/types/error.js';
import type {
  ListPagesResponse,
  SearchPagesResponse,
  CreatePageResponse,
  ScrapboxPage,
} from '@/types/api.js';

/**
 * MCPハンドラーの共通レスポンス型
 * 成功時のレスポンスまたはエラーレスポンスを返す
 */
export type HandlerResponse<T> = T | ErrorResponse;

/**
 * リストページハンドラーのパラメータ型定義
 */
export interface ListPagesHandlerParams extends PaginationParams {
  cosenseSid: string;
  projectName: string;
}

/**
 * 検索ページハンドラーのパラメータ型定義
 */
export interface SearchPagesHandlerParams extends PaginationParams {
  cosenseSid: string;
  projectName: string;
  query: string;
}

/**
 * ページ取得ハンドラーの入力パラメータ
 */
export interface GetPageHandlerParams extends AuthParams {
  pageId: string;
}

/**
 * ページ作成ハンドラーの入力パラメータ
 */
export interface CreatePageHandlerParams extends AuthParams {
  title: string;
  content: string;
}

/**
 * 各ハンドラーのレスポンス型
 */
export type ListPagesHandlerResponse = HandlerResponse<{
  success: true;
  data: ListPagesResponse;
}>;

export type SearchPagesHandlerResponse = HandlerResponse<{
  success: true;
  data: SearchPagesResponse;
}>;

export type GetPageHandlerResponse = HandlerResponse<{
  success: true;
  data: ScrapboxPage;
}>;

export type CreatePageHandlerResponse = HandlerResponse<{
  success: true;
  data: CreatePageResponse;
}>;

/**
 * ハンドラー関数の型定義
 */
export type RequestHandler<P, R> = (params: P) => Promise<R>;
