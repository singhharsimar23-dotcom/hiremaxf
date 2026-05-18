// ═══════════════════════════════════════════════════════════════════════════════
// infra/workers/core/fetchers/scraper_html.ts
// Generic HTML Scraper Fetcher
// ═══════════════════════════════════════════════════════════════════════════════

import { Env } from '../workers/types/job.ts';
import { scrapeUrl } from '../../core/shared/utils/scraper.ts';

/**
 * Fetch a single HTML page and attempt to extract job data.
 * slug is the target URL.
 */
export async function fetchScraperHTMLJobs(
  env: Env,
  slug: string, 
  _offset: number = 0, 
  _limit: number = 1
): Promise<any[]> {
  if (!slug || !slug.startsWith('http')) return [];
  
  // Use rendering for generic HTML to ensure JS-based content is captured
  const res = await scrapeUrl(env, slug, { render: true });
  if (!res.ok) {
    throw new Error(`Generic scrape failed for ${slug} with status ${res.status}`);
  }

  // Return the raw text wrapped in a list. The parser will handle extraction.
  return [{ 
    html: res.text, 
    url: slug,
    timestamp: Date.now()
  }];
}

