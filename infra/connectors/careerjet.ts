// ═══════════════════════════════════════════════════════════════════════════════
// infra/workers/core/fetchers/careerjet.ts
// Careerjet API Fetcher
// ═══════════════════════════════════════════════════════════════════════════════

import { Env } from '../workers/types/job.ts';

/**
 * Fetch jobs from Careerjet API.
 * slug format: 'keywords:location'
 */
export async function fetchCareerjetJobs(
  _env: Env,
  slug: string, 
  offset: number = 0, 
  limit: number = 20
): Promise<any[]> {
  const [keywords, location] = slug.split(':');
  const query = keywords || 'developer';
  const loc = location || 'USA';
  
  const page = Math.floor(offset / limit) + 1;
  const url = `https://public.api.careerjet.net/search?keywords=${encodeURIComponent(query)}&location=${encodeURIComponent(loc)}&pagesize=${limit}&page=${page}&user_ip=127.0.0.1&user_agent=HireMax`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Careerjet API failed with status ${res.status}`);
  }

  const data = await res.json() as any;
  return data.jobs || [];
}

