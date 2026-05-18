
export type UserPlan = 'Starter' | 'Market Verdict' | 'Career Pro' | 'Career Elite' | 'Automation';

export type IngestionMode = 'oauth' | 'public_profile' | 'manual_artifact';

export type AppView =
  | 'landing' | 'auth' | 'dashboard' | 'ai-review' | 'full-review'
  | 'rebuild' | 'rebuild-standalone' | 'career-intelligence' | 'profile'
  | 'applications' | 'pricing' | 'auth-bridge'
  | 'settings' | 'billing' | 'faq' | 'contact' | 'history' | 'resume-editor'
  | 'signal-hub' | 'recruiter-scan' | 'rejection-model' | 'role-saturation'
  | 'skill-radar' | 'longevity-estimate' | 'admin-ops' | 'preview' | 'admin'
  | 'market-outlook' | 'interview-prep' | 'cover-letter' | 'tracker' | 'linkedin-optimizer'
  | 'terms' | 'privacy' | 'refund';

export enum IdentityState {
  UNINITIALIZED = 'UNINITIALIZED',
  CALIBRATING = 'CALIBRATING',
  STABLE = 'STABLE',
  ERROR = 'ERROR'
}

export type RoleTrack = 'AI_PRODUCTION' | 'STARTUP_ENG' | 'BIG_TECH' | 'RESEARCH_ACADEMIC' | 'FINTECH_INFRA';

export type PrimaryDomain = 'SWE' | 'DATA_ML' | 'DEVOPS_SRE' | 'PRODUCT_MGMT' | 'DESIGN' | 'SECURITY' | 'UNSELECTED';

export type RunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'aborted';
export type TargetStatus = 'queued' | 'submitted' | 'failed';

export interface DbExecutionRun {
  id: string;
  user_id: string;
  resume_id: string;
  target_role: string;
  status: RunStatus;
  error_reason?: string;
  created_at: string;
  completed_at?: string;
}

export interface DbExecutionTarget {
  id: string;
  run_id: string;
  job_title: string;
  company: string;
  apply_url: string;
  status: TargetStatus;
  logs: string[];
}

export interface DbExecutionLog {
  id: string;
  run_id: string;
  message: string;
  level: 'info' | 'success' | 'error';
  created_at: string;
}

export type JobType = 'ANALYSIS' | 'REBUILD' | 'OUTLOOK' | 'INGESTION' | 'EXECUTION' | 'PREP' | 'COVER_LETTER' | 'LINKEDIN';
export type JobStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'PAUSED' | 'THROTTLED';

// Added BackgroundJob interface to fix missing import errors in App.tsx and other views
export interface BackgroundJob {
  id: string;
  type: JobType;
  status: JobStatus;
  payload: any;
  result?: any;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityLogEntry {
  id: string;
  platform: string;
  mode: IngestionMode;
  action: 'CONNECTED' | 'SYNCED' | 'DISCONNECTED';
  timestamp: string;
}

export interface CareerSignal {
  id: string;
  type: string;
  source: string;
  score: number;
  confidence: number;
  decayRate: number;
  lastUpdated: string;
  metadata: any;
}

// Added LinkedIdentity interface to fix missing import in TransformationFactory.tsx
export interface LinkedIdentity {
  verified: boolean;
  mode: IngestionMode;
  data: any;
  lastSynced?: string;
}

export interface ResumeProfile {
  id: string;
  label: string;
  targetRole: string;
  isPrimary: boolean;
  data: StructuredResume;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  plan: UserPlan;
  credits: number;
  domain: PrimaryDomain;
  resume_profiles: ResumeProfile[];
  connected_providers: string[];
  metadata?: {
    identities?: Record<string, LinkedIdentity>;
    daily_application_limit?: number;
    applications_sent_today?: number;
  };
}

export interface StructuredResume {
  contact: { full_name: string; email: string; phone: string; location: string; links: string[]; };
  summary: string;
  experience: { title: string; organization: string; dates: string; bullets: string[]; }[];
  education: { institution: string; degree: string; dates: string; details: string; }[];
  projects: { name: string; description: string; impact: string; }[];
  skills: { languages: string[]; frameworks: string[]; tools: string[]; specializations: string[]; };
  leadership: { role: string; description: string; }[];
}

export interface EightPointItem {
  id: string;
  name: string;
  score: number;
  explanation: string;
  riskHint: string;
}

// ─── Pipeline Decision Output Types ───────────────────────────────────────────

export interface AtomicChange {
  dimension: string; // matches EightPointItem.name
  before: string;    // exact weak phrase from resume
  after: string;     // improved version
  logic: string;     // recruiter reasoning
}

export interface PersonaForecast {
  sentiment: 'positive' | 'neutral' | 'negative';
  observation: string;
  fix: string;
  delta: string; // e.g. "+18%"
}

export type SignalChipStatus = 'Optimal' | 'Moderate' | 'Soft' | 'Critical';

export interface SignalChip {
  value: string;       // e.g. "67%"
  status: SignalChipStatus;
}

export interface SignalChips {
  seniorityCoherence: SignalChip;
  architecturalScope: SignalChip;
  atsIntegrity: SignalChip;
  ownershipMarkers: SignalChip;
}

export type ApplicationWindowState = 'GREEN' | 'YELLOW' | 'RED';

export interface ApplicationWindow {
  state: ApplicationWindowState;
  estimatedHoursToReadiness: number | null;
  blockers: string[];
  accelerators: string[];
}

export interface DecisionOutput {
  matchScore: number;
  interviewProbability: number;
  strengths: string[];
  weaknesses: string[];
  missingSkills: string[];
  recommendedResumeChanges: string[];
  applicationPriority: 'APPLY_NOW' | 'IMPROVE_FIRST' | 'DO_NOT_APPLY';
  applicantCompetitiveness: 'TOP_10_PERCENT' | 'ABOVE_AVERAGE' | 'AVERAGE' | 'BELOW_AVERAGE';
  optimalApplyTiming: string;
}

export interface JobContext {
  matched_jobs: number;
  top_posting_age_days: number | null;
  estimated_applicant_volume: 'Low' | 'Medium' | 'High' | 'Unknown';
}

// ─────────────────────────────────────────────────────────────────────────────

export interface DiagnosticResult {
  analysisId: string;
  role: string;
  roleTrack?: RoleTrack;
  resumeText: string;
  overallScore: number;
  marketReadinessLabel?: 'Low' | 'Medium' | 'High';
  foundation?: { atsShield: string; readability: string; marketReadiness: 'Low' | 'Medium' | 'High'; strengthsSnapshot: string[]; };
  eightPoints: EightPointItem[];
  recruiterScan?: any[];
  rejectionReasons?: any[];
  roleSaturation?: string;
  skillRadar?: any[];
  longevityEstimate?: any;
  // ── Pipeline Decision Output (populated by new generate-diagnostic) ──
  atomicChanges?: AtomicChange[];
  personaForecasts?: Record<'FAANG' | 'STARTUP' | 'AI_TEAM', PersonaForecast>;
  signalChips?: SignalChips;
  applicationWindow?: ApplicationWindow;
  decisionOutput?: DecisionOutput;
  jobContext?: JobContext;
}

export interface ResumeGroup { id: string; name: string; versions: ResumeVersion[]; }
export interface ResumeVersion {
  versionId: string;
  type: 'original' | 'optimized';
  linkedAnalysisId?: string;
  createdAt: string;
  updatedAt: string;
  templateId: string;
  data: any;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  error_reason?: string;
}

export interface ActionCardData {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  chartData: { value: number }[];
}

export interface MarketCommandSnapshot {
  id: string;
  timestamp: string;
  expiry: string;
  context: {
    role: string;
    geography: string;
    expBand: string;
  };
  marketStatus: { label: string; implication: string };
  executionTargets: { company: string; roleTitle: string; fitReason: string; confidence: number; validityWindow: string }[];
  doNotApplyZone: { entityType: string; reasoning: string }[];
  actionOrders: {
    next7Days: string[];
    next30Days: string[];
    positioningDirectives: string[];
    interviewDirectives: string[];
  };
  risks: { uncertainty: string; refreshCondition: string };
}

export interface ComparisonData {
  analysisId: string | null;
  oldResume: string;
  newResume: StructuredResume;
  improvements: { change: string; reasoning: string }[];
  scoreLift: number;
  skillsToAdd: { name: string; reason: string }[];
}

// Added GoalItem interface to fix import error in constants.tsx
export interface GoalItem {
  id: string;
  label: string;
  completed: boolean;
}

// Added Template and Resume Building types
export type TemplateField = 'Software / Tech' | 'Data / Analytics' | 'Business / Management' | 'Student / Fresher' | 'General Professional';

export interface ResumeTemplate {
  id: string;
  name: string;
  targetRole: string;
  seniority: string;
  field: TemplateField;
  usedWhen: string;
  sectionOrder: string[];
  recruiterScan: {
    noticeFirst: string[];
    skim: string[];
    ignore: string[];
  };
  riskNotes: string;
  variant: 'Primary' | 'Stretch';
}

export type SectionType = 'objective' | 'experience' | 'leadership' | 'projects' | 'research' | 'certifications' | 'awards' | 'publications' | 'skills' | 'education';

export interface ResumeItem {
  id: string;
  title: string;
  subtitle?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
}

export interface ResumeSection {
  id: string;
  type: SectionType;
  title: string;
  items: ResumeItem[];
}

export interface ResumeData {
  contact: {
    fullName: string;
    email: string;
    phone: string;
    location: string;
    linkedIn: string;
  };
  summary: string;
  sections: ResumeSection[];
}

// --- EXECUTION ENGINE TYPES ---

export type ExecutionState = 'TRACKED' | 'IDENTIFIED' | 'KILL_ZONE' | 'NOT_READY' | 'NOT_MATCH' | 'SUBMITTED' | 'UNDER_REVIEW' | 'INTERVIEW' | 'REJECTED';

export interface KillZoneAnalysis {
  inKillZone: boolean;
  percentile: number;
  estimatedCallbackRate: number;
  confidence: number;
  matchBreakdown: {
    skillsMatch: number | string;
    experienceMatch: boolean;
    companyTierMatch: boolean;
    githubScore: number;
    minorGaps: { label: string; severity?: string; impact?: number }[] | string[];
  };
  competitionAnalysis: {
    estimatedApplicants: number;
    yourRank: string;
    competitiveAdvantage: string[];
  };
}

export interface ImprovementStep {
  stepNumber: number;
  action: string;
  description: string;
  effort: number;
  impact: number;
  resources?: string[];
  verification?: string;
  status: 'not_started' | 'in_progress' | 'completed';
  phase?: string;
}

export interface ImprovementPlan {
  totalEffort: number;
  estimatedTimeline: string;
  expectedCallbackRateAfter?: number;
  target_percentile?: number;
  roadmap?: {
    phase: number;
    title: string;
    duration: string;
    effort: number;
    steps: ImprovementStep[];
  }[];
  steps?: ImprovementStep[]; // Flattened alternative
}

export interface ApplicationTracking {
  timeline: {
    id: string;
    timestamp: string;
    label: string;
    description: string;
    type: 'system' | 'outcome';
    verified: boolean;
  }[];
  predictions: {
    expectedOutcomeDate: string;
    mostLikelyOutcome: string;
    outcomeConfidence: number;
  };
}

export interface JobOpportunity {
  id: string;
  title: string;
  company: string;
  location: string;
  type: string;
  salary: string;
  salary_min?: number;
  salary_max?: number;
  salary_low?: number | null;
  salary_high?: number | null;
  posted_at: string;
  description_snippet: string;
  job_description?: string;
  match_confidence: number;
  company_state: string;
  discovery_method: string;
  confidence_tier: string;
  freshness_window: string;
  source_ats: string;
  source_url?: string;
  state?: ExecutionState;
  analysis?: KillZoneAnalysis;
  tracking?: ApplicationTracking;
  competition_score?: number | null;
  hiring_urgency_score?: number | null;
  enrichment_status?: 'pending' | 'complete';
  effectiveSalaryLow?: number | null;
  effectiveSalaryHigh?: number | null;
}

export enum DiscoveryState {
  NO_SESSION = 0,
  ACTIVE_SESSION = 1,
  LOADING = 2,
  ERROR = 3
}

export interface DiscoverySessionV2 {
  id: string;
  user_id: string;
  resume_id: string;
  target_role: string;
  seniority_level: string;
  geo_filter: string;
  filters: any;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Interview Prep Types ──────────────────────────────────────────────────────
export interface InterviewPrepKit {
  recruiterScreen?: Array<{
    question: string;
    whyAsked: string;
    framework: string[];
    avoid: string[];
  }>;
  phoneScreen?: Array<{ question: string; whyAsked: string; framework: string; avoid: string; }>;
  salaryAnchor?: {
    range?: string;
    script?: string;
    response?: string;
    reasoning?: string;
  };
  hmScreen?: Array<{
    question: string;
    followUp?: string;
    resumeAnchor: string;
    framework: string[];
  }>;
  hiringManager?: Array<{ question: string; followUp: string; resumeAnchor: string; framework: string; }>;
  technical?: {
    detectedType: 'Leetcode' | 'System Design' | 'Take-home' | 'Case Study' | 'CODING' | 'SYSTEM_DESIGN' | 'TAKE_HOME';
    questions: Array<{
      question: string;
      likelihood: number;
      hints?: string;
      keyPoints?: string[];
      tradeoffs?: string[];
    }>;
    patterns?: string[];
  };
  behavioral?: Array<{
    question: string;
    situation: string;
    task: string;
    preFilled?: { situation: string; task: string };
    userAction?: string;
    userResult?: string;
  }>;
  questionsToAsk?: Array<{ question: string; category: string; mustAsk: boolean; whyItWorks?: string; }>;
}

// ─── Cover Letter Types ────────────────────────────────────────────────────────
export interface CoverLetterResult {
  letterText: string;
  wordCount: number;
  paragraphs: { hook: string; evidence: string; companySignal: string; close: string; };
  analysis: {
    painPoint: string;
    matchingExperience: string;
    companySignalUsed: string;
    toneCalibration: string;
  };
}
