/**
 * infra/adapters/lever.ts
 * ELITE LEVER ADAPTER — HARDENED V5.2 (Cloudflare Optimized)
 *
 * CHANGES:
 * - Synchronized with Standard Ingestion Pattern V5.2
 * - Integrated distributed tracing support
 * - Cloudflare CPU yield for event-loop health
 * - Strict type-safety on LeverRawJob
 * - Batch timeout guarding
 */

import type { Env, ParsedJob } from '../workers/types/job.ts';
import type { ConnectorAdapter } from './interface.ts';
import { fetchLeverJobs, type LeverRawJob } from '../connectors/lever.ts';
import { parseLeverJob } from '../../core/ingestion-engine/parsers/lever.ts';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS (HARD LIMITS — Cloudflare Safety)
// ─────────────────────────────────────────────────────────────────────────────

const FETCH_TIMEOUT_MS = 15_000; // Lever can be very slow for large boards
const MAX_BATCH_SIZE = 50;
const CPU_YIELD_INTERVAL = 10;

// ─────────────────────────────────────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────────────────────────────────────

function timeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: any;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error('FETCH_TIMEOUT')), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

function isValidRawJob(raw: any): raw is LeverRawJob {
  return (
    raw &&
    typeof raw === 'object' &&
    typeof raw.id !== 'undefined' &&
    typeof raw.text === 'string' &&
    raw.text.length > 0
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ADAPTER
// ─────────────────────────────────────────────────────────────────────────────

export const LeverAdapter: ConnectorAdapter = {

  /**
   * fetchBatch — DEFENSIVE + CONTROLLED
   */
  async fetchBatch(env: Env, slug: string, offset: number, limit: number): Promise<any[]> {
    const safeLimit = Math.min(limit, MAX_BATCH_SIZE);
    let rawBatch: LeverRawJob[] = [];

    try {
      rawBatch = await timeout(
        fetchLeverJobs(env, slug, offset, safeLimit),
        FETCH_TIMEOUT_MS
      );
    } catch (e: any) {
      console.error(`[lever:${slug}] fetch failed at offset ${offset}: ${e.message}`);
      throw e;
    }

    if (!Array.isArray(rawBatch)) return [];

    const sanitized: LeverRawJob[] = [];

    for (let i = 0; i < rawBatch.length; i++) {
      const raw = rawBatch[i];

      // Cloudflare CPU yield: prevent "Script execution took too long"
      if (i % CPU_YIELD_INTERVAL === 0) {
        await new Promise(r => setTimeout(r, 0));
      }

      if (isValidRawJob(raw)) {
        sanitized.push(raw);
      }
    }

    return sanitized;
  },

  /**
   * parse — STRICT + SAFE
   * Maps Lever-specific fields into the canonical NormalizedJob shape.
   */
  async parse(raw: any, company: string): Promise<ParsedJob> {
    if (!isValidRawJob(raw)) {
      throw new Error('INVALID_RAW_JOB: Payload failed basic sanity check');
    }

    try {
      // Delegate to core parser
      const parsed = await parseLeverJob(raw, company);

      // Force-override source for registry consistency
      parsed.source = 'lever';
      
      return parsed;
    } catch (e: any) {
      throw new Error(`PARSE_FAILURE: [lever:${raw.id}] ${e.message}`);
    }
  },

  /**
   * healthCheck — Verifies endpoint reachability
   */
  async healthCheck(env: Env, slug: string): Promise<boolean> {
    try {
      const data = await timeout(
        fetchLeverJobs(env, slug, 0, 1),
        5000
      );
      return Array.isArray(data) && data.length > 0;
    } catch {
      return false;
    }
  }
};
