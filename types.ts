
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

export type Verdict = 'Pass' | 'Weak' | 'Failing';
export type SignalAcquisitionType = 'project' | 'internship' | 'academic' | 'production' | 'unknown';
export type ProbabilityBand = 'Low' | 'Medium' | 'High';
export type DensityLevel = 'Low' | 'Medium' | 'High';
export type SkillStatus = 'Stable' | 'Declining';
export type LongevityStatus = 'Short-lived' | 'Moderate' | 'Durable';

export interface RecruiterScanObservation {
  observation: string;
  category: 'visible' | 'skipped' | 'concern';
  element: string;
}

export interface RejectionReason {
  reason: 'Overqualified' | 'Underqualified' | 'Misaligned role' | 'Weak signals' | 'Market saturation';
  probability: ProbabilityBand;
  explanation: string;
}

export interface SkillRadarItem {
  skill: string;
  status: SkillStatus;
  marketNote: string;
}

export interface AnalysisPoint {
  id: string;
  title: string;
  verdict: Verdict;
  impact: string;
  issues: string[];
  remediation: string[];
  type: 'skill_acquisition' | 'resume_update' | 'strategic_pivot';
  acquisitionClassification: SignalAcquisitionType;
  examples: {
    bad: string;
    good: string;
  };
}

export interface MarketInsight {
  trend: string;
  implication: string;
}

export interface DiagnosticResult {
  role: string;
  overallScore: number;
  points: AnalysisPoint[];
  marketInsights: MarketInsight[];
  rebuildRoadmap: string[];
  recruiterScan: RecruiterScanObservation[];
  rejectionReasons: RejectionReason[];
  noiseDetection: {
    noiseDensity: DensityLevel;
    signalToNoiseRatio: DensityLevel;
    observations: string[];
  };
  roleSaturation: DensityLevel;
  skillRadar: SkillRadarItem[];
  longevityEstimate: {
    status: LongevityStatus;
    reasoning: string;
  };
}

export interface ImprovementDetail {
  change: string;
  reasoning: string;
}

export interface ComparisonData {
  oldResume: string;
  newResume: string;
  improvements: ImprovementDetail[];
  scoreLift: number;
}

// Resume Builder Types
export interface ExperienceItem {
  id: string;
  company: string;
  position: string;
  location: string;
  startDate: string;
  endDate: string;
  bullets: string[];
}

export interface EducationItem {
  id: string;
  school: string;
  degree: string;
  graduationDate: string;
}

export interface ResumeData {
  contact: {
    fullName: string;
    email: string;
    phone: string;
    location: string;
    linkedIn: string;
  };
  experience: ExperienceItem[];
  education: EducationItem[];
  skills: string[];
  summary: string;
}

// Template Types
export type TemplateCategory = 'Technology' | 'Business & Operations' | 'Design & Creative' | 'Finance' | 'Research & Academia' | 'Early Career';

export interface ResumeTemplate {
  id: string;
  role: string;
  category: TemplateCategory;
  experienceLevel: 'Entry' | 'Mid' | 'Senior';
  usedWhen: string;
  screeningLogic: string;
  riskNotes?: string;
  sections: string[];
}

export type AppView = 
  | 'dashboard' 
  | 'ai-review' 
  | 'resume-builder' 
  | 'signal-hub' 
  | 'templates' 
  | 'recruiter-scan' 
  | 'rejection-model' 
  | 'role-saturation' 
  | 'skill-radar' 
  | 'longevity-estimate';
