export class MatchScorer {
    /**
     * Calculate a multi-dimensional match score.
     */
    static calculateScore(input) {
        // 1. Skill Overlap (40%)
        const skillSet = new Set(input.user_skills.map(s => s.toLowerCase()));
        const requirementSet = new Set(input.job_requirements.map(r => r.toLowerCase()));
        const intersection = [...requirementSet].filter(x => skillSet.has(x));
        const skillScore = requirementSet.size ? (intersection.length / requirementSet.size) : 0;
        // 2. Alignment Score (40%)
        const alignmentScore = (input.role_alignment + input.seniority_alignment) / 2;
        // 3. Location Multiplier (20%)
        const locationScore = input.location_match ? 1.0 : 0.0;
        const total = (skillScore * 0.4) + (alignmentScore * 0.4) + (locationScore * 0.2);
        // HEURISTIC GATES: Rejection Criteria
        if (!input.location_match)
            return Math.min(total, 0.4); // Hard cap on remote/onsite mismatch
        if (skillScore < 0.3)
            return total * 0.5; // Penalty for low skill overlap
        return total;
    }
    /**
     * Determine if a match is "Actionable" based on threshold.
     */
    static isActionable(score, threshold = 0.75) {
        return score >= threshold;
    }
}
