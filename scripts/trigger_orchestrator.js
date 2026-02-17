
const fetch = require('node-fetch');

async function triggerOrchestrator() {
    const url = 'https://ssuknybhzcuusjardsve.supabase.co/functions/v1/discovery-orchestrator';
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!key) {
        console.error("Missing SUPABASE_SERVICE_ROLE_KEY env var.");
        process.exit(1);
    }

    console.log(`Triggering Orchestrator at ${url}...`);
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${key}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({})
        });

        const data = await res.json();
        console.log("Success:", JSON.stringify(data, null, 2));
    } catch (e) {
        console.error("Failed:", e.message);
    }
}

triggerOrchestrator();
