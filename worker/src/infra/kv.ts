import { Env } from '../config/env';

/**
 * Retrieves a JSON-parsed value from Cloudflare KV.
 * Returns null if the key is missing or if an error occurs during retrieval/parsing.
 */
export async function get<T>(env: Env, key: string): Promise<T | null> {
  try {
    return await env.KV_JOBS.get<T>(key, 'json');
  } catch (error) {
    // Swallow errors and return null as per the error contract
    return null;
  }
}

/**
 * Sets a value in Cloudflare KV with a specific TTL (in seconds).
 * Implements the CRITICAL KV WRITE RULE:
 * If qualityScore is provided and < 0.7, the write is skipped to preserve free tier limits.
 */
export async function set(
  env: Env,
  key: string,
  value: unknown,
  ttlSeconds: number,
  qualityScore?: number
): Promise<boolean> {
  // CRITICAL KV WRITE RULE: Skip write if quality is too low
  if (qualityScore !== undefined && qualityScore < 0.7) {
    return false;
  }

  try {
    await env.KV_JOBS.put(key, JSON.stringify(value), {
      expirationTtl: ttlSeconds,
    });
    return true;
  } catch (error) {
    // Return false on error instead of throwing
    return false;
  }
}

/**
 * Deletes a key from Cloudflare KV.
 * Errors are caught and logged as warnings but never thrown.
 */
export async function del(env: Env, key: string): Promise<void> {
  try {
    await env.KV_JOBS.delete(key);
  } catch (error) {
    // Swallows errors but logs for observability
    console.warn(`[kv.del] Failed to delete key: ${key}`, error);
  }
}
