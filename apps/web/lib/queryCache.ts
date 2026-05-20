// apps/web/lib/queryCache.ts
// Minimal stale-while-revalidate memory cache. Zero dependencies.

interface CacheEntry { data: unknown; ts: number; }
const store: Record<string, CacheEntry> = {};

export function getCached<T>(key: string): T | null {
  return store[key] ? (store[key].data as T) : null;
}
export function setCached(key: string, data: unknown): void {
  store[key] = { data, ts: Date.now() };
}
export function isFresh(key: string, ttlMs = 60_000): boolean {
  const e = store[key];
  return !!e && Date.now() - e.ts < ttlMs;
}
export function invalidate(key: string): void {
  delete store[key];
}

// Append to queryCache.ts:
export async function safeQuery<T>(
  supabaseClient: any,
  queryFn: () => Promise<{ data: T | null; error: any }>,
  fallback: T,
): Promise<T> {
  try {
    const { data, error } = await queryFn();
    if (error) {
      if (error.code === 'PGRST301' || error?.message?.includes('JWT')) {
        await supabaseClient.auth.refreshSession();
        const retry = await queryFn();
        return retry.data ?? fallback;
      }
      console.error('[supabase]', error.message);
      return fallback;
    }
    return data ?? fallback;
  } catch (err) {
    console.error('[supabase threw]', err);
    return fallback;
  }
}
