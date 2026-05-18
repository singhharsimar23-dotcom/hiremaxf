// ═══════════════════════════════════════════════════════════════════════════════
// infra/workers/core/fetchers/personio.ts
// Personio XML Fetcher
// ═══════════════════════════════════════════════════════════════════════════════

import { Env } from '../workers/types/job.ts';
import { parseRSS } from '../../core/shared/utils/rss.ts';

/**
 * Fetch jobs from Personio.
 * slug is the company subdomain.
 */
export async function fetchPersonioJobs(
  _env: Env,
  slug: string, 
  _offset: number = 0, 
  _limit: number = 100
): Promise<any[]> {
  if (!slug) return [];
  const url = `https://${slug}.personio.de/xml`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Personio fetch failed for ${slug} with status ${res.status}`);
  }

  const xml = await res.text();
  // Personio uses <position> tags instead of <item> in some feeds, 
  // but many also support standard RSS or can be parsed with similar logic.
  // I will use a regex variant for <position> if <item> is missing.
  let items = parseRSS(xml);
  if (items.length === 0) {
      const positionRegex = /<position>([\s\S]*?)<\/position>/g;
      let match;
      while ((match = positionRegex.exec(xml)) !== null) {
          const content = match[1];
          items.push({
              title: content.match(/<name>([\s\S]*?)<\/name>/i)?.[1].trim() || '',
              link: content.match(/<id>([\s\S]*?)<\/id>/i)?.[1].trim() || '', // ID as fallback link
              description: content.match(/<jobDescription>([\s\S]*?)<\/jobDescription>/i)?.[1].trim() || '',
              location: content.match(/<office>([\s\S]*?)<\/office>/i)?.[1].trim() || 'Remote',
              id: content.match(/<id>([\s\S]*?)<\/id>/i)?.[1].trim() || ''
          });
      }
  }
  return items;
}

