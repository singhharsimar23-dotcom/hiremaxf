
import { ActionCardData, GoalItem, ResumeTemplate } from './types';

export const QUICK_ACTIONS: ActionCardData[] = [
  {
    id: 'new',
    title: 'New Resume',
    description: 'Start from scratch',
    icon: '➕',
    color: '#10B981',
    chartData: Array.from({ length: 15 }, (_, i) => ({ value: 10 + Math.sin(i * 0.8) * 3 }))
  },
  {
    id: 'templates',
    title: 'Templates',
    description: 'Browse templates',
    icon: '🗂️',
    color: '#8B5CF6',
    chartData: Array.from({ length: 15 }, (_, i) => ({ value: 5 + Math.cos(i * 0.5) * 4 }))
  },
  {
    id: 'review',
    title: 'AI Review',
    description: 'Upload & analyze',
    icon: '📤',
    color: '#3B82F6',
    chartData: Array.from({ length: 15 }, (_, i) => ({ value: 8 + Math.random() * 5 }))
  }
];

export const WEEKLY_GOALS: GoalItem[] = [
  { id: '1', label: 'Build a resume', completed: false },
  { id: '2', label: 'Add 3+ skills', completed: false },
  { id: '3', label: 'Complete experience section', completed: false },
  { id: '4', label: 'Get AI review', completed: false }
];

export const RESUME_TEMPLATES: ResumeTemplate[] = [
  {
    id: 'swe-intern',
    role: 'Software Engineer (Intern)',
    category: 'Technology',
    experienceLevel: 'Entry',
    usedWhen: 'Student or early-career applicant with significant project work.',
    screeningLogic: 'Prioritizes technical stack and projects above titles; education listed at top for institutional verification.',
    sections: ['Contact', 'Education', 'Technical Skills', 'Projects', 'Experience'],
    riskNotes: 'Summary usually skipped for interns; objective discouraged.'
  },
  {
    id: 'swe-mid',
    role: 'Software Engineer (Mid/Senior)',
    category: 'Technology',
    experienceLevel: 'Mid',
    usedWhen: 'Individual contributors with 3-7 years of production experience.',
    screeningLogic: 'Emphasizes role-specific impact and technical scale; experience listed immediately after contact.',
    sections: ['Contact', 'Experience', 'Technical Skills', 'Education', 'Projects'],
    riskNotes: 'Project section should only include high-signal production-adjacent work.'
  },
  {
    id: 'pm-mid',
    role: 'Product Manager',
    category: 'Business & Operations',
    experienceLevel: 'Mid',
    usedWhen: 'Cross-functional leaders focused on data-backed outcomes.',
    screeningLogic: 'Optimized for metric density and action-impact linkage; emphasizes leadership and strategy.',
    sections: ['Contact', 'Experience', 'Projects', 'Skills', 'Education'],
    riskNotes: 'Skills section must verify specific methodologies (e.g., Agile, SQL).'
  },
  {
    id: 'ib-analyst',
    role: 'Investment Banking Analyst',
    category: 'Finance',
    experienceLevel: 'Entry',
    usedWhen: 'Targeting top-tier financial institutions and analyst programs.',
    screeningLogic: 'Standardized rigid hierarchy; emphasizes institutional prestige and quantitative accuracy.',
    sections: ['Contact', 'Education', 'Experience', 'Projects', 'Skills & Interests'],
    riskNotes: 'Formatting deviations are often treated as high-risk in banking screening.'
  },
  {
    id: 'ux-designer',
    role: 'Product Designer (UX/UI)',
    category: 'Design & Creative',
    experienceLevel: 'Mid',
    usedWhen: 'Designers in corporate or tech-heavy product environments.',
    screeningLogic: 'Structural layout emphasizes portfolio link visibility and tool proficiency alongside user-centric impact.',
    sections: ['Contact', 'Experience', 'Projects', 'Skills', 'Education'],
    riskNotes: 'Visual flair must not interfere with ATS parsing reality.'
  },
  {
    id: 'data-scientist',
    role: 'Data Scientist',
    category: 'Technology',
    experienceLevel: 'Mid',
    usedWhen: 'Applying for research or production-oriented data roles.',
    screeningLogic: 'Links specific tools to statistical outcomes; technical stack grouped by application (e.g., ML, Viz).',
    sections: ['Contact', 'Technical Skills', 'Experience', 'Projects', 'Education'],
    riskNotes: 'Narrative summary is common but must remain strictly factual.'
  },
  {
    id: 'res-assistant',
    role: 'Research Assistant',
    category: 'Research & Academia',
    experienceLevel: 'Entry',
    usedWhen: 'Applying for graduate programs or institutional research roles.',
    screeningLogic: 'Emphasizes academic credentials and research methodologies; publication list prioritized.',
    sections: ['Contact', 'Education', 'Research Experience', 'Publications', 'Skills'],
    riskNotes: 'Non-academic experience should be secondary.'
  }
];
