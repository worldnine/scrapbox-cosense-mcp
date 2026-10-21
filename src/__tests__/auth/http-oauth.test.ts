/**
 * HTTP transport に OAuth を配線した状態のエンドツーエンド確認。
 * Claude.ai / ChatGPT が実際に叩く順番（discovery → DCR → authorize → token → MCP）をなぞる。
 */

import { createHash, randomBytes } from 'node:crypto';
import { createServer as createNetServer } from 'node:net';
import type { AddressInfo, Server as NetServer } from 'node:net';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { createApp } from '../../http-server.js';
import { resolveOAuthConfig } from '../../auth/config.js';

const PASSPHRASE = 'correct-horse-battery';
const REDIRECT_URI = 'https://claude.ai/api/mcp/auth_callback';

function mcpServerFactory(): Server {
  return new Server({ name: 'test', version: '0.0.0' }, { capabilities: { tools: {} } });
}

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createNetServer();
    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const port = (probe.address() as AddressInfo).port;
      probe.close(() => resolve(port));
    });
  });
}

function pkce(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

describe('HTTP transport + OAuth', () => {
  let port: number;
  let base: string;
  let listening: NetServer;

  beforeAll(async () => {
    port = await freePort();
    base = `http://localhost:${port}`;
    const oauth = resolveOAuthConfig({
      MCP_PUBLIC_URL: base,
      MCP_OAUTH_PASSPHRASE: PASSPHRASE,
    })!;
    const app = createApp(mcpServerFactory, { port, oauth });
    listening = await new Promise<NetServer>((resolve) => {
      const server = app.listen(port, '127.0.0.1', () => resolve(server));
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => listening.close(() => resolve()));
  });

  it('認証を何も設定せずにHTTPを開こうとすると起動を拒否する', () => {
    expect(() => createApp(mcpServerFactory, { port: 0 })).toThrow(/Refusing to start/);
    // 明示的にオプトアウトすれば起動できる
    expect(() => createApp(mcpServerFactory, { port: 0, allowUnauthenticated: true })).not.toThrow();
  });

  it('/health は認証なしで通る', async () => {
    const response = await fetch(`${base}/health`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  });

  it('無認証のMCPリクエストは401とWWW-Authenticateを返す', async () => {
    const response = await fetch(`${base}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    });
    expect(response.status).toBe(401);
    const challenge = response.headers.get('www-authenticate');
    // ここに resource_metadata が無いと、クライアントは再認可先を見つけられない
    expect(challenge).toContain(`resource_metadata="${base}/.well-known/oauth-protected-resource/mcp"`);
  });

  it('Protected Resource Metadata がパス付き・パス無しの両方で引ける', async () => {
    for (const path of ['/.well-known/oauth-protected-resource/mcp', '/.well-known/oauth-protected-resource']) {
      const response = await fetch(`${base}${path}`);
      expect(response.status).toBe(200);
      const metadata = await response.json();
      // 利用者が入力するURLと完全一致していること
      expect(metadata.resource).toBe(`${base}/mcp`);
      expect(metadata.authorization_servers[0]).toBe(`${base}/`);
    }
  });

  it('Authorization Server Metadata がクライアントの要求を満たす', async () => {
    const response = await fetch(`${base}/.well-known/oauth-authorization-server`);
    const metadata = await response.json();
    expect(metadata.code_challenge_methods_supported).toEqual(['S256']);
    // ChatGPTはこれを見て固定のリダイレクトURIに切り替える
    expect(metadata.authorization_response_iss_parameter_supported).toBe(true);
    expect(metadata.registration_endpoint).toBe(`${base}/register`);
    expect(metadata.grant_types_supported).toEqual(expect.arrayContaining(['authorization_code', 'refresh_token']));
  });

  /** DCR → authorize → consent → token を通してアクセストークンを取る。 */
  async function obtainToken(): Promise<{ clientId: string; accessToken: string; refreshToken: string }> {
    const registration = await fetch(`${base}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_name: 'Test Client',
        redirect_uris: [REDIRECT_URI],
        token_endpoint_auth_method: 'none',
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
      }),
    });
    expect(registration.status).toBe(201);
    const client = await registration.json();

    const { verifier, challenge } = pkce();
    const authorizeUrl = new URL(`${base}/authorize`);
    authorizeUrl.search = new URLSearchParams({
      client_id: client.client_id,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      code_challenge: challenge,
      code_challenge_method: 'S256',
      state: 'state-123',
      resource: `${base}/mcp`,
    }).toString();

    const consentPage = await fetch(authorizeUrl);
    expect(consentPage.status).toBe(200);
    const html = await consentPage.text();
    const pendingId = /name="pending_id" value="([^"]+)"/.exec(html)![1]!;

    const approved = await fetch(`${base}/oauth/consent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      redirect: 'manual',
      body: new URLSearchParams({ pending_id: pendingId, passphrase: PASSPHRASE, action: 'approve' }),
    });
    expect(approved.status).toBe(302);
    const redirect = new URL(approved.headers.get('location')!);
    expect(redirect.searchParams.get('state')).toBe('state-123');
    const code = redirect.searchParams.get('code')!;

    const tokenResponse = await fetch(`${base}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        code_verifier: verifier,
        client_id: client.client_id,
        redirect_uri: REDIRECT_URI,
        resource: `${base}/mcp`,
      }),
    });
    expect(tokenResponse.status).toBe(200);
    const tokens = await tokenResponse.json();
    return { clientId: client.client_id, accessToken: tokens.access_token, refreshToken: tokens.refresh_token };
  }

  it('DCRから認可コード交換まで通り、トークンでMCPが叩ける', async () => {
    const { accessToken } = await obtainToken();

    const response = await fetch(`${base}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } },
      }),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('mcp-session-id')).toBeTruthy();
  });

  it('パスフレーズが違うと401で同意画面が出し直される', async () => {
    const registration = await fetch(`${base}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_name: 'Wrong Pass', redirect_uris: [REDIRECT_URI], token_endpoint_auth_method: 'none' }),
    });
    const client = await registration.json();
    const { challenge } = pkce();
    const authorizeUrl = new URL(`${base}/authorize`);
    authorizeUrl.search = new URLSearchParams({
      client_id: client.client_id,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      code_challenge: challenge,
      code_challenge_method: 'S256',
    }).toString();
    const html = await (await fetch(authorizeUrl)).text();
    const pendingId = /name="pending_id" value="([^"]+)"/.exec(html)![1]!;

    const denied = await fetch(`${base}/oauth/consent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      redirect: 'manual',
      body: new URLSearchParams({ pending_id: pendingId, passphrase: 'nope', action: 'approve' }),
    });
    expect(denied.status).toBe(401);
    expect(await denied.text()).toContain('Incorrect passphrase');
  });

  it('actionが付かない送信（Enterによる暗黙送信）は承認として扱う', async () => {
    const registration = await fetch(`${base}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_name: 'Implicit Submit', redirect_uris: [REDIRECT_URI], token_endpoint_auth_method: 'none' }),
    });
    const client = await registration.json();
    const authorizeUrl = new URL(`${base}/authorize`);
    authorizeUrl.search = new URLSearchParams({
      client_id: client.client_id,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      code_challenge: pkce().challenge,
      code_challenge_method: 'S256',
    }).toString();
    const html = await (await fetch(authorizeUrl)).text();
    const pendingId = /name="pending_id" value="([^"]+)"/.exec(html)![1]!;

    // ボタンのname/valueを送らないブラウザがあるため、action無しでも拒否側に倒さない
    const response = await fetch(`${base}/oauth/consent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      redirect: 'manual',
      body: new URLSearchParams({ pending_id: pendingId, passphrase: PASSPHRASE }),
    });
    expect(response.status).toBe(302);
    expect(new URL(response.headers.get('location')!).searchParams.get('code')).toBeTruthy();
  });

  it('拒否したあとに再送信すると期限切れ扱いになる', async () => {
    const registration = await fetch(`${base}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_name: 'Deny Then Retry', redirect_uris: [REDIRECT_URI], token_endpoint_auth_method: 'none' }),
    });
    const client = await registration.json();
    const authorizeUrl = new URL(`${base}/authorize`);
    authorizeUrl.search = new URLSearchParams({
      client_id: client.client_id,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      code_challenge: pkce().challenge,
      code_challenge_method: 'S256',
    }).toString();
    const html = await (await fetch(authorizeUrl)).text();
    const pendingId = /name="pending_id" value="([^"]+)"/.exec(html)![1]!;

    const denied = await fetch(`${base}/oauth/consent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      redirect: 'manual',
      body: new URLSearchParams({ pending_id: pendingId, passphrase: '', action: 'deny' }),
    });
    expect(denied.status).toBe(302);
    expect(new URL(denied.headers.get('location')!).searchParams.get('error')).toBe('access_denied');

    // 戻るボタンで戻って再送信したときに出る画面（2026-08-24に本番で遭遇したもの）
    const retry = await fetch(`${base}/oauth/consent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      redirect: 'manual',
      body: new URLSearchParams({ pending_id: pendingId, passphrase: PASSPHRASE, action: 'approve' }),
    });
    expect(retry.status).toBe(400);
    expect(await retry.text()).toContain('has expired');
  });

  it('リフレッシュトークンで再発行できる', async () => {
    const { clientId, refreshToken } = await obtainToken();
    const response = await fetch(`${base}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken, client_id: clientId }),
    });
    expect(response.status).toBe(200);
    expect((await response.json()).access_token).toBeTruthy();
  });

  it('別リソース宛のトークン要求はinvalid_targetで落ちる', async () => {
    const registration = await fetch(`${base}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_name: 'Bad Audience', redirect_uris: [REDIRECT_URI], token_endpoint_auth_method: 'none' }),
    });
    const client = await registration.json();
    const authorizeUrl = new URL(`${base}/authorize`);
    authorizeUrl.search = new URLSearchParams({
      client_id: client.client_id,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      code_challenge: pkce().challenge,
      code_challenge_method: 'S256',
      resource: 'https://evil.example.com/mcp',
    }).toString();

    // 認可段階でエラーとしてリダイレクトされる（トークンは発行されない）
    const response = await fetch(authorizeUrl, { redirect: 'manual' });
    expect(response.status).toBe(302);
    expect(new URL(response.headers.get('location')!).searchParams.get('error')).toBe('invalid_target');
  });

  it('セッションIDを知っていても、別の認可のトークンではそのセッションを触れない', async () => {
    const alice = await obtainToken();
    const bob = await obtainToken();

    const init = await fetch(`${base}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        Authorization: `Bearer ${alice.accessToken}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'alice', version: '1' } },
      }),
    });
    const sessionId = init.headers.get('mcp-session-id')!;
    expect(sessionId).toBeTruthy();

    const callAs = (accessToken: string) =>
      fetch(`${base}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
          Authorization: `Bearer ${accessToken}`,
          'Mcp-Session-Id': sessionId,
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }),
      });

    // 他人のトークンでは、セッションの存在すら伏せて 404 にする
    const stolen = await callAs(bob.accessToken);
    expect(stolen.status).toBe(404);

    // 本人はそのまま使い続けられる
    const own = await callAs(alice.accessToken);
    expect(own.status).toBe(200);

    // リフレッシュでトークンがローテートしても、同じ認可なのでセッションは切れない
    const refreshed = await fetch(`${base}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: alice.refreshToken,
        client_id: alice.clientId,
        resource: `${base}/mcp`,
      }),
    });
    expect(refreshed.status).toBe(200);
    const rotated = await refreshed.json();
    const afterRefresh = await callAs(rotated.access_token);
    expect(afterRefresh.status).toBe(200);
  });

  it('偽のBearerトークンは401になる', async () => {
    const response = await fetch(`${base}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer not-a-real-token' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    });
    expect(response.status).toBe(401);
  });
});
