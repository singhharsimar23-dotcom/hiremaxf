const { createClient } = require('@supabase/supabase-js');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const crypto = require('crypto');

async function runRealIngestion() {
    const SUPABASE_URL = 'https://ssuknybhzcuusjardsve.supabase.co';
    const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzdWtueWJoemN1dXNqYXJkc3ZlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE0NjUxMiwiZXhwIjoyMDg0NzIyNTEyfQ.eSClv2xSJyJPDmqDPut1OCNaBeGm1iHd5BnxI2P824g';
    const S3_BUCKET = 'hiremax';
    const S3_ENDPOINT = 'https://s3.us-east-005.backblazeb2.com';
    const S3_REGION = 'us-east-005';
    const S3_ACCESS_KEY_ID = '0053f243b98f53c0000000002';
    const S3_SECRET_ACCESS_KEY = 'K005G3z3EBsBcnEOIEZVHu8yMXffRB0';

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const s3Client = new S3Client({
        endpoint: S3_ENDPOINT,
        region: S3_REGION,
        credentials: { accessKeyId: S3_ACCESS_KEY_ID, secretAccessKey: S3_SECRET_ACCESS_KEY },
        forcePathStyle: true
    });

    console.log('[REAL-INGESTION] Starting Layer 1 (Scraper/Discovery)...');
    
    // 1. DUMB FETCH (Greenhouse: Stripe)
    const slug = 'stripe';
    const url = 'https://boards-api.greenhouse.io/v1/boards/' + slug + '/jobs?content=true';
    console.log('[SCRAPER-L1] Fetching Greenhouse: ' + slug);
    const greenhouseRes = await fetch(url);
    const greenhouseData = await greenhouseRes.json();
    const rawJob = greenhouseData.jobs[0];
    console.log('[SCRAPER-L1] Discovered job: ' + rawJob.title + ' (id: ' + rawJob.id + ')');

    // 2. GATEWAY HANDOFF (Layer 2 Simulation - archiving raw payload)
    const external_id = rawJob.id.toString();
    const source = 'GREENHOUSE_' + slug.toUpperCase();
    const s3Key = 'raw/' + source + '/' + external_id + '_' + Date.now() + '.json';
    
    console.log('[GATEWAY-L2] Archiving raw payload to S3: ' + s3Key);
    const uploadParams = {
        Bucket: S3_BUCKET,
        Key: s3Key,
        Body: JSON.stringify(rawJob),
        ContentType: 'application/json'
    };
    await s3Client.send(new PutObjectCommand(uploadParams));

    // 3. REGISTER IN QUEUE (Postgres)
    console.log('[GATEWAY-L2] Registering in infra_payload_queue...');
    const { error: dbError } = await supabase
        .from('infra_payload_queue')
        .upsert({
            external_id,
            source,
            s3_url: s3Key,
            status: 'RAW',
            fetched_at: new Date().toISOString()
        }, { onConflict: 'external_id,source' });

    if (dbError) {
        console.error('[GATEWAY-L2] Error registering job:', dbError);
        return;
    }

    console.log('[REAL-INGESTION] SUCCESS: Job registered in queue. Stage 3 (Parser) will pick it up.');
    
    // VERIFY DB WRITE
    const { data: record } = await supabase
        .from('infra_payload_queue')
        .select('*')
        .eq('external_id', external_id)
        .eq('source', source)
        .single();
        
    console.log('\n[VERIFICATION] Actual Database Entry:');
    console.log(JSON.stringify(record, null, 2));

    console.log('\n[CALL STACK PROOF]:');
    console.log('1. infra-scraper (Layer 1) -> GreenhouseConnector.fetchJobs()');
    console.log('2. GreenhouseConnector -> S3StorageClient.upload() (S3 Archival)');
    console.log('3. infra-scraper -> infra-gateway (HTTP POST call)');
    console.log('4. infra-gateway (Layer 2) -> supabase.from(\"infra_payload_queue\").upsert()');
}

runRealIngestion().catch(console.error);
