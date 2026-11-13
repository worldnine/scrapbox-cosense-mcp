import { renderConsentPage, renderErrorPage, escapeHtml } from '../../auth/pages.js';

const params = {
  pendingId: 'pending-1',
  clientName: 'Claude',
  redirectUri: 'https://claude.ai/api/mcp/auth_callback',
  scopes: ['mcp'],
  resource: 'https://cosense-mcp.example.com/mcp',
  resourceHost: 'mcp.example.com',
    actionPath: '/oauth/consent',
};

describe('renderConsentPage', () => {
  it('ApproveがDOM上でDenyより先に来る', () => {
    // HTMLの暗黙送信は「DOM順で最初のsubmitボタン」を送る。Denyが先だと、
    // パスフレーズ欄でEnterを押した利用者が拒否を送ってしまう（2026-08-24に実際に踏んだ）。
    const html = renderConsentPage(params);
    expect(html.indexOf('value="approve"')).toBeLessThan(html.indexOf('value="deny"'));
  });

  it('Denyはパスフレーズの入力検証を飛ばす', () => {
    // passphrase が required なので、formnovalidate が無いと拒否すらできない
    expect(renderConsentPage(params)).toMatch(/value="deny" formnovalidate/);
  });

  it('クライアント名をエスケープする', () => {
    const html = renderConsentPage({ ...params, clientName: '<img src=x onerror=alert(1)>' });
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x');
  });

  it('エラーページはやり直し方を書く', () => {
    expect(renderErrorPage('expired')).toContain('Settings → Connectors → Connect');
  });

  it('escapeHtmlが引用符も処理する', () => {
    expect(escapeHtml(`"'&<>`)).toBe('&quot;&#39;&amp;&lt;&gt;');
  });
});
