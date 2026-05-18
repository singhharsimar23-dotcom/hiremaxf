// ═══════════════════════════════════════════════════════════════════════════════
// infra/workers/core/fetchers/ashby.ts
// Fetches a paginated slice of jobs from the Ashby Public Board API
// ═══════════════════════════════════════════════════════════════════════════════

export interface AshbyRawJob {
  id: string;
  title: string;
  location?: { name?: string };
  descriptionHtml?: string;
  descriptionPlain?: string;
  jobUrl?: string;
  publishedAt?: string;
  employmentType?: string;
  departmentName?: string;
  teamName?: string;
}

import { RateLimitError } from '../../core/shared/utils/errors.ts';
import type { Env } from '../workers/types/job.ts';
import { getCachedData, setCachedData } from '../../core/shared/db/cache.ts';

/**
 * Ashby returns all published jobs for a board in a single response.
 * HARDENED: We cache the full response in B2 and slice to avoid memory OOM.
 */
export async function fetchAshbyJobs(
  env: Env,
  slug: string,
  offset: number,
  limit: number
): Promise<AshbyRawJob[]> {
  const cacheKey = `ashby/${slug}`;
  let allJobs = await getCachedData<AshbyRawJob[]>(env, cacheKey);

  if (!allJobs) {
    const url = `https://api.ashbyhq.com/posting-api/v1/published-board/${slug}`;
    const headers: Record<string, string> = { 'Accept': 'application/json' };
    
    // Add auth if key is provided
    if (env.ASHBY_API_KEY) {
      headers['Authorization'] = `Basic ${btoa(env.ASHBY_API_KEY + ':')}`;
    }

    const res = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(5_000), // Increased to 5s
    });

    if (!res.ok) {
      if (res.status === 401) {
        console.warn(`[ashby] Private board or key required for ${slug}. Status 401.`);
        return [];
      }
      if (res.status === 429 || res.status === 403) {
        throw new RateLimitError(`Ashby API Rate Limited for ${slug}: ${res.status}`);
      }
      if (res.status === 404) {
        console.warn(`[ashby] Slug not found: ${slug}`);
        return [];
      }
      throw new Error(`Ashby API error for ${slug}: ${res.status}`);
    }

    const data = await res.json() as { jobs?: AshbyRawJob[] };
    allJobs = data.jobs ?? [];
    if (Array.isArray(allJobs)) {
      await setCachedData(env, cacheKey, allJobs);
    }
  }

  const jobs = Array.isArray(allJobs) ? allJobs : [];
  return jobs.slice(offset, offset + limit);
}

