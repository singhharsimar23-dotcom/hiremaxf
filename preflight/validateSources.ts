/**
 * preflight/validateSources.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * PURPOSE: Cross-validates the live pipeline sources against the adapter registry.
 *
 * HOW IT WORKS:
 *   1. Reads contracts/source.map.json (what the registry claims to support).
 *   2. Reads ALL_SOURCES from sources.ts (what the pipeline actually runs).
 *   3. Checks every ENABLED source in the pipeline has a matching adapter.
 *   4. Detects ORPHAN adapters (registered but never used in any source tier).
 *   5. Reports CONFIGURATION GAPS (source enabled but adapter not in registry).
 *
 * FAILS LOUDLY: Any enabled source without a valid adapter = hard exit(1).
 * WARNINGS: Orphan adapters are non-fatal but reported.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { existsSync } from 'node:fs';

// --- Contract ---
import {
  REGISTERED_SOURCES,
  SOURCE_TO_ADAPTER_FILE,
} from '../contracts/adapter.contract.ts';

// ─── LOCAL TYPES ──────────────────────────────────────────────────────────────

interface SourceMapEntry {
  adapter_file: string;
  tier: string;
  enabled: boolean;
}

interface SourceMap {
  _meta: Record<string, unknown>;
  sources: Record<string, SourceMapEntry>;
}

// Minimal representation of SourceConfig for validation purposes
// (mirrors infra/workers/config/sources.ts → SourceConfig)
interface SourceConfig {
  slug: string;
  source: string;
  label: string;
  tier: string;
  priority_score: number;
  enabled?: boolean;
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

// ─── LOAD SOURCES FROM CONFIG ─────────────────────────────────────────────────
/**
 * We parse sources.ts as a text file to extract the sources without
 * importing it — because it uses Deno/Cloudflare types not available in Node.
 * We grep for all source: '...' entries and build a minimal list.
 *
 * This is intentionally simple and deterministic — no AST parsing.
 */
function loadSourcesFromConfig(): SourceConfig[] {
  const sourcesFilePath = join(ROOT, 'infra/workers/config/sources.ts');

  if (!existsSync(sourcesFilePath)) {
    console.error(red(`FATAL: sources.ts not found at: ${sourcesFilePath}`));
    process.exit(1);
  }

  const content = readFileSync(sourcesFilePath, 'utf-8');

  // Extract each object literal block { slug: ..., source: ..., enabled: ..., ... }
  // Pattern: find all source: '...' values and enabled: true/false values
  const sources: SourceConfig[] = [];

  // Match full source config blocks: { slug: '...', source: '...', ... }
  const blockPattern = /\{\s*slug:\s*'([^']+)'[^}]+source:\s*'([^']+)'[^}]+tier:\s*'([^']+)'[^}]*(?:enabled:\s*(true|false))?[^}]*\}/g;
  let match;

  while ((match = blockPattern.exec(content)) !== null) {
    const slug    = match[1];
    const source  = match[2];
    const tier    = match[3];
    const enabled = match[4] !== 'false'; // default is true if omitted

    sources.push({ slug, source, label: slug, tier, priority_score: 0, enabled });
  }

  if (sources.length === 0) {
    console.error(red('FATAL: Could not parse any sources from infra/workers/config/sources.ts. The source block format may have changed.'));
    process.exit(1);
  }

  return sources;
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  banner('3C PREFLIGHT — STEP 2: VALIDATE SOURCES');

  // 1. Load the source map (contract ground truth)
  const sourceMapPath = join(ROOT, 'contracts/source.map.json');
  if (!existsSync(sourceMapPath)) {
    console.error(red('FATAL: contracts/source.map.json not found. Run the contract generation step first.'));
    process.exit(1);
  }
  const sourceMap: SourceMap = JSON.parse(readFileSync(sourceMapPath, 'utf-8'));

  const registeredInContract = new Set(Object.keys(sourceMap.sources));
  const registeredInCode     = new Set<string>(REGISTERED_SOURCES);

  // 2. Load pipeline sources from sources.ts
  const allPipelineSources = loadSourcesFromConfig();
  const enabledPipelineSources = allPipelineSources.filter(s => s.enabled !== false);

  console.log(dim(`  Contract registered sources: ${registeredInContract.size}`));
  console.log(dim(`  Code registered sources:     ${registeredInCode.size}`));
  console.log(dim(`  Pipeline total sources:       ${allPipelineSources.length}`));
  console.log(dim(`  Pipeline enabled sources:     ${enabledPipelineSources.length}`));
  console.log('');

  const hardFailures: string[] = [];
  const warnings: string[]     = [];

  // 3. Check: every ENABLED pipeline source must be in the registry
  console.log(bold('  [CHECK 1] Enabled pipeline sources → adapter registry'));
  console.log('');

  // Deduplicate by source (multiple slugs can share a source, e.g. 'greenhouse')
  const uniqueEnabledSources = [...new Set(enabledPipelineSources.map(s => s.source))];

  for (const source of uniqueEnabledSources) {
    const inContract = registeredInContract.has(source);
    const inCode     = registeredInCode.has(source);

    process.stdout.write(`  ${dim(source.padEnd(22))} `);

    if (!inContract && !inCode) {
      console.log(red('✗ NOT REGISTERED'));
      hardFailures.push(`Source '${source}' is ENABLED in pipeline but has NO adapter in registry.ts or source.map.json`);
    } else if (!inContract) {
      console.log(yellow('⚠ NOT IN CONTRACT'));
      warnings.push(`Source '${source}' is in registry.ts code but missing from contracts/source.map.json — update the contract.`);
    } else if (!inCode) {
      console.log(yellow('⚠ NOT IN CODE'));
      warnings.push(`Source '${source}' is in source.map.json but missing from REGISTERED_SOURCES in adapter.contract.ts.`);
    } else {
      // Both checks passed — verify the adapter file physically exists
      const entry = sourceMap.sources[source];
      const filePath = join(ROOT, entry.adapter_file);
      if (!existsSync(filePath)) {
        console.log(red('✗ FILE MISSING'));
        hardFailures.push(`Source '${source}' is registered but adapter file does not exist: ${entry.adapter_file}`);
      } else {
        console.log(green('✓ OK'));
      }
    }
  }

  // 4. Check: orphan adapters — registered but not used by any enabled source
  console.log('');
  console.log(bold('  [CHECK 2] Orphan adapters (registered but unused in pipeline)'));
  console.log('');

  const usedSources = new Set(allPipelineSources.map(s => s.source));

  for (const source of registeredInContract) {
    if (!usedSources.has(source)) {
      process.stdout.write(`  ${dim(source.padEnd(22))} `);
      console.log(yellow('⚠ ORPHAN (registered, not in sources.ts)'));
      warnings.push(`Adapter '${source}' is fully registered but not referenced by any source in sources.ts`);
    }
  }

  // 5. Check: contract/code sync
  console.log('');
  console.log(bold('  [CHECK 3] Contract vs code sync'));
  console.log('');

  const inContractNotCode = [...registeredInContract].filter(s => !registeredInCode.has(s));
  const inCodeNotContract = [...registeredInCode].filter(s => !registeredInContract.has(s));

  if (inContractNotCode.length > 0) {
    for (const s of inContractNotCode) {
      console.log(yellow(`  ⚠ In source.map.json but not in adapter.contract.ts: '${s}'`));
      warnings.push(`Source '${s}' is in source.map.json but missing from REGISTERED_SOURCES constant.`);
    }
  }
  if (inCodeNotContract.length > 0) {
    for (const s of inCodeNotContract) {
      console.log(yellow(`  ⚠ In adapter.contract.ts but not in source.map.json: '${s}'`));
      warnings.push(`Source '${s}' is in REGISTERED_SOURCES but missing from source.map.json.`);
    }
  }
  if (inContractNotCode.length === 0 && inCodeNotContract.length === 0) {
    console.log(green('  ✓ Contract and code are in sync'));
  }

  // ─── SUMMARY ────────────────────────────────────────────────────────────────
  console.log('\n' + bold('─'.repeat(60)));
  console.log(bold('SOURCE VALIDATION SUMMARY'));
  console.log(bold('─'.repeat(60)));

  if (warnings.length > 0) {
    console.log(yellow(`  ⚠ WARNINGS: ${warnings.length}`));
    for (const w of warnings) {
      console.log(yellow(`    → ${w}`));
    }
  }

  if (hardFailures.length > 0) {
    console.log('');
    console.log(red(`  ✗ HARD FAILURES: ${hardFailures.length}`));
    for (const f of hardFailures) {
      console.log(red(`    → ${f}`));
    }
    console.log('');
    console.log(red(bold('PREFLIGHT FAILED — Fix missing adapters before deploying.')));
    process.exit(1);
  }

  console.log('');
  console.log(green(bold('SOURCE VALIDATION PASSED — All enabled sources have adapters.')));
}

main().catch(err => {
  console.error(red(`\n[PREFLIGHT CRASH]: ${err.message}`));
  process.exit(1);
});
