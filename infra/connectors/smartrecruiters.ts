// ═══════════════════════════════════════════════════════════════════════════════
// infra/workers/core/fetchers/smartrecruiters.ts
// SmartRecruiters API Fetcher
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Fetch jobs from SmartRecruiters API.
 * API Endpoint: https://api.smartrecruiters.com/v1/companies/{slug}/postings
 */
export async function fetchSmartrecruitersJobs(
  slug: string, 
  offset: number = 0, 
  limit: number = 10
): Promise<any[]> {
  // SmartRecruiters uses limit/offset pagination
  const url = `https://api.smartrecruiters.com/v1/companies/${slug}/postings?offset=${offset}&limit=${limit}`;
  const res = await fetch(url, {
    headers: { 'Accept': 'application/json' }
  });

  if (!res.ok) {
    if (res.status === 429) throw new Error('RATE_LIMIT');
    throw new Error(`SmartRecruiters API failed with status ${res.status}`);
  }

  const data = await res.json() as any;
  return data.content || [];
}

