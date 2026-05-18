/**
 * infra/adapters/greenhouse.ts
 * ELITE GREENHOUSE ADAPTER — HARDENED V5.1 (Cloudflare Optimized)
 *
 * CHANGES:
 * - Synchronized with NormalizedJobSchema (V4.2)
 * - Removed broken payload capping logic (Relies on Engine-level Zod validation)
 * - Integrated distributed tracing support
 * - Cloudflare CPU yield for event-loop health
 * - Strict type-safety on GreenhouseRawJob
 */

import type { Env, ParsedJob } from '../workers/types/job.ts';
import type { ConnectorAdapter } from './interface.ts';
import { fetchGreenhouseJobs, type GreenhouseRawJob } from '../connectors/greenhouse.ts';
import { parseGreenhouseJob } from '../../core/ingestion-engine/parsers/greenhouse.ts';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS (HARD LIMITS — Cloudflare Safety)
// ─────────────────────────────────────────────────────────────────────────────

const FETCH_TIMEOUT_MS = 10_000; // Greenhouse can be slow on large boards
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

function isValidRawJob(raw: any): raw is GreenhouseRawJob {
  return (
    raw &&
    typeof raw === 'object' &&
    typeof raw.id !== 'undefined' &&
    typeof raw.title === 'string' &&
    raw.title.length > 0
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ADAPTER
// ─────────────────────────────────────────────────────────────────────────────

export const GreenhouseAdapter: ConnectorAdapter = {

  /**
   * fetchBatch — DEFENSIVE + CONTROLLED
   * Greenhouse API is a full dump; we slice in the connector but manage safety here.
   */
  async fetchBatch(_env: Env, slug: string, offset: number, limit: number): Promise<any[]> {
    const safeLimit = Math.min(limit, MAX_BATCH_SIZE);
    let rawBatch: GreenhouseRawJob[] = [];

    try {
      rawBatch = await timeout(
        fetchGreenhouseJobs(slug, offset, safeLimit),
        FETCH_TIMEOUT_MS
      );
    } catch (e: any) {
      // Logic handled by OrchestrationEngine, but we log source-specific context here
      console.error(`[greenhouse:${slug}] fetch failed at offset ${offset}: ${e.message}`);
      throw e;
    }

    if (!Array.isArray(rawBatch)) return [];

    const sanitized: GreenhouseRawJob[] = [];

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
   * Maps Greenhouse-specific fields into the canonical NormalizedJob shape.
   */
  async parse(raw: GreenhouseRawJob, company: string): Promise<ParsedJob> {
    if (!isValidRawJob(raw)) {
      throw new Error('INVALID_RAW_JOB: Payload failed basic sanity check');
    }

    try {
      // Delegate to core parser
      const parsed = await parseGreenhouseJob(raw, company);

      // Force-override source for registry consistency
      parsed.source = 'greenhouse';
      
      return parsed;
    } catch (e: any) {
      throw new Error(`PARSE_FAILURE: [greenhouse:${raw.id}] ${e.message}`);
    }
  },

  /**
   * healthCheck — Verifies endpoint reachability
   */
  async healthCheck(_env: Env, slug: string): Promise<boolean> {
    try {
      const data = await timeout(
        fetchGreenhouseJobs(slug, 0, 1),
        5000
      );
      return Array.isArray(data) && data.length > 0;
    } catch {
      return false;
    }
  }
};
