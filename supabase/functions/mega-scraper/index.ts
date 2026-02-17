import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
};

// =============================================
// NORMALIZATION & QUALITY UTILITIES
// =============================================

function normalizeRole(title: string): string {
    const t = (title || '').toLowerCase();
    if (/\b(frontend|front-end|react|vue|angular|css|html|ui)\b/.test(t)) return 'frontend';
    if (/\b(fullstack|full-stack|full stack)\b/.test(t)) return 'fullstack';
    if (/\b(mobile|ios|android|flutter|react native|swift|kotlin)\b/.test(t)) return 'mobile';
    if (/\b(devops|sre|infrastructure|platform|cloud|aws|gcp|azure|kubernetes|docker|terraform)\b/.test(t)) return 'devops';
    if (/\b(machine learning|ml|ai|deep learning|nlp|computer vision|data scientist|llm|genai)\b/.test(t)) return 'ml';
    if (/\b(data engineer|analytics|etl|warehouse|dbt|spark|airflow|sql)\b/.test(t)) return 'data';
    if (/\b(security|infosec|appsec|cybersecurity|devsecops|pentester)\b/.test(t)) return 'security';
    if (/\b(product manager|product lead|pm|product owner)\b/.test(t)) return 'product';
    if (/\b(designer|ux|ui|product design|figma)\b/.test(t)) return 'design';
    if (/\b(qa|quality|test|sdet|automation)\b/.test(t)) return 'qa';
    return 'backend';
}

function normalizeSeniority(title: string): string {
    const t = (title || '').toLowerCase();
    if (/\b(intern|internship|co-op|coop)\b/.test(t)) return 'intern';
    if (/\b(junior|jr|entry|new grad|graduate|associate|i\b|level 1)\b/.test(t)) return 'junior';
    if (/\b(principal|distinguished|fellow|architect)\b/.test(t)) return 'principal';
    if (/\b(staff|ic5|ic6)\b/.test(t)) return 'staff';
    if (/\b(lead|tech lead|team lead|engineering lead)\b/.test(t)) return 'lead';
    if (/\b(manager|director|head|vp|chief|cto|ceo|engineering manager|em)\b/.test(t)) return 'manager';
    if (/\b(senior|sr|iii|3|ii|2|level 3|level 4)\b/.test(t)) return 'senior';
    return 'mid';
}

function normalizeLocation(location: string): string {
    const l = (location || '').toLowerCase();
    if (/\b(remote|anywhere|distributed|worldwide|global|wfh|work from home|fully remote)\b/.test(l)) return 'remote';
    if (/\b(hybrid|flexible|partial|2-3 days)\b/.test(l)) return 'hybrid';
    return 'onsite';
}

function evaluateJobQuality(job: { title?: string; company?: string; location?: string; url?: string; salary_min?: number; source?: string }) {
    const has_salary = !!(job.salary_min && job.salary_min > 0);
    const has_location = job.location && job.location.length > 2 && !job.location.toLowerCase().includes('unknown');

    // Role clarity: length between 10 and 80 chars
    const titleLen = (job.title || '').length;
    const role_clarity = (titleLen >= 10 && titleLen <= 80) ? 1.0 : 0.5;

    // Source trust
    let source_trust = 0.5;
    const src = (job.source || '').toUpperCase();
    if (src.startsWith('GH_') || src.startsWith('LV_')) source_trust = 1.0;
    else if (src === 'HACKERNEWS' || src === 'REMOTIVE') source_trust = 0.9;
    else if (src === 'JOOBLE' || src === 'ADZUNA') source_trust = 0.6;
    else source_trust = 0.7;

    const description_length = 0;

    // Weighted Score
    const score = (
        (has_salary ? 0.3 : 0) +
        (has_location ? 0.2 : 0) +
        (role_clarity * 0.2) +
        (source_trust * 0.3)
    );

    return {
        score: parseFloat(score.toFixed(2)),
        factors: {
            has_salary,
            has_location,
            role_clarity,
            source_trust,
            description_length
        }
    };
}

async function generateFingerprint(company: string, title: string, location: string, source: string, external_id: string): Promise<{ hash: string, signature: string }> {
    const c = company.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    const t = title.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    const l = (location || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    const s = source.toUpperCase();
    const id = external_id.trim();

    // Signature: source|company|title|location|id
    // Separators ensure "ab" + "c" != "a" + "bc"
    const signature = `${s}|${c}|${t}|${l}|${id}`;

    const msgUint8 = new TextEncoder().encode(signature);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return {
        hash: hashArray.map(b => b.toString(16).padStart(2, '0')).join(''),
        signature: signature.substring(0, 500) // Truncate for safety
    };
}

async function fetchWithTimeout(url: string, timeout = 15000, options: RequestInit = {}): Promise<Response | null> {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', ...options.headers }
        });
        clearTimeout(timeoutId);
        return response;
    } catch {
        return null;
    }
}

// =============================================
// FETCHERS (Simplified for conciseness in this block, essentially same logic)
// =============================================

async function fetchRemotive(): Promise<any[]> {
    try {
        const response = await fetchWithTimeout('https://remotive.com/api/remote-jobs?limit=100');
        if (!response?.ok) return [];
        const data = await response.json();
        return (data.jobs || []).map((job: any) => ({
            title: job.title, company: job.company_name, location: job.candidate_required_location || 'Remote',
            url: job.url, source: 'REMOTIVE', salary_min: job.salary_min,
            external_id: job.id ? String(job.id) : job.url
        }));
    } catch { return []; }
}

async function fetchJobicy(): Promise<any[]> {
    try {
        const response = await fetchWithTimeout('https://jobicy.com/api/v2/remote-jobs?count=100');
        if (!response?.ok) return [];
        const data = await response.json();
        return (data.jobs || []).map((job: any) => ({
            title: job.jobTitle, company: job.companyName, location: job.jobGeo || 'Remote',
            url: job.url, source: 'JOBICY',
            external_id: job.id ? String(job.id) : job.url
        }));
    } catch { return []; }
}

async function fetchArbeitnow(): Promise<any[]> {
    try {
        const response = await fetchWithTimeout('https://www.arbeitnow.com/api/job-board-api');
        if (!response?.ok) return [];
        const data = await response.json();
        const jobs = (data.data || []).slice(0, 100);
        return jobs.map((job: any) => ({
            title: job.title, company: job.company_name, location: job.location || 'Europe',
            url: job.url, source: 'ARBEITNOW',
            external_id: job.slug || job.url
        }));
    } catch { return []; }
}

async function fetchHackerNews(): Promise<any[]> {
    try {
        const response = await fetchWithTimeout('https://hacker-news.firebaseio.com/v0/jobstories.json');
        if (!response?.ok) return [];
        const storyIds = await response.json();
        const jobIds = storyIds.slice(0, 40);
        const jobs = await Promise.all(
            jobIds.map(async (id: number) => {
                try {
                    const res = await fetchWithTimeout(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, 5000);
                    return res?.ok ? await res.json() : null;
                } catch { return null; }
            })
        );
        const valid = jobs.filter((j: any) => j && j.title);
        return valid.map((job: any) => {
            const match = job.title.match(/^(.+?)\s+(is hiring|hiring)/i);
            return {
                title: job.title.replace(/^.+?\s+(is hiring|hiring)\s*/i, '') || 'Engineer',
                company: match ? match[1] : 'YC Company', location: 'Remote',
                url: job.url || `https://news.ycombinator.com/item?id=${job.id}`, source: 'HACKERNEWS',
                external_id: String(job.id)
            };
        });
    } catch { return []; }
}

async function fetchRemoteOK(): Promise<any[]> {
    try {
        const response = await fetchWithTimeout('https://remoteok.com/api');
        if (!response?.ok) return [];
        const data = await response.json();
        const jobs = Array.isArray(data) ? data.slice(1, 101) : [];
        return jobs.filter((job: any) => job.position).map((job: any) => ({
            title: job.position, company: job.company, location: job.location || 'Remote',
            url: job.url, source: 'REMOTEOK', salary_min: job.salary_min,
            external_id: job.id ? String(job.id) : job.url
        }));
    } catch { return []; }
}

async function fetchWorkingNomads(): Promise<any[]> {
    try {
        const response = await fetchWithTimeout('https://www.workingnomads.com/api/exposed_jobs/');
        if (!response?.ok) return [];
        const jobs = await response.json();
        return (jobs || []).slice(0, 100).map((job: any) => ({
            title: job.title, company: job.company_name, location: job.location || 'Remote',
            url: job.url, source: 'WORKINGNOMADS',
            external_id: job.url
        }));
    } catch { return []; }
}

async function fetchHimalayas(): Promise<any[]> {
    try {
        const response = await fetchWithTimeout('https://himalayas.app/jobs/api?limit=100');
        if (!response?.ok) return [];
        const data = await response.json();
        return (data.jobs || []).map((job: any) => ({
            title: job.title, company: job.companyName, location: job.locationRestrictions || 'Remote',
            url: `https://himalayas.app/jobs/${job.slug}`, source: 'HIMALAYAS',
            external_id: job.slug || job.url
        }));
    } catch { return []; }
}

async function fetchJooble(apiKey: string): Promise<any[]> {
    if (!apiKey) return [];
    try {
        const response = await fetch(`https://jooble.org/api/${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ keywords: 'software engineer', location: 'USA', page: 1 })
        });
        if (!response.ok) return [];
        const data = await response.json();
        return (data.jobs || []).slice(0, 100).map((job: any) => ({
            title: job.title, company: job.company, location: job.location || 'USA',
            url: job.link, source: 'JOOBLE',
            external_id: job.id ? String(job.id) : job.link
        }));
    } catch { return []; }
}

async function fetchGreenhouseJobs(boardToken: string, companyName: string): Promise<any[]> {
    try {
        const response = await fetchWithTimeout(`https://boards-api.greenhouse.io/v1/boards/${boardToken}/jobs`, 8000);
        if (!response?.ok) return [];
        const data = await response.json();
        return (data.jobs || []).slice(0, 30).map((job: any) => ({
            title: job.title, company: companyName,
            location: job.location?.name || 'Remote',
            url: job.absolute_url, source: `GH_${companyName.toUpperCase().replace(/\s/g, '')}`,
            external_id: String(job.id)
        }));
    } catch { return []; }
}

async function fetchAllGreenhouse(): Promise<any[]> {
    const companies = [
        { token: 'airbnb', name: 'Airbnb' },
        { token: 'discord', name: 'Discord' },
        { token: 'figma', name: 'Figma' },
        { token: 'stripe', name: 'Stripe' },
        { token: 'coinbase', name: 'Coinbase' },
        { token: 'databricks', name: 'Databricks' },
        { token: 'brex', name: 'Brex' },
        { token: 'vercel', name: 'Vercel' },
        { token: 'rippling', name: 'Rippling' }
    ];
    const allJobs: any[] = [];
    const results = await Promise.allSettled(companies.map(c => fetchGreenhouseJobs(c.token, c.name)));
    for (const result of results) {
        if (result.status === 'fulfilled') allJobs.push(...result.value);
    }
    return allJobs;
}

async function fetchLeverJobs(company: string, displayName: string): Promise<any[]> {
    try {
        const response = await fetchWithTimeout(`https://api.lever.co/v0/postings/${company}?mode=json`, 8000);
        if (!response?.ok) return [];
        const jobs = await response.json();
        return (jobs || []).slice(0, 30).map((job: any) => ({
            title: job.text, company: displayName,
            location: job.categories?.location || job.workplaceType || 'Remote',
            url: job.hostedUrl, source: `LV_${displayName.toUpperCase().replace(/\s/g, '')}`,
            external_id: job.id
        }));
    } catch { return []; }
}

async function fetchAllLever(): Promise<any[]> {
    const companies = [
        { slug: 'netflix', name: 'Netflix' },
        { slug: 'openai', name: 'OpenAI' },
        { slug: 'anthropic', name: 'Anthropic' },
        { slug: 'scaleai', name: 'Scale AI' },
        { slug: 'flexport', name: 'Flexport' },
        { slug: 'faire', name: 'Faire' },
        { slug: 'mercury', name: 'Mercury' },
        { slug: 'retool', name: 'Retool' },
        { slug: 'airtable', name: 'Airtable' },
        { slug: 'duolingo', name: 'Duolingo' },
    ];
    const allJobs: any[] = [];
    const results = await Promise.allSettled(companies.map(c => fetchLeverJobs(c.slug, c.name)));
    for (const result of results) {
        if (result.status === 'fulfilled') allJobs.push(...result.value);
    }
    return allJobs;
}

// =============================================
// MAIN HANDLER
// =============================================

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    return new Response(JSON.stringify({
        success: false,
        message: "This mega-scraper (aggregator) function has been deactivated in favor of direct-origin sourcing (Refer to Forensic Audit Phase A).",
        status: "INACTIVE"
    }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
});
