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

async function runParserProof() {
    const SUPABASE_URL = 'https://ssuknybhzcuusjardsve.supabase.co';
    const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzdWtueWJoemN1dXNqYXJkc3ZlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE0NjUxMiwiZXhwIjoyMDg0NzIyNTEyfQ.eSClv2xSJyJPDmqDPut1OCNaBeGm1iHd5BnxI2P824g';
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. SELECT ONE REAL RECORD FROM QUEUE
    console.log('[PARSER-STAGE] FETCHING RECORD FROM [infra_payload_queue]...');
    const { data: item } = await supabase
        .from('infra_payload_queue')
        .select('*')
        .eq('status', 'RAW')
        .eq('source', 'GREENHOUSE_STRIPE')
        .single();

    if (!item) {
        console.error('ERROR: NO RAW RECORD FOUND FOR GREENHOUSE_STRIPE');
        return;
    }

    console.log('[PARSER-STAGE] INPUT (S3 URL): ' + item.s3_url);

    // 2. FETCH REAL RAW DATA (Emulating S3 read from the source)
    const ghUrl = 'https://boards-api.greenhouse.io/v1/boards/stripe/jobs/' + item.external_id + '?questions=true';
    console.log('[PARSER-STAGE] RETRIEVING RAW PAYLOAD FROM SOURCE...');
    const rawRes = await fetch(ghUrl);
    const rawJob = await rawRes.json();

    console.log('[PARSER-STAGE] RAW JSON (Snippet):');
    console.log(JSON.stringify(rawJob, null, 2).substring(0, 300) + '...');

    // 3. EXECUTE NORMALIZATION (TRUSTED CORE LOGIC)
    const company = item.source.split('_').slice(1).join('_');
    const norm = {
        title: rawJob.title,
        company,
        location: rawJob.location?.name || 'Remote',
        url: rawJob.absolute_url,
        role_category: normalizeRole(rawJob.title),
        seniority_band: normalizeSeniority(rawJob.title)
    };

    console.log('\n[PARSER-STAGE] NORMALIZED OUTPUT:');
    console.log(JSON.stringify(norm, null, 2));

    // 4. FINGERPRINT & WRITE TO PRODUCTION
    const fingerprint = await generateFingerprint(norm.company, norm.title, norm.location, item.external_id, norm.url);
    console.log('[PARSER-STAGE] FINGERPRINT: ' + fingerprint);

    console.log('[PARSER-STAGE] UPSERTING TO [job_pointers]...');
    const { error: upsertError } = await supabase.from('job_pointers').upsert({
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
    });

    if (upsertError) {
        console.error('[DATABASE-ERROR]:', upsertError.message);
        return;
    }

    // 5. UPDATE STATUS TO DONE
    console.log('[PARSER-STAGE] UPDATING QUEUE STATUS RAW -> DONE...');
    await supabase.from('infra_payload_queue').update({ status: 'DONE' }).eq('id', item.id);

    console.log('\n--- EXECUTION SUCCESS ---');
    console.log('Final Job Pointer Registered.');
}

runParserProof().catch(console.error);
