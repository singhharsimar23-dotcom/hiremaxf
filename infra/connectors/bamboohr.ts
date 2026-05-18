// ═══════════════════════════════════════════════════════════════════════════════
// infra/workers/core/fetchers/bamboohr.ts
// BambooHR XML/JSON Fetcher
// ═══════════════════════════════════════════════════════════════════════════════

import { Env } from '../workers/types/job.ts';
import { parseRSS } from '../../core/shared/utils/rss.ts';

/**
 * Fetch jobs from BambooHR.
 * slug is the company subdomain (e.g. 'hiremax').
 */
export async function fetchBambooHRJobs(
  _env: Env,
  slug: string, 
  _offset: number = 0, 
  _limit: number = 100
): Promise<any[]> {
  if (!slug) return [];
  
  // BambooHR often provides a public XML feed
  const url = `https://${slug}.bamboohr.com/jobs/list.php?type=xml`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`BambooHR fetch failed for ${slug} with status ${res.status}`);
  }

  const xml = await res.text();
  return parseRSS(xml);
}

