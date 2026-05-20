/**
 * confirm/dbPulse.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * PURPOSE: Post-deployment reality check — confirms real data is flowing.
 *
 * HOW IT WORKS:
 *   1. Reads SUPABASE credentials from .env.local.
 *   2. Queries job_pointers for rows created in the last N minutes.
 *   3. Queries worker_heartbeat for the latest cron/http triggers.
 *   4. Queries source_reliability for any QUARANTINED / COOLDOWN sources.
 *   5. Prints a structured health dashboard.
 *   6. Exits 1 (FAILURE) if job count in last window is zero.
 *
 * USAGE:
 *   npx tsx confirm/dbPulse.ts            # Default: last 60 minutes
 *   npx tsx confirm/dbPulse.ts 30         # Last 30 minutes
 *   npx tsx confirm/dbPulse.ts 120        # Last 2 hours
 *
 * EXIT CODES:
 *   0 = System is healthy, data flowing
 *   1 = Zero ingestion detected, system may be stalled
 *   2 = Cannot connect to database (credentials issue)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

// ─── ENV /** Load credentials from .env or .env.local, checking both files. */
function loadEnvLocal(): Record<string, string> {
  const env: Record<string, string> = {};
  // Check both files — .env first, .env.local overrides
  const paths = ['.env', '.env.local'];

  for (const filename of paths) {
    const envPath = join(resolve(process.cwd()), filename);
    if (!existsSync(envPath)) continue;

    const lines = readFileSync(envPath, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
      env[key] = val;
    }
  }
  return env;
}

// ─── UTILITIES ────────────────────────────────────────────────────────────────

function red(s: string)    { return `\x1b[31m${s}\x1b[0m`; }
function green(s: string)  { return `\x1b[32m${s}\x1b[0m`; }
function yellow(s: string) { return `\x1b[33m${s}\x1b[0m`; }
function cyan(s: string)   { return `\x1b[36m${s}\x1b[0m`; }
function bold(s: string)   { return `\x1b[1m${s}\x1b[0m`; }
function dim(s: string)    { return `\x1b[2m${s}\x1b[0m`; }

function banner(title: string) {
  const line = '═'.repeat(60);
  console.log(`\n${bold(line)}`);
  console.log(bold(`  ${title}`));
  console.log(bold(line));
}

function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)   return 'just now';
  if (mins < 60)  return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ${mins % 60}m ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// ─── SUPABASE REST CLIENT (ZERO EXTERNAL DEPS) ───────────────────────────────
/**
 * Minimal REST client using Node.js 24 built-in fetch.
 * Does NOT use @supabase/supabase-js to avoid bundling issues.
 */
async function supabaseQuery<T>(
  url: string,
  serviceKey: string,
  table: string,
  params: string
): Promise<T[]> {
  const endpoint = `${url}/rest/v1/${table}?${params}`;
  const res = await fetch(endpoint, {
    headers: {
      'apikey':        serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
      'Content-Type':  'application/json',
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText);
    throw new Error(`Supabase query failed [${res.status}]: ${body}`);
  }

  return res.json() as Promise<T[]>;
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  const windowMinutes = parseInt(process.argv[2] || '60', 10);
  if (isNaN(windowMinutes) || windowMinutes < 1) {
    console.error(red('Usage: npx tsx confirm/dbPulse.ts [minutes]'));
    process.exit(2);
  }

  banner(`3C CONFIRM — DB PULSE CHECK (last ${windowMinutes} minutes)`);

  // 1. Load credentials
  const envVars = loadEnvLocal();
  const SUPABASE_URL = envVars.SUPABASE_URL || process.env.SUPABASE_URL || '';
  const SUPABASE_KEY = envVars.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error(red('\n  ✗ FATAL: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not found.'));
    console.error(red('  Check .env.local or set environment variables.'));
    process.exit(2);
  }

  console.log(dim(`\n  Supabase: ${SUPABASE_URL}`));

  const windowCutoff = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
  const failures: string[] = [];

  // ─── CHECK 1: Job ingestion volume ──────────────────────────────────────────
  console.log('\n' + bold(`  [CHECK 1] job_pointers — rows created in last ${windowMinutes} minutes`));

  try {
    // Count new rows using created_at
    const rows = await supabaseQuery<{ created_at: string; title: string; company_name: string }>(
      SUPABASE_URL,
      SUPABASE_KEY,
      'job_pointers',
      `created_at=gt.${encodeURIComponent(windowCutoff)}&select=created_at,title,company_name&order=created_at.desc&limit=10`
    );

    const count = rows.length;
    const displayCount = count >= 10 ? '10+' : String(count);

    if (count === 0) {
      console.log(red(`  ✗ ZERO new rows in last ${windowMinutes} minutes — INGESTION STALLED`));
      failures.push(`No jobs ingested in the last ${windowMinutes} minutes`);
    } else {
      console.log(green(`  ✓ ${displayCount} new job(s) detected\n`));
      console.log(cyan('  Recent ingestions:'));
      for (const row of rows.slice(0, 5)) {
        const time = formatRelativeTime(row.created_at);
        console.log(dim(`    • ${(row.title || 'Unknown').slice(0, 40).padEnd(40)} @ ${(row.company_name || 'Unknown').slice(0, 25)} — ${time}`));
      }
    }
  } catch (err: any) {
    console.error(red(`  ✗ QUERY FAILED: ${err.message}`));
    failures.push(`job_pointers query failed: ${err.message}`);
  }

  // ─── CHECK 2: Worker heartbeat ───────────────────────────────────────────────
  console.log('\n' + bold('  [CHECK 2] worker_heartbeat — last 5 signals'));

  try {
    const heartbeats = await supabaseQuery<{
      service_name: string;
      last_seen: string;
      jobs_processed: number;
      metadata: Record<string, unknown>;
    }>(
      SUPABASE_URL,
      SUPABASE_KEY,
      'worker_heartbeat',
      'select=service_name,last_seen,jobs_processed,metadata&order=last_seen.desc&limit=5'
    );

    if (heartbeats.length === 0) {
      console.log(yellow('  ⚠ No heartbeat signals found — worker may not have run'));
    } else {
      for (const hb of heartbeats) {
        const age = formatRelativeTime(hb.last_seen);
        const jobs = hb.jobs_processed ?? 0;
        const ageMs = Date.now() - new Date(hb.last_seen).getTime();
        const isStale = ageMs > 40 * 60 * 1000; // > 40 min

        const status = isStale
          ? yellow(`⚠ STALE (${age})`)
          : green(`✓ ${age}`);

        const jobsStr = jobs > 0
          ? green(`${jobs} jobs`)
          : yellow(`0 jobs`);

        console.log(`  ${status.padEnd(30)} ${dim(hb.service_name.padEnd(32))} ${jobsStr}`);
      }

      // Check if most recent cron has 0 jobs processed
      const latestCron = heartbeats.find(h => h.service_name?.includes('cron'));
      if (latestCron && (latestCron.jobs_processed ?? 0) === 0) {
        failures.push(`Latest cron run (${formatRelativeTime(latestCron.last_seen)}) processed 0 jobs`);
      }
    }
  } catch (err: any) {
    console.error(red(`  ✗ QUERY FAILED: ${err.message}`));
    // Non-fatal: heartbeat table might not exist in all environments
    console.warn(yellow('  ⚠ Heartbeat check skipped'));
  }

  // ─── CHECK 3: Quarantined/Cooldown sources ───────────────────────────────────
  console.log('\n' + bold('  [CHECK 3] source_reliability — blocked sources'));

  try {
    const blocked = await supabaseQuery<{
      source_name: string;
      status: string;
      retry_after: string | null;
      consecutive_failures: number;
      last_error: string | null;
    }>(
      SUPABASE_URL,
      SUPABASE_KEY,
      'source_reliability',
      `status=in.(QUARANTINE,COOLDOWN)&select=source_name,status,retry_after,consecutive_failures,last_error&order=consecutive_failures.desc&limit=20`
    );

    if (blocked.length === 0) {
      console.log(green('  ✓ No quarantined or cooleddown sources'));
    } else {
      console.log(yellow(`  ⚠ ${blocked.length} source(s) are blocked:\n`));
      for (const src of blocked) {
        const retryIn = src.retry_after
          ? `retry ${formatRelativeTime(src.retry_after)}`
          : 'no retry scheduled';
        const err = src.last_error ? ` — ${src.last_error.slice(0, 60)}` : '';
        console.log(yellow(`    ✗ [${src.status}] ${src.source_name} (${src.consecutive_failures} failures, ${retryIn})${err}`));
      }
    }
  } catch (err: any) {
    console.error(red(`  ✗ QUERY FAILED: ${err.message}`));
    console.warn(yellow('  ⚠ Source reliability check skipped'));
  }

  // ─── CHECK 4: Latest ingested job age ────────────────────────────────────────
  console.log('\n' + bold('  [CHECK 4] Last row in job_pointers'));

  try {
    const latest = await supabaseQuery<{ created_at: string; title: string; company_name: string }>(
      SUPABASE_URL,
      SUPABASE_KEY,
      'job_pointers',
      'select=created_at,title,company_name&order=created_at.desc&limit=1'
    );

    if (latest.length > 0) {
      const row = latest[0];
      const age = formatRelativeTime(row.created_at);
      const ageMs = Date.now() - new Date(row.created_at).getTime();
      const isStale = ageMs > 2 * 60 * 60 * 1000; // > 2 hours

      if (isStale) {
        console.log(yellow(`  ⚠ Last job was ingested ${age} — system may be stalling`));
      } else {
        console.log(green(`  ✓ Last job: "${(row.title || 'Unknown').slice(0, 40)}" @ ${row.company_name || 'Unknown'} — ${age}`));
      }
    } else {
      console.log(yellow('  ⚠ No rows found in job_pointers'));
    }
  } catch (err: any) {
    console.error(red(`  ✗ QUERY FAILED: ${err.message}`));
  }

  // ─── FINAL SUMMARY ──────────────────────────────────────────────────────────
  console.log('\n' + bold('═'.repeat(60)));
  console.log(bold('DB PULSE SUMMARY'));
  console.log(bold('═'.repeat(60)));
  console.log(dim(`  Window:     last ${windowMinutes} minutes`));
  console.log(dim(`  Timestamp:  ${new Date().toISOString()}`));

  if (failures.length > 0) {
    console.log('');
    console.log(red(bold(`  SYSTEM STATUS: ✗ DEGRADED / STALLED`)));
    for (const f of failures) {
      console.log(red(`    → ${f}`));
    }
    console.log('');
    console.log(red('  ACTION REQUIRED: Investigate the ingestion pipeline.'));
    console.log(dim('  Hints:'));
    console.log(dim('    1. Check source_reliability for quarantined sources'));
    console.log(dim('    2. Check Cloudflare Worker logs for ALPHA_SATURATION_SKIP events'));
    console.log(dim('    3. Run: npx tsx preflight/simulateIngestion.ts <source>'));
    process.exit(1);
  }

  console.log('');
  console.log(green(bold('  SYSTEM STATUS: ✓ HEALTHY — Data is flowing')));
  console.log(dim('  Ingestion pipeline is producing real output.'));
  process.exit(0);
}

main().catch(err => {
  console.error(red(`\n[PULSE CRASH]: ${err.message}`));
  process.exit(2);
});
