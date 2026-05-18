// ═══════════════════════════════════════════════════════════════════════════════
// infra/workers/core/fetchers/recruitee.ts
// Recruitee JSON Fetcher
// ═══════════════════════════════════════════════════════════════════════════════

import { Env } from '../workers/types/job.ts';

/**
 * Fetch jobs from Recruitee API.
 * slug is the company subdomain.
 */
export async function fetchRecruiteeJobs(
  _env: Env,
  slug: string, 
  _offset: number = 0, 
  _limit: number = 100
): Promise<any[]> {
  if (!slug) return [];
  const url = `https://${slug}.recruitee.com/api/p/jobs`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Recruitee fetch failed for ${slug} with status ${res.status}`);
  }

  const data = await res.json() as any;
  return data.jobs || [];
}

