type StoredResult = {
  status: number;
  headers?: Record<string, string>;
  body: any;
  // simple absolute expiry (ms since epoch)
  expiresAt: number;
};

export class IdempotencyStore {
  private map = new Map<string, StoredResult>();
  constructor(private ttlMs = 10 * 60 * 1000) {} // 10 minutes default

  get(key: string) {
    const v = this.map.get(key);
    if (!v) return undefined;
    if (Date.now() > v.expiresAt) {
      this.map.delete(key);
      return undefined;
    }
    return v;
  }

  set(
    key: string,
    status: number,
    body: any,
    headers?: Record<string, string>,
  ) {
    this.map.set(key, {
      status,
      body,
      headers,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  clear() {
    this.map.clear();
  }
}
