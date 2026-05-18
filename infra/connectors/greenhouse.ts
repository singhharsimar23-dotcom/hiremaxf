// ═══════════════════════════════════════════════════════════════════════════════
// infra/workers/core/fetchers/greenhouse.ts
// Fetches a paginated slice of jobs from the Greenhouse boards API
// ═══════════════════════════════════════════════════════════════════════════════

import { RateLimitError } from '../../core/shared/utils/errors.ts';

export interface GreenhouseRawJob {
  id: number;
  title: string;
  location: { name: string };
  content: string;          // HTML description
  absolute_url: string;
  updated_at: string;
  departments: { name: string }[];
  offices: { name: string }[];
}

/**
 * Fetch a slice of jobs from Greenhouse.
 * Greenhouse has no server-side pagination on the board API, so we slice in memory.
 * @param slug  - company slug (e.g. "stripe")
 * @param offset - start index
 * @param limit  - how many to return
 */
export async function fetchGreenhouseJobs(
  slug: string,
  offset: number,
  limit: number
): Promise<GreenhouseRawJob[]> {
  const url = `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`;
  const res = await fetch(url, {
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(7_500),
  });

  if (!res.ok) {
    if (res.status === 429 || res.status === 403) {
      throw new RateLimitError(`Greenhouse API Rate Limited for ${slug}: ${res.status}`);
    }
    const msg = `Greenhouse API error for ${slug}: ${res.status}`;
    if (res.status === 404) {
      console.warn(`[greenhouse] Slug not found: ${slug}`);
      return [];
    }
    throw new Error(msg);
  }

  const data = await res.json() as { jobs?: GreenhouseRawJob[] };
  const jobs = data.jobs ?? [];
  return jobs.slice(offset, offset + limit);
}

