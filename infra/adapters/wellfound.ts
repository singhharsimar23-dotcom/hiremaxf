/**
 * infra/adapters/wellfound.ts
 * Wellfound (formerly AngelList Talent) Connector — V2.0
 *
 * BREAKING CHANGE FROM V1: Apify dependency removed entirely.
 *
 * WHY APIFY WAS DROPPED:
 * - Free tier: 10 actor runs/month. Useless for continuous ingestion.
 * - Paid tier: $49+/month for enough capacity — expensive for what is
 *   essentially an HTML scrape.
 * - Cold start: Apify actor cold starts take 10-30s, burning CF Worker CPU.
 * - Single point of failure: if Apify is down, the source goes dark.
 *
 * V2 APPROACH:
 *   1. GraphQL (primary) — Wellfound exposes a /graphql endpoint used by
 *      their own SPA. Requires a session token or partner access.
 *      Set WELLFOUND_TOKEN env var to enable.
 *
 *   2. __NEXT_DATA__ scraping (fallback) — Wellfound is a Next.js app.
 *      Like YC's Work at a Startup connector, we extract the serialized
 *      page props from the __NEXT_DATA__ <script> tag. This is:
 *        - Zero cost
 *        - No authentication required for public job listings
 *        - Resilient: falls back gracefully if structure changes
 *        - Same technique proven in production by yc_startups.ts
 *
 *   3. If both fail → return empty batch (no crash, circuit breaker tracks it).
 *
 * RATE LIMIT POLICY:
 * Wellfound search pages are publicly accessible but will 429 after ~20
 * requests/minute from a single IP. The engine's per-source lock + 30s
 * batch cadence keeps us well within limits. If a 429 is received, the
 * circuit breaker opens for 60s before retrying.
 */

import { BaseConnector, type FetchContext, type ConnectorFetchResult } from '../../core/ingestion-engine/core/base_connector.ts';
import type { NormalizedJob } from '../../core/ingestion-engine/core/types.ts';
import type { Env } from '../workers/types/job.ts';

// ─── RAW TYPE ─────────────────────────────────────────────────────────────────

interface WellfoundRawJob {
  id: number | string;
  title: string;
  description?: string;
  applyUrl?: string;
  url?: string;
  remote?: boolean;
  locationNames?: string[];
  locations?: string[];
  skills?: string[];
  jobTypes?: string[];
  salary?: {
    min?: number;
    max?: number;
    currency?: string;
    equity?: string;
  };
  salaryRange?: string;
  equity?: string;
  // Company object (GraphQL shape)
  startup?: {
    id?: number;
    name?: string;
    slug?: string;
    highConcept?: string;   // 1-line company description
    website?: string;
    stage?: string;
    markets?: Array<{ displayName?: string }>;
    badges?: string[];
  };
  // Flat shape from __NEXT_DATA__
  companyName?: string;
  companySlug?: string;
  companyDescription?: string;
  companyWebsite?: string;
  companyStage?: string;
  companyMarkets?: string[];
  createdAt?: string;
  updatedAt?: string;
}

// ─── GRAPHQL RESPONSE TYPES ───────────────────────────────────────────────────

interface WellfoundGraphQLResponse {
  data?: {
    talent?: {
      jobListings?: {
        startupRoles?: WellfoundGraphQLRole[];
        totalCount?: number;
      };
    };
    startupJobSearch?: {
      startupRoles?: WellfoundGraphQLRole[];
      totalCount?: number;
    };
  };
}

interface WellfoundGraphQLRole {
  id?: number;
  title?: string;
  description?: string;
  applyUrl?: string;
  remote?: boolean;
  locationNames?: string[];
  skills?: string[];
  jobTypes?: string[];
  salary?: { min?: number; max?: number; currency?: string };
  equity?: string;
  createdAt?: string;
  startup?: {
    id?: number;
    name?: string;
    slug?: string;
    highConcept?: string;
    website?: string;
    stage?: string;
    markets?: Array<{ displayName?: string }>;
    badges?: string[];
  };
}

// ─── NEXT DATA TYPES ──────────────────────────────────────────────────────────

interface WellfoundNextData {
  props?: {
    pageProps?: {
      jobs?: WellfoundRawJob[];
      startupRoles?: WellfoundRawJob[];
      totalCount?: number;
      // Alternate structures seen in practice
      initialData?: {
        jobs?: WellfoundRawJob[];
        totalCount?: number;
      };
    };
  };
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const FETCH_TIMEOUT_MS   = 15_000;
const CPU_YIELD_INTERVAL = 10;
const BASE_URL           = 'https://wellfound.com';

const SLUG_ROLE_MAP: Record<string, string> = {
  'eng':        'Software Engineer',
  'backend':    'Backend Engineer',
  'frontend':   'Frontend Engineer',
  'fullstack':  'Full Stack Engineer',
  'ml':         'Machine Learning Engineer',
  'data':       'Data Engineer',
  'devops':     'DevOps Engineer',
  'mobile':     'Mobile Engineer',
  'product':    'Product Manager',
  'design':     'Product Designer',
  'security':   'Security Engineer',
  'platform':   'Platform Engineer',
};

const GRAPHQL_QUERY = `
  query JobSearch($query: String!, $page: Int!, $limit: Int!) {
    startupJobSearch(query: $query, page: $page, limit: $limit) {
      totalCount
      startupRoles {
        id title description applyUrl remote locationNames skills jobTypes equity createdAt
        salary { min max currency }
        startup {
          id name slug highConcept website stage
          markets { displayName }
          badges
        }
      }
    }
  }
`.trim();

// ─── CONNECTOR ────────────────────────────────────────────────────────────────

export class WellfoundConnector extends BaseConnector<WellfoundRawJob> {
  readonly source = 'apify-bridge' as const;  // Kept for registry compat

  async fetchPage(
    env: Env,
    ctx: FetchContext
  ): Promise<ConnectorFetchResult<WellfoundRawJob>> {
    const token = (env as any).WELLFOUND_TOKEN as string | undefined;

    // Strategy 1: GraphQL (authenticated, higher quality)
    if (token) {
      try {
        const result = await this.fetchViaGraphQL(token, ctx);
        if (result.items.length > 0) return result;
        // Zero results from GraphQL could mean auth issue — fall through to HTML
      } catch (e: any) {
        if (e.message === 'RATE_LIMIT') throw e; // propagate, don't fall through
        console.warn(`[wellfound] GraphQL failed (${e.message}), falling back to __NEXT_DATA__`);
      }
    }

    // Strategy 2: __NEXT_DATA__ HTML scraping (unauthenticated)
    return this.fetchViaNextData(ctx);
  }

  // ── Strategy 1: GraphQL ────────────────────────────────────────────────────

  private async fetchViaGraphQL(
    token: string,
    ctx: FetchContext
  ): Promise<ConnectorFetchResult<WellfoundRawJob>> {
    const role  = SLUG_ROLE_MAP[ctx.slug] ?? ctx.slug.replace(/-/g, ' ');
    const page  = Math.floor(ctx.offset / ctx.limit) + 1;

    const res = await fetch(`${BASE_URL}/graphql`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${token}`,
        'User-Agent':    'Mozilla/5.0 (compatible; JobIndexer/1.0)',
        'Origin':        BASE_URL,
        'Referer':       `${BASE_URL}/jobs`,
      },
      body: JSON.stringify({
        query:     GRAPHQL_QUERY,
        variables: { query: role, page, limit: ctx.limit },
      }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (res.status === 429 || res.status === 401) throw new Error('RATE_LIMIT');
    if (!res.ok) throw new Error(`[wellfound:graphql] HTTP ${res.status}`);

    const data  = await res.json() as WellfoundGraphQLResponse;
    const roles = data?.data?.startupJobSearch?.startupRoles ?? [];
    const total = data?.data?.startupJobSearch?.totalCount ?? 0;

    const items = roles
      .filter((r): r is WellfoundGraphQLRole & { id: number; title: string } =>
        !!r.id && !!r.title?.trim()
      )
      .map((r): WellfoundRawJob => ({
        id:               r.id,
        title:            r.title,
        description:      r.description,
        applyUrl:         r.applyUrl,
        remote:           r.remote,
        locationNames:    r.locationNames,
        skills:           r.skills,
        jobTypes:         r.jobTypes,
        salary:           r.salary,
        equity:           r.equity,
        startup:          r.startup,
        companyName:      r.startup?.name,
        companySlug:      r.startup?.slug,
        companyDescription: r.startup?.highConcept,
        companyWebsite:   r.startup?.website,
        companyStage:     r.startup?.stage,
        companyMarkets:   r.startup?.markets?.map(m => m.displayName ?? '').filter(Boolean),
        createdAt:        r.createdAt,
      }));

    return { items, totalAvailable: total };
  }

  // ── Strategy 2: __NEXT_DATA__ HTML scraping ────────────────────────────────

  private async fetchViaNextData(
    ctx: FetchContext
  ): Promise<ConnectorFetchResult<WellfoundRawJob>> {
    const role  = SLUG_ROLE_MAP[ctx.slug] ?? ctx.slug;
    const page  = Math.floor(ctx.offset / ctx.limit) + 1;

    // Wellfound's job search URL structure
    const url   = new URL(`${BASE_URL}/jobs`);
    url.searchParams.set('role', role);
    url.searchParams.set('remote', 'true');
    if (page > 1) url.searchParams.set('page', String(page));

    const res = await fetch(url.toString(), {
      headers: {
        'Accept':     'text/html,application/xhtml+xml',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (res.status === 429) throw new Error('RATE_LIMIT');
    if (res.status === 404) return { items: [] };
    if (!res.ok) throw new Error(`[wellfound:html:${ctx.slug}] HTTP ${res.status}`);

    const html  = await res.text();
    const items = this.extractNextData(html, ctx.slug);

    return { items };
  }

  private extractNextData(html: string, slug: string): WellfoundRawJob[] {
    try {
      const match = html.match(
        /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/
      );
      if (!match?.[1]) {
        console.warn(`[wellfound:html:${slug}] No __NEXT_DATA__ found`);
        return [];
      }

      const data = JSON.parse(match[1]) as WellfoundNextData;
      const pp   = data?.props?.pageProps;

      // Try multiple known page prop structures
      const roles: WellfoundRawJob[] =
        pp?.jobs ??
        pp?.startupRoles ??
        pp?.initialData?.jobs ??
        [];

      if (!Array.isArray(roles)) return [];

      return roles
        .filter(r => r.id && r.title?.trim() && (r.companyName || r.startup?.name))
        .map(r => ({
          ...r,
          companyName:      r.companyName ?? r.startup?.name,
          companySlug:      r.companySlug ?? r.startup?.slug,
          companyDescription: r.companyDescription ?? r.startup?.highConcept,
          companyWebsite:   r.companyWebsite ?? r.startup?.website,
          companyStage:     r.companyStage ?? r.startup?.stage,
          companyMarkets:   r.companyMarkets ?? r.startup?.markets?.map(m => m.displayName ?? '').filter(Boolean),
        }));

    } catch (e: any) {
      console.warn(`[wellfound:html:${slug}] __NEXT_DATA__ parse failed: ${e.message}`);
      return [];
    }
  }

  // ── Parsing ────────────────────────────────────────────────────────────────

  normalizeLocation(raw: string | undefined): string {
    if (!raw) return 'Remote';
    const lower = raw.toLowerCase().trim();
    if (/remote|anywhere|worldwide/i.test(lower)) return 'Remote';
    if (/new york|nyc/i.test(lower)) return 'New York, NY';
    if (/san francisco|sf\b/i.test(lower)) return 'San Francisco, CA';
    if (/los angeles|la\b/i.test(lower)) return 'Los Angeles, CA';
    if (/seattle/i.test(lower)) return 'Seattle, WA';
    if (/boston/i.test(lower)) return 'Boston, MA';
    if (/austin/i.test(lower)) return 'Austin, TX';
    if (/new york/i.test(lower)) return 'New York, NY';
    return raw.trim();
  }

  async parseSingle(raw: WellfoundRawJob, _label: string): Promise<NormalizedJob> {
    if (!raw.title?.trim()) throw new Error('[wellfound] Missing title');

    const company = raw.companyName?.trim() ?? raw.startup?.name?.trim();
    if (!company) throw new Error('[wellfound] Missing company name');

    const locationRaw = raw.locationNames?.[0] ?? raw.locations?.[0] ??
      (raw.remote ? 'Remote' : '');
    const location = this.normalizeLocation(locationRaw);
    const isRemote = raw.remote === true || location === 'Remote';

    const applyUrl = raw.applyUrl ?? raw.url ??
      (raw.companySlug ? `${BASE_URL}/company/${raw.companySlug}/jobs` : BASE_URL);

    const description = this.buildDescription(raw);
    const skills = (raw.skills ?? []).map(s => s.toLowerCase().trim()).filter(Boolean);

    const { salaryMin, salaryMax, salaryCurrency } = this.parseSalary(raw);

    const companyStage = raw.companyStage ?? raw.startup?.stage;
    const sourceGroup  = companyStage
      ? `wellfound-${companyStage.toLowerCase().replace(/\s+/g, '-')}`
      : 'wellfound-startup';

    const industry = raw.companyMarkets?.[0] ??
      raw.startup?.markets?.[0]?.displayName ??
      undefined;

    return {
      fingerprint:  '',
      title:        raw.title.trim(),
      company,
      location,
      description,
      apply_url:    applyUrl,
      source:       'apify-bridge',   // registry key
      source_job_id: String(raw.id),
      source_group:  sourceGroup,
      work_type:    raw.jobTypes?.[0] ?? undefined,
      industry,
      posted_at:    raw.createdAt ? new Date(raw.createdAt).toISOString() : undefined,
      is_remote:    isRemote,
      is_tech:      true,
      is_active:    true,
      enriched:     false,
      skills,
      salary_min:   salaryMin,
      salary_max:   salaryMax,
      salary_currency: salaryCurrency,
    };
  }

  private buildDescription(raw: WellfoundRawJob): string {
    const parts: string[] = [];
    if (raw.description) parts.push(raw.description);
    const companyDesc = raw.companyDescription ?? raw.startup?.highConcept;
    const companyName = raw.companyName ?? raw.startup?.name;
    if (companyDesc && companyName) {
      parts.push(`\n\n**About ${companyName}**: ${companyDesc}`);
    }
    if (raw.equity) {
      parts.push(`\n*Equity: ${raw.equity}*`);
    }
    return parts.join('').trim();
  }

  private parseSalary(raw: WellfoundRawJob): {
    salaryMin?: number;
    salaryMax?: number;
    salaryCurrency: string;
  } {
    // Structured salary from GraphQL
    if (raw.salary?.min || raw.salary?.max) {
      return {
        salaryMin:      raw.salary.min,
        salaryMax:      raw.salary.max,
        salaryCurrency: raw.salary.currency ?? 'USD',
      };
    }
    // String salary range: "$120k - $180k"
    if (raw.salaryRange) {
      try {
        const clean = raw.salaryRange.replace(/[$,]/g, '').toLowerCase();
        const kMult = /k/.test(clean) ? 1_000 : 1;
        const nums  = clean.match(/\d+(?:\.\d+)?/g);
        if (nums) {
          return {
            salaryMin:      Math.round(parseFloat(nums[0]) * kMult),
            salaryMax:      nums[1] ? Math.round(parseFloat(nums[1]) * kMult) : undefined,
            salaryCurrency: 'USD',
          };
        }
      } catch { /* ignore */ }
    }
    return { salaryCurrency: 'USD' };
  }
}

export const wellfoundConnector = new WellfoundConnector();
