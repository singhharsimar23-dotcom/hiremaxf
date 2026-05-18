// ═══════════════════════════════════════════════════════════════════════════════
// infra/workers/core/fetchers/apify.ts
// Generic Apify Dataset Fetcher
// ═══════════════════════════════════════════════════════════════════════════════

import { Env } from '../workers/types/job.ts';

/**
 * Fetch results from an Apify Dataset.
 * slug format: 'actorId:datasetId' or 'actorId:latest'
 */
export async function fetchApifyResults(
  env: Env,
  slug: string, 
  offset: number = 0, 
  limit: number = 20
): Promise<any[]> {
  const apiKey = env.APIFY_KEY;
  if (!apiKey) throw new Error('MISSING_APIFY_KEY');

  const [actorId, datasetIdRaw] = slug.split(':');
  let datasetId = datasetIdRaw;

  // If datasetId is 'latest', find the most recent successful run for this actor
  if (datasetId === 'latest') {
    const runsUrl = `https://api.apify.com/v2/actor-runs?actorId=${actorId}&token=${apiKey}&limit=1&status=SUCCEEDED&desc=1`;
    const runsRes = await fetch(runsUrl);
    const runsData = await runsRes.json() as any;
    datasetId = runsData.data?.items?.[0]?.defaultDatasetId;
    if (!datasetId) throw new Error(`COULD_NOT_FIND_LATEST_APIFY_RUN_FOR_${actorId}`);
  }

  const url = `https://api.apify.com/v2/datasets/${datasetId}/items?token=${apiKey}&offset=${offset}&limit=${limit}&clean=true`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Apify Dataset API failed with status ${res.status}`);
  }

  return await res.json() as any[];
}

