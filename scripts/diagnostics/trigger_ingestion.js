const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzdWtueWJoemN1dXNqYXJkc3ZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxNDY1MTIsImV4cCI6MjA4NDcyMjUxMn0.9XaUxtMi3btKZIA_sXQCNJI20-iwruxXISr2J1Kmr-g";
const PROJECT_URL = "https://ssuknybhzcuusjardsve.supabase.co";

async function invoke(functionName) {
  console.log(`\n=> Invoking ${functionName}...`);
  try {
    const res = await fetch(`${PROJECT_URL}/functions/v1/${functionName}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ANON_KEY}`,
        'apikey': ANON_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });
    
    const text = await res.text();
    console.log(`[${res.status}] ${functionName}:`);
    try {
      console.log(JSON.stringify(JSON.parse(text), null, 2));
    } catch {
      console.log(text.substring(0, 500));
    }
  } catch (err) {
    console.error(`Error invoking ${functionName}:`, err.message);
  }
}

async function run() {
  console.log("Starting Mass Ingestion & Embedding Trigger...");
  
  // Trigger both concurrently
  await Promise.all([
    invoke('discovery-orchestrator'),
    invoke('feature-worker')
  ]);
  
  console.log("\nTrigger complete.");
}

run();
