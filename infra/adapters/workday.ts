/**
 * infra/adapters/workday.ts
 * WORKDAY ADAPTER — HARDENED V5.2 (Cloudflare Optimized)
 */

import type { Env, ParsedJob } from '../workers/types/job.ts';
import type { ConnectorAdapter } from './interface.ts';
import { fetchWorkdayJobs } from '../connectors/workday.ts';
import { parseWorkdayJob } from '../../core/ingestion-engine/parsers/workday.ts';

const FETCH_TIMEOUT_MS = 20_000; // Workday is notoriously slow
const CPU_YIELD_INTERVAL = 5; // Yield more frequently for enterprise payloads

function timeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: any;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error('FETCH_TIMEOUT')), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

function isValidRawJob(raw: any): boolean {
  // Workday payloads can vary, but usually have a referenceId or externalJobId
  return raw && typeof raw === 'object' && (!!raw.referenceId || !!raw.externalPath);
}

export const WorkdayAdapter: ConnectorAdapter = {
  async fetchBatch(env: Env, slug: string, offset: number, limit: number): Promise<any[]> {
    let rawBatch: any[] = [];
    try {
      rawBatch = await timeout(
        fetchWorkdayJobs(env, slug, offset, limit),
        FETCH_TIMEOUT_MS
      );
    } catch (e: any) {
      console.error(`[workday:${slug}] fetch failed: ${e.message}`);
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
    if (!isValidRawJob(raw)) throw new Error('INVALID_RAW_JOB: Workday payload sanity check failed');
    try {
      const parsed = await parseWorkdayJob(raw, label);
      parsed.source = 'workday';
      return parsed;
    } catch (e: any) {
      throw new Error(`PARSE_FAILURE: [workday] ${e.message}`);
    }
  },

  async healthCheck(env: Env, slug: string): Promise<boolean> {
    try {
      await timeout(fetchWorkdayJobs(env, slug, 0, 1), 7000);
      return true;
    } catch {
      return false;
    }
  }
};
