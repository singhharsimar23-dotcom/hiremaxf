// ═══════════════════════════════════════════════════════════════════════════════
// infra/workers/core/fetchers/weworkremotely.ts
// WeWorkRemotely RSS Fetcher
// ═══════════════════════════════════════════════════════════════════════════════

import { Env } from '../workers/types/job.ts';
import { parseRSS } from '../../core/shared/utils/rss.ts';

/**
 * Fetch jobs from WeWorkRemotely RSS feed.
 * slug can be 'all' or a specific category like 'remote-programming-jobs'
 */
export async function fetchWWRJobs(
  _env: Env,
  slug: string, 
  _offset: number = 0, 
  _limit: number = 20
): Promise<any[]> {
  const category = slug === 'all' || !slug ? 'remote-jobs' : slug;
  const url = `https://weworkremotely.com/${category}.rss`;

  const res = await fetch(url, {
    headers: { 
      'User-Agent': 'Mozilla/5.0 (compatible; HireMaxBot/1.0; +https://hiremax.ai)',
      'Accept': 'application/rss+xml, application/xml, text/xml, */*'
    }
  });
  if (!res.ok) {
    throw new Error(`WWR RSS failed with status ${res.status}`);
  }

  const xml = await res.text();
  return parseRSS(xml);
}

