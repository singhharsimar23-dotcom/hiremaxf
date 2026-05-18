// ═══════════════════════════════════════════════════════════════════════════════
// infra/workers/core/fetchers/comeet.ts
// Comeet JSON Fetcher
// ═══════════════════════════════════════════════════════════════════════════════

import { Env } from '../workers/types/job.ts';

/**
 * Fetch jobs from Comeet.
 * slug is the company ID/slug.
 */
export async function fetchComeetJobs(
  _env: Env,
  slug: string, 
  _offset: number = 0, 
  _limit: number = 100
): Promise<any[]> {
  if (!slug) return [];
  const url = `https://www.comeet.co/careers-api/v1/company/${slug}/positions`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Comeet fetch failed for ${slug} with status ${res.status}`);
  }

  // Comeet returns an array of positions directly
  return await res.json() as any[];
}

