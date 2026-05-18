/**
 * worker/src/intelligence/pattern-engine.ts
 *
 * Session S27 — Pattern Engine
 * Called by index.ts at 02:00 UTC daily via runPatternEngineJob(env).
 *
 * CRITICAL INVARIANT: all active-job queries use job_state = 'active' ONLY.
 * Never 'cooling'. Never 'disappeared'. Counting cooling as active inflates demand_score.
 *
 * KV writes from this module ALWAYS omit qualityScore param (intelligence always writes).
 */

import { Env } from '../config/env';
import { getClient } from '../infra/db';
import { set } from '../infra/kv';
import { PatternSnapshot } from '../types/intelligence';

// ---------------------------------------------------------------------------
// Step 1 — Compute snapshot_week (current week's Sunday date, YYYY-MM-DD)
// ---------------------------------------------------------------------------

function getSundayDate(now: Date): string {
  const dayOfWeek = now.getUTCDay(); // 0 = Sunday
  const sunday = new Date(now);
  sunday.setUTCDate(now.getUTCDate() - dayOfWeek);
  sunday.setUTCHours(0, 0, 0, 0);
  const y = sunday.getUTCFullYear();
  const m = String(sunday.getUTCMonth() + 1).padStart(2, '0');
  const d = String(sunday.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ---------------------------------------------------------------------------
// Score helpers
// ---------------------------------------------------------------------------

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function round(val: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(val * factor) / factor;
}

// ---------------------------------------------------------------------------
// Batch upsert helper (batches of 20, continues on per-group error)
// ---------------------------------------------------------------------------

async function batchUpsertPatterns(
  env: Env,
  rows: PatternSnapshot[]
): Promise<void> {
  const BATCH = 20;
  const db = getClient(env);

  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH);
    for (const row of slice) {
      try {
        const { error } = await db
          .from('role_patterns')
          .upsert(row, {
            onConflict: 'role,seniority,location,snapshot_week',
          });
        if (error) {
          console.error(
            `[pattern-engine] upsert error role=${row.role} seniority=${row.seniority} location=${row.location}:`,
            error.message
          );
        }
      } catch (e) {
        console.error(
          `[pattern-engine] upsert threw role=${row.role} seniority=${row.seniority} location=${row.location}:`,
          e
        );
        // Never abort — continue with next row
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function runPatternEngineJob(env: Env): Promise<void> {
  try {
    const now = new Date();
    const snapshotWeek = getSundayDate(now);

    // Sunday midnight UTC (start of this week)
    const sundayMs =
      now.getTime() - now.getUTCDay() * 86400_000 -
      ((now.getUTCHours() * 3600 + now.getUTCMinutes() * 60 + now.getUTCSeconds()) * 1000 +
        now.getUTCMilliseconds());
    const sundayISO = new Date(sundayMs).toISOString();

    // Start of 28-day rolling window
    const rollingStartISO = new Date(sundayMs - 28 * 86400_000).toISOString();

    const db = getClient(env);

    // -----------------------------------------------------------------------
    // Step 2 — Four queries
    // -----------------------------------------------------------------------

    // Query A — active job groups (job_state = 'active' ONLY)
    // Columns: role_category, seniority_band, location_name,
    //          total_postings (count), avg_salary_min, zombie_count
    const { data: queryA, error: errA } = await db
      .from('job_pointers')
      .select(
        'role_category, seniority_band, location_name, salary_min, job_state'
      )
      .eq('job_state', 'active'); // CRITICAL: active ONLY

    if (errA) {
      console.error('[pattern-engine] Query A failed:', errA.message);
      return;
    }

    // Query B — fills this week (disappeared this week)
    // job_state = 'disappeared', disappeared_at in [sundayISO, now)
    const { data: queryB, error: errB } = await db
      .from('job_pointers')
      .select('role_category, seniority_band, location_name, disappeared_at')
      .eq('job_state', 'disappeared')
      .gte('disappeared_at', sundayISO)
      .lt('disappeared_at', now.toISOString());

    if (errB) {
      console.error('[pattern-engine] Query B failed:', errB.message);
      // Non-fatal — proceed with empty fills
    }

    // Query C — 4-week rolling average postings per group (active jobs, first_seen_at in [rollingStart, sunday))
    const { data: queryC, error: errC } = await db
      .from('job_pointers')
      .select('role_category, seniority_band, location_name, first_seen_at')
      .eq('job_state', 'active') // CRITICAL: active ONLY
      .gte('first_seen_at', rollingStartISO)
      .lt('first_seen_at', sundayISO);

    if (errC) {
      console.error('[pattern-engine] Query C failed:', errC.message);
    }

    // Query D — 4-week rolling average salary per group (same window, salary_min IS NOT NULL)
    const { data: queryD, error: errD } = await db
      .from('job_pointers')
      .select('role_category, seniority_band, location_name, salary_min')
      .eq('job_state', 'active') // CRITICAL: active ONLY
      .gte('first_seen_at', rollingStartISO)
      .lt('first_seen_at', sundayISO)
      .not('salary_min', 'is', null);

    if (errD) {
      console.error('[pattern-engine] Query D failed:', errD.message);
    }

    // -----------------------------------------------------------------------
    // Step 3 — Build group-keyed maps
    // -----------------------------------------------------------------------

    type GroupKey = string; // '${role}|${seniority}|${location}'

    function groupKey(role: string, seniority: string, location: string): GroupKey {
      return `${role}|${seniority}|${location}`;
    }

    // --- Map A: aggregate active jobs ---
    interface GroupA {
      total_postings: number;
      salary_mins: number[];
      zombie_count: number; // zombie jobs counted from job_state perspective
    }

    const mapA = new Map<GroupKey, GroupA>();

    // Query A covers job_state='active'; zombies are a sub-state represented as
    // job_state='zombie' in the type system, but per the spec zombie_count is
    // jobs that have been reposted (job_state='zombie'). We fetch zombie count
    // in a separate lightweight query below.
    for (const row of queryA ?? []) {
      const k = groupKey(row.role_category ?? '', row.seniority_band ?? '', row.location_name ?? '');
      if (!mapA.has(k)) {
        mapA.set(k, { total_postings: 0, salary_mins: [], zombie_count: 0 });
      }
      const entry = mapA.get(k)!;
      entry.total_postings++;
      if (row.salary_min != null) {
        entry.salary_mins.push(row.salary_min);
      }
    }

    // Query A-zombie: count zombie jobs per group (job_state='zombie')
    const { data: queryAZ } = await db
      .from('job_pointers')
      .select('role_category, seniority_band, location_name')
      .eq('job_state', 'zombie');

    for (const row of queryAZ ?? []) {
      const k = groupKey(row.role_category ?? '', row.seniority_band ?? '', row.location_name ?? '');
      // Add zombie count to the group (may not exist in mapA if no active jobs in that group)
      if (mapA.has(k)) {
        mapA.get(k)!.zombie_count++;
      }
    }

    // Filter: HAVING COUNT >= 3 (groups with fewer than 3 active postings are excluded)
    for (const [k, v] of mapA) {
      if (v.total_postings < 3) mapA.delete(k);
    }

    // --- Map B: fills this week ---
    interface GroupB {
      total_fills: number;
      days_to_fill: number[];
      fast_fill_count: number; // fills within 7 days
    }

    const mapB = new Map<GroupKey, GroupB>();

    // We need avg_days_to_fill — compute from first_seen_at vs disappeared_at.
    // Query B doesn't include first_seen_at; fetch it.
    const { data: queryBFull } = await db
      .from('job_pointers')
      .select(
        'role_category, seniority_band, location_name, disappeared_at, first_seen_at'
      )
      .eq('job_state', 'disappeared')
      .gte('disappeared_at', sundayISO)
      .lt('disappeared_at', now.toISOString());

    for (const row of queryBFull ?? []) {
      const k = groupKey(row.role_category ?? '', row.seniority_band ?? '', row.location_name ?? '');
      if (!mapB.has(k)) {
        mapB.set(k, { total_fills: 0, days_to_fill: [], fast_fill_count: 0 });
      }
      const entry = mapB.get(k)!;
      entry.total_fills++;

      if (row.first_seen_at && row.disappeared_at) {
        const days = Math.max(
          0,
          (new Date(row.disappeared_at).getTime() - new Date(row.first_seen_at).getTime()) /
            86400_000
        );
        entry.days_to_fill.push(days);
        if (days <= 7) entry.fast_fill_count++;
      }
    }

    // --- Map C: 4-week rolling average postings ---
    interface GroupC {
      weekly_counts: Map<string, number>; // ISO week -> count
      total: number;
    }

    const mapC = new Map<GroupKey, GroupC>();

    for (const row of queryC ?? []) {
      const k = groupKey(row.role_category ?? '', row.seniority_band ?? '', row.location_name ?? '');
      if (!mapC.has(k)) {
        mapC.set(k, { weekly_counts: new Map(), total: 0 });
      }
      const entry = mapC.get(k)!;
      entry.total++;
    }

    // rolling avg = total / 4 weeks
    function getRollingAvgPostings(k: GroupKey): number {
      const entry = mapC.get(k);
      if (!entry || entry.total === 0) return 0;
      return entry.total / 4;
    }

    // --- Map D: 4-week rolling average salary ---
    const mapD = new Map<GroupKey, number[]>();

    for (const row of queryD ?? []) {
      const k = groupKey(row.role_category ?? '', row.seniority_band ?? '', row.location_name ?? '');
      if (!mapD.has(k)) mapD.set(k, []);
      if (row.salary_min != null) mapD.get(k)!.push(row.salary_min);
    }

    function getRollingAvgSalaryMin(k: GroupKey): number {
      const vals = mapD.get(k);
      if (!vals || vals.length === 0) return 0;
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    }

    // -----------------------------------------------------------------------
    // Steps 4–5 — Compute scores and upsert
    // -----------------------------------------------------------------------

    const patternRows: PatternSnapshot[] = [];

    for (const [k, a] of mapA) {
      const [role, seniority, location] = k.split('|');

      const b = mapB.get(k);
      const rollingAvgPostings = getRollingAvgPostings(k);
      const rollingAvgSalaryMin = getRollingAvgSalaryMin(k);

      const total_postings = a.total_postings;
      const total_fills = b?.total_fills ?? 0;
      const zombie_count = a.zombie_count;
      const fast_fill_count = b?.fast_fill_count ?? 0;
      const days_to_fill = b?.days_to_fill ?? [];

      const avg_salary_min =
        a.salary_mins.length > 0
          ? a.salary_mins.reduce((acc, v) => acc + v, 0) / a.salary_mins.length
          : undefined;

      // demand_score = total_postings / max(rollingAvg, 1), clamped [0,10], 2 decimals
      const demand_score = round(
        clamp(total_postings / Math.max(rollingAvgPostings, 1), 0, 10),
        2
      );

      // competition_score = total_postings / max(total_fills, 1), clamped [0,20], 2 decimals
      const competition_score = round(
        clamp(total_postings / Math.max(total_fills, 1), 0, 20),
        2
      );

      // salary_drift = (avg_salary_min - rollingAvgMin) / max(rollingAvgMin, 1), 4 decimals
      const salary_drift =
        avg_salary_min !== undefined
          ? round(
              (avg_salary_min - rollingAvgSalaryMin) / Math.max(rollingAvgSalaryMin, 1),
              4
            )
          : undefined;

      // repost_rate = zombie_count / max(total_postings, 1), 4 decimals
      const repost_rate = round(zombie_count / Math.max(total_postings, 1), 4);

      // fast_fill_rate = fast_fill_count / max(total_fills, 1), 4 decimals
      const fast_fill_rate = round(
        fast_fill_count / Math.max(total_fills, 1),
        4
      );

      // expiry_risk_score = (1 - fast_fill_rate) * (demand_score / 10), clamped [0,1], 4 decimals
      const expiry_risk_score = round(
        clamp((1 - fast_fill_rate) * (demand_score / 10), 0, 1),
        4
      );

      const avg_days_to_fill =
        days_to_fill.length > 0
          ? days_to_fill.reduce((a, b) => a + b, 0) / days_to_fill.length
          : undefined;

      const row: PatternSnapshot = {
        role,
        seniority,
        location,
        snapshot_week: snapshotWeek,
        total_postings,
        total_fills,
        demand_score,
        competition_score,
        repost_rate,
        fast_fill_rate,
        expiry_risk_score,
        ...(avg_salary_min !== undefined && { avg_salary_min }),
        ...(salary_drift !== undefined && { salary_drift }),
        ...(avg_days_to_fill !== undefined && { avg_days_to_fill }),
      };

      patternRows.push(row);
    }

    await batchUpsertPatterns(env, patternRows);
    console.log(
      `[pattern-engine] Upserted ${patternRows.length} pattern rows for snapshot_week=${snapshotWeek}`
    );

    // -----------------------------------------------------------------------
    // Step 6 — KV Cache Keys
    // -----------------------------------------------------------------------

    // --- intel:timing:{role} — 6 hours ---
    // Group by role across all locations/seniorities; pick best timing window
    const roleTimingMap = new Map<
      string,
      {
        demand_score: number;
        expiry_risk_score: number;
        competition_score: number;
        locations: string[];
      }
    >();

    for (const row of patternRows) {
      const existing = roleTimingMap.get(row.role);
      if (!existing || row.demand_score > existing.demand_score) {
        roleTimingMap.set(row.role, {
          demand_score: row.demand_score,
          expiry_risk_score: row.expiry_risk_score,
          competition_score: row.competition_score,
          locations: [row.location],
        });
      } else if (existing) {
        existing.locations.push(row.location);
      }
    }

    for (const [role, timing] of roleTimingMap) {
      // best_timing_window: high demand + low competition = optimal window
      const score = timing.demand_score / Math.max(timing.competition_score, 1);
      const best_timing_window =
        score > 2
          ? 'optimal'
          : score > 1
          ? 'good'
          : score > 0.5
          ? 'moderate'
          : 'saturated';

      try {
        await set(
          env,
          `intel:timing:${role}`,
          {
            demand_score: timing.demand_score,
            expiry_risk_score: timing.expiry_risk_score,
            competition_score: timing.competition_score,
            best_timing_window,
          },
          6 * 3600
          // NOTE: qualityScore intentionally omitted — intelligence always writes
        );
      } catch (e) {
        console.error(`[pattern-engine] KV write failed intel:timing:${role}:`, e);
      }
    }

    // --- role:expiry:all:{location} — 6 hours ---
    // Top 5 expiring roles per location (highest expiry_risk_score)
    const locationRoleMap = new Map<
      string,
      { role: string; seniority: string; expiry_risk_score: number }[]
    >();

    for (const row of patternRows) {
      if (!locationRoleMap.has(row.location)) {
        locationRoleMap.set(row.location, []);
      }
      locationRoleMap.get(row.location)!.push({
        role: row.role,
        seniority: row.seniority,
        expiry_risk_score: row.expiry_risk_score,
      });
    }

    for (const [location, roles] of locationRoleMap) {
      const top5 = roles
        .sort((a, b) => b.expiry_risk_score - a.expiry_risk_score)
        .slice(0, 5);
      try {
        await set(env, `role:expiry:all:${location}`, top5, 6 * 3600);
      } catch (e) {
        console.error(
          `[pattern-engine] KV write failed role:expiry:all:${location}:`,
          e
        );
      }
    }

    // --- intel:market:{snapshot_week} — 7 days ---
    // Market summary: highest demand, highest risk, salary growth
    if (patternRows.length > 0) {
      const sortedByDemand = [...patternRows].sort(
        (a, b) => b.demand_score - a.demand_score
      );
      const sortedByRisk = [...patternRows].sort(
        (a, b) => b.expiry_risk_score - a.expiry_risk_score
      );
      const sortedBySalaryGrowth = [...patternRows]
        .filter((r) => r.salary_drift !== undefined)
        .sort((a, b) => (b.salary_drift ?? 0) - (a.salary_drift ?? 0));

      const marketSummary = {
        snapshot_week: snapshotWeek,
        total_groups: patternRows.length,
        highest_demand_roles: sortedByDemand.slice(0, 5).map((r) => ({
          role: r.role,
          seniority: r.seniority,
          location: r.location,
          demand_score: r.demand_score,
        })),
        highest_risk_roles: sortedByRisk.slice(0, 5).map((r) => ({
          role: r.role,
          seniority: r.seniority,
          location: r.location,
          expiry_risk_score: r.expiry_risk_score,
        })),
        salary_growth_roles: sortedBySalaryGrowth.slice(0, 5).map((r) => ({
          role: r.role,
          seniority: r.seniority,
          location: r.location,
          salary_drift: r.salary_drift,
        })),
      };

      try {
        await set(env, `intel:market:${snapshotWeek}`, marketSummary, 7 * 24 * 3600);
      } catch (e) {
        console.error(
          `[pattern-engine] KV write failed intel:market:${snapshotWeek}:`,
          e
        );
      }
    }

    // -----------------------------------------------------------------------
    // Step 7 — Company Velocity
    // -----------------------------------------------------------------------

    // Query: active job count per company
    const { data: activeJobs, error: errActive } = await db
      .from('job_pointers')
      .select('company_slug, company_name')
      .eq('job_state', 'active'); // CRITICAL: active ONLY

    if (errActive) {
      console.error('[pattern-engine] Company velocity active query failed:', errActive.message);
    } else {
      // Aggregate active count per slug
      const activeCountMap = new Map<string, number>();
      for (const row of activeJobs ?? []) {
        const slug = row.company_slug ?? '';
        activeCountMap.set(slug, (activeCountMap.get(slug) ?? 0) + 1);
      }

      // 4-week rolling average per company (active jobs in rolling window)
      const { data: rollingJobs } = await db
        .from('job_pointers')
        .select('company_slug')
        .eq('job_state', 'active') // CRITICAL: active ONLY
        .gte('first_seen_at', rollingStartISO)
        .lt('first_seen_at', sundayISO);

      const rollingCountMap = new Map<string, number>();
      for (const row of rollingJobs ?? []) {
        const slug = row.company_slug ?? '';
        rollingCountMap.set(slug, (rollingCountMap.get(slug) ?? 0) + 1);
      }

      // Write company:velocity:{slug} KV for companies above threshold
      for (const [slug, activeCount] of activeCountMap) {
        const rollingTotal = rollingCountMap.get(slug) ?? 0;
        const rollingAvg = rollingTotal / 4; // 4-week avg
        const velocity = activeCount / Math.max(rollingAvg, 1);

        if (velocity > 1.5) {
          const label =
            velocity > 3
              ? 'hiring_surge'
              : velocity > 2
              ? 'accelerating'
              : 'above_average';

          try {
            await set(
              env,
              `company:velocity:${slug}`,
              { velocity_ratio: round(velocity, 4), label },
              2 * 3600
            );
          } catch (e) {
            console.error(
              `[pattern-engine] KV write failed company:velocity:${slug}:`,
              e
            );
          }
        }
      }

      console.log(
        `[pattern-engine] Company velocity computed for ${activeCountMap.size} companies`
      );
    }

    console.log('[pattern-engine] Job complete. snapshot_week=' + snapshotWeek);
  } catch (err) {
    // NEVER THROWS — entire body wrapped. Log and return.
    console.error('[pattern-engine] Fatal error (suppressed):', err);
  }
}
