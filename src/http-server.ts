import { randomUUID } from 'node:crypto';
import type { ErrorRequestHandler, Express, Request, RequestHandler, Response } from 'express';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import type { OAuthConfig } from './auth/config.js';
import { setupOAuth } from './auth/index.js';

/**
 * セッションごとの MCP サーバーを作る。認証済みなら、その接続の `AuthInfo` を渡す
 * （誰の認可で開かれた接続かを、サーバーの組み立てに使えるように）。
 */
type ServerFactory = (authInfo?: AuthInfo) => Server;

export interface HttpServerOptions {
  port: number;
  /** 待ち受けるアドレス。既定はこのマシンの中だけ。 */
  host?: string;
  /** Host ヘッダの許可リスト。0.0.0.0 などで待ち受けるときに DNS リバインディングを防ぐ。 */
  allowedHosts?: string[] | undefined;
  /** OAuth 2.1 の設定。これがあれば `/mcp` は Bearer トークンを要求する。 */
  oauth?: OAuthConfig | undefined;
  /** 認証なしで起動することを明示的に許可する。 */
  allowUnauthenticated?: boolean;
  /** リバースプロキシ配下で接続元 IP を復元する（Express の `trust proxy` に渡す値）。 */
  trustProxy?: string | number | boolean | undefined;
}

const jsonRpcError = (res: Response, status: number, code: number, message: string): void => {
  res.status(status).json({ jsonrpc: '2.0', error: { code, message }, id: null });
};

/**
 * MCP の HTTP エンドポイントを持つ Express アプリを組み立てる。
 * テストからポートを開かずに叩けるよう、`startHttpServer` とは分けてある。
 */
export function createApp(createServer: ServerFactory, options: HttpServerOptions): Express {
  const { host = '127.0.0.1', allowedHosts, oauth, allowUnauthenticated = false, trustProxy } = options;

  if (!oauth && !allowUnauthenticated) {
    // 認証の設定が「書いてあるのに効いていない」まま公開される事故を防ぐため、
    // 認証が無い状態で起動させたいときは明示的に宣言させる。
    throw new Error(
      'Refusing to start the HTTP transport without authentication. ' +
        'Set MCP_PUBLIC_URL + MCP_OAUTH_PASSPHRASE to enable OAuth, or set MCP_ALLOW_UNAUTHENTICATED=true to start without it (local use only).'
    );
  }

  const app = createMcpExpressApp({ host, ...(allowedHosts ? { allowedHosts } : {}) });
  if (trustProxy !== undefined) app.set('trust proxy', trustProxy);
  const transports: Record<string, StreamableHTTPServerTransport> = {};

  // OAuth のルーターは、ログインを試みる側の接続元 IP でレート制限をかける。
  // 認可の失敗を後から追えるよう、ルーターより先にリクエストを記録する
  // （後ろに置くと /authorize や /oauth/consent が一切ログに残らない）。
  app.use((req: Request, _res: Response, next) => {
    console.error(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  });

  // `.well-known` を含むので、OAuth のルーターはアプリのルートに載せる必要がある。
  let requireAuth: RequestHandler | undefined;
  if (oauth) {
    const wiring = setupOAuth(oauth);
    for (const router of wiring.routers) app.use(router);
    requireAuth = wiring.requireAuth;
    console.error(`[oauth] enabled: issuer=${oauth.issuerUrl.origin} resource=${oauth.resourceUrl.href}`);
  }
  const guard: RequestHandler[] = requireAuth ? [requireAuth] : [];

  // セッションIDと「そのセッションを開いた認可」の対応。transports は Mcp-Session-Id を引くだけなので、
  // これが無いと、セッションIDを知った別のトークン保持者がそのセッションにそのまま乗れてしまう。
  const sessionOwners: Record<string, string> = {};

  /**
   * そのリクエストが属する認可を表すキー。grantId はリフレッシュをまたいで不変なので、
   * トークンが更新されてもセッションは切れない（トークン値を鍵にすると1時間ごとに切れる）。
   */
  const ownerKey = (req: Request): string => {
    const auth = (req as Request & { auth?: AuthInfo }).auth;
    if (!auth) return 'unauthenticated';
    const grantId = (auth.extra as { grantId?: unknown } | undefined)?.grantId;
    return typeof grantId === 'string' ? `grant:${grantId}` : `client:${auth.clientId}`;
  };

  // 他人のセッションの拒否は「存在しない」と同じ 404 にする（403 だと実在を教えることになる）
  const ownsSession = (req: Request, sessionId: string): boolean => sessionOwners[sessionId] === ownerKey(req);

  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok' });
  });

  app.post('/mcp', ...guard, async (req: Request, res: Response) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    try {
      if (sessionId && transports[sessionId]) {
        if (!ownsSession(req, sessionId)) {
          jsonRpcError(res, 404, -32001, 'Session not found. Please re-initialize.');
          return;
        }
        await transports[sessionId].handleRequest(req, res, req.body);
        return;
      }
      if (sessionId) {
        // 未知のセッションには 404 を返す。クライアントはこれで initialize からやり直す。
        jsonRpcError(res, 404, -32001, 'Session not found. Please re-initialize.');
        return;
      }
      if (!isInitializeRequest(req.body)) {
        jsonRpcError(res, 400, -32000, 'Bad Request: No valid session ID provided');
        return;
      }

      const transport: StreamableHTTPServerTransport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sid: string) => {
          transports[sid] = transport;
          sessionOwners[sid] = ownerKey(req);
        },
      });
      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid) {
          delete transports[sid];
          delete sessionOwners[sid];
        }
      };
      await createServer((req as Request & { auth?: AuthInfo }).auth).connect(transport as Parameters<Server['connect']>[0]);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error('POST /mcp error:', error);
      if (!res.headersSent) jsonRpcError(res, 500, -32603, 'Internal server error');
    }
  });

  // GET は SSE ストリーム、DELETE はセッション終了。どちらも既存セッションにだけ意味がある。
  const withSession = async (req: Request, res: Response): Promise<void> => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    const transport = sessionId ? transports[sessionId] : undefined;
    if (!sessionId || !transport || !ownsSession(req, sessionId)) {
      res.status(404).send('Session not found');
      return;
    }
    try {
      await transport.handleRequest(req, res);
    } catch (error) {
      console.error(`${req.method} /mcp error:`, error);
      if (!res.headersSent) res.status(500).send('Internal server error');
    }
  };
  app.get('/mcp', ...guard, withSession);
  app.delete('/mcp', ...guard, withSession);

  // express.json() が失敗したとき（壊れた JSON、上限を超える本文）の応答。無いと Express 既定の
  // ハンドラに渡り、NODE_ENV が production 以外ではスタックトレース入りの HTML が返る。
  // ルートより後ろに置くこと（エラーハンドラは登録順で効く）
  const bodyError: ErrorRequestHandler = (err, _req, res, next) => {
    if (res.headersSent) {
      next(err);
      return;
    }
    const type = (err as { type?: string } | null)?.type;
    if (type === 'entity.parse.failed') {
      jsonRpcError(res, 400, -32700, 'Parse error: the request body is not valid JSON');
    } else if (type === 'entity.too.large') {
      jsonRpcError(res, 413, -32600, 'Request body too large');
    } else {
      console.error('[http] unhandled error:', err);
      jsonRpcError(res, 500, -32603, 'Internal server error');
    }
  };
  app.use(bodyError);

  app.locals.transports = transports;
  return app;
}

export function startHttpServer(createServer: ServerFactory, options: HttpServerOptions) {
  const app = createApp(createServer, options);
  const transports = app.locals.transports as Record<string, StreamableHTTPServerTransport>;
  const host = options.host ?? '127.0.0.1';

  const httpServer = app.listen(options.port, host, () => {
    console.error(`MCP Streamable HTTP server listening on http://${host}:${options.port}/mcp`);
  });

  const shutdown = async () => {
    for (const sid of Object.keys(transports)) {
      await transports[sid]?.close().catch(() => undefined);
    }
    httpServer.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  return httpServer;
}
