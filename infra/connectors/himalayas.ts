// ═══════════════════════════════════════════════════════════════════════════════
// infra/workers/core/fetchers/himalayas.ts
// Himalayas API Fetcher
// ═══════════════════════════════════════════════════════════════════════════════

import { Env } from '../workers/types/job.ts';

/**
 * Fetch jobs from Himalayas JSON API.
 * slug is currently ignored as they provide a global feed.
 */
export async function fetchHimalayasJobs(
  _env: Env,
  _slug: string, 
  _offset: number = 0, 
  limit: number = 20
): Promise<any[]> {
  const url = `https://himalayas.app/jobs/api?limit=${limit}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Himalayas API failed with status ${res.status}`);
  }

  const data = await res.json() as any;
  return data.jobs || [];
}

