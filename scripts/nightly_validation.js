import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function nightlySweep() {
    console.log("🌙 Starting Nightly Deep Validation Sweep (Top 5k)...");

    // 1. Fetch Top 5,000 "Most Viewed" or "Trending" jobs
    // Note: Since we don't have a view_count column yet, we simulate via popularity or recency for this demo
    const { data: jobs, error } = await supabase
        .from('job_pointers')
        .select('id, source_url')
        .order('created_at', { ascending: false }) // Fallback: latest jobs
        .limit(5000);

    if (error) {
        console.error("Error fetching jobs for sweep:", error);
        return;
    }

    let stats = { validated: 0, closed: 0, errors: 0 };
    const BATCH_SIZE = 50;

    for (let i = 0; i < jobs.length; i += BATCH_SIZE) {
        const batch = jobs.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(async (job) => {
            try {
                const res = await fetch(job.source_url, {
                    method: 'GET',
                    headers: { 'User-Agent': 'HireMax-Validator/1.0' },
                    timeout: 10000
                });

                const status = res.ok ? 'ALIVE' : 'CLOSED';
                if (!res.ok) stats.closed++;

                // Update job pointer status and last_checked_at
                await supabase
                    .from('job_pointers')
                    .update({
                        validation_status: status,
                        last_validation_attempt: new Date().toISOString(),
                        last_checked_at: new Date().toISOString()
                    })
                    .eq('id', job.id);

                stats.validated++;
            } catch (e) {
                stats.errors++;
            }
        }));
        process.stdout.write(`📉 Progress: ${Math.min(i + BATCH_SIZE, jobs.length)}/5000\r`);
    }

    console.log(`\n✅ Nightly Sweep Complete. Validated: ${stats.validated}, Closed: ${stats.closed}, Errors: ${stats.errors}`);
}

nightlySweep().catch(console.error);
