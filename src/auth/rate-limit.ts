/**
 * 固定ウィンドウの簡易レートリミッタ。
 * パスフレーズ入力の総当たりを鈍らせるためだけのもので、外部依存を増やさない範囲で足りる。
 */
export class FixedWindowRateLimiter {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number
  ) {}

  /** 試行を1つ記録し、上限内なら true を返す。 */
  tryConsume(key: string, now: number = Date.now()): boolean {
    const entry = this.hits.get(key);
    if (!entry || entry.resetAt <= now) {
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
      this.sweep(now);
      return true;
    }
    entry.count += 1;
    return entry.count <= this.limit;
  }

  /** 認証成功時など、その鍵の試行回数をリセットする。 */
  reset(key: string): void {
    this.hits.delete(key);
  }

  private sweep(now: number): void {
    for (const [key, entry] of this.hits) {
      if (entry.resetAt <= now) this.hits.delete(key);
    }
  }
}
