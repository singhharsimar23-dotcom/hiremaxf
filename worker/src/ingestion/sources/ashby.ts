import { Env } from '../../config/env';
import { SourceAdapter } from '../../config/sources';
import { RawJob } from '../../types/job';
import { fetchWithRetry } from '../../pipeline/fetch';

export const ashbyAdapter: SourceAdapter = {
  /**
   * Fetches job postings from Ashby's public job board API.
   * Documentation: https://developers.ashbyhq.com/
   */
  async fetch(env: Env, companySlug: string, cursor: number, signal: AbortSignal): Promise<{ jobs: RawJob[]; nextCursor: number }> {
    const allJobs: RawJob[] = [];

    try {
      // Ashby uses GET for their job board API
      const url = `https://api.ashbyhq.com/posting-api/job-board/${companySlug}?includeCompensation=true`;
      
      const response = await fetchWithRetry(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
        },
        signal,
      });

      const text = await response.text();
      if (!response.ok) {
        console.error(`[ashby:${companySlug}] HTTP error ${response.status}: ${text.slice(0, 100)}`);
        return { jobs: [], nextCursor: cursor };
      }

      let data: any;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error(`[ashby:${companySlug}] JSON parse error: ${text.slice(0, 100)}`);
        return { jobs: [], nextCursor: cursor };
      }

      if (!data || (!Array.isArray(data.results) && !Array.isArray(data.jobs))) {
        console.error(`[ashby:${companySlug}] Invalid response format: ${text.slice(0, 100)}`);
        return { jobs: [], nextCursor: cursor };
      }

      const results = Array.isArray(data.results) ? data.results : data.jobs;
      console.log(`[ashby:${companySlug}] fetched ${results.length} jobs`);

      for (const job of results) {
        allJobs.push({
          externalId: job.id,
          title: job.title,
          companyName: job.organizationName ?? companySlug,
          companySlug: companySlug,
          locationName: job.isRemote ? 'Remote' : (job.location ?? 'Unknown'),
          sourceUrl: job.jobUrl,
          postedAt: job.publishedDate ?? undefined,
          description: job.descriptionBody ?? undefined,
          source: 'ashby',
          rawData: job,
        });
      }

      // nextCursor logic:
      // if moreDataAvailable = false or results < 50: return 0 (sweep complete)
      // Otherwise, we return 0 because we don't support numeric pagination for Ashby yet
      // and "fetch ALL jobs in one call" was requested.
      // If we returned 1, it would re-fetch from start per instructions.
      const moreDataAvailable = data.moreDataAvailable === true;
      const nextCursor = (moreDataAvailable && results.length >= 50) ? 0 : 0; 
      // Actually, I'll just return 0 always as per "fetch ALL jobs in one call"
      // but I'll strictly follow the "if moreDataAvailable = false ... return 0" which implies 0 is the terminal state.
      
      return { jobs: allJobs, nextCursor: 0 };

    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log(`[ashby:${companySlug}] Fetch aborted`);
      } else {
        console.error(`[ashby:${companySlug}] Fetch error:`, err);
      }
      return { jobs: [], nextCursor: cursor };
    }
  }
};
