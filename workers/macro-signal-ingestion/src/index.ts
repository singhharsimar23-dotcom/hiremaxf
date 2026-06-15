// HireMax Macro Signal Ingestion Worker
// Cron: 30 * * * *

interface Env {
  ENVIRONMENT: string;
  FRED_API_KEY: string;
  DOMAIN_SIGNAL_PROCESSOR: Fetcher;
  INTELLIGENCE_KV: KVNamespace;
}

const SERIES_IDS = [
  // Macro financial signals
  'DGS2',        // 2-Year Treasury Yield
  'DGS10',       // 10-Year Treasury Yield
  'T10Y2Y',      // Yield Curve Spread (inversion detector)
  'BAMLH0A0HYM2',// High-Yield Credit Spread (risk-off signal)
  'M2SL',        // M2 Money Supply
  'CPIAUCSL',    // CPI Inflation
  'INDPRO',      // Industrial Production Index
  // Core labor signals
  'UNRATE',      // Unemployment Rate
  'ICSA',        // Initial Jobless Claims (weekly — most current labor signal)
  'JTSJOL',      // JOLTS: Job Openings (total nonfarm)
  'JTSQUR',      // JOLTS: Quits Rate (Great Resignation / labor confidence indicator)
  'ADPWNAG',     // ADP National Employment: Private Sector
];

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function runIngestion(env: Env): Promise<Record<string, unknown>> {
  const apiKey = env.FRED_API_KEY?.trim();

  if (!apiKey || apiKey === 'placeholder') {
    throw new Error('FRED_API_KEY is not configured');
  }

  const results: Record<string, string> = {};

  for (const seriesId of SERIES_IDS) {
    console.log(`[FRED] Fetching series ${seriesId}...`);
    try {
      const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=548`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 HireMax/1.0 (contact: harsimar@hiremax.site)'
        }
      });
      if (!res.ok) {
        throw new Error(`FRED returned status ${res.status}: ${await res.text()}`);
      }

      const data = await res.json() as { observations?: Array<{ date: string; value: string }> };
      const observations = data.observations || [];

      // Filter and parse observations
      const validObs = observations
        .filter(o => o.value !== '.')
        .map(o => ({ date: o.date, value: parseFloat(o.value) }));

      if (validObs.length === 0) {
        console.warn(`[FRED] No valid observations found for ${seriesId}`);
        results[seriesId] = 'no_valid_data';
        continue;
      }

      // Sort by date ascending (chronological: oldest to newest)
      validObs.sort((a, b) => a.date.localeCompare(b.date));

      const newestObs = validObs[validObs.length - 1];
      const current_value = newestObs.value;
      const series_data = validObs.map(o => o.value);
      const capture_date = newestObs.date;

      console.log(`[FRED] Series ${seriesId}: latest=${current_value} on ${capture_date}, data_points=${series_data.length}`);

      // Special case: yield curve inversion
      if (seriesId === 'T10Y2Y' && validObs.length >= 2) {
        const current = validObs[validObs.length - 1].value;
        const previous = validObs[validObs.length - 2].value;
        if (current < 0 && previous >= 0) {
          const inversionPayload = { inverted_at: capture_date, value: current };
          console.log(`[FRED] Yield curve inversion detected: ${JSON.stringify(inversionPayload)}`);
          await env.INTELLIGENCE_KV.put('yield_curve_inversion', JSON.stringify(inversionPayload));
        }
      }

      // POST to domain-signal-processor via Service Binding
      console.log(`[FRED] POSTing ${seriesId} to processor...`);
      const processorRes = await env.DOMAIN_SIGNAL_PROCESSOR.fetch("http://processor/", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vertical: 'macro',
          source: 'fred',
          metric_name: seriesId,
          current_value,
          series_data,
          capture_date,
        }),
      });

      const processorText = await processorRes.text();
      console.log(`[FRED] Processor response for ${seriesId}: status=${processorRes.status}, body=${processorText}`);
      results[seriesId] = `status: ${processorRes.status}, body: ${processorText.slice(0, 100)}`;

    } catch (e: any) {
      console.error(`[FRED] Error ingesting series ${seriesId}:`, e);
      results[seriesId] = `error: ${e.message || e}`;
    }

    // 500ms delay between requests to respect FRED rate limits
    await sleep(500);
  }

  return results;
}

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    console.log('[FRED] Starting macro signal ingestion cron job...');
    ctx.waitUntil(
      runIngestion(env)
        .then(res => console.log('[FRED] Macro signal ingestion complete:', JSON.stringify(res)))
        .catch(err => console.error('[FRED] Macro signal ingestion failed:', err))
    );
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    console.log('[FRED] Manual trigger of macro signal ingestion...');
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
