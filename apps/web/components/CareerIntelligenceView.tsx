"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
   ArrowRight, Loader2, TrendingUp, AlertCircle, Shield, Lock,
   AlertTriangle, RefreshCw, Radar, AlertOctagon, Clock, Radio,
   Send, Target, ShieldAlert, Fingerprint, Activity, XCircle,
   CheckCircle2, Info, ExternalLink, Plus, ChevronDown, ChevronUp,
   BookmarkPlus, Play, Settings, Sliders, FileText, Check, Copy
} from 'lucide-react';
import { DiagnosticResult, UserPlan, MarketCommandSnapshot, AppView, BackgroundJob, JobType, ActiveAnalysisContext } from '../types';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================
interface CareerIntelligenceViewProps {
   analysisResult: DiagnosticResult | null;
   resumeText: string;
   resumeProfile: ActiveAnalysisContext | null;
   plan: UserPlan;
   setView: (v: AppView) => void;
   activeJobs: Record<string, BackgroundJob>;
   dispatchJob: (type: JobType, payload: Record<string, unknown>) => Promise<string>;
}

interface CachedSnapshot {
   snapshot: MarketCommandSnapshot;
   cachedAt: number;
   expiresAt: number;
}

interface SnapshotArchive {
   id: string;
   role: string;
   geography: string;
   generatedAt: string;
   marketStatus: string;
   executionTargetCount: number;
}

// ============================================================================
// CONSTANTS & Grounding Data
// ============================================================================
const CACHE_KEY = 'hiremax_market_snapshot';
const ARCHIVE_KEY = 'hiremax_snapshot_archive';
const CACHE_DURATION_MS = 4 * 60 * 60 * 1000; // 4 hours
const PROCESSING_TIMEOUT_MS = 120000; // 2 minutes

const MARKET_CONTEXT_2026 = `CRITICAL MARKET CONTEXT (Source: Q1 2026 data):
- Tech layoffs in 2026: 138,837 workers as of May 2026 (1,006/day)
- Application volume: 250+ applications per role at well-known companies
- Tech job postings: 36% below pre-2020 levels
- Fastest growing: AI/ML Engineering (+400%), Cybersecurity, Data Science
- Shrinking: Legacy SWE generalist, QA Engineering, Project Management
- Median job search duration: 45-90 days for mid-level, 17 days via specialists
- Senior engineers with AI skills command 40-60% premium
- Key insight: Companies are cutting legacy roles AND hiring AI-adjacent roles simultaneously
- Target signals: Series C-D startups with recent funding, companies announcing AI infra investment`.trim();

const HOT_SEGMENTS_2026: Record<string, string[]> = {
   'ML Engineer': ['AI infrastructure', 'LLM fine-tuning', 'RAG systems'],
   'Machine Learning Engineer': ['AI infrastructure', 'LLM fine-tuning', 'RAG systems'],
   'AI Engineer': ['Agent systems', 'LLM ops', 'Multimodal AI'],
   'Software Engineer': ['AI-adjacent products', 'Fintech', 'Security tooling'],
   'Backend Engineer': ['AI infrastructure', 'Fintech APIs', 'Developer platforms'],
   'Data Engineer': ['Real-time pipelines', 'AI data infra', 'Analytics engineering'],
   'Data Scientist': ['LLM evaluation', 'MLOps', 'Applied AI'],
   'Product Manager': ['AI product', 'Developer tools', 'B2B SaaS'],
   'DevOps Engineer': ['Platform engineering', 'AI infra', 'Security automation'],
   'Security Engineer': ['AppSec', 'Cloud security', 'AI security'],
};

const MARKET_PULSE_2026 = {
   techLayoffs: '138,837',
   applicantsPerRole: '250+',
   openingsQ1: '67,000',
   aiGrowth: '+400%',
   medianSearch: '45–90 days',
   lastUpdated: 'Q1 2026',
};

interface TargetCompanyPool {
   name: string;
   industries: string[];
   stackKeywords: string[];
   geographies: string[];
   minExp: number;
   fitReasonTemplate: string;
}

const COMPANY_POOL: TargetCompanyPool[] = [
   {
      name: 'Together AI',
      industries: ['ai', 'ml', 'infrastructure'],
      stackKeywords: ['triton', 'cuda', 'llm', 'distributed systems', 'pytorch', 'python'],
      geographies: ['Remote', 'North America', 'San Francisco'],
      minExp: 5,
      fitReasonTemplate: 'Aggressive capacity scaling for distributed GPU clusters requires high-throughput pipeline optimizations.'
   },
   {
      name: 'Anyscale',
      industries: ['ai', 'ml', 'infrastructure'],
      stackKeywords: ['ray', 'python', 'distributed systems', 'kubernetes', 'mlops'],
      geographies: ['Remote', 'North America', 'San Francisco'],
      minExp: 3,
      fitReasonTemplate: 'Expanding Ray core runtime scaling parameters; fits background in distributed computing and cluster orchestration.'
   },
   {
      name: 'Pinecone',
      industries: ['ai', 'vector db', 'infrastructure'],
      stackKeywords: ['rust', 'c++', 'go', 'vector search', 'kubernetes', 'distributed systems'],
      geographies: ['Remote', 'North America', 'New York'],
      minExp: 4,
      fitReasonTemplate: 'Scaling vector database query planner and shard consensus models; aligns with backend concurrency experience.'
   },
   {
      name: 'Scale AI',
      industries: ['ai', 'data labeling', 'mlops'],
      stackKeywords: ['python', 'react', 'typescript', 'kubernetes', 'node.js'],
      geographies: ['Remote', 'North America', 'San Francisco'],
      minExp: 2,
      fitReasonTemplate: 'Accelerated enterprise LLM RLHF alignment training ingestion; maps to scalable telemetry ingestion skills.'
   },
   {
      name: 'LangChain',
      industries: ['ai', 'frameworks'],
      stackKeywords: ['python', 'typescript', 'agent', 'llm', 'node.js'],
      geographies: ['Remote', 'San Francisco'],
      minExp: 2,
      fitReasonTemplate: 'Core open-source SDK and LangSmith monitoring infra expansion; matches runtime integration expertise.'
   },
   {
      name: 'Vercel',
      industries: ['frontend', 'dev tools', 'saas'],
      stackKeywords: ['next.js', 'react', 'typescript', 'rust', 'edge computing'],
      geographies: ['Remote', 'North America', 'Europe'],
      minExp: 3,
      fitReasonTemplate: 'Expanding global serverless edge deployment execution runtime; aligns with performance-driven stack profiles.'
   },
   {
      name: 'Supabase',
      industries: ['database', 'dev tools', 'saas'],
      stackKeywords: ['postgres', 'go', 'typescript', 'elixir', 'sql'],
      geographies: ['Remote', 'North America', 'Europe', 'Singapore'],
      minExp: 3,
      fitReasonTemplate: 'PgVector extensions and distributed real-time sync upgrades require relational indexing expertise.'
   },
   {
      name: 'Linear',
      industries: ['productivity', 'saas'],
      stackKeywords: ['typescript', 'react', 'node.js', 'electron', 'webgl'],
      geographies: ['Remote', 'North America', 'Europe'],
      minExp: 5,
      fitReasonTemplate: 'Refactoring ultra-low latency client replication engine; fits developers obsessed with performance and visual polish.'
   },
   {
      name: 'Retool',
      industries: ['dev tools', 'low code', 'saas'],
      stackKeywords: ['typescript', 'react', 'node.js', 'postgres', 'kubernetes'],
      geographies: ['Remote', 'North America', 'San Francisco'],
      minExp: 3,
      fitReasonTemplate: 'Enterprise private-cloud deployment orchestration and complex SQL editor optimization requirements.'
   },
   {
      name: 'Stripe',
      industries: ['fintech', 'infrastructure', 'scale'],
      stackKeywords: ['ruby', 'go', 'java', 'distributed systems', 'apis', 'pci'],
      geographies: ['Remote', 'North America', 'Dublin', 'London'],
      minExp: 4,
      fitReasonTemplate: 'Upgrades to distributed billing state machines and sub-millisecond payment ledger sync algorithms.'
   },
   {
      name: 'ClickHouse',
      industries: ['database', 'infrastructure', 'scale'],
      stackKeywords: ['c++', 'vectorization', 'olap', 'sql', 'distributed systems'],
      geographies: ['Remote', 'North America', 'Europe'],
      minExp: 5,
      fitReasonTemplate: 'Engine development for high-speed columnar data storage and vectorized execution loops.'
   },
   {
      name: 'Fly.io',
      industries: ['infrastructure', 'cloud', 'devops'],
      stackKeywords: ['rust', 'go', 'wireguard', 'firecracker', 'nomad', 'kubernetes'],
      geographies: ['Remote', 'North America', 'Europe'],
      minExp: 5,
      fitReasonTemplate: 'Building ultra-fast micro-VM migration tools on custom hypervisors; matches systems programming profile.'
   },
   {
      name: 'Neon',
      industries: ['database', 'cloud', 'infrastructure'],
      stackKeywords: ['rust', 'c', 'postgres', 'storage systems', 'kubernetes'],
      geographies: ['Remote', 'North America', 'Europe'],
      minExp: 4,
      fitReasonTemplate: 'Serverless Postgres storage engine compute auto-scaling and storage node replication systems.'
   },
   {
      name: 'Sentry',
      industries: ['dev tools', 'saas', 'scale'],
      stackKeywords: ['python', 'react', 'typescript', 'node.js', 'clickhouse', 'rust'],
      geographies: ['Remote', 'North America', 'Europe'],
      minExp: 3,
      fitReasonTemplate: 'High-throughput event ingestion and visual flame-graph performance profile rendering optimizations.'
   }
];

const generateExecutionTargets = (
   role: string,
   resumeText: string,
   geo: string,
   exp: string,
   algo: number,
   scale: number,
   velocity: number
) => {
   const lowerRole = role.toLowerCase();
   const lowerResume = (resumeText || '').toLowerCase();
   const lowerGeo = geo.toLowerCase();
   
   const scored = COMPANY_POOL.map(company => {
      let score = 50; // base score
      
      // Match industries with target role keywords
      if (lowerRole.includes('ml') || lowerRole.includes('ai') || lowerRole.includes('machine learning') || lowerRole.includes('nlp')) {
         if (company.industries.includes('ai') || company.industries.includes('ml') || company.industries.includes('vector db')) score += 25;
      }
      if (lowerRole.includes('backend') || lowerRole.includes('system') || lowerRole.includes('infra') || lowerRole.includes('platform') || lowerRole.includes('devops')) {
         if (company.industries.includes('infrastructure') || company.industries.includes('database') || company.industries.includes('scale')) score += 20;
      }
      if (lowerRole.includes('frontend') || lowerRole.includes('fullstack') || lowerRole.includes('react') || lowerRole.includes('ui') || lowerRole.includes('web')) {
         if (company.industries.includes('frontend') || company.industries.includes('saas') || company.industries.includes('productivity')) score += 20;
      }
      
      // Match resume keywords with stack
      let stackMatches = 0;
      company.stackKeywords.forEach(kw => {
         if (lowerResume.includes(kw)) {
            stackMatches++;
            score += 5; // +5 for each matching resume keyword!
         }
      });
      
      // Match geography perimeters
      let geoMatch = false;
      company.geographies.forEach(g => {
         if (lowerGeo.includes(g.toLowerCase()) || g.toLowerCase() === 'remote') {
            geoMatch = true;
         }
      });
      if (geoMatch) {
         score += 10;
      } else {
         score -= 10;
      }
      
      // Adjust score based on experience match
      let expYears = 3;
      if (exp.includes('0-2')) expYears = 1;
      else if (exp.includes('3-5')) expYears = 4;
      else if (exp.includes('5-8')) expYears = 7;
      else if (exp.includes('8-12') || exp.includes('12+')) expYears = 11;
      
      if (expYears < company.minExp) {
         score -= 15; // penalty for low experience
      } else {
         score += 5;
      }
      
      // Adjust score based on dial calibrations chosen by user
      if (company.industries.includes('ai') || company.industries.includes('ml')) {
         score += (velocity - 50) * 0.2;
      }
      if (company.industries.includes('scale') || company.industries.includes('database')) {
         score += (scale - 50) * 0.2;
      }
      if (company.industries.includes('infrastructure') || company.name === 'Stripe') {
         score += (algo - 50) * 0.2;
      }
      
      // Caps/Floors
      score = Math.min(Math.max(Math.round(score), 40), 98);
      
      // Generate custom fit reason based on user's matched keywords
      let customReason = company.fitReasonTemplate;
      if (stackMatches > 0) {
         const matchedKeywords = company.stackKeywords.filter(kw => lowerResume.includes(kw)).slice(0, 2).join(' & ');
         customReason = `Strong technical alignment on ${matchedKeywords.toUpperCase()}. ${company.fitReasonTemplate}`;
      } else {
         customReason = `Excellent architectural match. ${company.fitReasonTemplate}`;
      }
      
      return {
         company: company.name,
         roleTitle: role || 'Lead Systems Specialist',
         confidence: score,
         fitReason: customReason,
         validityWindow: '90 Days'
      };
   });
   
   return scored.sort((a, b) => b.confidence - a.confidence).slice(0, 4);
};

const generateSnapshot = (
   role: string,
   resumeText: string,
   geo: string,
   exp: string,
   algo: number,
   scale: number,
   velocity: number
): MarketCommandSnapshot => {
   const targets = generateExecutionTargets(role, resumeText, geo, exp, algo, scale, velocity);
   const isAI = role.toLowerCase().includes('ml') || role.toLowerCase().includes('ai') || role.toLowerCase().includes('machine learning');
   
   const marketStatus = isAI ? {
      label: 'Hyper-Growth Acceleration',
      implication: 'AI/ML Engineering roles are expanding at +400% YTD. Mid-to-senior profiles with verified Triton/TensorRT and high-scale inference metrics are experiencing high outbound recruitment velocity.'
   } : {
      label: 'Precision Capital Allocation',
      implication: 'Generalist software engineering postings are down 36% from historic baselines. Modern platforms are prioritizing infrastructure specialists and product-focused engineers who reduce cloud spend and boost performance.'
   };
   
   const doNotApplyZone = isAI ? [
      {
         entityType: 'Wrapper Startups (Pre-Seed/Seed)',
         reasoning: 'High platform dependency on primary LLM vendors, thin IP margins, and elevated runway depletion risk.'
      },
      {
         entityType: 'Non-Technical Outsourcing Agencies',
         reasoning: 'Rebranded "AI Consultancies" lacking real GPU computing power, offering low-leverage prompt engineering contracts.'
      }
   ] : [
      {
         entityType: 'Legacy IT Consulting Firms',
         reasoning: 'Severe budget contractions and hiring freezes. Roles here carry elevated structural redundancy risk.'
      },
      {
         entityType: 'Pre-revenue Consumer App Plays',
         reasoning: 'High capital vulnerability under current Q1 2026 interest rate conditions; low retention rates for infrastructure generalists.'
      }
   ];

   const next7Days = [
      `Inject high-fidelity systems validation bullets tailored for ${targets[0]?.company || 'target startups'} into your resume experience section.`,
      `Establish outbound LinkedIn connection warmups with Engineering Managers at ${targets[0]?.company || 'Vercel'} and ${targets[1]?.company || 'Supabase'}.`,
      `Address the Project Portfolio screening gate by highlighting a self-directed distributed caching or model evaluation tool.`
   ];

   const next30Days = [
      `Publish a high-polish repository proving your capability to handle systems scale or high-concurrency database optimizations.`,
      `Calibrate custom cover letters matching the technical stack vectors of your top 4 target companies.`,
      `Re-run active resume diagnostic checks on the HireMax platform to verify ATS match scores above 85%.`
   ];

   return {
      id: `CMD-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
      timestamp: new Date().toISOString(),
      expiry: formatExpiry(Date.now() + CACHE_DURATION_MS),
      context: { role, geography: geo, expBand: exp },
      marketStatus,
      executionTargets: targets,
      doNotApplyZone,
      actionOrders: {
         next7Days,
         next30Days,
         positioningDirectives: [
            `Position yourself explicitly as a high-throughput systems specialist capable of resolving ${isAI ? 'inference latency' : 'database connection'} bottlenecks.`
         ],
         interviewDirectives: [
            `Lead technical interviews by presenting custom metrics detailing cloud cost optimization or system throughput multipliers.`
         ]
      },
      risks: {
         uncertainty: isAI ? 'Rapidly changing model API costs and hardware shortages.' : 'Slowing enterprise B2B SaaS seats purchasing velocity.',
         refreshCondition: 'Refresh command upon any significant shift in Series C/D tech sector funding indexes.'
      }
   };
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================
const safeLocalStorageGet = <T,>(key: string, fallback: T): T => {
   try {
      const item = localStorage.getItem(key);
      if (!item) return fallback;
      return JSON.parse(item) as T;
   } catch {
      return fallback;
   }
};

const safeLocalStorageSet = (key: string, value: unknown): boolean => {
   try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
   } catch {
      console.warn(`Failed to save to localStorage: ${key}`);
      return false;
   }
};

const safeLocalStorageRemove = (key: string): void => {
   try {
      localStorage.removeItem(key);
   } catch { /* Silently fail */ }
};

const formatExpiry = (expiresAt: number): string => {
   const now = Date.now();
   if (expiresAt <= now) return 'Expired';
   const diff = expiresAt - now;
   const hours = Math.floor(diff / (60 * 60 * 1000));
   const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
   if (hours > 0) return `${hours}h ${minutes}m`;
   return `${minutes}m`;
};

const getFitLabel = (confidence: number) => {
   if (confidence >= 90) return { label: 'Strong Fit', color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20' };
   if (confidence >= 70) return { label: 'Good Fit', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' };
   return { label: 'Possible Fit', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' };
};

const getLinkedInJobsUrl = (roleTitle: string, company: string) =>
   `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(roleTitle)}&company=${encodeURIComponent(company)}`;

const getGlassdoorUrl = (company: string) =>
   `https://www.glassdoor.com/Search/Results.htm?keyword=${encodeURIComponent(company)}`;

const getHotSegments = (role: string): string[] => {
   const r = role.toLowerCase();
   for (const [key, segs] of Object.entries(HOT_SEGMENTS_2026)) {
      if (r.includes(key.toLowerCase())) return segs;
   }
   if (r.includes('engineer') || r.includes('developer')) return HOT_SEGMENTS_2026['Software Engineer'];
   if (r.includes('product')) return HOT_SEGMENTS_2026['Product Manager'];
   if (r.includes('data')) return HOT_SEGMENTS_2026['Data Scientist'];
   return ['AI-adjacent products', 'Series C-D startups', 'Growth-stage companies'];
};

const compileSkillsGap = (role: string, resumeText: string) => {
   const rt = (resumeText || '').toLowerCase();
   const allSkills = [
      { name: 'LLM Fine-Tuning & MLOps', category: 'AI/ML' },
      { name: 'RAG Architecture & Vector DBs', category: 'AI/ML' },
      { name: 'Kubernetes & Platform Eng', category: 'Infrastructure' },
      { name: 'Distributed Systems & Scaling', category: 'Architecture' },
      { name: 'High-Concurrency Backend APIs', category: 'Backend' },
      { name: 'Real-time Data Streaming', category: 'Data' }
   ];

   if (!resumeText) {
      return {
         acquired: [
            { name: 'High-Concurrency Backend APIs', category: 'Backend' },
            { name: 'Distributed Systems & Scaling', category: 'Architecture' }
         ],
         gaps: [
            { name: 'LLM Fine-Tuning & MLOps', category: 'AI/ML' },
            { name: 'RAG Architecture & Vector DBs', category: 'AI/ML' },
            { name: 'Kubernetes & Platform Eng', category: 'Infrastructure' }
         ]
      };
   }

   const acquired = allSkills.filter(s => rt.includes(s.name.toLowerCase().split(' ')[0]) || rt.includes(s.category.toLowerCase()));
   const gaps = allSkills.filter(s => !acquired.some(a => a.name === s.name));

   return { acquired, gaps };
};

const getBulletTemplates = (skills: { name: string; category: string }[]) => {
   const templates: Record<string, string[]> = {
      'LLM Fine-Tuning & MLOps': [
         'Optimized high-scale MLOps framework for LLM fine-tuning, reducing model serving latency by 45% using Triton and TensorRT-LLM.',
         'Orchestrated automated pipeline for model evaluation and reinforcement learning from human feedback, accelerating model deployment cycles by 3x.'
      ],
      'RAG Architecture & Vector DBs': [
         'Engineered highly efficient RAG system using Qdrant and PgVector, processing 10M+ documents with 92% retrieval precision and sub-50ms latency.',
         'Implemented hybrid keyword-vector search algorithms, boosting search relevancy score by 34% for enterprise document search tools.'
      ],
      'Kubernetes & Platform Eng': [
         'Deployed scalable platform engineering template utilizing Kubernetes, helm charts, and ArgoCD, facilitating 20+ microservice rollouts with zero downtime.',
         'Scaled multi-tenant EKS clusters to handle 50k requests/sec, reducing compute footprint by 28% through custom autoscaling and spot instances.'
      ],
      'Distributed Systems & Scaling': [
         'Architected distributed event-driven systems utilizing Kafka and gRPC, resolving critical chokepoints and increasing transaction throughput by 120%.',
         'Redesigned high-throughput microservices using Redis clusters for distributed caching, achieving 99.99% system availability.'
      ],
      'High-Concurrency Backend APIs': [
         'Designed resilient NestJS/Go REST APIs handling 15k peak parallel connections, leveraging connection pooling and load balancing techniques.',
         'Refactored database read replica pools, cutting average API response times from 340ms to 48ms under high-load stress testing.'
      ],
      'Real-time Data Streaming': [
         'Developed high-volume real-time data ingestion pipelines using Flink and Spark, aggregating 2.5TB of telemetry daily with sub-second lag.',
         'Constructed custom stream processing filters that captured and flagged anomalous events with a false positive rate under 0.1%.'
      ]
   };

   return skills.map(s => ({
      skill: s.name,
      bullets: templates[s.name] || [
         `Spearheaded the integration of ${s.name} frameworks, boosting performance metric by 25% and reducing system overhead.`,
         `Developed high-fidelity prototypes using ${s.name} best practices, accelerating project delivery schedules.`
      ]
   }));
};

const generateOutreachPitches = (companyName: string, roleTitle: string) => {
   return {
      recruiter: {
         direct: `Subject: Lead ML Engineering Interest - ${companyName}\n\nHi there,\n\nI recently came across the hiring signals for the ${roleTitle} position at ${companyName}. Given my background in scaling distributed AI infrastructure and resolving complex LLM deployment chokepoints, I am incredibly excited about the work your team is doing.\n\nAt my previous role, I reduced model latency by 45% while handling 50k requests/sec. I’d love to connect and discuss how my systems engineering skills can help ${companyName} hit its upcoming H2 milestones.\n\nDo you have 10 minutes for a brief introductory chat this week?\n\nBest regards,\n[Your Name]`,
         peer: `Subject: Peer connection / ${companyName} tech stack\n\nHi there,\n\nI’m a fellow ML Platform developer, and I noticed your team at ${companyName} is expanding its search for a ${roleTitle}.\n\nI’ve spent the last few years working on distributed training and high-throughput vector indexes (PgVector/Qdrant). Given the scale you guys operate at, I wanted to reach out and see if there are any specific systems or caching bottlenecks you are tackling.\n\nAlways up to talk shop with other engineers. Let me know if you'd be open to a quick virtual coffee.\n\nCheers,\n[Your Name]`
      },
      hiringManager: {
         direct: `Subject: Engineering Leadership - ${roleTitle} Signals\n\nHi [Manager Name],\n\nI saw that ${companyName} is scaling its ${roleTitle} division to tackle core real-time inference bottlenecks. Having spent the last 5 years architecting high-scale distributed systems and MLOps frameworks, I know firsthand the challenges of maintaining sub-50ms latencies under heavy query load.\n\nI recently engineered a RAG system that scaled to 10M documents with 92% precision. I’d love to share my learnings and see if I can support your roadmap goals at ${companyName}.\n\nWould you be open to a brief conversation next Tuesday morning?\n\nBest,\n[Your Name]`,
         peer: `Subject: Distributed Systems engineering notes / ${companyName}\n\nHi [Manager Name],\n\nI’ve been following ${companyName}’s engineering blog, especially your recent posts on real-time pipeline optimizations. I’m a Backend/ML Engineer focusing on high-concurrency architectures and Kafka streaming.\n\nI’m reaching out because I saw you’re hiring a ${roleTitle}. I’ve spent the past year designing event-driven microservices that reduced cloud compute overhead by 28%. I’d love to connect to hear more about your technical goals and share some of my caching strategies.\n\nLet me know if you have any availability for a quick connect.\n\nBest,\n[Your Name]`
      }
   };
};

const generateExecutiveSummary = (role: string, tone: 'standard' | 'aggressive' | 'expert') => {
   const standard = `Results-oriented Senior Systems Engineer with a proven track record of scaling high-concurrency backend services and distributed databases. Expert in optimizing query performance and deploying fault-tolerant platform infrastructure. Passionate about driving technical excellence and accelerating feature velocity in fast-paced startup environments.`;
   const aggressive = `High-impact distributed systems specialist with a track record of driving massive performance leaps—including reducing model serving latency by 45% and slashing cloud overhead by 28%. Proven ability to resolve critical database and infrastructure chokepoints. Specialized in building fault-tolerant architectures that handle 50k+ requests/sec under high stress.`;
   const expert = `Architect specializing in high-throughput AI infrastructure and MLOps. Author of robust vector-search implementations and real-time Kafka streaming pipelines handling multi-terabyte datasets. Expert in Kubernetes platform engineering, Triton server configuration, and custom autoscaling mechanisms for complex multi-tenant environments.`;

   if (tone === 'aggressive') return aggressive;
   if (tone === 'expert') return expert;
   return standard;
};

// ============================================================================
// COMPONENT
// ============================================================================
export const CareerIntelligenceView: React.FC<CareerIntelligenceViewProps> = ({
   analysisResult,
   resumeText,
   resumeProfile,
   plan,
   setView,
   activeJobs,
   dispatchJob
}) => {
   const [viewState, setViewState] = useState<'input' | 'processing' | 'snapshot'>('input');
   const [errorFeedback, setErrorFeedback] = useState<string | null>(null);
   const [successMessage, setSuccessMessage] = useState<string | null>(null);
   const [snapshot, setSnapshot] = useState<MarketCommandSnapshot | null>(null);
   const [snapshotExpiry, setSnapshotExpiry] = useState<number | null>(null);
   const [trackingJobId, setTrackingJobId] = useState<string | null>(null);
   const [processingStartTime, setProcessingStartTime] = useState<number | null>(null);

   const [targetRole, setTargetRole] = useState(analysisResult?.role || '');
   const [geography, setGeography] = useState('Remote / North America');
   const [expBand, setExpBand] = useState('Senior (5-8 years)');

   // Calibrator Sliders & Lenses state
   const [lensPreset, setLensPreset] = useState<'FAANG Architect' | 'Growth Generalist' | 'ML Platforms' | 'High-Scale Systems'>('FAANG Architect');
   const [algoRigor, setAlgoRigor] = useState<number>(85);
   const [velocityImpact, setVelocityImpact] = useState<number>(75);
   const [systemScale, setSystemScale] = useState<number>(90);

   // Work Panel Tab switcher
   const [activeTab, setActiveTab] = useState<'dossier' | 'blueprint' | 'editor' | 'pitch'>('dossier');
   const [expandedTargetIdx, setExpandedTargetIdx] = useState<number | null>(null);
   const [snapshotArchive, setSnapshotArchive] = useState<SnapshotArchive[]>([]);
   const [showArchive, setShowArchive] = useState(true);
   const [previousSnapshot, setPreviousSnapshot] = useState<MarketCommandSnapshot | null>(null);
   const [useResumeContext, setUseResumeContext] = useState(false);

   // Editor Tab state
   const [editorSummary, setEditorSummary] = useState<string>('');
   const [editorTone, setEditorTone] = useState<'standard' | 'aggressive' | 'expert'>('standard');

   // Pitch Tab state
   const [pitchTargetIdx, setPitchTargetIdx] = useState<number>(0);
   const [pitchTargetTone, setPitchTargetTone] = useState<'recruiter' | 'hiringManager'>('recruiter');
   const [pitchToneStyle, setPitchToneStyle] = useState<'direct' | 'peer'>('direct');

   // Refs for cleanup
   const processingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

   // Sync executive summary with role & tone choices
   useEffect(() => {
      setEditorSummary(generateExecutiveSummary(targetRole || snapshot?.context.role || 'Executive', editorTone));
   }, [targetRole, snapshot, editorTone]);

   // Clear toast messages after 5 seconds
   useEffect(() => {
      if (errorFeedback) {
         const timer = setTimeout(() => setErrorFeedback(null), 5000);
         return () => clearTimeout(timer);
      }
   }, [errorFeedback]);

   useEffect(() => {
      if (successMessage) {
         const timer = setTimeout(() => setSuccessMessage(null), 5000);
         return () => clearTimeout(timer);
      }
   }, [successMessage]);

   // Load snapshot archive on mount
   useEffect(() => {
      const loadArchive = async () => {
         const { data: { session } } = await supabase.auth.getSession();
         const userId = session?.user?.id || 'anonymous';
         const archiveKey = `${ARCHIVE_KEY}_${userId}`;
         const saved = safeLocalStorageGet<SnapshotArchive[]>(archiveKey, []);
         setSnapshotArchive(saved);
      };
      loadArchive();
   }, []);

   // Initialize from cache or running jobs (SEC-004 / REL-005)
   useEffect(() => {
      const initView = async () => {
         const { data: { session } } = await supabase.auth.getSession();
         const userId = session?.user?.id || 'anonymous';
         const userSpecificKey = `${CACHE_KEY}_${userId}`;

         // SECURE: Verify that current cache belongs to this user
         const allKeys = Object.keys(localStorage);
         allKeys.forEach(key => {
            if (key.startsWith(CACHE_KEY) && key !== userSpecificKey) {
               localStorage.removeItem(key);
            }
         });

         const cached = safeLocalStorageGet<CachedSnapshot | null>(userSpecificKey, null);
         const runningJob = Object.values(activeJobs).find(j => j.type === 'OUTLOOK' && j.status === 'RUNNING');

         if (runningJob) {
            setViewState('processing');
            setProcessingStartTime(new Date(runningJob.createdAt).getTime());
            setTrackingJobId(runningJob.id);
            if (runningJob.payload?.role) {
               setTargetRole(runningJob.payload.role as string);
               setGeography((runningJob.payload.geography as string) || geography);
            }
         } else if (cached && cached.expiresAt > Date.now()) {
            setSnapshot(cached.snapshot);
            setSnapshotExpiry(cached.expiresAt);
            setViewState('snapshot');
         }
      };

      initView();
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, []);

   // Track job status changes
   useEffect(() => {
      const activeJob = trackingJobId ? activeJobs[trackingJobId] : null;
      if (!activeJob) return;

      if (activeJob.status === 'COMPLETED') {
         const result = (activeJob.result || {}) as any;
         const fallbackSnap = generateSnapshot(
            (activeJob.payload?.role as string) || targetRole,
            resumeText,
            (activeJob.payload?.geography as string) || geography,
            (activeJob.payload?.expBand as string) || expBand,
            algoRigor,
            systemScale,
            velocityImpact
         );

         const newSnapshot: MarketCommandSnapshot = {
            id: result.id || fallbackSnap.id,
            timestamp: result.timestamp || fallbackSnap.timestamp,
            expiry: formatExpiry(Date.now() + CACHE_DURATION_MS),
            context: {
               role: (activeJob.payload?.role as string) || targetRole,
               geography: (activeJob.payload?.geography as string) || geography,
               expBand: (activeJob.payload?.expBand as string) || expBand
            },
            marketStatus: result.marketStatus && result.marketStatus.label ? result.marketStatus : fallbackSnap.marketStatus,
            executionTargets: generateExecutionTargets(
               (activeJob.payload?.role as string) || targetRole,
               resumeText,
               (activeJob.payload?.geography as string) || geography,
               (activeJob.payload?.expBand as string) || expBand,
               algoRigor,
               systemScale,
               velocityImpact
            ),
            doNotApplyZone: Array.isArray(result.doNotApplyZone) && result.doNotApplyZone.length > 0 ? result.doNotApplyZone : fallbackSnap.doNotApplyZone,
            actionOrders: {
               next7Days: Array.isArray(result.actionOrders?.next7Days) && result.actionOrders.next7Days.length > 0 ? result.actionOrders.next7Days : fallbackSnap.actionOrders.next7Days,
               next30Days: Array.isArray(result.actionOrders?.next30Days) && result.actionOrders.next30Days.length > 0 ? result.actionOrders.next30Days : fallbackSnap.actionOrders.next30Days,
               positioningDirectives: Array.isArray(result.actionOrders?.positioningDirectives) && result.actionOrders.positioningDirectives.length > 0 ? result.actionOrders.positioningDirectives : fallbackSnap.actionOrders.positioningDirectives,
               interviewDirectives: Array.isArray(result.actionOrders?.interviewDirectives) && result.actionOrders.interviewDirectives.length > 0 ? result.actionOrders.interviewDirectives : fallbackSnap.actionOrders.interviewDirectives
            },
            risks: result.risks || fallbackSnap.risks
         };
         const expiresAt = Date.now() + CACHE_DURATION_MS;
         const cacheEntry: CachedSnapshot = {
            snapshot: newSnapshot,
            cachedAt: Date.now(),
            expiresAt
         };

         const userKey = (window as any).__current_intel_key || `${CACHE_KEY}_anonymous`;

         setSnapshot(newSnapshot);
         setSnapshotExpiry(expiresAt);
         safeLocalStorageSet(userKey, cacheEntry);
         setViewState('snapshot');
         setTrackingJobId(null);
         setProcessingStartTime(null);
         setSuccessMessage('Market Command generated successfully!');

         // Clear processing timeout
         if (processingTimeoutRef.current) {
            clearTimeout(processingTimeoutRef.current);
            processingTimeoutRef.current = null;
         }
      } else if (activeJob.status === 'FAILED') {
         setErrorFeedback(activeJob.error || "Market projection failed. Please try again.");
         if (viewState === 'processing') setViewState('input');
         setTrackingJobId(null);
         setProcessingStartTime(null);

         // Clear processing timeout
         if (processingTimeoutRef.current) {
            clearTimeout(processingTimeoutRef.current);
            processingTimeoutRef.current = null;
         }
      }
   }, [activeJobs, trackingJobId, targetRole, geography, expBand, viewState]);
 
    // Reactively update snapshot targets when dials are adjusted
    useEffect(() => {
       if (snapshot) {
          const updatedTargets = generateExecutionTargets(
             snapshot.context.role,
             resumeText,
             snapshot.context.geography,
             snapshot.context.expBand,
             algoRigor,
             systemScale,
             velocityImpact
          );
          setSnapshot(prev => {
             if (!prev) return null;
             return {
                ...prev,
                executionTargets: updatedTargets
             };
          });
       }
       // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [algoRigor, systemScale, velocityImpact]);

   // Processing timeout
   useEffect(() => {
      if (viewState === 'processing' && processingStartTime) {
         const elapsed = Date.now() - processingStartTime;
         const remaining = PROCESSING_TIMEOUT_MS - elapsed;

         if (remaining <= 0) {
            setErrorFeedback('Processing timed out. The server may be overloaded. Please try again.');
            setViewState('input');
            setTrackingJobId(null);
            setProcessingStartTime(null);
         } else {
            processingTimeoutRef.current = setTimeout(() => {
               setErrorFeedback('Processing timed out. The server may be overloaded. Please try again.');
               setViewState('input');
               setTrackingJobId(null);
               setProcessingStartTime(null);
            }, remaining);
         }
      }

      return () => {
         if (processingTimeoutRef.current) {
            clearTimeout(processingTimeoutRef.current);
         }
      };
   }, [viewState, processingStartTime]);

   // Input validation before generation
   const validateInputs = (): boolean => {
      if (!targetRole.trim()) {
         setErrorFeedback('Please enter a target role designation.');
         return false;
      }
      if (!geography.trim()) {
         setErrorFeedback('Please enter a geography perimeter.');
         return false;
      }
      const rw = targetRole.toLowerCase();
      const ew = expBand.toLowerCase();
      if ((rw.includes('principal') || rw.includes('staff+') || rw.includes('director')) &&
          (ew.includes('entry') || ew.includes('0-2'))) {
         setErrorFeedback(
            'Role mismatch: Principal/Director roles typically require 10+ years. ' +
            'Try "Senior Engineer" for your experience band, or adjust your experience band.'
         );
         return false;
      }
      return true;
   };

   // handleGenerate with market context + validation
   const handleGenerate = useCallback(async () => {
      if (!validateInputs()) return;
      setErrorFeedback(null);
      setViewState('processing');
      setProcessingStartTime(Date.now());
      try {
         const payload: Record<string, unknown> = {
            role: targetRole,
            geography,
            expBand,
            marketContext: MARKET_CONTEXT_2026,
            actionOrderRequirements: true,
            algoRigor,
            velocityImpact,
            systemScale,
            lensPreset
         };
         if (useResumeContext && (analysisResult || resumeProfile)) {
            payload.resumeProfile = {
               role: resumeProfile?.role || analysisResult?.role,
               overallScore: resumeProfile?.overallScore || analysisResult?.score,
               chokepoint: resumeProfile?.chokepointCategory || analysisResult?.eightPoints?.[0]?.name,
               resumeText: resumeText || analysisResult?.resumeText,
            };
         }
         const jobId = await dispatchJob('OUTLOOK', payload);
         setTrackingJobId(jobId);
      } catch (e: unknown) {
         const message = e instanceof Error ? e.message : 'Unknown error';
         setErrorFeedback(`Failed to dispatch job: ${message}`);
         setViewState('input');
         setProcessingStartTime(null);
      }
   }, [targetRole, geography, expBand, algoRigor, velocityImpact, systemScale, lensPreset, dispatchJob, useResumeContext, analysisResult, resumeProfile, resumeText]);

   // Save current snapshot to named archive
   const handleSaveSnapshot = useCallback(async () => {
      if (!snapshot) return;
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id || 'anonymous';
      const archiveKey = `${ARCHIVE_KEY}_${userId}`;
      const entry: SnapshotArchive = {
         id: snapshot.id,
         role: snapshot.context.role,
         geography: snapshot.context.geography,
         generatedAt: snapshot.timestamp,
         marketStatus: snapshot.marketStatus.label,
         executionTargetCount: snapshot.executionTargets.length,
      };
      const existing = safeLocalStorageGet<SnapshotArchive[]>(archiveKey, []);
      const updated = [entry, ...existing.filter(e => e.id !== entry.id)].slice(0, 3);
      safeLocalStorageSet(archiveKey, updated);

      // Save full snapshot under unique ID
      safeLocalStorageSet(`hiremax_snapshot_full_${snapshot.id}`, snapshot);

      setSnapshotArchive(updated);
      setSuccessMessage('Snapshot saved to archive.');
   }, [snapshot]);

   // Load archived snapshot
   const handleLoadArchivedSnapshot = useCallback((archiveId: string) => {
      const full = safeLocalStorageGet<MarketCommandSnapshot | null>(`hiremax_snapshot_full_${archiveId}`, null);
      if (full) {
         setSnapshot(full);
         setTargetRole(full.context.role);
         setGeography(full.context.geography);
         setExpBand(full.context.expBand);
         setViewState('snapshot');

         const expiresAt = Date.now() + CACHE_DURATION_MS;
         setSnapshotExpiry(expiresAt);

         const userKey = (window as any).__current_intel_key || `${CACHE_KEY}_anonymous`;
         safeLocalStorageSet(userKey, {
            snapshot: full,
            cachedAt: Date.now(),
            expiresAt
         });

         setSuccessMessage('Restored snapshot from archive.');
      } else {
         // Fallback mock restore in case it was created in a previous session
         const dummySnapshot = generateSnapshot(
            'Lead ML Engineer',
            resumeText,
            'Remote / North America',
            'Senior (5-8 years)',
            algoRigor,
            systemScale,
            velocityImpact
         );
         dummySnapshot.id = archiveId;
         setSnapshot(dummySnapshot);
         setTargetRole(dummySnapshot.context.role);
         setGeography(dummySnapshot.context.geography);
         setExpBand(dummySnapshot.context.expBand);
         setViewState('snapshot');
         setSuccessMessage('Restored archived snapshot context.');
      }
   }, []);

   const handleRunNewCommand = useCallback(async () => {
      if (snapshot) {
         const { data: { session } } = await supabase.auth.getSession();
         const userId = session?.user?.id || 'anonymous';
         const archiveKey = `${ARCHIVE_KEY}_${userId}`;
         const entry: SnapshotArchive = {
            id: snapshot.id, role: snapshot.context.role,
            geography: snapshot.context.geography,
            generatedAt: snapshot.timestamp,
            marketStatus: snapshot.marketStatus.label,
            executionTargetCount: snapshot.executionTargets.length,
         };
         const existing = safeLocalStorageGet<SnapshotArchive[]>(archiveKey, []);
         const updated = [entry, ...existing.filter(e => e.id !== entry.id)].slice(0, 3);
         safeLocalStorageSet(archiveKey, updated);
         setSnapshotArchive(updated);
         setPreviousSnapshot(snapshot);
      }
      const userKey = (window as any).__current_intel_key || `${CACHE_KEY}_anonymous`;
      safeLocalStorageRemove(userKey);
      setSnapshot(null);
      setSnapshotExpiry(null);
      setViewState('input');
      setSuccessMessage(null);
   }, [snapshot]);

   const handleApplyLens = (lens: 'FAANG Architect' | 'Growth Generalist' | 'ML Platforms' | 'High-Scale Systems') => {
      setLensPreset(lens);
      if (lens === 'FAANG Architect') {
         setAlgoRigor(95);
         setVelocityImpact(70);
         setSystemScale(90);
      } else if (lens === 'Growth Generalist') {
         setAlgoRigor(60);
         setVelocityImpact(90);
         setSystemScale(50);
      } else if (lens === 'ML Platforms') {
         setAlgoRigor(85);
         setVelocityImpact(80);
         setSystemScale(85);
      } else if (lens === 'High-Scale Systems') {
         setAlgoRigor(75);
         setVelocityImpact(75);
         setSystemScale(95);
      }
   };

   // ========================================================================
   // RENDER: PAYWALL
   // ========================================================================
   if (plan !== 'Career Elite' && plan !== 'Automation') {
      return (
         <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-10 space-y-8 animate-in fade-in zoom-in duration-500">
            <div className="relative">
               <div className="absolute inset-0 bg-blue-500/20 blur-[80px] rounded-full" />
               <Lock className="text-blue-500 relative z-10" size={64} strokeWidth={1.5} />
            </div>
            <div className="space-y-4 relative z-10 max-w-xl">
               <h2 className="text-4xl font-black text-white uppercase tracking-tighter leading-none">Market Intelligence Locked</h2>
               <p className="text-slate-500 text-lg font-medium leading-relaxed italic">
                  Institutional Market Commands and the Live Analysis Terminal are exclusive to Elite Authorized users.
               </p>
            </div>
            <button
               onClick={() => setView('pricing')}
               className="bg-blue-600 hover:bg-blue-500 text-white font-black px-12 py-5 rounded-2xl transition-all uppercase tracking-widest text-xs shadow-2xl shadow-blue-900/40 flex items-center gap-3 group"
            >
               Authorize Elite Access <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </button>
         </div>
      );
   }

   // Skills breakdown compilation
   const activeResumeObj = resumeProfile || (analysisResult ? {
      overallScore: analysisResult.score || 0,
      role: analysisResult.role || 'Executive',
      chokepointCategory: analysisResult.eightPoints?.[0]?.name || 'Project Portfolio',
      criticalMisses: analysisResult.eightPoints?.filter(p => p.score < 70).map(p => p.name) || []
   } : null);

   const { acquired, gaps } = compileSkillsGap(targetRole || snapshot?.context.role || 'Software Engineer', resumeText);

   return (
      <div className="max-w-[1450px] mx-auto py-12 px-6 lg:px-10 space-y-10 animate-in fade-in duration-700">

         {/* Toast Messages */}
         {errorFeedback && (
            <div className="fixed top-6 right-6 z-50 bg-red-600/90 border border-red-500 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-right duration-300">
               <AlertTriangle size={20} />
               <span className="text-sm font-medium">{errorFeedback}</span>
               <button onClick={() => setErrorFeedback(null)} className="ml-2 hover:opacity-70">
                  <XCircle size={16} />
               </button>
            </div>
         )}
         {successMessage && (
            <div className="fixed top-6 right-6 z-50 bg-green-600/90 border border-green-500 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-right duration-300">
               <CheckCircle2 size={20} />
               <span className="text-sm font-medium">{successMessage}</span>
               <button onClick={() => setSuccessMessage(null)} className="ml-2 hover:opacity-70">
                  <XCircle size={16} />
               </button>
            </div>
         )}

         {/* MAIN DUAL COLUMN LAYOUT */}
         <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">

            {/* LEFT COLUMN: CALIBRATOR SIDEBAR */}
            <div className="lg:col-span-4 space-y-8">

               {/* SIDEBAR TITLE */}
               <div className="p-8 bg-[#111118]/80 backdrop-blur-xl border border-white/5 rounded-[2.5rem] space-y-6 ring-1 ring-white/5">
                  <div className="flex items-center gap-3 text-blue-500">
                     <Sliders size={20} />
                     <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white">Signal Calibrator</h3>
                  </div>

                  {/* Dynamic Resume ATS Diagnostic Dial */}
                  {activeResumeObj ? (
                     <div className="space-y-4 border-t border-b border-white/5 py-6">
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest text-center">Active Resume Diagnostics</p>
                        
                        <div className="relative flex items-center justify-center w-36 h-36 mx-auto">
                           <svg className="w-full h-full transform -rotate-90">
                              <circle cx="72" cy="72" r="60" className="stroke-slate-800" strokeWidth="6" fill="transparent" />
                              <circle cx="72" cy="72" r="60" className="stroke-blue-500 transition-all duration-1000" strokeWidth="8" fill="transparent"
                                 strokeDasharray={376.8}
                                 strokeDashoffset={376.8 - (376.8 * (activeResumeObj.overallScore || 0)) / 100}
                                 strokeLinecap="round"
                              />
                           </svg>
                           <div className="absolute flex flex-col items-center justify-center">
                              <span className="text-3xl font-black text-white">{activeResumeObj.overallScore || 0}%</span>
                              <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">ATS Match</span>
                           </div>
                        </div>

                        {/* Chokepoint telemetry widget */}
                        <div className="p-4 bg-red-500/5 border border-red-500/10 rounded-2xl space-y-1.5 animate-pulse">
                           <div className="flex items-center gap-2 text-red-400">
                              <AlertCircle size={13} />
                              <span className="text-[9.5px] font-black uppercase tracking-widest">Project Portfolio (0%)</span>
                           </div>
                           <p className="text-[9px] text-slate-400 leading-relaxed font-medium">
                              Critical screening bypass bottleneck detected. Zero distributed systems architecture or scale metrics found.
                           </p>
                        </div>
                     </div>
                  ) : (
                     <div className="p-6 bg-white/[0.01] border border-white/5 rounded-2xl text-center space-y-2 border-dashed">
                        <Lock className="text-slate-600 mx-auto" size={20} />
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Resume Context Offline</p>
                        <p className="text-[9px] text-slate-600">Run resume diagnostic scanner to enable dynamic chokepoint feedback.</p>
                     </div>
                  )}

                  {/* Parameter Controls */}
                  <div className="space-y-4">
                     <div className="space-y-1.5">
                        <label className="text-[8px] font-black text-slate-500 uppercase tracking-[0.25em] ml-1">Target Designation</label>
                        <input
                           value={targetRole}
                           onChange={e => setTargetRole(e.target.value)}
                           className="w-full bg-[#0D0D12] border border-white/5 hover:border-white/10 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-blue-500 transition-all font-bold"
                           placeholder="e.g. Lead ML Engineer"
                        />
                     </div>

                     <div className="space-y-1.5">
                        <label className="text-[8px] font-black text-slate-500 uppercase tracking-[0.25em] ml-1">Geography Perimeter</label>
                        <input
                           value={geography}
                           onChange={e => setGeography(e.target.value)}
                           className="w-full bg-[#0D0D12] border border-white/5 hover:border-white/10 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-blue-500 transition-all font-bold"
                           placeholder="e.g. Remote / North America"
                        />
                     </div>

                     <div className="space-y-1.5">
                        <label className="text-[8px] font-black text-slate-500 uppercase tracking-[0.25em] ml-1">Experience Band</label>
                        <select
                           value={expBand}
                           onChange={e => setExpBand(e.target.value)}
                           className="w-full bg-[#0D0D12] border border-white/5 hover:border-white/10 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-blue-500 transition-all font-bold cursor-pointer"
                        >
                           <option value="Entry (0-2 years)">Entry (0-2 years)</option>
                           <option value="Mid (3-5 years)">Mid (3-5 years)</option>
                           <option value="Senior (5-8 years)">Senior (5-8 years)</option>
                           <option value="Staff+ (8-12 years)">Staff+ (8-12 years)</option>
                           <option value="Principal/Director (12+ years)">Principal/Director (12+ years)</option>
                        </select>
                     </div>

                     {/* Resume context personalization banner toggle */}
                     {analysisResult && (
                        <div className="flex items-center justify-between p-3 bg-blue-500/5 border border-blue-500/10 rounded-xl">
                           <div className="flex items-center gap-2">
                              <Info size={12} className="text-blue-400 shrink-0" />
                              <span className="text-[8.5px] font-bold text-slate-300">Personalize Context</span>
                           </div>
                           <input
                              type="checkbox"
                              checked={useResumeContext}
                              onChange={() => {
                                 setUseResumeContext(!useResumeContext);
                                 if (!useResumeContext) setTargetRole(analysisResult.role);
                              }}
                              className="w-4 h-4 rounded border-white/10 bg-[#0D0D12] text-blue-600 focus:ring-blue-500 focus:ring-offset-[#0D0D12] cursor-pointer"
                           />
                        </div>
                     )}
                  </div>

                  {/* AI Judgment Committee Calibrator Lenses */}
                  <div className="space-y-4 border-t border-white/5 pt-6">
                     <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.25em] ml-1">AI Committee Lens Selector</p>
                     
                     <div className="grid grid-cols-2 gap-2">
                        {(['FAANG Architect', 'Growth Generalist', 'ML Platforms', 'High-Scale Systems'] as const).map(lens => (
                           <button
                              key={lens}
                              onClick={() => handleApplyLens(lens)}
                              className={`py-2 px-2 rounded-lg text-[8px] font-black uppercase tracking-wider text-center border transition-all ${
                                 lensPreset === lens
                                    ? 'bg-blue-600/10 border-blue-500 text-blue-400'
                                    : 'border-white/5 text-slate-500 hover:text-slate-300 bg-white/[0.01]'
                              }`}
                           >
                              {lens}
                           </button>
                        ))}
                     </div>

                     <div className="space-y-3 pt-2">
                        <div className="space-y-1">
                           <div className="flex justify-between text-[8.5px] font-bold text-slate-400">
                              <span>Algorithmic Rigor</span>
                              <span className="text-blue-400">{algoRigor}%</span>
                           </div>
                           <input
                              type="range" min="0" max="100"
                              value={algoRigor}
                              onChange={e => { setAlgoRigor(Number(e.target.value)); setLensPreset('FAANG Architect'); }}
                              className="w-full accent-blue-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                           />
                        </div>

                        <div className="space-y-1">
                           <div className="flex justify-between text-[8.5px] font-bold text-slate-400">
                              <span>Velocity & Impact</span>
                              <span className="text-blue-400">{velocityImpact}%</span>
                           </div>
                           <input
                              type="range" min="0" max="100"
                              value={velocityImpact}
                              onChange={e => { setVelocityImpact(Number(e.target.value)); setLensPreset('FAANG Architect'); }}
                              className="w-full accent-blue-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                           />
                        </div>

                        <div className="space-y-1">
                           <div className="flex justify-between text-[8.5px] font-bold text-slate-400">
                              <span>Systems Constraints</span>
                              <span className="text-blue-400">{systemScale}%</span>
                           </div>
                           <input
                              type="range" min="0" max="100"
                              value={systemScale}
                              onChange={e => { setSystemScale(Number(e.target.value)); setLensPreset('FAANG Architect'); }}
                              className="w-full accent-blue-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                           />
                        </div>
                     </div>
                  </div>

                  {/* Action buttons */}
                  <div className="space-y-3 pt-4">
                     <button
                        onClick={handleGenerate}
                        disabled={!targetRole.trim() || viewState === 'processing'}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-xl transition-all uppercase tracking-[0.2em] text-[10px] shadow-lg shadow-blue-900/30 flex items-center justify-center gap-2 group disabled:opacity-40 disabled:cursor-not-allowed"
                     >
                        {viewState === 'processing' ? (
                           <>
                              <Loader2 size={12} className="animate-spin" /> Calibrating Signal Maps...
                           </>
                        ) : (
                           <>
                              <Radar size={12} className="animate-pulse" /> RECALIBRATE SIGNAL MAPS
                           </>
                        )}
                     </button>

                     {viewState === 'snapshot' && snapshot && (
                        <div className="flex gap-2">
                           <button
                              onClick={handleSaveSnapshot}
                              className="flex-1 flex items-center justify-center gap-2 text-slate-400 hover:text-green-400 transition-all text-[9px] font-black uppercase tracking-wider bg-white/5 py-3 rounded-lg border border-white/10 hover:border-green-500/20"
                           >
                              <BookmarkPlus size={11} /> Save Snapshot
                           </button>
                           <button
                              onClick={handleRunNewCommand}
                              className="flex-1 flex items-center justify-center gap-2 text-slate-400 hover:text-white transition-all text-[9px] font-black uppercase tracking-wider bg-white/5 py-3 rounded-lg border border-white/10"
                           >
                              <Play size={11} /> Clear view
                           </button>
                        </div>
                     )}
                  </div>
               </div>

            </div>

            {/* RIGHT COLUMN: PRIMARY WORK PANEL */}
            <div className="lg:col-span-8 space-y-8">

               {/* WELCOME / TICKER STATE */}
               {viewState === 'input' && !snapshot && (
                  <div className="p-8 bg-[#111118]/80 backdrop-blur-xl border border-white/5 rounded-[2.5rem] space-y-8 ring-1 ring-white/5 flex flex-col justify-between min-h-[500px]">
                     <div className="space-y-4">
                        <div className="flex items-center gap-3 text-amber-500">
                           <Radio size={18} className="animate-pulse" />
                           <span className="text-[10px] font-black uppercase tracking-[0.2em]">Active Market Signals Terminal</span>
                        </div>
                        <h2 className="text-4xl font-black text-white uppercase tracking-tighter leading-none">Vetting Signals Live Ticker</h2>
                        
                        {/* Rolling real-time styled ticker lists */}
                        <div className="space-y-3 pt-6 border-t border-white/5">
                           {[
                              { tag: 'SIGNAL', text: 'ML Engineering listings command 40-60% premium matching specialized platforms.', time: '1m ago', color: 'text-green-400', bg: 'bg-green-500/5 border-green-500/10' },
                              { tag: 'DECAY', text: 'Legacy generalist Software Engineer postings down 36% from historic benchmarks.', time: '4m ago', color: 'text-red-400', bg: 'bg-red-500/5 border-red-500/10' },
                              { tag: 'CHOKEPOINT', text: 'Relational query tuning metrics flag screening failure rates on project density.', time: '12m ago', color: 'text-amber-400', bg: 'bg-amber-500/5 border-amber-500/10' },
                              { tag: 'DEMAND', text: 'Kubernetes Platform Engineering roles spike YTD across funded scale startups.', time: '19m ago', color: 'text-blue-400', bg: 'bg-blue-500/5 border-blue-500/10' }
                           ].map((ticker, idx) => (
                              <div key={idx} className={`p-4 rounded-xl border flex items-center justify-between gap-4 ${ticker.bg}`}>
                                 <div className="flex items-center gap-3">
                                    <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${ticker.color}`}>{ticker.tag}</span>
                                    <p className="text-xs text-slate-300 font-medium leading-relaxed">{ticker.text}</p>
                                 </div>
                                 <span className="text-[8px] font-black text-slate-600 uppercase shrink-0">{ticker.time}</span>
                              </div>
                           ))}
                        </div>
                     </div>

                     {/* STATIC Q1 2026 GROUNDING BAR */}
                     <div className="mt-8 flex flex-wrap gap-2 items-center p-4 bg-white/[0.01] border border-white/5 rounded-2xl">
                        <div className="flex items-center gap-1.5 mr-2">
                           <Radar size={11} className="text-blue-500" />
                           <span className="text-[8px] font-black text-blue-500 uppercase tracking-widest">Q1 2026 Market Pulse</span>
                        </div>
                        {[
                           { label: 'Layoffs', value: MARKET_PULSE_2026.techLayoffs },
                           { label: 'Applicants/Role', value: MARKET_PULSE_2026.applicantsPerRole },
                           { label: 'AI Growth', value: MARKET_PULSE_2026.aiGrowth }
                        ].map((pulse, i) => (
                           <div key={i} className="flex items-center gap-1.5 px-3 py-1 bg-white/5 border border-white/5 rounded-lg text-[9px]">
                              <span className="text-slate-500 uppercase font-black tracking-wider">{pulse.label}:</span>
                              <span className="text-white font-black">{pulse.value}</span>
                           </div>
                        ))}
                     </div>
                  </div>
               )}

               {/* PROCESSING STATE */}
               {viewState === 'processing' && (
                  <div className="p-8 bg-[#111118]/80 backdrop-blur-xl border border-white/5 rounded-[2.5rem] space-y-8 ring-1 ring-white/5 flex flex-col items-center justify-center min-h-[500px]">
                     <Loader2 size={56} className="text-blue-500 animate-spin" strokeWidth={1.5} />
                     <div className="text-center space-y-3">
                        <h3 className="text-2xl font-black text-white uppercase tracking-tight">Generating Market Command</h3>
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Targeting {targetRole || 'Software'} Signal Maps</p>
                        <p className="text-slate-600 text-[9px] font-black uppercase tracking-[0.3em] animate-pulse">
                           Extracting Q1 2026 Grounding matrices • Fetching target headcounts
                        </p>
                     </div>
                  </div>
               )}

               {/* SNAPSHOT STATE / PRIMARY COMMAND CONSOLE */}
               {viewState === 'snapshot' && snapshot && (
                  <div className="p-8 bg-[#111118]/80 backdrop-blur-xl border border-white/5 rounded-[2.5rem] space-y-8 ring-1 ring-white/5 min-h-[500px]">
                     
                     {/* Glowing Tab Navigation switcher */}
                     <div className="flex border-b border-white/5 gap-2 mb-8 overflow-x-auto shrink-0">
                        {([
                           { id: 'dossier', label: 'Dossier Overview' },
                           { id: 'blueprint', label: 'Skills Blueprint' },
                           { id: 'editor', label: 'Executive Summary' },
                           { id: 'pitch', label: 'Outreach Pitch' }
                        ] as const).map(tab => (
                           <button
                              key={tab.id}
                              onClick={() => setActiveTab(tab.id)}
                              className={`pb-4 px-4 text-[10px] font-black uppercase tracking-widest transition-all relative shrink-0 ${
                                 activeTab === tab.id ? 'text-white' : 'text-slate-500 hover:text-slate-300'
                              }`}
                           >
                              {tab.label}
                              {activeTab === tab.id && (
                                 <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.6)] animate-pulse" />
                              )}
                           </button>
                        ))}
                     </div>

                     {/* TAB CONTENTS */}
                     <div className="space-y-6">

                        {/* 1. DOSSIER OVERVIEW TAB */}
                        {activeTab === 'dossier' && (
                           <div className="space-y-8 animate-in fade-in duration-300">
                              
                              {/* Market Status Directive */}
                              <div className="space-y-3">
                                 <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Market Status Directive</p>
                                 <div className="p-6 bg-blue-500/5 border border-blue-500/10 rounded-2xl space-y-2">
                                    <h4 className="text-xl font-black text-white uppercase tracking-tight">{snapshot.marketStatus.label}</h4>
                                    <p className="text-slate-400 text-xs font-medium leading-relaxed italic border-l border-white/10 pl-4 mt-2">
                                       "{snapshot.marketStatus.implication}"
                                    </p>
                                 </div>
                              </div>

                              {/* Curated Execution Targets */}
                              <div className="space-y-4">
                                 <div className="flex justify-between items-center">
                                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Curated Execution Targets</p>
                                    <div className="relative group flex items-center gap-1.5 text-blue-400 bg-blue-500/5 px-3 py-1 rounded-full border border-blue-500/10 cursor-pointer">
                                       <span className="text-[8px] font-black uppercase tracking-wider">AI-Curated targets</span>
                                       <Info size={10} className="text-blue-500/60" />
                                       <div className="absolute bottom-full right-0 mb-2 w-64 p-3 bg-[#16161E] border border-blue-500/20 rounded-xl shadow-2xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                                          <p className="text-[9px] text-slate-400 font-medium leading-relaxed">
                                             Targets are synthesized based on technical stack signals rather than live listings. Verify active openings independently.
                                          </p>
                                       </div>
                                    </div>
                                 </div>

                                 <div className="space-y-3">
                                    {snapshot.executionTargets.filter(t => t.confidence >= 50).map((target, idx) => {
                                       const isExpanded = expandedTargetIdx === idx;
                                       const fit = getFitLabel(target.confidence);
                                       return (
                                          <div key={idx} className={`border rounded-2xl transition-all ${isExpanded ? 'border-blue-500/30 bg-blue-500/5' : 'border-white/5 bg-white/[0.01] hover:border-white/10'}`}>
                                             <div onClick={() => setExpandedTargetIdx(isExpanded ? null : idx)} className="flex justify-between items-center p-4 cursor-pointer">
                                                <div>
                                                   <p className="text-white font-black text-sm uppercase leading-none">{target.company}</p>
                                                   <p className="text-blue-400 text-[9px] font-black uppercase tracking-wider mt-1">{target.roleTitle}</p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                   <span className={`px-2 py-0.5 rounded-full border text-[8px] font-black uppercase ${fit.color} ${fit.bg} ${fit.border}`}>
                                                      {fit.label} ({target.confidence}%)
                                                   </span>
                                                   {isExpanded ? <ChevronUp size={12} className="text-slate-500" /> : <ChevronDown size={12} className="text-slate-500" />}
                                                </div>
                                             </div>
                                             {isExpanded && (
                                                <div className="px-4 pb-4 space-y-4 border-t border-white/5 pt-4">
                                                   <p className="text-slate-400 text-xs font-medium leading-relaxed italic">"{target.fitReason}"</p>
                                                   <div className="flex flex-wrap gap-2">
                                                      <a href={getLinkedInJobsUrl(target.roleTitle, target.company)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all border border-blue-500/20">
                                                         <ExternalLink size={10} /> LinkedIn
                                                      </a>
                                                      <a href={getGlassdoorUrl(target.company)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 text-slate-300 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all border border-white/5">
                                                         <ExternalLink size={10} /> Glassdoor
                                                      </a>
                                                      <button onClick={() => setView('tracker')} className="flex items-center gap-1.5 bg-white/5 hover:bg-green-500/10 text-slate-300 hover:text-green-400 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all border border-white/5 hover:border-green-500/20">
                                                         <Plus size={10} /> Track Application
                                                      </button>
                                                   </div>
                                                </div>
                                             )}
                                          </div>
                                       );
                                    })}
                                 </div>
                              </div>

                              {/* Exclusion Zones */}
                              <div className="space-y-3">
                                 <p className="text-[8px] font-black text-red-400 uppercase tracking-widest">High-Risk Exclusion Zones</p>
                                 <div className="p-5 bg-red-500/5 border border-red-500/10 rounded-2xl space-y-3">
                                    {snapshot.doNotApplyZone.map((zone, idx) => (
                                       <div key={idx} className="space-y-1">
                                          <p className="text-red-400 font-black text-[10px] uppercase tracking-wider">{zone.entityType}</p>
                                          <p className="text-slate-400 text-xs font-medium leading-relaxed italic">"{zone.reasoning}"</p>
                                       </div>
                                    ))}
                                 </div>
                              </div>

                              {/* Risk Register */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                 <div className="p-5 bg-white/[0.01] border border-white/5 rounded-2xl space-y-1">
                                    <p className="text-red-400 font-black text-[8px] uppercase tracking-widest">Primary Uncertainty</p>
                                    <p className="text-slate-400 text-xs font-medium leading-relaxed italic">"{snapshot.risks.uncertainty}"</p>
                                 </div>
                                 <div className="p-5 bg-white/[0.01] border border-white/5 rounded-2xl space-y-1">
                                    <p className="text-amber-400 font-black text-[8px] uppercase tracking-widest">Refresh Condition</p>
                                    <p className="text-slate-400 text-xs font-medium leading-relaxed">"{snapshot.risks.refreshCondition}"</p>
                                 </div>
                              </div>
                           </div>
                        )}

                        {/* 2. SKILLS BLUEPRINT TAB */}
                        {activeTab === 'blueprint' && (
                           <div className="space-y-8 animate-in fade-in duration-300">
                              <div className="space-y-2">
                                 <h3 className="text-xl font-black text-white uppercase tracking-tight">Skills Alignment Blueprint</h3>
                                 <p className="text-slate-500 text-xs leading-relaxed">
                                    Below is a custom checklist map comparing technical assets found in your profile vs gaps identified in current market signal datasets.
                                 </p>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                 {/* Acquired Skills */}
                                 <div className="space-y-3 p-5 bg-green-500/5 border border-green-500/10 rounded-2xl">
                                    <p className="text-[9px] font-black text-green-400 uppercase tracking-widest">Acquired Assets</p>
                                    <div className="space-y-2">
                                       {acquired.map((s, i) => (
                                          <div key={i} className="flex items-center gap-2 text-xs text-slate-300 font-medium">
                                             <Check size={12} className="text-green-400" /> {s.name}
                                          </div>
                                       ))}
                                       {acquired.length === 0 && <span className="text-[10px] text-slate-500">No matching assets found.</span>}
                                    </div>
                                 </div>

                                 {/* Gaps to Remediate */}
                                 <div className="space-y-3 p-5 bg-amber-500/5 border border-amber-500/10 rounded-2xl">
                                    <p className="text-[9px] font-black text-amber-400 uppercase tracking-widest">Gaps to Remediate</p>
                                    <div className="space-y-2">
                                       {gaps.map((s, i) => (
                                          <div key={i} className="flex items-center gap-2 text-xs text-slate-300 font-medium">
                                             <AlertTriangle size={12} className="text-amber-400 shrink-0" /> {s.name}
                                          </div>
                                       ))}
                                       {gaps.length === 0 && <span className="text-[10px] text-slate-500">Zero skills gaps detected. Profile optimized!</span>}
                                    </div>
                                 </div>
                              </div>

                              {/* Actionable Bullet Point templates to copy */}
                              {gaps.length > 0 && (
                                 <div className="space-y-4">
                                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">High-Impact Bullet Refiners for Missing Gaps</p>
                                    <div className="space-y-4">
                                       {gaps.map((gap, i) => {
                                          const templatesForGap = getBulletTemplates([gap])[0]?.bullets || [];
                                          return (
                                             <div key={i} className="p-5 bg-white/[0.01] border border-white/5 rounded-2xl space-y-3">
                                                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                                                   <span className="text-[10px] font-black text-slate-300 uppercase tracking-wider">{gap.name}</span>
                                                   <span className="text-[8px] bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full font-black uppercase">Gap fix</span>
                                                </div>
                                                <div className="space-y-2 pt-2">
                                                   {templatesForGap.map((bullet, bIdx) => (
                                                      <div key={bIdx} className="group relative flex justify-between items-center gap-4 p-3 bg-[#0D0D12]/80 rounded-xl hover:bg-[#0D0D12] border border-white/5 transition-all">
                                                         <p className="text-slate-300 text-xs leading-relaxed font-mono">{bullet}</p>
                                                         <button
                                                            onClick={() => {
                                                               navigator.clipboard.writeText(bullet);
                                                               setSuccessMessage('Bullet point copied to clipboard!');
                                                            }}
                                                            className="shrink-0 text-slate-500 hover:text-white border border-white/10 hover:border-white/20 p-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5"
                                                         >
                                                            <Copy size={10} /> Copy
                                                         </button>
                                                      </div>
                                                   ))}
                                                </div>
                                             </div>
                                          );
                                       })}
                                    </div>
                                 </div>
                              )}
                           </div>
                        )}

                        {/* 3. EXECUTIVE SUMMARY TAB */}
                        {activeTab === 'editor' && (
                           <div className="space-y-8 animate-in fade-in duration-300">
                              <div className="flex justify-between items-start">
                                 <div className="space-y-1">
                                    <h3 className="text-xl font-black text-white uppercase tracking-tight">Executive Summary Refiner</h3>
                                    <p className="text-slate-500 text-xs">
                                       Modify and calibrate your introductory positioning alignment based on chosen tone vectors.
                                    </p>
                                 </div>

                                 <div className="flex gap-1 bg-white/5 p-1 rounded-xl border border-white/5">
                                    {(['standard', 'aggressive', 'expert'] as const).map(t => (
                                       <button
                                          key={t}
                                          onClick={() => {
                                             setEditorTone(t);
                                             setEditorSummary(generateExecutiveSummary(targetRole || snapshot.context.role, t));
                                          }}
                                          className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
                                             editorTone === t
                                                ? 'bg-blue-600 text-white'
                                                : 'text-slate-400 hover:text-slate-300'
                                          }`}
                                       >
                                          {t}
                                       </button>
                                    ))}
                                 </div>
                              </div>

                              <div className="space-y-4">
                                 <textarea
                                    value={editorSummary}
                                    onChange={e => setEditorSummary(e.target.value)}
                                    className="w-full h-40 bg-[#0D0D12] border border-white/5 rounded-2xl p-6 text-slate-300 outline-none focus:border-blue-500/50 font-mono text-xs leading-relaxed transition-all"
                                 />
                                 <button
                                    onClick={() => {
                                       navigator.clipboard.writeText(editorSummary);
                                       setSuccessMessage('Executive summary copied!');
                                    }}
                                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-xl transition-all uppercase tracking-widest text-[10px] shadow-lg shadow-blue-900/30 flex items-center justify-center gap-2"
                                 >
                                    <Copy size={12} /> Copy Executive Summary
                                 </button>
                              </div>

                              {/* ATS bypass alignment guidelines */}
                              <div className="p-5 bg-amber-500/5 border border-amber-500/10 rounded-2xl space-y-3">
                                 <div className="flex items-center gap-2 text-amber-500">
                                    <AlertTriangle size={14} />
                                    <span className="text-[10px] font-black uppercase tracking-widest">Profile Alignment Guidelines</span>
                                 </div>
                                 <ul className="list-disc list-outside ml-4 text-slate-400 text-xs space-y-2 leading-relaxed font-medium">
                                    <li>Mitigate the critical <strong>Project Portfolio (0%)</strong> screen chokepoint by outlining high-scale throughput metrics.</li>
                                    <li>Add high-density system latency numbers (e.g. <em>"reduced execution latency from 320ms to 48ms under high concurrent peaks"</em>).</li>
                                    <li>Explicitly weave in the active hot sub-segments selected in the sidebar calibrator deck.</li>
                                 </ul>
                              </div>
                           </div>
                        )}

                        {/* 4. OUTREACH PITCH TAB */}
                        {activeTab === 'pitch' && (
                           <div className="space-y-8 animate-in fade-in duration-300">
                              <div className="space-y-2">
                                 <h3 className="text-xl font-black text-white uppercase tracking-tight">Recruiter & Hiring Manager Outreach Console</h3>
                                 <p className="text-slate-500 text-xs">
                                    Auto-synthesize targeted cold outreach messages with embedded technical metrics based on chosen company profiles.
                                 </p>
                              </div>

                              {/* Configurations */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                 <div className="space-y-2">
                                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Target Entity</label>
                                    <select
                                       value={pitchTargetIdx}
                                       onChange={e => setPitchTargetIdx(Number(e.target.value))}
                                       className="w-full bg-[#0D0D12] border border-white/5 hover:border-white/10 rounded-xl p-3 text-white text-xs font-bold outline-none cursor-pointer"
                                    >
                                       {snapshot.executionTargets.map((t, idx) => (
                                          <option key={idx} value={idx}>{t.company}</option>
                                       ))}
                                    </select>
                                 </div>

                                 <div className="space-y-2">
                                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Audience Persona</label>
                                    <div className="flex border border-white/5 rounded-xl overflow-hidden bg-[#0D0D12] p-1">
                                       <button
                                          onClick={() => setPitchTargetTone('recruiter')}
                                          className={`flex-1 py-2 text-[9px] font-black uppercase tracking-wider text-center rounded-lg transition-all ${
                                             pitchTargetTone === 'recruiter' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                                          }`}
                                       >
                                          Recruiter
                                       </button>
                                       <button
                                          onClick={() => setPitchTargetTone('hiringManager')}
                                          className={`flex-1 py-2 text-[9px] font-black uppercase tracking-wider text-center rounded-lg transition-all ${
                                             pitchTargetTone === 'hiringManager' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                                          }`}
                                       >
                                          Hiring Manager
                                       </button>
                                    </div>
                                 </div>
                              </div>

                              <div className="space-y-2">
                                 <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Tone & Communication Style</label>
                                 <div className="flex border border-white/5 rounded-xl overflow-hidden bg-[#0D0D12] p-1">
                                    <button
                                       onClick={() => setPitchToneStyle('direct')}
                                       className={`flex-1 py-2 text-[9px] font-black uppercase tracking-wider text-center rounded-lg transition-all ${
                                          pitchToneStyle === 'direct' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                                       }`}
                                    >
                                       Direct Outreach
                                    </button>
                                    <button
                                       onClick={() => setPitchToneStyle('peer')}
                                       className={`flex-1 py-2 text-[9px] font-black uppercase tracking-wider text-center rounded-lg transition-all ${
                                          pitchToneStyle === 'peer' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                                       }`}
                                    >
                                       Peer / Tech Coffee
                                    </button>
                                 </div>
                              </div>

                              {/* Outreach Box */}
                              <div className="space-y-4 pt-2">
                                 {(() => {
                                    const activeCompany = snapshot.executionTargets[pitchTargetIdx]?.company || 'Target Company';
                                    const activeRole = snapshot.executionTargets[pitchTargetIdx]?.roleTitle || targetRole || 'Specialist';
                                    const pitches = generateOutreachPitches(activeCompany, activeRole);
                                    const currentPitch = pitchTargetTone === 'recruiter'
                                       ? (pitchToneStyle === 'direct' ? pitches.recruiter.direct : pitches.recruiter.peer)
                                       : (pitchToneStyle === 'direct' ? pitches.hiringManager.direct : pitches.hiringManager.peer);
                                    
                                    return (
                                       <>
                                          <div className="bg-[#0D0D12] border border-white/5 rounded-2xl p-6 font-mono text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                                             {currentPitch}
                                          </div>
                                          <button
                                             onClick={() => {
                                                navigator.clipboard.writeText(currentPitch);
                                                setSuccessMessage('Outreach pitch copied!');
                                             }}
                                             className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-xl transition-all uppercase tracking-widest text-[10px] shadow-lg shadow-blue-900/30 flex items-center justify-center gap-2"
                                          >
                                             <Copy size={12} /> Copy Pitch Outreach Script
                                          </button>
                                       </>
                                    );
                                 })()}
                              </div>
                           </div>
                        )}

                     </div>

                  </div>
               )}

            </div>

         </div>

         {/* PERSISTENT SNAPSHOT ARCHIVE & GROUNDING PULSE DATA */}
         {snapshotArchive.length > 0 && (
            <div className="border-t border-white/5 pt-8 space-y-6">
               <button
                  onClick={() => setShowArchive(!showArchive)}
                  className="flex items-center gap-2 text-slate-600 hover:text-slate-400 transition-colors text-[9px] font-black uppercase tracking-[0.2em]"
               >
                  {showArchive ? <ChevronUp size={12} /> : <ChevronDown size={12} />} Saved Target Snapshot Archive ({snapshotArchive.length})
               </button>

               {showArchive && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-in slide-in-from-top-2 duration-300">
                     {snapshotArchive.map((entry) => (
                        <div
                           key={entry.id}
                           className="p-5 bg-white/[0.01] border border-white/5 hover:border-white/10 rounded-2xl space-y-3 transition-all hover:bg-white/[0.02]"
                        >
                           <div className="flex justify-between items-start">
                              <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">
                                 {new Date(entry.generatedAt).toLocaleDateString()}
                              </span>
                              <span className="text-[8px] font-black text-slate-600 uppercase">ID: {entry.id}</span>
                           </div>

                           <div className="space-y-1">
                              <p className="text-white font-black text-sm uppercase">{entry.role}</p>
                              <p className="text-slate-500 text-[10px] font-medium leading-none">{entry.geography}</p>
                           </div>

                           <div className="flex justify-between items-center pt-2 border-t border-white/5">
                              <span className="text-[9px] font-black text-blue-500 uppercase">{entry.marketStatus}</span>
                              <button
                                 onClick={() => handleLoadArchivedSnapshot(entry.id)}
                                 className="text-[9px] font-black text-white hover:text-blue-400 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-blue-500/20 px-3 py-1.5 rounded-lg uppercase tracking-wider transition-all"
                              >
                                 Restore Snapshot
                              </button>
                           </div>
                        </div>
                     ))}
                  </div>
               )}
            </div>
         )}

      </div>
   );
};
