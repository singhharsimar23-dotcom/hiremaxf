/**
 * infra/adapters/workday_universal.ts
 * Universal Workday Connector — V1.0
 *
 * WHY THIS MATTERS:
 * Workday powers job boards for 3,000+ enterprises. Every major company
 * not on Greenhouse/Lever is almost certainly on Workday: Apple, Microsoft,
 * NVIDIA, Oracle, Salesforce, Adobe, Qualcomm, Intel, AMD, Cisco, and hundreds
 * of FinTech / HealthTech scale-ups.
 */

import { BaseConnector, type FetchContext, type ConnectorFetchResult } from '../../core/ingestion-engine/core/base_connector.ts';
import type { NormalizedJob } from '../../core/ingestion-engine/core/types.ts';
import type { Env } from '../workers/types/job.ts';

// ─── RAW TYPE ─────────────────────────────────────────────────────────────────

interface WorkdayLocation {
  locations?: Array<{ descriptor?: string }>;
}

interface WorkdayRawJob {
  id?: string;
  title?: string;
  externalPath?: string;
  locationsText?: string;
  postedOn?: string;
  bulletFields?: string[];
  jobReqId?: string;
  // nested variants across WD versions
  jobFamilyGroup?: Array<{ descriptor?: string }>;
  workerSubType?: Array<{ descriptor?: string }>;
  timeType?: Array<{ descriptor?: string }>;
  // V2 location format
  primaryLocation?: { descriptor?: string };
  allLocations?: Array<{ descriptor?: string }>;
}

// ─── KNOWN TECH COMPANY REGISTRY ─────────────────────────────────────────────
// Slug = "{tenant}:{board}:{version}"

export const WORKDAY_TECH_REGISTRY: Record<string, string> = {
  'apple':        'apple:Apple_External_Careers:wd1',
  'nvidia':       'nvidia:NvidiaExternal:wd5',
  'salesforce':   'salesforce:External:wd12',
  'adobe':        'adobe:External:wd5',
  'oracle':       'oracle:External:wd1',
  'cisco':        'cisco:Cisco:wd5',
  'qualcomm':     'qualcomm:External:wd5',
  'amd':          'amd:External:wd5',
  'intel':        'intel:External:5',
  'vmware':       'vmware:External:5',
  'square':       'square:global:5',
  'paypal':       'paypal:External:5',
  'visa':         'visa:Careers:5',
  'mastercard':   'mastercard:External:5',
  'intuit':       'intuit:External:5',
  'blackrock':    'blackrock:External:5',
  'pagerduty':    'pagerduty:External:5',
  'hashicorp':    'hashicorp:External:5',
  'twilio':       'twilio:Twilio:5',
  'zendesk':      'zendesk:Zendesk:5',
  'workday':      'workday:External:5',
  'splunk':       'splunk:External:5',
  'toast':        'toast:External:5',
  'samsara':      'samsara:External:5',
  'figma':        'figma:External:5',
  'duolingo':     'duolingo:External:5',
  'instacart':    'instacart:External:5',
  'lyft':         'lyft:External:5',
  'palantir':     'palantir:External:5',
  'databricks':   'databricks:External:5',
};

// ─── CONNECTOR ────────────────────────────────────────────────────────────────

export class WorkdayUniversalConnector extends BaseConnector<WorkdayRawJob> {
  readonly source = 'workday' as const;

  private parseSlug(slug: string): { tenant: string; board: string; version: string } {
    const parts = slug.split(':');
    if (parts.length < 3) {
      throw new Error(`[workday] Invalid slug "${slug}" — expected "tenant:board:version"`);
    }
    return { tenant: parts[0], board: parts[1], version: parts[2] };
  }

  private buildApiUrl(tenant: string, board: string, version: string): string {
    const subdomain = version ? `${tenant}.${version}` : tenant;
    return `https://${subdomain}.myworkdayjobs.com/wday/cxs/${tenant}/${board}/jobs`;
  }

  private buildJobUrl(tenant: string, board: string, version: string, externalPath: string): string {
    const subdomain = version ? `${tenant}.${version}` : tenant;
    return `https://${subdomain}.myworkdayjobs.com${externalPath}`;
  }

  async fetchPage(
    _env: Env,
    ctx: FetchContext
  ): Promise<ConnectorFetchResult<WorkdayRawJob>> {
    const resolvedSlug = WORKDAY_TECH_REGISTRY[ctx.slug] || ctx.slug;
    const { tenant, board, version } = this.parseSlug(resolvedSlug);
    const url = this.buildApiUrl(tenant, board, version);

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Calypso-CSRF-Token': '1',
        'User-Agent': 'Mozilla/5.0 (compatible; JobIndexer/1.0)',
      },
      body: JSON.stringify({
        appliedFacets: {},
        limit: ctx.limit,
        offset: ctx.offset,
        searchText: '',
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (res.status === 429 || res.status === 403) {
      throw new Error('RATE_LIMIT');
    }
    if (res.status === 404) {
      throw new Error(`SOURCE_NOT_FOUND: ${ctx.slug}`);
    }
    if (!res.ok) {
      throw new Error(`[workday:${ctx.slug}] HTTP ${res.status}`);
    }

    const data = await res.json() as { total?: number; jobPostings?: WorkdayRawJob[] };
    const items = data.jobPostings ?? [];

    // Enrich each item with tenant metadata for parse step
    const enriched = items.map(j => ({
      ...j,
      _tenant: tenant,
      _board: board,
      _version: version,
    } as WorkdayRawJob & Record<string, string>));

    return {
      items: enriched as WorkdayRawJob[],
      totalAvailable: data.total,
    };
  }

  async parseSingle(raw: WorkdayRawJob & Record<string, any>, label: string): Promise<NormalizedJob> {
    const tenant  = raw._tenant  ?? '';
    const board   = raw._board   ?? '';
    const version = raw._version ?? '5';

    const title = raw.title?.trim() ?? '';
    if (!title) throw new Error('[workday] Missing title');

    // Location: Workday gives a flat string or nested array depending on version
    const locationRaw =
      raw.locationsText ??
      raw.primaryLocation?.descriptor ??
      raw.allLocations?.[0]?.descriptor ??
      '';

    const location = this.normalizeLocation(locationRaw);

    // Build canonical apply URL from externalPath
    const applyUrl = raw.externalPath
      ? this.buildJobUrl(tenant, board, version, raw.externalPath)
      : `https://${tenant}.wd${version}.myworkdayjobs.com/en-US/${board}`;

    // Extract description bullets if present (Workday often omits full description from list API)
    const descriptionParts = raw.bulletFields?.filter(Boolean) ?? [];
    const description = descriptionParts.join('\n');

    // Work type from timeType/workerSubType
    const workType =
      raw.timeType?.[0]?.descriptor ??
      raw.workerSubType?.[0]?.descriptor ??
      '';

    const isRemote = /remote/i.test(location) || /remote/i.test(locationRaw);

    return {
      fingerprint: '',          // set by generateIdentity
      title,
      company: label,
      location,
      description,
      apply_url: applyUrl,
      source: 'workday',
      source_job_id: raw.jobReqId ?? raw.id ?? raw.externalPath ?? applyUrl,
      role_family: raw.jobFamilyGroup?.[0]?.descriptor,
      work_type: workType || undefined,
      posted_at: raw.postedOn ? new Date(raw.postedOn).toISOString() : undefined,
      is_remote: isRemote,
      is_tech: true,
      is_active: true,
      enriched: false,
      skills: [],
      salary_currency: 'USD',
    };
  }
}

export const workdayConnector = new WorkdayUniversalConnector();
