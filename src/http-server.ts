import { randomUUID } from 'node:crypto';
import type { Express, Request, Response } from 'express';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';

export interface HttpServerOptions {
  port: number;
  /** 待ち受けるアドレス。認証がまだ無いので、既定はこのマシンの中だけ。 */
  host?: string;
  /** Host ヘッダの許可リスト。0.0.0.0 などで待ち受けるときに DNS リバインディングを防ぐ。 */
  allowedHosts?: string[] | undefined;
  /** 認証なしで起動することを明示的に許可する。 */
  allowUnauthenticated?: boolean;
}

const jsonRpcError = (res: Response, status: number, code: number, message: string): void => {
  res.status(status).json({ jsonrpc: '2.0', error: { code, message }, id: null });
};

/**
 * MCP の HTTP エンドポイントを持つ Express アプリを組み立てる。
 * テストからポートを開かずに叩けるよう、`startHttpServer` とは分けてある。
 */
export function createApp(createServer: () => Server, options: HttpServerOptions): Express {
  const { host = '127.0.0.1', allowedHosts, allowUnauthenticated = false } = options;

  if (!allowUnauthenticated) {
    // 認証の設定が「書いてあるのに効いていない」まま公開される事故を防ぐため、
    // 認証が無い状態で起動させたいときは明示的に宣言させる。
    throw new Error(
      'Refusing to start the HTTP transport without authentication. ' +
        'Set MCP_ALLOW_UNAUTHENTICATED=true to start without it (local use only).'
    );
  }

  const app = createMcpExpressApp({ host, ...(allowedHosts ? { allowedHosts } : {}) });
  const transports: Record<string, StreamableHTTPServerTransport> = {};

  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok' });
  });

  app.post('/mcp', async (req: Request, res: Response) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    try {
      if (sessionId && transports[sessionId]) {
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
        },
      });
      transport.onclose = () => {
        if (transport.sessionId) delete transports[transport.sessionId];
      };
      await createServer().connect(transport as Parameters<Server['connect']>[0]);
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
    if (!transport) {
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
  app.get('/mcp', withSession);
  app.delete('/mcp', withSession);

  app.locals.transports = transports;
  return app;
}

export function startHttpServer(createServer: () => Server, options: HttpServerOptions) {
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
