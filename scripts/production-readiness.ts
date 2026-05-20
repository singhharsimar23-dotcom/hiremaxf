/**
 * Production readiness gate — static + HTTP checks (no browser).
 * Run: npx tsx scripts/production-readiness.ts [--url=https://hiremax.site]
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(import.meta.dirname ?? path.dirname(new URL(import.meta.url).pathname), '..');
const WEB = path.join(ROOT, 'apps/web');
const DIST = path.join(ROOT, 'apps/web/dist');
const APP_TSX = path.join(WEB, 'App.tsx');

type Result = { id: string; category: string; status: 'PASS' | 'FAIL' | 'WARN'; detail: string };

const results: Result[] = [];
const baseUrl = process.argv.find((a) => a.startsWith('--url='))?.slice(6) ?? 'https://hiremax.site';

function pass(id: string, category: string, detail: string) {
  results.push({ id, category, status: 'PASS', detail });
}
function fail(id: string, category: string, detail: string) {
  results.push({ id, category, status: 'FAIL', detail });
}
function warn(id: string, category: string, detail: string) {
  results.push({ id, category, status: 'WARN', detail });
}

// ─── Handoff registry: view → component file ───────────────────────────────
const HANDOFF_VIEWS: Record<string, string> = {
  landing: 'components/LandingPage.tsx',
  auth: 'components/AuthView.tsx',
  pricing: 'components/Pricing.tsx',
  'auth-bridge': 'components/AuthBridge.tsx',
  faq: 'components/FAQ.tsx',
  contact: 'components/Contact.tsx',
  terms: 'components/TermsView.tsx',
  privacy: 'components/PrivacyView.tsx',
  refund: 'components/RefundView.tsx',
  dashboard: 'components/DashboardView.tsx',
  'ai-review': 'components/AIReviewView.tsx',
  'full-review': 'components/FullReviewView.tsx',
  'market-outlook': 'components/MarketOutlookView.tsx',
  'career-intelligence': 'components/CareerIntelligenceView.tsx',
  'resume-editor': 'components/ResumeBuilder.tsx',
  rebuild: 'components/RebuiltCompareView.tsx',
  'rebuild-standalone': 'components/RebuildStandaloneView.tsx',
  tracker: 'components/ApplicationTrackerView.tsx',
  'interview-prep': 'components/InterviewPrepView.tsx',
  'cover-letter': 'components/CoverLetterView.tsx',
  'linkedin-optimizer': 'components/LinkedInOptimizerView.tsx',
  history: 'components/ResumeHistoryView.tsx',
  profile: 'components/ProfileView.tsx',
  settings: 'components/AccountSettings.tsx',
  billing: 'components/Billing.tsx',
  preview: 'components/ExecutionPreviewView.tsx',
  admin: 'components/AdminIntelligence.tsx',
  applications: 'components/ApplicationExecutionView.tsx',
};

const EDGE_FUNCTIONS = [
  'generate-diagnostic',
  'generate-rebuild',
  'generate-outlook',
  'generate-interview-prep',
  'generate-cover-letter',
  'generate-linkedin',
  'generate-text',
  'materialize-job',
  'optimize-weights',
];

/** Optional / admin-only — warn if missing, do not fail launch */
const OPTIONAL_EDGE_FUNCTIONS = [
  'ingest-identity',
  'snapshot-builder',
  'master-intelligence-orchestrator',
];

function checkComponentFiles() {
  for (const [view, rel] of Object.entries(HANDOFF_VIEWS)) {
    const full = path.join(WEB, rel);
    if (fs.existsSync(full)) pass(`file:${view}`, 'components', `${rel} exists`);
    else fail(`file:${view}`, 'components', `Missing ${rel} for view "${view}"`);
  }
}

function checkAppRouting() {
  const app = fs.readFileSync(APP_TSX, 'utf-8');

  for (const view of Object.keys(HANDOFF_VIEWS)) {
    if (view === 'landing') {
      if (app.includes("activeView === 'landing'")) pass(`route:${view}`, 'routing', 'landing rendered');
      else fail(`route:${view}`, 'routing', 'landing not wired in App.tsx');
      continue;
    }
    const patterns = [
      `activeView === '${view}'`,
      `activeView === "${view}"`,
      `display: activeView === '${view}'`,
    ];
    const wired = patterns.some((p) => app.includes(p));
    if (wired) pass(`route:${view}`, 'routing', `view "${view}" has render branch`);
    else fail(`route:${view}`, 'routing', `view "${view}" has NO render branch in App.tsx`);
  }

  // Dead lazy imports (bundled but never shown)
  const lazyImports = [...app.matchAll(/const (\w+) = lazy\(\(\) => import\('\.\/components\/(\w+)/g)];
  for (const [, varName, compName] of lazyImports) {
    const used =
      app.includes(`<${varName}`) ||
      app.includes(`<${compName}`) ||
      app.includes(`{${varName}`) ||
      app.includes(`activeView ===`) && app.includes(compName);
    if (!used && !app.includes(`<${varName}`)) {
      warn(`dead-lazy:${varName}`, 'routing', `Lazy import ${varName} (${compName}) may be unused in JSX`);
    }
  }
}

function checkDistBundle() {
  if (!fs.existsSync(DIST)) {
    fail('dist', 'build', 'dist/ missing — run npm run build first');
    return;
  }
  pass('dist-exists', 'build', 'dist/ present');

  const indexHtml = path.join(DIST, 'index.html');
  if (!fs.existsSync(indexHtml)) fail('index-html', 'build', 'dist/index.html missing');
  else pass('index-html', 'build', 'dist/index.html present');

  const assetsDir = path.join(DIST, 'assets');
  if (!fs.existsSync(assetsDir)) {
    fail('assets', 'build', 'dist/assets missing');
    return;
  }

  const chunks = fs.readdirSync(assetsDir).filter((f) => f.endsWith('.js'));
  const chunkNames = chunks.join(' ');

  const expectedChunks = [
    'LandingPage',
    'AuthView',
    'DashboardView',
    'AIReviewView',
    'FullReviewView',
    'MarketOutlookView',
    'ResumeBuilder',
    'ProfileView',
  ];
  for (const name of expectedChunks) {
    const found = chunks.some((c) => c.includes(name) || chunkNames.includes(name.replace('View', '')));
    // Vite hashes names — match by partial
    const partial = name.replace(/View$/, '');
    if (chunks.some((c) => c.toLowerCase().includes(partial.toLowerCase()))) {
      pass(`chunk:${name}`, 'build', `lazy chunk for ${name} emitted`);
    } else if (name === 'LandingPage' || name === 'AuthView') {
      // may be in main bundle
      warn(`chunk:${name}`, 'build', `${name} may be in main bundle (not separate chunk)`);
    } else {
      warn(`chunk:${name}`, 'build', `no dedicated chunk matching ${name} (check main bundle)`);
    }
  }

  const large = chunks
    .map((f) => ({ f, size: fs.statSync(path.join(assetsDir, f)).size }))
    .filter((x) => x.size > 500_000);
  for (const { f, size } of large) {
    warn(`large-chunk:${f}`, 'build', `${f} is ${(size / 1024).toFixed(0)}KB — exceeds 500KB budget`);
  }
}

function checkViteNoClientSecrets() {
  const vitePath = path.join(WEB, 'vite.config.ts');
  if (!fs.existsSync(vitePath)) return;
  const src = fs.readFileSync(vitePath, 'utf-8');
  if (src.includes('process.env.API_KEY') || src.includes('process.env.GEMINI_API_KEY')) {
    fail('vite:secrets', 'security', 'vite.config.ts must not define GEMINI/API_KEY for the browser bundle');
  } else {
    pass('vite:secrets', 'security', 'vite.config.ts does not embed API keys in client bundle');
  }
}

function checkDistNoSecrets() {
  if (!fs.existsSync(DIST)) return;
  const assetsDir = path.join(DIST, 'assets');
  if (!fs.existsSync(assetsDir)) return;
  const jsFiles = fs.readdirSync(assetsDir).filter((f) => f.endsWith('.js'));
  let leaked = false;
  for (const f of jsFiles) {
    const content = fs.readFileSync(path.join(assetsDir, f), 'utf-8');
    if (/AIza[0-9A-Za-z_-]{20,}/.test(content)) {
      leaked = true;
      fail('bundle:gemini-key', 'security', `Possible Gemini key in dist/assets/${f}`);
    }
  }
  if (!leaked) pass('bundle:no-keys', 'security', 'No Gemini API key patterns in dist JS bundles');
}

function checkEnvContract() {
  const envExample = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'];
  const launchRecommended = ['VITE_ADMIN_EMAILS'];
  const envPath = path.join(ROOT, '.env');
  const hasEnv = fs.existsSync(envPath);
  if (hasEnv) {
    const env = fs.readFileSync(envPath, 'utf-8');
    for (const key of envExample) {
      if (env.includes(`${key}=`) && !env.match(new RegExp(`${key}=\\s*$`, 'm'))) {
        pass(`env:${key}`, 'config', `${key} set in .env`);
      } else {
        fail(`env:${key}`, 'config', `${key} missing or empty in .env`);
      }
    }
    for (const key of launchRecommended) {
      if (env.includes(`${key}=`) && !env.match(new RegExp(`${key}=\\s*$`, 'm'))) {
        pass(`env:${key}`, 'config', `${key} set in .env`);
      } else {
        warn(`env:${key}`, 'config', `${key} not set — /admin route will be inaccessible`);
      }
    }
    if (env.includes('VITE_GEMINI_API_KEY=') || env.match(/GEMINI_API_KEY=\s*AIza/)) {
      warn('env:client-gemini', 'security', 'Do not set VITE_GEMINI_API_KEY for production — use Supabase edge secrets only');
    }
  } else {
    warn('env-file', 'config', '.env not found locally (CI may inject vars at build time)');
  }
}

function checkSupabaseFunctionsExist() {
  const fnDir = path.join(ROOT, 'supabase/functions');
  for (const fn of EDGE_FUNCTIONS) {
    const ts = path.join(fnDir, fn, 'index.ts');
    const js = path.join(fnDir, fn, 'index.js');
    if (fs.existsSync(ts) || fs.existsSync(js)) pass(`fn:${fn}`, 'backend', `edge function ${fn} source exists`);
    else fail(`fn:${fn}`, 'backend', `Required edge function ${fn} missing — deploy before launch`);
  }
  for (const fn of OPTIONAL_EDGE_FUNCTIONS) {
    const ts = path.join(fnDir, fn, 'index.ts');
    if (fs.existsSync(ts)) pass(`fn:${fn}`, 'backend', `optional function ${fn} present`);
    else warn(`fn:${fn}`, 'backend', `optional function ${fn} not deployed — related UI actions will error gracefully`);
  }
}

async function httpStress() {
  const routes = [
    '/',
    '/dashboard',
    '/pricing',
    '/faq',
    '/contact',
    '/terms',
    '/privacy',
    '/refund',
    '/ai-review',
    '/settings',
    '/?view=auth-bridge',
  ];

  const concurrency = 5;
  const iterations = 3;

  for (const route of routes) {
    const url = `${baseUrl.replace(/\/$/, '')}${route}`;
    const times: number[] = [];
    let ok = 0;
    let errors: string[] = [];

    const tasks: Promise<void>[] = [];
    for (let i = 0; i < concurrency * iterations; i++) {
      tasks.push(
        (async () => {
          const start = performance.now();
          try {
            const res = await fetch(url, {
              method: 'GET',
              redirect: 'follow',
              headers: { 'User-Agent': 'HireMax-ProductionGate/1.0' },
              signal: AbortSignal.timeout(15000),
            });
            times.push(performance.now() - start);
            if (res.ok) ok++;
            else errors.push(`HTTP ${res.status}`);
          } catch (e: any) {
            errors.push(e?.message ?? String(e));
          }
        })()
      );
    }
    await Promise.all(tasks);

    const avg = times.length ? times.reduce((a, b) => a + b, 0) / times.length : 0;
    const successRate = (ok / (concurrency * iterations)) * 100;

    if (successRate >= 95 && avg < 5000) {
      pass(`http:${route}`, 'http', `${url} — ${successRate.toFixed(0)}% ok, avg ${avg.toFixed(0)}ms (${ok}/${concurrency * iterations})`);
    } else if (successRate >= 80) {
      warn(`http:${route}`, 'http', `${url} — ${successRate.toFixed(0)}% ok, avg ${avg.toFixed(0)}ms — ${[...new Set(errors)].slice(0, 2).join('; ')}`);
    } else {
      fail(`http:${route}`, 'http', `${url} — ${successRate.toFixed(0)}% ok — ${[...new Set(errors)].slice(0, 3).join('; ')}`);
    }
  }

  // SPA: all routes should return same index.html shell
  try {
    const home = await fetch(baseUrl, { signal: AbortSignal.timeout(10000) });
    const dash = await fetch(`${baseUrl}/dashboard`, { signal: AbortSignal.timeout(10000) });
    const homeHtml = await home.text();
    const dashHtml = await dash.text();
    const hasRoot = homeHtml.includes('id="root"') || homeHtml.includes("id='root'");
    const spaFallback = homeHtml.length > 200 && dashHtml.length > 200;
    if (hasRoot && spaFallback) pass('http:spa-shell', 'http', 'index.html shell with #root served for deep links');
    else fail('http:spa-shell', 'http', 'Missing SPA shell — configure host to fallback to index.html');
  } catch (e: any) {
    fail('http:spa-shell', 'http', `Could not verify SPA shell: ${e?.message}`);
  }
}

async function checkSupabaseReachable() {
  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) {
    warn('supabase:ping', 'backend', 'Skip Supabase ping — no .env');
    return;
  }
  const env = Object.fromEntries(
    fs
      .readFileSync(envPath, 'utf-8')
      .split('\n')
      .filter((l) => l.includes('=') && !l.startsWith('#'))
      .map((l) => {
        const i = l.indexOf('=');
        return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
      })
  );
  const url = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    warn('supabase:ping', 'backend', 'Skip — VITE_SUPABASE_* not in .env');
    return;
  }
  try {
    const res = await fetch(`${url}/rest/v1/`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(10000),
    });
    if (res.status === 200 || res.status === 401) pass('supabase:ping', 'backend', `Supabase REST reachable (${res.status})`);
    else warn('supabase:ping', 'backend', `Supabase REST returned ${res.status}`);
  } catch (e: any) {
    fail('supabase:ping', 'backend', `Supabase unreachable: ${e?.message}`);
  }
}

async function main() {
  console.log('\n🔬 HireMax Production Readiness Gate\n');
  console.log(`Target: ${baseUrl}\n`);

  checkComponentFiles();
  checkAppRouting();
  checkViteNoClientSecrets();
  checkDistBundle();
  checkDistNoSecrets();
  checkEnvContract();
  checkSupabaseFunctionsExist();
  await httpStress();
  await checkSupabaseReachable();

  const fails = results.filter((r) => r.status === 'FAIL');
  const warns = results.filter((r) => r.status === 'WARN');
  const passes = results.filter((r) => r.status === 'PASS');

  console.log('\n─── Results ───\n');
  for (const r of results) {
    const icon = r.status === 'PASS' ? '✅' : r.status === 'WARN' ? '⚠️' : '❌';
    console.log(`${icon} [${r.category}] ${r.id}: ${r.detail}`);
  }

  console.log(`\n📊 ${passes.length} pass | ${warns.length} warn | ${fails.length} fail\n`);

  if (fails.length > 0) {
    console.log('🚫 NOT production-ready — fix failures above.\n');
    process.exit(1);
  }
  if (warns.length > 0) {
    console.log('⚠️  Production deployable with warnings — review before go-live.\n');
    process.exit(0);
  }
  console.log('✅ All gates passed.\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
