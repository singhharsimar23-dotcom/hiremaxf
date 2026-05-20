const { createClient } = require('@supabase/supabase-js');

async function getRaw() {
    const SUPABASE_URL = 'https://ssuknybhzcuusjardsve.supabase.co';
    const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzdWtueWJoemN1dXNqYXJkc3ZlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE0NjUxMiwiZXhwIjoyMDg0NzIyNTEyfQ.eSClv2xSJyJPDmqDPut1OCNaBeGm1iHd5BnxI2P824g';
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data } = await supabase
        .from('infra_payload_queue')
        .select('*')
        .eq('status', 'RAW')
        .ilike('source', 'GREENHOUSE%')
        .limit(1);

    console.log(JSON.stringify(data[0]));
}
getRaw();
