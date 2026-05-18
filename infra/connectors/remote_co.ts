// ═══════════════════════════════════════════════════════════════════════════════
// infra/workers/core/fetchers/remote_co.ts
// Remote.co RSS Fetcher
// ═══════════════════════════════════════════════════════════════════════════════

import { Env } from '../workers/types/job.ts';
import { parseRSS } from '../../core/shared/utils/rss.ts';

/**
 * Fetch jobs from Remote.co.
 */
export async function fetchRemoteCoJobs(
  _env: Env,
  _slug: string = '', 
  _offset: number = 0, 
  _limit: number = 20
): Promise<any[]> {
  const url = `https://remote.co/remote-jobs/developer/feed/`;
  
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Remote.co fetch failed with status ${res.status}`);
  }

  const xml = await res.text();
  return parseRSS(xml);
}

