// Shared module: Job Normalizer
// Extracts structured data from raw job postings
/**
 * Extract role category from job title
 */
export function normalizeRole(title) {
    const t = title.toLowerCase();
    // Frontend patterns
    if (/\b(frontend|front-end|front end|react|vue|angular|ui engineer)\b/.test(t)) {
        return 'frontend';
    }
    // Fullstack patterns
    if (/\b(fullstack|full-stack|full stack)\b/.test(t)) {
        return 'fullstack';
    }
    // Mobile patterns
    if (/\b(mobile|ios|android|react native|flutter|swift)\b/.test(t)) {
        return 'mobile';
    }
    // DevOps/SRE patterns
    if (/\b(devops|sre|site reliability|infrastructure|platform)\b/.test(t)) {
        return 'devops';
    }
    // ML/AI patterns
    if (/\b(machine learning|ml|ai|artificial intelligence|deep learning|nlp|computer vision)\b/.test(t)) {
        return 'ml';
    }
    // Data patterns
    if (/\b(data engineer|data scientist|data analyst|analytics|etl|data platform)\b/.test(t)) {
        return 'data';
    }
    // Security patterns
    if (/\b(security|infosec|appsec|cybersecurity|penetration)\b/.test(t)) {
        return 'security';
    }
    // Product patterns
    if (/\b(product manager|product lead|pm|product owner)\b/.test(t)) {
        return 'product';
    }
    // Design patterns
    if (/\b(designer|ux|ui\/ux|product design)\b/.test(t)) {
        return 'design';
    }
    // Backend (default for software engineer)
    if (/\b(backend|back-end|back end|software engineer|swe|developer|engineer)\b/.test(t)) {
        return 'backend';
    }
    return 'other';
}
/**
 * Extract seniority from job title
 */
export function normalizeSeniority(title) {
    const t = title.toLowerCase();
    if (/\b(intern|internship)\b/.test(t))
        return 'intern';
    if (/\b(junior|jr|entry|associate|new grad|graduate)\b/.test(t))
        return 'junior';
    if (/\b(principal|distinguished|fellow)\b/.test(t))
        return 'principal';
    if (/\b(staff|staff\+)\b/.test(t))
        return 'staff';
    if (/\b(lead|tech lead|team lead|engineering lead)\b/.test(t))
        return 'lead';
    if (/\b(manager|director|head of|vp|chief)\b/.test(t))
        return 'manager';
    if (/\b(senior|sr|sr\.|iii|3)\b/.test(t))
        return 'senior';
    // Default to mid-level
    return 'mid';
}
/**
 * Extract location type from location string
 */
export function normalizeLocation(location) {
    const l = location.toLowerCase();
    if (/\b(remote|anywhere|distributed|work from home|wfh)\b/.test(l)) {
        return 'remote';
    }
    if (/\b(hybrid|flexible|partial)\b/.test(l)) {
        return 'hybrid';
    }
    return 'onsite';
}
/**
 * Calculate quality score for a job (0-1)
 * Higher score = more complete/reliable data
 */
export function calculateQualityScore(job) {
    let score = 0;
    // Title present and reasonable length
    if (job.title && job.title.length > 5 && job.title.length < 200) {
        score += 0.25;
    }
    // Company present
    if (job.company && job.company.length > 1) {
        score += 0.20;
    }
    // Location present
    if (job.location && job.location.length > 2) {
        score += 0.15;
    }
    // Valid URL
    if (job.url && (job.url.startsWith('http://') || job.url.startsWith('https://'))) {
        score += 0.25;
    }
    // Description present
    if (job.description && job.description.length > 50) {
        score += 0.15;
    }
    return Math.min(1, score);
}
/**
 * Full normalization pipeline
 */
export function normalizeJob(rawJob) {
    return {
        title: rawJob.title.trim(),
        role_category: normalizeRole(rawJob.title),
        seniority_band: normalizeSeniority(rawJob.title),
        location_type: normalizeLocation(rawJob.location),
        location_raw: rawJob.location.trim(),
        quality_score: calculateQualityScore(rawJob)
    };
}
