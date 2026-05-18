import { DiscoveryAdapter } from '../../config/sources';
import { fetchWithRetry } from '../../pipeline/fetch';

/**
 * Greenhouse Discovery Adapter
 * Discovers company slugs that use Greenhouse for their job boards.
 */
export const greenhouseDiscovery: DiscoveryAdapter = {
  async discover(_env): Promise<{ slugs: Array<{ company_slug: string; company_name_hint?: string }> }> {
    try {
      const slugs: Map<string, { company_slug: string; company_name_hint?: string }> = new Map();

      // Source A — Hardcoded seed list (always included, never fails)
      const SEED_SLUGS = [
        'stripe', 'notion', 'linear', 'vercel', 'figma', 'retool', 'airtable', 'rippling', 'brex', 'ramp',
        'scale-ai', 'cohere', 'anthropic', 'openai', 'mistral', 'huggingface', 'databricks', 'snowflake',
        'mongodb', 'hashicorp', 'datadog', 'pagerduty', 'grafana', 'postman', 'segment', 'amplitude',
        'mixpanel', 'heap', 'fullstory', 'launchdarkly', 'split', 'honeycomb', 'sentry', 'bugsnag',
        'cloudflare', 'fastly', 'fly', 'railway', 'render', 'netlify', 'supabase', 'neon', 'planetscale',
        'cockroachdb', 'yugabyte', 'crunchy-data', 'tembo', 'turso'
      ];

      for (const slug of SEED_SLUGS) {
        slugs.set(slug, { company_slug: slug });
      }

      // Source B — Aggregator scrape (best-effort, skip on failure)
      try {
        const response = await fetchWithRetry('https://www.ycombinator.com/companies', {
          headers: {
            'User-Agent': 'HireMax Discovery/1.0'
          }
        });

        if (response.ok) {
          const text = await response.text();
          // Regex: boards.greenhouse.io/{slug} or boards.greenhouse.io/v1/boards/{slug}
          const regex = /boards\.greenhouse\.io(?:\/v1\/boards)?\/([a-z0-9_-]+)/gi;
          let match;
          
          while ((match = regex.exec(text)) !== null) {
            const slug = match[1].toLowerCase();
            if (!slugs.has(slug)) {
              slugs.set(slug, { company_slug: slug });
            }
            
            // Stop early if we hit a reasonable threshold before dedupe to save processing
            if (slugs.size >= 500) break;
          }
        }
      } catch (error) {
        // Best effort only. If scrape fails, Source A is sufficient.
        console.error('[GreenhouseDiscovery] Scrape failed:', error);
      }

      // Convert to array and limit to 200 total results
      const finalSlugs = Array.from(slugs.values()).slice(0, 200);

      return { slugs: finalSlugs };
    } catch (error) {
      console.error('[GreenhouseDiscovery] Fatal error:', error);
      return { slugs: [] };
    }
  }
};
