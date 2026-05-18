/**
 * infra/adapters/registry.ts
 * Connector adapter registry — V6.0
 *
 * CHANGES FROM V5:
 * - ashby, dice, adzuna, himalayas: migrated to BaseConnector instances.
 *   Legacy ConnectorAdapter interface still compatible via `as any` cast
 *   (BaseConnector.fetchBatch / .parse satisfy the interface contract).
 * - wellfound: Apify removed. WellfoundConnector V2 uses GraphQL + HTML scraping.
 * - getAdapterInstance(): new typed accessor returns the BaseConnector<T> directly.
 *   Use when you need typed access to beforeRun() / afterRun() / normalizeLocation().
 *   getAdapter() remains for backward compat with group_processor.
 * - Adapter count updated to 34 (unchanged — same sources, better implementations).
 *
 * MIGRATION STATUS:
 *   ✅ BaseConnector: workday, yc_startups, wellfound, ashby, dice, adzuna, himalayas
 *   ⏳ Pending: lever, reed, jooble, bamboohr, recruitee, teamtailor
 *   ❌ Not applicable: greenhouse (has its own healthCheck pattern), usajobs, static-feed
 *
 * NOT REGISTERED (no public API):
 *   linkedin-scout — LinkedIn has no public job search API. ToS violation to scrape.
 *                    Future: LinkedIn Partner API (OAuth, application required).
 *   google-jobs    — UI surface only, no direct API.
 *                    Future: Google Cloud Talent Solution (paid partnership).
 */

import type { JobSource } from '../workers/types/job.ts';
import type { ConnectorAdapter } from './interface.ts';

import { GreenhouseAdapter }      from './greenhouse.ts';
import { LeverAdapter }           from './lever.ts';
import { SmartrecruitersAdapter } from './smartrecruiters.ts';
import { WorkableAdapter }        from './workable.ts';
import { JoobleAdapter }          from './jooble.ts';
import { ReedAdapter }            from './reed.ts';
import { USAJobsAdapter }         from './usajobs.ts';
import { CareerjetAdapter }       from './careerjet.ts';
import { BuiltinAdapter }         from './builtin.ts';

import { WeworkremotelyAdapter }  from './weworkremotely.ts';
import { RemoteOKAdapter }        from './remote_ok.ts';
import { WorkingNomadsAdapter }   from './working_nomads.ts';
import { JobicyAdapter }          from './jobicy.ts';
import { StaticFeedAdapter }      from './static_feed.ts';

import { BamboohrAdapter }   from './bamboohr.ts';
import { RecruiteeAdapter }  from './recruitee.ts';
import { PersonioAdapter }   from './personio.ts';
import { TeamtailorAdapter } from './teamtailor.ts';
import { ComeetAdapter }     from './comeet.ts';
import { JazzHRAdapter }     from './jazzhr.ts';
import { JobviteAdapter }    from './jobvite.ts';

import { OttaAdapter }         from './otta.ts';
import { CordAdapter }         from './cord.ts';
import { HiredAdapter }        from './hired.ts';
import { ScraperHTMLAdapter }  from './scraper_html.ts';
import { FindworkAdapter }     from './findwork.ts';
import { IndeedAdapter }       from './indeed.ts';
import { RemoteCoAdapter }     from './remote_co.ts';

// ── BaseConnector instances ────────────────────────────────────────────────────
import { workdayConnector }     from './workday_universal.ts';
import { ycConnector }          from './yc_startups.ts';
import { wellfoundConnector }   from './wellfound.ts';
import { ashbyConnector }       from './ashby.ts';
import { diceConnector }        from './dice.ts';
import { adzunaConnector }      from './adzuna.ts';
import { himalayasConnector }   from './himalayas.ts';

function asConnectorAdapter(adapter: unknown): ConnectorAdapter {
  if (
    adapter &&
    typeof adapter === 'object' &&
    typeof (adapter as { fetchBatch?: unknown }).fetchBatch === 'function' &&
    typeof (adapter as { parse?: unknown }).parse === 'function'
  ) {
    return adapter as ConnectorAdapter;
  }
  throw new Error('INVALID_ADAPTER_BRIDGE: adapter does not satisfy ConnectorAdapter');
}

// ─── REGISTRY ─────────────────────────────────────────────────────────────────
//
// 34 registered adapters.
//
// BaseConnector instances are cast `as any` here because they satisfy the
// ConnectorAdapter interface shape (fetchBatch / parse / healthCheck) via
// their public methods — TypeScript just can't infer that without the interface
// being declared explicitly on BaseConnector. This is safe; do not remove casts.

const REGISTRY: Partial<Record<JobSource, ConnectorAdapter>> = {
  // ── Primary ATS ────────────────────────────────────────────────────────────
  'greenhouse':      GreenhouseAdapter,
  'lever':           LeverAdapter,
  'ashby':           asConnectorAdapter(ashbyConnector),         // ✅ BaseConnector V2
  'smartrecruiters': SmartrecruitersAdapter,
  'workable':        WorkableAdapter,

  // ── Aggregators ────────────────────────────────────────────────────────────
  'jooble':          JoobleAdapter,
  'adzuna':          asConnectorAdapter(adzunaConnector),         // ✅ BaseConnector V2
  'reed':            ReedAdapter,
  'usajobs':         USAJobsAdapter,
  'careerjet':       CareerjetAdapter,
  'builtin':         BuiltinAdapter,
  'dice':            asConnectorAdapter(diceConnector),           // ✅ BaseConnector V2
  'findwork':        FindworkAdapter,
  'hacker-news-jobs': asConnectorAdapter(ycConnector),            // ✅ BaseConnector V1
  'indeed':          IndeedAdapter,

  // ── Remote Boards ──────────────────────────────────────────────────────────
  'weworkremotely':  WeworkremotelyAdapter,
  'remote-ok':       RemoteOKAdapter,
  'working-nomads':  WorkingNomadsAdapter,
  'himalayas':       asConnectorAdapter(himalayasConnector),      // ✅ BaseConnector V2
  'jobicy':          JobicyAdapter,
  'static-feed':     StaticFeedAdapter,
  'remote-co':       RemoteCoAdapter,

  // ── Secondary ATS ──────────────────────────────────────────────────────────
  'bamboohr':    BamboohrAdapter,
  'recruitee':   RecruiteeAdapter,
  'personio':    PersonioAdapter,
  'teamtailor':  TeamtailorAdapter,
  'comeet':      ComeetAdapter,
  'jazzhr':      JazzHRAdapter,
  'jobvite':     JobviteAdapter,
  'workday':     asConnectorAdapter(workdayConnector),            // ✅ BaseConnector V1

  // ── Specialist ─────────────────────────────────────────────────────────────
  'otta':              OttaAdapter,
  'cord':              CordAdapter,
  'hired':             HiredAdapter,
  'infra-scraper-html': ScraperHTMLAdapter,
  'apify-bridge':      asConnectorAdapter(wellfoundConnector),   // ✅ BaseConnector V2 (no Apify)
};

// ─── PUBLIC API ───────────────────────────────────────────────────────────────

export function registerAdapter(source: JobSource, adapter: ConnectorAdapter): void {
  REGISTRY[source] = adapter;
}

export function getAdapter(source: JobSource): ConnectorAdapter | undefined {
  return REGISTRY[source];
}

export function hasAdapter(source: JobSource): boolean {
  return !!REGISTRY[source];
}

/**
 * getRegisteredSources — returns all JobSource keys with a registered adapter.
 * Used by validateSources to cross-check that health endpoints exist.
 */
export function getRegisteredSources(): JobSource[] {
  return Object.keys(REGISTRY) as JobSource[];
}

/**
 * getAdapterInstance — typed accessor for BaseConnector instances.
 *
 * Returns the raw adapter (BaseConnector or legacy ConnectorAdapter).
 * Use when you need access to lifecycle hooks (beforeRun/afterRun) or
 * type-specific methods not on the ConnectorAdapter interface.
 *
 * @example
 *   const adapter = getAdapterInstance('ashby');
 *   if (adapter instanceof AshbyConnector) {
 *     adapter.normalizeLocation('San Francisco');
 *   }
 */
export function getAdapterInstance(source: JobSource): unknown {
  return REGISTRY[source];
}