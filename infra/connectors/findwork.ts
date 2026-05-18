// ═══════════════════════════════════════════════════════════════════════════════
// infra/workers/core/fetchers/findwork.ts
// Findwork API Fetcher
// ═══════════════════════════════════════════════════════════════════════════════

import { Env } from '../workers/types/job.ts';

/**
 * Fetch jobs from Findwork API.
 * slug format: 'keywords'
 */
export async function fetchFindworkJobs(
  env: Env,
  slug: string, 
  offset: number = 0, 
  limit: number = 20
): Promise<any[]> {
  const apiKey = env.FINDWORK_TOKEN || env.FINDWORK_KEY;
  if (!apiKey) throw new Error('MISSING_FINDWORK_TOKEN');

  const query = encodeURIComponent(slug || 'developer');
  const page = Math.floor(offset / limit) + 1;
  const url = `https://findwork.dev/api/jobs/?search=${query}&page=${page}`;

  const res = await fetch(url, { 
    headers: { 'Authorization': `Token ${apiKey}` } 
  });

  if (!res.ok) {
    if (res.status === 429) throw new Error('RATE_LIMIT');
    throw new Error(`Findwork API failed with status ${res.status}`);
  }

  const data = await res.json() as any;
  return data.results || [];
}

