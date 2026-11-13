/**
 * MCP 仕様に沿った OAuth 2.1 認可サーバー兼リソースサーバーの中身。
 *
 * 認可サーバーを外部 IdP に委譲せず同じプロセスに同居させる。
 * DCR (RFC 7591) を素で受け付ける外部 IdP が少なく、委譲するほうがかえって
 * 設定と依存が増えるため。利用者の認証は `ConsentAuthenticator`（既定はパスフレーズ 1 つ）。
 */

import { randomUUID } from 'node:crypto';
import type { Response } from 'express';
import type { AuthorizationParams, OAuthServerProvider } from '@modelcontextprotocol/sdk/server/auth/provider.js';
import type { OAuthRegisteredClientsStore } from '@modelcontextprotocol/sdk/server/auth/clients.js';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import type {
  OAuthClientInformationFull,
  OAuthTokenRevocationRequest,
  OAuthTokens,
} from '@modelcontextprotocol/sdk/shared/auth.js';
import {
  InvalidClientMetadataError,
  InvalidGrantError,
  InvalidTargetError,
  InvalidTokenError,
} from '@modelcontextprotocol/sdk/server/auth/errors.js';
import {
  AUTHORIZATION_CODE_TTL_SEC,
  DEFAULT_SCOPE,
  PENDING_AUTHORIZATION_TTL_SEC,
  type OAuthConfig,
} from './config.js';
import { OAuthStore, generateToken } from './store.js';
import { ConsentError, DEFAULT_USER_ID, type ConsentSubmission } from './authenticator.js';
import { FixedWindowRateLimiter } from './rate-limit.js';

export { ConsentError, DEFAULT_USER_ID };

/** 同意画面すら出せないエラー（pending が期限切れ・不明）。 */
export class PendingNotFoundError extends Error {}

interface PendingAuthorization {
  id: string;
  clientId: string;
  clientName: string;
  redirectUri: string;
  codeChallenge: string;
  state?: string;
  scopes: string[];
  resource?: string;
  expiresAt: number;
  /** 発行済みの認可コード。再送信されたときに同じものを返すために覚えておく。 */
  issuedCode?: string;
  /** そのコードを発行した利用者。別の利用者が同じ pending を承認したら作り直す。 */
  issuedFor?: string;
}

interface AuthorizationCode {
  clientId: string;
  userId: string;
  redirectUri: string;
  codeChallenge: string;
  scopes: string[];
  resource?: string;
  expiresAt: number;
}

/**
 * audience 比較用の正規化。フラグメントを落とし、末尾スラッシュを揃える。
 * `/mcp` と `/mcp/` は同じエンドポイントなので、ここだけは厳密一致にせず吸収する。
 */
export function canonicalizeResource(value: string | URL): string {
  const url = new URL(value.toString());
  url.hash = '';
  const href = url.href;
  return href.endsWith('/') ? href.slice(0, -1) : href;
}

function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

function isAllowedRedirectUri(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol === 'https:') return true;
  // RFC 8252: ネイティブクライアントの loopback だけ http を許す。
  return url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]');
}

export class CosenseOAuthProvider implements OAuthServerProvider {
  readonly clientsStore: OAuthRegisteredClientsStore;

  private readonly pending = new Map<string, PendingAuthorization>();
  private readonly codes = new Map<string, AuthorizationCode>();
  /** 使用済みコードの再利用を検出するため、TTL の間だけ発行先クライアントを覚えておく。 */
  private readonly usedCodes = new Map<string, { clientId: string; expiresAt: number }>();
  private readonly loginLimiter = new FixedWindowRateLimiter(10, 15 * 60 * 1000);
  private readonly canonicalResource: string;

  constructor(
    private readonly config: OAuthConfig,
    private readonly store: OAuthStore,
    /** 同意フォームの POST 先パス。 */
    private readonly consentPath: string,
    /** 同意画面を描画する関数（HTML 生成をプロバイダから切り離すため注入する）。 */
    private readonly renderConsent: (params: {
      pendingId: string;
      clientName: string;
      redirectUri: string;
      scopes: string[];
      resource: string;
      resourceHost: string;
      actionPath: string;
      error?: string;
    }) => string
  ) {
    this.canonicalResource = canonicalizeResource(config.resourceUrl);
    this.clientsStore = {
      getClient: (clientId) => this.store.getClient(clientId),
      registerClient: (client) => {
        const full = client as OAuthClientInformationFull;
        if (!full.redirect_uris || full.redirect_uris.length === 0) {
          throw new InvalidClientMetadataError('At least one redirect_uri is required');
        }
        const bad = full.redirect_uris.find((uri) => !isAllowedRedirectUri(uri));
        if (bad) {
          throw new InvalidClientMetadataError(`redirect_uri must be https (or http on loopback): ${bad}`);
        }
        this.store.saveClient(full);
        console.error(`[oauth] registered client ${full.client_id} (${full.client_name ?? 'unnamed'})`);
        return full;
      },
    };
  }

  // --- 認可リクエスト ---

  async authorize(client: OAuthClientInformationFull, params: AuthorizationParams, res: Response): Promise<void> {
    if (params.resource !== undefined && canonicalizeResource(params.resource) !== this.canonicalResource) {
      // ここで通すと、別リソース向けのトークンをこのサーバーが発行してしまう。
      throw new InvalidTargetError(`Unsupported resource: ${params.resource.href}`);
    }

    this.sweep();

    const pending: PendingAuthorization = {
      id: randomUUID(),
      clientId: client.client_id,
      clientName: client.client_name ?? client.client_id,
      redirectUri: params.redirectUri,
      codeChallenge: params.codeChallenge,
      ...(params.state !== undefined ? { state: params.state } : {}),
      scopes: params.scopes && params.scopes.length > 0 ? params.scopes : [DEFAULT_SCOPE],
      ...(params.resource !== undefined ? { resource: canonicalizeResource(params.resource) } : {}),
      expiresAt: nowSec() + PENDING_AUTHORIZATION_TTL_SEC,
    };
    this.pending.set(pending.id, pending);

    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Frame-Options', 'DENY');
    // form-action はフォーム送信「の結果のリダイレクト先」にも適用される。'self' だけだと
    // 承認後の 302 をブラウザがブロックし、押しても何も起きないように見える（curl は CSP を
    // 解釈しないので、この壊れ方はブラウザでしか再現しない）。
    const redirectOrigin = new URL(params.redirectUri).origin;
    res.setHeader(
      'Content-Security-Policy',
      `default-src 'none'; style-src 'unsafe-inline'; form-action 'self' ${redirectOrigin}`
    );
    res.status(200).type('html').send(
      this.renderConsent({
        pendingId: pending.id,
        clientName: pending.clientName,
        redirectUri: pending.redirectUri,
        scopes: pending.scopes,
        resource: this.config.resourceUrl.href,
        resourceHost: this.config.resourceUrl.host,
        actionPath: this.consentPath,
      })
    );
  }

  /** 同意画面を（エラー表示付きで）出し直すための HTML。 */
  renderConsentFor(pendingId: string, error?: string): string {
    const pending = this.requirePending(pendingId);
    return this.renderConsent({
      pendingId: pending.id,
      clientName: pending.clientName,
      redirectUri: pending.redirectUri,
      scopes: pending.scopes,
      resource: this.config.resourceUrl.href,
      resourceHost: this.config.resourceUrl.host,
      actionPath: this.consentPath,
      ...(error !== undefined ? { error } : {}),
    });
  }

  /**
   * 同意フォームの承認。成功するとリダイレクト先 URL を返す。
   * `iss` を必ず付ける — ChatGPT はこれを見て固定のリダイレクト URI を使う。
   */
  approve(pendingId: string, submission: ConsentSubmission, rateLimitKey: string): string {
    const pending = this.requirePending(pendingId);

    if (!this.loginLimiter.tryConsume(rateLimitKey)) {
      throw new ConsentError('Too many attempts. Try again later.');
    }

    const user = this.config.authenticator.authenticate(submission);
    this.loginLimiter.reset(rateLimitKey);

    // 同じ承認を二重に送っても行き止まりにしない。ブラウザの再送信や、リダイレクトが
    // 見えなかった利用者の押し直しで「期限切れ」を出すのは、こちらの都合でしかない。
    // pending は TTL で消えるまで残し、認可コードも使い回す（コードの単発性は
    // トークンエンドポイント側で担保されている）。
    // ただし再利用できるのは「同じ利用者が押し直した」ときだけ。別のパスフレーズで
    // 承認されたら、前の利用者向けに出したコードを渡してしまわないよう作り直す。
    const reusable = pending.issuedCode !== undefined && pending.issuedFor === user.id;
    const code = reusable ? pending.issuedCode! : generateToken();

    if (!reusable) {
      if (pending.issuedCode !== undefined) this.codes.delete(pending.issuedCode);
      pending.issuedCode = code;
      pending.issuedFor = user.id;
      this.codes.set(code, {
        clientId: pending.clientId,
        userId: user.id,
        redirectUri: pending.redirectUri,
        codeChallenge: pending.codeChallenge,
        scopes: pending.scopes,
        ...(pending.resource !== undefined ? { resource: pending.resource } : {}),
        expiresAt: nowSec() + AUTHORIZATION_CODE_TTL_SEC,
      });
    }
    console.error(`[oauth] consent approved for user '${user.id}' (client ${pending.clientId})`);

    const redirect = new URL(pending.redirectUri);
    redirect.searchParams.set('code', code);
    if (pending.state !== undefined) redirect.searchParams.set('state', pending.state);
    // `iss` は AS メタデータの `issuer` と文字列完全一致でなければならない（RFC 9207）。
    // `.origin` は末尾スラッシュを落とすため、`issuerUrl` が `new URL(base.origin)` 由来で
    // 末尾スラッシュ付きの `.href` を持つここでは一致しない。ChatGPT はこれを厳密に比較しており、
    // 不一致だと同意承認後のリダイレクトを黙って捨てて最初からやり直す（`/token` が一度も呼ばれない）。
    redirect.searchParams.set('iss', this.config.issuerUrl.href);
    return redirect.href;
  }

  /** 同意フォームの拒否。エラー付きでリダイレクトして戻す。 */
  deny(pendingId: string): string {
    const pending = this.requirePending(pendingId);
    this.pending.delete(pendingId);

    const redirect = new URL(pending.redirectUri);
    redirect.searchParams.set('error', 'access_denied');
    redirect.searchParams.set('error_description', 'The user denied the request');
    if (pending.state !== undefined) redirect.searchParams.set('state', pending.state);
    redirect.searchParams.set('iss', this.config.issuerUrl.href);
    return redirect.href;
  }

  private requirePending(pendingId: string): PendingAuthorization {
    this.sweep();
    const pending = this.pending.get(pendingId);
    if (!pending) {
      throw new PendingNotFoundError('This authorization request has expired. Start over from the client.');
    }
    return pending;
  }

  // --- トークンエンドポイント ---

  async challengeForAuthorizationCode(client: OAuthClientInformationFull, authorizationCode: string): Promise<string> {
    const record = this.codes.get(authorizationCode);
    if (!record || record.clientId !== client.client_id) {
      this.detectCodeReuse(authorizationCode, client.client_id);
      throw new InvalidGrantError('Invalid or expired authorization code');
    }
    if (record.expiresAt <= nowSec()) {
      this.codes.delete(authorizationCode);
      throw new InvalidGrantError('Invalid or expired authorization code');
    }
    return record.codeChallenge;
  }

  async exchangeAuthorizationCode(
    client: OAuthClientInformationFull,
    authorizationCode: string,
    _codeVerifier?: string,
    redirectUri?: string,
    resource?: URL
  ): Promise<OAuthTokens> {
    const record = this.codes.get(authorizationCode);
    if (!record || record.clientId !== client.client_id || record.expiresAt <= nowSec()) {
      this.detectCodeReuse(authorizationCode, client.client_id);
      throw new InvalidGrantError('Invalid or expired authorization code');
    }
    // 認可コードは1回限り。以降の提示は再利用として扱う。
    this.codes.delete(authorizationCode);
    this.usedCodes.set(authorizationCode, {
      clientId: client.client_id,
      expiresAt: nowSec() + AUTHORIZATION_CODE_TTL_SEC,
    });

    if (redirectUri !== undefined && redirectUri !== record.redirectUri) {
      throw new InvalidGrantError('redirect_uri does not match the authorization request');
    }

    const requested = resource !== undefined ? canonicalizeResource(resource) : undefined;
    if (requested !== undefined && requested !== this.canonicalResource) {
      throw new InvalidTargetError(`Unsupported resource: ${resource!.href}`);
    }
    if (requested !== undefined && record.resource !== undefined && requested !== record.resource) {
      throw new InvalidTargetError('resource does not match the authorization request');
    }

    const audience = requested ?? record.resource;

    return this.issueTokens(client.client_id, record.userId, record.scopes, audience, randomUUID());
  }

  async exchangeRefreshToken(
    client: OAuthClientInformationFull,
    refreshToken: string,
    scopes?: string[],
    resource?: URL
  ): Promise<OAuthTokens> {
    const record = this.store.consumeRefreshToken(refreshToken);
    if (!record || record.clientId !== client.client_id) {
      throw new InvalidGrantError('Invalid or expired refresh token');
    }

    const requested = resource !== undefined ? canonicalizeResource(resource) : undefined;
    if (requested !== undefined && requested !== this.canonicalResource) {
      throw new InvalidTargetError(`Unsupported resource: ${resource!.href}`);
    }

    // スコープの再要求は元の付与範囲を超えられない。
    let granted = record.scopes;
    if (scopes && scopes.length > 0) {
      const widened = scopes.filter((scope) => !record.scopes.includes(scope));
      if (widened.length > 0) {
        throw new InvalidGrantError(`Cannot widen scope: ${widened.join(', ')}`);
      }
      granted = scopes;
    }

    // ローテーションしても同じ認可の続きなので、grantId は引き継ぐ。
    // ここで新しいIDにすると、取り消し時に古い世代が取り残される。
    return this.issueTokens(
      client.client_id,
      record.userId ?? DEFAULT_USER_ID,
      granted,
      requested ?? record.resource,
      record.grantId
    );
  }

  private issueTokens(
    clientId: string,
    userId: string,
    scopes: string[],
    resource: string | undefined,
    /** リフレッシュで再発行する場合は、元の認可のIDを引き継ぐ。 */
    grantId: string = randomUUID()
  ): OAuthTokens {
    const accessToken = generateToken();
    const refreshToken = generateToken();
    const issuedAt = nowSec();

    this.store.saveAccessToken(accessToken, {
      clientId,
      userId,
      scopes,
      expiresAt: issuedAt + this.config.accessTokenTtlSec,
      ...(resource !== undefined ? { resource } : {}),
      grantId,
    });
    this.store.saveRefreshToken(refreshToken, {
      clientId,
      userId,
      scopes,
      expiresAt: issuedAt + this.config.refreshTokenTtlSec,
      ...(resource !== undefined ? { resource } : {}),
      grantId,
    });

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: this.config.accessTokenTtlSec,
      scope: scopes.join(' '),
      refresh_token: refreshToken,
    };
  }

  /**
   * 認可コードの再利用を検出したら、そのクライアントのトークンを全部落とす。
   * コードが漏れて先に交換された可能性があるため（RFC 6749 4.1.2）。
   */
  private detectCodeReuse(authorizationCode: string, clientId: string): void {
    const used = this.usedCodes.get(authorizationCode);
    if (used && used.clientId === clientId) {
      console.error(`[oauth] authorization code reuse detected for client ${clientId}; revoking its tokens`);
      this.store.revokeClientTokens(clientId);
    }
  }

  // --- リソースサーバー側 ---

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    const record = this.store.getAccessToken(token);
    if (!record) {
      throw new InvalidTokenError('Token is invalid or expired');
    }
    if (record.resource !== undefined && record.resource !== this.canonicalResource) {
      // RFC 8707: 他リソース向けに発行されたトークンをここで受け付けてはいけない。
      throw new InvalidTokenError('Token was not issued for this resource server');
    }

    return {
      token,
      clientId: record.clientId,
      scopes: record.scopes,
      expiresAt: record.expiresAt,
      ...(record.resource !== undefined ? { resource: new URL(record.resource) } : {}),
      // `extra` で下流に渡すもの:
      // - userId: 誰の認可か（`ConsentAuthenticator` が返した ID）
      // - grantId: MCP セッションを「どの認可で開かれたか」に縛るため。リフレッシュで
      //   トークンがローテートしても引き継がれるので、更新のたびにセッションは切れない
      //   （トークン値そのものを鍵にすると切れる）
      extra: {
        userId: record.userId ?? DEFAULT_USER_ID,
        ...(record.grantId !== undefined ? { grantId: record.grantId } : {}),
      },
    };
  }

  async revokeToken(_client: OAuthClientInformationFull, request: OAuthTokenRevocationRequest): Promise<void> {
    // RFC 7009 2.1: リフレッシュトークンを取り消したら、同じ認可から出たアクセストークンも
    // 無効にする SHOULD。逆向き（アクセス→リフレッシュ）は MAY だが、片方だけ残ると
    // 「取り消したのに使い続けられる」ので同じ扱いにする。
    const grantId = this.store.findGrantId(request.token);
    if (grantId !== undefined) {
      this.store.revokeGrant(grantId);
      return;
    }
    // grantId を持たない古いレコード向けのフォールバック。
    // RFC 7009: 不明なトークンでもエラーにしない。
    this.store.deleteAccessToken(request.token);
    this.store.deleteRefreshToken(request.token);
  }

  private sweep(): void {
    const cutoff = nowSec();
    for (const [id, entry] of this.pending) {
      if (entry.expiresAt <= cutoff) this.pending.delete(id);
    }
    for (const [code, entry] of this.codes) {
      if (entry.expiresAt <= cutoff) this.codes.delete(code);
    }
    for (const [code, entry] of this.usedCodes) {
      if (entry.expiresAt <= cutoff) this.usedCodes.delete(code);
    }
  }
}
