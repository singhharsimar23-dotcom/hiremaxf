// ═══════════════════════════════════════════════════════════════════════════════
// infra/workers/core/fetchers/workable.ts
// Workable API Fetcher
// ═══════════════════════════════════════════════════════════════════════════════

import { Env } from '../workers/types/job.ts';

/**
 * Fetch jobs from Workable API.
 * Workable uses a POST endpoint for job boards.
 */
export async function fetchWorkableJobs(
  _env: Env,
  slug: string, 
  _offset: number = 0,
  _limit: number = 20
): Promise<any[]> {
  const url = `https://apply.workable.com/api/v1/boards/${slug}/jobs`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: "",
      location: [],
      department: [],
      worktype: [],
      remote: []
    }),
    signal: AbortSignal.timeout(5_000), 
  });

  if (!res.ok) {
    if (res.status === 404) {
      console.warn(`[workable] Board not found for ${slug}`);
      return [];
    }
    const error = new Error(`WORKABLE_FETCH_FAILED status=${res.status} slug=${slug}`);
    console.error('[workable] non-404 upstream failure', { slug, status: res.status });
    throw error;
  }

  const data = await res.json() as any;
  return data.results || [];
}

