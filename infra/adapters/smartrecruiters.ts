/**
 * infra/adapters/smartrecruiters.ts
 * SMARTRECRUITERS ADAPTER — HARDENED V5.2 (Cloudflare Optimized)
 */

import type { Env, ParsedJob } from '../workers/types/job.ts';
import type { ConnectorAdapter } from './interface.ts';
import { fetchSmartrecruitersJobs } from '../connectors/smartrecruiters.ts';
import { parseSmartrecruitersJob } from '../../core/ingestion-engine/parsers/smartrecruiters.ts';

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
  return raw && typeof raw === 'object' && !!raw.id && !!raw.name;
}

export const SmartrecruitersAdapter: ConnectorAdapter = {
  async fetchBatch(env: Env, slug: string, offset: number, limit: number): Promise<any[]> {
    let rawBatch: any[] = [];
    try {
      rawBatch = await timeout(
        fetchSmartrecruitersJobs(slug, offset, limit),
        FETCH_TIMEOUT_MS
      );
    } catch (e: any) {
      console.error(`[smartrecruiters:${slug}] fetch failed: ${e.message}`);
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
    if (!isValidRawJob(raw)) throw new Error('INVALID_RAW_JOB: Smartrecruiters payload sanity check failed');
    try {
      const parsed = await parseSmartrecruitersJob(raw, label);
      parsed.source = 'smartrecruiters';
      return parsed;
    } catch (e: any) {
      throw new Error(`PARSE_FAILURE: [smartrecruiters] ${e.message}`);
    }
  },

  async healthCheck(_env: Env, slug: string): Promise<boolean> {
    try {
      await timeout(fetchSmartrecruitersJobs(slug, 0, 1), 5000);
      return true;
    } catch {
      return false;
    }
  }
};
