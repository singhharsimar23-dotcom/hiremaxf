import { Env } from '../config/env';
import { NormalizedJob } from '../types/job';
import { select, upsert } from '../infra/db';
import { set as kvSet } from '../infra/kv';
import { push as dlqPush } from '../infra/dlq';

export type WriteResult = {
  wasInserted: boolean;
  jobId: string | null;
};

interface DbResponse {
  id: string;
  created_at: string;
  updated_at: string;
}

/**
 * Persists a normalized job to the database and caches it in KV.
 * Implements strict retry logic and dead-letter queue fallback.
 */
export async function writeJob(
  env: Env,
  job: NormalizedJob,
  description: string | undefined,
  companyAbout: string | undefined,
  companySlug: string
): Promise<WriteResult> {
  const now = new Date().toISOString();
  let retries = 0;
  const MAX_RETRIES = 3;
  const RETRY_DELAY_MS = 300;

  let jobId: string | null = null;
  let wasInserted = false;

  // Step 1 — Upsert job_pointers
  while (retries < MAX_RETRIES) {
    try {
      // Check existence to satisfy "Never Overwrite first_seen_at" constraint
      // Cursors are per company, but fingerprints are global. 
      // We check fingerprint across all companies to ensure global uniqueness.
      const existing = await select<DbResponse>(env, 'job_pointers', {
        fingerprint: job.fingerprint
      });
      const isUpdate = existing.length > 0;

      // Map NormalizedJob to DB columns exactly (no aliases)
      // first_seen_at is handled conditionally
      const { first_seen_at: _, ...jobData } = job;

      const payload: Record<string, any> = {
        ...jobData,
        job_state: 'active',
        run_absent_count: 0,
        last_seen_at: now,
        // Ensure quality_factors is a plain object for JSONB
        quality_factors: job.quality_factors || {},
      };

      if (!isUpdate) {
        payload.first_seen_at = now;
      } else {
        // Explicitly exclude first_seen_at from update payload
        delete payload.first_seen_at;
      }

      const res = await upsert<DbResponse>(env, 'job_pointers', payload, 'fingerprint');

      jobId = res.id;
      // Detect insert vs update by comparing timestamps from DB
      wasInserted = res.created_at === res.updated_at;
      break; // Success
    } catch (err) {
      retries++;
      if (retries >= MAX_RETRIES) {
        // DLQ fallback - never throws
        await dlqPush(env, job.source, companySlug, job, err instanceof Error ? err : String(err));
        return { wasInserted: false, jobId: null };
      }
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }

  if (!jobId) return { wasInserted: false, jobId: null };

  // Step 2 — Upsert job_content (Secondary, non-fatal)
  if (description) {
    try {
      // Compress using native CompressionStream (available in CF Workers)
      const stream = new CompressionStream('gzip');
      const writer = stream.writable.getWriter();
      writer.write(new TextEncoder().encode(description));
      writer.close();

      const compressed = await new Response(stream.readable).arrayBuffer();

      await upsert(
        env,
        'job_content',
        {
          job_id: jobId,
          description: new Uint8Array(compressed),
          company_about: companyAbout,
          fetched_at: now,
        },
        'job_id'
      );
    } catch (contentErr) {
      // Log warning but do not fail the pipeline
      console.warn(`[write.content] Failed to store content for job ${jobId}:`, contentErr);
    }
  }

  // Step 3 — Write to KV (Quality-gated, fire and forget)
  const kvKey = `job:detail:${jobId}`;
  const kvValue = { ...job, description };

  // kv.set will skip the write automatically if quality_score < 0.7
  // Not awaited to avoid blocking the ingestion pipeline
  kvSet(env, kvKey, kvValue, 7200, job.quality_score);

  return { wasInserted, jobId };
}
