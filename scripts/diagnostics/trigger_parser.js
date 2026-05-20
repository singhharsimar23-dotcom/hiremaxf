
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzdWtueWJoemN1dXNqYXJkc3ZlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE0NjUxMiwiZXhwIjoyMDg0NzIyNTEyfQ.eSClv2xSJyJPDmqDPut1OCNaBeGm1iHd5BnxI2P824g';
const URL = 'https://ssuknybhzcuusjardsve.supabase.co/functions/v1/infra-parser';

async function trigger() {
    console.log("Triggering infra-parser...");
    const res = await fetch(URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        }
    });
    const text = await res.text();
    console.log("Response:", text);
}

trigger().catch(console.error);
