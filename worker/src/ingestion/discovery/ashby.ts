import { DiscoveryAdapter } from '../../config/sources';

/**
 * Ashby Discovery Adapter
 * Discovers company slugs that use Ashby for their job boards.
 */
export const ashbyDiscovery: DiscoveryAdapter = {
  async discover(_env): Promise<{ slugs: Array<{ company_slug: string; company_name_hint?: string }> }> {
    try {
      // Seed list for Ashby
      const SEED_SLUGS = [
        'ashby', 'linear', 'deel', 'remote', 'rippling', 'merge', 'workos', 'clerk', 'stytch', 'ory',
        'auth0', 'okta', 'jumpcloud', 'drata', 'vanta', 'secureframe', 'tugboat-logic', 'sprinto',
        'comply', 'anecdotes', 'riskonnect', 'navex', 'ethicontrol', 'convercent'
      ];

      return {
        slugs: SEED_SLUGS.map(slug => ({ company_slug: slug }))
      };
    } catch (error) {
      console.error('[AshbyDiscovery] Fatal error:', error);
      return { slugs: [] };
    }
  }
};
