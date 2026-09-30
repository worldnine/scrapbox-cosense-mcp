import { credentialHeaders, resolveCredential } from '@/utils/auth.js';

describe('resolveCredential', () => {
  afterEach(() => {
    delete process.env.COSENSE_PAT;
  });

  test('何も無ければ undefined を返すこと', () => {
    expect(resolveCredential()).toBeUndefined();
  });

  test('SID だけなら SID を返すこと', () => {
    expect(resolveCredential('sid-value')).toEqual({ type: 'sid', value: 'sid-value' });
  });

  test('COSENSE_PAT は SID より優先されること', () => {
    process.env.COSENSE_PAT = 'pat-value';
    expect(resolveCredential('sid-value')).toEqual({ type: 'personalAccessToken', value: 'pat-value' });
  });

  test('空白だけの COSENSE_PAT は無視すること', () => {
    process.env.COSENSE_PAT = '   ';
    expect(resolveCredential('sid-value')).toEqual({ type: 'sid', value: 'sid-value' });
  });

  test('cs_ で始まる COSENSE_PAT は Service Account として扱うこと', () => {
    process.env.COSENSE_PAT = 'cs_key';
    expect(resolveCredential()).toEqual({ type: 'serviceAccount', value: 'cs_key' });
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
