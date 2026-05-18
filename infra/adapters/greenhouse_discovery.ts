/**
 * infra/adapters/greenhouse_discovery.ts
 * Greenhouse Board Auto-Discovery — V1.0
 *
 * HOW TO RUN:
 *   Call runGreenhouseDiscovery() from a daily cron slot (e.g., 04:00 UTC).
 */

import type { Env } from '../workers/types/job.ts';

export interface DiscoveredSource {
  slug: string;
  source: 'greenhouse' | 'lever';
  board_name?: string;
  company_name?: string;
  job_count?: number;
  first_seen_at: string;
  suggested_tier: 'ALPHA' | 'BETA' | 'GAMMA';
}

// ─── SITEMAP PARSERS ──────────────────────────────────────────────────────────

async function fetchGreenhouseSitemap(_env: Env): Promise<string[]> {
  const SITEMAP_URL = 'https://boards.greenhouse.io/sitemap.xml';
  try {
    const res = await fetch(SITEMAP_URL, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) return [];
    const xml = await res.text();
    const slugPattern = /https:\/\/boards\.greenhouse\.io\/([a-z0-9_-]+)/gi;
    const slugs = new Set<string>();
    let match: RegExpExecArray | null;
    while ((match = slugPattern.exec(xml)) !== null) {
      if (!['sitemap', 'robots', 'privacy', 'terms', 'api'].includes(match[1])) slugs.add(match[1].toLowerCase());
    }
    return Array.from(slugs);
  } catch { return []; }
}

async function fetchLeverSitemap(_env: Env): Promise<string[]> {
  const SITEMAP_URL = 'https://jobs.lever.co/sitemap.xml';
  try {
    const res = await fetch(SITEMAP_URL, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) return [];
    const xml = await res.text();
    const slugPattern = /https:\/\/jobs\.lever\.co\/([a-z0-9_-]+)/gi;
    const slugs = new Set<string>();
    let match: RegExpExecArray | null;
    while ((match = slugPattern.exec(xml)) !== null) {
      slugs.add(match[1].toLowerCase());
    }
    return Array.from(slugs);
  } catch { return []; }
}

// ─── PROBE ───────────────────────────────────────────────────────────────────

async function probeGreenhouseBoard(slug: string): Promise<{ count: number; name?: string } | null> {
  const url = `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=false`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5_000) });
    if (!res.ok) return null;
    const data = await res.json() as { jobs?: unknown[]; meta?: { name?: string } };
    return { count: data.jobs?.length ?? 0, name: data.meta?.name };
  } catch { return null; }
}

async function probeLeverBoard(slug: string): Promise<{ count: number; name?: string } | null> {
  const url = `https://api.lever.co/v0/postings/${slug}?mode=json`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5_000) });
    if (!res.ok) return null;
    const data = await res.json() as unknown[];
    if (!Array.isArray(data)) return null;
    return { count: data.length, name: slug };
  } catch {
    return null;
  }
}

function suggestTier(slug: string, jobCount: number): 'ALPHA' | 'BETA' | 'GAMMA' {
  const ALPHA_PATTERNS = [/openai/i, /anthropic/i, /deepmind/i, /stripe/i, /figma/i, /notion/i];
  if (ALPHA_PATTERNS.some(p => p.test(slug))) return 'ALPHA';
  return jobCount >= 10 ? 'BETA' : 'GAMMA';
}

async function upsertDiscoveredSources(env: Env, sources: DiscoveredSource[]): Promise<void> {
  if (sources.length === 0) return;
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/discovered_sources?on_conflict=slug,source`, {
    method: 'POST',
    headers: { 'apikey': env.SUPABASE_SERVICE_ROLE_KEY, 'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates' },
    body: JSON.stringify(sources),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    throw new Error(`DISCOVERY_UPSERT_FAILED status=${res.status}`);
  }
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

export async function runGreenhouseDiscovery(env: Env, existingSlugs: Set<string>): Promise<void> {
  const [ghSlugs, leverSlugs] = await Promise.all([fetchGreenhouseSitemap(env), fetchLeverSitemap(env)]);
  const newGhSlugs = ghSlugs.filter(s => !existingSlugs.has(s)).slice(0, 50);
  const newLeverSlugs = leverSlugs.filter(s => !existingSlugs.has(`${s}:lever`)).slice(0, 100);

  const discovered: DiscoveredSource[] = [];
  for (const slug of newGhSlugs) {
    const result = await probeGreenhouseBoard(slug);
    if (result && result.count > 0) {
      discovered.push({ slug, source: 'greenhouse', board_name: result.name, company_name: result.name ?? slug, job_count: result.count, first_seen_at: new Date().toISOString(), suggested_tier: suggestTier(slug, result.count) });
    }
  }

  const leverValidated: DiscoveredSource[] = [];
  for (const slug of newLeverSlugs) {
    const result = await probeLeverBoard(slug);
    if (result && result.count >= 3) {
      leverValidated.push({
        slug,
        source: 'lever',
        company_name: result.name ?? slug,
        job_count: result.count,
        first_seen_at: new Date().toISOString(),
        suggested_tier: suggestTier(slug, result.count),
      });
    }
  }

  const leverDiscovered: DiscoveredSource[] = leverValidated;
  await upsertDiscoveredSources(env, [...discovered, ...leverDiscovered]);
}
