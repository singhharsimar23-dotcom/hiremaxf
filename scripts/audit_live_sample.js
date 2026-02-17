
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://ssuknybhzcuusjardsve.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzdWtueWJoemN1dXNqYXJkc3ZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxNDY1MTIsImV4cCI6MjA4NDcyMjUxMn0.9XaUxtMi3btKZIA_sXQCNJI20-iwruxXISr2J1Kmr-g";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function validateSample() {
    console.log("🔍 Sampling 1000 jobs for live validation (Batch Mode)...");

    const { data: jobs, error } = await supabase
        .from('job_pointers')
        .select('id, source_url')
        .limit(1000)
        .order('id');

    if (error || !jobs) {
        console.error("Failed to fetch jobs:", error);
        return;
    }

    let ok_200 = 0;
    let total_redirects = 0;
    let closed_jobs = 0;
    let total_attempts = 0;

    const BATCH_SIZE = 50;
    for (let i = 0; i < jobs.length; i += BATCH_SIZE) {
        const batch = jobs.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(async (job) => {
            try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 10000);

                const res = await fetch(job.source_url, {
                    method: 'HEAD',
                    redirect: 'follow',
                    headers: { 'User-Agent': 'Mozilla/5.0' },
                    signal: controller.signal
                });

                clearTimeout(timeout);
                total_attempts++;
                if (res.status === 200) ok_200++;
                if (res.redirected) total_redirects++;
                if (res.status === 404 || res.status === 410) closed_jobs++;
            } catch (e) {
                total_attempts++;
            }
        }));
        console.log(`Progress: ${Math.min(i + BATCH_SIZE, jobs.length)}/1000`);
    }

    console.log("\n--- LIVE VALIDATION RESULTS ---");
    console.log(`Total Attempts: ${total_attempts}`);
    console.log(`200 OK %: ${((ok_200 / total_attempts) * 100).toFixed(2)}%`);
    console.log(`Redirects detected: ${((total_redirects / total_attempts) * 100).toFixed(2)}%`);
    console.log(`Closed Job % (404/410): ${((closed_jobs / total_attempts) * 100).toFixed(2)}%`);
}

validateSample();
