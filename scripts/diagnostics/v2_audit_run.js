const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzdWtueWJoemN1dXNqYXJkc3ZlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE0NjUxMiwiZXhwIjoyMDg0NzIyNTEyfQ.eSClv2xSJyJPDmqDPut1OCNaBeGm1iHd5BnxI2P824g";
const PROJECT_URL = "https://ssuknybhzcuusjardsve.supabase.co";

async function runAudit() {
    const body = {
        user_id: "2e0192ce-e0dc-4c77-9322-cfa691fc7e85",
        command_id: "2d894094-86b0-48b2-bacd-aa82f179a5c2",
        source: "RESUME_AUDIT_V2",
        source_type: "FILE",
        action: "INGEST",
        payload: {
            text: `
            Harsimar Singh
            Senior Software Engineer
            
            Experience:
            - TechLead at Google (2020-2024): Scaled global ingestion pipelines.
            - Software Engineer at Meta (2016-2020): Optimized React state management.
            
            Education:
            - BS in CS, Stanford University (2012-2016)
            
            Skills: TypeScript, Rust, Postgres, Supabase, LLM Engineering.
            `
        }
    };

    console.log("Invoking ingest-identity-v2...");
    const res = await fetch(`${PROJECT_URL}/functions/v1/ingest-identity-v2`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
            "apikey": SERVICE_ROLE_KEY,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    });

    const result = await res.json();
    console.log("Response:", JSON.stringify(result, null, 2));
}

runAudit();
