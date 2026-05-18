import { RawJob } from '../types/job';
import { Env } from './env';

/**
 * Interface for fetching jobs from a specific source (ATS).
 */
export interface SourceAdapter {
  fetch(env: Env, companySlug: string, cursor: number, signal: AbortSignal): Promise<{ jobs: RawJob[]; nextCursor: number }>;
}

/**
 * Interface for discovering companies associated with a specific source.
 */
export interface DiscoveryAdapter {
  discover(env: Env): Promise<{ slugs: Array<{ company_slug: string; company_name_hint?: string }> }>;
}

/**
 * Canonical Source IDs for all supported ATS providers.
 */
export const SOURCE_IDS = {
  GREENHOUSE: 'greenhouse',
  LEVER: 'lever',
  ASHBY: 'ashby',
} as const;

export type SourceId = (typeof SOURCE_IDS)[keyof typeof SOURCE_IDS];

/**
 * Tiered priority for source execution.
 * ALPHA sources are critical and must always have registered adapters at boot.
 */
export const TIERS = {
  ALPHA: [SOURCE_IDS.GREENHOUSE, SOURCE_IDS.LEVER, SOURCE_IDS.ASHBY] as SourceId[],
  BETA: [] as SourceId[],
  GAMMA: [] as SourceId[],
} as const;

/**
 * Registry for managing source adapters and discovery logic.
 * Enforces ALPHA tier completeness at instantiation.
 */
export class SourceRegistry {
  private static adapters = new Map<SourceId, SourceAdapter>();
  private static discoveries = new Map<SourceId, DiscoveryAdapter>();

  constructor() {
    // constructor throws if any ALPHA source has no registered adapter (catches missing adapter bugs at boot)
    for (const sourceId of TIERS.ALPHA) {
      if (!SourceRegistry.adapters.has(sourceId)) {
        throw new Error(`SourceRegistry initialization failed: Missing adapter for ALPHA source "${sourceId}". All ALPHA adapters must be registered before the registry is instantiated at boot.`);
      }
    }
  }

  /**
   * Registers an adapter for a specific source.
   */
  registerAdapter(sourceId: SourceId, adapter: SourceAdapter): void {
    SourceRegistry.adapters.set(sourceId, adapter);
  }

  /**
   * Registers a discovery adapter for a specific source.
   */
  registerDiscovery(sourceId: SourceId, adapter: DiscoveryAdapter): void {
    SourceRegistry.discoveries.set(sourceId, adapter);
  }

  /**
   * Retrieves the adapter for a given source ID. Throws if not found.
   */
  getAdapter(sourceId: SourceId): SourceAdapter {
    const adapter = SourceRegistry.adapters.get(sourceId);
    if (!adapter) {
      throw new Error(`No adapter registered for source ID: ${sourceId}`);
    }
    return adapter;
  }

  /**
   * Retrieves the discovery adapter for a given source ID. Throws if not found.
   */
  getDiscovery(sourceId: SourceId): DiscoveryAdapter {
    const discovery = SourceRegistry.discoveries.get(sourceId);
    if (!discovery) {
      throw new Error(`No discovery adapter registered for source ID: ${sourceId}`);
    }
    return discovery;
  }

  /**
   * Returns all ALPHA source IDs.
   */
  getAllAlpha(): SourceId[] {
    return [...TIERS.ALPHA];
  }

  /**
   * Returns all GAMMA source IDs.
   */
  getAllGamma(): SourceId[] {
    return [...TIERS.GAMMA];
  }
}
