/**
 * infra/adapters/indeed.ts
 * INDEED ADAPTER — HARDENED V6.2 (Apify Optimized)
 */

import type { Env, ParsedJob } from '../workers/types/job.ts';
import type { ConnectorAdapter } from './interface.ts';
import { fetchApifyResults } from '../connectors/apify.ts';
import { parseIndeedJob } from '../../core/ingestion-engine/parsers/indeed.ts';

const FETCH_TIMEOUT_MS = 25_000;
const CPU_YIELD_INTERVAL = 5;

function timeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: any;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error('FETCH_TIMEOUT')), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

function isValidRawJob(raw: any): boolean {
  return raw && typeof raw === 'object' && (!!raw.id || !!raw.jobkey);
}

export const IndeedAdapter: ConnectorAdapter = {
  async fetchBatch(env: Env, slug: string, offset: number, limit: number): Promise<any[]> {
    let rawBatch: any[] = [];
    try {
      rawBatch = await timeout(
        fetchApifyResults(env, slug, offset, limit),
        FETCH_TIMEOUT_MS
      );
    } catch (e: any) {
      console.error(`[indeed:${slug}] fetch failed: ${e.message}`);
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
    if (!isValidRawJob(raw)) throw new Error('INVALID_RAW_JOB: Indeed payload sanity check failed');
    try {
      const parsed = await parseIndeedJob(raw, label);
      parsed.source = 'indeed';
      return parsed;
    } catch (e: any) {
      throw new Error(`PARSE_FAILURE: [indeed] ${e.message}`);
    }
  },

  async healthCheck(env: Env, slug: string): Promise<boolean> {
    try {
      await timeout(fetchApifyResults(env, slug, 0, 1), 7000);
      return true;
    } catch {
      return false;
    }
  }
};
