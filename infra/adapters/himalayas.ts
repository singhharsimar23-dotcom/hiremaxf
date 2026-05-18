/**
 * infra/adapters/himalayas.ts
 * Himalayas Remote Job Board Connector — V2.0 (BaseConnector Migration)
 */

import { BaseConnector, type FetchContext, type ConnectorFetchResult } from '../../core/ingestion-engine/core/base_connector.ts';
import type { NormalizedJob } from '../../core/ingestion-engine/core/types.ts';
import type { Env } from '../workers/types/job.ts';

// ─── RAW TYPE ─────────────────────────────────────────────────────────────────

interface HimalayasRawJob {
  guid?: string;
  title?: string;
  applicationLink?: string;
  locationRestrictions?: string[];
  companyName?: string;
  companySlug?: string;
  companyLogo?: string;
  description?: string;
  excerpt?: string;
  categories?: string[];
  minSalary?: number;
  maxSalary?: number;
  currency?: string;
  employmentType?: string;
  seniority?: string;
  pubDate?: string;
  expiryDate?: string;
  _slug?: string;
}

interface HimalayasListResponse {
  jobs?: HimalayasRawJob[];
  totalCount?: number;
  offset?: number;
  limit?: number;
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const FETCH_TIMEOUT_MS   = 10_000;
const CPU_YIELD_INTERVAL = 10;
const HIMALAYAS_API_BASE = 'https://himalayas.app/jobs/api';

const SLUG_FILTER_MAP: Record<string, Record<string, string>> = {
  'engineering':   { profession: 'Engineering' },
  'backend':       { profession: 'Engineering', stack: 'Node.js' },
  'ml':            { profession: 'Data Science' },
  'data':          { profession: 'Data Science' },
  'devops':        { profession: 'DevOps' },
  'product':       { profession: 'Product' },
  'design':        { profession: 'Design' },
  'remote-us':     { location: 'USA Only' },
  'remote-global': {},
};

// ─── CONNECTOR ────────────────────────────────────────────────────────────────

export class HimalayasConnector extends BaseConnector<HimalayasRawJob> {
  readonly source = 'himalayas' as const;

  async fetchPage(
    _env: Env,
    ctx: FetchContext
  ): Promise<ConnectorFetchResult<HimalayasRawJob>> {
    const pageSize = Math.min(ctx.limit, 100);
    const filters  = SLUG_FILTER_MAP[ctx.slug] ?? {};
    const url = new URL(HIMALAYAS_API_BASE);
    url.searchParams.set('limit',  String(pageSize));
    url.searchParams.set('offset', String(ctx.offset));

    for (const [key, val] of Object.entries(filters)) {
      url.searchParams.set(key, val);
    }

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept':     'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; JobIndexer/1.0)',
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (res.status === 429 || res.status === 403) throw new Error('RATE_LIMIT');
    if (res.status === 404) throw new Error(`SOURCE_NOT_FOUND: himalayas/${ctx.slug}`);
    if (!res.ok) throw new Error(`[himalayas:${ctx.slug}] HTTP ${res.status}`);

    const data = await res.json() as HimalayasListResponse;
    const jobs  = data.jobs ?? [];
    const total = data.totalCount ?? 0;

    const sanitized: HimalayasRawJob[] = [];
    for (let i = 0; i < jobs.length; i++) {
      if (i % CPU_YIELD_INTERVAL === 0) {
        await new Promise(r => setTimeout(r, 0));
      }
      if (this.isValidRaw(jobs[i])) {
        sanitized.push({ ...jobs[i], _slug: ctx.slug });
      }
    }

    return {
      items:          sanitized,
      totalAvailable: total,
    };
  }

  private isValidRaw(raw: unknown): raw is HimalayasRawJob {
    return (
      raw !== null &&
      typeof raw === 'object' &&
      typeof (raw as HimalayasRawJob).title === 'string' &&
      (raw as HimalayasRawJob).title!.trim().length > 0 &&
      typeof (raw as HimalayasRawJob).applicationLink === 'string' &&
      (raw as HimalayasRawJob).applicationLink!.startsWith('http')
    );
  }

  normalizeLocation(raw: string | string[] | undefined): string {
    const loc = Array.isArray(raw) ? raw.join(', ') : raw;
    if (!loc) return 'Remote';
    if (/worldwide|anywhere|global/i.test(loc)) return 'Remote';
    if (/usa?\s*only|united states/i.test(loc)) return 'Remote (US Only)';
    return loc.trim();
  }

  async parseSingle(raw: HimalayasRawJob, label: string): Promise<NormalizedJob> {
    if (!raw.title?.trim()) throw new Error('[himalayas] Missing title');
    if (!raw.applicationLink) throw new Error('[himalayas] Missing applicationLink');

    const company = raw.companyName?.trim() || label;
    const location = this.normalizeLocation(raw.locationRestrictions);

    return {
      fingerprint:  '',
      title:        raw.title.trim(),
      company,
      location,
      description:  raw.description || raw.excerpt || '',
      apply_url:    raw.applicationLink,
      source:       'himalayas',
      source_job_id: String(raw.guid || raw.applicationLink),
      seniority:    this.parseSeniority(raw.seniority, raw.title) as any,
      work_type:    this.normalizeEmploymentType(raw.employmentType),
      industry:     (raw.categories ?? [])[0] || 'other',
      posted_at:    raw.pubDate ? new Date(raw.pubDate).toISOString() : undefined,
      is_remote:    true,
      is_tech:      true,
      is_active:    true,
      enriched:     false,
      skills:       raw.categories ?? [],
      salary_min:   raw.minSalary,
      salary_max:   raw.maxSalary,
      salary_currency: raw.currency ?? 'USD',
    };
  }

  private parseSeniority(seniority?: string, title?: string): string | undefined {
    const combined = `${seniority ?? ''} ${title ?? ''}`.toLowerCase();
    if (/staff|principal|architect/i.test(combined)) return 'staff';
    if (/senior|sr\b/i.test(combined))  return 'senior';
    if (/lead\b/i.test(combined))       return 'lead';
    if (/junior|jr\b|entry/i.test(combined)) return 'junior';
    return 'mid';
  }

  private normalizeEmploymentType(type?: string): string | undefined {
    if (!type) return 'Full-time';
    const lower = type.toLowerCase();
    if (lower.includes('full')) return 'Full-time';
    if (lower.includes('part')) return 'Part-time';
    if (lower.includes('contract')) return 'Contract';
    return type;
  }
}

export const himalayasConnector = new HimalayasConnector();
