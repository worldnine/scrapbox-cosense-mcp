import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { OAuthStore, generateToken, hashToken } from '../../auth/store.js';
import type { OAuthClientInformationFull } from '@modelcontextprotocol/sdk/shared/auth.js';

const client = {
  client_id: 'client-1',
  client_name: 'Test',
  redirect_uris: ['https://claude.ai/api/mcp/auth_callback'],
} as OAuthClientInformationFull;

function future(seconds = 3600): number {
  return Math.floor(Date.now() / 1000) + seconds;
}

describe('OAuthStore', () => {
  let dir: string;
  let file: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'oauth-store-'));
    file = join(dir, 'nested', 'store.json');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('クライアント登録とトークンがプロセスをまたいで復元される', () => {
    const store = new OAuthStore(file);
    const token = generateToken();
    store.saveClient(client);
    store.saveAccessToken(token, { clientId: client.client_id, scopes: ['mcp'], expiresAt: future() });
    store.flush();

    const reloaded = new OAuthStore(file);
    expect(reloaded.getClient('client-1')?.client_name).toBe('Test');
    expect(reloaded.getAccessToken(token)?.clientId).toBe('client-1');
  });

  it('トークンは平文で保存されない', () => {
    const store = new OAuthStore(file);
    const token = generateToken();
    store.saveAccessToken(token, { clientId: 'c', scopes: [], expiresAt: future() });
    store.flush();

    const raw = readFileSync(file, 'utf-8');
    expect(raw).not.toContain(token);
    expect(raw).toContain(hashToken(token));
  });

  it('期限切れのアクセストークンは取得できない', () => {
    const store = new OAuthStore();
    const token = generateToken();
    store.saveAccessToken(token, { clientId: 'c', scopes: [], expiresAt: future(-1) });
    expect(store.getAccessToken(token)).toBeUndefined();
  });

  it('リフレッシュトークンは1回しか使えない（ローテーション）', () => {
    const store = new OAuthStore();
    const token = generateToken();
    store.saveRefreshToken(token, { clientId: 'c', scopes: ['mcp'], expiresAt: future() });
    expect(store.consumeRefreshToken(token)?.scopes).toEqual(['mcp']);
    expect(store.consumeRefreshToken(token)).toBeUndefined();
  });

  it('resource（audience）を保持する', () => {
    const store = new OAuthStore();
    const token = generateToken();
    store.saveAccessToken(token, {
      clientId: 'c',
      scopes: [],
      expiresAt: future(),
      resource: 'https://cosense-mcp.example.com/mcp',
    });
    expect(store.getAccessToken(token)?.resource).toBe('https://cosense-mcp.example.com/mcp');
  });

  it('クライアント単位で全トークンを失効できる', () => {
    const store = new OAuthStore();
    const access = generateToken();
    const refresh = generateToken();
    store.saveAccessToken(access, { clientId: 'c', scopes: [], expiresAt: future() });
    store.saveRefreshToken(refresh, { clientId: 'c', scopes: [], expiresAt: future() });
    store.revokeClientTokens('c');
    expect(store.getAccessToken(access)).toBeUndefined();
    expect(store.consumeRefreshToken(refresh)).toBeUndefined();
  });

  it('壊れたストアファイルでも起動する', () => {
    writeFileSync(join(dir, 'broken.json'), '{ not json');
    const store = new OAuthStore(join(dir, 'broken.json'));
    expect(store.countClients()).toBe(0);
  });

  it('ストアパス未指定ならファイルを作らない', () => {
    const store = new OAuthStore();
    store.saveClient(client);
    store.flush();
    expect(store.getClient('client-1')).toBeDefined();
  });
});
