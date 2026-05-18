// ═══════════════════════════════════════════════════════════════════════════════
// infra/workers/core/fetchers/linkedin_scout.ts
// LinkedIn Scout (SerpApi / Google Dorking) Fetcher
// ═══════════════════════════════════════════════════════════════════════════════

import { Env } from '../workers/types/job.ts';

/**
 * Fetch LinkedIn jobs via Google Dorking using SerpApi.
 * slug can be used for custom keywords/geo targets.
 */
export async function fetchLinkedInScoutJobs(
  env: Env,
  slug: string = 'Engineering', 
  _offset: number = 0, 
  _limit: number = 10
): Promise<any[]> {
  const serpKey = env.SERPAPI_API_KEY;
  if (!serpKey) {
    throw new Error("SERPAPI_API_KEY is required for LinkedIn Scout");
  }

  // Construct Google Dorking query
  const loc = "USA";
  const query = `site:linkedin.com/jobs/view "${slug}" "${loc}" -intitle:intern -intitle:junior`;
  
  const params = new URLSearchParams({
    q: query,
    engine: 'google',
    api_key: serpKey,
    num: '10'
  });

  const res = await fetch(`https://serpapi.com/search.json?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`SerpApi failed with status ${res.status}`);
  }

  const data = await res.json() as any;
  const results = data.organic_results || [];
  
  return results
    .filter((r: any) => r.link?.includes('linkedin.com/jobs/view'))
    .map((r: any) => ({
      ...r,
      _scout_metadata: { slug, loc }
    }));
}

