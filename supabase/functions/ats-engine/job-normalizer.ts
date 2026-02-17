// Shared module: Job Normalizer
// Extracts structured data from raw job postings

/**
 * Role categories for classification
 */
export type RoleCategory =
    | 'backend' | 'frontend' | 'fullstack' | 'mobile'
    | 'devops' | 'sre' | 'ml' | 'data' | 'security'
    | 'product' | 'design' | 'other';

/**
 * Seniority bands
 */
export type SeniorityBand = 'intern' | 'junior' | 'mid' | 'senior' | 'staff' | 'principal' | 'lead' | 'manager';

/**
 * Location types
 */
export type LocationType = 'remote' | 'hybrid' | 'onsite';

/**
 * Normalized job structure
 */
export interface NormalizedJob {
    title: string;
    role_category: RoleCategory;
    seniority_band: SeniorityBand;
    location_type: LocationType;
    location_raw: string;
    quality_score: number;
}

/**
 * Extract role category from job title
 */
export function normalizeRole(title: string): RoleCategory {
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
 * Phase B: Direct ATS Integration Filter
 * Only allow jobs that match these tech categories.
 */
export function isTechJob(title: string): boolean {
    const category = normalizeRole(title);
    const techCategories: RoleCategory[] = [
        'backend', 'frontend', 'fullstack', 'mobile',
        'devops', 'sre', 'ml', 'data', 'security', 'product'
    ];

    // Explicit keywords for tech jobs that might be missed by normalizeRole
    const techKeywords = [
        'software', 'engineer', 'developer', 'technical', 'infrastructure',
        'cloud', 'system', 'embedded', 'blockchain', 'technical program manager',
        'tpm', 'cybersecurity'
    ];

    const t = title.toLowerCase();
    const hasKeyword = techKeywords.some(kw => t.includes(kw));

    return techCategories.includes(category) || hasKeyword;
}

/**
 * Extract seniority from job title
 */
export function normalizeSeniority(title: string): SeniorityBand {
    const t = title.toLowerCase();

    if (/\b(intern|internship)\b/.test(t)) return 'intern';
    if (/\b(junior|jr|entry|associate|new grad|graduate)\b/.test(t)) return 'junior';
    if (/\b(principal|distinguished|fellow)\b/.test(t)) return 'principal';
    if (/\b(staff|staff\+)\b/.test(t)) return 'staff';
    if (/\b(lead|tech lead|team lead|engineering lead)\b/.test(t)) return 'lead';
    if (/\b(manager|director|head of|vp|chief)\b/.test(t)) return 'manager';
    if (/\b(senior|sr|sr\.|iii|3)\b/.test(t)) return 'senior';

    // Default to mid-level
    return 'mid';
}

/**
 * Extract location type from location string
 */
export function normalizeLocation(location: string): LocationType {
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
export function calculateQualityScore(job: {
    title?: string;
    company?: string;
    location?: string;
    url?: string;
    description?: string;
}): number {
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
export function normalizeJob(rawJob: {
    title: string;
    company?: string;
    location: string;
    url?: string;
    description?: string;
}): NormalizedJob {
    return {
        title: rawJob.title.trim(),
        role_category: normalizeRole(rawJob.title),
        seniority_band: normalizeSeniority(rawJob.title),
        location_type: normalizeLocation(rawJob.location),
        location_raw: rawJob.location.trim(),
        quality_score: calculateQualityScore(rawJob)
    };
}
