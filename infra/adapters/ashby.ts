/**
 * infra/adapters/ashby.ts
 * Ashby ATS Connector — V2.0 (BaseConnector Migration)
 *
 * CHANGES FROM V1 (ConnectorAdapter):
 * - Migrated to BaseConnector<AshbyRawJob> — strict typed raw shape.
 * - fetchPage() replaces fetchBatch(): returns ConnectorFetchResult with
 *   totalAvailable for cursor planning.
 * - Proper error classification: 401 → RATE_LIMIT (Ashby uses 401 for
 *   expired tokens, not just 429), 404 → SOURCE_NOT_FOUND → quarantine.
 * - parseSingle() replaces parse(): typed, throws on fundamental malform.
 * - CPU yield retained; moved to fetchPage sanitization loop.
 * - Location normalization: handles Ashby's locationSummary + locationType
 *   ("Remote", "Hybrid", "OnSite") correctly.
 */

import { BaseConnector, type FetchContext, type ConnectorFetchResult } from '../../core/ingestion-engine/core/base_connector.ts';
import type { NormalizedJob } from '../../core/ingestion-engine/core/types.ts';
import type { Env } from '../workers/types/job.ts';

// ─── RAW TYPE ─────────────────────────────────────────────────────────────────

interface AshbyLocation {
  locationSummary?: string;
  locationType?: 'Remote' | 'Hybrid' | 'OnSite' | string;
  city?: string;
  region?: string;
  country?: string;
}

interface AshbyDepartment {
  id?: string;
  name?: string;
  parentDepartment?: { name?: string };
}

interface AshbyRawJob {
  id: string;
  jobTitle: string;
  isListed?: boolean;
  publishedDate?: string;
  updatedAt?: string;
  location?: AshbyLocation;
  locationRequirement?: 'RemoteOnly' | 'RemoteOK' | 'OnSite' | 'Hybrid';
  isRemote?: boolean;
  descriptionHtml?: string;
  descriptionPlain?: string;
  employmentType?: string;
  department?: AshbyDepartment;
  team?: { name?: string };
  externalLink?: string;
  applyLink?: string;
  // Salary data (Ashby surfaced this in late 2024)
  compensation?: {
    currency?: string;
    minValue?: number;
    maxValue?: number;
    interval?: 'Year' | 'Month' | 'Hour';
  };
  customFields?: Array<{
    title?: string;
    value?: string | number | boolean | string[];
    fieldType?: string;
  }>;
}

interface AshbyListResponse {
  results?: AshbyRawJob[];
  moreDataAvailable?: boolean;
  nextCursor?: string;
  // Some boards use 'jobs' instead of 'results'
  jobs?: AshbyRawJob[];
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const FETCH_TIMEOUT_MS     = 15_000;
const CPU_YIELD_INTERVAL   = 10;
// Ashby's public board API endpoint
const ASHBY_BASE_URL       = 'https://api.ashbyhq.com/posting-api/job-board';

// ─── CONNECTOR ────────────────────────────────────────────────────────────────

export class AshbyConnector extends BaseConnector<AshbyRawJob> {
  readonly source = 'ashby' as const;

  async fetchPage(
    _env: Env,
    ctx: FetchContext
  ): Promise<ConnectorFetchResult<AshbyRawJob>> {
    // Ashby's public board API is unauthenticated and paginated by cursor,
    // not numeric offset. We translate numeric offset → page index for
    // compatibility with the engine's cursor model.
    const page = Math.floor(ctx.offset / ctx.limit);

    const url = new URL(ASHBY_BASE_URL);
    url.searchParams.set('organizationHostedJobsPageName', ctx.slug);

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept':     'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; JobIndexer/1.0)',
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    // ── Error classification ───────────────────────────────────────────────
    if (res.status === 429) throw new Error('RATE_LIMIT');
    // Ashby returns 401 on expired/invalid slug tokens — treat as rate limit
    // so the engine retries rather than quarantining a valid board.
    if (res.status === 401 || res.status === 403) throw new Error('RATE_LIMIT');
    if (res.status === 404) throw new Error(`SOURCE_NOT_FOUND: ${ctx.slug}`);
    if (!res.ok) throw new Error(`[ashby:${ctx.slug}] HTTP ${res.status}`);

    const data = await res.json() as AshbyListResponse;
    // Normalise response shape — some boards use 'jobs', others 'results'
    const items = data.results ?? data.jobs ?? [];

    // Filter unlisted jobs and sanitize with CPU yield
    const sanitized: AshbyRawJob[] = [];
    for (let i = 0; i < items.length; i++) {
      if (i % CPU_YIELD_INTERVAL === 0) {
        await new Promise(r => setTimeout(r, 0));
      }
      const raw = items[i];
      if (this.isValidRaw(raw) && raw.isListed !== false) {
        sanitized.push(raw);
      }
    }

    // Slice to requested page if Ashby returned all jobs at once (common)
    const pageStart = page * ctx.limit;
    const pageItems = sanitized.slice(pageStart, pageStart + ctx.limit);

    return {
      items: pageItems,
      totalAvailable: sanitized.length,
    };
  }

  private isValidRaw(raw: unknown): raw is AshbyRawJob {
    return (
      raw !== null &&
      typeof raw === 'object' &&
      typeof (raw as AshbyRawJob).id === 'string' &&
      (raw as AshbyRawJob).id.length > 0 &&
      typeof (raw as AshbyRawJob).jobTitle === 'string' &&
      (raw as AshbyRawJob).jobTitle.trim().length > 0
    );
  }

  normalizeLocation(raw: string | undefined): string {
    if (!raw) return 'Remote';
    const lower = raw.toLowerCase().trim();
    if (/^remote$/i.test(lower)) return 'Remote';
    if (/remote/i.test(lower)) return 'Remote';
    if (/hybrid/i.test(lower) && !/,/.test(raw)) return raw.trim();
    if (/new york|nyc/i.test(lower)) return 'New York, NY';
    if (/san francisco|sf\b/i.test(lower)) return 'San Francisco, CA';
    if (/los angeles|la\b/i.test(lower)) return 'Los Angeles, CA';
    if (/seattle/i.test(lower)) return 'Seattle, WA';
    if (/boston/i.test(lower)) return 'Boston, MA';
    if (/austin/i.test(lower)) return 'Austin, TX';
    return raw.trim();
  }

  async parseSingle(raw: AshbyRawJob, label: string): Promise<NormalizedJob> {
    if (!raw.id || !raw.jobTitle?.trim()) {
      throw new Error(`[ashby] Missing required fields: id=${raw.id}, title=${raw.jobTitle}`);
    }

    // Resolve location from structured or string data
    const locationRaw = this.resolveLocationString(raw);
    const location = this.normalizeLocation(locationRaw);

    const isRemote =
      raw.isRemote === true ||
      raw.locationRequirement === 'RemoteOnly' ||
      raw.locationRequirement === 'RemoteOK' ||
      raw.location?.locationType === 'Remote' ||
      location === 'Remote';

    // Prefer plain text for description; fall back to stripped HTML
    const description = raw.descriptionPlain?.trim() ||
      (raw.descriptionHtml ? stripHtml(raw.descriptionHtml) : '');

    const applyUrl = raw.applyLink ?? raw.externalLink ??
      `https://jobs.ashby.com/${raw.id}`;

    // Resolve salary
    const comp = raw.compensation;
    const salaryMin = comp?.minValue ?? undefined;
    const salaryMax = comp?.maxValue ?? undefined;
    const salaryCurrency = comp?.currency ?? 'USD';

    const industry = this.inferIndustry(raw);

    return {
      fingerprint: '',
      title: raw.jobTitle.trim(),
      company: label,
      location,
      description,
      apply_url: applyUrl,
      source: 'ashby',
      source_job_id: raw.id,
      work_type: raw.employmentType ?? undefined,
      industry,
      posted_at: raw.publishedDate
        ? new Date(raw.publishedDate).toISOString()
        : raw.updatedAt
        ? new Date(raw.updatedAt).toISOString()
        : undefined,
      is_remote: isRemote,
      is_tech: true,
      is_active: raw.isListed !== false,
      enriched: false,
      skills: this.extractSkillsFromCustomFields(raw),
      salary_min: salaryMin,
      salary_max: salaryMax,
      salary_currency: salaryCurrency,
    };
  }

  private resolveLocationString(raw: AshbyRawJob): string {
    if (raw.location?.locationSummary) return raw.location.locationSummary;
    if (raw.location?.locationType === 'Remote') return 'Remote';
    if (raw.location?.city && raw.location?.region) {
      return `${raw.location.city}, ${raw.location.region}`;
    }
    if (raw.location?.city) return raw.location.city;
    if (raw.isRemote) return 'Remote';
    if (raw.locationRequirement === 'RemoteOnly') return 'Remote';
    return '';
  }

  private extractSkillsFromCustomFields(raw: AshbyRawJob): string[] {
    if (!raw.customFields) return [];
    const skills: string[] = [];
    for (const field of raw.customFields) {
      const title = field.title?.toLowerCase() ?? '';
      if (title.includes('skill') || title.includes('tech') || title.includes('stack')) {
        if (Array.isArray(field.value)) {
          skills.push(...field.value.map(String).map(s => s.toLowerCase().trim()));
        } else if (typeof field.value === 'string') {
          skills.push(...field.value.split(/[,;\/]/).map(s => s.toLowerCase().trim()).filter(Boolean));
        }
      }
    }
    return [...new Set(skills)];
  }

  private inferIndustry(raw: AshbyRawJob): string | undefined {
    const dept = raw.department?.name ?? raw.team?.name ?? '';
    if (/security|infra|platform|devops|sre/i.test(dept)) return 'Infrastructure';
    if (/data|analytics|ml|ai|research/i.test(dept)) return 'AI/ML';
    if (/product|design|ux/i.test(dept)) return 'Product';
    if (/sales|revenue|gtm/i.test(dept)) return 'Sales';
    return undefined;
  }
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export const ashbyConnector = new AshbyConnector();
