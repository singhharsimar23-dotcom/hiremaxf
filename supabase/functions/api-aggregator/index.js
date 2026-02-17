import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
};
function normalizeRole(title) {
    const t = title.toLowerCase();
    if (/\b(frontend|front-end|react|vue|angular|css|html)\b/.test(t))
        return 'frontend';
    if (/\b(fullstack|full-stack|full stack)\b/.test(t))
        return 'fullstack';
    if (/\b(mobile|ios|android|flutter|react native|swift|kotlin)\b/.test(t))
        return 'mobile';
    if (/\b(devops|sre|infrastructure|platform|cloud|aws|gcp|azure)\b/.test(t))
        return 'devops';
    if (/\b(machine learning|ml|ai|deep learning|nlp|computer vision|data scientist)\b/.test(t))
        return 'ml';
    if (/\b(data engineer|analytics|etl|warehouse|dbt)\b/.test(t))
        return 'data';
    if (/\b(security|infosec|appsec|cybersecurity)\b/.test(t))
        return 'security';
    if (/\b(product manager|product lead|pm)\b/.test(t))
        return 'product';
    if (/\b(designer|ux|ui|product design)\b/.test(t))
        return 'design';
    return 'backend';
}
function normalizeSeniority(title) {
    const t = title.toLowerCase();
    if (/\b(intern|internship)\b/.test(t))
        return 'intern';
    if (/\b(junior|jr|entry|new grad|graduate|associate)\b/.test(t))
        return 'junior';
    if (/\b(principal|distinguished|fellow)\b/.test(t))
        return 'principal';
    if (/\b(staff)\b/.test(t))
        return 'staff';
    if (/\b(lead|tech lead|team lead)\b/.test(t))
        return 'lead';
    if (/\b(manager|director|head|vp|chief)\b/.test(t))
        return 'manager';
    if (/\b(senior|sr|iii|3)\b/.test(t))
        return 'senior';
    return 'mid';
}
function normalizeLocation(location) {
    const l = location.toLowerCase();
    if (/\b(remote|anywhere|distributed|worldwide|global|wfh|work from home)\b/.test(l))
        return 'remote';
    if (/\b(hybrid|flexible|partial)\b/.test(l))
        return 'hybrid';
    return 'onsite';
}
function calculateQualityScore(job) {
    let score = 0;
    if (job.title && job.title.length > 5)
        score += 0.3;
    if (job.company && job.company.length > 1)
        score += 0.25;
    if (job.location && job.location.length > 2)
        score += 0.2;
    if (job.url && job.url.startsWith('http'))
        score += 0.25;
    return Math.min(1, score);
}
async function generateFingerprint(company, title, location) {
    const c = company.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    const t = title.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    const l = location.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    const text = `${c}|${t}|${l}`;
    const msgUint8 = new TextEncoder().encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
async function fetchRemotiveJobs() {
    try {
        console.log('[API] Fetching Remotive...');
        // INCREASED LIMIT: 250 jobs
        const response = await fetch('https://remotive.com/api/remote-jobs?limit=250', {
            headers: { 'User-Agent': 'HireMax/1.0' }
        });
        if (!response.ok)
            return [];
        const data = await response.json();
        const jobs = data.jobs || [];
        console.log(`[API] Remotive: ${jobs.length} jobs`);
        return jobs.map((job) => ({
            title: job.title,
            company: job.company_name,
            location: job.candidate_required_location || 'Remote',
            url: job.url,
            source: 'REMOTIVE'
        }));
    }
    catch (e) {
        console.error('[API] Remotive error:', e.message);
        return [];
    }
}
async function fetchHackerNewsJobs() {
    try {
        console.log('[API] Fetching HackerNews Jobs...');
        const storiesRes = await fetch('https://hacker-news.firebaseio.com/v0/jobstories.json');
        if (!storiesRes.ok)
            return [];
        const storyIds = await storiesRes.json();
        // INCREASED LIMIT: 100 jobs
        const jobIds = storyIds.slice(0, 100);
        const jobs = await Promise.all(jobIds.map(async (id) => {
            try {
                const res = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
                return await res.json();
            }
            catch {
                return null;
            }
        }));
        const validJobs = jobs.filter((j) => j && j.title);
        console.log(`[API] HackerNews: ${validJobs.length} jobs`);
        return validJobs.map((job) => {
            const match = job.title.match(/^(.+?)\s+(is hiring|hiring)/i);
            const company = match ? match[1] : 'YC Company';
            return {
                title: job.title.replace(/^.+?\s+(is hiring|hiring)\s*/i, '') || 'Engineer',
                company: company,
                location: 'Remote',
                url: job.url || `https://news.ycombinator.com/item?id=${job.id}`,
                source: 'HACKERNEWS'
            };
        });
    }
    catch (e) {
        console.error('[API] HackerNews error:', e.message);
        return [];
    }
}
async function fetchJobicyJobs() {
    try {
        console.log('[API] Fetching Jobicy...');
        // INCREASED LIMIT: 100 jobs
        const response = await fetch('https://jobicy.com/api/v2/remote-jobs?count=100', {
            headers: { 'User-Agent': 'HireMax/1.0' }
        });
        if (!response.ok)
            return [];
        const data = await response.json();
        const jobs = data.jobs || [];
        console.log(`[API] Jobicy: ${jobs.length} jobs`);
        return jobs.map((job) => ({
            title: job.jobTitle,
            company: job.companyName,
            location: job.jobGeo || 'Remote',
            url: job.url,
            source: 'JOBICY'
        }));
    }
    catch (e) {
        console.error('[API] Jobicy error:', e.message);
        return [];
    }
}
async function fetchArbeitnowJobs() {
    try {
        console.log('[API] Fetching Arbeitnow...');
        const response = await fetch('https://www.arbeitnow.com/api/job-board-api', {
            headers: { 'User-Agent': 'HireMax/1.0' }
        });
        if (!response.ok)
            return [];
        const data = await response.json();
        const jobs = (data.data || []).slice(0, 100);
        console.log(`[API] Arbeitnow: ${jobs.length} jobs`);
        return jobs.map((job) => ({
            title: job.title,
            company: job.company_name,
            location: job.location || 'Remote',
            url: job.url,
            source: 'ARBEITNOW'
        }));
    }
    catch (e) {
        console.error('[API] Arbeitnow error:', e.message);
        return [];
    }
}
async function fetchAdzunaJobs(appId, appKey) {
    if (!appId || !appKey) {
        console.log('[API] Adzuna: No API keys - skipping');
        return [];
    }
    try {
        console.log('[API] Fetching Adzuna with keys...');
        const url = 'https://api.adzuna.com/v1/api/jobs/us/search/1?app_id=' + appId + '&app_key=' + appKey + '&results_per_page=50&what=developer';
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        clearTimeout(timeoutId);
        if (!response.ok)
            return [];
        const data = await response.json();
        const jobs = data.results || [];
        return jobs.map((job) => ({
            title: job.title || 'Developer',
            company: job.company?.display_name || 'Company',
            location: job.location?.display_name || 'USA',
            url: job.redirect_url || 'https://adzuna.com',
            source: 'ADZUNA'
        }));
    }
    catch (e) {
        return [];
    }
}
serve(async (req) => {
    if (req.method === 'OPTIONS')
        return new Response('ok', { headers: corsHeaders });
    const supabase = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
    const runId = crypto.randomUUID();
    const startedAt = new Date();
    let jobsFound = 0;
    let jobsNew = 0;
    let jobsUpdated = 0;
    const errors = [];
    try {
        const adzunaAppId = Deno.env.get('ADZUNA_APP_ID') || '';
        const adzunaAppKey = Deno.env.get('ADZUNA_APP_KEY') || '';
        const [remotiveJobs, hackerNewsJobs, jobicyJobs, arbeitnowJobs, adzunaJobs] = await Promise.all([
            fetchRemotiveJobs(),
            fetchHackerNewsJobs(),
            fetchJobicyJobs(),
            fetchArbeitnowJobs(),
            fetchAdzunaJobs(adzunaAppId, adzunaAppKey)
        ]);
        const allJobs = [...remotiveJobs, ...hackerNewsJobs, ...jobicyJobs, ...arbeitnowJobs, ...adzunaJobs];
        jobsFound = allJobs.length;
        for (const job of allJobs) {
            try {
                if (!job.title || !job.company)
                    continue;
                const fingerprint = await generateFingerprint(job.company, job.title, job.location || 'Remote');
                const { data: existing } = await supabase
                    .from('job_pointers')
                    .select('id')
                    .eq('fingerprint', fingerprint)
                    .maybeSingle();
                if (existing) {
                    await supabase.from('job_pointers')
                        .update({ last_verified_at: new Date().toISOString(), validation_status: 'VERIFIED' })
                        .eq('fingerprint', fingerprint);
                    jobsUpdated++;
                }
                else {
                    await supabase.from('job_pointers').insert({
                        fingerprint,
                        title: job.title,
                        role_category: normalizeRole(job.title),
                        seniority_band: normalizeSeniority(job.title),
                        location_type: normalizeLocation(job.location || 'Remote'),
                        location_name: job.location || 'Remote',
                        source_url: job.url || 'https://hiremax.app',
                        source_type: job.source,
                        discovery_method: 'API_AGGREGATION',
                        confidence_tier: 'medium',
                        quality_score: calculateQualityScore(job),
                        validation_status: 'VERIFIED',
                        first_seen_at: new Date().toISOString(),
                        last_verified_at: new Date().toISOString()
                    });
                    jobsNew++;
                }
            }
            catch (e) {
                errors.push(e.message);
            }
        }
        await supabase.from('discovery_runs').insert({
            id: runId,
            started_at: startedAt.toISOString(),
            completed_at: new Date().toISOString(),
            source: 'API_AGGREGATOR_SCALED',
            jobs_found: jobsFound,
            jobs_new: jobsNew,
            jobs_updated: jobsUpdated
        });
        return new Response(JSON.stringify({
            success: true, run_id: runId, jobs_found: jobsFound, jobs_new: jobsNew, jobs_updated: jobsUpdated
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    catch (error) {
        return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
});
