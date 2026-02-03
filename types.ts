
export type UserPlan = 'Starter' | 'Market Verdict' | 'Career Pro' | 'Career Elite' | 'Automation';

export type AppView = 
  | 'landing' | 'auth' | 'dashboard' | 'ai-review' | 'full-review' 
  | 'rebuild' | 'rebuild-standalone' | 'career-intelligence' 
  | 'transformation-factory' | 'applications' | 'templates' | 'pricing' 
  | 'settings' | 'billing' | 'faq' | 'contact' | 'history' | 'resume-editor'
  | 'signal-hub' | 'recruiter-scan' | 'rejection-model' | 'role-saturation'
  | 'skill-radar' | 'longevity-estimate' | 'admin-ops';

export type RoleTrack = 'AI_PRODUCTION' | 'STARTUP_ENG' | 'BIG_TECH' | 'RESEARCH_ACADEMIC' | 'FINTECH_INFRA';

export type PrimaryDomain = 'SWE' | 'DATA_ML' | 'DEVOPS_SRE' | 'PRODUCT_MGMT' | 'UNSELECTED';

export type JobType = 'ANALYSIS' | 'REBUILD' | 'OUTLOOK' | 'INGESTION' | 'EXECUTION';
export type JobStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'PAUSED' | 'THROTTLED';

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

export interface AgentLog {
  id: string;
  agent: 'Discovery' | 'Fetch' | 'Parser' | 'Dedupe' | 'Ranker' | 'Matcher' | 'Apply' | 'Guard';
  message: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
}

export interface ScoringBreakdown {
  recency: number;      // 0-30
  fit: number;          // 0-30
  intent: number;       // 0-20
  competition: number;  // 0-10
  reliability: number;  // 0-10
  total: number;        // 0-100
}

export interface NormalizedJob {
  id: string;
  title: string;
  company: string;
  location: string;
  requirements: string[];
  applyUrl: string;
  postedTime: string;
  source: string;
  sourceType: 'ATS' | 'Aggregator' | 'Social';
  scoring?: ScoringBreakdown;
  match?: {
    resumeId: string;
    score: number;
    customizationInstructions: string[];
    gapAnalysis: string[];
  };
}

export interface ExecutionRun {
  id: string;
  parameters: {
    role: string;
    geography: string;
    companies: string[];
    sources: string[];
    applyMode: 'Manual' | 'Assisted' | 'Auto';
    riskTolerance: 'Low' | 'Medium' | 'High';
  };
  stats: {
    discovered: number;
    ranked: number;
    applied: number;
    throttled: number;
  };
  logs: AgentLog[];
  status: JobStatus;
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
  plan: UserPlan;
  credits: number;
  domain: PrimaryDomain;
  resume_profiles: ResumeProfile[]; // Max 5
  connected_providers: string[];
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

export interface DiagnosticResult {
  analysisId: string;
  role: string;
  roleTrack?: RoleTrack;
  resumeText: string;
  overallScore: number;
  foundation: { atsShield: string; readability: string; marketReadiness: 'Low' | 'Medium' | 'High'; strengthsSnapshot: string[]; };
  eightPoints: EightPointItem[];
  recruiterScan: any[];
  rejectionReasons: any[];
  roleSaturation: string;
  skillRadar: any[];
  longevityEstimate: any;
}

export interface ResumeGroup { id: string; name: string; versions: ResumeVersion[]; }
export interface ResumeVersion { versionId: string; type: 'original' | 'optimized'; linkedAnalysisId?: string; createdAt: string; updatedAt: string; templateId: string; data: any; }

export interface ActionCardData {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  chartData: { value: number }[];
}

export interface GoalItem {
  id: string;
  label: string;
  completed: boolean;
}

export interface ResumeTemplate {
  id: string;
  name: string;
  targetRole: string;
  seniority: string;
  field: string;
  usedWhen: string;
  sectionOrder: string[];
  recruiterScan: {
    noticeFirst: string[];
    skim: string[];
    ignore: string[];
  };
  riskNotes: string;
  variant: 'Primary' | 'Stretch' | 'Safe';
}

export type TemplateField = 'Software / Tech' | 'Data / Analytics' | 'Business / Management' | 'Student / Fresher' | 'General Professional';

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

export type UserLifecycleState = 'AWAITING_INGEST' | 'SIGNALS_READY' | 'ACTIVE_DEPLOYMENT';

export interface LinkedIdentity {
  provider: 'github' | 'linkedin';
  scopeLevel: string;
  verified: boolean;
  lastSync: string;
}
