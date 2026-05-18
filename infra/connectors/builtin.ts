// ═══════════════════════════════════════════════════════════════════════════════
// infra/workers/core/fetchers/builtin.ts
// Builtin Scraper Fetcher (via ScraperAPI)
// ═══════════════════════════════════════════════════════════════════════════════

import { Env } from '../workers/types/job.ts';

/**
 * Fetch jobs from Builtin via ScraperAPI.
 * slug format: 'role-slug' (e.g., 'software-engineer')
 */
export async function fetchBuiltinJobs(
  env: Env,
  slug: string, 
  _offset: number = 0, 
  _limit: number = 50
): Promise<any[]> {
  const apiKey = env.SCRAPER_API_KEY;
  if (!apiKey) throw new Error('MISSING_SCRAPER_API_KEY');

  const roleSlug = slug || 'software-engineer';
  const targetUrl = `https://builtin.com/jobs/dev-engineering/${roleSlug}`;
  const proxiedUrl = `https://api.scraperapi.com?api_key=${apiKey}&url=${encodeURIComponent(targetUrl)}&render=true`;

  const res = await fetch(proxiedUrl);
  if (!res.ok) {
    throw new Error(`Builtin Scraper failed with status ${res.status}`);
  }

  const html = await res.text();
  
  // Extract __NEXT_DATA__ from Builtin HTML
  const scriptMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!scriptMatch) return [];
  
  try {
    const nextData = JSON.parse(scriptMatch[1]);
    return nextData?.props?.pageProps?.jobs || [];
  } catch {
    return [];
  }
}

