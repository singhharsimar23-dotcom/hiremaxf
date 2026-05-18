// ═══════════════════════════════════════════════════════════════════════════════
// infra/workers/core/fetchers/jooble.ts
// Jooble API Fetcher
// ═══════════════════════════════════════════════════════════════════════════════

import { Env } from '../workers/types/job.ts';

/**
 * Fetch jobs from Jooble API.
 * slug format: 'keywords:location'
 */
export async function fetchJoobleJobs(
  env: Env,
  slug: string, 
  _offset: number = 0, 
  _limit: number = 20
): Promise<any[]> {
  const apiKey = env.JOOBLE_API_KEY;
  if (!apiKey) throw new Error('MISSING_JOOBLE_API_KEY');

  const tokens = slug.split(':');
  let region = 'en';
  let keywords = '';
  let location = '';

  if (tokens.length === 3) {
    [region, keywords, location] = tokens;
  } else if (tokens.length === 2) {
    [keywords, location] = tokens;
  } else {
    keywords = slug;
  }

  // Jooble uses regional subdomains (e.g., us.jooble.org, in.jooble.org)
  const baseUrl = region === 'en' ? 'jooble.org' : `${region}.jooble.org`;
  const url = `https://${baseUrl}/api/${apiKey}`;

  const res = await fetch(url, { 
    method: "POST", 
    headers: { "Content-Type": "application/json" }, 
    body: JSON.stringify({ 
      keywords: keywords || 'developer', 
      location: location || '' 
    }) 
  });

  if (!res.ok) {
    if (res.status === 429) throw new Error('RATE_LIMIT');
    const errText = await res.text();
    console.error(`[jooble] API failed with status ${res.status}: ${errText}`);
    throw new Error(`Jooble API failed with status ${res.status}`);
  }

  const data = await res.json() as any;
  return data.jobs || [];
}

