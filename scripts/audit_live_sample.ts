
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

const SUPABASE_URL = "https://ssuknybhzcuusjardsve.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzdWtueWJoemN1dXNqYXJkc3ZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxNDY1MTIsImV4cCI6MjA4NDcyMjUxMn0.9XaUxtMi3btKZIA_sXQCNJI20-iwruxXISr2J1Kmr-g";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function validateSample() {
    console.log("🔍 Sampling 1000 jobs for live validation...");

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

    for (const job of jobs) {
        try {
            const res = await fetch(job.source_url, {
                method: 'HEAD',
                redirect: 'follow',
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });

            total_attempts++;
            if (res.status === 200) ok_200++;
            if (res.redirected) total_redirects++;
            if (res.status === 404 || res.status === 410) closed_jobs++;
        } catch (e) { }
        if (total_attempts % 100 === 0) console.log(`Progress: ${total_attempts}/1000`);
    }

    console.log("\n--- LIVE VALIDATION RESULTS ---");
    console.log(`Total Attempts: ${total_attempts}`);
    console.log(`200 OK %: ${((ok_200 / total_attempts) * 100).toFixed(2)}%`);
    console.log(`Redirect Depth (avg): ${((total_redirects / total_attempts) * 100).toFixed(2)}% had redirects`);
    console.log(`Closed Job % (404/410): ${((closed_jobs / total_attempts) * 100).toFixed(2)}%`);
}

validateSample();
