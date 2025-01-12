/**
 * Scrapbox MCPサーバーのエラー型定義
 */

import { ErrorCode } from '@modelcontextprotocol/sdk/types.js';

// MCPエラーコードの拡張
export enum ScrapboxErrorCode {
  AUTH_ERROR = 'AUTH_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  RATE_LIMIT = 'RATE_LIMIT',
  API_ERROR = 'API_ERROR',
}

/**
 * MCPエラーレスポンスの型定義
 */
export interface ErrorResponse {
  success: false;
  error: {
    code: ErrorCode | ScrapboxErrorCode;
    message: string;
    details?: unknown;
  };
}

/**
 * Scrapbox APIエラーの型定義
 */
export interface ScrapboxApiError extends Error {
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
  code: ErrorCode | ScrapboxErrorCode,
  message: string,
  details?: unknown
): ErrorResponse => ({
  success: false,
  error: {
    code,
    message,
    details,
  },
});
