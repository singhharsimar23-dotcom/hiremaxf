/**
 * Safety utilities for production-grade metric calculations.
 * Ensures no NaN, undefined, or temporary flicker states.
 */

/**
 * Returns a guaranteed number, falling back to a default value if the input is invalid.
 */
export function safeNumber(value: any, fallback = 0): number {
    if (typeof value === 'number' && !isNaN(value) && isFinite(value)) {
        return value;
    }

    if (typeof value === 'string') {
        const parsed = parseFloat(value);
        return !isNaN(parsed) && isFinite(parsed) ? parsed : fallback;
    }

    return fallback;
}

/**
 * Returns a formatted percentage string or raw number with safety guards.
 */
export function safePercentage(value: any, decimals = 0, fallback = 0): string {
    const num = safeNumber(value, fallback);
    return `${(num * 100).toFixed(decimals)}%`;
}

/**
 * Returns a formatted decimal string with safety guards.
 */
export function safeDecimal(value: any, decimals = 3, fallback = 0): string {
    const num = safeNumber(value, fallback);
    return num.toFixed(decimals);
}

/**
 * Validates if the identity data is sufficient for 'STABLE' status.
 */
export function isIdentityStable(mlTalentState: any, snapshot: any): boolean {
    if (!mlTalentState || !snapshot) return false;

    // Requirement: Capability index must be non-zero and snapshot must be verified
    const hasCapability = safeNumber(mlTalentState.capability_index) > 0;
    const isVerified = snapshot.verification_state === 'VERIFIED';

    return hasCapability && isVerified;
}

/**
 * Returns a simple deterministic hash from a string.
 */
export function deterministicScore(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36).substring(0, 8);
}

/**
 * Generates a UUID v4 string.
 * Uses crypto.randomUUID if available, otherwise fallbacks to a high-entropy math-based generator.
 */
export function generateUUID(): string {
    try {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return crypto.randomUUID();
        }
    } catch (e) {
        // Silently fallback on any error
    }

    // Fallback for browsers or environments without crypto.randomUUID
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}
