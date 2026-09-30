/**
 * Cosense API に送る資格情報。
 *
 * PAT と Service Account は外部ツール向けに用意された仕組みで、書き込みは編集 API
 * （`page-edit-for-ai`）を通す。SID はブラウザの `connect.sid` で、編集 API は
 * cookie 認証の書き込みを CSRF 対策で拒否する（`CrossOriginWriteNotAllowedError`）ため、
 * 書き込みは従来どおり websocket を通す。
 */
export type Credential =
  | { type: 'personalAccessToken'; value: string }
  | { type: 'serviceAccount'; value: string }
  | { type: 'sid'; value: string };

export function getApiDomain(): string {
  return process.env.API_DOMAIN || 'scrapbox.io';
}

// Service Account の Access Key の接頭辞。公式 CLI の `cosense login` も、これで PAT と見分ける
const SERVICE_ACCOUNT_PREFIX = 'cs_';

/**
 * 使う資格情報を決める。`sid`（呼び出し側が渡す `COSENSE_SID`）→ `COSENSE_MCP_PAT` の順。
 *
 * 公式 CLI が読む `COSENSE_PAT` ではなく、このサーバー専用の `COSENSE_MCP_PAT` を読む。
 * 公式 CLI のためにシェルで `COSENSE_PAT` を export している人がいて、MCP サーバーは親の
 * 環境を受け継ぐ。同じ名前を読むと、このサーバーに資格情報を渡していないつもりの環境でも、
 * アップデートしただけで書き込めるようになってしまう。
 *
 * SID を先にするのは、今 SID で使っている環境を、PAT を足しただけで変えないため。
 * PAT に移るときは `COSENSE_SID` を外してもらう。
 *
 * `COSENSE_MCP_PAT` に `cs_` で始まる値が入っていれば Service Account として送る。
 *
 * 公式 CLI が保存する `~/.cosense/settings.json` は読まない。読むと、このサーバーに
 * 資格情報を渡していないつもりの環境（公開プロジェクトを読むだけ、など）でも、
 * `cosense login` を済ませているだけで書き込めるようになり、本人が見られる全プロジェクトに
 * 届いてしまう。書き込める力は、このサーバーの設定として明示したときだけ持たせる。
 */
export function resolveCredential(sid?: string): Credential | undefined {
  if (sid) return { type: 'sid', value: sid };
  const token = process.env.COSENSE_MCP_PAT?.trim();
  if (token) {
    return token.startsWith(SERVICE_ACCOUNT_PREFIX)
      ? { type: 'serviceAccount', value: token }
      : { type: 'personalAccessToken', value: token };
  }
  return undefined;
}

/** 資格情報を載せるリクエストヘッダ。資格情報が無ければ空 */
export function credentialHeaders(credential: Credential | undefined): Record<string, string> {
  switch (credential?.type) {
    case 'personalAccessToken':
      return { 'x-personal-access-token': credential.value };
    case 'serviceAccount':
      return { 'x-service-account-access-key': credential.value };
    case 'sid':
      return { Cookie: `connect.sid=${credential.value}` };
    default:
      return {};
  }
}
