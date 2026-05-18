/**
 * infra/adapters/static_feed.ts
 * STATIC FEED ADAPTER — HARDENED V5.2 (Cloudflare Optimized)
 * (Remotive + Arbeitnow)
 */

import type { Env, ParsedJob } from '../workers/types/job.ts';
import type { ConnectorAdapter } from './interface.ts';
import { fetchStaticFeedJobs } from '../connectors/static_feed.ts';
import { parseStaticFeedJob } from '../../core/ingestion-engine/parsers/static_feed.ts';

const FETCH_TIMEOUT_MS = 20_000; // Combination of 2 feeds, needs more time
const CPU_YIELD_INTERVAL = 10;

function timeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: any;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error('FETCH_TIMEOUT')), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

function isValidRawJob(raw: any): boolean {
  return raw && typeof raw === 'object' && (!!raw.id || !!raw.slug) && (!!raw.title || !!raw.role);
}

export const StaticFeedAdapter: ConnectorAdapter = {
  async fetchBatch(env: Env, slug: string, offset: number, limit: number): Promise<any[]> {
    let rawBatch: any[] = [];
    try {
      rawBatch = await timeout(
        fetchStaticFeedJobs(env, slug, offset, limit),
        FETCH_TIMEOUT_MS
      );
    } catch (e: any) {
      console.error(`[static-feed] fetch failed: ${e.message}`);
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
    if (!isValidRawJob(raw)) throw new Error('INVALID_RAW_JOB: Static Feed payload sanity check failed');
    try {
      const parsed = await parseStaticFeedJob(raw, label);
      parsed.source = 'static-feed';
      return parsed;
    } catch (e: any) {
      throw new Error(`PARSE_FAILURE: [static-feed] ${e.message}`);
    }
  },

  async healthCheck(env: Env, slug: string): Promise<boolean> {
    try {
      await timeout(fetchStaticFeedJobs(env, slug, 0, 1), 5000);
      return true;
    } catch {
      return false;
    }
  }
};
