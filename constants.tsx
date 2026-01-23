
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
    id: 'templates',
    title: 'Templates',
    description: 'Browse role-specific blueprints and templates.',
    icon: 'Layers',
    color: '#8B5CF6',
    chartData: Array.from({ length: 15 }, (_, i) => ({ value: 5 + Math.cos(i * 0.5) * 4 }))
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

export const RESUME_TEMPLATES: ResumeTemplate[] = [
  // SOFTWARE / TECH
  {
    id: 'swe-prod-first',
    name: 'Software Engineer — Production-First',
    targetRole: 'Software Engineer',
    seniority: 'Mid-Level',
    field: 'Software / Tech',
    usedWhen: 'Used by engineers with 2–5 years of production experience applying to product companies.',
    sectionOrder: ['Contact', 'Skills', 'Experience', 'Projects', 'Education'],
    recruiterScan: {
      noticeFirst: ['Company pedigree', 'Technical stack density', 'Direct metric ownership'],
      skim: ['Educational details', 'Soft skill buzzwords'],
      ignore: ['Interests', 'Personal summaries']
    },
    riskNotes: 'Fails if experience bullets lack metrics or scaling context.',
    variant: 'Primary'
  },
  {
    id: 'staff-eng-strat',
    name: 'Staff Engineer — Strategic Impact',
    targetRole: 'Staff / Principal Engineer',
    seniority: 'Senior+',
    field: 'Software / Tech',
    usedWhen: 'For engineers leading multiple teams or complex architectural migrations.',
    sectionOrder: ['Contact', 'Executive Summary', 'Experience', 'Technical Leadership', 'Education'],
    recruiterScan: {
      noticeFirst: ['Cross-team impact', 'Architecture decisions', 'Mentorship scale'],
      skim: ['Old stack details', 'Coding-level bullets'],
      ignore: ['GPA', 'Junior-level awards']
    },
    riskNotes: 'Fails if the impact is limited to a single feature or Jira ticket.',
    variant: 'Stretch'
  },
  {
    id: 'swe-safe-enterprise',
    name: 'Software Engineer — Enterprise / Scale',
    targetRole: 'Software Engineer',
    seniority: 'Mid-Level',
    field: 'Software / Tech',
    usedWhen: 'Aligned with recruiter screening behavior in large-scale corporate or fintech environments.',
    sectionOrder: ['Contact', 'Experience', 'Technical Skills', 'Education', 'Certifications'],
    recruiterScan: {
      noticeFirst: ['Longevity at roles', 'Enterprise toolsets', 'Security/compliance mentions'],
      skim: ['Side projects', 'Early education'],
      ignore: ['Social links', 'Stylistic formatting']
    },
    riskNotes: 'Risk of appearing too "cog-in-the-machine" if projects are hidden.',
    variant: 'Safe'
  },
  {
    id: 'devops-sre-resilience',
    name: 'DevOps / SRE — Resilience Framework',
    targetRole: 'SRE / DevOps Engineer',
    seniority: 'Mid-Senior',
    field: 'Software / Tech',
    usedWhen: 'Focuses on infrastructure stability, automation, and cost-reduction metrics.',
    sectionOrder: ['Contact', 'Technical Stack', 'Experience', 'Infrastructure Projects', 'Education'],
    recruiterScan: {
      noticeFirst: ['Uptime % improvements', 'Cloud cost savings', 'CI/CD pipeline speed'],
      skim: ['Feature development', 'Documentation tools'],
      ignore: ['Customer support roles']
    },
    riskNotes: 'Fails if the stack is outdated or lacks cloud-native context.',
    variant: 'Primary'
  },

  // DATA / ANALYTICS
  {
    id: 'da-analytical-base',
    name: 'Data Analyst — Technical Fundamental',
    targetRole: 'Data Analyst',
    seniority: 'Entry-Level',
    field: 'Data / Analytics',
    usedWhen: 'ATS-safe by construction; used by candidates landing first full-time analytics roles.',
    sectionOrder: ['Contact', 'Technical Skills', 'Projects', 'Experience', 'Education'],
    recruiterScan: {
      noticeFirst: ['Tool proficiency (SQL/Python)', 'Visual impact examples', 'Degree relevance'],
      skim: ['Internship descriptions if non-analytical'],
      ignore: ['Generic objective statements']
    },
    riskNotes: 'Fails if Project links (Github/Portfolio) are broken or low-quality.',
    variant: 'Primary'
  },
  {
    id: 'ds-ml-modeling',
    name: 'Data Scientist — ML Modeling',
    targetRole: 'Data Scientist',
    seniority: 'Mid-Level',
    field: 'Data / Analytics',
    usedWhen: 'Emphasizes model accuracy, deployment cycles, and business value generated by ML.',
    sectionOrder: ['Contact', 'ML Skills', 'Experience', 'Research & Projects', 'Education'],
    recruiterScan: {
      noticeFirst: ['Modeling frameworks', 'Productionized ML', 'Statistical rigors'],
      skim: ['Data cleaning descriptions', 'Generic SQL tasks'],
      ignore: ['Design tools', 'Management buzzwords']
    },
    riskNotes: 'Fails if "Research" lacks a production-ready outcome.',
    variant: 'Primary'
  },

  // BUSINESS / MANAGEMENT
  {
    id: 'pm-outcome-focused',
    name: 'Product Manager — Outcome-Driven',
    targetRole: 'Product Manager',
    seniority: 'Senior',
    field: 'Business / Management',
    usedWhen: 'Observed in successful applications for Senior PM roles at growth-stage startups.',
    sectionOrder: ['Contact', 'Executive Summary', 'Experience', 'Impact Highlights', 'Skills'],
    recruiterScan: {
      noticeFirst: ['$ or % impact in headlines', 'Cross-functional scope', 'Strategic vision'],
      skim: ['Technical tool lists', 'Operational tasks'],
      ignore: ['Unrelated early career roles']
    },
    riskNotes: 'Fails if the "Impact" section feels like a duplication of experience.',
    variant: 'Primary'
  },
  {
    id: 'ops-lead-efficiency',
    name: 'Operations Lead — Process Efficiency',
    targetRole: 'Operations Manager',
    seniority: 'Mid-Level',
    field: 'Business / Management',
    usedWhen: 'Best for streamlining-heavy roles where process optimization is the core value.',
    sectionOrder: ['Contact', 'Core Proficiencies', 'Professional Experience', 'Education'],
    recruiterScan: {
      noticeFirst: ['Process cost savings', 'Team output metrics', 'Software implementation'],
      skim: ['Project management theory', 'Meetings organized'],
      ignore: ['Hobbies', 'Personal philosophies']
    },
    riskNotes: 'Fails if bullets describe tasks instead of efficiency gains.',
    variant: 'Safe'
  },

  // STUDENT / FRESHER
  {
    id: 'student-academic-focus',
    name: 'University Student — Academic Foundation',
    targetRole: 'Intern / Junior',
    seniority: 'Entry-Level',
    field: 'Student / Fresher',
    usedWhen: 'Optimized for current students or recent grads with limited professional work history.',
    sectionOrder: ['Contact', 'Education', 'Projects', 'Skills', 'Awards'],
    recruiterScan: {
      noticeFirst: ['GPA/Academic honors', 'Project technical depth', 'University pedigree'],
      skim: ['Part-time unrelated work', 'Volunteer work'],
      ignore: ['Objective statements']
    },
    riskNotes: 'Fails if projects lack a "Problem/Solution/Result" structure.',
    variant: 'Primary'
  },
  {
    id: 'fresher-general-skill',
    name: 'General Fresher — Skill-Heavy',
    targetRole: 'Junior / Associate',
    seniority: 'Entry-Level',
    field: 'Student / Fresher',
    usedWhen: 'For new grads whose project work is stronger than their educational pedigree.',
    sectionOrder: ['Contact', 'Technical Skills', 'Projects', 'Education', 'Leadership'],
    recruiterScan: {
      noticeFirst: ['Skill density', 'Self-taught projects', 'Internship outcomes'],
      skim: ['Coursework lists', 'School descriptions'],
      ignore: ['Soft skills list', 'Interest tags']
    },
    riskNotes: 'Risk of appearing too "theoretical" if projects aren\'t verifiable.',
    variant: 'Safe'
  },

  // GENERAL PROFESSIONAL
  {
    id: 'gen-professional',
    name: 'General Professional — Versatile',
    targetRole: 'Various',
    seniority: 'Senior',
    field: 'General Professional',
    usedWhen: 'A balanced structure for general corporate roles where experience longevity is key.',
    sectionOrder: ['Contact', 'Summary', 'Experience', 'Education', 'Skills'],
    recruiterScan: {
      noticeFirst: ['Title progression', 'Company names', 'Stability'],
      skim: ['Early career history', 'References'],
      ignore: ['Large text blocks']
    },
    riskNotes: 'Fails if the Summary is too long or generic.',
    variant: 'Safe'
  },
  {
    id: 'career-changer-pivot',
    name: 'Career Changer — Functional Pivot',
    targetRole: 'New Role / Pivot',
    seniority: 'Mid-Level',
    field: 'General Professional',
    usedWhen: 'Used when moving between industries where skills are more transferable than history.',
    sectionOrder: ['Contact', 'Skill Matrix', 'Relevant Projects', 'Experience', 'Education'],
    recruiterScan: {
      noticeFirst: ['Transferable skill match', 'Recent certifications', 'Relevant project impact'],
      skim: ['Unrelated old job titles', 'Detailed old job duties'],
      ignore: ['Age-related details', 'Old industry jargon']
    },
    riskNotes: 'Risk of confusion if the pivot isn\'t clearly explained in the Skill Matrix.',
    variant: 'Stretch'
  }
];
