import { resolveOAuthConfig, OAuthConfigError } from '../../auth/config.js';

const base = {
  MCP_PUBLIC_URL: 'https://cosense-mcp.example.com',
  MCP_OAUTH_PASSPHRASE: 'correct-horse-battery',
} as NodeJS.ProcessEnv;

describe('resolveOAuthConfig', () => {
  it('両方未設定ならOAuth無効（undefined）', () => {
    expect(resolveOAuthConfig({})).toBeUndefined();
  });

  it('issuerはorigin、resourceは/mcpまで含む', () => {
    const config = resolveOAuthConfig(base)!;
    expect(config.issuerUrl.href).toBe('https://cosense-mcp.example.com/');
    // クライアントに入力させるURLと完全一致させる必要がある
    expect(config.resourceUrl.href).toBe('https://cosense-mcp.example.com/mcp');
  });

  it('MCP_PUBLIC_URLに末尾スラッシュやパスがあってもresourceは/mcpに正規化される', () => {
    const config = resolveOAuthConfig({ ...base, MCP_PUBLIC_URL: 'https://cosense-mcp.example.com/' })!;
    expect(config.resourceUrl.href).toBe('https://cosense-mcp.example.com/mcp');
  });

  it('片方だけの設定は黙って無効化せず例外にする', () => {
    expect(() => resolveOAuthConfig({ MCP_PUBLIC_URL: base.MCP_PUBLIC_URL })).toThrow(OAuthConfigError);
    expect(() => resolveOAuthConfig({ MCP_OAUTH_PASSPHRASE: base.MCP_OAUTH_PASSPHRASE })).toThrow(OAuthConfigError);
  });

  it('短すぎるパスフレーズを拒否する', () => {
    expect(() => resolveOAuthConfig({ ...base, MCP_OAUTH_PASSPHRASE: 'short' })).toThrow(/at least 12/);
  });

  it('https以外はloopbackを除いて拒否する', () => {
    expect(() => resolveOAuthConfig({ ...base, MCP_PUBLIC_URL: 'http://cosense-mcp.example.com' })).toThrow(/https/);
    expect(resolveOAuthConfig({ ...base, MCP_PUBLIC_URL: 'http://localhost:4100' })).toBeDefined();
  });

  it('クエリやフラグメント付きのURLを拒否する', () => {
    expect(() => resolveOAuthConfig({ ...base, MCP_PUBLIC_URL: 'https://x.example.com/?a=1' })).toThrow(/query string/);
  });

  it('TTLは環境変数で上書きでき、不正値は例外', () => {
    const config = resolveOAuthConfig({ ...base, MCP_OAUTH_ACCESS_TTL: '900' })!;
    expect(config.accessTokenTtlSec).toBe(900);
    expect(() => resolveOAuthConfig({ ...base, MCP_OAUTH_ACCESS_TTL: '0' })).toThrow(OAuthConfigError);
  });
});
