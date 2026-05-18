// ═══════════════════════════════════════════════════════════════════════════════
// infra/workers/core/fetchers/workday.ts
// Workday JSON Fetcher (CXS API)
// ═══════════════════════════════════════════════════════════════════════════════

import { Env } from '../workers/types/job.ts';

/**
 * Fetch jobs from Workday instances using the CXS API.
 * slug is the company subdomain (e.g. 'nvidia').
 */
export async function fetchWorkdayJobs(
  _env: Env,
  slug: string, 
  offset: number = 0, 
  limit: number = 20
): Promise<any[]> {
  if (!slug) return [];
  
  // Standard CXS endpoint pattern
  const url = `https://${slug}.wd5.myworkdayjobs.com/wday/cxs/${slug}/External/jobs`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/plain, */*',
    },
    body: JSON.stringify({
      appliedFacets: {},
      limit,
      offset,
      searchText: ""
    }),
    signal: AbortSignal.timeout(8_000), // Workday can be slow
  });

  if (!res.ok) {
    if (res.status === 404) {
      console.warn(`[workday] Instance not found for ${slug}. Check subdomain.`);
      return [];
    }
    const error = new Error(`WORKDAY_FETCH_FAILED status=${res.status} slug=${slug}`);
    console.error('[workday] non-404 upstream failure', { slug, status: res.status });
    throw error;
  }

  const data = await res.json() as any;
  return data.jobPostings || [];
}

