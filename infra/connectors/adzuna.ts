// ═══════════════════════════════════════════════════════════════════════════════
// infra/workers/core/fetchers/adzuna.ts
// Adzuna API Fetcher
// ═══════════════════════════════════════════════════════════════════════════════

import { Env } from '../workers/types/job.ts';

/**
 * Fetch jobs from Adzuna API.
 * slug format: 'country:keywords'
 */
export async function fetchAdzunaJobs(
  env: Env,
  slug: string, 
  offset: number = 0, 
  limit: number = 20
): Promise<any[]> {
  const appId = env.ADZUNA_APP_ID;
  const appKey = env.ADZUNA_APP_KEY;
  if (!appId || !appKey) throw new Error('MISSING_ADZUNA_KEYS');

  const [country, keywords] = slug.split(':');
  const targetCountry = country || 'gb';
  const query = keywords || 'developer';

  // Adzuna uses page-based pagination. Convert offset to page.
  const page = Math.floor(offset / limit) + 1;
  const url = `https://api.adzuna.com/v1/api/jobs/${targetCountry}/search/${page}?app_id=${appId}&app_key=${appKey}&what=${encodeURIComponent(query)}&content-type=application/json&results_per_page=${limit}`;

  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 429) throw new Error('RATE_LIMIT');
    throw new Error(`Adzuna API failed with status ${res.status}`);
  }

  const data = await res.json() as any;
  return data.results || [];
}

