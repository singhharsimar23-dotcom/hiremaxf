
export type UserPlan = 'Starter' | 'Market Verdict' | 'Career Pro' | 'Career Elite';

export type AppView = 
  | 'landing'
  | 'auth'
  | 'dashboard' 
  | 'ai-review' 
  | 'full-review' 
  | 'rebuild'
  | 'rebuild-standalone'
  | 'career-intelligence' 
  | 'templates' 
  | 'pricing'
  | 'settings'
  | 'billing'
  | 'faq'
  | 'contact'
  | 'history'
  | 'resume-editor'
  | 'signal-hub'
  | 'recruiter-scan'
  | 'rejection-model'
  | 'role-saturation'
  | 'skill-radar'
  | 'longevity-estimate';

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

export interface EightPointItem {
  id: string;
  name: string;
  score: number;
  explanation?: string;
  evidence?: string[];
  implications?: string;
  status?: 'Safe' | 'Degraded' | 'Auto-reject risk';
}

export interface SkillSuggestion {
  name: string;
  reason: string;
}

export interface StructuredResume {
  contact: {
    full_name: string;
    email: string;
    phone: string;
    location: string;
    links: string[];
  };
  summary: string;
  education: {
    institution: string;
    degree: string;
    dates: string;
    details: string;
  }[];
  experience: {
    title: string;
    organization: string;
    dates: string;
    bullets: string[];
  }[];
  projects: {
    name: string;
    description: string;
    impact: string;
  }[];
  skills: {
    languages: string[];
    frameworks: string[];
    tools: string[];
    specializations: string[];
  };
  leadership: {
    role: string;
    description: string;
  }[];
}

export interface ResumeVersion {
  versionId: string;
  type: 'original' | 'optimized';
  linkedAnalysisId?: string;
  createdAt: string;
  updatedAt: string;
  templateId: string;
  data: StructuredResume;
}

export interface ResumeGroup {
  id: string;
  name: string;
  versions: ResumeVersion[];
}

export interface ComparisonData {
  analysisId: string;
  oldResume: string;
  newResume: StructuredResume;
  improvements: { change: string; reasoning: string }[];
  scoreLift: number;
  skillsToAdd: SkillSuggestion[];
}

export interface DiagnosticResult {
  analysisId: string;
  resumeVersionId?: string; // DB Link
  role: string;
  resumeText: string;
  overallScore: number;
  foundation: {
    atsShield: string;
    readability: string;
    marketReadiness: 'Low' | 'Medium' | 'High';
    strengthsSnapshot: string[];
  };
  eightPoints: EightPointItem[];
  weaknessTeasers?: string[];
  recruiterScan: {
    category: 'visible' | 'skipped' | 'concern';
    element: string;
    observation: string;
  }[];
  rejectionReasons: {
    probability: 'High' | 'Medium' | 'Low';
    reason: string;
    explanation: string;
  }[];
  roleSaturation: string;
  skillRadar: {
    skill: string;
    marketNote: string;
    status: 'Growing' | 'Stable' | 'Declining';
  }[];
  longevityEstimate: {
    status: string;
    reasoning: string;
  };
}

export type SignalDirection = 'Rising' | 'Stable' | 'Softening';

export interface MarketSignal {
  title: string;
  direction: SignalDirection;
  explanation: string;
  whyItMatters: string;
  category: 'Skill' | 'Role' | 'Industry' | 'Risk';
}

export interface OutlookData {
  positioning: {
    band: 'Bottom' | 'Middle' | 'Upper';
    risks: string[];
    adjacentRoles: string[];
  };
  skills: {
    increasingImportance: string[];
    plateauing: string[];
    commoditizationRisk: string[];
  };
  trajectory: {
    pressure: 'Low' | 'Moderate' | 'High';
    explanation: string;
  };
  watchlist: string[];
}

export interface MarketIntelligenceData {
  syncStatus: string;
  lastSync: string;
  feed: MarketSignal[];
  outlook: OutlookData;
}

// Added types for resume templates and builder functionality

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
  variant: 'Primary' | 'Stretch' | 'Safe';
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
