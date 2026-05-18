// ═══════════════════════════════════════════════════════════════════════════════
// infra/workers/core/fetchers/jobvite.ts
// Jobvite XML Fetcher
// ═══════════════════════════════════════════════════════════════════════════════

import { Env } from '../workers/types/job.ts';
import { parseRSS } from '../../core/shared/utils/rss.ts';

/**
 * Fetch jobs from Jobvite.
 * slug is the company ID.
 */
export async function fetchJobviteJobs(
  _env: Env,
  slug: string, 
  _offset: number = 0, 
  _limit: number = 100
): Promise<any[]> {
  if (!slug) return [];
  const url = `https://app.jobvite.com/CompanyJobs/Xml.aspx?c=${slug}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Jobvite fetch failed for ${slug} with status ${res.status}`);
  }

  const xml = await res.text();
  // Jobvite uses <job> tags instead of <item>
  let items = parseRSS(xml);
  if (items.length === 0) {
      const jobRegex = /<job>([\s\S]*?)<\/job>/g;
      let match;
      while ((match = jobRegex.exec(xml)) !== null) {
          const content = match[1];
          items.push({
              title: content.match(/<title>([\s\S]*?)<\/title>/i)?.[1].trim() || '',
              link: content.match(/<detail-url>([\s\S]*?)<\/detail-url>/i)?.[1].trim() || '',
              description: content.match(/<description>([\s\S]*?)<\/description>/i)?.[1].trim() || '',
              location: content.match(/<location>([\s\S]*?)<\/location>/i)?.[1].trim() || 'Remote',
              id: content.match(/<id>([\s\S]*?)<\/id>/i)?.[1].trim() || ''
          });
      }
  }
  return items;
}

