import { Env } from '../config/env';
import { insert } from './db';
import { set } from './kv';

/**
 * Pushes a failed ingestion payload to the Dead Letter Queue (DLQ).
 * This is a two-tier system:
 * 1. Primary: Supabase 'ingestion_dlq' table.
 * 2. Fallback: Cloudflare KV (48hr TTL).
 *
 * This function NEVER throws and NEVER drops a payload.
 */
export async function push(
  env: Env,
  source: string,
  companySlug: string,
  payload: unknown,
  error: Error | string
): Promise<void> {
  const errorMessage = error.toString();

  try {
    // TIER 1: Primary storage in Supabase
    await insert(env, 'ingestion_dlq', {
      source,
      company_slug: companySlug,
      raw_payload: payload,
      error_message: errorMessage,
      retry_count: 0,
    });
  } catch (supabaseError) {
    // TIER 2: Fallback to Cloudflare KV if Supabase fails
    const timestamp = Date.now();
    const fingerprint = generateShortId();
    const kvKey = `dlq:fail:${timestamp}:${fingerprint}`;

    try {
      const success = await set(
        env,
        kvKey,
        {
          source,
          companySlug,
          payload,
          error: errorMessage,
        },
        172800 // 48 hours
      );

      if (success) {
        console.warn('[dlq] Supabase failed, wrote to KV:', kvKey);
      } else {
        throw new Error('KV set returned false');
      }
    } catch (kvError) {
      // LAST RESORT: Log to console if both tiers fail
      console.error('[dlq] BOTH TIERS FAILED:', {
        source,
        companySlug,
        error: errorMessage,
        payload,
      });
    }
  }
}

/**
 * Generates a random 8-character string for unique KV keys.
 */
function generateShortId(): string {
  return Math.random().toString(36).slice(2, 10);
}
