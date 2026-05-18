// ═══════════════════════════════════════════════════════════════════════════════
// infra/workers/core/fetchers/cord.ts
// Cord.co API Fetcher (via ScraperAPI)
// ═══════════════════════════════════════════════════════════════════════════════

import { Env } from '../workers/types/job.ts';
import { scrapeUrl } from '../../core/shared/utils/scraper.ts';

/**
 * Fetch jobs from Cord.co.
 * Uses ScraperAPI to bypass bot detection.
 */
export async function fetchCordJobs(
  env: Env,
  _slug: string = '', 
  page: number = 1, 
  _limit: number = 20
): Promise<any[]> {
  const url = `https://cord.co/api/v1/jobs?page=${page}`;
  
  const res = await scrapeUrl(env, url, { render: false });
  if (!res.ok) {
    throw new Error(`Cord fetch failed with status ${res.status}`);
  }

  const data = JSON.parse(res.text) as any;
  return data.jobs || data.data || [];
}

