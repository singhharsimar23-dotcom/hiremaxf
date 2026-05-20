/**
 * contracts/adapter.contract.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * PURPOSE: Single Source of Truth for what every adapter MUST expose.
 *
 * This contract is derived from:
 *   - infra/adapters/registry.ts  (which sources are registered)
 *   - infra/adapters/interface.ts (what methods ConnectorAdapter requires)
 *   - infra/workers/config/sources.ts (which sources are enabled)
 *
 * RULE: Do NOT add sources here that don't exist in registry.ts.
 * RULE: Do NOT remove sources here that registry.ts has registered.
 * RULE: This file must be updated whenever registry.ts changes.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * The set of methods every adapter MUST implement.
 * Derived from: infra/adapters/interface.ts → ConnectorAdapter
 */
export const REQUIRED_ADAPTER_METHODS = ['fetchBatch', 'parse'] as const;

/**
 * The set of methods that are optional but validated if present.
 * Derived from: infra/adapters/interface.ts → ConnectorAdapter
 */
export const OPTIONAL_ADAPTER_METHODS = ['healthCheck'] as const;

export type RequiredMethod = typeof REQUIRED_ADAPTER_METHODS[number];
export type OptionalMethod = typeof OPTIONAL_ADAPTER_METHODS[number];

/**
 * Full list of registered JobSources.
 * Derived from: infra/adapters/registry.ts REGISTRY object (lines 54-97).
 *
 * VERIFIED: Every entry here corresponds to an active import + REGISTRY key.
 */
export const REGISTERED_SOURCES = [
  'indeed',
  // ATS Tier — ALPHA sources
  'greenhouse',
  'lever',
  'ashby',
  'smartrecruiters',
  'workable',

  // Aggregators/Boards — BETA sources
  'jooble',
  'adzuna',
  'reed',
  'usajobs',
  'careerjet',
  'builtin',
  'dice',
  'findwork',

  // Scrapers/Specialists
  'hacker-news-jobs',
  'google-jobs',
  'linkedin-scout',
  'otta',
  'cord',
  'hired',
  'remote-co',
  'infra-scraper-html',
  'apify-bridge',

  // Remote-first boards — GAMMA sources
  'weworkremotely',
  'remote-ok',
  'working-nomads',
  'himalayas',
  'jobicy',
  'static-feed',

  // Secondary ATS
  'bamboohr',
  'recruitee',
  'personio',
  'teamtailor',
  'comeet',
  'jazzhr',
  'jobvite',
  'workday',
] as const;

export type RegisteredSource = typeof REGISTERED_SOURCES[number];

/**
 * Maps each source to the adapter file that implements it.
 * Derived from: infra/adapters/registry.ts imports (lines 9-50).
 * This is used by the preflight to know EXACTLY which file to inspect.
 */
export const SOURCE_TO_ADAPTER_FILE: Record<RegisteredSource, string> = {
  'greenhouse':       'infra/adapters/greenhouse.ts',
  'lever':            'infra/adapters/lever.ts',
  'ashby':            'infra/adapters/ashby.ts',
  'smartrecruiters':  'infra/adapters/smartrecruiters.ts',
  'workable':         'infra/adapters/workable.ts',
  'jooble':           'infra/adapters/jooble.ts',
  'adzuna':           'infra/adapters/adzuna.ts',
  'reed':             'infra/adapters/reed.ts',
  'usajobs':          'infra/adapters/usajobs.ts',
  'careerjet':        'infra/adapters/careerjet.ts',
  'builtin':          'infra/adapters/builtin.ts',
  'dice':             'infra/adapters/dice.ts',
  'findwork':         'infra/adapters/findwork.ts',
  'hacker-news-jobs': 'infra/adapters/yc_startups.ts',
  'google-jobs':      'infra/adapters/google_jobs.ts',
  'linkedin-scout':   'infra/adapters/linkedin_scout.ts',
  'otta':             'infra/adapters/otta.ts',
  'cord':             'infra/adapters/cord.ts',
  'hired':            'infra/adapters/hired.ts',
  'remote-co':        'infra/adapters/remote_co.ts',
  'infra-scraper-html': 'infra/adapters/scraper_html.ts',
  'weworkremotely':   'infra/adapters/weworkremotely.ts',
  'remote-ok':        'infra/adapters/remote_ok.ts',
  'working-nomads':   'infra/adapters/working_nomads.ts',
  'himalayas':        'infra/adapters/himalayas.ts',
  'jobicy':           'infra/adapters/jobicy.ts',
  'static-feed':      'infra/adapters/static_feed.ts',
  'bamboohr':         'infra/adapters/bamboohr.ts',
  'recruitee':        'infra/adapters/recruitee.ts',
  'personio':         'infra/adapters/personio.ts',
  'teamtailor':       'infra/adapters/teamtailor.ts',
  'comeet':           'infra/adapters/comeet.ts',
  'jazzhr':           'infra/adapters/jazzhr.ts',
  'jobvite':          'infra/adapters/jobvite.ts',
  'workday':          'infra/adapters/workday_universal.ts',
  'indeed':           'infra/adapters/indeed.ts',
  'apify-bridge':     'infra/adapters/wellfound.ts',
};

/**
 * Sources that are ENABLED in sources.ts and must have working adapters.
 * A source being registered is not enough — it must also appear in enabled sources
 * to be included in the HARD FAIL set during preflight.
 *
 * Derived from: infra/workers/config/sources.ts
 * ALL records with enabled=true or enabled=undefined (defaults to true).
 * EXCLUDED: google (enabled: false), meta (enabled: false)
 */
export const ENABLED_SOURCES_IN_PIPELINE: RegisteredSource[] = [
  // ALPHA enabled
  'greenhouse',
  'lever',
  'indeed',
  // BETA enabled
  'ashby',
  'smartrecruiters',
  'workable',
  'adzuna',
  'himalayas',
  // GAMMA enabled
  'working-nomads',
  'remote-ok',
  'static-feed',
  'hacker-news-jobs',
];

/**
 * The NormalizedJob fields that the preflight simulation MUST find in parsed output.
 * Derived from: core/ingestion-engine/core/types.ts → NormalizedJobSchema (required fields)
 * Only fields that are .min(1) or required (no .optional()) are listed here.
 */
export const REQUIRED_JOB_FIELDS = [
  'title',
  'company',
  'apply_url',
  'source',
  'source_job_id',
  'fingerprint',
] as const;

export type RequiredJobField = typeof REQUIRED_JOB_FIELDS[number];
