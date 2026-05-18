// ── MarketTypes.ts ──────────────────────────────────────────────────────────
// All shared types for the Market Intelligence UI

export interface MarketSignal {
  id: string;
  role_category: string;
  geo_filter: string;
  job_count_30d: number;
  job_count_prev_30d: number;
  hiring_velocity: number;
  scarcity_index: number;
  demand_index: number;
  emerging_skills: SkillRecord[];
  stable_skills: SkillRecord[];
  declining_skills: SkillRecord[];
  timing_signal: number;
  repost_factor: number;
  lifecycle_stage?: string;
  macro_adjustment?: number;
  causal_forecast?: number;
  salary_p50?: number;
  bayesian_callback_rate?: number;
  updated_at?: string;
}

export interface SkillRecord {
  skill_name: string;
  velocity: number;
  mentions: number;
  lifecycle_stage?: string;
}

export interface GeoOpportunity {
  id: string;
  role: string;
  city: string;
  state_code: string;
  job_count: number;
  competition_ratio: number;
  col_adjusted_salary: number;
  salary_median: number;
  opportunity_score: number;
  pareto_rank?: number;
}

export interface HiringCycle {
  id: string;
  company_name: string;
  peak_months: number[];
  trough_months: number[];
  annual_pattern: number[];
  cycle_strength: number;
}

export interface BayesianPrior {
  parameter_name: string;
  context_key: string;
  alpha: number;
  beta: number;
  observations_count: number;
}

export interface FundingEvent {
  id: string;
  company_name: string;
  amount_usd: number;
  round_type: string;
  date: string;
  sector?: string;
  source_url?: string;
}

export interface SkillPrediction {
  skill: string;
  lifecycle_stage: string;
  growth_rate_annual: number;
  peak_adoption_year?: number;
  confidence: number;
}

export interface MacroSignal {
  indicator: string;
  value: number;
  date: string;
  unit?: string;
}

export interface SystemHealth {
  status: string;
  pipeline: { buffer_pending: number; total_jobs: number; active_verified_jobs: number };
  intelligence: { layers_active: number; layers_total: number; coverage_pct: number };
  wiring?: {
    required_secrets: string[];
    missing_secrets: string[];
    integrity_status: string;
  };
  _meta: { duration_ms: number };
}

export interface MomentumSignal {
  company: string;
  hma_score: number;
  confidence_score: number;
  velocity_7d?: number;
  lifecycle_state?: string;
  role_category?: string;
}

export interface SkillForensics extends SkillPrediction {
  mentions_30d: number;
  market_share: number;
  competition_index: number;
  top_companies: string[];
  historical_data: Array<{ date: string; value: number }>;
}

export interface SkillEvolutionSignal {
  skill_name: string;
  role_key: string;
  skill_growth_rate: number;
  skill_momentum: number;
  skill_lifecycle_stage: string;
  skill_substitution_probability: number;
  last_updated_at: string;
}

export interface SourceReliability {
  domain: string;
  reliability_score: number;
  block_rate: number;
  avg_latency_ms: number;
  integrity_score: number;
  conversion_rate: number;
  updated_at: string;
}

export type IntelMode = 'pulse' | 'forensics' | 'predictions';
