export type PatternSnapshot = {
  id?: string;
  role: string;
  seniority: string;
  location: string;
  snapshot_week: string;
  avg_salary_min?: number;
  avg_salary_max?: number;
  avg_days_to_fill?: number;
  total_postings: number;
  total_fills: number;
  demand_score: number;
  competition_score: number;
  salary_drift?: number;
  repost_rate: number;
  fast_fill_rate: number;
  expiry_risk_score: number;
};

export type CompanySignal = {
  id?: string;
  company: string;
  signal_type: 'funding' | 'headcount_growth' | 'tech_adoption' | 'exec_hire';
  signal_strength: number;
  source?: string;
  detected_at: string;
  predicted_window_start?: string;
  predicted_window_end?: string;
  confirmed: boolean;
};

export type ArchiveRecord = {
  id?: string;
  jobs_archived: number;
  bytes_freed_estimate: number;
  ran_at: string;
};
