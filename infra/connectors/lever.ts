// ═══════════════════════════════════════════════════════════════════════════════
// infra/workers/core/fetchers/lever.ts
// Fetches a paginated slice of jobs from the Lever postings API
// ═══════════════════════════════════════════════════════════════════════════════

export interface LeverRawJob {
  id: string;
  text: string;                   // title
  categories: {
    location?: string;
    team?: string;
    department?: string;
    commitment?: string;
  };
  descriptionPlain?: string;
  description?: string;
  hostedUrl: string;
  createdAt: number;              // unix ms
}

import { RateLimitError } from '../../core/shared/utils/errors.ts';
import type { Env } from '../workers/types/job.ts';
import { getCachedData, setCachedData } from '../../core/shared/db/cache.ts';

/**
 * Lever's board API returns all postings in one call.
 * HARDENED: We cache the full response in B2 and slice to avoid memory OOM.
 */
export async function fetchLeverJobs(
  env: Env,
  slug: string,
  offset: number,
  limit: number
): Promise<LeverRawJob[]> {
  const cacheKey = `lever/${slug}`;
  let allJobs = await getCachedData<LeverRawJob[]>(env, cacheKey);

  if (!allJobs) {
    const url = `https://api.lever.co/v0/postings/${slug}?mode=json`;
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(20_000), // PRODUCTION: Increased to 20s for high-latency boards (Plaid, etc.)
    });

    if (!res.ok) {
      if (res.status === 429 || res.status === 403) {
        throw new RateLimitError(`Lever API Rate Limited for ${slug}: ${res.status}`);
      }
      if (res.status === 404) {
        console.warn(`[lever] Slug not found: ${slug}`);
        return [];
      }
      throw new Error(`Lever API error for ${slug}: ${res.status}`);
    }

    allJobs = await res.json() as LeverRawJob[];
    if (Array.isArray(allJobs)) {
      await setCachedData(env, cacheKey, allJobs);
    }
  }

  const jobs = Array.isArray(allJobs) ? allJobs : [];
  return jobs.slice(offset, offset + limit);
}

