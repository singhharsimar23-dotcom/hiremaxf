// ═══════════════════════════════════════════════════════════════════════════════
// infra/workers/core/fetchers/dice.ts
// Dice.com Scraper Fetcher (via ScraperAPI)
// ═══════════════════════════════════════════════════════════════════════════════

import { Env } from '../workers/types/job.ts';
import { scrapeUrl } from '../../core/shared/utils/scraper.ts';

/**
 * Fetch jobs from Dice.com.
 * Uses ScraperAPI + JSON-LD extraction.
 */
export async function fetchDiceJobs(
  env: Env,
  _slug: string = '', 
  page: number = 1, 
  _limit: number = 20
): Promise<any[]> {
  const url = `https://www.dice.com/jobs?q=Software%20Engineer&page=${page}`;
  
  const res = await scrapeUrl(env, url, { render: false });
  if (!res.ok) {
    throw new Error(`Dice fetch failed with status ${res.status}`);
  }

  const html = res.text;
  const pageJobs: any[] = [];
  
  // Extract all application/ld+json script tags
  const ldJsonMatch = html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g);
  for (const match of ldJsonMatch) {
    try {
      const data = JSON.parse(match[1]);
      // Dice sometimes puts an array in one tag, or individual tags per job
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
          if (item["@type"] === "JobPosting") {
              pageJobs.push(item);
          }
      }
    } catch { 
      continue; 
    }
  }

  return pageJobs;
}

