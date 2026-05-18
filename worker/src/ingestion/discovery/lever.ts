import { DiscoveryAdapter } from '../../config/sources';

/**
 * Lever Discovery Adapter
 * Discovers company slugs that use Lever for their job boards.
 * Lever slugs typically match company names closely.
 */
export const leverDiscovery: DiscoveryAdapter = {
  async discover(_env): Promise<{ slugs: Array<{ company_slug: string; company_name_hint?: string }> }> {
    try {
      // Seed list only — Lever slugs match company name closely
      const SEED_SLUGS = [
        'stripe', 'notion', 'linear', 'vercel', 'figma', 'rippling', 'brex', 'ramp', 'airtable', 'retool',
        'scale-ai', 'cohere', 'anthropic', 'openai', 'databricks', 'snowflake', 'mongodb', 'datadog',
        'pagerduty', 'postman', 'segment', 'amplitude', 'mixpanel', 'launchdarkly', 'cloudflare',
        'netlify', 'supabase', 'cockroachdb', 'plaid', 'chime', 'robinhood', 'coinbase', 'kraken',
        'gemini', 'anchorage', 'alchemy', 'metamask', 'consensys', 'chainalysis', 'nansen',
        'carta', 'capchase', 'pipe', 'clearco', 'arc', 'runway', 'rho'
      ];

      return {
        slugs: SEED_SLUGS.map(slug => ({ company_slug: slug }))
      };
    } catch (error) {
      console.error('[LeverDiscovery] Fatal error:', error);
      return { slugs: [] };
    }
  }
};
