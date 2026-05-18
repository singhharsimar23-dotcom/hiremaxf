/**
 * infra/adapters/scraper_html.ts
 * GENERIC HTML ADAPTER — HARDENED V5.2 (Cloudflare Optimized)
 * 
 * CHANGES:
 * - CPU yield every 10 items to preserve event loop health.
 * - 15s timeout guard on Scraper fetches.
 * - Sanity checks for HTML/URL presence.
 */

import type { Env, ParsedJob } from '../workers/types/job.ts';
import type { ConnectorAdapter } from './interface.ts';
import { fetchScraperHTMLJobs } from '../connectors/scraper_html.ts';
import { parseScraperHTMLJob } from '../../core/ingestion-engine/parsers/scraper_html.ts';

const FETCH_TIMEOUT_MS = 15_000;
const CPU_YIELD_INTERVAL = 10;

function timeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: any;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error('FETCH_TIMEOUT')), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

function isValidRawJob(raw: any): boolean {
  return (
    raw &&
    typeof raw === 'object' &&
    !!raw.html &&
    !!raw.url
  );
}

export const ScraperHTMLAdapter: ConnectorAdapter = {
  async fetchBatch(env: Env, slug: string, offset: number, limit: number): Promise<any[]> {
    let rawBatch: any[] = [];

    try {
      rawBatch = await timeout(
        fetchScraperHTMLJobs(env, slug, offset, limit),
        FETCH_TIMEOUT_MS
      );
    } catch (e: any) {
      console.error(`[scraper_html:${slug}] fetch failed: ${e.message}`);
      throw e;
    }

    if (!Array.isArray(rawBatch)) return [];

    const sanitized: any[] = [];
    for (let i = 0; i < rawBatch.length; i++) {
        if (i % CPU_YIELD_INTERVAL === 0) await new Promise(r => setTimeout(r, 0));
        if (isValidRawJob(rawBatch[i])) sanitized.push(rawBatch[i]);
    }

    return sanitized;
  },

  async parse(raw: any, label: string): Promise<ParsedJob> {
    if (!isValidRawJob(raw)) {
      throw new Error('INVALID_RAW_JOB: Scraper HTML payload missing required fields');
    }

    try {
      const parsed = await parseScraperHTMLJob(raw, label);
      parsed.source = 'infra-scraper-html'; // Normalize source
      return parsed;
    } catch (e: any) {
      throw new Error(`PARSE_FAILURE: [scraper_html] ${e.message}`);
    }
  },

  async healthCheck(env: Env, slug: string): Promise<boolean> {
    try {
      const data = await timeout(fetchScraperHTMLJobs(env, slug, 0, 1), 5000);
      return Array.isArray(data) && data.length > 0;
    } catch {
      return false;
    }
  }
};



