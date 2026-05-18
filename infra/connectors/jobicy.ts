// ═══════════════════════════════════════════════════════════════════════════════
// infra/workers/core/fetchers/jobicy.ts
// Jobicy API Fetcher
// ═══════════════════════════════════════════════════════════════════════════════

import { Env } from '../workers/types/job.ts';

/**
 * Fetch jobs from Jobicy JSON API.
 * slug can be an industry name like 'copywriting'.
 */
export async function fetchJobicyJobs(
  _env: Env,
  slug: string, 
  _offset: number = 0, 
  limit: number = 20
): Promise<any[]> {
  const industry = slug || '';
  const url = `https://jobicy.com/api/v2/remote-jobs?count=${limit}${industry ? `&industry=${industry}` : ''}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Jobicy API failed with status ${res.status}`);
  }

  const data = await res.json() as any;
  return data.jobs || [];
}

