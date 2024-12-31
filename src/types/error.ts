/**
 * Scrapbox MCPサーバーのエラー型定義
 */

import { ErrorCode } from '@modelcontextprotocol/sdk/types.js';

/**
 * MCPエラーレスポンスの型定義
 */
export interface ErrorResponse {
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
}

/**
 * Scrapbox APIエラーの型定義
 */
export interface ScrapboxApiError {
  name: string;
  message: string;
  status: number;
  response?: {
    data?: unknown;
  };
}

/**
 * エラー情報をMCPエラーレスポンスに変換するユーティリティ関数の型定義
 */
export type ErrorConverter = (error: unknown) => ErrorResponse;

/**
 * MCPエラーレスポンスを生成するユーティリティ関数
 * @param code エラーコード
 * @param message エラーメッセージ
 * @param details 追加のエラー詳細情報（オプション）
 */
export const createErrorResponse = (
  code: ErrorCode,
  message: string,
  details?: unknown
): ErrorResponse => ({
  error: {
    code,
    message,
    details,
  },
});
