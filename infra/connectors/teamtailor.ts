// ═══════════════════════════════════════════════════════════════════════════════
// infra/workers/core/fetchers/teamtailor.ts
// Teamtailor JSON Fetcher
// ═══════════════════════════════════════════════════════════════════════════════

import { Env } from '../workers/types/job.ts';

/**
 * Fetch jobs from Teamtailor.
 * slug is the company subdomain.
 */
export async function fetchTeamtailorJobs(
  _env: Env,
  slug: string, 
  _offset: number = 0, 
  _limit: number = 100
): Promise<any[]> {
  if (!slug) return [];
  // Teamtailor provides a clean JSON feed for many companies
  const url = `https://${slug}.teamtailor.com/jobs.json`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Teamtailor fetch failed for ${slug} with status ${res.status}`);
  }

  const data = await res.json() as any;
  // Teamtailor often wraps in { data: [...] } or is a flat array
  return data.data || (Array.isArray(data) ? data : []);
}

