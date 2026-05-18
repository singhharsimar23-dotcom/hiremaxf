/**
 * worker/src/intelligence/signal-detector.ts
 *
 * Session S28 — Signal Detector
 * Called by index.ts every 6 hours via runSignalDetector(env).
 *
 * No external APIs — internal job_pointers + company_pre_signals data only.
 * External integrations are marked TODO referencing Section 15.
 *
 * Signal Types Implemented:
 *   headcount_growth  — job posting velocity vs 4-week rolling avg
 *   tech_adoption     — new tech stack items not seen in prior 4 weeks
 *   exec_hire         — staff/lead postings this week, none in prior 3 weeks
 *   funding           — RESERVED / STUB — not implemented (Section 15 open question)
 *
 * CRITICAL RULES:
 *   - Never throw from runSignalDetector — entire body in try/catch
 *   - signal_strength is ALWAYS float 0.0–1.0; never store > 1.0
 *   - Date arithmetic: always Date.now() + milliseconds, never string date math
 *   - intel:hidden-opps:feed is ALWAYS written to KV, even when 0 signals
 *   - Deduplication window: 48 hours
 *   - Confirmed signal update: PATCH (not INSERT)
 */

import { Env } from '../config/env';
import { getClient } from '../infra/db';
import { set } from '../infra/kv';
import { CompanySignal } from '../types/intelligence';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Clamp a number to [0, 1] and round to 2 decimal places. */
function clampStrength(val: number): number {
  const clamped = Math.max(0, Math.min(1, val));
  return Math.round(clamped * 100) / 100;
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface DetectedSignal {
  company: string;
  signal_type: CompanySignal['signal_type'];
  signal_strength: number; // pre-clamped
}

interface SignalFeedItem {
  company: string;
  signal_type: string;
  signal_strength: number;
  detected_at: string;
  predicted_window_start: string;
  predicted_window_end: string;
  confirmed: boolean;
}

// ---------------------------------------------------------------------------
// Step 1A — headcount_growth
// ---------------------------------------------------------------------------

async function detectHeadcountGrowth(
  db: ReturnType<typeof getClient>,
  now: Date
): Promise<DetectedSignal[]> {
  // TODO (Section 15): supplement with LinkedIn/PDL headcount delta API.

  const nowMs = now.getTime();
  const sevenDaysAgoISO = new Date(nowMs - 7 * 86_400_000).toISOString();
  const twentyEightDaysAgoISO = new Date(nowMs - 28 * 86_400_000).toISOString();

  // This-week postings: first_seen_at >= -7d, job_state = 'active'
  // We fetch company + count, filter HAVING count >= 3 in-memory.
  const { data: thisWeekRows, error: errA } = await db
    .from('job_pointers')
    .select('company_slug, company_name')
    .eq('job_state', 'active')
    .gte('first_seen_at', sevenDaysAgoISO);

  if (errA) {
    console.error('[signal-detector] headcount_growth this-week query failed:', errA.message);
    return [];
  }

  // Aggregate this-week count per company slug
  const thisWeekMap = new Map<string, { count: number; name: string }>();
  for (const row of thisWeekRows ?? []) {
    const slug = row.company_slug ?? '';
    if (!slug) continue;
    const existing = thisWeekMap.get(slug);
    if (existing) {
      existing.count++;
    } else {
      thisWeekMap.set(slug, { count: 1, name: row.company_name ?? slug });
    }
  }

  // Rolling 4-week window: first_seen_at in [-28d, -7d], states: active, cooling, disappeared
  const { data: rollingRows, error: errB } = await db
    .from('job_pointers')
    .select('company_slug')
    .in('job_state', ['active', 'cooling', 'disappeared'])
    .gte('first_seen_at', twentyEightDaysAgoISO)
    .lt('first_seen_at', sevenDaysAgoISO);

  if (errB) {
    console.error('[signal-detector] headcount_growth rolling query failed:', errB.message);
    // Proceed — rolling defaults to 0 (max divisor = 1 per spec)
  }

  const rollingMap = new Map<string, number>();
  for (const row of rollingRows ?? []) {
    const slug = row.company_slug ?? '';
    if (!slug) continue;
    rollingMap.set(slug, (rollingMap.get(slug) ?? 0) + 1);
  }

  const signals: DetectedSignal[] = [];

  for (const [slug, { count: thisWeekCount, name }] of thisWeekMap) {
    // HAVING COUNT >= 3 — minimum postings threshold before evaluating velocity
    if (thisWeekCount < 3) continue;

    const rollingTotal = rollingMap.get(slug) ?? 0;
    // rolling avg = total / 4 weeks; max(rolling, 1) to avoid div-by-zero
    const rollingAvg = rollingTotal / 4;
    const velocityRatio = thisWeekCount / Math.max(rollingAvg, 1);

    // Threshold: velocity_ratio >= 2.0 AND this_week_count >= 5
    if (velocityRatio >= 2.0 && thisWeekCount >= 5) {
      // strength = min(1.0, velocity_ratio / 5)
      const raw = velocityRatio / 5;
      signals.push({
        company: name,
        signal_type: 'headcount_growth',
        signal_strength: clampStrength(raw),
      });
    }
  }

  return signals;
}

// ---------------------------------------------------------------------------
// Step 1B — tech_adoption
// ---------------------------------------------------------------------------

async function detectTechAdoption(
  db: ReturnType<typeof getClient>,
  now: Date
): Promise<DetectedSignal[]> {
  // TODO (Section 15): supplement with GitHub repo activity analysis.

  const nowMs = now.getTime();
  const sevenDaysAgoISO = new Date(nowMs - 7 * 86_400_000).toISOString();
  const twentyEightDaysAgoISO = new Date(nowMs - 28 * 86_400_000).toISOString();

  // Current week tech stacks (last 7 days)
  const { data: currentRows, error: errCurr } = await db
    .from('job_pointers')
    .select('company_slug, company_name, tech_stack')
    .gte('first_seen_at', sevenDaysAgoISO);

  if (errCurr) {
    console.error('[signal-detector] tech_adoption current query failed:', errCurr.message);
    return [];
  }

  // Prior tech stacks (8–28 days ago)
  const { data: priorRows, error: errPrior } = await db
    .from('job_pointers')
    .select('company_slug, tech_stack')
    .gte('first_seen_at', twentyEightDaysAgoISO)
    .lt('first_seen_at', sevenDaysAgoISO);

  if (errPrior) {
    console.error('[signal-detector] tech_adoption prior query failed:', errPrior.message);
    // Non-fatal — prior set will be empty, so everything is "new"
    // We still proceed but results may be noisy. Acceptable per spec.
  }

  // Build per-company prior tech set
  const priorTechMap = new Map<string, Set<string>>();
  for (const row of priorRows ?? []) {
    const slug = row.company_slug ?? '';
    if (!slug) continue;
    const tech: string[] = Array.isArray(row.tech_stack) ? row.tech_stack : [];
    if (!priorTechMap.has(slug)) priorTechMap.set(slug, new Set());
    for (const t of tech) priorTechMap.get(slug)!.add(t.toLowerCase());
  }

  // Build per-company current tech set + name lookup
  const currentTechMap = new Map<string, { tech: Set<string>; name: string }>();
  for (const row of currentRows ?? []) {
    const slug = row.company_slug ?? '';
    if (!slug) continue;
    const tech: string[] = Array.isArray(row.tech_stack) ? row.tech_stack : [];
    if (!currentTechMap.has(slug)) {
      currentTechMap.set(slug, { tech: new Set(), name: row.company_name ?? slug });
    }
    for (const t of tech) currentTechMap.get(slug)!.tech.add(t.toLowerCase());
  }

  const signals: DetectedSignal[] = [];

  for (const [slug, { tech: currentTech, name }] of currentTechMap) {
    const priorTech = priorTechMap.get(slug) ?? new Set<string>();
    // new_tech = Set(current) - Set(prior)
    const newTech = new Set<string>();
    for (const t of currentTech) {
      if (!priorTech.has(t)) newTech.add(t);
    }

    // Threshold: new_tech.size >= 2
    if (newTech.size >= 2) {
      // strength = min(1.0, new_tech.size / 10)
      const raw = newTech.size / 10;
      signals.push({
        company: name,
        signal_type: 'tech_adoption',
        signal_strength: clampStrength(raw),
      });
    }
  }

  return signals;
}

// ---------------------------------------------------------------------------
// Step 1C — exec_hire
// ---------------------------------------------------------------------------

async function detectExecHire(
  db: ReturnType<typeof getClient>,
  now: Date
): Promise<DetectedSignal[]> {
  // TODO (Section 15): supplement with LinkedIn executive announcement scraping.

  const nowMs = now.getTime();
  const sevenDaysAgoISO = new Date(nowMs - 7 * 86_400_000).toISOString();
  const twentyOneDaysAgoISO = new Date(nowMs - 21 * 86_400_000).toISOString();

  // Companies with staff/lead postings this week
  const { data: thisWeekRows, error: errThis } = await db
    .from('job_pointers')
    .select('company_slug, company_name')
    .in('seniority_band', ['staff', 'lead'])
    .gte('first_seen_at', sevenDaysAgoISO);

  if (errThis) {
    console.error('[signal-detector] exec_hire this-week query failed:', errThis.message);
    return [];
  }

  // Build set of companies with staff/lead this week
  const thisWeekCompanies = new Map<string, string>(); // slug -> name
  for (const row of thisWeekRows ?? []) {
    const slug = row.company_slug ?? '';
    if (!slug) continue;
    thisWeekCompanies.set(slug, row.company_name ?? slug);
  }

  if (thisWeekCompanies.size === 0) return [];

  // Companies with staff/lead in prior 3 weeks ([-21d, -7d])
  const { data: priorRows, error: errPrior } = await db
    .from('job_pointers')
    .select('company_slug')
    .in('seniority_band', ['staff', 'lead'])
    .gte('first_seen_at', twentyOneDaysAgoISO)
    .lt('first_seen_at', sevenDaysAgoISO);

  if (errPrior) {
    console.error('[signal-detector] exec_hire prior query failed:', errPrior.message);
    // Non-fatal — prior set empty means all this-week companies qualify
  }

  const priorCompanies = new Set<string>();
  for (const row of priorRows ?? []) {
    const slug = row.company_slug ?? '';
    if (slug) priorCompanies.add(slug);
  }

  // Signal: this week has exec postings, but NOT in prior 3 weeks
  const signals: DetectedSignal[] = [];
  for (const [slug, name] of thisWeekCompanies) {
    if (!priorCompanies.has(slug)) {
      signals.push({
        company: name,
        signal_type: 'exec_hire',
        signal_strength: 0.6, // fixed per spec
      });
    }
  }

  return signals;
}

// ---------------------------------------------------------------------------
// Step 1D — funding (STUB — RESERVED, not implemented)
// ---------------------------------------------------------------------------
// TODO (Section 15 open question): Integrate Crunchbase or similar funding API
// to detect funding rounds and emit 'funding' signal_type rows.
// NO placeholder inserts are created for this signal type.
// This function intentionally returns an empty array.
function detectFunding(): DetectedSignal[] {
  return [];
}

// ---------------------------------------------------------------------------
// Step 2 — Deduplication (48-hour window)
// ---------------------------------------------------------------------------

async function filterDuplicates(
  db: ReturnType<typeof getClient>,
  signals: DetectedSignal[],
  now: Date
): Promise<DetectedSignal[]> {
  if (signals.length === 0) return [];

  // 48-hour window — per spec (not 24h, not 7d)
  const windowStart = new Date(now.getTime() - 48 * 3600_000).toISOString();

  const { data: existingRows, error } = await db
    .from('company_pre_signals')
    .select('company, signal_type')
    .gte('detected_at', windowStart);

  if (error) {
    console.error('[signal-detector] dedup query failed:', error.message);
    // On dedup failure, allow all signals through rather than silently dropping
    return signals;
  }

  // Build set of (company, signal_type) pairs already in DB within 48h
  const existingSet = new Set<string>();
  for (const row of existingRows ?? []) {
    existingSet.add(`${row.company}|${row.signal_type}`);
  }

  return signals.filter((s) => !existingSet.has(`${s.company}|${s.signal_type}`));
}

// ---------------------------------------------------------------------------
// Step 3 — Insert new signals
// ---------------------------------------------------------------------------

async function insertSignals(
  db: ReturnType<typeof getClient>,
  signals: DetectedSignal[],
  now: Date
): Promise<{ inserted: number }> {
  let inserted = 0;
  const detectedAt = now.toISOString();
  const windowStart = new Date(now.getTime() + 7 * 86_400_000).toISOString();   // +7d
  const windowEnd = new Date(now.getTime() + 35 * 86_400_000).toISOString();    // +35d

  for (const sig of signals) {
    try {
      const payload = {
        company: sig.company,
        signal_type: sig.signal_type,
        signal_strength: clampStrength(sig.signal_strength), // always clamped [0,1], 2 dec
        source: 'internal:job_patterns',
        detected_at: detectedAt,
        predicted_window_start: windowStart,
        predicted_window_end: windowEnd,
        confirmed: false,
      };

      const { error } = await db.from('company_pre_signals').insert(payload);
      if (error) {
        // Per-signal error → log, continue; never abort
        console.error(
          `[signal-detector] insert error company=${sig.company} type=${sig.signal_type}:`,
          error.message
        );
      } else {
        inserted++;
      }
    } catch (e) {
      // Never throw from per-signal insert
      console.error(
        `[signal-detector] insert threw company=${sig.company} type=${sig.signal_type}:`,
        e
      );
    }
  }

  return { inserted };
}

// ---------------------------------------------------------------------------
// Step 4 — Mark confirmed signals (PATCH, not INSERT)
// ---------------------------------------------------------------------------

async function confirmSignals(
  db: ReturnType<typeof getClient>,
  now: Date
): Promise<{ confirmed: number }> {
  const nowISO = now.toISOString();

  // Unconfirmed signals where now() is within the predicted window
  const { data: unconfirmedRows, error: errFetch } = await db
    .from('company_pre_signals')
    .select('id, company, detected_at')
    .eq('confirmed', false)
    .lte('predicted_window_start', nowISO)
    .gte('predicted_window_end', nowISO);

  if (errFetch) {
    console.error('[signal-detector] confirm fetch failed:', errFetch.message);
    return { confirmed: 0 };
  }

  let confirmed = 0;

  for (const row of unconfirmedRows ?? []) {
    try {
      // Check if job_pointers has an active job from that company since detected_at
      const { data: activeJobs, error: errJobs } = await db
        .from('job_pointers')
        .select('id', { count: 'exact', head: true })
        .eq('company_name', row.company)
        .eq('job_state', 'active')
        .gte('first_seen_at', row.detected_at);

      if (errJobs) {
        console.error(
          `[signal-detector] confirm job check failed company=${row.company}:`,
          errJobs.message
        );
        continue;
      }

      // If count > 0 → PATCH confirmed = true (not INSERT — per spec)
      const count = (activeJobs as any)?.length ?? 0;
      if (count > 0) {
        const { error: errPatch } = await db
          .from('company_pre_signals')
          .update({ confirmed: true })
          .eq('id', row.id);

        if (errPatch) {
          console.error(
            `[signal-detector] confirm patch failed id=${row.id}:`,
            errPatch.message
          );
        } else {
          confirmed++;
        }
      }
    } catch (e) {
      console.error(`[signal-detector] confirm threw for id=${row.id}:`, e);
    }
  }

  return { confirmed };
}

// ---------------------------------------------------------------------------
// Step 5 — Write intel:hidden-opps:feed to KV
// ---------------------------------------------------------------------------

async function writeFeed(
  db: ReturnType<typeof getClient>,
  env: Env,
  now: Date
): Promise<{ feedSize: number }> {
  const sevenDaysAgoISO = new Date(now.getTime() - 7 * 86_400_000).toISOString();

  // Query: last 7 days, signal_strength >= 0.4, ORDER BY signal_strength DESC, LIMIT 50
  const { data: feedRows, error } = await db
    .from('company_pre_signals')
    .select('company, signal_type, signal_strength, detected_at, predicted_window_start, predicted_window_end, confirmed')
    .gte('detected_at', sevenDaysAgoISO)
    .gte('signal_strength', 0.4)
    .order('signal_strength', { ascending: false })
    .limit(50);

  if (error) {
    console.error('[signal-detector] feed query failed:', error.message);
    // Still write empty feed — per spec: ALWAYS write, even if 0 signals
  }

  const signals: SignalFeedItem[] = (feedRows ?? []).map((r) => ({
    company: r.company,
    signal_type: r.signal_type,
    signal_strength: r.signal_strength,
    detected_at: r.detected_at,
    predicted_window_start: r.predicted_window_start,
    predicted_window_end: r.predicted_window_end,
    confirmed: r.confirmed,
  }));

  const feed = {
    signals,
    generated_at: now.toISOString(),
    total: signals.length,
    note: 'Internal signals only. External API integrations pending (Section 15).',
  };

  // ALWAYS write to KV, even when signals array is empty. TTL = 1 hour.
  // qualityScore param intentionally omitted (intelligence always writes).
  await set(env, 'intel:hidden-opps:feed', feed, 3600);

  return { feedSize: signals.length };
}

// ---------------------------------------------------------------------------
// Main export — matches the name called by index.ts
// ---------------------------------------------------------------------------

export async function runSignalDetector(env: Env): Promise<void> {
  try {
    const now = new Date();
    const db = getClient(env);

    // -------------------------------------------------------------------------
    // Step 1 — Detect internal signals
    // -------------------------------------------------------------------------

    // Signal A: headcount_growth
    const headcountSignals = await detectHeadcountGrowth(db, now);

    // Signal B: tech_adoption
    const techSignals = await detectTechAdoption(db, now);

    // Signal C: exec_hire
    const execSignals = await detectExecHire(db, now);

    // Signal D: funding — STUB (not implemented, see TODO Section 15)
    const fundingSignals = detectFunding();

    const allDetected = [
      ...headcountSignals,
      ...techSignals,
      ...execSignals,
      ...fundingSignals, // always []
    ];

    const totalDetected = allDetected.length;

    // -------------------------------------------------------------------------
    // Step 2 — Deduplication (48-hour window — not 24h, not 7d)
    // -------------------------------------------------------------------------

    const dedupedSignals = await filterDuplicates(db, allDetected, now);

    // -------------------------------------------------------------------------
    // Step 3 — Insert new signals
    // -------------------------------------------------------------------------

    const { inserted } = await insertSignals(db, dedupedSignals, now);

    // -------------------------------------------------------------------------
    // Step 4 — Mark confirmed signals (PATCH, not INSERT)
    // -------------------------------------------------------------------------

    const { confirmed } = await confirmSignals(db, now);

    // -------------------------------------------------------------------------
    // Step 5 — Write intel:hidden-opps:feed to KV (always, even if empty)
    // -------------------------------------------------------------------------

    const { feedSize } = await writeFeed(db, env, now);

    // -------------------------------------------------------------------------
    // Step 6 — Log completion
    // -------------------------------------------------------------------------

    console.log(
      `[signal-detector] complete signals_detected=${totalDetected} signals_inserted=${inserted} signals_confirmed=${confirmed} feed_size=${feedSize}`
    );
  } catch (err) {
    // NEVER THROWS — entire body wrapped. Log and return.
    console.error('[signal-detector] Fatal error (suppressed):', err);
  }
}

// ---------------------------------------------------------------------------
// Alias — per spec header (runSignalDetectorJob) for any future callers
// ---------------------------------------------------------------------------
export { runSignalDetector as runSignalDetectorJob };
