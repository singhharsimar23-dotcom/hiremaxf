/**
 * Utility for making external HTTP requests with retry logic.
 * This is the ONLY place in the codebase that makes external HTTP requests.
 */

/**
 * Returns true for transient HTTP status codes that should be retried.
 */
export function isTransientError(status: number): boolean {
  return [429, 500, 502, 503, 504].includes(status);
}

/**
 * Returns true for terminal HTTP status codes that should NOT be retried.
 */
export function isTerminalError(status: number): boolean {
  return [400, 401, 403, 404, 409, 422].includes(status);
}

/**
 * Fetches a URL with exponential backoff and retry logic.
 * 
 * Retry logic:
 * - Attempt the fetch
 * - On transient HTTP status codes (429, 500, 502, 503, 504): wait then retry.
 * - On terminal HTTP status codes (400, 401, 403, 404, 409, 422): return the Response immediately.
 * - On network error (fetch throws): catch, wait, retry.
 * - After all retries exhausted: throw the last error (either network error or status error).
 * - On 429: check Retry-After header. If present, wait that many seconds instead of backoff.
 * 
 * Backoff: attempt 1=200ms, 2=400ms, 3=800ms
 * 
 * @throws After all retries are exhausted.
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = 3
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, options);

      // 1. Success
      if (response.ok) {
        return response;
      }

      // 2. Terminal error (400, 401, 403, 404, 409, 422)
      if (isTerminalError(response.status)) {
        return response;
      }

      // 3. Transient error (429, 500, 502, 503, 504)
      if (isTransientError(response.status)) {
        if (attempt === retries) {
          throw new Error(`Fetch failed with transient status ${response.status} after ${retries} retries`);
        }

        let waitMs = 200 * Math.pow(2, attempt);

        // Handle Retry-After for 429
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          if (retryAfter) {
            const seconds = parseInt(retryAfter, 10);
            if (!isNaN(seconds)) {
              waitMs = seconds * 1000;
            }
          }
        }

        await new Promise(resolve => setTimeout(resolve, waitMs));
        continue;
      }

      // 4. Other status codes (e.g. 3xx or unlisted 4xx/5xx)
      // Return as is
      return response;

    } catch (error: any) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt === retries) {
        throw lastError;
      }

      const waitMs = 200 * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, waitMs));
    }
  }

  throw lastError || new Error('Fetch failed after maximum retries');
}
