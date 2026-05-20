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

async function main() {
    const res = await fetch('https://boards-api.greenhouse.io/v1/boards/stripe/jobs?content=true');
    const data = await res.json();
    const rawJob = data.jobs[0];

    const source = 'legacy';
    const normalizedUrl = normalizeUrl(rawJob.absolute_url);
    const text = source + '|' + normalizedUrl;
    const fingerprint = crypto.createHash('md5').update(text).digest('hex');

    const record = {
        fingerprint,
        company_name: 'STRIPE',
        title: rawJob.title,
        role_category: normalizeRole(rawJob.title),
        seniority_band: normalizeSeniority(rawJob.title),
        location_name: rawJob.location.name,
        location_type: normalizeLocationType(rawJob.location.name),
        source_url: rawJob.absolute_url,
        source_type: 'GREENHOUSE',
        external_id: rawJob.id.toString(),
        timestamp: new Date().toISOString()
    };

    console.log('--- STRIPE/GREENHOUSE INGESTION PROOF ---');
    console.log(JSON.stringify(record, null, 2));
}

main().catch(console.error);
