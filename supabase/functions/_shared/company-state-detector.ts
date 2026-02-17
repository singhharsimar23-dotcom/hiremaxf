export enum CompanyState {
    DORMANT = "dormant",
    STABLE = "stable",
    GROWTH = "growth",
    HYPERGROWTH = "hypergrowth",
    ACQUISITION_MODE = "acquisition"
}

export interface CompanySignals {
    layoff_count_90d: number;
    acquisition_rumors: boolean;
    days_since_funding: number;
    funding_amount: number;
    employee_growth_rate_90d: number;
}

export class CompanyStateDetector {
    /**
     * Deterministic state classification with Sector and Stage awareness.
     */
    static detectState(signals: CompanySignals & { sector?: string, stage?: string }): CompanyState {
        // High priority: Negative signals (Absolute blockers)
        if (signals.layoff_count_90d > 0) return CompanyState.DORMANT;
        if (signals.acquisition_rumors) return CompanyState.ACQUISITION_MODE;

        // Sector-specific adjustment (e.g., Biotech needs more funding to be 'HYPERGROWTH')
        const growthThreshold = signals.sector === 'Biotech' ? 50000000 : 20000000;

        // Growth signals
        if (
            signals.days_since_funding < 90 &&
            signals.funding_amount >= growthThreshold &&
            signals.employee_growth_rate_90d > 0.12
        ) {
            return CompanyState.HYPERGROWTH;
        }

        // Stage awareness: Late stage companies (D, E) are GROWTH only if rate is high
        if (['Series D', 'Series E', 'IPO'].includes(signals.stage || '')) {
            if (signals.employee_growth_rate_90d > 0.08) return CompanyState.GROWTH;
            return CompanyState.STABLE;
        }

        if (signals.employee_growth_rate_90d > 0.05) {
            return CompanyState.GROWTH;
        }

        if (signals.employee_growth_rate_90d < -0.05) {
            return CompanyState.DORMANT;
        }

        return CompanyState.STABLE;
    }

    /**
     * Define scraping strategy based on state.
     */
    static getStrategy(state: CompanyState) {
        const strategies = {
            [CompanyState.HYPERGROWTH]: {
                frequency_hours: 6,
                priority: 100,
                confidence_threshold: 0.60
            },
            [CompanyState.GROWTH]: {
                frequency_hours: 24,
                priority: 50,
                confidence_threshold: 0.70
            },
            [CompanyState.STABLE]: {
                frequency_hours: 168, // 7 days
                priority: 10,
                confidence_threshold: 0.75
            },
            [CompanyState.DORMANT]: {
                frequency_hours: 720, // 30 days
                priority: 0,
                confidence_threshold: 0.85
            },
            [CompanyState.ACQUISITION_MODE]: {
                frequency_hours: 0, // Paused
                priority: -1,
                confidence_threshold: 1.0
            }
        };

        return strategies[state];
    }
}
