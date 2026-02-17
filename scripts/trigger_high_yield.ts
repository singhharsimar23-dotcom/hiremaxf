
const SUPABASE_URL = 'https://ssuknybhzcuusjardsve.supabase.co';
const SERVICE_ROLE_KEY = 'YOUR_SERVICE_ROLE_KEY_HERE'; // I need the service role key for the function call if it's protected, or just anon if it allows it.

async function run() {
    const providers = ['ARBEITNOW', 'REMOTIVE'];
    for (const p of providers) {
        console.log(`Triggering ${p}...`);
        const res = await fetch(`${SUPABASE_URL}/functions/v1/ats-engine-ultimate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzdWtueWJoemN1dXNqYXJkc3ZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxNDY1MTIsImV4cCI6MjA4NDcyMjUxMn0.9XaUxtMi3btKZIA_sXQCNJI20-iwruxXISr2J1Kmr-g`
            },
            body: JSON.stringify({ ats_provider: p, company_id: '00000000-0000-0000-0000-000000000000', name: 'Mass Ingestion' })
        });
        const data = await res.json();
        console.log(`${p}:`, data);
    }
}
run();
