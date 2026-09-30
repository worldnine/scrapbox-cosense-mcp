import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

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

interface CosenseSettings {
  /** [origin, 小文字のプロジェクト名, Service Account の Access Key] */
  projects: Array<[string, string, string]>;
  /** [origin, PAT] */
  users: Array<[string, string]>;
}

let settingsCache: { value: CosenseSettings } | undefined;

function originOf(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.origin : undefined;
  } catch {
    return undefined;
  }
}

/**
 * 公式 CLI（`cosense login`）が保存する `~/.cosense/settings.json` を読む。
 *
 * 公式 CLI は壊れた設定を例外にするが、ここでは読めない項目を無視する。
 * 設定ファイルは公式 CLI と共有するもので、その不備でこのサーバーの読み取りまで
 * 止めたくないため。
 *
 * ホームは `process.env.HOME` を先に見る。POSIX では `os.homedir()` と同じ答えだが、
 * jest はテストごとに `process.env` の写しを使い、ネイティブの `os.homedir()` には
 * 差し替えが届かない。テストが開発者の本物の資格情報を読まないようにするため。
 */
function loadSettings(): CosenseSettings {
  if (settingsCache) return settingsCache.value;
  const value: CosenseSettings = { projects: [], users: [] };
  settingsCache = { value };

  let raw: unknown;
  try {
    const home = process.env.HOME || homedir();
    raw = JSON.parse(readFileSync(join(home, '.cosense', 'settings.json'), 'utf8'));
  } catch {
    return value;
  }
  if (typeof raw !== 'object' || raw === null) return value;
  const { projects, users } = raw as { projects?: unknown; users?: unknown };

  if (Array.isArray(projects)) {
    for (const entry of projects) {
      const { url, serviceAccount } = (entry ?? {}) as { url?: unknown; serviceAccount?: unknown };
      if (typeof url !== 'string' || typeof serviceAccount !== 'string' || !serviceAccount.trim()) continue;
      const origin = originOf(url);
      const name = origin ? new URL(url).pathname.split('/').filter(Boolean)[0] : undefined;
      if (origin && name) value.projects.push([origin, name.toLowerCase(), serviceAccount]);
    }
  }
  if (Array.isArray(users)) {
    for (const entry of users) {
      const { url, token } = (entry ?? {}) as { url?: unknown; token?: unknown };
      if (typeof url !== 'string' || typeof token !== 'string' || !token.trim()) continue;
      const origin = originOf(url);
      if (origin) value.users.push([origin, token]);
    }
  }
  return value;
}

/** テスト用: 設定ファイルの読み込み結果を捨てる */
export function resetCredentialCache(): void {
  settingsCache = undefined;
}

/**
 * プロジェクトに使う資格情報を決める。
 *
 * 1. `COSENSE_PAT`
 * 2. `sid`（呼び出し側が渡す `COSENSE_SID`）
 * 3. `~/.cosense/settings.json` の、このプロジェクトの Service Account
 * 4. `~/.cosense/settings.json` の PAT
 *
 * 公式 CLI は環境変数の PAT → 設定ファイルの順で、SID を持たない。ここで SID を
 * 設定ファイルより前に置くのは、このサーバーの設定として明示した環境変数を優先するため。
 * `cosense login` を済ませただけで、SID で使っている人の書き込み経路が知らないうちに
 * 変わることがない。
 */
export function resolveCredential(projectName: string, sid?: string): Credential | undefined {
  const pat = process.env.COSENSE_PAT?.trim();
  if (pat) return { type: 'personalAccessToken', value: pat };
  if (sid) return { type: 'sid', value: sid };

  const origin = `https://${getApiDomain()}`;
  const settings = loadSettings();
  const nameLc = projectName.toLowerCase();
  const serviceAccount = settings.projects.find(([o, p]) => o === origin && p === nameLc);
  if (serviceAccount) return { type: 'serviceAccount', value: serviceAccount[2] };
  const user = settings.users.find(([o]) => o === origin);
  if (user) return { type: 'personalAccessToken', value: user[1] };
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
