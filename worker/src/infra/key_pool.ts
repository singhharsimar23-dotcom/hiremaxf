/**
 * KeyPool manages multiple API keys to bypass per-account rate limits.
 */
export class KeyPool {
  private keys: string[];
  private currentIndex: number;

  constructor(commaSeparatedKeys: string | undefined) {
    this.keys = (commaSeparatedKeys || '').split(',').map(k => k.trim()).filter(k => k.length > 0);
    this.currentIndex = 0;
  }

  /**
   * Returns the next key in the pool (Round Robin).
   */
  getNextKey(): string | null {
    if (this.keys.length === 0) return null;
    const key = this.keys[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.keys.length;
    return key;
  }

  /**
   * Returns the number of keys in the pool.
   */
  get size(): number {
    return this.keys.length;
  }
}
