// Shared module: ATS Patterns
// URL patterns for major Applicant Tracking Systems
/**
 * ATS URL patterns
 * {slug} will be replaced with company slug
 */
export const ATS_PATTERNS = {
    greenhouse: 'https://boards.greenhouse.io/{slug}',
    lever: 'https://jobs.lever.co/{slug}',
    ashby: 'https://jobs.ashbyhq.com/{slug}',
    workable: 'https://apply.workable.com/{slug}',
    bamboohr: 'https://{slug}.bamboohr.com/jobs',
    smartrecruiters: 'https://jobs.smartrecruiters.com/{slug}',
    breezyhr: 'https://{slug}.breezy.hr'
};
/**
 * ATS job list selectors for HTML parsing
 */
export const ATS_SELECTORS = {
    greenhouse: {
        jobContainer: '.opening',
        titleSelector: 'a',
        linkSelector: 'a',
        locationSelector: '.location'
    },
    lever: {
        jobContainer: '.posting',
        titleSelector: '.posting-title h5',
        linkSelector: '.posting-title a',
        locationSelector: '.location'
    },
    ashby: {
        jobContainer: '[data-testid="jobs-list-item"]',
        titleSelector: 'a',
        linkSelector: 'a',
        locationSelector: '.ashby-job-posting-location'
    },
    workable: {
        jobContainer: '.job-card',
        titleSelector: '.job-card-title',
        linkSelector: 'a',
        locationSelector: '.job-card-location'
    }
};
/**
 * Generate ATS URL for a company
 */
export function generateATSUrl(atsType, slug) {
    const pattern = ATS_PATTERNS[atsType.toLowerCase()];
    if (!pattern)
        return null;
    return pattern.replace('{slug}', slug);
}
/**
 * Derive slug from company domain
 */
export function deriveSlugFromDomain(domain) {
    // Remove TLD and www
    return domain
        .replace(/^www\./, '')
        .split('.')[0]
        .toLowerCase();
}
