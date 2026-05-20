/**
 * coverage/detectAnomalies.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * 3C LAYER 4: COVERAGE — Blindspot Detection Engine
 *
 * PURPOSE:
 *   Detect anomalies that Contract/Check/Confirm cannot catch:
 *     A. Persistence failure (gateway 503 loop) → CRITICAL
 *     B. Zombie cron (worker fires, 0 jobs across all runs) → CRITICAL
 *     C. Pipeline asymmetry (cursor advances, 0 inserts → wasted fetch)
 *     D. Source-level silent failure (active, ran, 0 output) → WARNING
 *     E. Throughput zero (no DB writes in configurable window) → WARNING
 *     F. Never-ran sources (ACTIVE but last_run_at is null forever)
 *     G. Duplicate storms (dedup rate > threshold → may mask real output drop)
 *     H. Stale worker (heartbeat timestamp past expected cron interval)
 *     I. Cursor drift (cursor_offset > 0 for source with 0 inserts ever)
 *
 * DESIGN CONSTRAINTS:
 *   - READ-ONLY. Zero writes to any table.
 *   - Zero external dependencies. Uses node:https only.
 *   - Isolated under /coverage. Does NOT import from 3C layers.
 *   - Fails loudly: exit(1) on any CRITICAL anomaly.
 *
 * USAGE:
 *   npx tsx coverage/detectAnomalies.ts
 *   npx tsx coverage/detectAnomalies.ts --window=60   (last 60 minutes)
 *   npx tsx coverage/detectAnomalies.ts --window=1440 (last 24h)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { request as httpsRequest } from 'node:https';

import { type Anomaly, renderReport, formatRelativeTime } from './report.js';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASELINE_PATH = join(__dirname, 'expectedBaseline.json');

// Default look-back window (minutes). Override with --window=N
const DEFAULT_WINDOW_MINUTES = 60;

// ─── ENV LOADER ───────────────────────────────────────────────────────────────

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const file of ['.env', '.env.local']) {
    const p = join(resolve(process.cwd()), file);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, 'utf-8').split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq < 0) continue;
      env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    }
  }
  return env;
}

// ─── SUPABASE HTTP CLIENT (no SDK) ───────────────────────────────────────────

type Row = Record<string, unknown>;

async function supabaseQuery(
  url: string,
  serviceKey: string,
  table: string,
  select: string,
  filter?: string
): Promise<Row[]> {
  const path = `/rest/v1/${table}?select=${encodeURIComponent(select)}${filter ? `&${filter}` : ''}`;
  const host = new URL(url).hostname;

  return new Promise((resolve, reject) => {
    const req = httpsRequest(
      {
        hostname: host,
        path,
        method: 'GET',
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`[${table}] HTTP ${res.statusCode}: ${body.slice(0, 200)}`));
            return;
          }
          try {
            resolve(JSON.parse(body) as Row[]);
          } catch {
            reject(new Error(`[${table}] JSON parse error: ${body.slice(0, 200)}`));
          }
        });
      }
    );
    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.destroy(new Error(`[${table}] Request timed out`));
    });
    req.end();
  });
}

// ─── BASELINE LOADER ──────────────────────────────────────────────────────────

interface GlobalThresholds {
  min_jobs_per_24h:           number;
  max_zero_output_cron_runs:  number;
  max_persistence_failure_pct: number;
  max_consecutive_zero_runs:  number;
  cron_stale_after_minutes:   number;
}

interface BaselineFile {
  _meta: unknown;
  thresholds: { global: GlobalThresholds };
  sources: Record<string, { min_jobs_per_24h?: number; max_duplicate_rate?: number; expected_last_run_within_hours?: number; note?: string }>;
  gateway: { max_consecutive_503s: number };
}

function loadBaseline(): BaselineFile {
  if (!existsSync(BASELINE_PATH)) {
    throw new Error(`expectedBaseline.json not found at: ${BASELINE_PATH}`);
  }
  return JSON.parse(readFileSync(BASELINE_PATH, 'utf-8')) as BaselineFile;
}

// ─── UTILITY ──────────────────────────────────────────────────────────────────

function minsAgo(isoString: string | null | undefined): number {
  if (!isoString) return Infinity;
  return (Date.now() - new Date(isoString).getTime()) / 60000;
}

function parseWindow(): number {
  const arg = process.argv.find(a => a.startsWith('--window='));
  if (arg) {
    const n = parseInt(arg.split('=')[1], 10);
    if (!isNaN(n) && n > 0) return n;
  }
  return DEFAULT_WINDOW_MINUTES;
}

// ─── DETECTION FUNCTIONS ──────────────────────────────────────────────────────

/**
 * A. PERSISTENCE FAILURE DETECTION
 *
 * Heuristic: If ALL active sources that ran within the last 2h have
 * last_insert_count = 0, then persistence is failing systemically.
 * This is distinct from "sources are just quiet" because multiple sources
 * ran (cursor advanced) but NONE produced inserts.
 */
function detectPersistenceFailure(
  sources: Row[],
  heartbeats: Row[],
  runs: Row[],
  baseline: BaselineFile
): Anomaly[] {
  const anomalies: Anomaly[] = [];
  const hasRecentWrites = runs.some((run) => {
    if ((run.status as string) !== 'completed') return false;
    const summary = (run.summary as Record<string, unknown>) ?? {};
    return Number(summary.totalWrites ?? 0) > 0;
  });

  // Sources that actually ran recently (within 2h)
  const recentlyRan = sources.filter(s => minsAgo(s.last_run_at as string) < 120);

  if (recentlyRan.length === 0) return anomalies;

  const allZeroInserts = recentlyRan.every(s => (s.last_insert_count as number ?? 0) === 0);
  const allZeroJobs7d  = recentlyRan.every(s => (s.jobs_new_7d as number ?? 0) === 0);

  if (!hasRecentWrites && allZeroInserts && allZeroJobs7d && recentlyRan.length >= 2) {
    // Multiple sources ran, none produced inserts → gateway-level issue
    const sourceNames = recentlyRan.map(s => s.source_name).join(', ');
    anomalies.push({
      severity: 'CRITICAL',
      category: 'PERSISTENCE_FAILURE',
      message: `${recentlyRan.length} sources ran recently (within 2h) but ALL have last_insert_count=0 and jobs_new_7d=0. This is NOT a source issue — this is a write path failure. Sources: ${sourceNames}`,
      action: 'Check infra-gateway Edge Function. Run: curl -X POST https://ssuknybhzcuusjardsve.supabase.co/functions/v1/infra-gateway — if 503, the function is down. Redeploy: supabase functions deploy infra-gateway',
      data: {
        sources_checked: recentlyRan.length,
        all_insert_count_zero: true,
        sample_sources: sourceNames.slice(0, 80),
      },
    });
  }

  // Zombie cron detector: all recent heartbeats show 0 jobs_processed
  const recentHeartbeats = heartbeats.slice(0, 10);
  if (!hasRecentWrites && recentHeartbeats.length >= 5) {
    const allZeroProcessed = recentHeartbeats.every(h => (h.jobs_processed as number ?? 0) === 0);
    if (allZeroProcessed) {
      const oldestZero = recentHeartbeats[recentHeartbeats.length - 1];
      const streakHours = Math.round(minsAgo(oldestZero.last_seen as string) / 60 * 10) / 10;
      anomalies.push({
        severity: 'CRITICAL',
        category: 'ZOMBIE_CRON',
        message: `Worker has fired ${recentHeartbeats.length} times across the last ~${streakHours}h and processed ZERO jobs on every run. Cron is alive but the ingestion pipeline is producing nothing.`,
        action: 'This confirms the persistence failure above. The worker runs, fetches some jobs, but writes fail silently. Fix infra-gateway before investigating sources.',
        data: {
          heartbeat_runs_checked: recentHeartbeats.length,
          streak_hours: streakHours,
          last_heartbeat: recentHeartbeats[0]?.last_seen as string,
        },
      });
    }
  }

  return anomalies;
}

/**
 * B. THROUGHPUT ZERO
 *
 * Global: no jobs written to job_pointers in the detection window.
 * Pulled from job_pointers directly (most recent created_at).
 */
function detectThroughputZero(
  latestJob: Row | null,
  windowMinutes: number,
  baseline: BaselineFile
): Anomaly[] {
  const anomalies: Anomaly[] = [];

  if (!latestJob) {
    anomalies.push({
      severity: 'CRITICAL',
      category: 'THROUGHPUT_ZERO',
      message: 'job_pointers table is empty — no jobs have EVER been ingested through this pipeline.',
      action: 'Check Supabase project, table name, and service role key permissions.',
    });
    return anomalies;
  }

  const lastJobMinsAgo = minsAgo(latestJob.created_at as string);
  if (lastJobMinsAgo > windowMinutes) {
    const hoursAgo = Math.round(lastJobMinsAgo / 60 * 10) / 10;
    anomalies.push({
      severity: 'WARNING',
      category: 'THROUGHPUT_ZERO',
      message: `No new jobs have been written to job_pointers in the last ${windowMinutes} minutes. Last ingestion was ${hoursAgo}h ago (${formatRelativeTime(latestJob.created_at as string)}).`,
      action: `Run 'npm run pulse' to confirm. Then run 'npm run simulate greenhouse' to test if the fetch+parse chain works. If it does, the write path (infra-gateway) is the failure point.`,
      data: {
        window_minutes: windowMinutes,
        last_job_at: latestJob.created_at as string,
        elapsed_hours: hoursAgo,
      },
    });
  }

  return anomalies;
}

/**
 * C. SOURCE-LEVEL SILENT FAILURE
 *
 * A source is silently failing if:
 *   - is_active = true
 *   - ran recently (last_run_at within 4h)
 *   - last_insert_count = 0
 *   - jobs_new_7d = 0
 *   - no last_error recorded (so it's not an explicit crash)
 *
 * This catches the case where a source "succeeds" but returns 0 parseable jobs.
 */
function detectSourceSilentFailures(
  sources: Row[],
  baseline: BaselineFile
): Anomaly[] {
  const anomalies: Anomaly[] = [];

  const activeSources = sources.filter(s => s.is_active === true || s.status === 'ACTIVE');

  for (const source of activeSources) {
    const name        = source.source_name as string;
    const ranMinsAgo  = minsAgo(source.last_run_at as string);
    const insertCount = source.last_insert_count as number ?? 0;
    const jobs7d      = source.jobs_new_7d as number ?? 0;
    const avgJobs     = source.avg_jobs_returned as number ?? 0;
    const hasError    = !!(source.last_error as string);
    const consecFails = source.consecutive_failures as number ?? 0;

    // Only flag sources that actually ran recently (within 4h)
    if (ranMinsAgo > 240) continue;

    // Source ran, no error logged, but 0 inserts — silent failure
    if (insertCount === 0 && jobs7d === 0 && !hasError && avgJobs > 0) {
      anomalies.push({
        severity: 'WARNING',
        category: 'SOURCE_SILENT_FAILURE',
        source: name,
        message: `Source ran ${Math.round(ranMinsAgo)}m ago with no error, but produced 0 inserts. Historical avg: ${Math.round(avgJobs)} jobs/run. This is a fetch-that-returns-nothing or parse-that-discards-everything.`,
        action: `Run 'npm run simulate ${name.split(':')[0].toLowerCase()}' to test the fetch+parse chain live. Check if the external API changed its response shape or requires auth.`,
        data: {
          last_run_at:        source.last_run_at as string,
          last_insert_count:  insertCount,
          jobs_new_7d:        jobs7d,
          avg_jobs_returned:  Math.round(avgJobs),
          consecutive_fails:  consecFails,
        },
      });
    }
  }

  return anomalies;
}

/**
 * D. PIPELINE ASYMMETRY (Cursor advances, 0 inserts)
 *
 * If a cursor has advanced (offset > 0) but the corresponding source
 * has never produced any inserts (last_insert_count = 0, jobs_new_7d = 0),
 * then the worker is fetching and advancing pagination but throwing
 * everything away at the write step.
 */
function detectCursorDrift(
  cursors: Row[],
  sources: Row[]
): Anomaly[] {
  const anomalies: Anomaly[] = [];

  // Build a lookup of source → insert_count from source_reliability
  const insertBySource: Record<string, number> = {};
  for (const s of sources) {
    const key = (s.source_name as string).toLowerCase();
    insertBySource[key] = (s.last_insert_count as number) ?? 0;
  }

  for (const cursor of cursors) {
    const sourceName = cursor.source as string;
    const offset     = cursor.cursor_offset as number ?? 0;
    const updatedAt  = cursor.updated_at as string;

    if (offset === 0) continue; // hasn't advanced past page 1
    if (minsAgo(updatedAt) > 120) continue; // stale cursor, not recent

    // Find the matching source entry
    const normalizedName = sourceName.split(':')[0].toLowerCase();
    const insertCount = insertBySource[normalizedName] ??
                        insertBySource[sourceName.toLowerCase()] ?? null;

    if (insertCount !== null && insertCount === 0) {
      anomalies.push({
        severity: 'WARNING',
        category: 'CURSOR_DRIFT',
        source: sourceName,
        message: `Cursor for '${sourceName}' advanced to offset=${offset} (updated ${formatRelativeTime(updatedAt)}), but last_insert_count=0. The fetch is consuming API quota and advancing pagination, but nothing is being written.`,
        action: `This is pipeline asymmetry: fetch succeeds, write fails. Confirm infra-gateway health first. If gateway is up, run 'npm run simulate ${normalizedName}' to check if parsed jobs pass the Zod schema.`,
        data: {
          cursor_offset: offset,
          updated_at:    updatedAt,
          insert_count:  insertCount,
        },
      });
    }
  }

  return anomalies;
}

/**
 * E. DUPLICATE STORM DETECTION
 *
 * If duplicate_rate_last_run > 0.95 for a source that historically
 * produced real jobs, it means the dedup layer is discarding everything —
 * either the fingerprint algorithm changed, or the source isn't producing
 * genuinely new jobs (e.g., the same job posts are being recycled).
 */
function detectDuplicateStorms(
  sources: Row[],
  baseline: BaselineFile
): Anomaly[] {
  const anomalies: Anomaly[] = [];
  const globalDupThreshold = 0.95;

  for (const source of sources) {
    const name       = source.source_name as string;
    const dupRate    = parseFloat(source.duplicate_rate_last_run as string ?? '0');
    const avgJobs    = source.avg_jobs_returned as number ?? 0;
    const ranMinsAgo = minsAgo(source.last_run_at as string);

    if (ranMinsAgo > 120) continue;  // only check recent runs
    if (avgJobs < 5) continue;        // ignore sources with no historical baseline

    const sourceConf = baseline.sources[name.split(':')[0].toLowerCase()];
    const threshold  = sourceConf?.max_duplicate_rate ?? globalDupThreshold;

    if (dupRate >= threshold && dupRate > 0) {
      anomalies.push({
        severity: 'WARNING',
        category: 'DUPLICATE_STORM',
        source: name,
        message: `Duplicate rate last run: ${Math.round(dupRate * 100)}% (threshold: ${Math.round(threshold * 100)}%). This source is fetching jobs but all/most are being discarded as duplicates. Either the source is stale or fingerprinting is broken.`,
        action: 'Check if the source API is returning the same job IDs across paginated requests. If fingerprinting changed, the existing job_pointers rows may need re-fingerprinting.',
        data: {
          duplicate_rate_last_run: dupRate,
          max_allowed:             threshold,
          avg_jobs_returned:       Math.round(avgJobs),
        },
      });
    }
  }

  return anomalies;
}

/**
 * F. NEVER-RAN SOURCES
 *
 * Sources that are ACTIVE in source_reliability but have NEVER
 * produced a single job (last_run_at = null AND last_success_at = null
 * AND jobs_found_7d = 0). These are dead-weight in the pipeline.
 */
function detectNeverRanSources(sources: Row[]): Anomaly[] {
  const anomalies: Anomaly[] = [];

  // Skip sources that are part of the legacy uppercase-tier system
  // (they represent old pipeline configs, not current v3 adapters)
  const LEGACY_SOURCES = new Set([
    'GREENHOUSE', 'LEVER', 'SMARTRECRUITERS', 'JOOBLE_API', 'REED_API',
    'USAJOBS_API', 'FINDWORK_API', 'ARBEITNOW_API', 'REMOTIVE_API',
    'HACKERNEWS', 'HIMALAYAS', 'TEST',
  ]);

  const neverRan = sources.filter(s => {
    const name = (s.source_name as string).toUpperCase();
    if (LEGACY_SOURCES.has(name)) return false;
    return (
      s.is_active === true &&
      !s.last_run_at &&
      !s.last_success_at &&
      (s.jobs_found_7d as number ?? 0) === 0 &&
      (s.jobs_new_7d as number ?? 0) === 0
    );
  });

  if (neverRan.length > 0) {
    const names = neverRan.map(s => s.source_name as string).join(', ');
    anomalies.push({
      severity: 'INFO',
      category: 'SOURCE_NEVER_RAN',
      message: `${neverRan.length} registered sources are ACTIVE but have never run: ${names}`,
      action: `Verify these sources are included in infra/workers/config/sources.ts and have adapters registered in infra/adapters/registry.ts. Run 'npm run preflight:sources' to check.`,
      data: { count: neverRan.length, names: names.slice(0, 120) },
    });
  }

  return anomalies;
}

/**
 * G. STALE WORKER / HEARTBEAT GAP
 *
 * If the most recent worker heartbeat is older than
 * baseline.thresholds.global.cron_stale_after_minutes, the cron may have stopped.
 */
function detectStaleWorker(heartbeats: Row[], baseline: BaselineFile): Anomaly[] {
  const anomalies: Anomaly[] = [];
  const threshold = baseline.thresholds.global.cron_stale_after_minutes;

  if (heartbeats.length === 0) {
    anomalies.push({
      severity: 'CRITICAL',
      category: 'STALE_WORKER',
      message: 'No worker heartbeats found in the database at all. The worker has never reported in, or the table is empty.',
      action: 'Check Cloudflare Worker deployment. Run: npx wrangler tail hiremax-ingestion to see live logs.',
    });
    return anomalies;
  }

  const mostRecent = heartbeats[0];
  const minsAgoVal = minsAgo(mostRecent.last_seen as string);

  if (minsAgoVal > threshold) {
    anomalies.push({
      severity: 'WARNING',
      category: 'STALE_WORKER',
      message: `Most recent heartbeat is ${Math.round(minsAgoVal)}m ago (threshold: ${threshold}m). Expected heartbeat every 30 minutes from the cron schedule.`,
      action: 'Check Cloudflare dashboard → Workers → hiremax-ingestion → Cron Triggers. Confirm the cron is not paused. Run: npx wrangler tail hiremax-ingestion',
      data: {
        last_heartbeat:  mostRecent.last_seen as string,
        elapsed_minutes: Math.round(minsAgoVal),
        threshold_minutes: threshold,
        service_name:    mostRecent.service_name as string,
      },
    });
  }

  return anomalies;
}

// ─── MAIN ORCHESTRATOR ────────────────────────────────────────────────────────

async function main() {
  console.log('\n  Loading baseline and environment...');

  const env = loadEnv();
  const supabaseUrl = env['SUPABASE_URL'];
  const serviceKey  = env['SUPABASE_SERVICE_ROLE_KEY'];

  if (!supabaseUrl || !serviceKey) {
    console.error('\n  ✗ FATAL: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing from .env');
    process.exit(1);
  }

  const baseline     = loadBaseline();
  const windowMins   = parseWindow();
  const collectedAt  = new Date();

  console.log(`  Supabase: ${supabaseUrl}`);
  console.log(`  Detection window: last ${windowMins} minutes`);
  console.log(`  Fetching data from 4 tables...\n`);

  // ─── FETCH ALL DATA IN PARALLEL ──────────────────────────────────────────────
  let sources:    Row[] = [];
  let heartbeats: Row[] = [];
  let cursors:    Row[] = [];
  let latestJob:  Row | null = null;
  let runs:       Row[] = [];

  const [srcResult, hbResult, cursorResult, jobResult, runResult] = await Promise.allSettled([
    supabaseQuery(supabaseUrl, serviceKey, 'source_reliability',
      'source_name,status,is_active,consecutive_failures,failure_count,last_insert_count,avg_duplicate_rate,duplicate_rate_last_run,last_success_at,last_run_at,last_error,jobs_found_7d,jobs_new_7d,error_rate_pct,avg_jobs_returned',
      'order=last_run_at.desc.nullslast'),
    supabaseQuery(supabaseUrl, serviceKey, 'worker_heartbeat',
      'service_name,last_seen,jobs_processed,exit_reason,metadata',
      'order=last_seen.desc&limit=20'),
    supabaseQuery(supabaseUrl, serviceKey, 'cursors',
      'source,cursor_offset,updated_at',
      'order=updated_at.desc&limit=50'),
    supabaseQuery(supabaseUrl, serviceKey, 'job_pointers',
      'source_type,created_at',
      'order=created_at.desc&limit=1'),
    supabaseQuery(supabaseUrl, serviceKey, 'ingestion_runs',
      'status,started_at,completed_at,summary',
      'order=started_at.desc&limit=20'),
  ]);

  if (srcResult.status === 'fulfilled')    sources    = srcResult.value;
  else console.warn(`  ⚠ source_reliability query failed: ${srcResult.reason}`);

  if (hbResult.status === 'fulfilled')     heartbeats = hbResult.value;
  else console.warn(`  ⚠ worker_heartbeat query failed: ${hbResult.reason}`);

  if (cursorResult.status === 'fulfilled') cursors    = cursorResult.value;
  else console.warn(`  ⚠ cursors query failed: ${cursorResult.reason}`);

  if (jobResult.status === 'fulfilled')    latestJob  = jobResult.value[0] ?? null;
  else console.warn(`  ⚠ job_pointers query failed: ${jobResult.reason}`);

  if (runResult.status === 'fulfilled')    runs = runResult.value;
  else console.warn(`  ⚠ ingestion_runs query failed: ${runResult.reason}`);

  // ─── RUN ALL DETECTORS ───────────────────────────────────────────────────────
  const anomalies: Anomaly[] = [
    ...detectPersistenceFailure(sources, heartbeats, runs, baseline),
    ...detectThroughputZero(latestJob, windowMins, baseline),
    ...detectSourceSilentFailures(sources, baseline),
    ...detectCursorDrift(cursors, sources),
    ...detectDuplicateStorms(sources, baseline),
    ...detectNeverRanSources(sources),
    ...detectStaleWorker(heartbeats, baseline),
  ];

  // ─── INFO: Quick stats ───────────────────────────────────────────────────────
  if (latestJob) {
    anomalies.push({
      severity:  'INFO',
      category:  'INFO' as any,
      message:   `Last job written: ${formatRelativeTime(latestJob.created_at as string)} (source_type=${latestJob.source_type})`,
      action:    'No action needed.',
    });
  }

  if (heartbeats.length > 0) {
    const zerosInRow = heartbeats.filter(h => (h.jobs_processed as number) === 0).length;
    anomalies.push({
      severity:  'INFO',
      category:  'INFO' as any,
      message:   `Last ${heartbeats.length} heartbeats: ${zerosInRow}/${heartbeats.length} processed 0 jobs. Most recent: ${formatRelativeTime(heartbeats[0].last_seen as string)}`,
      action:    zerosInRow === heartbeats.length ? 'Every run is zero — persistence layer is the bottleneck.' : 'Monitor trend.',
    });
  }

  // ─── RENDER REPORT ───────────────────────────────────────────────────────────
  const { hasCritical } = renderReport(anomalies, collectedAt);

  process.exit(hasCritical ? 1 : 0);
}

main().catch(err => {
  console.error('\n  ✗ COVERAGE ENGINE CRASHED:', err.message);
  process.exit(1);
});
