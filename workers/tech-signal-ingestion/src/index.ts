// HireMax Tech Signal Ingestion Worker
// Cron: 0 2 * * *

interface Env {
  ENVIRONMENT: string;
  DOMAIN_SIGNAL_PROCESSOR: Fetcher;
  INTELLIGENCE_KV: KVNamespace;
}

const CATEGORIES = ['cs.AI', 'cs.LG', 'cs.CL', 'cs.CV'];
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function getArxivDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

async function fetchArxivCount(cat: string, startDateStr: string, endDateStr: string): Promise<number> {
  const url = `https://export.arxiv.org/api/query?search_query=cat:${cat}+AND+submittedDate:[${startDateStr}0000+TO+${endDateStr}2359]&start=0&max_results=1`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 HireMax/1.0 (contact: harsimar@hiremax.site)'
    }
  });
  if (!res.ok) {
    throw new Error(`ArXiv API returned status ${res.status}: ${await res.text()}`);
  }
  const text = await res.text();
  const match = text.match(/<opensearch:totalResults[^>]*>(\d+)<\/opensearch:totalResults>/) ||
                text.match(/<totalResults[^>]*>(\d+)<\/totalResults>/);
  return match ? parseInt(match[1], 10) : 0;
}

async function runIngestion(env: Env): Promise<Record<string, unknown>> {
  const results: Record<string, string> = {};

  const today = new Date();
  const todayStr = getArxivDateString(today);

  // 7 days ago
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(today.getDate() - 7);
  const sevenDaysAgoStr = getArxivDateString(sevenDaysAgo);

  for (const cat of CATEGORIES) {
    console.log(`[ArXiv] Processing category ${cat}...`);
    try {
      // 1. Fetch 7-day count
      const sevenDayCount = await fetchArxivCount(cat, sevenDaysAgoStr, todayStr);
      console.log(`[ArXiv] 7-day count for ${cat}: ${sevenDayCount}`);
      await sleep(3000); // 3s delay to respect arXiv rate limit

      // 2. Fetch today's count
      const todayCount = await fetchArxivCount(cat, todayStr, todayStr);
      console.log(`[ArXiv] Today count for ${cat}: ${todayCount}`);
      await sleep(3000); // 3s delay

      // 3. Retrieve or seed daily counts for the last 100 days using centralized history object to optimize KV subrequests
      const seriesKey = `arxiv_series:${cat}`;
      let history: Record<string, number> = {};
      const kvVal = await env.INTELLIGENCE_KV.get(seriesKey);
      if (kvVal) {
        try {
          history = JSON.parse(kvVal);
        } catch (e) {
          console.error(`[ArXiv] Failed to parse history for ${cat}:`, e);
        }
      }

      // Add today's count
      history[todayStr] = todayCount;

      const dailyCounts: number[] = [];
      const baseDailyRate = Math.round(sevenDayCount / 7);

      for (let i = 99; i >= 0; i--) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        const dStr = getArxivDateString(d);

        if (history[dStr] !== undefined) {
          dailyCounts.push(history[dStr]);
        } else {
          // Seed locally
          history[dStr] = baseDailyRate;
          dailyCounts.push(baseDailyRate);
        }
      }

      // Prune keys older than 120 days to keep KV size bounded
      const limitDate = new Date();
      limitDate.setDate(today.getDate() - 120);
      const limitDateStr = getArxivDateString(limitDate);
      for (const dateStr of Object.keys(history)) {
        if (dateStr < limitDateStr) {
          delete history[dateStr];
        }
      }

      // Update history in KV in a single write call
      await env.INTELLIGENCE_KV.put(seriesKey, JSON.stringify(history));

      // 4. Compute 7-day rolling sums for the last 90 days
      // To get 90 days of 7-day sums, we need dailyCounts from index (99 - 90 - 7 + 1) = 2 to index 99
      const series_data: number[] = [];
      for (let i = 9; i < 100; i++) {
        let sum = 0;
        for (let j = 0; j < 7; j++) {
          sum += dailyCounts[i - j];
        }
        series_data.push(sum);
      }

      const current_value = sevenDayCount;

      // POST to domain-signal-processor via Service Binding
      console.log(`[ArXiv] POSTing cs.${cat} to processor...`);
      const processorRes = await env.DOMAIN_SIGNAL_PROCESSOR.fetch("http://processor/", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vertical: 'technology',
          source: 'arxiv',
          metric_name: `arxiv_velocity_${cat.replace('.', '_')}`,
          current_value,
          series_data,
          capture_date: today.toISOString(),
        }),
      });

      const processorText = await processorRes.text();
      console.log(`[ArXiv] Processor response for ${cat}: status=${processorRes.status}, body=${processorText}`);
      results[cat] = `success: ${processorRes.status}`;

    } catch (e: any) {
      console.error(`[ArXiv] Error processing ${cat}:`, e);
      results[cat] = `error: ${e.message || e}`;
    }
  }

  return results;
}

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    console.log('[ArXiv] Starting tech signal ingestion cron job...');
    ctx.waitUntil(
      runIngestion(env)
        .then(res => console.log('[ArXiv] Tech signal ingestion complete:', JSON.stringify(res)))
        .catch(err => console.error('[ArXiv] Tech signal ingestion failed:', err))
    );
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    console.log('[ArXiv] Manual trigger of tech signal ingestion...');
    try {
      const results = await runIngestion(env);
      return new Response(JSON.stringify({ ok: true, results }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (e: any) {
      return new Response(JSON.stringify({ error: e.message || e }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
};
