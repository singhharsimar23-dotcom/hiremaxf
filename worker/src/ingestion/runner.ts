import { Env } from '../config/env';
import { SourceRegistry, SourceId } from '../config/sources';
import { RunResult, RawJob, NormalizedJob } from '../types/job';
import { select, patch, insert, getClient } from '../infra/db';
import { readCompany, advanceCompany, setFullSweep } from '../infra/cursor';
import { normalizeJob } from '../pipeline/normalize';
import { buildHashes, computeCanonicalHash } from '../pipeline/dedupe';
import { parseJob } from '../pipeline/parse';
import { scoreJobSafe } from '../pipeline/quality';
import { writeJob } from '../pipeline/write';
import { runGraveyard } from '../pipeline/graveyard';
import { push as dlqPush } from '../infra/dlq';

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface SourceHealthRow {
  source: string;
  status: 'healthy' | 'degraded' | 'quarantined';
  consecutive_failures: number;
  quarantine_until: string | null;
}

interface IngestionRunRow {
  id: string;
}

// ---------------------------------------------------------------------------
// runCompany
// ---------------------------------------------------------------------------

/**
 * Runs the ingestion pipeline for a single company+source pair.
 * NEVER throws — catches everything and returns RunResult with errors[].
 */
export async function runCompany(
  env: Env,
  registry: SourceRegistry,
  sourceId: string,
  companySlug: string,
  signal: AbortSignal,
  tier: string,
): Promise<RunResult> {
  const startMs = Date.now();
  const errors: string[] = [];
  let jobsFetched = 0;
  let jobsInserted = 0;
  let jobsUpdated = 0;
  let fullSweepComplete = false;

  try {
    // ------------------------------------------------------------------
    // STEP 1 — Check source_health
    // ------------------------------------------------------------------
    let healthRows: SourceHealthRow[] = [];
    try {
      healthRows = await select<SourceHealthRow>(env, 'source_health', { source: sourceId });
    } catch (err) {
      errors.push(`[step1.select_health] ${String(err)}`);
      // Non-fatal: continue without quarantine check
    }

    if (healthRows.length === 0) {
      // No row — insert default
      try {
        await insert(env, 'source_health', {
          source: sourceId,
          status: 'healthy',
          consecutive_failures: 0,
        });
      } catch (err) {
        errors.push(`[step1.insert_health] ${String(err)}`);
      }
    } else {
      const row = healthRows[0];
      if (
        row.status === 'quarantined' &&
        row.quarantine_until &&
        new Date(row.quarantine_until) > new Date()
      ) {
        // Source is quarantined — return early
        return buildResult(sourceId, companySlug, startMs, 0, 0, 0, false, ['quarantined']);
      }
    }

    // ------------------------------------------------------------------
    // STEP 2 — Read company cursor
    // ------------------------------------------------------------------
    let offset = 0;
    let isPaused = false;
    try {
      const cursor = await readCompany(env, companySlug, sourceId);
      offset = cursor.offset;
      isPaused = cursor.isPaused;
    } catch (err) {
      errors.push(`[step2.read_cursor] ${String(err)}`);
      // Default to offset 0, not paused
    }

    if (isPaused) {
      return buildResult(sourceId, companySlug, startMs, 0, 0, 0, false, ['paused']);
    }

    // ------------------------------------------------------------------
    // STEP 3 — Get adapter
    // ------------------------------------------------------------------
    const adapter = registry.getAdapter(sourceId as SourceId);

    // ------------------------------------------------------------------
    // STEP 4 — Fetch jobs (throws on adapter error → caught below)
    // ------------------------------------------------------------------
    let rawJobs: RawJob[] = [];
    let nextCursor = 0;

    try {
      const fetchResult = await adapter.fetch(env, companySlug, offset, signal);
      rawJobs = fetchResult.jobs;
      nextCursor = fetchResult.nextCursor;
    } catch (fetchErr) {
      // Increment consecutive_failures and possibly quarantine
      const failMsg = `[step4.fetch] ${String(fetchErr)}`;
      errors.push(failMsg);
      await updateHealthOnFailure(env, sourceId).catch(() => {/* best-effort */ });

      // Log failed run and re-throw so outer catch records a clean RunResult
      throw new Error(failMsg);
    }

    jobsFetched = rawJobs.length;

    // ------------------------------------------------------------------
    // STEP 5 — Track externalIds seen this invocation
    // ------------------------------------------------------------------
    const seenIds: string[] = [];

    // ------------------------------------------------------------------
    // STEP 6 — Process each raw job (Safe Incremental: max 15 per run)
    // ------------------------------------------------------------------
    const MAX_JOBS_PER_RUN = 4;
    const jobsToProcess = rawJobs.slice(0, MAX_JOBS_PER_RUN);

    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    for (let i = 0; i < jobsToProcess.length; i++) {
      const job = jobsToProcess[i];
      // Add delay between jobs (except the first one) to stay under 3 RPM
      if (i > 0) await sleep(1500);

      try {
        // 6a. Normalize
        const normalized = normalizeJob(job);

        // 6b. Build hashes
        const hashes = await buildHashes(normalized, job);
        if (hashes === null) {
          errors.push(`[step6.hash] skipped externalId=${job.externalId} — hash returned null`);
          continue;
        }

        // 6c. Parse (AI)
        const parsed = await parseJob(env, job, companySlug);
        if (parsed === null) {
          // parseJob already pushed to DLQ
          errors.push(`[step6.parse] skipped externalId=${job.externalId}`);
          continue;
        }

        // 6d. Recompute canonical_hash with actual role/seniority from parse
        const finalCanonical = await computeCanonicalHash(
          normalized.company_name,
          normalized.title,
          parsed.role_category,
          parsed.seniority_band,
        );

        // 6e. Score
        const { score, factors } = scoreJobSafe(job, parsed);

        // 6f. Build NormalizedJob
        const normalizedJob: NormalizedJob = {
          // From hashes
          fingerprint: hashes.fingerprint,
          canonical_hash: finalCanonical,
          // From raw
          company_slug: companySlug,
          external_id: job.externalId,
          source: job.source,
          source_url: job.sourceUrl,
          posted_at: job.postedAt,
          // From normalized
          title: normalized.title,
          company_name: normalized.company_name,
          location_name: normalized.location_name,
          is_remote: normalized.is_remote,
          salary_min: normalized.salary_min,
          salary_max: normalized.salary_max,
          salary_currency: normalized.salary_currency,
          // From parsed
          role_category: parsed.role_category,
          seniority_band: parsed.seniority_band,
          location_type: parsed.location_type,
          industry: parsed.industry,
          total_comp_min: parsed.total_comp_min,
          total_comp_max: parsed.total_comp_max,
          equity_type: parsed.equity_type,
          bonus_mentioned: parsed.bonus_mentioned,
          pay_transparency: parsed.pay_transparency,
          tech_stack: parsed.tech_stack,
          requirements: parsed.requirements,
          benefits: parsed.benefits,
          skills: parsed.skills,
          years_exp_min: parsed.years_exp_min,
          years_exp_max: parsed.years_exp_max,
          degree_required: parsed.degree_required,
          contract_type: parsed.contract_type,
          work_model: parsed.work_model,
          hybrid_days_onsite: parsed.hybrid_days_onsite,
          timezone_required: parsed.timezone_required,
          relocation_offered: parsed.relocation_offered,
          visa_sponsorship: parsed.visa_sponsorship,
          visa_types: parsed.visa_types,
          authorized_only: parsed.authorized_only,
          clearance_required: parsed.clearance_required,
          clearance_level: parsed.clearance_level,
          ats_type: parsed.ats_type,
          easy_apply: parsed.easy_apply,
          cover_letter_required: parsed.cover_letter_required,
          portfolio_required: parsed.portfolio_required,
          is_tech: parsed.is_tech,
          // Quality
          quality_score: score,
          quality_factors: factors as unknown as Record<string, number>,
          // State
          job_state: 'active',
          last_seen_at: new Date().toISOString(),
          // first_seen_at is omitted here — writeJob sets it on INSERT only
        };

        // 6g. Write
        const result = await writeJob(
          env,
          normalizedJob,
          job.description,
          parsed.company_about,
          companySlug,
        );

        // 6h & 6i. Track
        seenIds.push(job.externalId);
        if (result.wasInserted) {
          jobsInserted++;
        } else {
          jobsUpdated++;
        }
      } catch (jobErr) {
        // Per-job error: log, push to DLQ, continue loop
        const errMsg = `[step6.job] externalId=${job.externalId} error: ${String(jobErr)}`;
        errors.push(errMsg);
        console.error(errMsg, jobErr);
        await dlqPush(env, sourceId, companySlug, job, jobErr instanceof Error ? jobErr : String(jobErr));
        // continue to next job — loop is NOT aborted
      }
    }

    // ------------------------------------------------------------------
    // STEP 7 — Advance cursor
    // ------------------------------------------------------------------
    try {
      await advanceCompany(env, companySlug, sourceId, nextCursor);
    } catch (err) {
      errors.push(`[step7.advance_cursor] ${String(err)}`);
    }

    // ------------------------------------------------------------------
    // STEP 8 — Full sweep check (ONLY when nextCursor === 0 AND we processed the whole batch)
    // ------------------------------------------------------------------
    if (nextCursor === 0 && jobsToProcess.length === rawJobs.length) {
      try {
        await setFullSweep(env, companySlug, sourceId, seenIds);
      } catch (err) {
        errors.push(`[step8.set_full_sweep] ${String(err)}`);
      }

      // runGraveyard is ONLY called here, inside nextCursor === 0 block
      try {
        const graveyardResult = await runGraveyard(env, companySlug, sourceId);
        console.log(`[runner] graveyard: company=${companySlug} source=${sourceId}`, graveyardResult);
      } catch (err) {
        errors.push(`[step8.graveyard] ${String(err)}`);
      }

      fullSweepComplete = true;
    }

    // ------------------------------------------------------------------
    // STEP 9 — Update source_health on success
    // ------------------------------------------------------------------
    try {
      await patch(env, 'source_health', { source: sourceId }, {
        consecutive_failures: 0,
        status: 'healthy',
      });
    } catch (err) {
      errors.push(`[step9.patch_health] ${String(err)}`);
    }

    // ------------------------------------------------------------------
    // STEP 10 — Log ingestion_runs
    // ------------------------------------------------------------------
    const durationMs = Date.now() - startMs;
    try {
      await insert<IngestionRunRow>(env, 'ingestion_runs', {
        source: sourceId,
        company_slug: companySlug,
        tier: tier,
        status: 'success',
        jobs_fetched: jobsFetched,
        jobs_inserted: jobsInserted,
        jobs_updated: jobsUpdated,
        duration_ms: durationMs,
        errors: errors.length > 0 ? errors : null,
      });
    } catch (err) {
      errors.push(`[step10.log_run] ${String(err)}`);
    }

    // ------------------------------------------------------------------
    // STEP 11 — Return RunResult
    // ------------------------------------------------------------------
    return buildResult(sourceId, companySlug, startMs, jobsFetched, jobsInserted, jobsUpdated, fullSweepComplete, errors);

  } catch (outerErr) {
    // Outer catch: runCompany NEVER throws — log and return error RunResult
    const errMsg = String(outerErr);
    if (!errors.includes(errMsg)) {
      errors.push(errMsg);
    }

    const durationMs = Date.now() - startMs;
    // Best-effort log of failed run
    try {
      await insert<IngestionRunRow>(env, 'ingestion_runs', {
        source: sourceId,
        company_slug: companySlug,
        tier: tier,
        status: 'error',
        jobs_fetched: jobsFetched,
        jobs_inserted: jobsInserted,
        jobs_updated: jobsUpdated,
        duration_ms: durationMs,
        errors: errors,
      });
    } catch {/* swallow — best effort */ }

    return {
      source: sourceId,
      companySlug,
      jobsFetched,
      jobsInserted,
      jobsUpdated,
      jobsDisappeared: 0,
      errors,
      durationMs,
      fullSweepComplete,
    };
  }
}

// ---------------------------------------------------------------------------
// runDiscovery
// ---------------------------------------------------------------------------

/**
 * Runs discovery for a source and upserts new company slugs.
 * Existing slugs: INSERT ... ON CONFLICT DO NOTHING (never update).
 * NEVER throws. Returns count of new rows inserted.
 */
export async function runDiscovery(
  env: Env,
  registry: SourceRegistry,
  sourceId: string,
): Promise<{ newSlugs: number }> {
  try {
    const discovery = registry.getDiscovery(sourceId as SourceId);
    const { slugs } = await discovery.discover(env);

    if (slugs.length === 0) {
      return { newSlugs: 0 };
    }

    // INSERT ... ON CONFLICT DO NOTHING via raw Supabase client
    // We use getClient directly because insert<T>() throws on conflict,
    // and we need ignoreDuplicates semantics.
    const supabase = getClient(env);
    const rows = slugs.map(({ company_slug, company_name_hint }) => ({
      slug: `${sourceId}-${company_slug}`,
      company_slug,
      source: sourceId,
      ...(company_name_hint ? { company_name_hint } : {}),
    }));

    const { data, error } = await supabase
      .from('company_registry')
      .upsert(rows, { onConflict: 'company_slug, source', ignoreDuplicates: true })
      .select();

    if (error) {
      console.error(`[runDiscovery] DB error for source=${sourceId}:`, error.message);
      return { newSlugs: 0 };
    }

    const newSlugs = data?.length ?? 0;
    console.log(`[runDiscovery] source=${sourceId} discovered ${newSlugs} new slug(s) of ${slugs.length} total`);
    return { newSlugs };

  } catch (err) {
    console.error(`[runDiscovery] Unhandled error for source=${sourceId}:`, err);
    return { newSlugs: 0 };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Increments consecutive_failures for a source.
 * Promotes to 'degraded' at >= 3, 'quarantined' at >= 5 (quarantine_until = +2hrs).
 */
async function updateHealthOnFailure(env: Env, sourceId: string): Promise<void> {
  const rows = await select<SourceHealthRow>(env, 'source_health', { source: sourceId });

  const currentFailures = rows.length > 0 ? rows[0].consecutive_failures : 0;
  const newFailures = currentFailures + 1;

  let newStatus: 'healthy' | 'degraded' | 'quarantined' = 'healthy';
  let quarantineUntil: string | null = null;

  if (newFailures >= 5) {
    newStatus = 'quarantined';
    quarantineUntil = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(); // now + 2hrs
  } else if (newFailures >= 3) {
    newStatus = 'degraded';
  }

  await patch(env, 'source_health', { source: sourceId }, {
    consecutive_failures: newFailures,
    status: newStatus,
    ...(quarantineUntil ? { quarantine_until: quarantineUntil } : {}),
  });
}

/**
 * Constructs a RunResult from accumulated counters.
 */
function buildResult(
  source: string,
  companySlug: string,
  startMs: number,
  jobsFetched: number,
  jobsInserted: number,
  jobsUpdated: number,
  fullSweepComplete: boolean,
  errors: string[],
): RunResult {
  return {
    source,
    companySlug,
    jobsFetched,
    jobsInserted,
    jobsUpdated,
    jobsDisappeared: 0,
    errors,
    durationMs: Date.now() - startMs,
    fullSweepComplete,
  };
}
