const url = "https://ssuknybhzcuusjardsve.supabase.co/rest/v1/source_reliability?status=neq.ACTIVE";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzdWtueWJoemN1dXNqYXJkc3ZlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE0NjUxMiwiZXhwIjoyMDg0NzIyNTEyfQ.eSClv2xSJyJPDmqDPut1OCNaBeGm1iHd5BnxI2P824g";

async function revive() {
  console.log("Starting source revival...");
  try {
    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        status: 'ACTIVE',
        consecutive_failures: 0,
        retry_after: null
      })
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`Failed to revive sources: ${res.status} ${body}`);
      process.exit(1);
    }

    const data = await res.json();
    console.log(`Successfully revived ${data.length} sources.`);
    console.log("Sources revived:", data.map(s => s.source_name).join(", "));
  } catch (e) {
    console.error("Fatal error during revival:", e);
    process.exit(1);
  }
}

revive();
