import type { AddressInfo } from 'node:net';
import { request, type Server as HttpServer } from 'node:http';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { createApp } from '../http-server.js';

const makeServer = () =>
  new Server({ name: 'test', version: '0.0.0' }, { capabilities: { tools: {} } });

const initialize = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2025-03-26',
    capabilities: {},
    clientInfo: { name: 'test', version: '0.0.0' },
  },
};

const headers = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' };

describe('HTTP transport', () => {
  it('refuses to start without authentication unless explicitly allowed', () => {
    expect(() => createApp(makeServer, { port: 0 })).toThrow(/without authentication/);
  });

  describe('when started with MCP_ALLOW_UNAUTHENTICATED', () => {
    let httpServer: HttpServer;
    let base: string;

    beforeAll(async () => {
      const app = createApp(makeServer, { port: 0, allowUnauthenticated: true });
      httpServer = app.listen(0, '127.0.0.1');
      await new Promise((resolve) => httpServer.once('listening', resolve));
      base = `http://127.0.0.1:${(httpServer.address() as AddressInfo).port}`;
    });

    afterAll(async () => {
      httpServer.closeAllConnections();
      await new Promise((resolve) => httpServer.close(resolve));
    });

    it('answers /health', async () => {
      const res = await fetch(`${base}/health`);
      expect(await res.json()).toEqual({ status: 'ok' });
    });

    it('opens a session on initialize and returns its id', async () => {
      const res = await fetch(`${base}/mcp`, { method: 'POST', headers, body: JSON.stringify(initialize) });
      expect(res.status).toBe(200);
      expect(res.headers.get('mcp-session-id')).toBeTruthy();
    });

    it('returns 400 for a non-initialize request without a session', async () => {
      const res = await fetch(`${base}/mcp`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }),
      });
      expect(res.status).toBe(400);
    });

    it('returns 404 for an unknown session so the client re-initializes', async () => {
      const res = await fetch(`${base}/mcp`, {
        method: 'POST',
        headers: { ...headers, 'Mcp-Session-Id': 'no-such-session' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }),
      });
      expect(res.status).toBe(404);
    });

    it('rejects a Host header that is not localhost (DNS rebinding)', async () => {
      // fetch は Host を上書きさせてくれないので、node:http で直接送る
      const status = await new Promise<number>((resolve, reject) => {
        const req = request(`${base}/health`, { headers: { Host: 'evil.example' } }, (res) => {
          res.resume();
          resolve(res.statusCode ?? 0);
        });
        req.on('error', reject);
        req.end();
      });
      expect(status).toBe(403);
    });
  });
});
