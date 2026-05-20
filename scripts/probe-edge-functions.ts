/**
 * Probe Supabase edge functions (existence + auth gate). No browser.
 * Run: npx tsx scripts/probe-edge-functions.ts
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(import.meta.dirname ?? path.dirname(new URL(import.meta.url).pathname), '..');
const envPath = path.join(ROOT, '.env');

const FUNCTIONS = [
  'generate-diagnostic',
  'generate-rebuild',
  'generate-outlook',
  'generate-interview-prep',
  'generate-cover-letter',
  'generate-linkedin',
  'ingest-identity',
  'materialize-job',
  'optimize-weights',
  'snapshot-builder',
];

function loadEnv(): Record<string, string> {
  if (!fs.existsSync(envPath)) return {};
  return Object.fromEntries(
    fs
      .readFileSync(envPath, 'utf-8')
      .split('\n')
      .filter((l) => l.includes('=') && !l.startsWith('#'))
      .map((l) => {
        const i = l.indexOf('=');
        return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
      })
  );
}

async function main() {
  const env = loadEnv();
  const base = env.VITE_SUPABASE_URL;
  const anon = env.VITE_SUPABASE_ANON_KEY;
  if (!base || !anon) {
    console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env');
    process.exit(1);
  }

  console.log('\n🔌 Edge function probe\n');
  let ok = 0;
  let missing = 0;
  let err = 0;

  for (const fn of FUNCTIONS) {
    const url = `${base}/functions/v1/${fn}`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${anon}`,
          apikey: anon,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ probe: true }),
        signal: AbortSignal.timeout(12000),
      });
      const text = await res.text().catch(() => '');
      // 404 = not deployed; 401/400/500 = exists but rejected payload (expected)
      if (res.status === 404) {
        console.log(`❌ ${fn}: NOT DEPLOYED (404)`);
        missing++;
      } else if ([400, 401, 403, 405, 422, 500, 502].includes(res.status)) {
        console.log(`✅ ${fn}: reachable (${res.status}) — ${text.slice(0, 80)}`);
        ok++;
      } else {
        console.log(`⚠️  ${fn}: HTTP ${res.status} — ${text.slice(0, 80)}`);
        ok++;
      }
    } catch (e: any) {
      console.log(`💥 ${fn}: ${e?.message ?? e}`);
      err++;
    }
  }

  console.log(`\n📊 deployed/reachable: ${ok} | missing: ${missing} | network errors: ${err}\n`);
  if (missing > 0) process.exit(1);
}

main();
