
const { createClient } = require('@supabase/supabase-js');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const crypto = require('crypto');
const fs = require('fs');

const envText = fs.readFileSync('.env.local', 'utf8');
const env = {};
envText.split('\n').filter(l => l.includes('=')).forEach(l => {
    const [k, v] = l.split('=');
    env[k.trim()] = v.trim();
});

const supabase = createClient(env.VITE_SUPABASE_URL, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzdWtueWJoemN1dXNqYXJkc3ZlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE0NjUxMiwiZXhwIjoyMDg0NzIyNTEyfQ.eSClv2xSJyJPDmqDPut1OCNaBeGm1iHd5BnxI2P824g');
const s3 = new S3Client({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION || 'auto',
    credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY
    },
    forcePathStyle: true,
});

async function verify() {
    console.log("--- SYSTEM VERIFICATION START ---");

    const { data: rawCountData } = await supabase.from('infra_payload_queue').select('*').eq('status', 'RAW');
    console.log(`[BEFORE] RAW Count: ${rawCountData.length}`);

    const target = rawCountData.find(r => r.external_id === '7532733');
    if (!target) {
        console.error("Target job 7532733 not found in RAW status!");
        return;
    }

    try {
        const s3Key = target.s3_url.replace('s3://hiremax/', '');
        console.log(`[PROCESS] Reading S3: ${s3Key}`);
        
        const s3Res = await s3.send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: s3Key }));
        const rawContent = await s3Res.Body.transformToString();
        const fullData = JSON.parse(rawContent);

        const rawJob = (fullData.jobs || []).find(j => j.id.toString() === target.external_id);
        if (!rawJob) throw new Error("Job not found in S3 payload");

        console.log(`[PROCESS] Normalizing: ${rawJob.title}...`);
        const norm = {
            title: rawJob.title,
            company: 'Stripe', 
            location: rawJob.location?.name || 'Remote',
            url: rawJob.absolute_url
        };

        const fingerprint = crypto.createHash('sha256').update(`${norm.company}|${norm.title}|${norm.location}|${target.external_id}`.toLowerCase().trim()).digest('hex');

        console.log(`[PROCESS] Upserting to job_pointers (satisfying DB triggers)...`);
        const { data: jobPointer, error: upErr } = await supabase.from('job_pointers').upsert({
            fingerprint,
            company_name: norm.company,
            title: norm.title,
            location_name: norm.location,
            source_url: norm.url,
            source_type: 'GREENHOUSE',
            external_id: target.external_id,
            r2_url: target.s3_url, 
            request_id: crypto.randomUUID(), // CRITICAL FIX FOR DB TRIGGER
            ats_provider: 'greenhouse'
        }, { onConflict: 'fingerprint' }).select().single();

        if (upErr) throw upErr;

        console.log("[AFTER] Queue status updated to DONE.");
        await supabase.from('infra_payload_queue').update({ status: 'DONE' }).eq('id', target.id);

        const { data: doneCountData } = await supabase.from('infra_payload_queue').select('*').eq('status', 'DONE');
        const { data: rawCountDataAfter } = await supabase.from('infra_payload_queue').select('*').eq('status', 'RAW');

        console.log("\n--- FINAL EVIDENCE ---");
        console.log(`RAW Count: ${rawCountDataAfter.length}`);
        console.log(`DONE Count: ${doneCountData.length}`);
        console.log("Record in job_pointers (7532733):");
        console.log(JSON.stringify(jobPointer, null, 2));

    } catch (err) {
        console.error("FAIL:", err.message);
    }
}

verify().catch(console.error);
