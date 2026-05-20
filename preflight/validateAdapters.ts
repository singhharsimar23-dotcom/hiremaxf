/**
 * preflight/validateAdapters.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * PURPOSE: Physical file inspection of every adapter in the registry.
 *
 * HOW IT WORKS:
 *   1. Reads contracts/source.map.json to get the list of registered sources.
 *   2. For each source, reads the corresponding adapter file from disk.
 *   3. Checks that the file exports a valid adapter object via a live import.
 *   4. Verifies that the adapter object has `fetchBatch` and `parse` methods.
 *   5. FAILS LOUDLY with precise file + method details if any check fails.
 *
 * RUNTIME: Node.js (tsx) — NOT Cloudflare Workers. Runs before deployment.
 * NO DB CALLS. NO NETWORK CALLS. Pure static analysis + live import.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

// --- Contract imports ---
import {
  REQUIRED_ADAPTER_METHODS,
  SOURCE_TO_ADAPTER_FILE,
  type RegisteredSource,
} from '../contracts/adapter.contract.ts';

// --- Types ---
interface CheckResult {
  source: RegisteredSource;
  file: string;
  passed: boolean;
  errors: string[];
  warnings: string[];
}

// ─── UTILITIES ────────────────────────────────────────────────────────────────

const ROOT = resolve(process.cwd());

function red(s: string)    { return `\x1b[31m${s}\x1b[0m`; }
function green(s: string)  { return `\x1b[32m${s}\x1b[0m`; }
function yellow(s: string) { return `\x1b[33m${s}\x1b[0m`; }
function bold(s: string)   { return `\x1b[1m${s}\x1b[0m`; }
function dim(s: string)    { return `\x1b[2m${s}\x1b[0m`; }

function banner(title: string) {
  const line = '═'.repeat(60);
  console.log(`\n${bold(line)}`);
  console.log(bold(`  ${title}`));
  console.log(bold(line));
}

// ─── CORE CHECK ───────────────────────────────────────────────────────────────

/**
 * Dynamically imports an adapter file and inspects its exported object.
 *
 * We look for a named export of type object that has `fetchBatch` and `parse`.
 * We do NOT assume the export name — we scan all named exports.
 *
 * RATIONALE: The registry (registry.ts) imports { XxxAdapter } by name, but
 * the contract should not enforce the naming — only the SHAPE (methods).
 */
async function checkAdapter(
  source: RegisteredSource,
  relativeFilePath: string
): Promise<CheckResult> {
  const result: CheckResult = {
    source,
    file: relativeFilePath,
    passed: false,
    errors: [],
    warnings: [],
  };

  const absolutePath = join(ROOT, relativeFilePath);

  // 1. File existence check
  if (!existsSync(absolutePath)) {
    result.errors.push(`MISSING FILE: ${relativeFilePath} does not exist on disk`);
    return result;
  }

  // 2. Live import — catches syntax errors and broken imports at module level
  let mod: Record<string, unknown>;
  try {
    mod = await import(pathToFileURL(absolutePath).href);
  } catch (err: any) {
    result.errors.push(`IMPORT FAILED: ${relativeFilePath} threw at load time: ${err.message}`);
    return result;
  }

  // 3. Find the adapter object — scan all named exports, look for an object
  //    that has the required methods. This handles any naming convention.
  const adapterCandidates = Object.entries(mod).filter(([, val]) => {
    return typeof val === 'object' && val !== null && !Array.isArray(val);
  });

  if (adapterCandidates.length === 0) {
    result.errors.push(`NO ADAPTER OBJECT: ${relativeFilePath} has no exported object. Expected a ConnectorAdapter export.`);
    return result;
  }

  // Find the first object that has at least one required method
  const adapterEntry = adapterCandidates.find(([, val]) => {
    const obj = val as Record<string, unknown>;
    return REQUIRED_ADAPTER_METHODS.some(m => typeof obj[m] === 'function');
  });

  if (!adapterEntry) {
    const exportNames = adapterCandidates.map(([k]) => k).join(', ');
    result.errors.push(
      `WRONG SHAPE: ${relativeFilePath} exports objects [${exportNames}] but none have 'fetchBatch' or 'parse' as functions. Check for naming inconsistencies between the export and the ConnectorAdapter interface.`
    );
    return result;
  }

  const [exportedName, adapterObj] = adapterEntry;
  const adapter = adapterObj as Record<string, unknown>;

  // 4. Check required methods
  for (const method of REQUIRED_ADAPTER_METHODS) {
    if (typeof adapter[method] !== 'function') {
      result.errors.push(
        `MISSING METHOD: ${relativeFilePath} export '${exportedName}' is missing required method '${method}'`
      );
    }
  }

  // 5. Structural check passed
  if (result.errors.length === 0) {
    result.passed = true;
  }

  return result;
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  banner('3C PREFLIGHT — STEP 1: VALIDATE ADAPTERS');
  console.log(dim(`  Checking ${Object.keys(SOURCE_TO_ADAPTER_FILE).length} registered adapters...\n`));

  const results: CheckResult[] = [];

  for (const [source, filePath] of Object.entries(SOURCE_TO_ADAPTER_FILE) as [RegisteredSource, string][]) {
    process.stdout.write(`  ${dim(source.padEnd(22))} `);
    const result = await checkAdapter(source, filePath);
    results.push(result);

    if (result.passed) {
      console.log(green('✓ PASS'));
    } else {
      console.log(red('✗ FAIL'));
      for (const err of result.errors) {
        console.log(red(`    → ${err}`));
      }
      for (const warn of result.warnings) {
        console.log(yellow(`    ⚠ ${warn}`));
      }
    }
  }

  // ─── SUMMARY ────────────────────────────────────────────────────────────────
  const passed = results.filter(r => r.passed);
  const failed = results.filter(r => !r.passed);

  console.log('\n' + bold('─'.repeat(60)));
  console.log(bold('ADAPTER VALIDATION SUMMARY'));
  console.log(bold('─'.repeat(60)));
  console.log(green(`  ✓ PASSED: ${passed.length} adapters`));

  if (failed.length > 0) {
    console.log(red(`  ✗ FAILED: ${failed.length} adapters\n`));
    console.log(bold(red('FAILED ADAPTERS:')));
    for (const r of failed) {
      console.log(red(`  ✗ [${r.source}] ${r.file}`));
      for (const err of r.errors) {
        console.log(red(`      ${err}`));
      }
    }
    console.log('');
    console.log(red(bold('PREFLIGHT FAILED — Fix the above errors before deploying.')));
    process.exit(1);
  }

  console.log('');
  console.log(green(bold('ALL ADAPTERS VALID — Proceed to validateSources.')));
}

main().catch(err => {
  console.error(red(`\n[PREFLIGHT CRASH]: ${err.message}`));
  process.exit(1);
});
