import { createHash, timingSafeEqual } from 'node:crypto';

/** 同意画面を出し直すべきエラー（パスフレーズ間違い等）。 */
export class ConsentError extends Error {}

/**
 * 同意フォームの入力。`passphrase` は必ず入る。
 * 画面を差し替えて欄を増やした場合、増やした欄の値は欄名のままここに入ってくる。
 */
export type ConsentSubmission = { passphrase: string } & Readonly<Record<string, string>>;

/** 認証を通った「誰か」。トークンに焼かれ、`AuthInfo.extra.userId` として下流に渡る。 */
export interface AuthenticatedUser {
  id: string;
}

/**
 * 同意フォームの入力が、このサーバーに接続してよい人のものかを判定する。
 *
 * 認可フローの残り（PKCE、トークン発行、失効）は誰が通っても同じなので、
 * 「誰を通すか」だけをここに切り出している。利用者を複数にしたい場合は、
 * この実装を差し替える。通さないときは `ConsentError` を投げる。
 */
export interface ConsentAuthenticator {
  authenticate(submission: ConsentSubmission): AuthenticatedUser;
}

/** 単独利用のときの利用者ID。 */
export const DEFAULT_USER_ID = 'default';

/** 環境変数のパスフレーズ 1 つで、利用者 1 人を通す。 */
export class PassphraseAuthenticator implements ConsentAuthenticator {
  private readonly digest: Buffer;

  constructor(passphrase: string) {
    this.digest = sha256(passphrase);
  }

  authenticate(submission: ConsentSubmission): AuthenticatedUser {
    // 長さが違っても同じ時間で比べられるよう、ハッシュ同士を比較する。
    if (!timingSafeEqual(sha256(submission.passphrase), this.digest)) {
      throw new ConsentError('Incorrect passphrase.');
    }
    return { id: DEFAULT_USER_ID };
  }
}

function sha256(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}
