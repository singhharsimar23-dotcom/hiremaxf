import { Env } from '../../config/env';
import { SourceAdapter } from '../../config/sources';
import { RawJob } from '../../types/job';
import { fetchWithRetry } from '../../pipeline/fetch';

export const leverAdapter: SourceAdapter = {
  /**
   * Fetches job postings from Lever's public API.
   * Documentation: https://github.com/lever/postings-api
   */
  async fetch(env: Env, companySlug: string, cursor: number, signal: AbortSignal): Promise<{ jobs: RawJob[]; nextCursor: number }> {
    const offset = cursor;
    const allJobs: RawJob[] = [];
    let currentNextCursor = cursor;

    try {
      // Lever allows fetching multiple pages by offset.
      // We fetch up to 2 pages (50 each) per invocation per instructions.
      for (let i = 0; i < 2; i++) {
        const currentOffset = offset + (i * 50);
        const url = `https://api.lever.co/v0/postings/${companySlug}?mode=json&limit=50&offset=${currentOffset}`;

        const response = await fetchWithRetry(url, { signal });
        
        if (!response.ok) {
          console.error(`[lever:${companySlug}] HTTP error ${response.status} at offset ${currentOffset}`);
          // Return empty on error per contract
          return { jobs: [], nextCursor: cursor };
        }

        const postings = await response.json() as any[];
        if (!Array.isArray(postings)) {
          console.error(`[lever:${companySlug}] Invalid response format at offset ${currentOffset}`);
          return { jobs: [], nextCursor: cursor };
        }

        console.log(`[lever:${companySlug}] fetched ${postings.length} jobs offset ${currentOffset}`);

        for (const posting of postings) {
          allJobs.push({
            externalId: posting.id,
            title: posting.text,
            companyName: companySlug, // Lever API doesn't provide company name in the posting object
            companySlug: companySlug,
            locationName: posting.categories?.location ?? 'Unknown',
            sourceUrl: posting.hostedUrl,
            // createdAt is Unix milliseconds
            postedAt: posting.createdAt ? new Date(posting.createdAt).toISOString() : undefined,
            description: posting.descriptionBody ?? posting.description ?? undefined,
            source: 'lever',
            rawData: posting,
          });
        }

        // nextCursor logic:
        // If we fetched fewer than 50, we reached the end of results
        if (postings.length < 50) {
          currentNextCursor = 0;
          break;
        } else {
          // If we fetched 50, we set nextCursor to the next offset
          currentNextCursor = currentOffset + 50;
        }
      }

      return { jobs: allJobs, nextCursor: currentNextCursor };

    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log(`[lever:${companySlug}] Fetch aborted`);
      } else {
        console.error(`[lever:${companySlug}] Fetch error:`, err);
      }
      return { jobs: [], nextCursor: cursor };
    }
  }
};
