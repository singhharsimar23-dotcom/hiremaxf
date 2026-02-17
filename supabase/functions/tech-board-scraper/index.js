import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
};
function normalizeRole(title) {
    const t = title.toLowerCase();
    if (/\b(frontend|front-end|react|vue|angular)\b/.test(t))
        return 'frontend';
    if (/\b(fullstack|full-stack|full stack)\b/.test(t))
        return 'fullstack';
    if (/\b(mobile|ios|android|flutter)\b/.test(t))
        return 'mobile';
    if (/\b(devops|sre|infrastructure|platform|cloud)\b/.test(t))
        return 'devops';
    if (/\b(machine learning|ml|ai|deep learning|data scientist)\b/.test(t))
        return 'ml';
    if (/\b(data engineer|analytics|etl)\b/.test(t))
        return 'data';
    if (/\b(security|infosec|appsec)\b/.test(t))
        return 'security';
    if (/\b(product manager|pm)\b/.test(t))
        return 'product';
    if (/\b(designer|ux|ui)\b/.test(t))
        return 'design';
    return 'backend';
}
function normalizeSeniority(title) {
    const t = title.toLowerCase();
    if (/\b(intern|internship)\b/.test(t))
        return 'intern';
    if (/\b(junior|jr|entry|new grad)\b/.test(t))
        return 'junior';
    if (/\b(principal|distinguished|fellow)\b/.test(t))
        return 'principal';
    if (/\b(staff)\b/.test(t))
        return 'staff';
    if (/\b(lead|tech lead)\b/.test(t))
        return 'lead';
    if (/\b(manager|director|vp)\b/.test(t))
        return 'manager';
    if (/\b(senior|sr|iii)\b/.test(t))
        return 'senior';
    return 'mid';
}
function normalizeLocation(location) {
    const l = location.toLowerCase();
    if (/\b(remote|anywhere|worldwide|wfh)\b/.test(l))
        return 'remote';
    if (/\b(hybrid|flexible)\b/.test(l))
        return 'hybrid';
    return 'onsite';
}
function calculateQualityScore(job) {
    let score = 0;
    if (job.title && job.title.length > 5)
        score += 0.5;
    if (job.company && job.company.length > 1)
        score += 0.5;
    return Math.min(1, score);
}
async function generateFingerprint(company, title, location) {
    const text = `${company}|${title}|${location}`.toLowerCase().replace(/[^a-z0-9|]/g, '');
    const msgUint8 = new TextEncoder().encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}
async function fetchWithTimeout(url, timeout = 10000) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        const response = await fetch(url, {
            signal: controller.signal,
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HireMax/1.0)' }
        });
        clearTimeout(timeoutId);
        return response;
    }
    catch {
        return null;
    }
}
// =============================================
// TECH BOARDS - Cord, Otta, Hired
// =============================================
async function fetchCordJobs() {
    try {
        console.log('[TECH] Cord.co...');
        const response = await fetchWithTimeout('https://cord.co/api/v1/jobs?page=1');
        if (!response?.ok)
            return [];
        const data = await response.json();
        const jobs = data.jobs || data.data || [];
        console.log(`[TECH] Cord: ${jobs.length} jobs`);
        return jobs.slice(0, 50).map((job) => ({
            title: job.title, company: job.company_name || job.company?.name || 'Startup',
            location: job.location || 'Remote', url: job.url || `https://cord.co/jobs/${job.id}`, source: 'CORD'
        }));
    }
    catch (e) {
        console.error('[TECH] Cord error:', e.message);
        return [];
    }
}
async function fetchOttaJobs() {
    try {
        console.log('[TECH] Otta.com...');
        const response = await fetch('https://api.otta.com/graphql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query: `query { jobs(first: 50) { edges { node { title company { name } location } } } }`
            })
        });
        if (!response.ok)
            return [];
        const data = await response.json();
        const edges = data?.data?.jobs?.edges || [];
        console.log(`[TECH] Otta: ${edges.length} jobs`);
        return edges.map((e) => ({
            title: e.node.title, company: e.node.company?.name || 'Company',
            location: e.node.location || 'Remote', url: 'https://otta.com', source: 'OTTA'
        }));
    }
    catch (e) {
        console.error('[TECH] Otta error:', e.message);
        return [];
    }
}
async function fetchHiredJobs() {
    try {
        console.log('[TECH] Hired.com...');
        const response = await fetchWithTimeout('https://hired.com/api/v1/jobs?category=engineering');
        if (!response?.ok)
            return [];
        const data = await response.json();
        const jobs = data.jobs || data.data || [];
        console.log(`[TECH] Hired: ${jobs.length} jobs`);
        return jobs.slice(0, 50).map((job) => ({
            title: job.title, company: job.company_name || job.company?.name,
            location: job.location || 'USA', url: job.url || 'https://hired.com', source: 'HIRED'
        }));
    }
    catch (e) {
        console.error('[TECH] Hired error:', e.message);
        return [];
    }
}
// =============================================
// REMOTE BOARDS - Remote.co, FlexJobs, Jobspresso
// =============================================
async function fetchRemoteCoJobs() {
    try {
        console.log('[REMOTE] Remote.co...');
        const response = await fetchWithTimeout('https://remote.co/remote-jobs/developer/feed/');
        if (!response?.ok)
            return [];
        const xml = await response.text();
        const jobs = [];
        const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g);
        for (const match of itemMatches) {
            const item = match[1];
            const title = item.match(/<title>(.*?)<\/title>/)?.[1]?.replace(/<!\[CDATA\[|\]\]>/g, '');
            const link = item.match(/<link>(.*?)<\/link>/)?.[1];
            if (title && link) {
                const parts = title.split(' at ');
                jobs.push({
                    title: parts[0]?.trim() || title,
                    company: parts[1]?.trim() || 'Remote Company',
                    location: 'Remote', url: link, source: 'REMOTECO'
                });
            }
        }
        console.log(`[REMOTE] Remote.co: ${jobs.length} jobs`);
        return jobs.slice(0, 50);
    }
    catch (e) {
        console.error('[REMOTE] Remote.co error:', e.message);
        return [];
    }
}
async function fetchJobspressoJobs() {
    try {
        console.log('[REMOTE] Jobspresso...');
        const response = await fetchWithTimeout('https://jobspresso.co/remote-developer-jobs/feed/');
        if (!response?.ok)
            return [];
        const xml = await response.text();
        const jobs = [];
        const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g);
        for (const match of itemMatches) {
            const item = match[1];
            const title = item.match(/<title>(.*?)<\/title>/)?.[1]?.replace(/<!\[CDATA\[|\]\]>/g, '');
            const link = item.match(/<link>(.*?)<\/link>/)?.[1];
            if (title && link) {
                const parts = title.split(' at ');
                jobs.push({
                    title: parts[0]?.trim() || title,
                    company: parts[1]?.trim() || 'Remote Company',
                    location: 'Remote', url: link, source: 'JOBSPRESSO'
                });
            }
        }
        console.log(`[REMOTE] Jobspresso: ${jobs.length} jobs`);
        return jobs.slice(0, 50);
    }
    catch (e) {
        console.error('[REMOTE] Jobspresso error:', e.message);
        return [];
    }
}
// =============================================
// AGGREGATORS - TechCrunch, Crunchbase
// =============================================
async function fetchCrunchbaseJobs() {
    try {
        console.log('[AGG] Crunchbase Jobs...');
        const response = await fetchWithTimeout('https://www.crunchbase.com/discover/jobs?q=software%20engineer');
        if (!response?.ok)
            return [];
        // Crunchbase requires parsing or API key, return empty for now
        console.log('[AGG] Crunchbase: requires API key');
        return [];
    }
    catch (e) {
        console.error('[AGG] Crunchbase error:', e.message);
        return [];
    }
}
// =============================================
// AGGREGATOR APIS - Jooble, Careerjet
// =============================================
async function fetchJoobleJobs(apiKey) {
    if (!apiKey) {
        console.log('[API] Jooble: No key');
        return [];
    }
    try {
        console.log('[API] Jooble...');
        const response = await fetch(`https://jooble.org/api/${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ keywords: 'software engineer', location: 'USA' })
        });
        if (!response.ok)
            return [];
        const data = await response.json();
        const jobs = data.jobs || [];
        console.log(`[API] Jooble: ${jobs.length} jobs`);
        return jobs.slice(0, 50).map((job) => ({
            title: job.title, company: job.company, location: job.location || 'USA',
            url: job.link, source: 'JOOBLE'
        }));
    }
    catch (e) {
        console.error('[API] Jooble error:', e.message);
        return [];
    }
}
async function fetchCareerjetJobs(apiKey) {
    if (!apiKey) {
        console.log('[API] Careerjet: No key');
        return [];
    }
    try {
        console.log('[API] Careerjet...');
        const response = await fetchWithTimeout(`http://public.api.careerjet.net/search?locale_code=en_US&keywords=software+engineer&affid=${apiKey}`);
        if (!response?.ok)
            return [];
        const data = await response.json();
        const jobs = data.jobs || [];
        console.log(`[API] Careerjet: ${jobs.length} jobs`);
        return jobs.slice(0, 50).map((job) => ({
            title: job.title, company: job.company, location: job.locations || 'USA',
            url: job.url, source: 'CAREERJET'
        }));
    }
    catch (e) {
        console.error('[API] Careerjet error:', e.message);
        return [];
    }
}
// =============================================
// MAIN HANDLER
// =============================================
serve(async (req) => {
    if (req.method === 'OPTIONS')
        return new Response('ok', { headers: corsHeaders });
    const supabase = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
    const runId = crypto.randomUUID();
    const startedAt = new Date();
    let jobsFound = 0, jobsNew = 0, jobsUpdated = 0;
    console.log(`[TECH_SCRAPER] Run ${runId} started`);
    try {
        const joobleKey = Deno.env.get('JOOBLE_API_KEY') || '';
        const careerjetKey = Deno.env.get('CAREERJET_AFFID') || '';
        const [cordJobs, ottaJobs, hiredJobs, remoteCoJobs, jobspressoJobs, joobleJobs, careerjetJobs] = await Promise.all([
            fetchCordJobs(), fetchOttaJobs(), fetchHiredJobs(),
            fetchRemoteCoJobs(), fetchJobspressoJobs(),
            fetchJoobleJobs(joobleKey), fetchCareerjetJobs(careerjetKey)
        ]);
        const allJobs = [...cordJobs, ...ottaJobs, ...hiredJobs, ...remoteCoJobs, ...jobspressoJobs, ...joobleJobs, ...careerjetJobs];
        jobsFound = allJobs.length;
        console.log(`[TECH_SCRAPER] Total: ${jobsFound} jobs`);
        for (const job of allJobs) {
            try {
                if (!job.title || !job.company)
                    continue;
                const fingerprint = await generateFingerprint(job.company, job.title, job.location);
                const { data: existing } = await supabase.from('job_pointers').select('id').eq('fingerprint', fingerprint).maybeSingle();
                if (existing) {
                    await supabase.from('job_pointers').update({ last_verified_at: new Date().toISOString(), validation_status: 'VERIFIED' }).eq('fingerprint', fingerprint);
                    jobsUpdated++;
                }
                else {
                    let companyId = null;
                    const { data: ec } = await supabase.from('companies').select('id').ilike('name', job.company).maybeSingle();
                    if (ec)
                        companyId = ec.id;
                    else {
                        const { data: nc } = await supabase.from('companies').insert({ name: job.company }).select('id').single();
                        companyId = nc?.id;
                    }
                    await supabase.from('job_pointers').insert({
                        fingerprint, company_id: companyId, title: job.title,
                        role_category: normalizeRole(job.title), seniority_band: normalizeSeniority(job.title),
                        location_type: normalizeLocation(job.location), source_url: job.url, source_type: job.source,
                        discovery_method: 'TECH_SCRAPE', confidence_tier: 'medium', quality_score: calculateQualityScore(job),
                        validation_status: 'UNVERIFIED', first_seen_at: new Date().toISOString(), last_verified_at: new Date().toISOString()
                    });
                    jobsNew++;
                }
            }
            catch (e) {
                console.error('[TECH_SCRAPER] Job error:', e.message);
            }
        }
        await supabase.from('discovery_runs').insert({ id: runId, started_at: startedAt.toISOString(), completed_at: new Date().toISOString(), source: 'TECH_SCRAPER', jobs_found: jobsFound, jobs_new: jobsNew, jobs_updated: jobsUpdated });
        await supabase.from('source_reliability').upsert({ source_name: 'TECH_SCRAPER', total_jobs_found: jobsFound, last_success_at: new Date().toISOString(), last_updated: new Date().toISOString() }, { onConflict: 'source_name' });
        console.log(`[TECH_SCRAPER] Done: ${jobsNew} new, ${jobsUpdated} updated`);
        return new Response(JSON.stringify({
            success: true, run_id: runId, jobs_found: jobsFound, jobs_new: jobsNew, jobs_updated: jobsUpdated,
            sources: {
                cord: cordJobs.length, otta: ottaJobs.length, hired: hiredJobs.length,
                remoteco: remoteCoJobs.length, jobspresso: jobspressoJobs.length,
                jooble: joobleJobs.length, careerjet: careerjetJobs.length
            }
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    catch (error) {
        console.error('[TECH_SCRAPER] Fatal:', error.message);
        return new Response(JSON.stringify({ success: false, error: error.message, run_id: runId }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
});
