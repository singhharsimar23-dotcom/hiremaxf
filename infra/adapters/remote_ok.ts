/**
 * infra/adapters/remote_ok.ts
 * REMOTE-OK ADAPTER — HARDENED V5.2 (Cloudflare Optimized)
 */

import type { Env, ParsedJob } from '../workers/types/job.ts';
import type { ConnectorAdapter } from './interface.ts';
import { fetchRemoteOKJobs } from '../connectors/remote_ok.ts';
import { parseRemoteOKJob } from '../../core/ingestion-engine/parsers/remote_ok.ts';

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
  // Remote-OK items use 'id' or 'position' usually.
  return raw && typeof raw === 'object' && (!!raw.id || !!raw.position) && !!raw.url;
}

export const RemoteOKAdapter: ConnectorAdapter = {
  async fetchBatch(env: Env, slug: string, offset: number, limit: number): Promise<any[]> {
    let rawBatch: any[] = [];
    try {
      rawBatch = await timeout(
        fetchRemoteOKJobs(env, slug, offset, limit),
        FETCH_TIMEOUT_MS
      );
    } catch (e: any) {
      console.error(`[remote-ok:${slug}] fetch failed: ${e.message}`);
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
    if (!isValidRawJob(raw)) throw new Error('INVALID_RAW_JOB: Remote-OK payload sanity check failed');
    try {
      const parsed = await parseRemoteOKJob(raw, label);
      parsed.source = 'remote-ok';
      return parsed;
    } catch (e: any) {
      throw new Error(`PARSE_FAILURE: [remote-ok] ${e.message}`);
    }
  },

  async healthCheck(env: Env, slug: string): Promise<boolean> {
    try {
      await timeout(fetchRemoteOKJobs(env, slug, 0, 1), 5000);
      return true;
    } catch {
      return false;
    }
  }
};
