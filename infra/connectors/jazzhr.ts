// ═══════════════════════════════════════════════════════════════════════════════
// infra/workers/core/fetchers/jazzhr.ts
// JazzHR RSS Fetcher
// ═══════════════════════════════════════════════════════════════════════════════

import { Env } from '../workers/types/job.ts';
import { parseRSS } from '../../core/shared/utils/rss.ts';

/**
 * Fetch jobs from JazzHR.
 * slug is the company subdomain at applytojob.com.
 */
export async function fetchJazzHRJobs(
  _env: Env,
  slug: string, 
  _offset: number = 0, 
  _limit: number = 100
): Promise<any[]> {
  if (!slug) return [];
  const url = `https://${slug}.applytojob.com/feed`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`JazzHR fetch failed for ${slug} with status ${res.status}`);
  }

  const xml = await res.text();
  return parseRSS(xml);
}

