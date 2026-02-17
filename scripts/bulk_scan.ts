import fs from 'fs/promises';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase Client
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://ssuknybhzcuusjardsve.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzdWtueWJoemN1dXNqYXJkc3ZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxNDY1MTIsImV4cCI6MjA4NDcyMjUxMn0.9XaUxtMi3btKZIA_sXQCNJI20-iwruxXISr2J1Kmr-g";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;

// We don't have the service key, so we won't use the client for DB updates in this script.

const PATTERNS = [
    { provider: 'GREENHOUSE', pattern: /boards-api\.greenhouse\.io|job-boards\.greenhouse\.io|greenhouse\.io/ },
    { provider: 'LEVER', pattern: /api\.lever\.co|jobs\.lever\.co/ },
    { provider: 'ASHBY', pattern: /api\.ashbyhq\.com|jobs\.ashbyhq\.com/ },
    { provider: 'WORKDAY', pattern: /myworkdayjobs\.com/ },
    { provider: 'SMARTRECRUITERS', pattern: /smartrecruiters\.com/ },
    { provider: 'ICIMS', pattern: /icims\.com/ },
    { provider: 'JOBVITE', pattern: /jobvite\.com/ },
    { provider: 'BAMBOOHR', pattern: /bamboohr\.com/ },
    { provider: 'TEAMTAILOR', pattern: /teamtailor\.com/ },
    { provider: 'BREEZY', pattern: /breezy\.hr/ },
    { provider: 'RIPPLING', pattern: /rippling\.com/ }
];

async function resolveUrl(url) {
    try {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 8000); // 8s timeout
        const res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: controller.signal });
        clearTimeout(id);
        return res.url;
    } catch (e) {
        // Retry with GET if HEAD fails
        try {
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), 8000);
            const res = await fetch(url, { method: 'GET', redirect: 'follow', signal: controller.signal });
            clearTimeout(id);
            return res.url;
        } catch (e2) {
            return null;
        }
    }
}

async function scan() {
    console.log("🚀 Starting Bulk ATS Scan (Node.js)...");

    try {
        const text = await fs.readFile("companies_to_scan.json", 'utf-8');
        const companies = JSON.parse(text);

        if (!companies || companies.length === 0) {
            console.log("✅ No companies to scan.");
            return;
        }

        console.log(`🔍 Processing ${companies.length} companies...`);
        const results = [];

        for (const company of companies) {
            let detected = 'NONE';
            let finalUrl = null;
            let identifier = null;

            // Use careers_url if available, else probe common paths
            let pathsToTry = company.careers_url ? [company.careers_url] : [
                `https://${company.domain}/careers`,
                `https://${company.domain}/jobs`,
                `https://${company.domain}/about/careers`,
                `https://${company.domain}`
            ];

            console.log(`👉 Scanning ${company.company_name}...`);

            for (const probeUrl of pathsToTry) {
                if (detected !== 'NONE') break;

                console.log(`   🔎 Probing: ${probeUrl}`);
                const resolved = await resolveUrl(probeUrl);
                if (!resolved) continue;

                // 1. Check URL patterns
                for (const p of PATTERNS) {
                    if (p.pattern.test(resolved)) {
                        detected = p.provider;
                        finalUrl = resolved;
                        break;
                    }
                }

                // 2. SMART PROBE: Check HTML content for signatures
                if (detected === 'NONE') {
                    try {
                        const res = await fetch(resolved, {
                            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
                        });
                        if (res.ok) {
                            const html = await res.text();
                            if (html.includes('gh-token') || html.includes('greenhouse.io')) detected = 'GREENHOUSE';
                            else if (html.includes('ashbyhq.com') || html.includes('ashby_jobs') || html.includes('ashby-jobs')) detected = 'ASHBY';
                            else if (html.includes('lever.co')) detected = 'LEVER';
                            else if (html.includes('myworkdayjobs.com')) detected = 'WORKDAY';
                            else if (html.includes('smartrecruiters.com')) detected = 'SMARTRECRUITERS';
                            else if (html.includes('icims.com')) detected = 'ICIMS';

                            if (detected !== 'NONE') {
                                finalUrl = resolved;
                            }
                        }
                    } catch (e) { }
                }
            }

            if (detected !== 'NONE') {
                console.log(`   🎉 DETECTED: ${detected}`);

                let identifier = null;
                try {
                    const u = new URL(finalUrl);
                    if (detected === 'ASHBY') {
                        // jobs.ashbyhq.com/deliveroo or ashbyhq.com/gh/deliveroo
                        const segments = u.pathname.split('/').filter(Boolean);
                        identifier = segments[segments.length - 1];
                    } else if (detected === 'GREENHOUSE') {
                        // boards.greenhouse.io/monzo or job-boards.greenhouse.io/monzo
                        const segments = u.pathname.split('/').filter(Boolean);
                        identifier = segments[0] === 'embed' ? segments[2] : segments[0];
                        if (u.searchParams.get('for')) identifier = u.searchParams.get('for');
                    } else if (detected === 'LEVER') {
                        identifier = u.pathname.split('/').filter(Boolean)[0] || u.hostname.split('.')[0];
                    } else if (detected === 'WORKDAY') {
                        // salesforce.wd12.myworkdayjobs.com/External_Career_Site
                        const parts = u.hostname.split('.');
                        let tenant = parts[0];
                        let shard = 'wd1';

                        // Handle tenant.shard or just tenant
                        if (parts.length >= 4 && parts[1].startsWith('wd')) {
                            shard = parts[1];
                        }

                        // Site usually first path segment
                        let site = u.pathname.split('/')[1];
                        if (!site || site === '') site = 'External_Career_Site'; // Default fallback

                        // Format: tenant:shard:site
                        identifier = `${tenant}:${shard}:${site}`;
                    } else if (detected === 'ICIMS') {
                        identifier = u.hostname.split('.')[0];
                    } else {
                        identifier = company.company_name.toLowerCase().replace(/\s+/g, '');
                    }
                } catch { }

                // Trigger Ingestion
                const resp = await fetch(`${SUPABASE_URL}/functions/v1/ats-engine`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${SUPABASE_KEY}`
                    },
                    body: JSON.stringify({
                        company_id: company.id,
                        name: company.company_name,
                        ats_provider: detected,
                        ats_identifier: identifier
                    })
                });

                if (!resp.ok) {
                    const errText = await resp.text();
                    console.error(`   ❌ Failed to trigger engine: ${resp.status} ${resp.statusText}`, errText);
                } else {
                    const data = await resp.json();
                    console.log(`   ✅ Triggered engine:`, data);
                }

                results.push({
                    id: company.id,
                    name: company.company_name,
                    ats_provider: detected,
                    ats_identifier: identifier,
                    final_url: finalUrl
                });
            } else {
                console.log(`   ❌ No ATS detected.`);
            }
        }

        await fs.writeFile("scan_results.json", JSON.stringify(results, null, 2));
        console.log(`✅ Saved ${results.length} matches to scan_results.json`);

    } catch (e) {
        console.error("Critical Error:", e);
    }
}

scan();
