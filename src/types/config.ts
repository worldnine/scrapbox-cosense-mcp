/**
 * サーバー設定関連の型定義
 */

/**
 * サーバー設定の型定義
 */
export interface ServerConfig {
  /** サーバー名 */
  name: string;
  /** バージョン */
  version: string;
  /** 環境変数 */
  env: EnvConfig;
}

/**
 * 環境変数の型定義
 */
export interface EnvConfig {
  /** Scrapboxのプロジェクト名 */
  SCRAPBOX_PROJECT?: string;
  /** Scrapboxの認証Cookie */
  SCRAPBOX_COOKIE?: string;
  /** デバッグモードの有効/無効 */
  DEBUG?: boolean;
  /** APIのベースURL */
  API_BASE_URL?: string;
}

/**
 * 設定のバリデーション結果
 */
export interface ConfigValidationResult {
  /** バリデーションが成功したかどうか */
  isValid: boolean;
  /** エラーメッセージ（バリデーション失敗時） */
  errors?: string[];
}

/**
 * デフォルトの設定値
 */
export const DEFAULT_CONFIG: Partial<ServerConfig> = {
  name: "scrapbox-mcp-server",
  version: "1.0.0",
};

/**
 * APIエンドポイントの設定
 */
export const API_ENDPOINTS = {
  /** ページ一覧取得 */
  LIST_PAGES: "/api/pages",
  /** ページ検索 */
  SEARCH_PAGES: "/api/pages/search",
  /** ページ取得 */
  GET_PAGE: "/api/pages/:pageId",
  /** ページ作成 */
  CREATE_PAGE: "/api/pages",
} as const;

/**
 * 設定のデフォルト値
 */
export const DEFAULT_ENV_CONFIG: EnvConfig = {
  API_BASE_URL: "https://scrapbox.io",
  DEBUG: false,
};

/**
 * 設定のバリデーション関数の型定義
 */
export type ConfigValidator = (config: ServerConfig) => ConfigValidationResult;
