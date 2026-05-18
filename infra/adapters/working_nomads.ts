/**
 * infra/adapters/working_nomads.ts
 * WORKING NOMADS ADAPTER — HARDENED V5.2 (Cloudflare Optimized)
 */

import type { Env, ParsedJob } from '../workers/types/job.ts';
import type { ConnectorAdapter } from './interface.ts';
import { fetchWorkingNomadsJobs } from '../connectors/working_nomads.ts';
import { parseWorkingNomadsJob } from '../../core/ingestion-engine/parsers/working_nomads.ts';

const FETCH_TIMEOUT_MS = 10_000;
const CPU_YIELD_INTERVAL = 10;

function timeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: any;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error('FETCH_TIMEOUT')), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

function isValidRawJob(raw: any): boolean {
  return raw && typeof raw === 'object' && !!raw.title && !!raw.url;
}

export const WorkingNomadsAdapter: ConnectorAdapter = {
  async fetchBatch(env: Env, slug: string, offset: number, limit: number): Promise<any[]> {
    let rawBatch: any[] = [];
    try {
      rawBatch = await timeout(
        fetchWorkingNomadsJobs(env, slug, offset, limit),
        FETCH_TIMEOUT_MS
      );
    } catch (e: any) {
      console.error(`[working-nomads:${slug}] fetch failed: ${e.message}`);
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
    if (!isValidRawJob(raw)) throw new Error('INVALID_RAW_JOB: Working Nomads payload sanity check failed');
    try {
      const parsed = await parseWorkingNomadsJob(raw, label);
      parsed.source = 'working-nomads';
      return parsed;
    } catch (e: any) {
      throw new Error(`PARSE_FAILURE: [working-nomads] ${e.message}`);
    }
  },

  async healthCheck(env: Env, slug: string): Promise<boolean> {
    try {
      await timeout(fetchWorkingNomadsJobs(env, slug, 0, 1), 5000);
      return true;
    } catch {
      return false;
    }
  }
};
