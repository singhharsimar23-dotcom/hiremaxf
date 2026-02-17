
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://ssuknybhzcuusjardsve.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzdWtueWJoemN1dXNqYXJkc3ZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxNDY1MTIsImV4cCI6MjA4NDcyMjUxMn0.9XaUxtMi3btKZIA_sXQCNJI20-iwruxXISr2J1Kmr-g";

const API_KEYS = {
    reed: "0131ec23-7b64-4583-b114-656f314a5f88",
    usajobs: "OpbCxE8kVUXE11KUj3wnMDMpq1LPDpsURJ0HBBeidb4=",
    adzuna_id: "810bfb38",
    adzuna_key: "3106d8c7666d395bf940de6d17201e17"
};

const KEYWORDS = [
    'Software Engineer', 'Backend Developer', 'Frontend Engineer', 'Full Stack Developer',
    'DevOps Engineer', 'Data Engineer', 'Machine Learning Engineer', 'Security Engineer',
    'Cloud Architect', 'Mobile Developer', 'Embedded Engineer', 'QA Engineer'
];

const AGGREGATORS = [
    { provider: 'REED', regions: ['London', 'Manchester', 'United Kingdom', 'Remote'] },
    { provider: 'ADZUNA', regions: ['gb', 'us', 'ca', 'nl', 'de', 'fr'] },
    { provider: 'USAJOBS', regions: [''] },
    { provider: 'ARBEITNOW', regions: [''] },
    { provider: 'REMOTIVE', regions: [''] }
];

async function run() {
    console.log("🚀 Starting Mass API Ingestion Matrix...");
    for (const agg of AGGREGATORS) {
        console.log(`📡 Ingesting from ${agg.provider}...`);
        for (const region of agg.regions) {
            for (const kw of KEYWORDS) {
                let identifier = kw;
                if (agg.provider === 'REED') identifier = `${kw}:${region}`;
                if (agg.provider === 'ADZUNA') {
                    for (let page = 1; page <= 3; page++) {
                        const adzId = `${region}:${kw}:${page}`;
                        await trigger(agg.provider, adzId);
                    }
                    continue;
                }
                await trigger(agg.provider, identifier);
            }
        }
    }
    console.log("🏁 Mass Ingestion Finished.");
}

async function trigger(provider: string, identifier: string) {
    try {
        console.log(`   👉 Triggering ${provider} for [${identifier}]`);
        const resp = await fetch(`${SUPABASE_URL}/functions/v1/ats-engine-ultimate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify({
                company_id: '00000000-0000-0000-0000-000000000000',
                name: 'Mass API Ingest',
                ats_provider: provider,
                ats_identifier: identifier,
                api_keys: API_KEYS
            })
        });
        if (resp.ok) {
            const result = await resp.json();
            console.log(`      ✅ Received ${result.count || 0} jobs`);
        } else {
            console.error(`      ❌ Failed: ${resp.status}`);
        }
    } catch (e) {
        console.error(`      ❌ Error: ${e.message}`);
    }
}

run();
