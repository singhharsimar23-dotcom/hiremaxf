// ═══════════════════════════════════════════════════════════════════════════════
// infra/workers/core/fetchers/reed.ts
// Reed API Fetcher
// ═══════════════════════════════════════════════════════════════════════════════

import { Env } from '../workers/types/job.ts';

/**
 * Fetch jobs from Reed API.
 * slug format: 'keywords:location'
 */
export async function fetchReedJobs(
  env: Env,
  slug: string, 
  offset: number = 0, 
  limit: number = 20
): Promise<any[]> {
  const apiKey = env.REED_API_KEY || env.REED_KEY;
  if (!apiKey) throw new Error('MISSING_REED_API_KEY');

  const [keywords, location] = slug.split(':');
  const query = keywords || 'developer';
  
  const url = `https://www.reed.co.uk/api/1.0/search?keywords=${encodeURIComponent(query)}${location ? `&locationName=${encodeURIComponent(location)}` : ''}&resultsToTake=${limit}&resultsToSkip=${offset}`;

  const res = await fetch(url, { 
    headers: { 'Authorization': 'Basic ' + btoa(apiKey + ':') } 
  });

  if (!res.ok) {
    if (res.status === 429) throw new Error('RATE_LIMIT');
    throw new Error(`Reed API failed with status ${res.status}`);
  }

  const data = await res.json() as any;
  return data.results || [];
}

