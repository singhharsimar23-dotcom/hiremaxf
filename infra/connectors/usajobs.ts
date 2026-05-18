// ═══════════════════════════════════════════════════════════════════════════════
// infra/workers/core/fetchers/usajobs.ts
// USAJobs API Fetcher
// ═══════════════════════════════════════════════════════════════════════════════

import { Env } from '../workers/types/job.ts';

/**
 * Fetch jobs from USAJobs API.
 * slug format: 'keywords'
 */
export async function fetchUSAJobs(
  env: Env,
  slug: string, 
  offset: number = 0, 
  limit: number = 20
): Promise<any[]> {
  const apiKey = env.USAJOBS_API_KEY || env.USAJOBS_KEY;
  if (!apiKey) throw new Error('MISSING_USAJOBS_API_KEY');

  const query = slug || 'developer';
  
  // USAJobs uses page-based pagination.
  const page = Math.floor(offset / limit) + 1;
  const url = `https://data.usajobs.gov/api/search?Keyword=${encodeURIComponent(query)}&ResultsPerPage=${limit}&Page=${page}`;

  const res = await fetch(url, { 
    headers: { 
      'Host': 'data.usajobs.gov',
      'User-Agent': 'HireMax-Ingestion-Engine',
      'Authorization-Key': apiKey 
    } 
  });

  if (!res.ok) {
    if (res.status === 429) throw new Error('RATE_LIMIT');
    throw new Error(`USAJobs API failed with status ${res.status}`);
  }

  const data = await res.json() as any;
  return data.SearchResult?.SearchResultItems || [];
}

