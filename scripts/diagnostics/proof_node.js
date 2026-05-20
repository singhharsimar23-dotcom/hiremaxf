const crypto = require('crypto');

// --- PORTS FROM infra/shared-core/job-normalizer.ts ---
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

function normalizeLocationType(location) {
    const l = location.toLowerCase();
    if (/\b(remote|anywhere|distributed|work from home|wfh)\b/.test(l)) return 'remote';
    if (/\b(hybrid|flexible|partial)\b/.test(l)) return 'hybrid';
    return 'onsite';
}

function calculateQualityScore(job) {
    let score = 0;
    if (job.title && job.title.length > 5) score += 0.25;
    if (job.company && job.company.length > 1) score += 0.20;
    if (job.location && job.location.length > 2) score += 0.15;
    if (job.url && job.url.startsWith('http')) score += 0.25;
    if (job.description && job.description.length > 50) score += 0.15;
    return Math.min(1, score).toFixed(2);
}

// --- PORTS FROM infra/shared-core/fingerprint.ts ---
function normalizeUrl(url) {
    if (!url) return '';
    try {
        const u = new URL(url);
        let normalized = (u.origin + u.pathname).toLowerCase();
        if (normalized.endsWith('/')) normalized = normalized.slice(0, -1);
        return normalized;
    } catch {
        return (url || '').toLowerCase().trim().replace(/\/$/, '');
    }
}

async function generateFingerprint(source, url) {
    const normalizedSrc = (source || 'unknown').toLowerCase().trim();
    const normalizedUrl = normalizeUrl(url);
    const text = `${normalizedSrc}|${normalizedUrl}`;
    return crypto.createHash('md5').update(text).digest('hex');
}

// --- MAIN PROOF RUNNER ---
async function main() {
    const res = await fetch('https://boards-api.greenhouse.io/v1/boards/stripe/jobs?content=true');
    const data = await res.json();
    const rawJob = data.jobs[0];

    console.log('--- FINAL INGESTION PROOF: STRIPE / GREENHOUSE ---');
    console.log('[RAW ID]:      ', rawJob.id);
    console.log('[RAW TITLE]:   ', rawJob.title);
    console.log('[RAW URL]:     ', rawJob.absolute_url);
    console.log('[RAW LOC]:     ', rawJob.location.name);

    const role = normalizeRole(rawJob.title);
    const seniority = normalizeSeniority(rawJob.title);
    const locType = normalizeLocationType(rawJob.location.name);
    const quality = calculateQualityScore({
        title: rawJob.title,
        company: 'Stripe',
        location: rawJob.location.name,
        url: rawJob.absolute_url,
        description: rawJob.content
    });
    const fingerprint = await generateFingerprint('legacy', rawJob.absolute_url);

    const record = {
        fingerprint,
        company_name: 'STRIPE',
        title: rawJob.title,
        role_category: role,
        seniority_band: seniority,
        location_name: rawJob.location.name,
        location_type: locType,
        source_url: rawJob.absolute_url,
        source_type: 'GREENHOUSE',
        external_id: rawJob.id.toString(),
        quality_score: parseFloat(quality),
        timestamp: new Date().toISOString()
    };

    console.log('\n--- TRANSFORMED PRODUCTION PAYLOAD (PROOF) ---');
    console.log(JSON.stringify(record, null, 2));
}

main().catch(console.error);
