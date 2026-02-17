// Shared module: Fingerprint Generator
// Generates unique fingerprints for job deduplication
/**
 * Generate a SHA-256 fingerprint for a job
 * Used to detect duplicates across sources
 */
export async function generateFingerprint(company, title, location) {
    // Normalize inputs
    const normalizedCompany = company.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    const normalizedTitle = title.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    const normalizedLocation = location.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    // Create fingerprint text
    const text = `${normalizedCompany}|${normalizedTitle}|${normalizedLocation}`;
    // Generate SHA-256 hash
    const msgUint8 = new TextEncoder().encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
/**
 * Generate a simpler fingerprint for quick comparison
 * Uses first 16 chars of full fingerprint
 */
export async function generateShortFingerprint(company, title, location) {
    const full = await generateFingerprint(company, title, location);
    return full.substring(0, 16);
}
