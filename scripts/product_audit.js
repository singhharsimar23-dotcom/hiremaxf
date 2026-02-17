import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const TECH_KEYWORDS = ['javascript', 'python', 'react', 'aws', 'docker', 'kubernetes', 'node', 'typescript', 'sql', 'nosql', 'ci/cd', 'git', 'agile', 'rest', 'api', 'java', 'c++', 'go', 'rust', 'terraform', 'cloud', 'data', 'ml', 'ai'];
const REQ_KEYWORDS = ['requirements', 'qualifications', 'what you bring', 'experience', 'skills'];
const RESP_KEYWORDS = ['responsibilities', 'what you will do', 'the role', 'key tasks', 'duties'];

async function productAudit() {
    console.log("🚀 Starting Product Readiness Script (Phases 5 & 6)...");

    const { data: jobs, error } = await supabase
        .from('job_pointers')
        .select('id, source_url, raw_payload')
        .limit(1000);

    if (error) {
        console.error("Error fetching jobs:", error);
        return;
    }

    let stats = {
        ai_ready: 0,
        low_signal: 0,
        template_dupe_check: new Set(),
        ok_200: 0,
        high_redirects: 0,
        company_landing: 0,
        apply_visible: 0,
        closed_text: 0,
        captcha_triggered: 0,
        total: jobs.length
    };

    const BATCH_SIZE = 25;
    for (let i = 0; i < jobs.length; i += BATCH_SIZE) {
        const batch = jobs.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(async (job) => {
            // Phase 5: AI Fitness (Internal Data)
            const content = (job.raw_payload?.content || "").toLowerCase();
            const descLength = content.length;
            const techCount = TECH_KEYWORDS.filter(k => content.includes(k)).length;
            const hasReq = REQ_KEYWORDS.some(k => content.includes(k));
            const hasResp = RESP_KEYWORDS.some(k => content.includes(k));

            if (descLength > 500 && techCount >= 5 && hasReq && hasResp) stats.ai_ready++;
            if (descLength < 300 || techCount < 2) stats.low_signal++;

            const hash = content.substring(0, 200); // Simple hash for template detection
            stats.template_dupe_check.add(hash);

            // Phase 6: Apply Link (GET)
            try {
                const res = await fetch(job.source_url, {
                    method: 'GET',
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' },
                    timeout: 8000
                });

                if (res.ok) stats.ok_200++;
                if (res.redirected) stats.high_redirects++; // Simple flag if any redirect happened

                const body = (await res.text()).toLowerCase();
                const url = res.url.toLowerCase();

                // Aggregator vs Company check (simple heuristic)
                const aggregatorDomains = ['jooble', 'adzuna', 'reed', 'talent.com', 'ziprecruiter', 'indeed'];
                const isAggregator = aggregatorDomains.some(d => url.includes(d));
                if (!isAggregator) stats.company_landing++;

                if (body.includes('apply')) stats.apply_visible++;
                if (body.includes('closed') || body.includes('no longer accepting')) stats.closed_text++;
                if (body.includes('captcha') || body.includes('verify you are human')) stats.captcha_triggered++;

            } catch (e) {
                // Failed requests are handled implicitly by not incrementing stats.ok_200
            }
        }));
        console.log(`Progress: ${Math.min(i + BATCH_SIZE, jobs.length)}/1000`);
    }

    console.log("\n--- PRODUCT READINESS RESULTS ---");
    console.log(`AI-Ready Descriptions: ${(stats.ai_ready / stats.total * 100).toFixed(2)}%`);
    console.log(`Low Signal Descriptions: ${(stats.low_signal / stats.total * 100).toFixed(2)}%`);
    console.log(`Template Content Score: ${(stats.template_dupe_check.size / stats.total * 100).toFixed(2)}% uniqueness`);
    console.log(`HTTP 200 (GET): ${(stats.ok_200 / stats.total * 100).toFixed(2)}%`);
    console.log(`Company Landing Rate: ${(stats.company_landing / stats.total * 100).toFixed(2)}%`);
    console.log(`Apply Button Visible: ${(stats.apply_visible / stats.total * 100).toFixed(2)}%`);
    console.log(`Closed Job Text: ${(stats.closed_text / stats.total * 100).toFixed(2)}%`);
    console.log(`CAPTCHA Rate: ${(stats.captcha_triggered / stats.total * 100).toFixed(2)}%`);
}

productAudit().catch(console.error);
