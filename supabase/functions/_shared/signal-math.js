/**
 * HIREMAX PROFESSIONAL IDENTITY ENGINE - SIGNAL MATHEMATICS
 * This utility implements the core formulas for calculating trust, weighting,
 * and skill proficiency based on the "Mathematical Evidence Ledger" spec.
 */
// 1. BASE WEIGHTS (Signal Type Importance)
export const BASE_WEIGHTS = {
    'CURRENT_JOB_TITLE': 1.00,
    'CURRENT_COMPANY': 1.00,
    'CURRENT_SALARY': 0.95,
    'PAST_JOB_TITLE': 0.85,
    'JOB_DURATION': 0.75,
    'JOB_RESPONSIBILITIES': 0.70,
    'DEGREE': 0.80,
    'UNIVERSITY_NAME': 0.85,
    'GRADUATION_YEAR': 0.50,
    'GPA': 0.40,
    'SKILL_WITH_GITHUB_PROOF': 0.95,
    'SKILL_WITH_WORK_PROOF': 0.90,
    'SKILL_WITH_ENDORSEMENTS': 0.65,
    'SKILL_WITH_CERT': 0.75,
    'SKILL_CLAIMED_ONLY': 0.30,
    'GITHUB_ACTIVE_PROJECT': 0.90,
    'GITHUB_POPULAR_PROJECT': 0.95,
    'GITHUB_INACTIVE_PROJECT': 0.60,
    'PORTFOLIO_PROJECT': 0.70,
    'CLAIMED_PROJECT': 0.40,
    'GITHUB_COMMIT': 0.65,
    'GITHUB_PR_MERGED': 0.75,
    'GITHUB_ISSUE_CLOSED': 0.60,
    'GITHUB_CODE_REVIEW': 0.70,
    'GITHUB_STARS_RECEIVED': 0.80,
    'GITHUB_FORKS': 0.70,
    'LINKEDIN_RECOMMENDATION': 0.75,
    'LINKEDIN_ENDORSEMENT': 0.45,
    'STACKOVERFLOW_REPUTATION': 0.70,
    'PROFESSIONAL_CERT': 0.75,
    'BOOTCAMP_CERT': 0.40,
    'ONLINE_COURSE': 0.35,
    'TECHNICAL_BLOG_POST': 0.60,
    'CONFERENCE_TALK': 0.85,
    'OPEN_SOURCE_CONTRIBUTION': 0.80,
    'RESEARCH_PAPER': 0.90,
    'INTERVIEW_INVITATION': 0.95,
    'JOB_OFFER_RECEIVED': 1.00,
    'JOB_OFFER_ACCEPTED': 1.00,
    'REJECTION_AFTER_INTERVIEW': 0.80,
    'REJECTION_IMMEDIATE': 0.50,
};
// 2. SIGNAL HALF-LIVES (Days until signal value is halved)
export const SIGNAL_HALF_LIVES = {
    'CURRENT_JOB_TITLE': null,
    'CURRENT_COMPANY': null,
    'EXPERIENCE': 1825, // 5 years for career facts to lose 50% value
    'EDUCATION': 5475, // 15 years for degrees
    'PAST_JOB_TITLE': 1095,
    'JOB_RESPONSIBILITIES': 1095,
    'DEGREE': 3650,
    'UNIVERSITY_NAME': 3650,
    'SKILL_WITH_GITHUB_PROOF': 365,
    'SKILL_WITH_WORK_PROOF': 730,
    'SKILL_CLAIMED_ONLY': 180,
    'GITHUB_ACTIVE_PROJECT': 365,
    'GITHUB_INACTIVE_PROJECT': 180,
    'GITHUB_COMMIT': 90,
    'GITHUB_PR_MERGED': 180,
    'TECHNICAL_BLOG_POST': 730,
    'CONFERENCE_TALK': 1095,
    'PROFESSIONAL_CERT': 1095,
};
// 3. DECAY FLOORS (Minimum value a signal can reach)
export const DECAY_FLOORS = {
    'EXPERIENCE': 0.60,
    'EDUCATION': 0.70,
    'PAST_JOB_TITLE': 0.50,
    'DEGREE': 0.80,
    'GITHUB_COMMIT': 0.05,
    'SKILL_WITH_GITHUB_PROOF': 0.20,
};
// 4. SOURCE AUTHORITY SCORES
export const SOURCE_AUTHORITY_SCORES = {
    'LINKEDIN_OFFICIAL_API': 1.00,
    'GITHUB_OFFICIAL_API': 1.00,
    'COMPANY_EMAIL_DOMAIN': 1.00,
    'LINKEDIN_SCRAPE': 0.95,
    'GITHUB_SCRAPE': 0.95,
    'COMPANY_CAREERS_PAGE': 0.90,
    'UNIVERSITY_OFFICIAL_TRANSCRIPT': 1.00,
    'DIPLOMA_PDF': 0.95,
    'CERTIFICATE_PDF': 0.90,
    'OFFER_LETTER_PDF': 1.00,
    'RESUME_PDF': 0.80,
    'USER_INPUT_FORM': 0.70,
    'PORTFOLIO_WEBSITE': 0.75,
    'GMAIL_SCAN': 0.95,
    'STACKOVERFLOW_API': 0.85,
    'TWITTER_BIO': 0.50,
    'AI_EXTRACTED_FROM_TEXT': 0.60,
    'AI_INFERRED': 0.40,
};
// 5. CALCULATIONS
/**
 * Calculates temporal decay based on signal type and age.
 * formula: 0.5 ^ (days_ago / half_life)
 */
export function calculateTemporalDecay(type, timestamp) {
    const halfLife = SIGNAL_HALF_LIVES[type];
    if (halfLife === null || halfLife === undefined)
        return 1.0;
    const date = new Date(timestamp);
    const now = new Date();
    const daysAgo = Math.max(0, (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    const floor = DECAY_FLOORS[type] || 0.0;
    const decay = Math.pow(0.5, daysAgo / halfLife);
    return Math.max(decay, floor);
}
/**
 * Calculates verification strength based on factors.
 */
export function calculateVerificationStrength(params) {
    let score = 0.50; // Base
    if (params.hasUrlProof)
        score += 0.30;
    if (params.hasMultipleSources && params.sourceCount) {
        score += Math.min(params.sourceCount * 0.05, 0.20);
    }
    if (params.hasConsistentTimeline)
        score += 0.10;
    if (params.hasEndorsement && params.endorsementQuality) {
        score += params.endorsementQuality * 0.15;
    }
    if (params.hasArtifact) {
        if (params.artifactType === 'CODE')
            score += 0.25;
        else if (params.artifactType === 'DOCUMENT')
            score += 0.20;
        else if (params.artifactType === 'SCREENSHOT')
            score += 0.10;
    }
    return Math.min(score, 1.00);
}
/**
 * Calculates cross-verification boost.
 * Reward signals corroborated across diversity of source types.
 */
export function calculateCrossVerificationBoost(sources) {
    const uniqueSources = new Set(sources);
    const diversity = uniqueSources.size;
    if (diversity <= 1)
        return 1.00;
    // 5% per unique source
    const boost = 1.00 + (diversity * 0.05);
    return Math.min(boost, 1.30);
}
/**
 * Final Weight Calculation
 */
export function calculateFinalWeight(signal) {
    const base_weight = BASE_WEIGHTS[signal.type] || 0.50;
    const temporal_decay = calculateTemporalDecay(signal.type, signal.timestamp);
    const source_authority = SOURCE_AUTHORITY_SCORES[signal.source] || 0.70;
    const verification_strength = calculateVerificationStrength(signal.verificationParams);
    const cross_verification_boost = calculateCrossVerificationBoost(signal.corroboratingSources);
    const final_weight = Math.min(1.0, base_weight * temporal_decay * source_authority * verification_strength * cross_verification_boost);
    return {
        base_weight,
        temporal_decay,
        source_authority,
        verification_strength,
        cross_verification_boost,
        final_weight
    };
}
/**
 * Skill Level Helper
 */
export function getSkillLevel(score) {
    if (score >= 0.86)
        return 'EXPERT';
    if (score >= 0.71)
        return 'ADVANCED';
    if (score >= 0.51)
        return 'INTERMEDIATE';
    if (score >= 0.31)
        return 'BEGINNER';
    return 'NOVICE';
}
