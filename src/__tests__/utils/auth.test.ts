import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { credentialHeaders, resetCredentialCache, resolveCredential } from '@/utils/auth.js';

describe('resolveCredential', () => {
  const settingsDir = () => join(process.env.HOME!, '.cosense');
  const writeSettings = (settings: unknown) => {
    mkdirSync(settingsDir(), { recursive: true });
    writeFileSync(join(settingsDir(), 'settings.json'), typeof settings === 'string' ? settings : JSON.stringify(settings));
  };

  beforeEach(() => {
    resetCredentialCache();
  });

  afterEach(() => {
    delete process.env.COSENSE_PAT;
    delete process.env.API_DOMAIN;
    rmSync(settingsDir(), { recursive: true, force: true });
    resetCredentialCache();
  });

  test('何も無ければ undefined を返すこと', () => {
    expect(resolveCredential('project')).toBeUndefined();
  });

  test('SID だけなら SID を返すこと', () => {
    expect(resolveCredential('project', 'sid-value')).toEqual({ type: 'sid', value: 'sid-value' });
  });

  test('COSENSE_PAT は SID より優先されること', () => {
    process.env.COSENSE_PAT = 'pat-value';
    expect(resolveCredential('project', 'sid-value')).toEqual({ type: 'personalAccessToken', value: 'pat-value' });
  });

  test('空白だけの COSENSE_PAT は無視すること', () => {
    process.env.COSENSE_PAT = '   ';
    expect(resolveCredential('project', 'sid-value')).toEqual({ type: 'sid', value: 'sid-value' });
  });

  test('SID は設定ファイルより優先されること（明示した環境変数が先）', () => {
    writeSettings({ users: [{ url: 'https://scrapbox.io', token: 'file-pat' }] });
    expect(resolveCredential('project', 'sid-value')).toEqual({ type: 'sid', value: 'sid-value' });
  });

  test('環境変数が無ければ設定ファイルの PAT を使うこと', () => {
    writeSettings({ users: [{ url: 'https://scrapbox.io', token: 'file-pat' }] });
    expect(resolveCredential('project')).toEqual({ type: 'personalAccessToken', value: 'file-pat' });
  });

  test('そのプロジェクトの Service Account を PAT より優先すること', () => {
    writeSettings({
      projects: [
        { url: 'https://scrapbox.io/other', serviceAccount: 'cs_other' },
        { url: 'https://scrapbox.io/Project', serviceAccount: 'cs_mine' },
      ],
      users: [{ url: 'https://scrapbox.io', token: 'file-pat' }],
    });
    // プロジェクト名は大文字小文字を区別しない（公式 CLI と同じ）
    expect(resolveCredential('project')).toEqual({ type: 'serviceAccount', value: 'cs_mine' });
    expect(resolveCredential('another')).toEqual({ type: 'personalAccessToken', value: 'file-pat' });
  });

  test('API_DOMAIN と origin が合わない項目は使わないこと', () => {
    process.env.API_DOMAIN = 'example.com';
    writeSettings({ users: [{ url: 'https://scrapbox.io', token: 'file-pat' }] });
    expect(resolveCredential('project')).toBeUndefined();
  });

  test('壊れた設定ファイルは無視すること', () => {
    writeSettings('{ not json');
    expect(resolveCredential('project')).toBeUndefined();
  });

  test('形の合わない項目だけを飛ばすこと', () => {
    writeSettings({
      users: [
        { url: 'not a url', token: 'broken' },
        { url: 'https://scrapbox.io', token: '' },
        { url: 'https://scrapbox.io', token: 'file-pat' },
      ],
    });
    expect(resolveCredential('project')).toEqual({ type: 'personalAccessToken', value: 'file-pat' });
  });
});

describe('credentialHeaders', () => {
  test('資格情報の種類ごとのヘッダを返すこと', () => {
    expect(credentialHeaders({ type: 'personalAccessToken', value: 't' })).toEqual({ 'x-personal-access-token': 't' });
    expect(credentialHeaders({ type: 'serviceAccount', value: 'k' })).toEqual({ 'x-service-account-access-key': 'k' });
    expect(credentialHeaders({ type: 'sid', value: 's' })).toEqual({ Cookie: 'connect.sid=s' });
    expect(credentialHeaders(undefined)).toEqual({});
  });
});
