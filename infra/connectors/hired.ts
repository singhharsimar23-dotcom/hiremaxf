// ═══════════════════════════════════════════════════════════════════════════════
// infra/workers/core/fetchers/hired.ts
// Hired.com API Fetcher (via ScraperAPI)
// ═══════════════════════════════════════════════════════════════════════════════

import { Env } from '../workers/types/job.ts';
import { scrapeUrl } from '../../core/shared/utils/scraper.ts';

/**
 * Fetch jobs from Hired.com.
 * Uses ScraperAPI to bypass protection.
 */
export async function fetchHiredJobs(
  env: Env,
  _slug: string = '', 
  _offset: number = 0, 
  _limit: number = 20
): Promise<any[]> {
  const url = `https://hired.com/api/v1/jobs?category=engineering`;
  
  const res = await scrapeUrl(env, url, { render: false });
  if (!res.ok) {
    throw new Error(`Hired fetch failed with status ${res.status}`);
  }

  const data = JSON.parse(res.text) as any;
  return data.jobs || data.data || [];
}

