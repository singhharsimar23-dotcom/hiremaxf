/**
 * infra/adapters/bamboohr.ts
 * BAMBOOHR ADAPTER — HARDENED V5.2 (Cloudflare Optimized)
 */

import type { Env, ParsedJob } from '../workers/types/job.ts';
import type { ConnectorAdapter } from './interface.ts';
import { fetchBambooHRJobs } from '../connectors/bamboohr.ts';
import { parseBambooHRJob as parseBamboohrJob } from '../../core/ingestion-engine/parsers/bamboohr.ts';

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
  return raw && typeof raw === 'object' && !!raw.id;
}

export const BamboohrAdapter: ConnectorAdapter = {
  async fetchBatch(env: Env, slug: string, offset: number, limit: number): Promise<any[]> {
    let rawBatch: any[] = [];
    try {
      rawBatch = await timeout(
        fetchBambooHRJobs(env, slug, offset, limit),
        FETCH_TIMEOUT_MS
      );
    } catch (e: any) {
      console.error(`[bamboohr:${slug}] fetch failed: ${e.message}`);
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
    if (!isValidRawJob(raw)) throw new Error('INVALID_RAW_JOB: Bamboohr payload sanity check failed');
    try {
      const parsed = await parseBamboohrJob(raw, label);
      parsed.source = 'bamboohr';
      return parsed;
    } catch (e: any) {
      throw new Error(`PARSE_FAILURE: [bamboohr] ${e.message}`);
    }
  },

  async healthCheck(env: Env, slug: string): Promise<boolean> {
    try {
      await timeout(fetchBambooHRJobs(env, slug, 0, 1), 5000);
      return true;
    } catch {
      return false;
    }
  }
};
