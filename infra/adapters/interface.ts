// ═══════════════════════════════════════════════════════════════════════════════
// infra/workers/core/adapter/interface.ts
// Standardized interface for all ingestion connectors
// ═══════════════════════════════════════════════════════════════════════════════

import type { Env, ParsedJob } from '../workers/types/job.ts';

/**
 * All ingestion connectors (APIs, Aggregators, Scrapers) must implement this.
 * This ensures the main ingestion loop remains generic and reliable.
 */
export interface ConnectorAdapter {
  /**
   * Fetches a slice of raw jobs from the source.
   * Implementation should handle its own internal throttling/retries if needed.
   */
  fetchBatch(env: Env, slug: string, offset: number, limit: number): Promise<unknown[]>;

  /**
   * Normalizes a single raw job into the canonical ParsedJob shape.
   */
  parse(raw: unknown, company: string): Promise<ParsedJob>;

  /**
   * Optional health check to verify if the endpoint is reachable.
   */
  healthCheck?(env: Env, slug: string): Promise<boolean>;
}


