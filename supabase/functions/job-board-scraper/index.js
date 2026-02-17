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
    if (/\b(remote|anywhere|distributed|worldwide|wfh|work from home)\b/.test(l))
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
// TIER 4: REMOTE JOB BOARDS
// =============================================
async function fetchWeWorkRemotely() {
    try {
        console.log('[SCRAPER] WeWorkRemotely...');
        const response = await fetchWithTimeout('https://weworkremotely.com/categories/remote-programming-jobs.rss');
        if (!response?.ok)
            return [];
        const xml = await response.text();
        const jobs = [];
        // Parse RSS items
        const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g);
        for (const match of itemMatches) {
            const item = match[1];
            const title = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] || item.match(/<title>(.*?)<\/title>/)?.[1];
            const link = item.match(/<link>(.*?)<\/link>/)?.[1];
            const company = title?.split(':')[0]?.trim() || 'Unknown';
            const jobTitle = title?.split(':').slice(1).join(':').trim() || title;
            if (title && link) {
                jobs.push({
                    title: jobTitle,
                    company: company,
                    location: 'Remote',
                    url: link,
                    source: 'WEWORKREMOTELY'
                });
            }
        }
        console.log(`[SCRAPER] WeWorkRemotely: ${jobs.length} jobs`);
        return jobs.slice(0, 100);
    }
    catch (e) {
        console.error('[SCRAPER] WeWorkRemotely error:', e.message);
        return [];
    }
}
async function fetchWorkingNomads() {
    try {
        console.log('[SCRAPER] WorkingNomads...');
        const response = await fetchWithTimeout('https://www.workingnomads.com/api/exposed_jobs/');
        if (!response?.ok)
            return [];
        const jobs = await response.json();
        console.log(`[SCRAPER] WorkingNomads: ${jobs.length} jobs`);
        return jobs.slice(0, 100).map((job) => ({
            title: job.title,
            company: job.company_name,
            location: job.location || 'Remote',
            url: job.url,
            source: 'WORKINGNOMADS'
        }));
    }
    catch (e) {
        console.error('[SCRAPER] WorkingNomads error:', e.message);
        return [];
    }
}
// =============================================
// TIER 5: STARTUP JOBS
// =============================================
async function fetchWorkAtAStartup() {
    try {
        console.log('[SCRAPER] WorkAtAStartup (YC)...');
        const response = await fetchWithTimeout('https://www.workatastartup.com/companies.json');
        if (!response?.ok)
            return [];
        const data = await response.json();
        const jobs = [];
        // Each company has jobs array
        for (const company of (data.companies || data || []).slice(0, 50)) {
            const companyName = company.name || company.company_name;
            const companyJobs = company.jobs || [];
            for (const job of companyJobs.slice(0, 5)) {
                jobs.push({
                    title: job.title || job.role,
                    company: companyName,
                    location: job.location || 'Remote',
                    url: job.url || `https://www.workatastartup.com/companies/${company.slug}`,
                    source: 'WORKATASTARTUP'
                });
            }
        }
        console.log(`[SCRAPER] WorkAtAStartup: ${jobs.length} jobs`);
        return jobs;
    }
    catch (e) {
        console.error('[SCRAPER] WorkAtAStartup error:', e.message);
        return [];
    }
}
async function fetchStartupJobs() {
    try {
        console.log('[SCRAPER] StartupJobs...');
        const response = await fetchWithTimeout('https://startup.jobs/api/jobs?page=1');
        if (!response?.ok)
            return [];
        const data = await response.json();
        const jobs = data.jobs || data.data || [];
        console.log(`[SCRAPER] StartupJobs: ${jobs.length} jobs`);
        return jobs.slice(0, 100).map((job) => ({
            title: job.title,
            company: job.company_name || job.company?.name,
            location: job.location || 'Remote',
            url: job.url || job.apply_url,
            source: 'STARTUPJOBS'
        }));
    }
    catch (e) {
        console.error('[SCRAPER] StartupJobs error:', e.message);
        return [];
    }
}
// =============================================
// TIER 3: TECH-SPECIFIC
// =============================================
async function fetchWellfound() {
    try {
        console.log('[SCRAPER] Wellfound (AngelList)...');
        // Wellfound has a GraphQL API we can query
        const response = await fetch('https://wellfound.com/graphql', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (compatible; HireMax/1.0)'
            },
            body: JSON.stringify({
                query: `query {
                    jobListings(first: 50, filters: { role: "Software Engineer" }) {
                        edges {
                            node {
                                title
                                slug
                                company { name }
                                location
                            }
                        }
                    }
                }`
            })
        });
        if (!response.ok)
            return [];
        const data = await response.json();
        const edges = data?.data?.jobListings?.edges || [];
        console.log(`[SCRAPER] Wellfound: ${edges.length} jobs`);
        return edges.map((edge) => ({
            title: edge.node.title,
            company: edge.node.company?.name || 'Startup',
            location: edge.node.location || 'Remote',
            url: `https://wellfound.com/jobs/${edge.node.slug}`,
            source: 'WELLFOUND'
        }));
    }
    catch (e) {
        console.error('[SCRAPER] Wellfound error:', e.message);
        return [];
    }
}
async function fetchDice() {
    try {
        console.log('[SCRAPER] Dice...');
        const response = await fetchWithTimeout('https://job-search-api.svc.dice.com/jobs/q-software+engineer-jobs?rows=50&page=1');
        if (!response?.ok)
            return [];
        const data = await response.json();
        const jobs = data.data || [];
        console.log(`[SCRAPER] Dice: ${jobs.length} jobs`);
        return jobs.map((job) => ({
            title: job.title,
            company: job.companyName,
            location: job.location || 'USA',
            url: job.detailsPageUrl || `https://www.dice.com/job-detail/${job.id}`,
            source: 'DICE'
        }));
    }
    catch (e) {
        console.error('[SCRAPER] Dice error:', e.message);
        return [];
    }
}
async function fetchBuiltIn() {
    try {
        console.log('[SCRAPER] BuiltIn...');
        const cities = ['nyc', 'sf', 'la', 'chicago', 'seattle', 'austin', 'boston', 'denver'];
        const jobs = [];
        for (const city of cities.slice(0, 3)) { // Just 3 cities to stay fast
            try {
                const response = await fetchWithTimeout(`https://builtin.com/api/jobs/${city}?page=1&limit=20`);
                if (response?.ok) {
                    const data = await response.json();
                    const cityJobs = data.jobs || data.data || [];
                    for (const job of cityJobs) {
                        jobs.push({
                            title: job.title,
                            company: job.company_name || job.company,
                            location: city.toUpperCase(),
                            url: job.url || `https://builtin.com/job/${job.id}`,
                            source: 'BUILTIN'
                        });
                    }
                }
            }
            catch { }
        }
        console.log(`[SCRAPER] BuiltIn: ${jobs.length} jobs`);
        return jobs;
    }
    catch (e) {
        console.error('[SCRAPER] BuiltIn error:', e.message);
        return [];
    }
}
// =============================================
// TIER 2: MAJOR JOB BOARDS (scrape where possible)
// =============================================
async function fetchIndeedRSS() {
    try {
        console.log('[SCRAPER] Indeed RSS...');
        const response = await fetchWithTimeout('https://www.indeed.com/rss?q=software+engineer&l=USA');
        if (!response?.ok)
            return [];
        const xml = await response.text();
        const jobs = [];
        const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g);
        for (const match of itemMatches) {
            const item = match[1];
            const title = item.match(/<title>(.*?)<\/title>/)?.[1];
            const link = item.match(/<link>(.*?)<\/link>/)?.[1];
            const source = item.match(/<source.*?>(.*?)<\/source>/)?.[1];
            if (title && link) {
                jobs.push({
                    title: title.replace(/<!\[CDATA\[|\]\]>/g, ''),
                    company: source || 'Company',
                    location: 'USA',
                    url: link,
                    source: 'INDEED'
                });
            }
        }
        console.log(`[SCRAPER] Indeed: ${jobs.length} jobs`);
        return jobs.slice(0, 100);
    }
    catch (e) {
        console.error('[SCRAPER] Indeed error:', e.message);
        return [];
    }
}
async function fetchSimplyHiredRSS() {
    try {
        console.log('[SCRAPER] SimplyHired...');
        const response = await fetchWithTimeout('https://www.simplyhired.com/search?q=software+engineer&l=&fdb=7&format=rss');
        if (!response?.ok)
            return [];
        const xml = await response.text();
        const jobs = [];
        const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g);
        for (const match of itemMatches) {
            const item = match[1];
            const title = item.match(/<title>(.*?)<\/title>/)?.[1];
            const link = item.match(/<link>(.*?)<\/link>/)?.[1];
            const description = item.match(/<description>(.*?)<\/description>/)?.[1];
            // Extract company from description
            const company = description?.match(/at\s+(.+?)\s+-/)?.[1] || 'Company';
            if (title && link) {
                jobs.push({
                    title: title.replace(/<!\[CDATA\[|\]\]>/g, ''),
                    company: company,
                    location: 'USA',
                    url: link,
                    source: 'SIMPLYHIRED'
                });
            }
        }
        console.log(`[SCRAPER] SimplyHired: ${jobs.length} jobs`);
        return jobs.slice(0, 50);
    }
    catch (e) {
        console.error('[SCRAPER] SimplyHired error:', e.message);
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
    let jobsFound = 0;
    let jobsNew = 0;
    let jobsUpdated = 0;
    console.log(`[JOB_BOARD_SCRAPER] Run ${runId} started`);
    try {
        // Fetch from ALL job boards in parallel
        const [weworkremotelyJobs, workingNomadsJobs, workAtAStartupJobs, startupJobsJobs, wellfoundJobs, diceJobs, builtinJobs, indeedJobs, simplyhiredJobs] = await Promise.all([
            fetchWeWorkRemotely(),
            fetchWorkingNomads(),
            fetchWorkAtAStartup(),
            fetchStartupJobs(),
            fetchWellfound(),
            fetchDice(),
            fetchBuiltIn(),
            fetchIndeedRSS(),
            fetchSimplyHiredRSS()
        ]);
        const allJobs = [
            ...weworkremotelyJobs,
            ...workingNomadsJobs,
            ...workAtAStartupJobs,
            ...startupJobsJobs,
            ...wellfoundJobs,
            ...diceJobs,
            ...builtinJobs,
            ...indeedJobs,
            ...simplyhiredJobs
        ];
        jobsFound = allJobs.length;
        console.log(`[JOB_BOARD_SCRAPER] Total: ${jobsFound} jobs`);
        // Process each job
        for (const job of allJobs) {
            try {
                if (!job.title || !job.company)
                    continue;
                const fingerprint = await generateFingerprint(job.company, job.title, job.location);
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
                    let companyId = null;
                    const { data: existingCompany } = await supabase
                        .from('companies')
                        .select('id')
                        .ilike('name', job.company)
                        .maybeSingle();
                    if (existingCompany) {
                        companyId = existingCompany.id;
                    }
                    else {
                        const { data: newCompany } = await supabase
                            .from('companies')
                            .insert({ name: job.company })
                            .select('id')
                            .single();
                        companyId = newCompany?.id;
                    }
                    await supabase.from('job_pointers').insert({
                        fingerprint,
                        company_id: companyId,
                        title: job.title,
                        role_category: normalizeRole(job.title),
                        seniority_band: normalizeSeniority(job.title),
                        location_type: normalizeLocation(job.location),
                        source_url: job.url,
                        source_type: job.source,
                        discovery_method: 'JOB_BOARD_SCRAPE',
                        confidence_tier: 'medium',
                        quality_score: calculateQualityScore(job),
                        validation_status: 'UNVERIFIED',
                        first_seen_at: new Date().toISOString(),
                        last_verified_at: new Date().toISOString()
                    });
                    jobsNew++;
                }
            }
            catch (e) {
                console.error('[JOB_BOARD_SCRAPER] Job error:', e.message);
            }
        }
        await supabase.from('discovery_runs').insert({
            id: runId,
            started_at: startedAt.toISOString(),
            completed_at: new Date().toISOString(),
            source: 'JOB_BOARD_SCRAPER',
            jobs_found: jobsFound,
            jobs_new: jobsNew,
            jobs_updated: jobsUpdated
        });
        await supabase.from('source_reliability').upsert({
            source_name: 'JOB_BOARD_SCRAPER',
            total_jobs_found: jobsFound,
            last_success_at: new Date().toISOString(),
            last_updated: new Date().toISOString()
        }, { onConflict: 'source_name' });
        console.log(`[JOB_BOARD_SCRAPER] Done: ${jobsNew} new, ${jobsUpdated} updated`);
        return new Response(JSON.stringify({
            success: true,
            run_id: runId,
            jobs_found: jobsFound,
            jobs_new: jobsNew,
            jobs_updated: jobsUpdated,
            sources: {
                weworkremotely: weworkremotelyJobs.length,
                workingnomads: workingNomadsJobs.length,
                workatastartup: workAtAStartupJobs.length,
                startupjobs: startupJobsJobs.length,
                wellfound: wellfoundJobs.length,
                dice: diceJobs.length,
                builtin: builtinJobs.length,
                indeed: indeedJobs.length,
                simplyhired: simplyhiredJobs.length
            }
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    catch (error) {
        console.error('[JOB_BOARD_SCRAPER] Fatal:', error.message);
        return new Response(JSON.stringify({
            success: false,
            error: error.message,
            run_id: runId
        }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
});
