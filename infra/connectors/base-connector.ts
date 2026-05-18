/**
 * Base Connector Interface Contract
 *
 * Universal interface that all 35 job source connectors must implement.
 * Connectors are DUMB — they fetch raw data only. No parsing, no persistence.
 *
 * @module infra/connectors
 */

// ─── Core Contract ────────────────────────────────────────────────────────────

export interface BaseConnector<TRaw = any> {
  /**
   * Fetch a paginated batch of raw job records from the source API.
   *
   * @param slug - Source-specific identifier (company slug, region code, etc.)
   * @param offset - Pagination offset (0-indexed)
   * @param limit - Maximum records to return
   * @returns Raw API response records — NOT parsed
   * @throws RateLimitError on HTTP 429/403
   * @throws Error on non-recoverable HTTP errors
   */
  fetchBatch(slug: string, offset: number, limit: number): Promise<TRaw[]>;

  /**
   * Validate that a slug is reachable and returns data.
   * Used by the certification suite.
   *
   * @returns true if source is healthy
   */
  healthCheck(slug: string): Promise<boolean>;
}

// ─── Error Types ──────────────────────────────────────────────────────────────

export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitError';
  }
}

export class ConnectorNotFoundError extends Error {
  constructor(source: string) {
    super(`No connector found for source: ${source}`);
    this.name = 'ConnectorNotFoundError';
  }
}

// ─── Connector with Auth ──────────────────────────────────────────────────────

export interface AuthenticatedConnector<TRaw = any, TEnv = any>
  extends BaseConnector<TRaw> {
  /**
   * Some connectors require environment credentials.
   * This variant accepts the Worker Env object.
   */
  fetchBatch(slug: string, offset: number, limit: number, env?: TEnv): Promise<TRaw[]>;
}

// ─── Connector Metadata ───────────────────────────────────────────────────────

export interface ConnectorMeta {
  name: string;                   // Display name
  sourceId: string;               // JobSource enum key
  apiType: 'rest' | 'graphql' | 'rss' | 'scrape';
  requiresAuth: boolean;
  rateLimit?: {
    requestsPerMinute: number;
    requestsPerDay?: number;
  };
  paginationType: 'offset' | 'cursor' | 'page' | 'none';
}
