
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://ssuknybhzcuusjardsve.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzdWtueWJoemN1dXNqYXJkc3ZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxNDY1MTIsImV4cCI6MjA4NDcyMjUxMn0.9XaUxtMi3btKZIA_sXQCNJI20-iwruxXISr2J1Kmr-g";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;

async function run() {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    // Fetch targets from registry (Greenhouse, Lever, Ashby)
    const { data: targets, error } = await supabase
        .from('company_registry_expanded')
        .select('id, company_name, ats_provider, ats_identifier')
        .not('ats_provider', 'is', null)
        .in('ats_provider', ['GREENHOUSE', 'LEVER', 'ASHBY']);

    if (error) {
        console.error("Error fetching targets:", error);
        return;
    }

    console.log(`🚀 Retriggering ${targets.length} warm targets...`);

    const BATCH_SIZE = 5; // Low concurrency to avoid rate limits
    for (let i = 0; i < targets.length; i += BATCH_SIZE) {
        const batch = targets.slice(i, i + BATCH_SIZE);
        console.log(`📦 Processing batch ${i / BATCH_SIZE + 1}...`);

        await Promise.all(batch.map(async (t) => {
            try {
                const resp = await fetch(`${SUPABASE_URL}/functions/v1/ats-engine`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${SUPABASE_KEY}`
                    },
                    body: JSON.stringify({
                        company_id: t.id,
                        name: t.company_name,
                        ats_provider: t.ats_provider,
                        ats_identifier: t.ats_identifier
                    })
                });
                const result = await resp.json();
                console.log(`   ✅ ${t.company_name}: ${result.count || 0} jobs`);
            } catch (e) {
                console.error(`   ❌ ${t.company_name} failed:`, e.message);
            }
        }));
    }

    console.log("🏁 Retrigger finished.");
}

run();
