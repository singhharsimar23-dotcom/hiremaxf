/**
 * infra/adapters/jobvite.ts
 * JOBVITE ADAPTER — HARDENED V5.2 (Cloudflare Optimized)
 * 
 * CHANGES:
 * - CPU yield every 10 items to preserve event loop health.
 * - 15s timeout guard on Jobvite fetches.
 * - Sanity checks for malformed Jobvite payloads.
 */

import type { Env, ParsedJob } from '../workers/types/job.ts';
import type { ConnectorAdapter } from './interface.ts';
import { fetchJobviteJobs } from '../connectors/jobvite.ts';
import { parseJobviteJob } from '../../core/ingestion-engine/parsers/jobvite.ts';

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
    !!raw.title &&
    (!!raw.id || !!raw.guid || !!raw.link)
  );
}

export const JobviteAdapter: ConnectorAdapter = {
  async fetchBatch(env: Env, slug: string, offset: number, limit: number): Promise<any[]> {
    let rawBatch: any[] = [];

    try {
      rawBatch = await timeout(
        fetchJobviteJobs(env, slug, offset, limit),
        FETCH_TIMEOUT_MS
      );
    } catch (e: any) {
      console.error(`[jobvite:${slug}] fetch failed: ${e.message}`);
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
      throw new Error('INVALID_RAW_JOB: Jobvite payload missing required fields');
    }

    try {
      const parsed = await parseJobviteJob(raw, label);
      parsed.source = 'jobvite'; // Normalize source
      return parsed;
    } catch (e: any) {
      throw new Error(`PARSE_FAILURE: [jobvite] ${e.message}`);
    }
  },

  async healthCheck(env: Env, slug: string): Promise<boolean> {
    try {
      const data = await timeout(fetchJobviteJobs(env, slug, 0, 1), 5000);
      return Array.isArray(data) && data.length > 0;
    } catch {
      return false;
    }
  }
};



