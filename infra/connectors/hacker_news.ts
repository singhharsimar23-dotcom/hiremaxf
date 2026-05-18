// ═══════════════════════════════════════════════════════════════════════════════
// infra/workers/core/fetchers/hacker_news.ts
// Hacker News "Who is Hiring" Algolia Fetcher
// ═══════════════════════════════════════════════════════════════════════════════

import { Env } from '../workers/types/job.ts';

/**
 * Fetch jobs (comments) from a specific HN "Who is Hiring" thread.
 * slug format: 'storyId'
 */
export async function fetchHNJobs(
  _env: Env,
  slug: string, 
  offset: number = 0, 
  limit: number = 20
): Promise<any[]> {
  let threadId = slug;

  // If slug is 'latest', find the most recent "Who is hiring" thread
  if (slug === 'latest' || !slug) {
    const searchUrl = `https://hn.algolia.com/api/v1/search?tags=story,author=whoishiring&query=hiring&hitsPerPage=1`;
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json() as any;
    threadId = searchData.hits?.[0]?.objectID;
    if (!threadId) throw new Error('COULD_NOT_FIND_HN_THREAD');
  }

  // Algolia uses 0-indexed pages
  const page = Math.floor(offset / limit);
  const url = `https://hn.algolia.com/api/v1/search?tags=comment,story_${threadId}&page=${page}&hitsPerPage=${limit}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HN Algolia API failed with status ${res.status}`);
  }

  const data = await res.json() as any;
  return data.hits || [];
}

