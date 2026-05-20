/**
 * coverage/report.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * PURPOSE: Structured anomaly report formatter for the Coverage layer.
 *
 * DESIGN:
 *   - Three severity levels: CRITICAL, WARNING, INFO
 *   - Each anomaly has: severity, category, source (if any), message, action
 *   - CRITICAL = exit(1). System is broken.
 *   - WARNING  = exit(0). System is degraded but may recover.
 *   - INFO     = exit(0). Informational observations.
 *
 * This module is purely a formatter — no DB calls, no business logic.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── TYPES ────────────────────────────────────────────────────────────────────

export type Severity = 'CRITICAL' | 'WARNING' | 'INFO';

export type AnomalyCategory =
  | 'PERSISTENCE_FAILURE'      // writes not reaching DB
  | 'THROUGHPUT_ZERO'          // zero output for extended period
  | 'THROUGHPUT_DEGRADED'      // below expected minimum
  | 'PIPELINE_ASYMMETRY'       // fetches succeed but inserts fail
  | 'SOURCE_SILENT_FAILURE'    // source active, ran recently, produced 0
  | 'ZOMBIE_CRON'              // cron runs but produces 0 jobs across all runs
  | 'DUPLICATE_STORM'          // dedup rate is abnormally high
  | 'SOURCE_NEVER_RAN'         // registered source has never produced output
  | 'GATEWAY_DOWN'             // persistence gateway returning errors
  | 'STALE_WORKER'             // worker hasn't sent heartbeat within window
  | 'CURSOR_DRIFT'             // cursor advancing but no inserts → wasted runs
  | 'INFO';

export interface Anomaly {
  severity:   Severity;
  category:   AnomalyCategory;
  source?:    string;           // which source is affected (optional)
  message:    string;           // what is wrong, with concrete numbers
  action:     string;           // what to do about it
  data?:      Record<string, unknown>; // raw numbers behind the detection
}

// ─── COLOR HELPERS ────────────────────────────────────────────────────────────

function red(s: string)      { return `\x1b[31m${s}\x1b[0m`; }
function yellow(s: string)   { return `\x1b[33m${s}\x1b[0m`; }
function green(s: string)    { return `\x1b[32m${s}\x1b[0m`; }
function cyan(s: string)     { return `\x1b[36m${s}\x1b[0m`; }
function bold(s: string)     { return `\x1b[1m${s}\x1b[0m`; }
function dim(s: string)      { return `\x1b[2m${s}\x1b[0m`; }
function underline(s: string){ return `\x1b[4m${s}\x1b[0m`; }

// ─── SEVERITY BADGE ───────────────────────────────────────────────────────────

function badge(severity: Severity): string {
  switch (severity) {
    case 'CRITICAL': return red(bold('[CRITICAL]'));
    case 'WARNING':  return yellow(bold('[WARNING] '));
    case 'INFO':     return cyan(bold('[INFO]    '));
  }
}

function formatRelativeTime(isoString: string | null | undefined): string {
  if (!isoString) return 'never';
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)    return 'just now';
  if (mins < 60)   return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)    return `${hrs}h ${mins % 60}m ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
export { formatRelativeTime };

// ─── REPORT RENDERER ──────────────────────────────────────────────────────────

export function renderReport(
  anomalies: Anomaly[],
  collectedAt: Date
): { hasCritical: boolean } {
  const criticals = anomalies.filter(a => a.severity === 'CRITICAL');
  const warnings  = anomalies.filter(a => a.severity === 'WARNING');
  const infos     = anomalies.filter(a => a.severity === 'INFO');

  const line = '═'.repeat(68);
  const thinLine = '─'.repeat(68);

  console.log(`\n${bold(line)}`);
  console.log(bold('  COVERAGE LAYER — BLINDSPOT DETECTION REPORT'));
  console.log(dim(`  Generated: ${collectedAt.toISOString()}`));
  console.log(bold(line));

  // ─── CRITICAL ───────────────────────────────────────────────────────────────
  if (criticals.length > 0) {
    console.log(`\n${red(bold('  ■ CRITICAL ANOMALIES'))} ${dim(`(${criticals.length})`)}`);
    console.log(red(thinLine));
    for (const a of criticals) {
      const src = a.source ? ` ${dim('[')}${dim(a.source)}${dim(']')}` : '';
      console.log(`\n  ${badge(a.severity)} ${bold(a.category)}${src}`);
      console.log(`  ${' '.repeat(12)}${a.message}`);
      console.log(`  ${' '.repeat(12)}${red('↳ ACTION:')} ${a.action}`);
      if (a.data) {
        const dataStr = Object.entries(a.data)
          .map(([k, v]) => `${k}=${v}`)
          .join('  ');
        console.log(`  ${' '.repeat(12)}${dim(dataStr)}`);
      }
    }
  }

  // ─── WARNINGS ───────────────────────────────────────────────────────────────
  if (warnings.length > 0) {
    console.log(`\n${yellow(bold('  ■ WARNINGS'))} ${dim(`(${warnings.length})`)}`);
    console.log(yellow(thinLine));
    for (const a of warnings) {
      const src = a.source ? ` ${dim('[')}${dim(a.source)}${dim(']')}` : '';
      console.log(`\n  ${badge(a.severity)} ${bold(a.category)}${src}`);
      console.log(`  ${' '.repeat(12)}${a.message}`);
      console.log(`  ${' '.repeat(12)}${yellow('↳ ACTION:')} ${a.action}`);
      if (a.data) {
        const dataStr = Object.entries(a.data)
          .map(([k, v]) => `${k}=${v}`)
          .join('  ');
        console.log(`  ${' '.repeat(12)}${dim(dataStr)}`);
      }
    }
  }

  // ─── INFO ────────────────────────────────────────────────────────────────────
  if (infos.length > 0) {
    console.log(`\n${cyan(bold('  ■ INFO'))} ${dim(`(${infos.length})`)}`);
    console.log(cyan(thinLine));
    for (const a of infos) {
      const src = a.source ? ` ${dim('[')}${dim(a.source)}${dim(']')}` : '';
      console.log(`  ${badge(a.severity)} ${a.category}${src}: ${dim(a.message)}`);
    }
  }

  // ─── EXECUTIVE SUMMARY ───────────────────────────────────────────────────────
  console.log(`\n${bold(line)}`);
  console.log(bold('  SUMMARY'));
  console.log(bold(thinLine));
  console.log(red(`  ■ CRITICAL:  ${criticals.length}`));
  console.log(yellow(`  ■ WARNINGS:  ${warnings.length}`));
  console.log(cyan(`  ■ INFO:      ${infos.length}`));

  if (criticals.length === 0 && warnings.length === 0) {
    console.log('');
    console.log(green(bold('  ✓ NO ANOMALIES DETECTED — System appears healthy.')));
  } else {
    console.log('');
    if (criticals.length > 0) {
      console.log(red(bold(`  ✗ SYSTEM IS BROKEN — ${criticals.length} critical anomaly(ies) require immediate action.`)));
    } else {
      console.log(yellow(bold(`  ⚠ SYSTEM IS DEGRADED — ${warnings.length} warning(s) need attention.`)));
    }
  }
  console.log(bold(line) + '\n');

  return { hasCritical: criticals.length > 0 };
}
