import { Env } from '../config/env';

/**
 * Helper to execute commands via Upstash Redis REST API.
 * Returns the 'result' field from the response.
 * Throws on HTTP errors.
 */
async function redisCommand(env: Env, ...args: (string | number)[]): Promise<unknown> {
  const response = await fetch(env.UPSTASH_REDIS_REST_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  });

  if (!response.ok) {
    throw new Error(`Upstash Redis error: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as { result: unknown; error?: string };
  if (data.error) {
    throw new Error(`Redis command error: ${data.error}`);
  }

  return data.result;
}

/**
 * Attempts to acquire a distributed lock.
 * Returns ownerUUID string if acquired, null if lock is already held.
 * Does not throw on Redis failure (returns null to skip the run).
 */
export async function acquire(env: Env, key: string): Promise<string | null> {
  try {
    const ownerUUID = crypto.randomUUID();
    // SET key ownerUUID NX EX 120
    const result = await redisCommand(env, 'SET', key, ownerUUID, 'NX', 'EX', 120);
    
    if (result === 'OK') {
      return ownerUUID;
    }
    
    return null;
  } catch (error) {
    console.warn(`[Lock] Failed to acquire lock for ${key}:`, error);
    return null;
  }
}

/**
 * Releases a distributed lock if the owner matches.
 * Does not throw on failure (logs warning).
 */
export async function release(env: Env, key: string, owner: string): Promise<void> {
  try {
    // Two-step check (not atomic but safe enough for this use case)
    const currentOwner = await redisCommand(env, 'GET', key);
    
    if (currentOwner === owner) {
      await redisCommand(env, 'DEL', key);
    }
  } catch (error) {
    console.warn(`[Lock] Failed to release lock for ${key}:`, error);
  }
}

/**
 * Starts a background loop to refresh the lock TTL while work is in progress.
 * Runs every 20 seconds to extend the TTL to 120 seconds.
 * Stops when the signal is aborted.
 * Does not throw on Redis failure (logs warning and continues).
 */
export async function startRefresh(env: Env, key: string, owner: string, signal: AbortSignal): Promise<void> {
  const refreshInterval = 20000; // 20 seconds

  const runRefresh = async () => {
    while (!signal.aborted) {
      // Wait for the next interval
      await new Promise((resolve) => setTimeout(resolve, refreshInterval));
      
      if (signal.aborted) break;

      try {
        // SET key owner XX EX 120 (XX = only if key exists)
        await redisCommand(env, 'SET', key, owner, 'XX', 'EX', 120);
      } catch (error) {
        console.warn(`[Lock] Failed to refresh lock for ${key}:`, error);
        // Do NOT stop the loop on Redis failure
      }
    }
  };

  // Run the loop in the background. 
  // We return the promise so the caller can use ctx.waitUntil() to keep it alive.
  return runRefresh();
}

/**
 * Forces the release of a lock regardless of owner.
 * Only use for manual administrative recovery.
 */
export async function forceUnlock(env: Env, key: string): Promise<void> {
  try {
    await redisCommand(env, 'DEL', key);
  } catch (error) {
    console.warn(`[Lock] Failed to force unlock ${key}:`, error);
  }
}
