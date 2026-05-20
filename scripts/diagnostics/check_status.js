const { createClient } = require('@supabase/supabase-js');

async function check() {
    const SUPABASE_URL = 'https://ssuknybhzcuusjardsve.supabase.co';
    const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzdWtueWJoemN1dXNqYXJkc3ZlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE0NjUxMiwiZXhwIjoyMDg0NzIyNTEyfQ.eSClv2xSJyJPDmqDPut1OCNaBeGm1iHd5BnxI2P824g';
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log('--- Checking infra_payload_queue ---');
    const { data: queue } = await supabase
        .from('infra_payload_queue')
        .select('*')
        .eq('id', '01f5c6f7-52ea-4539-9cd9-bded8fb670c4');
    console.log(JSON.stringify(queue[0], null, 2));

    console.log('\n--- Checking job_pointers ---');
    const { data: pointers } = await supabase
        .from('job_pointers')
        .select('*')
        .eq('external_id', '7532733')
        .eq('source_type', 'GREENHOUSE');
    console.log(JSON.stringify(pointers[0], null, 2));
}

check();
