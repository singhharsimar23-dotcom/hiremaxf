/**
 * preflight/simulateIngestion.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * PURPOSE: Dry-run ONE source through the full parse pipeline.
 *
 * HOW IT WORKS:
 *   1. Accepts a source name as CLI argument (default: 'himalayas').
 *   2. Dynamically imports the adapter for that source.
 *   3. Calls adapter.fetchBatch() with a real (but limited = 3) batch.
 *   4. Calls adapter.parse() on each raw job.
 *   5. Validates parse output against the REQUIRED_JOB_FIELDS contract.
 *   6. Prints a structured report + exits 1 on any schema violation.
 *
 * IMPORTANT — NO DB WRITES. This script is purely diagnostic.
 * It calls the real adapter with real network requests, but writes NOTHING to DB.
 *
 * USAGE:
 *   npx tsx preflight/simulateIngestion.ts
 *   npx tsx preflight/simulateIngestion.ts greenhouse
 *   npx tsx preflight/simulateIngestion.ts working-nomads
 *
 * ENVIRONMENT: Needs SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY for adapters
 * that query source_reliability (orchestration). Loaded from .env.local.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Normalizer } from '../core/ingestion-engine/core/normalization.ts';

// --- Contract ---
import {
  SOURCE_TO_ADAPTER_FILE,
  REQUIRED_JOB_FIELDS,
  type RegisteredSource,
} from '../contracts/adapter.contract.ts';

// ─── ENV LOADER ───────────────────────────────────────────────────────────────
/** Load .env.local without external deps (Node.js readFileSync only). */
function loadEnvLocal(): Record<string, string> {
  const envPath = join(resolve(process.cwd()), '.env.local');
  if (!existsSync(envPath)) return {};

  const env: Record<string, string> = {};
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
  return env;
}

// ─── UTILITIES ────────────────────────────────────────────────────────────────

const ROOT = resolve(process.cwd());

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

function printJobCard(job: Record<string, unknown>, index: number) {
  console.log(cyan(`  ┌─── Job ${index + 1} ─────────────────────────────────────`));
  for (const field of REQUIRED_JOB_FIELDS) {
    const val = job[field];
    const status = val && String(val).length > 0
      ? green('✓')
      : red('✗ MISSING');
    console.log(`  │ ${dim(field.padEnd(18))} ${status} ${dim(String(val ?? '').slice(0, 60))}`);
  }
  // Optional informational fields
  const optFields = ['location', 'description', 'is_remote', 'seniority', 'role_category'];
  for (const field of optFields) {
    const val = job[field];
    if (val !== undefined && val !== null && val !== '') {
      console.log(`  │ ${dim(field.padEnd(18))} ${dim('○')} ${dim(String(val).slice(0, 60))}`);
    }
  }
  console.log(cyan('  └─────────────────────────────────────────────────────'));
}

// ─── SCHEMA VALIDATION ────────────────────────────────────────────────────────
/** Validate a parsed job against the required fields from the contract. */
function validateParsedJob(job: unknown, index: number): string[] {
  const errors: string[] = [];

  if (!job || typeof job !== 'object') {
    errors.push(`Job ${index + 1}: parse() returned non-object: ${typeof job}`);
    return errors;
  }

  // ─── HARDENED VALIDATION ──────────────────────────────────────────────────
  // Use the real core Normalizer to apply the legacy compatibility layer.
  // This allows 'url' -> 'apply_url' and 'external_id' -> 'source_job_id'.
  const record = Normalizer.normalize(job as any) as Record<string, any>;

  for (const field of REQUIRED_JOB_FIELDS) {
    const val = record[field];
    if (val === undefined || val === null || String(val).trim() === '') {
      errors.push(`Job ${index + 1}: Required field '${field}' is missing, null, or empty`);
    }
  }

  // Validate apply_url format if present
  if (record.apply_url && typeof record.apply_url === 'string') {
    try {
      new URL(record.apply_url);
    } catch {
      errors.push(`Job ${index + 1}: 'apply_url' is not a valid URL: ${record.apply_url}`);
    }
  }

  return errors;
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  const targetSource = (process.argv[2] || 'himalayas') as RegisteredSource;
  const targetSlug   = process.argv[3] || targetSource;

  banner(`3C PREFLIGHT — STEP 3: SIMULATE INGESTION [${targetSource}:${targetSlug}]`);

  // 1. Validate source exists in contract
  const adapterFile = SOURCE_TO_ADAPTER_FILE[targetSource];
  if (!adapterFile) {
    console.error(red(`\n  ✗ Source '${targetSource}' is not in the adapter contract.`));
    console.error(red(`  Available sources: ${Object.keys(SOURCE_TO_ADAPTER_FILE).join(', ')}`));
    process.exit(1);
  }

  const absolutePath = join(ROOT, adapterFile);
  if (!existsSync(absolutePath)) {
    console.error(red(`\n  ✗ Adapter file does not exist: ${adapterFile}`));
    process.exit(1);
  }

  // 2. Load environment variables
  const envVars = loadEnvLocal();
  const mockEnv = {
    SUPABASE_URL:              envVars.SUPABASE_URL              || process.env.SUPABASE_URL              || '',
    SUPABASE_SERVICE_ROLE_KEY: envVars.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    GROQ_API_KEY:              envVars.GROQ_API_KEY              || process.env.GROQ_API_KEY              || '',
    WORKER_SECRET:             envVars.WORKER_SECRET             || process.env.WORKER_SECRET             || 'preflight-simulation',
    ENVIRONMENT:               'development' as const,
    AI:                        null as any,
    // Aggregator keys
    JOOBLE_API_KEY:            envVars.JOOBLE_API_KEY            || '',
    ADZUNA_APP_ID:             envVars.ADZUNA_APP_ID             || '',
    ADZUNA_APP_KEY:            envVars.ADZUNA_APP_KEY            || '',
    REED_API_KEY:              envVars.REED_API_KEY              || '',
    USAJOBS_API_KEY:           envVars.USAJOBS_API_KEY           || '',
    DICE_KEY:                  envVars.DICE_KEY                  || '',
    FINDWORK_TOKEN:            envVars.FINDWORK_TOKEN            || '',
    ASHBY_API_KEY:             envVars.ASHBY_API_KEY             || '',
  };

  if (!mockEnv.SUPABASE_URL) {
    console.warn(yellow('  ⚠ SUPABASE_URL not set in .env.local — adapters that hit DB may fail.'));
  }

  // 3. Dynamically import the adapter
  console.log(dim(`\n  Loading adapter from: ${adapterFile}`));
  let mod: Record<string, unknown>;
  try {
    mod = await import(pathToFileURL(absolutePath).href);
  } catch (err: any) {
    console.error(red(`  ✗ IMPORT FAILED: ${err.message}`));
    process.exit(1);
  }

  // Find the adapter object (first exported object with fetchBatch + parse)
  const adapterObj = Object.values(mod).find(
    val => val && typeof val === 'object' &&
      typeof (val as any).fetchBatch === 'function' &&
      typeof (val as any).parse === 'function'
  ) as any;

  if (!adapterObj) {
    console.error(red(`  ✗ No valid ConnectorAdapter found in ${adapterFile}`));
    process.exit(1);
  }

  console.log(green(`  ✓ Adapter loaded successfully`));

  // 4. Fetch a small batch (limit=3, no DB impact)
  const SIMULATION_LIMIT = 3;
  const SIMULATION_SLUG  = targetSource; // Most adapters use the source name as slug

  console.log(dim(`\n  Fetching ${SIMULATION_LIMIT} raw jobs (live network, no DB write)...`));

  let rawBatch: any[];
  try {
    rawBatch = await adapterObj.fetchBatch(mockEnv, targetSlug, 0, SIMULATION_LIMIT);
    console.log(green(`  ✓ fetchBatch() returned ${rawBatch.length} items`));
  } catch (err: any) {
    console.error(red(`  ✗ fetchBatch() FAILED: ${err.message}`));
    console.error(yellow('  ⚠ This may be a network error or missing API key. The adapter structure may still be valid.'));
    console.error(yellow('  Run validateAdapters.ts to check structure without network calls.'));
    process.exit(1);
  }

  if (!Array.isArray(rawBatch) || rawBatch.length === 0) {
    console.warn(yellow(`  ⚠ fetchBatch() returned empty array. Source may be dry or API key missing.`));
    console.warn(yellow('  This is a WARNING, not a failure — the adapter structure is valid.'));
    process.exit(0);
  }

  // 5. Parse each raw job and validate output
  console.log(dim(`\n  Parsing ${rawBatch.length} jobs through adapter.parse()...\n`));

  const allErrors: string[] = [];
  const parsedJobs: unknown[] = [];

  for (let i = 0; i < rawBatch.length; i++) {
    const raw = rawBatch[i];
    let parsed: unknown;

    try {
      parsed = await adapterObj.parse(raw, targetSource);
      parsedJobs.push(parsed);
    } catch (err: any) {
      const errMsg = `Job ${i + 1}: parse() threw: ${err.message}`;
      allErrors.push(errMsg);
      console.log(red(`  ✗ ${errMsg}`));
      continue;
    }

    // Validate schema
    const schemaErrors = validateParsedJob(parsed, i);
    if (schemaErrors.length > 0) {
      allErrors.push(...schemaErrors);
      for (const e of schemaErrors) console.log(red(`  ✗ SCHEMA: ${e}`));
    } else {
      printJobCard(parsed as Record<string, unknown>, i);
    }
  }

  // ─── SUMMARY ────────────────────────────────────────────────────────────────
  console.log('\n' + bold('─'.repeat(60)));
  console.log(bold('SIMULATION SUMMARY'));
  console.log(bold('─'.repeat(60)));
  console.log(dim(`  Source:     ${targetSource}`));
  console.log(dim(`  Fetched:    ${rawBatch.length}`));
  console.log(dim(`  Parsed OK:  ${parsedJobs.length}`));
  console.log(dim(`  Errors:     ${allErrors.length}`));

  if (allErrors.length > 0) {
    console.log('');
    console.log(red(bold('SIMULATION FAILED — Parse errors detected:')));
    for (const e of allErrors) {
      console.log(red(`  ✗ ${e}`));
    }
    process.exit(1);
  }

  console.log('');
  console.log(green(bold(`SIMULATION PASSED — All ${parsedJobs.length} jobs parsed and validated successfully.`)));
  console.log(dim('  ℹ No data was written to the database.'));
}

main().catch(err => {
  console.error(red(`\n[SIMULATION CRASH]: ${err.message}`));
  process.exit(1);
});
