/**
 * infra/adapters/dice.ts
 * Dice Job Search Connector — V2.0 (BaseConnector Migration)
 *
 * CHANGES FROM V1 (ConnectorAdapter):
 * - Migrated to BaseConnector<DiceRawJob>.
 * - Typed raw shape for Dice's Job Search API response structure.
 * - Page-based pagination (Dice is page/pageSize, not offset-based).
 *   Translates engine's numeric offset → page number correctly.
 * - Proper 401/403 → RATE_LIMIT (Dice uses both for quota exhaustion).
 * - Salary parsing: Dice returns salary as a formatted string ("$120,000-$180,000/yr").
 *   V2 parses min/max numerically.
 * - Remote detection: Dice uses workplaceTypes[] array + positionFormats[].
 * - Employment type: Dice uses employmentTypes[] — extract primary.
 */

import { BaseConnector, type FetchContext, type ConnectorFetchResult } from '../../core/ingestion-engine/core/base_connector.ts';
import type { NormalizedJob } from '../../core/ingestion-engine/core/types.ts';
import type { Env } from '../workers/types/job.ts';

// ─── RAW TYPE ─────────────────────────────────────────────────────────────────

interface DiceRawJob {
  id?: string;
  title?: string;
  companyPageUrl?: string;
  companyName?: string;
  companyLogoUrl?: string;
  location?: string;
  salary?: string;
  // Dice API v1 vs v2 field naming varies
  workplaceTypes?: string[];
  positionFormats?: string[];
  employmentTypes?: string[];
  // Skills / tech
  skills?: string[];
  // Date fields
  postedDate?: string;
  updatedDate?: string;
  // Apply URL
  applyDetailsUrl?: string;
  detailsPageUrl?: string;
  // Description (only available on detail endpoint, not list)
  jobDescription?: string;
  // Salary structured
  payRange?: {
    min?: number;
    max?: number;
    currency?: string;
    period?: 'HOURLY' | 'ANNUAL' | 'MONTHLY';
  };
}

interface DiceSearchResponse {
  data?: {
    jobs?: DiceRawJob[];
    totalElements?: number;
    currentPage?: number;
    totalPages?: number;
  };
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const FETCH_TIMEOUT_MS   = 15_000;
const CPU_YIELD_INTERVAL = 10;
const DICE_API_BASE      = 'https://job-search-api.svc.dhigroupinc.com/v1/dice/jobs/search';

// Dice uses keyword-based slug routing
const SLUG_QUERY_MAP: Record<string, string> = {
  'software-engineer': 'Software Engineer',
  'backend':           'Backend Engineer',
  'frontend':          'Frontend Developer',
  'fullstack':         'Full Stack Developer',
  'devops':            'DevOps Engineer',
  'data-engineer':     'Data Engineer',
  'ml-engineer':       'Machine Learning Engineer',
  'cloud-architect':   'Cloud Architect',
  'security':          'Security Engineer',
  'mobile':            'Mobile Developer',
  // Default: use slug as-is
};

// ─── CONNECTOR ────────────────────────────────────────────────────────────────

export class DiceConnector extends BaseConnector<DiceRawJob> {
  readonly source = 'dice' as const;

  private slugToQuery(slug: string): string {
    return SLUG_QUERY_MAP[slug] ?? slug.replace(/-/g, ' ');
  }

  async fetchPage(
    _env: Env,
    ctx: FetchContext
  ): Promise<ConnectorFetchResult<DiceRawJob>> {
    const pageSize = Math.min(ctx.limit, 50); // Dice max is 100 but 50 is safer
    const page     = Math.floor(ctx.offset / pageSize) + 1;
    const query    = this.slugToQuery(ctx.slug);

    const url = new URL(DICE_API_BASE);
    url.searchParams.set('q',            query);
    url.searchParams.set('countryCode',  'US');
    url.searchParams.set('pageSize',     String(pageSize));
    url.searchParams.set('page',         String(page));
    url.searchParams.set('language',     'en');
    url.searchParams.set('fields',       'id,title,companyName,location,salary,workplaceTypes,employmentTypes,skills,postedDate,detailsPageUrl,applyDetailsUrl,payRange');

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept':     'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; JobIndexer/1.0)',
        'x-api-key':  'job-search-api',  // Dice's public key
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (res.status === 429 || res.status === 401 || res.status === 403) {
      throw new Error('RATE_LIMIT');
    }
    if (res.status === 404) throw new Error(`SOURCE_NOT_FOUND: dice/${ctx.slug}`);
    if (!res.ok) throw new Error(`[dice:${ctx.slug}] HTTP ${res.status}`);

    const data = await res.json() as DiceSearchResponse;
    const jobs  = data?.data?.jobs ?? [];
    const total = data?.data?.totalElements ?? 0;

    const sanitized: DiceRawJob[] = [];
    for (let i = 0; i < jobs.length; i++) {
      if (i % CPU_YIELD_INTERVAL === 0) {
        await new Promise(r => setTimeout(r, 0));
      }
      if (this.isValidRaw(jobs[i])) sanitized.push(jobs[i]);
    }

    return {
      items:          sanitized,
      totalAvailable: total,
    };
  }

  private isValidRaw(raw: unknown): raw is DiceRawJob {
    return (
      raw !== null &&
      typeof raw === 'object' &&
      typeof (raw as DiceRawJob).title === 'string' &&
      (raw as DiceRawJob).title!.trim().length > 0 &&
      !!(raw as DiceRawJob).detailsPageUrl
    );
  }

  normalizeLocation(raw: string | undefined): string {
    if (!raw) return 'Remote';
    const lower = raw.toLowerCase().trim();
    if (/remote/i.test(lower)) return 'Remote';
    // Dice often returns "City, ST, US" — strip the US suffix
    const stripped = raw.replace(/,\s*US\s*$/i, '').trim();
    if (/new york|new york city/i.test(stripped)) return 'New York, NY';
    if (/san francisco/i.test(stripped)) return 'San Francisco, CA';
    if (/los angeles/i.test(stripped)) return 'Los Angeles, CA';
    if (/seattle/i.test(stripped)) return 'Seattle, WA';
    if (/chicago/i.test(stripped)) return 'Chicago, IL';
    if (/austin/i.test(stripped)) return 'Austin, TX';
    if (/boston/i.test(stripped)) return 'Boston, MA';
    return stripped;
  }

  async parseSingle(raw: DiceRawJob, label: string): Promise<NormalizedJob> {
    if (!raw.title?.trim()) {
      throw new Error('[dice] Missing title');
    }

    const company = raw.companyName?.trim() || label;
    const locationRaw = raw.location ?? '';
    const location = this.normalizeLocation(locationRaw);

    const isRemote =
      location === 'Remote' ||
      raw.workplaceTypes?.some(t => /remote/i.test(t)) ||
      raw.positionFormats?.some(f => /remote/i.test(f)) ||
      false;

    const applyUrl = raw.applyDetailsUrl ?? raw.detailsPageUrl ?? '';
    if (!applyUrl) throw new Error('[dice] Missing apply URL');

    // Parse salary from string or structured payRange
    const { salaryMin, salaryMax } = this.parseSalary(raw);

    const skills = (raw.skills ?? []).map(s => s.toLowerCase().trim()).filter(Boolean);

    const workType = raw.employmentTypes?.[0] ?? undefined;

    return {
      fingerprint: '',
      title:       raw.title.trim(),
      company,
      location,
      description: raw.jobDescription ?? '',
      apply_url:   applyUrl,
      source:      'dice',
      source_job_id: raw.id ?? applyUrl,
      work_type:   workType,
      posted_at:   raw.postedDate ? new Date(raw.postedDate).toISOString() : undefined,
      is_remote:   isRemote,
      is_tech:     true,
      is_active:   true,
      enriched:    false,
      skills,
      salary_min:  salaryMin,
      salary_max:  salaryMax,
      salary_currency: raw.payRange?.currency ?? 'USD',
    };
  }

  private parseSalary(raw: DiceRawJob): { salaryMin?: number; salaryMax?: number } {
    // Prefer structured payRange if available
    if (raw.payRange?.min || raw.payRange?.max) {
      const multiplier = raw.payRange.period === 'HOURLY' ? 2_080 : 1;
      return {
        salaryMin: raw.payRange.min ? raw.payRange.min * multiplier : undefined,
        salaryMax: raw.payRange.max ? raw.payRange.max * multiplier : undefined,
      };
    }

    // Fall back to string parsing: "$120,000 - $180,000/yr" or "$50/hr"
    if (!raw.salary) return {};
    try {
      const clean  = raw.salary.replace(/[$,]/g, '');
      const isHour = /hr|hour/i.test(raw.salary);
      const nums   = clean.match(/\d+(?:\.\d+)?/g);
      if (!nums) return {};
      const multi  = isHour ? 2_080 : 1;
      return {
        salaryMin: nums[0] ? Math.round(parseFloat(nums[0]) * multi) : undefined,
        salaryMax: nums[1] ? Math.round(parseFloat(nums[1]) * multi) : undefined,
      };
    } catch {
      return {};
    }
  }
}

export const diceConnector = new DiceConnector();
