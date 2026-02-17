
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
};

const ATS_PATTERNS: Record<string, string> = {
    greenhouse: 'https://boards.greenhouse.io/{slug}',
    lever: 'https://jobs.lever.co/{slug}',
    ashby: 'https://jobs.ashbyhq.com/{slug}',
    workable: 'https://apply.workable.com/{slug}',
    bamboohr: 'https://{slug}.bamboohr.com/careers',
    smartrecruiters: 'https://careers.smartrecruiters.com/{slug}',
    jazzhr: 'https://{slug}.applytojob.com/apply',
    breezyhr: 'https://{slug}.breezy.hr'
};

const ATS_SELECTORS: Record<string, any> = {
    greenhouse: { container: '.opening', title: 'a', link: 'a', loc: '.location' },
    lever: { container: '.posting', title: 'h5', link: 'a', loc: '.location' },
    ashby: { container: '[data-testid="jobs-list-item"]', title: 'a', link: 'a', loc: '.ashby-job-posting-location' },
    workable: { container: '[data-ui="job"]', title: 'h3', link: 'a', loc: '.location' }
};

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: companies } = await supabase.from('companies').select('*').not('ats_type', 'is', null).limit(10);

    if (!companies) return new Response(JSON.stringify({ success: true, count: 0 }), { headers: corsHeaders });

    let found = 0;
    for (const company of companies) {
        try {
            const url = ATS_PATTERNS[company.ats_type!.toLowerCase()]?.replace('{slug}', company.ats_slug || '');
            if (!url) continue;

            const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            if (!res.ok) continue;

            const html = await res.text();
            const doc = new DOMParser().parseFromString(html, 'text/html');
            if (!doc) continue;

            const selector = ATS_SELECTORS[company.ats_type!.toLowerCase()];
            if (!selector) continue;

            const elements = doc.querySelectorAll(selector.container);
            found += elements.length;

            // Note: Fingerprinting and saving would happen here
        } catch (e) { console.error(`Failed ${company.name}:`, e.message); }
    }

    return new Response(JSON.stringify({ success: true, jobs_found: found }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
