import { Env } from '../../config/env';
import { SourceAdapter } from '../../config/sources';
import { RawJob } from '../../types/job';
import { fetchWithRetry } from '../../pipeline/fetch';

export const greenhouseAdapter: SourceAdapter = {
  /**
   * Fetches jobs from Greenhouse Board API.
   * Documentation: https://developers.greenhouse.io/board-api.html
   */
  async fetch(env: Env, companySlug: string, cursor: number, signal: AbortSignal): Promise<{ jobs: RawJob[]; nextCursor: number }> {
    const pageNum = cursor === 0 ? 1 : cursor;
    const allJobs: RawJob[] = [];
    let currentNextCursor = cursor;

    try {
      // Greenhouse supports up to 2 pages per invocation per instructions
      for (let i = 0; i < 2; i++) {
        const currentPage = pageNum + i;
        const url = `https://boards-api.greenhouse.io/v1/boards/${companySlug}/jobs?content=true&per_page=50&page=${currentPage}`;

        const response = await fetchWithRetry(url, { signal });
        
        if (!response.ok) {
          // If a page fails, we stop and return what we have so far
          // The error contract says return [] on any error, but if we already have some jobs from a previous page,
          // we should probably return them? 
          // Re-reading: "On any error (HTTP error, network error, bad JSON): return { jobs: [], nextCursor: cursor }"
          // This implies if ANY part of the process fails, we return empty.
          console.error(`[greenhouse:${companySlug}] HTTP error ${response.status} on page ${currentPage}`);
          return { jobs: [], nextCursor: cursor };
        }

        const data = await response.json() as any;
        if (!data || !Array.isArray(data.jobs)) {
          console.error(`[greenhouse:${companySlug}] Invalid JSON response on page ${currentPage}`);
          return { jobs: [], nextCursor: cursor };
        }

        const greenhouseJobs = data.jobs;
        console.log(`[greenhouse:${companySlug}] fetched ${greenhouseJobs.length} jobs page ${currentPage}`);

        for (const job of greenhouseJobs) {
          allJobs.push({
            externalId: String(job.id),
            title: job.title,
            companyName: job.company_name ?? companySlug,
            companySlug: companySlug,
            locationName: job.location?.name ?? 'Unknown',
            sourceUrl: job.absolute_url,
            postedAt: job.updated_at ?? job.first_published ?? undefined,
            description: job.content ?? undefined,
            source: 'greenhouse',
            rawData: job,
          });
        }

        // nextCursor logic:
        // If fetched < 50 jobs on last page: nextCursor = 0 (sweep complete)
        if (greenhouseJobs.length < 50) {
          currentNextCursor = 0;
          break;
        } else {
          // If we fetched 50, we might have more.
          // If this was the 2nd page we fetched: nextCursor = pageNum + 2
          // If this was the 1st page: nextCursor = pageNum + 1
          currentNextCursor = currentPage + 1;
        }
      }

      return { jobs: allJobs, nextCursor: currentNextCursor };

    } catch (err: any) {
      // Respect AbortSignal: if it's an AbortError, we should still return empty per contract
      if (err.name === 'AbortError') {
        console.log(`[greenhouse:${companySlug}] Fetch aborted`);
      } else {
        console.error(`[greenhouse:${companySlug}] Fetch error:`, err);
      }
      return { jobs: [], nextCursor: cursor };
    }
  }
};
