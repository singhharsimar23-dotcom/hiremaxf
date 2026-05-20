const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

function normalizeRole(title) {
    const t = title.toLowerCase();
    if (/\b(frontend|front-end|front end|react|vue|angular|ui engineer)\b/.test(t)) return 'frontend';
    if (/\b(fullstack|full-stack|full stack)\b/.test(t)) return 'fullstack';
    if (/\b(mobile|ios|android|react native|flutter|swift)\b/.test(t)) return 'mobile';
    if (/\b(devops|sre|site reliability|infrastructure|platform)\b/.test(t)) return 'devops';
    if (/\b(machine learning|ml|ai|artificial intelligence|deep learning|nlp|computer vision)\b/.test(t)) return 'ml';
    if (/\b(data engineer|data scientist|data analyst|analytics|etl|data platform)\b/.test(t)) return 'data';
    if (/\b(security|infosec|appsec|cybersecurity|penetration)\b/.test(t)) return 'security';
    if (/\b(product manager|product lead|pm|product owner)\b/.test(t)) return 'product';
    if (/\b(designer|ux|ui\/ux|product design)\b/.test(t)) return 'design';
    if (/\b(tpm|technical program manager|project manager|program manager)\b/.test(t)) {
        if (t.includes('technical') || t.includes('pm')) return 'tpm';
        return 'product';
    }
    if (/\b(embedded|firmware|iot|kernel|driver|low level|hardware enginee)\b/.test(t)) return 'embedded';
    if (/\b(systems enginee|systems design|distributed systems)\b/.test(t)) return 'systems';
    if (/\b(blockchain|web3|ethereum|solidity|smart contract|crypto)\b/.test(t)) return 'blockchain';
    if (/\b(backend|back-end|back end|software engineer|swe|developer|engineer|software developer)\b/.test(t)) return 'backend';
    return 'other';
}

function normalizeSeniority(title) {
    const t = title.toLowerCase();
    if (/\b(intern|internship|trainee|apprentice)\b/.test(t)) return 'intern';
    if (/\b(junior|jr|entry|associate|level 1|level i|i\b|grad\b|graduate|beginner)\b/.test(t)) return 'junior';
    if (/\b(cto|vpe|vp of|chief|director|head of|engineering manager|em\d|manager|lead manager)\b/.test(t)) return 'manager';
    if (/\b(principal|distinguished|fellow|architect|l7|l8|e7|e8)\b/.test(t)) return 'principal';
    if (/\b(staff|staff\+|l6|e6)\b/.test(t)) return 'staff';
    if (/\b(lead|tech lead|team lead|technical lead|l5|e5)\b/.test(t)) return 'lead';
    if (/\b(senior|sr|sr\.|iii|3|l4|e4|lead engineer)\b/.test(t)) return 'senior';
    if (/\b(intermediate|mid-level|mid level|mid\.?|ii\b|2|l3|e3)\b/.test(t)) return 'mid';
    return 'unknown';
}

async function generateFingerprint(company, title, location, external_id, url) {
    const raw = `${company}:${title}:${location}:${external_id || url}`.toLowerCase();
    return crypto.createHash('md5').update(raw).digest('hex');
}

async function runParser() {
    const START_ID = '01f5c6f7-52ea-4539-9cd9-bded8fb670c4';
    const SUPABASE_URL = 'https://ssuknybhzcuusjardsve.supabase.co';
    const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzdWtueWJoemN1dXNqYXJkc3ZlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE0NjUxMiwiZXhwIjoyMDg0NzIyNTEyfQ.eSClv2xSJyJPDmqDPut1OCNaBeGm1iHd5BnxI2P824g';
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const s3 = new S3Client({
        region: 'auto',
        endpoint: 'https://78477741be92d4719273c52e1966a33c.r2.cloudflarestorage.com',
        credentials: {
            accessKeyId: '9ae37b9273c52e1966a33c78477741be',
            secretAccessKey: '477741be9ae37b9273c52e1966a33c52e1966a33c78477741be9ae37b927'
        }
    });

    console.log('[STAGE-4] FETCHING PENDING QUEUE ITEM:', START_ID);
    const { data: item } = await supabase.from('infra_payload_queue').select('*').eq('id', START_ID).single();
    
    if (!item) {
        console.error('ERROR: QUEUE ITEM NOT FOUND');
        return;
    }

    console.log('[STAGE-4] READING RAW JSON FROM S3:', item.s3_url);
    const s3Res = await s3.send(new GetObjectCommand({ Bucket: 'hiremax', Key: item.s3_url }));
    const rawText = await s3Res.Body.transformToString();
    const fullPayload = JSON.parse(rawText);

    console.log('[STAGE-4] EXTRACTING JOB BY EXTERNAL_ID:', item.external_id);
    const rawJob = (fullPayload.jobs || []).find(j => j.id.toString() === item.external_id);
    if (!rawJob) {
        console.error('ERROR: JOB NOT FOUND IN PAYLOAD');
        return;
    }

    const company = item.source.split('_').slice(1).join('_');
    const norm = {
        title: rawJob.title,
        company,
        location: rawJob.location?.name || "San Francisco",
        url: rawJob.absolute_url,
        role_category: normalizeRole(rawJob.title),
        seniority_band: normalizeSeniority(rawJob.title)
    };

    console.log('[STAGE-4] NORMALIZED OUTPUT:');
    console.log(JSON.stringify(norm, null, 2));

    const fingerprint = await generateFingerprint(norm.company, norm.title, norm.location, item.external_id, norm.url);
    console.log('[STAGE-5] GENERATED FINGERPRINT:', fingerprint);

    console.log('[STAGE-5] UPSERTING TO [job_pointers]...');
    const { error: upsertErr } = await supabase.from('job_pointers').upsert({
        fingerprint,
        company_name: norm.company,
        title: norm.title,
        role_category: norm.role_category,
        seniority_band: norm.seniority_band,
        location_name: norm.location,
        source_url: norm.url,
        source_type: 'GREENHOUSE',
        ats_provider: 'greenhouse',
        external_id: item.external_id,
        confidence_tier: 'high',
        quality_score: 1.0,
        discovery_method: 'API',
        last_verified_at: new Date().toISOString(),
        raw_payload_url: item.s3_url
    }, { onConflict: 'fingerprint' });

    if (upsertErr) {
        console.error('ERROR UPSERTING POINTER:', upsertErr.message);
        return;
    }

    console.log('[STAGE-5] UPDATING QUEUE STATUS RAW -> DONE...');
    const { error: updateErr } = await supabase.from('infra_payload_queue').update({ status: 'DONE' }).eq('id', START_ID);
    
    if (updateErr) {
        console.error('ERROR UPDATING QUEUE:', updateErr.message);
        return;
    }

    console.log('--- PARSER STAGE SUCCESS ---');
}

runParser();
