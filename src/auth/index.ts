/**
 * OAuth 関連のルーティングを Express アプリに配線する。
 *
 * `mcpAuthRouter` はアプリのルートに載せる必要がある（`.well-known` を含むため）。
 */

import express, { type Request, type RequestHandler, type Response } from 'express';
import {
  createOAuthMetadata,
  getOAuthProtectedResourceMetadataUrl,
  mcpAuthRouter,
} from '@modelcontextprotocol/sdk/server/auth/router.js';
import { metadataHandler } from '@modelcontextprotocol/sdk/server/auth/handlers/metadata.js';
import { requireBearerAuth } from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js';
import type { OAuthConfig } from './config.js';
import { OAuthStore } from './store.js';
import { ConsentError, type ConsentSubmission } from './authenticator.js';
import { CosenseOAuthProvider, PendingNotFoundError } from './provider.js';
import { renderConsentPage, renderErrorPage } from './pages.js';

/** 同意フォームの POST 先。 */
const CONSENT_PATH = '/oauth/consent';

/** 認証に渡さないフォームの欄（フロー制御用と、パスワードマネージャ向けの表示用）。 */
const RESERVED_FIELDS = new Set(['pending_id', 'action', 'username']);

export interface OAuthWiring {
  /** ルートに載せるルーター群。 */
  routers: RequestHandler[];
  /** `/mcp` の手前に挟む Bearer 検証ミドルウェア。 */
  requireAuth: RequestHandler;
  provider: CosenseOAuthProvider;
  store: OAuthStore;
}

export function setupOAuth(config: OAuthConfig): OAuthWiring {
  const store = new OAuthStore(config.storePath);
  const provider = new CosenseOAuthProvider(config, store, CONSENT_PATH, renderConsentPage);

  // SDK が組み立てるメタデータに `authorization_response_iss_parameter_supported` を足す。
  // これが無いと ChatGPT はコールバックごとに異なるリダイレクト URI を使う。
  const oauthMetadata = {
    ...createOAuthMetadata({
      provider,
      issuerUrl: config.issuerUrl,
      scopesSupported: config.scopesSupported,
    }),
    authorization_response_iss_parameter_supported: true,
    response_modes_supported: ['query'],
  };

  const overrides = express.Router();
  // mcpAuthRouter より先に載せて、拡張済みのメタデータを優先させる。
  overrides.use('/.well-known/oauth-authorization-server', metadataHandler(oauthMetadata));
  // RFC 9728 のパス付き URL は mcpAuthRouter が用意する。パス無しを見に来る
  // クライアントのために、ルート直下にも同じ内容を置いておく。
  overrides.use(
    '/.well-known/oauth-protected-resource',
    metadataHandler({
      resource: config.resourceUrl.href,
      authorization_servers: [config.issuerUrl.href],
      scopes_supported: config.scopesSupported,
      resource_name: config.resourceName,
    })
  );
  overrides.post(CONSENT_PATH, express.urlencoded({ extended: false }), createConsentHandler(provider));

  const authRouter = mcpAuthRouter({
    provider,
    issuerUrl: config.issuerUrl,
    resourceServerUrl: config.resourceUrl,
    scopesSupported: config.scopesSupported,
    resourceName: config.resourceName,
  });

  const requireAuth = requireBearerAuth({
    verifier: provider,
    resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(config.resourceUrl),
  });

  return { routers: [overrides, authRouter], requireAuth, provider, store };
}

function createConsentHandler(provider: CosenseOAuthProvider): RequestHandler {
  return (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    const body = req.body as Record<string, unknown>;
    const pendingId = typeof body.pending_id === 'string' ? body.pending_id : '';
    // 文字列の欄はすべて認証に渡す（画面を差し替えて欄を増やしても受け取れるように）。
    // 値は認証が終わるまでの入力なので、ログには落とさないこと。
    const submission: ConsentSubmission = { passphrase: '' };
    for (const [name, value] of Object.entries(body)) {
      if (typeof value === 'string' && !RESERVED_FIELDS.has(name)) Object.assign(submission, { [name]: value });
    }

    try {
      if (body.action === 'deny') {
        console.error(`[oauth] consent denied (pending=${pendingId.slice(0, 8)})`);
        res.redirect(302, provider.deny(pendingId));
        return;
      }
      // ネットワーク的な同一性しか手掛かりがないので、レート制限のキーは接続元 IP。
      const redirectTo = provider.approve(pendingId, submission, req.ip ?? 'unknown');
      console.error(`[oauth] consent approved (pending=${pendingId.slice(0, 8)})`);
      res.redirect(302, redirectTo);
    } catch (error) {
      if (error instanceof ConsentError) {
        console.error(`[oauth] consent rejected (pending=${pendingId.slice(0, 8)}): ${error.message}`);
        // リダイレクト先は分かっているが、まだ承認されていない。画面を出し直す。
        res.status(401).type('html').send(provider.renderConsentFor(pendingId, error.message));
        return;
      }
      if (error instanceof PendingNotFoundError) {
        console.error(`[oauth] consent for unknown/expired pending=${pendingId.slice(0, 8) || '(empty)'}`);
        res.status(400).type('html').send(renderErrorPage(error.message));
        return;
      }
      console.error('[oauth] consent handler failed:', error);
      res.status(500).type('html').send(renderErrorPage('Internal server error'));
    }
  };
}
