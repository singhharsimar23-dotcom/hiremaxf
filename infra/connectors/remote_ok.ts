// ═══════════════════════════════════════════════════════════════════════════════
// infra/workers/core/fetchers/remote_ok.ts
// Remote-OK API Fetcher
// ═══════════════════════════════════════════════════════════════════════════════

import { Env } from '../workers/types/job.ts';

/**
 * Fetch jobs from Remote-OK JSON API.
 * slug can be 'all' or a specific tag.
 */
export async function fetchRemoteOKJobs(
  _env: Env,
  slug: string, 
  _offset: number = 0, 
  _limit: number = 100
): Promise<any[]> {
  const tag = slug === 'all' || !slug ? '' : `?tag=${slug}`;
  const url = `https://remoteok.com/api${tag}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Remote-OK API failed with status ${res.status}`);
  }

  const data = await res.json() as any[];
  // The first item in Remote-OK API is always metadata/legal, skip it.
  return Array.isArray(data) ? data.slice(1) : [];
}

