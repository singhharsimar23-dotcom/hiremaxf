/**
 * infra/adapters/adzuna.ts
 * Adzuna Job Aggregator Connector — V2.0 (BaseConnector Migration)
 *
 * CHANGES FROM V1 (ConnectorAdapter):
 * - Migrated to BaseConnector<AdzunaRawJob>.
 * - Strict typed raw shape: AdzunaRawJob captures all fields Adzuna returns.
 * - Off-by-one fix: Adzuna is 1-indexed (page 1 = first page).
 *   V1 translated offset → page with Math.floor(offset/limit) which gives
 *   page 0 for the first call — Adzuna treated that as page 1 silently,
 *   meaning every offset advanced by one page too early.
 *   Fix: page = Math.floor(offset / pageSize) + 1 (1-indexed).
 * - fetchPage returns totalAvailable from Adzuna's 'count' field so the
 *   engine can plan cursor resets accurately.
 * - Salary: Adzuna returns salary_min / salary_max as floats — round to int.
 * - Contract type: Adzuna's contract_type field maps to work_type.
 * - Category: Adzuna's category.tag maps to industry.
 * - Location: Adzuna embeds location.display_name — use directly.
 */

import { BaseConnector, type FetchContext, type ConnectorFetchResult } from '../../core/ingestion-engine/core/base_connector.ts';
import type { NormalizedJob } from '../../core/ingestion-engine/core/types.ts';
import type { Env } from '../workers/types/job.ts';

// ─── RAW TYPE ─────────────────────────────────────────────────────────────────

interface AdzunaLocation {
  area?: string[];
  display_name?: string;
}

interface AdzunaCategory {
  label?: string;
  tag?: string;
}

interface AdzunaCompany {
  display_name?: string;
}

interface AdzunaRawJob {
  id?: string;
  title?: string;
  description?: string;
  redirect_url?: string;
  created?: string;        // ISO timestamp
  location?: AdzunaLocation;
  company?: AdzunaCompany;
  category?: AdzunaCategory;
  salary_min?: number;
  salary_max?: number;
  salary_is_predicted?: string; // "1" | "0"
  contract_type?: string;       // "permanent" | "contract" | "part_time" | "full_time"
  contract_time?: string;
  latitude?: number;
  longitude?: number;
}

interface AdzunaSearchResponse {
  results?: AdzunaRawJob[];
  count?: number;
  __CLASS__?: string;
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const FETCH_TIMEOUT_MS   = 10_000;
const CPU_YIELD_INTERVAL = 10;
const MAX_PAGE_SIZE      = 50;   // Adzuna's maximum results_per_page

// Maps our slug to the Adzuna 'what' (keyword) query
const SLUG_QUERY_MAP: Record<string, string> = {
  'software-engineer': 'software engineer',
  'backend':           'backend engineer',
  'frontend':          'frontend engineer',
  'fullstack':         'full stack developer',
  'ml-engineer':       'machine learning engineer',
  'data-engineer':     'data engineer',
  'devops':            'devops engineer',
  'cloud':             'cloud engineer',
  'security':          'security engineer',
  'mobile':            'mobile developer',
};

// ─── CONNECTOR ────────────────────────────────────────────────────────────────

export class AdzunaConnector extends BaseConnector<AdzunaRawJob> {
  readonly source = 'adzuna' as const;

  async fetchPage(
    env: Env,
    ctx: FetchContext
  ): Promise<ConnectorFetchResult<AdzunaRawJob>> {
    const pageSize = Math.min(ctx.limit, MAX_PAGE_SIZE);
    // ✅ 1-indexed: page 1 is first, not page 0
    const page     = Math.floor(ctx.offset / pageSize) + 1;
    const query    = SLUG_QUERY_MAP[ctx.slug] ?? ctx.slug.replace(/-/g, ' ');

    const appId  = (env as any).ADZUNA_APP_ID;
    const appKey = (env as any).ADZUNA_APP_KEY;

    if (!appId || !appKey) {
      console.warn('[adzuna] Missing ADZUNA_APP_ID or ADZUNA_APP_KEY — skipping');
      return { items: [] };
    }

    const url = new URL(
      `https://api.adzuna.com/v1/api/jobs/us/search/${page}`
    );
    url.searchParams.set('app_id',           appId);
    url.searchParams.set('app_key',          appKey);
    url.searchParams.set('results_per_page', String(pageSize));
    url.searchParams.set('what',             query);
    url.searchParams.set('content-type',     'application/json');
    // Only senior / experienced roles — aligns with HireMax target audience
    url.searchParams.set('what_exclude',     'intern internship junior graduate');
    url.searchParams.set('sort_by',          'date');

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept':     'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; JobIndexer/1.0)',
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (res.status === 429 || res.status === 401 || res.status === 403) {
      throw new Error('RATE_LIMIT');
    }
    if (res.status === 404) throw new Error(`SOURCE_NOT_FOUND: adzuna/${ctx.slug}`);
    if (!res.ok) throw new Error(`[adzuna:${ctx.slug}] HTTP ${res.status}`);

    const data    = await res.json() as AdzunaSearchResponse;
    const results = data.results ?? [];
    const total   = data.count ?? 0;

    const sanitized: AdzunaRawJob[] = [];
    for (let i = 0; i < results.length; i++) {
      if (i % CPU_YIELD_INTERVAL === 0) {
        await new Promise(r => setTimeout(r, 0));
      }
      if (this.isValidRaw(results[i])) sanitized.push(results[i]);
    }

    return {
      items:          sanitized,
      totalAvailable: total,
    };
  }

  private isValidRaw(raw: unknown): raw is AdzunaRawJob {
    return (
      raw !== null &&
      typeof raw === 'object' &&
      typeof (raw as AdzunaRawJob).id === 'string' &&
      typeof (raw as AdzunaRawJob).title === 'string' &&
      (raw as AdzunaRawJob).title!.trim().length > 0
    );
  }

  normalizeLocation(raw: string | undefined): string {
    if (!raw) return 'Remote';
    const lower = raw.toLowerCase().trim();
    if (/remote/i.test(lower)) return 'Remote';
    // Adzuna location areas come in as ["US", "New York", "Manhattan"]
    // The display_name is already formatted — use it directly.
    if (/new york/i.test(raw)) return 'New York, NY';
    if (/san francisco/i.test(raw)) return 'San Francisco, CA';
    if (/los angeles/i.test(raw)) return 'Los Angeles, CA';
    if (/seattle/i.test(raw)) return 'Seattle, WA';
    if (/chicago/i.test(raw)) return 'Chicago, IL';
    if (/austin/i.test(raw)) return 'Austin, TX';
    if (/boston/i.test(raw)) return 'Boston, MA';
    return raw.trim();
  }

  async parseSingle(raw: AdzunaRawJob, label: string): Promise<NormalizedJob> {
    if (!raw.title?.trim()) throw new Error('[adzuna] Missing title');

    const company     = raw.company?.display_name?.trim() || label;
    const locationRaw = raw.location?.display_name ?? '';
    const location    = this.normalizeLocation(locationRaw);
    const isRemote    = location === 'Remote';
    const applyUrl    = raw.redirect_url ?? '';
    if (!applyUrl) throw new Error('[adzuna] Missing redirect_url');

    // Description comes truncated from Adzuna's list API (~200 chars).
    // Enrichment worker will expand this from the source URL.
    const description = raw.description ?? '';

    const { salaryMin, salaryMax } = this.normalizeSalary(raw);

    const contractType = this.normalizeContractType(raw.contract_type, raw.contract_time);

    // Adzuna category tag maps to an industry signal
    const industry = raw.category?.label ?? undefined;

    return {
      fingerprint: '',
      title:       raw.title.trim(),
      company,
      location,
      description,
      apply_url:   applyUrl,
      source:      'adzuna',
      source_job_id: raw.id!,
      work_type:   contractType,
      industry,
      posted_at:   raw.created ? new Date(raw.created).toISOString() : undefined,
      is_remote:   isRemote,
      is_tech:     this.isTech(raw),
      is_active:   true,
      enriched:    false,
      skills:      [],
      salary_min:  salaryMin,
      salary_max:  salaryMax,
      salary_currency: 'USD',
    };
  }

  private normalizeSalary(raw: AdzunaRawJob): { salaryMin?: number; salaryMax?: number } {
    // Adzuna predicts salary for ~40% of jobs — still useful as a signal
    const min = raw.salary_min ? Math.round(raw.salary_min) : undefined;
    const max = raw.salary_max ? Math.round(raw.salary_max) : undefined;
    return { salaryMin: min, salaryMax: max };
  }

  private normalizeContractType(
    contractType?: string,
    contractTime?: string
  ): string | undefined {
    const ct = (contractType ?? '').toLowerCase();
    const tt = (contractTime ?? '').toLowerCase();
    if (ct.includes('contract')) return 'Contract';
    if (ct.includes('part'))     return 'Part-time';
    if (tt.includes('part'))     return 'Part-time';
    if (ct.includes('permanent') || ct.includes('full')) return 'Full-time';
    return undefined;
  }

  private isTech(raw: AdzunaRawJob): boolean {
    const techCategories = [
      'it-jobs', 'engineering-jobs', 'scientific-qa-jobs',
      'data-jobs', 'creative-design-jobs',
    ];
    return techCategories.includes(raw.category?.tag ?? '');
  }
}

export const adzunaConnector = new AdzunaConnector();
