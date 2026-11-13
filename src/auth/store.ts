/**
 * OAuth のクライアント登録・トークンの保存層。
 *
 * トークンは平文では保存せず SHA-256 のハッシュだけを持つ（ストアファイルが漏れても
 * そのまま使えるトークンにはならないようにする）。認可コードと未承認の認可リクエストは
 * 寿命が10分なので永続化しない — 再起動をまたいでフローが途切れてもクライアントは
 * 再認可するだけで済む。
 */

import { createHash, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { OAuthClientInformationFull } from '@modelcontextprotocol/sdk/shared/auth.js';

export interface GrantRecord {
  clientId: string;
  /** 認証を通した利用者（`ConsentAuthenticator` が返した ID）。 */
  userId?: string;
  scopes: string[];
  /** 秒精度の UNIX 時刻。 */
  expiresAt: number;
  /** RFC 8707 の audience。トークン検証時にサーバーの resource と突き合わせる。 */
  resource?: string;
  /**
   * 同じ認可から発行されたトークン同士を結ぶID。
   * RFC 7009 は「リフレッシュトークンを取り消したら、同じ認可から出たアクセストークンも
   * 無効にすべき」としている。個々のトークン値だけでは辿れないのでIDで束ねる。
   * 古いストアには無いので optional。
   */
  grantId?: string;
}

interface StoreData {
  version: 1;
  clients: Record<string, OAuthClientInformationFull>;
  accessTokens: Record<string, GrantRecord>;
  refreshTokens: Record<string, GrantRecord>;
}

function emptyData(): StoreData {
  return { version: 1, clients: {}, accessTokens: {}, refreshTokens: {} };
}

/** トークン文字列をストアのキーに変換する。 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** URL-safe な不透明トークンを生成する。 */
export function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

export class OAuthStore {
  private data: StoreData = emptyData();
  private readonly filePath: string | undefined;
  private flushTimer: NodeJS.Timeout | undefined;

  constructor(filePath?: string) {
    this.filePath = filePath;
    this.load();
  }

  private load(): void {
    if (!this.filePath || !existsSync(this.filePath)) return;
    try {
      const parsed = JSON.parse(readFileSync(this.filePath, 'utf-8')) as Partial<StoreData>;
      if (parsed.version !== 1) {
        console.error(`[oauth] ignoring store with unsupported version: ${String(parsed.version)}`);
        return;
      }
      this.data = {
        version: 1,
        clients: parsed.clients ?? {},
        accessTokens: parsed.accessTokens ?? {},
        refreshTokens: parsed.refreshTokens ?? {},
      };
      this.pruneExpired();
    } catch (error) {
      // 壊れたストアで起動を止めない。全クライアントが再登録・再認可すれば復帰できる。
      console.error('[oauth] failed to read store, starting empty:', error);
      this.data = emptyData();
    }
  }

  /**
   * ディスクに書き出す。同一 tick 内の複数更新をまとめるため既定では遅延させる。
   * テストとシャットダウン時は `flush()` で即時に確定させる。
   */
  private schedulePersist(): void {
    if (!this.filePath) return;
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => this.flush(), 50);
    this.flushTimer.unref?.();
  }

  flush(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = undefined;
    }
    if (!this.filePath) return;
    try {
      mkdirSync(dirname(this.filePath), { recursive: true });
      // 書き込み中に落ちても既存ファイルを壊さないよう temp → rename で置き換える。
      const tmp = `${this.filePath}.tmp`;
      writeFileSync(tmp, JSON.stringify(this.data), { mode: 0o600 });
      renameSync(tmp, this.filePath);
    } catch (error) {
      console.error('[oauth] failed to persist store:', error);
    }
  }

  pruneExpired(): void {
    const cutoff = nowSec();
    let changed = false;
    for (const bucket of [this.data.accessTokens, this.data.refreshTokens]) {
      for (const [key, record] of Object.entries(bucket)) {
        if (record.expiresAt <= cutoff) {
          delete bucket[key];
          changed = true;
        }
      }
    }
    if (changed) this.schedulePersist();
  }

  // --- クライアント登録 ---

  getClient(clientId: string): OAuthClientInformationFull | undefined {
    return this.data.clients[clientId];
  }

  saveClient(client: OAuthClientInformationFull): void {
    this.data.clients[client.client_id] = client;
    this.schedulePersist();
  }

  countClients(): number {
    return Object.keys(this.data.clients).length;
  }

  // --- トークン ---

  saveAccessToken(token: string, record: GrantRecord): void {
    this.data.accessTokens[hashToken(token)] = record;
    this.schedulePersist();
  }

  getAccessToken(token: string): GrantRecord | undefined {
    const record = this.data.accessTokens[hashToken(token)];
    if (!record) return undefined;
    if (record.expiresAt <= nowSec()) {
      delete this.data.accessTokens[hashToken(token)];
      this.schedulePersist();
      return undefined;
    }
    return record;
  }

  deleteAccessToken(token: string): boolean {
    const key = hashToken(token);
    if (!(key in this.data.accessTokens)) return false;
    delete this.data.accessTokens[key];
    this.schedulePersist();
    return true;
  }

  saveRefreshToken(token: string, record: GrantRecord): void {
    this.data.refreshTokens[hashToken(token)] = record;
    this.schedulePersist();
  }

  /**
   * リフレッシュトークンを1回だけ使える形で取り出す（ローテーション）。
   * 使い回しを検出しやすくするため、取得と同時に無効化する。
   */
  consumeRefreshToken(token: string): GrantRecord | undefined {
    const key = hashToken(token);
    const record = this.data.refreshTokens[key];
    if (!record) return undefined;
    delete this.data.refreshTokens[key];
    this.schedulePersist();
    if (record.expiresAt <= nowSec()) return undefined;
    return record;
  }

  deleteRefreshToken(token: string): boolean {
    const key = hashToken(token);
    if (!(key in this.data.refreshTokens)) return false;
    delete this.data.refreshTokens[key];
    this.schedulePersist();
    return true;
  }

  /**
   * 同じ認可から発行されたトークンをまとめて失効させる。
   * grantId を持たない古いレコードには何もしない（呼び出し側が個別に消す）。
   */
  revokeGrant(grantId: string): number {
    let removed = 0;
    for (const bucket of [this.data.accessTokens, this.data.refreshTokens]) {
      for (const [key, record] of Object.entries(bucket)) {
        if (record.grantId === grantId) {
          delete bucket[key];
          removed += 1;
        }
      }
    }
    if (removed > 0) this.schedulePersist();
    return removed;
  }

  /** トークン値から、それが属する認可を引く（失効の起点を決めるため）。 */
  findGrantId(token: string): string | undefined {
    const key = hashToken(token);
    return this.data.accessTokens[key]?.grantId ?? this.data.refreshTokens[key]?.grantId;
  }

  /** クライアントに紐づくトークンをすべて失効させる。 */
  revokeClientTokens(clientId: string): void {
    for (const bucket of [this.data.accessTokens, this.data.refreshTokens]) {
      for (const [key, record] of Object.entries(bucket)) {
        if (record.clientId === clientId) delete bucket[key];
      }
    }
    this.schedulePersist();
  }
}
