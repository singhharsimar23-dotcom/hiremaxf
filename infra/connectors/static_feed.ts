// ═══════════════════════════════════════════════════════════════════════════════
// infra/workers/core/fetchers/static_feed.ts
// Aggregated JSON Feeds (Remotive + Arbeitnow)
// ═══════════════════════════════════════════════════════════════════════════════

import { Env } from '../workers/types/job.ts';

/**
 * Fetch and combine jobs from small stable JSON APIs.
 * Currently supports: Remotive, Arbeitnow.
 */
export async function fetchStaticFeedJobs(
  _env: Env,
  _slug: string,
  offset: number = 0,
  limit: number = 50
): Promise<any[]> {
  const FETCH_TIMEOUT_MS = 8_000;
  const sources = [
    { name: 'remotive', url: 'https://remotive.com/api/remote-jobs?limit=50' },
    { name: 'arbeitnow', url: 'https://www.arbeitnow.com/api/job-board-api' }
  ];

  const results = await Promise.allSettled(
    sources.map(async (s) => {
      const res = await fetch(s.url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      if (!res.ok) throw new Error(`${s.name} failed`);
      const data = await res.json() as any;
      
      // Remotive wraps in .jobs, Arbeitnow wraps in .data
      const rawJobs = data.jobs || data.data || [];
      return rawJobs.map((j: any) => ({ ...j, __source_brand: s.name }));
    })
  );

  const combined: any[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') {
      combined.push(...r.value);
    }
  }

  // Feed sources are not truly paginated, so emulate deterministic paging
  // to prevent oversized batches from stalling ingestion runs.
  return combined.slice(offset, offset + limit);
}

