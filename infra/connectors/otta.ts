// ═══════════════════════════════════════════════════════════════════════════════
// infra/workers/core/fetchers/otta.ts
// Otta GraphQL Fetcher
// ═══════════════════════════════════════════════════════════════════════════════

import { Env } from '../workers/types/job.ts';

/**
 * Fetch jobs from Otta using their public GraphQL API.
 */
export async function fetchOttaJobs(
  _env: Env,
  _slug: string = '', 
  _offset: number = 0, 
  _limit: number = 20
): Promise<any[]> {
  const url = `https://api.otta.com/graphql`;
  
  const query = `
    query JobBoardListings {
      jobBoardListings(first: 20) {
        nodes {
          id
          title
          description
          location {
            name
          }
          company {
            name
          }
          externalUrl
          publishedAt
        }
      }
    }
  `;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    },
    body: JSON.stringify({ query })
  });

  if (!res.ok) {
    throw new Error(`Otta fetch failed with status ${res.status}`);
  }

  const data = await res.json() as any;
  return data?.data?.jobBoardListings?.nodes || [];
}

