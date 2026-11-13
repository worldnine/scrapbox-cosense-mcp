/**
 * OAuth 2.1 (MCP authorization) の設定解決。
 *
 * ChatGPT / Claude.ai のどちらも API キーやカスタムヘッダを受け付けないため、
 * リモート公開時の認証手段は OAuth 2.1 のみ。両者の要求は
 * - RFC 9728 Protected Resource Metadata
 * - PKCE S256
 * - Dynamic Client Registration (RFC 7591)
 * - 401 + WWW-Authenticate による再認可
 * - audience (RFC 8707 `resource`) のサーバー側検証
 * で一致しているので、1つの実装で両対応できる。
 */

import { PassphraseAuthenticator, type ConsentAuthenticator } from './authenticator.js';

/** アクセストークンの有効期間（秒）。 */
const DEFAULT_ACCESS_TOKEN_TTL_SEC = 60 * 60;
/** リフレッシュトークンの有効期間（秒）。 */
const DEFAULT_REFRESH_TOKEN_TTL_SEC = 60 * 60 * 24 * 30;
/** 認可コードの有効期間（秒）。RFC 6749 は「最大10分」を推奨。 */
export const AUTHORIZATION_CODE_TTL_SEC = 10 * 60;
/** ログイン画面（未承認の認可リクエスト）の有効期間（秒）。 */
export const PENDING_AUTHORIZATION_TTL_SEC = 10 * 60;

/** このサーバーが発行する唯一のスコープ。 */
export const DEFAULT_SCOPE = 'mcp';

export interface OAuthConfig {
  /** 認可サーバーの issuer。パス・クエリ・フラグメントを持たないこと。 */
  issuerUrl: URL;
  /**
   * 保護対象リソースの識別子。
   * クライアントに入力させる URL と完全一致していなければならない
   * （Claude.ai / ChatGPT はここが1文字でも違うと再認可ループに入る）。
   */
  resourceUrl: URL;
  /**
   * 同意画面の入力を判定する。`resolveOAuthConfig` は環境変数のパスフレーズ 1 つを照合する実装を入れる。
   * 差し替えれば、利用者ごとに別の認証にできる。
   */
  authenticator: ConsentAuthenticator;
  /** トークン・クライアント登録の永続化先。未指定ならメモリのみ。 */
  storePath?: string;
  accessTokenTtlSec: number;
  refreshTokenTtlSec: number;
  resourceName: string;
  scopesSupported: string[];
}

export class OAuthConfigError extends Error {}

function parsePositiveInt(value: string | undefined, fallback: number, label: string): number {
  if (value === undefined || value === '') return fallback;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new OAuthConfigError(`${label} must be a positive integer (got: ${value})`);
  }
  return parsed;
}

/**
 * 環境変数から OAuth 設定を組み立てる。
 *
 * `MCP_PUBLIC_URL` と `MCP_OAUTH_PASSPHRASE` の両方が揃ったときだけ有効。
 * 片方だけ設定されている状態は「認証したいのに効いていない」事故そのものなので、
 * 黙って無効化せず例外にする。
 */
export function resolveOAuthConfig(env: NodeJS.ProcessEnv = process.env): OAuthConfig | undefined {
  const publicUrl = env.MCP_PUBLIC_URL?.trim();
  const passphrase = env.MCP_OAUTH_PASSPHRASE;

  if (!publicUrl && !passphrase) return undefined;
  if (!publicUrl) {
    throw new OAuthConfigError('MCP_OAUTH_PASSPHRASE is set but MCP_PUBLIC_URL is missing; OAuth cannot be enabled');
  }
  if (!passphrase) {
    throw new OAuthConfigError('MCP_PUBLIC_URL is set but MCP_OAUTH_PASSPHRASE is missing; OAuth cannot be enabled');
  }
  if (passphrase.length < 12) {
    throw new OAuthConfigError('MCP_OAUTH_PASSPHRASE must be at least 12 characters');
  }

  let base: URL;
  try {
    base = new URL(publicUrl);
  } catch {
    throw new OAuthConfigError(`MCP_PUBLIC_URL is not a valid URL: ${publicUrl}`);
  }

  const isLoopback = base.hostname === 'localhost' || base.hostname === '127.0.0.1';
  if (base.protocol !== 'https:' && !isLoopback) {
    throw new OAuthConfigError(`MCP_PUBLIC_URL must use https (got: ${base.protocol}//)`);
  }
  if (base.search || base.hash) {
    throw new OAuthConfigError('MCP_PUBLIC_URL must not contain a query string or fragment');
  }

  // issuer は origin 固定。resource は MCP エンドポイントのパスまで含める。
  const issuerUrl = new URL(base.origin);
  const resourceUrl = new URL('/mcp', base.origin);

  const storePath = env.MCP_OAUTH_STORE?.trim();

  return {
    issuerUrl,
    resourceUrl,
    authenticator: new PassphraseAuthenticator(passphrase),
    ...(storePath ? { storePath } : {}),
    accessTokenTtlSec: parsePositiveInt(env.MCP_OAUTH_ACCESS_TTL, DEFAULT_ACCESS_TOKEN_TTL_SEC, 'MCP_OAUTH_ACCESS_TTL'),
    refreshTokenTtlSec: parsePositiveInt(env.MCP_OAUTH_REFRESH_TTL, DEFAULT_REFRESH_TOKEN_TTL_SEC, 'MCP_OAUTH_REFRESH_TTL'),
    resourceName: env.MCP_OAUTH_RESOURCE_NAME?.trim() || 'Cosense MCP',
    scopesSupported: [DEFAULT_SCOPE],
  };
}
