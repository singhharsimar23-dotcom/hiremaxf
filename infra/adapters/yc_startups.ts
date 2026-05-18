/**
 * infra/adapters/yc_startups.ts
 * Y Combinator — Work at a Startup Connector — V1.0
 *
 * WHY THIS MATTERS:
 * YC's Work at a Startup board is the highest-signal source for:
 *   - Pre-Series A / early-stage startup jobs
 *   - Founding engineer roles (extremely high intent)
 *   - ~5,000 active YC company job listings
 */

import { BaseConnector, type FetchContext, type ConnectorFetchResult } from '../../core/ingestion-engine/core/base_connector.ts';
import type { NormalizedJob } from '../../core/ingestion-engine/core/types.ts';
import type { Env } from '../workers/types/job.ts';

// ─── RAW TYPE ─────────────────────────────────────────────────────────────────

interface YCJobRaw {
  id: number;
  title: string;
  description?: string;
  url?: string;
  remote?: boolean;
  locationTag?: string;
  inofficeLocations?: string[];
  jobType?: string;
  equity?: string;
  experience?: string[];
  skills?: string[];
  company: {
    id: number;
    name: string;
    slug: string;
    batch?: string;
    website?: string;
    description?: string;
    industries?: string[];
    techStack?: string[];
  };
  createdAt?: string;
  updatedAt?: string;
}

interface NextDataJobs {
  props?: {
    pageProps?: {
      jobs?: YCJobRaw[];
      totalCount?: number;
    };
  };
}

// ─── CONNECTOR ────────────────────────────────────────────────────────────────

export class YCStartupsConnector extends BaseConnector<YCJobRaw> {
  readonly source = 'hacker-news-jobs' as const;

  private readonly BASE_URL = 'https://www.workatastartup.com';
  private readonly JOBS_PER_PAGE = 25;

  private offsetToPage(offset: number): number {
    return Math.floor(offset / this.JOBS_PER_PAGE) + 1;
  }

  async fetchPage(
    _env: Env,
    ctx: FetchContext
  ): Promise<ConnectorFetchResult<YCJobRaw>> {
    const roleMap: Record<string, string> = {
      'eng':     'eng',
      'design':  'design',
      'product': 'product',
      'all':     '',
      'latest':  'eng',
    };
    const role = roleMap[ctx.slug] ?? 'eng';
    const page = this.offsetToPage(ctx.offset);

    const url = new URL(`${this.BASE_URL}/jobs`);
    if (role) url.searchParams.set('role', role);
    url.searchParams.set('page', String(page));

    const res = await fetch(url.toString(), {
      headers: {
        'Accept': 'text/html,application/xhtml+xml',
        'User-Agent': 'Mozilla/5.0 (compatible; JobIndexer/1.0)',
      },
      signal: AbortSignal.timeout(12_000),
    });

    if (res.status === 429) throw new Error('RATE_LIMIT');
    if (res.status === 404) return { items: [] };
    if (!res.ok) throw new Error(`[yc-startups] HTTP ${res.status}`);

    const html = await res.text();
    const jobs = this.extractNextData(html);

    return {
      items: jobs,
    };
  }

  private extractNextData(html: string): YCJobRaw[] {
    try {
      const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
      if (!match || !match[1]) return [];
      const data = JSON.parse(match[1]) as NextDataJobs;
      return data?.props?.pageProps?.jobs ?? [];
    } catch {
      console.warn('[yc-startups] Failed to extract __NEXT_DATA__');
      return [];
    }
  }

  normalizeLocation(raw: string | undefined): string {
    if (!raw) return 'Remote';
    if (/remote/i.test(raw)) return 'Remote';
    if (/new york|nyc/i.test(raw)) return 'New York, NY';
    if (/san francisco|sf\b/i.test(raw)) return 'San Francisco, CA';
    if (/los angeles|la\b/i.test(raw)) return 'Los Angeles, CA';
    if (/seattle/i.test(raw)) return 'Seattle, WA';
    if (/boston/i.test(raw)) return 'Boston, MA';
    return raw.trim();
  }

  async parseSingle(raw: YCJobRaw, _label: string): Promise<NormalizedJob> {
    if (!raw.title?.trim()) throw new Error('[yc-startups] Missing title');
    if (!raw.company?.name) throw new Error('[yc-startups] Missing company');

    const applyUrl = raw.url ?? `${this.BASE_URL}/companies/${raw.company.slug}`;
    const locationRaw = raw.inofficeLocations?.[0] ?? raw.locationTag ?? (raw.remote ? 'Remote' : '');
    const location = this.normalizeLocation(locationRaw);
    const isRemote = raw.remote === true || location === 'Remote';

    const companyContext = raw.company.description ? `\n\n**About ${raw.company.name}**: ${raw.company.description}` : '';
    const description = (raw.description ?? '') + companyContext;

    const skills = [...(raw.skills ?? []), ...(raw.company.techStack ?? [])]
      .map(s => s.toLowerCase().trim()).filter(Boolean);

    const seniority = raw.experience?.includes('senior') ? 'senior' : raw.experience?.includes('junior') ? 'junior' : undefined;

    return {
      fingerprint: '',
      title: raw.title.trim(),
      company: raw.company.name,
      location,
      description,
      apply_url: applyUrl,
      source: 'hacker-news-jobs',
      source_job_id: String(raw.id),
      source_group: raw.company.batch ? `yc-${raw.company.batch}` : 'yc',
      seniority: seniority as any,
      work_type: raw.jobType,
      industry: raw.company.industries?.[0],
      posted_at: raw.createdAt ? new Date(raw.createdAt).toISOString() : undefined,
      is_remote: isRemote,
      is_tech: true,
      is_active: true,
      enriched: false,
      skills,
      salary_currency: 'USD',
    };
  }
}

export const ycConnector = new YCStartupsConnector();
