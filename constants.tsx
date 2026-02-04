
import { ActionCardData, GoalItem, ResumeTemplate } from './types';

export const QUICK_ACTIONS: ActionCardData[] = [
  {
    id: 'new',
    title: 'New Resume',
    description: 'Start from scratch with a professional framework.',
    icon: 'FilePlus',
    color: '#10B981',
    chartData: Array.from({ length: 15 }, (_, i) => ({ value: 10 + Math.sin(i * 0.8) * 3 }))
  },
  {
    id: 'review',
    title: 'AI Review',
    description: 'Upload and analyze your profile for market gaps.',
    icon: 'Search',
    color: '#3B82F6',
    chartData: Array.from({ length: 15 }, (_, i) => ({ value: 8 + Math.random() * 5 }))
  }
];

export const WEEKLY_GOALS: GoalItem[] = [
  { id: '1', label: 'Build a resume', completed: true },
  { id: '2', label: 'Add 3+ skills', completed: false },
  { id: '3', label: 'Complete experience section', completed: false },
  { id: '4', label: 'Get AI review', completed: false }
];

// Added RESUME_TEMPLATES constant to fix import error in components/Templates.tsx
export const RESUME_TEMPLATES: ResumeTemplate[] = [
  {
    id: 't1',
    name: 'FAANG Algorithmic Standard',
    targetRole: 'Software Engineer',
    seniority: 'Senior',
    field: 'Software / Tech',
    usedWhen: 'Targeting high-scale engineering roles with heavy technical vetting.',
    sectionOrder: ['Summary', 'Skills', 'Experience', 'Education'],
    recruiterScan: {
      noticeFirst: ['Architectural Ownership', 'System Scale', 'Technical Breadth'],
      skim: ['Summary Paragraph', 'Certifications'],
      ignore: ['Soft Skills List', 'References']
    },
    riskNotes: 'High scrutiny on quantitative impact metrics.',
    variant: 'Primary'
  },
  {
    id: 't2',
    name: 'Product Velocity Framework',
    targetRole: 'Fullstack Engineer',
    seniority: 'Mid-Senior',
    field: 'Software / Tech',
    usedWhen: 'Targeting growth-stage startups where speed and product impact matter most.',
    sectionOrder: ['Summary', 'Experience', 'Projects', 'Skills'],
    recruiterScan: {
      noticeFirst: ['0-1 Product Delivery', 'Feature Ownership', 'Velocity Markers'],
      skim: ['Education Details'],
      ignore: ['High-school accomplishments']
    },
    riskNotes: 'Requires strong project evidence to verify claims.',
    variant: 'Stretch'
  },
  {
    id: 't3',
    name: 'Data Integrity Layout',
    targetRole: 'Data Scientist',
    seniority: 'Senior',
    field: 'Data / Analytics',
    usedWhen: 'Targeting roles focused on modeling and complex statistical analysis.',
    sectionOrder: ['Summary', 'Skills', 'Experience', 'Education', 'Publications'],
    recruiterScan: {
      noticeFirst: ['Model Accuracy Metrics', 'Tool Proficiency', 'Research Novelty'],
      skim: ['General Experience'],
      ignore: ['Irrelevant tools']
    },
    riskNotes: 'Ensure publications are linked and verified.',
    variant: 'Primary'
  },
  {
    id: 't4',
    name: 'Executive Business Lead',
    targetRole: 'Product Manager',
    seniority: 'Staff / Director',
    field: 'Business / Management',
    usedWhen: 'Targeting strategic leadership roles with P&L responsibility.',
    sectionOrder: ['Summary', 'Experience', 'Education', 'Skills'],
    recruiterScan: {
      noticeFirst: ['Outcome Quantification', 'Cross-functional Influence', 'Strategy Execution'],
      skim: ['Technical Skills List'],
      ignore: ['Tactical details']
    },
    riskNotes: 'Focus on "Directed" vs "Supported" signals.',
    variant: 'Primary'
  }
];
