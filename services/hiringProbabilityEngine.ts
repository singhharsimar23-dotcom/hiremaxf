// \services\hiringProbabilityEngine.ts
/**
 * Hiring Probability Engine (Deterministic Layer)
 * Implements strict calculation logic for job application success probability.
 * All math is clamped and stable to ensure user trust.
 */

export interface ProbabilityInput {
    matchScore: number;
    competitionScore: number;
    skillGapCount: number;
    yearsExperienceDelta: number;
    hiringUrgencyScore: number;
}

export interface ProbabilityOutput {
    baseProbability: number;
    optimizedProbability: number;
    confidenceScore: number;
    opportunityScore: number;
    effectiveSalaryHighNormalized: number;
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

export function calculateHiringProbability(input: ProbabilityInput, effectiveSalaryHigh: number = 0, referral_likelihood_score: number = 0): ProbabilityOutput {
    const {
        matchScore,
        competitionScore,
        skillGapCount,
        yearsExperienceDelta,
        hiringUrgencyScore
    } = input;

    // 1. Base Score calculation
    let base = matchScore * 0.4;

    // 2. Adjustments
    base -= (competitionScore * 0.15);
    base += (hiringUrgencyScore * 0.1);
    base -= (skillGapCount * 5);
    base -= (Math.abs(yearsExperienceDelta) * 3);

    // 3. Clamping
    const baseProbability = clamp(base, 1, 85);
    const optimizedProbability = clamp(baseProbability + 12, 1, 95);
    const confidenceScore = clamp(100 - (skillGapCount * 7), 40, 95);

    // 4. Opportunity Score calculation
    // effectiveSalaryHigh Normalized for the formula (assume 0-100 scale, map typical 100k-300k range safely)
    let salaryNormalized = 0;
    if (effectiveSalaryHigh > 0) {
        // e.g. 150k -> 15, 300k -> 30 roughly. Simple stable normalization:
        salaryNormalized = clamp((effectiveSalaryHigh / 10000), 0, 40);
    }

    const opportunityScore = clamp(
        (100 - competitionScore)
        + hiringUrgencyScore
        + salaryNormalized
        + referral_likelihood_score,
        1,
        100
    );

    return {
        baseProbability: Math.round(baseProbability),
        optimizedProbability: Math.round(optimizedProbability),
        confidenceScore: Math.round(confidenceScore),
        opportunityScore: Math.round(opportunityScore),
        effectiveSalaryHighNormalized: salaryNormalized
    };
}
