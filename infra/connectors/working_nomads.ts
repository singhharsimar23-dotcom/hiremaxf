// ═══════════════════════════════════════════════════════════════════════════════
// infra/workers/core/fetchers/working_nomads.ts
// Working Nomads API Fetcher
// ═══════════════════════════════════════════════════════════════════════════════

import { Env } from '../workers/types/job.ts';

/**
 * Fetch jobs from Working Nomads JSON API.
 * slug can be a category name like 'development'.
 */
export async function fetchWorkingNomadsJobs(
  _env: Env,
  slug: string, 
  _offset: number = 0, 
  _limit: number = 100
): Promise<any[]> {
  const category = slug || '';
  const url = `https://www.workingnomads.co/api/exposed_jobs/${category ? `?category=${category}` : ''}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Working Nomads API failed with status ${res.status}`);
  }

  return await res.json() as any[];
}

