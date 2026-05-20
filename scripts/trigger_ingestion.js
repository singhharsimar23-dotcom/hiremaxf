const url = "https://hiremax-ingestion.singh-harsimar23.workers.dev";
const secret = "hiremax_internal_trusted_core_2024";

async function triggerIngestion() {
  console.log(`Triggering ALPHA ingestion at ${url}...`);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secret}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ group: 'alpha' })
    });

    if (!res.ok) {
        const body = await res.text();
        console.error(`Trigger failed: ${res.status} ${body}`);
        process.exit(1);
    }

    const data = await res.json();
    console.log("Ingestion triggered successfully!");
    console.log("Response:", JSON.stringify(data, null, 2));
    console.log("\nNext checks:");
    console.log("1. Check Supabase 'job_pointers' for new entries with today's date.");
    console.log("2. Check Supabase 'worker_heartbeat' for 'cloudflare-ingestion-v3 (http)' signal.");
  } catch (e) {
    console.error("Fatal error during trigger:", e);
    process.exit(1);
  }
}

triggerIngestion();
