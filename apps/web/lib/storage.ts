const QUOTA_THRESHOLD = 4 * 1024 * 1024;

export function getLocalStorageUsage(): number {
  let total = 0;
  for (const key of Object.keys(localStorage)) {
    total += (key.length + (localStorage.getItem(key) || '').length) * 2;
  }
  return total;
}

export function evictOldHiremaxKeys(keepKeys: string[] = []): void {
  const hiremaxKeys = Object.keys(localStorage)
    .filter(k => k.startsWith('hiremax_') && !keepKeys.includes(k))
    .map(k => {
      try {
        const val = JSON.parse(localStorage.getItem(k) || '{}');
        return { key: k, ts: val.savedAt || val.cachedAt || val.timestamp || 0 };
      } catch { return { key: k, ts: 0 }; }
    })
    .sort((a, b) => a.ts - b.ts);

  for (const { key } of hiremaxKeys) {
    if (getLocalStorageUsage() < QUOTA_THRESHOLD) break;
    localStorage.removeItem(key);
  }
}

export function safeWrite(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    if (getLocalStorageUsage() > QUOTA_THRESHOLD) evictOldHiremaxKeys([key]);
    return true;
  } catch (e: any) {
    if (e?.name === 'QuotaExceededError') {
      evictOldHiremaxKeys([key]);
      try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch {}
    }
    return false;
  }
}
