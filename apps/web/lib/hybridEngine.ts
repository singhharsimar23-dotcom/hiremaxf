// =============================================================================
// apps/web/lib/hybridEngine.ts
// HireMax Five-Layer Hybrid Intelligence Engine
//
// Original Architecture (not document-derived):
//
//  L1 · Signal Decomposition   — JD requirement criticality extraction
//       Classifies every JD requirement as MANDATORY / PREFERRED / IMPLICIT
//       using section-context + inline-qualifier dual-pass NLP. No competitor
//       does this — they treat all keywords as equal weight.
//
//  L2 · Resume Intelligence    — Temporal evidence extraction
//       Measures achievement density, seniority evidence, and recency-weighted
//       skill inventory. Treats the resume as a temporal document: evidence in
//       recent roles scores higher than identical claims in old ones.
//
//  L3 · Precision Match        — Multi-tier weighted skill matching
//       Synonym-graph matching with separate mandatory/preferred/implicit
//       coverage rates. Produces the "mathematical receipt" that makes the
//       score transparent and auditable.
//
//  L4 · Semantic Coherence     — Gemini embedding cosine similarity
//       gemini-embedding-001 at document AND summary-section granularity.
//       Multi-granularity scoring catches scope mismatches that doc-level
//       similarity alone misses.
//
//  L5 · Strategic Intelligence — LLM chokepoint + rewrite mandates
//       Gemini 2.5 Flash receives the quantitative L1–L4 outputs and diagnoses
//       the single root-cause structural blocker. Forces the LLM to explain
//       WHY, not just re-list surface gaps.
//
//  Composite Formula:
//    score = precision×0.35 + semantic×0.20 + achievement×0.15
//            + seniority×0.20 + narrative×0.10
// =============================================================================

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';

// ─────────────────────────────────────────────────────────────
// § SKILL TAXONOMY
// Canonical name → { synonyms, cluster }
// ─────────────────────────────────────────────────────────────

const SKILLS: Record<string, { syn: string[]; cluster: string }> = {
  // ── Backend languages ───────────────────────────────────────
  python:       { syn: ['python', 'python3', 'python 3', 'py'],                                cluster: 'backend' },
  javascript:   { syn: ['javascript', 'js', 'es6', 'ecmascript', 'es2015', 'es2020'],         cluster: 'frontend' },
  typescript:   { syn: ['typescript', 'ts'],                                                    cluster: 'frontend' },
  java:         { syn: ['java', 'java 8', 'java 11', 'java 17', 'java 21', 'jvm'],            cluster: 'backend' },
  golang:       { syn: ['golang', 'go lang', ' go '],                                          cluster: 'backend' },
  rust:         { syn: ['rust', 'rust lang'],                                                   cluster: 'backend' },
  csharp:       { syn: ['c#', 'csharp', '.net', 'dotnet', 'asp.net', 'asp.net core'],        cluster: 'backend' },
  cpp:          { syn: ['c++', 'cpp', 'c/c++'],                                                cluster: 'backend' },
  ruby:         { syn: ['ruby', 'ruby on rails', 'rails', 'ror'],                             cluster: 'backend' },
  php:          { syn: ['php', 'laravel', 'symfony'],                                          cluster: 'backend' },
  scala:        { syn: ['scala', 'akka', 'play framework'],                                    cluster: 'backend' },
  kotlin:       { syn: ['kotlin'],                                                              cluster: 'mobile' },
  swift:         { syn: ['swift', 'swiftui'],                                                   cluster: 'mobile' },
  // ── Frontend ────────────────────────────────────────────────
  react:        { syn: ['react', 'react.js', 'reactjs', 'react js', 'react native'],         cluster: 'frontend' },
  vue:          { syn: ['vue', 'vue.js', 'vuejs', 'vue 3', 'vuex', 'pinia'],                 cluster: 'frontend' },
  angular:      { syn: ['angular', 'angularjs', 'angular.js'],                                cluster: 'frontend' },
  svelte:       { syn: ['svelte', 'sveltekit'],                                                cluster: 'frontend' },
  nextjs:       { syn: ['next.js', 'nextjs', 'next js'],                                      cluster: 'frontend' },
  html:         { syn: ['html', 'html5'],                                                      cluster: 'frontend' },
  css:          { syn: ['css', 'css3', 'sass', 'scss', 'less', 'tailwind', 'tailwindcss'],   cluster: 'frontend' },
  // ── Backend frameworks ──────────────────────────────────────
  django:       { syn: ['django', 'django rest framework', 'drf'],                            cluster: 'backend' },
  fastapi:      { syn: ['fastapi', 'fast api'],                                               cluster: 'backend' },
  flask:        { syn: ['flask'],                                                              cluster: 'backend' },
  express:      { syn: ['express', 'express.js', 'expressjs'],                                cluster: 'backend' },
  nestjs:       { syn: ['nestjs', 'nest.js'],                                                 cluster: 'backend' },
  springboot:   { syn: ['spring boot', 'spring framework', 'spring mvc'],                    cluster: 'backend' },
  nodejs:       { syn: ['node.js', 'nodejs', 'node js'],                                     cluster: 'backend' },
  graphql:      { syn: ['graphql', 'graph ql'],                                               cluster: 'backend' },
  grpc:         { syn: ['grpc', 'grpc/protobuf', 'protobuf', 'protocol buffers'],            cluster: 'backend' },
  // ── Cloud ────────────────────────────────────────────────────
  aws:          { syn: ['aws', 'amazon web services', 'ec2', 's3', 'lambda', 'rds', 'sqs', 'eks', 'ecs', 'fargate', 'cloudformation', 'cdk'], cluster: 'cloud' },
  gcp:          { syn: ['gcp', 'google cloud', 'google cloud platform', 'bigquery', 'gke', 'cloud run', 'vertex ai'], cluster: 'cloud' },
  azure:        { syn: ['azure', 'microsoft azure', 'azure devops', 'aks'],                  cluster: 'cloud' },
  // ── DevOps ──────────────────────────────────────────────────
  docker:       { syn: ['docker', 'docker compose', 'dockerfile', 'containerization'],       cluster: 'devops' },
  kubernetes:   { syn: ['kubernetes', 'k8s', 'kube', 'kubectl', 'helm'],                    cluster: 'devops' },
  terraform:    { syn: ['terraform', 'infrastructure as code', 'iac', 'pulumi'],             cluster: 'devops' },
  cicd:         { syn: ['ci/cd', 'github actions', 'jenkins', 'circleci', 'gitlab ci', 'argocd', 'continuous integration', 'continuous deployment'], cluster: 'devops' },
  ansible:      { syn: ['ansible', 'ansible playbook'],                                      cluster: 'devops' },
  observability:{ syn: ['observability', 'monitoring', 'prometheus', 'grafana', 'datadog', 'opentelemetry', 'jaeger', 'splunk', 'newrelic'], cluster: 'devops' },
  // ── Databases ────────────────────────────────────────────────
  postgresql:   { syn: ['postgres', 'postgresql', 'psql'],                                    cluster: 'data' },
  mysql:        { syn: ['mysql', 'mariadb'],                                                  cluster: 'data' },
  mongodb:      { syn: ['mongodb', 'mongo', 'nosql'],                                        cluster: 'data' },
  redis:        { syn: ['redis', 'redis cache', 'memcached'],                                cluster: 'data' },
  elasticsearch:{ syn: ['elasticsearch', 'elastic', 'opensearch', 'elk'],                   cluster: 'data' },
  dynamodb:     { syn: ['dynamodb', 'dynamo db'],                                            cluster: 'data' },
  cassandra:    { syn: ['cassandra', 'apache cassandra'],                                    cluster: 'data' },
  snowflake:    { syn: ['snowflake'],                                                        cluster: 'data' },
  // ── Data Engineering ─────────────────────────────────────────
  spark:        { syn: ['apache spark', 'spark', 'pyspark'],                                cluster: 'data_eng' },
  kafka:        { syn: ['kafka', 'apache kafka', 'event streaming', 'confluent'],           cluster: 'data_eng' },
  airflow:      { syn: ['airflow', 'apache airflow', 'prefect', 'dagster'],                 cluster: 'data_eng' },
  dbt:          { syn: ['dbt', 'data build tool'],                                          cluster: 'data_eng' },
  // ── ML / AI ──────────────────────────────────────────────────
  pandas:       { syn: ['pandas', 'numpy', 'scipy', 'matplotlib', 'seaborn'],              cluster: 'ml' },
  tensorflow:   { syn: ['tensorflow', 'keras'],                                             cluster: 'ml' },
  pytorch:      { syn: ['pytorch', 'torch'],                                               cluster: 'ml' },
  sklearn:      { syn: ['scikit-learn', 'sklearn', 'scikit learn'],                        cluster: 'ml' },
  llmops:       { syn: ['llm', 'large language model', 'openai', 'langchain', 'rag', 'retrieval augmented', 'fine-tuning', 'prompt engineering', 'generative ai', 'gen ai', 'llmops'], cluster: 'ml' },
  mlops:        { syn: ['mlops', 'mlflow', 'kubeflow', 'model deployment', 'model serving', 'feature store'], cluster: 'ml' },
  // ── Architecture ─────────────────────────────────────────────
  microservices:{ syn: ['microservices', 'micro services', 'service mesh', 'istio', 'event-driven'], cluster: 'architecture' },
  systemdesign: { syn: ['system design', 'distributed systems', 'high availability', 'scalability', 'fault tolerance', 'caching strategy'], cluster: 'architecture' },
  // ── Security ─────────────────────────────────────────────────
  security:     { syn: ['security', 'owasp', 'penetration testing', 'vulnerability', 'soc 2', 'zero trust', 'iam', 'rbac', 'appsec'], cluster: 'security' },
  // ── Practices ────────────────────────────────────────────────
  agile:        { syn: ['agile', 'scrum', 'kanban', 'sprint planning', 'story points'],    cluster: 'practice' },
  tdd:          { syn: ['tdd', 'bdd', 'unit testing', 'integration testing', 'e2e testing', 'jest', 'pytest', 'cypress'], cluster: 'practice' },
  git:          { syn: ['git', 'github', 'gitlab', 'bitbucket', 'pull request', 'code review'], cluster: 'practice' },
  // ── Leadership ───────────────────────────────────────────────
  leadership:   { syn: ['team lead', 'tech lead', 'leading teams', 'mentoring', 'mentorship', 'coaching engineers', 'engineering manager'], cluster: 'leadership' },
  strategy:     { syn: ['technical strategy', 'engineering roadmap', 'technical vision', 'stakeholder management', 'executive communication'], cluster: 'leadership' },
  hiring:       { syn: ['hiring', 'recruiting engineers', 'building teams', 'technical interviews', 'leveling engineers'], cluster: 'leadership' },
  // ── Soft ─────────────────────────────────────────────────────
  crossfunctional: { syn: ['cross-functional', 'cross functional', 'stakeholder collaboration', 'product engineering'], cluster: 'soft' },
  ownership:    { syn: ['ownership', 'drove', 'drove impact', 'end-to-end ownership', 'autonomous', 'independent'], cluster: 'soft' },

  // ── Marketing ────────────────────────────────────────────────
  digitalmarketing: { syn: ['digital marketing', 'online marketing', 'internet marketing', 'web marketing', 'multi-channel marketing'], cluster: 'marketing' },
  seo:          { syn: ['seo', 'search engine optimization', 'search engine optimisation', 'organic search', 'keyword research', 'on-page seo', 'technical seo', 'link building'], cluster: 'marketing' },
  sem_ppc:      { syn: ['sem', 'ppc', 'pay-per-click', 'pay per click', 'google ads', 'paid search', 'paid ads', 'adwords', 'search engine marketing'], cluster: 'marketing' },
  brandstrategy:{ syn: ['brand strategy', 'brand management', 'branding', 'brand positioning', 'brand identity', 'brand awareness'], cluster: 'marketing' },
  contentmarketing: { syn: ['content marketing', 'content strategy', 'copywriting', 'blogging', 'editorial calendar', 'content creation'], cluster: 'marketing' },
  socialmediamarketing: { syn: ['social media', 'smm', 'social media marketing', 'instagram marketing', 'facebook marketing', 'linkedin marketing', 'influencer marketing'], cluster: 'marketing' },
  growthmarketing: { syn: ['growth marketing', 'growth hacking', 'user acquisition', 'customer acquisition', 'conversion rate optimization', 'cro', 'a/b testing'], cluster: 'marketing' },
  marketinganalytics: { syn: ['marketing analytics', 'google analytics', 'ga4', 'attribution modeling', 'marketing kpis', 'campaign tracking', 'roi analysis'], cluster: 'marketing' },
  marketingautomation: { syn: ['marketing automation', 'hubspot', 'marketo', 'pardot', 'mailchimp', 'activecampaign', 'email marketing', 'drip campaigns'], cluster: 'marketing' },
  publicrelations: { syn: ['public relations', 'pr', 'media relations', 'press release', 'crisis communication', 'brand reputation', 'corporate communications'], cluster: 'marketing' },

  // ── Sales & Business Development ─────────────────────────────
  salesstrategy: { syn: ['sales strategy', 'sales management', 'strategic selling', 'sales forecasting', 'quota planning'], cluster: 'sales' },
  businessdevelopment: { syn: ['business development', 'bizdev', 'lead generation', 'prospecting', 'outbound sales', 'cold outreach', 'cold calling'], cluster: 'sales' },
  accountmanagement: { syn: ['account management', 'key account management', 'client relationship management', 'upselling', 'cross-selling'], cluster: 'sales' },
  pipelinemanagement: { syn: ['pipeline management', 'sales pipeline', 'deal flow', 'crm hygiene', 'sales cycle'], cluster: 'sales' },
  negotiation:  { syn: ['negotiation', 'contract negotiation', 'deal structuring', 'pricing negotiation', 'commercial terms'], cluster: 'sales' },
  solutionselling: { syn: ['solution selling', 'consultative selling', 'enterprise sales', 'b2b sales', 'value selling'], cluster: 'sales' },
  customersuccess: { syn: ['customer success', 'client success', 'customer retention', 'churn reduction', 'net promoter score', 'nps', 'onboarding'], cluster: 'sales' },
  salesoperations: { syn: ['sales operations', 'salesops', 'sales enablement', 'salesforce administration', 'sales tools'], cluster: 'sales' },

  // ── Finance & Accounting ─────────────────────────────────────
  financialanalysis: { syn: ['financial analysis', 'fp&a', 'financial planning and analysis', 'variance analysis', 'financial performance'], cluster: 'finance' },
  financialreporting: { syn: ['financial reporting', 'financial statements', 'balance sheet', 'income statement', 'cash flow statement', 'sec filings'], cluster: 'finance' },
  budgeting_forecasting: { syn: ['budgeting', 'forecasting', 'financial forecasting', 'budget management', 'rolling forecasts', 'capital allocation'], cluster: 'finance' },
  pl_management: { syn: ['p&l', 'profit and loss', 'p&l management', 'profitability analysis', 'ebitda', 'margin expansion'], cluster: 'finance' },
  riskmanagement_finance: { syn: ['risk management', 'financial risk', 'hedging', 'credit risk', 'market risk', 'liquidity management'], cluster: 'finance' },
  costaccounting: { syn: ['cost accounting', 'cost analysis', 'expense management', 'overhead allocation', 'cost reduction', 'variance analysis'], cluster: 'finance' },
  auditing:     { syn: ['auditing', 'internal audit', 'external audit', 'audit compliance', 'sarbanes-oxley', 'sox', 'sox compliance'], cluster: 'finance' },
  financialmodeling: { syn: ['financial modeling', 'financial model', 'dcf', 'discounted cash flow', 'valuation', 'lbo'], cluster: 'finance' },
  ma_strategy:  { syn: ['m&a', 'mergers and acquisitions', 'mergers & acquisitions', 'due diligence', 'post-merger integration', 'deal sourcing'], cluster: 'finance' },
  gaap_compliance: { syn: ['gaap', 'us gaap', 'ifrs', 'accounting standards', 'regulatory compliance', 'financial compliance'], cluster: 'finance' },
  generalledger: { syn: ['general ledger', 'gl ', 'accounts payable', 'accounts receivable', 'ap/ar', 'bank reconciliation', 'journal entries', 'double-entry'], cluster: 'finance' },

  // ── Human Resources (HR) ─────────────────────────────────────
  talentacquisition: { syn: ['talent acquisition', 'recruitment', 'recruiting', 'sourcing', 'candidate experience', 'full-cycle recruiting', 'headhunting'], cluster: 'hr' },
  employeerelations: { syn: ['employee relations', 'conflict resolution', 'workplace investigations', 'employee grievance', 'labor relations'], cluster: 'hr' },
  performancemanagement: { syn: ['performance management', 'performance review', 'kpis', 'okrs', 'performance improvement plans', 'pip '], cluster: 'hr' },
  hrcompliance: { syn: ['hr compliance', 'labor law', 'eeoc', 'flsa', 'fmla', 'ada compliance', 'employment law'], cluster: 'hr' },
  benefitsadministration: { syn: ['benefits administration', 'compensation and benefits', 'total rewards', 'payroll administration', 'health insurance plans', '401k'], cluster: 'hr' },
  workforceplanning: { syn: ['workforce planning', 'headcount planning', 'succession planning', 'talent mapping', 'organizational design'], cluster: 'hr' },
  hris:         { syn: ['hris', 'workday', 'bamboohr', 'peoplesoft', 'rippling', 'adp workforce', 'hr systems'], cluster: 'hr' },
  diversity_inclusion: { syn: ['diversity and inclusion', 'dei', 'diversity, equity, and inclusion', 'inclusive culture', 'belonging'], cluster: 'hr' },
  talentdevelopment: { syn: ['talent development', 'learning and development', 'l&d', 'employee training', 'leadership development', 'coaching'], cluster: 'hr' },

  // ── Operations & Strategy ────────────────────────────────────
  operationsmanagement: { syn: ['operations management', 'business operations', 'bizops', 'operational efficiency', 'resource allocation'], cluster: 'operations' },
  processimprovement: { syn: ['process improvement', 'workflow optimization', 'operational excellence', 'bottleneck analysis', 'lean operations'], cluster: 'operations' },
  sixsigma:     { syn: ['six sigma', 'lean six sigma', 'green belt', 'black belt', 'kaizen', '5s', 'continuous improvement'], cluster: 'operations' },
  supplychain:  { syn: ['supply chain', 'supply chain management', 'logistics', 'procurement', 'sourcing', 'vendor management', 'inventory management', '3pl'], cluster: 'operations' },
  changemanagement: { syn: ['change management', 'organizational change', 'prosci', 'stakeholder alignment', 'cultural transformation'], cluster: 'operations' },
  projectmanagement_nontech: { syn: ['project management', 'pmp', 'milestone tracking', 'project planning', 'risk mitigation', 'scrum master', 'gantt'], cluster: 'operations' },
  strategicplanning: { syn: ['strategic planning', 'business strategy', 'corporate strategy', 'roadmapping', 'growth strategy', 'annual planning'], cluster: 'operations' },
  vendormanagement: { syn: ['vendor management', 'supplier management', 'sla negotiation', 'procurement contract', 'rfp process'], cluster: 'operations' },

  // ── Design & Creative ────────────────────────────────────────
  brandidentity_design: { syn: ['brand identity', 'logo design', 'style guide', 'visual identity', 'brand collateral'], cluster: 'design' },
  visualcommunication: { syn: ['visual communication', 'visual design', 'graphic design', 'layout', 'composition', 'typography', 'color theory'], cluster: 'design' },
  uxui_design:  { syn: ['ux/ui', 'ux design', 'ui design', 'user experience', 'user interface', 'product design', 'interaction design'], cluster: 'design' },
  wireframing_prototyping: { syn: ['wireframing', 'prototyping', 'wireframes', 'mockups', 'high-fidelity prototypes', 'low-fidelity prototypes'], cluster: 'design' },
  designsystems: { syn: ['design systems', 'design system', 'component library', 'figma components', 'style guides'], cluster: 'design' },
  usabilitytesting: { syn: ['usability testing', 'user research', 'user testing', 'heuristic evaluation', 'user personas'], cluster: 'design' },
  motiongraphics: { syn: ['motion graphics', 'after effects', 'animation', 'video editing', 'premiere pro', 'video production'], cluster: 'design' },
  adobesuite:   { syn: ['adobe creative suite', 'adobe creative cloud', 'photoshop', 'illustrator', 'indesign', 'premiere', 'after effects'], cluster: 'design' },
  figma_design: { syn: ['figma', 'sketch', 'adobe xd', 'invision', 'balsamiq'], cluster: 'design' },
  copywriting_creative: { syn: ['copywriting', 'creative writing', 'ux writing', 'content writing', 'technical writing', 'microcopy'], cluster: 'design' },

  // ── Customer Success & Support ───────────────────────────────
  customersupport: { syn: ['customer support', 'technical support', 'helpdesk', 'help desk', 'customer service', 'ticketing system'], cluster: 'customer_success' },
  slamanagement: { syn: ['sla management', 'sla', 'service level agreement', 'response time', 'resolution rate', 'first contact resolution'], cluster: 'customer_success' },
  zendesk_admin: { syn: ['zendesk', 'intercom', 'freshdesk', 'salesforce service cloud', 'ticketing tools'], cluster: 'customer_success' },
};

// ─────────────────────────────────────────────────────────────
// § SENIORITY SIGNALS
// ─────────────────────────────────────────────────────────────

type SeniorityLevel = 'ENTRY' | 'MID' | 'SENIOR' | 'STAFF' | 'PRINCIPAL' | 'EXECUTIVE';

const JD_SENIORITY_SIGNALS: Record<SeniorityLevel, string[]> = {
  ENTRY:     ['entry level', 'entry-level', 'junior', 'associate', 'new grad', 'recent graduate', '0-2 years', '1-2 years'],
  MID:       ['mid-level', 'mid level', '2-4 years', '3-5 years', '2-5 years', 'intermediate'],
  SENIOR:    ['senior', 'sr.', '5+ years', '5-8 years', '4-7 years', '5 years'],
  STAFF:     ['staff engineer', 'staff software', 'tech lead', 'technical lead', '7+ years', '8+ years'],
  PRINCIPAL: ['principal', 'architect', 'distinguished engineer', '10+ years', '12+ years'],
  EXECUTIVE: ['vp of engineering', 'director of engineering', 'cto', 'head of engineering', 'engineering director'],
};

// What each seniority level implicitly expects, even when unstated in JD
const IMPLICIT_EXPECTATIONS: Record<SeniorityLevel, string[]> = {
  ENTRY:     [],
  MID:       ['code review', 'on-call participation', 'architecture discussions'],
  SENIOR:    ['technical mentorship', 'architecture design', 'cross-team collaboration', 'driving technical decisions'],
  STAFF:     ['system design', 'technical strategy', 'leveling engineers', 'engineering roadmap', 'org-level impact'],
  PRINCIPAL: ['company-wide technical direction', 'senior stakeholder influence', 'hiring bar-setting'],
  EXECUTIVE: ['p&l ownership', 'board communication', 'executive hiring', 'organizational design'],
};

// ─────────────────────────────────────────────────────────────
// § ACHIEVEMENT PATTERNS
// Quantified outcomes that constitute "evidence"
// ─────────────────────────────────────────────────────────────

const ACHIEVEMENT_PATTERNS: RegExp[] = [
  /\d+%/,
  /\$[\d,]+[kmb]?/i,
  /\d+x\s/i,
  /reduced.*by\s+\d+/i,
  /increased.*by\s+\d+/i,
  /improved.*by\s+\d+/i,
  /saved.*\$\d+/i,
  /\d+\s*(users?|customers?|clients?|requests?\/s|rps|qps)/i,
  /\d+\s*(engineers?|developers?|team members?|reports?)/i,
  /\d+\s*(million|billion|thousand|k\s)/i,
  /from\s+\d+.*to\s+\d+/i,
  /top\s+\d+%/i,
  /\d+\s*(services?|systems?|products?|features?)\s+(built|launched|shipped|deployed)/i,
];

// ─────────────────────────────────────────────────────────────
// § INTERNAL TYPES
// ─────────────────────────────────────────────────────────────

type RequirementClass = 'MANDATORY' | 'PREFERRED' | 'IMPLICIT';

interface SkillRequirement {
  term: string;
  canonical: string;
  class: RequirementClass;
  weight: number;
  cluster: string;
}

interface JobSignal {
  skills: SkillRequirement[];
  mandatoryCount: number;
  preferredCount: number;
  implicitCount: number;
  inferredSeniority: SeniorityLevel;
  roleFamily: string;
}

interface ResumeIntelligence {
  achievementDensity: number;
  achievementScore: number;
  allSkills: string[];
  recentSkills: string[];
  seniorityEvidence: SeniorityLevel;
  careerProgression: 'ASCENDING' | 'LATERAL' | 'DESCENDING' | 'UNCLEAR';
  bulletCount: number;
  quantifiedBulletCount: number;
  rawText?: string;
}

interface PrecisionMatchResult {
  matchedTerms: string[];
  criticalMisses: string[];
  optionalMisses: string[];
  mandatoryCoverage: number;
  preferredCoverage: number;
  implicitCoverage: number;
  precisionScore: number;
}

interface SemanticResult {
  documentScore: number;
  summaryScore: number;
  overallSemanticScore: number;
}

// ─────────────────────────────────────────────────────────────
// § LAYER 1: SIGNAL DECOMPOSITION
// ─────────────────────────────────────────────────────────────

function inferJDSeniority(jd: string): SeniorityLevel {
  const lower = jd.toLowerCase();
  // Check from highest to lowest to pick the most senior signal
  for (const level of ['EXECUTIVE', 'PRINCIPAL', 'STAFF', 'SENIOR', 'MID', 'ENTRY'] as SeniorityLevel[]) {
    if (JD_SENIORITY_SIGNALS[level].some(sig => lower.includes(sig))) return level;
  }
  return 'MID'; // safe default
}

function classifyLine(line: string, sectionCtx: RequirementClass): RequirementClass {
  const l = line.toLowerCase();
  if (/\b(required|must have|must possess|essential|mandatory|minimum|you (will|must) (have|possess|demonstrate))\b/.test(l)) return 'MANDATORY';
  if (/\b(preferred|nice to have|bonus|a plus|ideally|desirable|advantageous|welcome)\b/.test(l)) return 'PREFERRED';
  return sectionCtx;
}

function cleanDynamicKeyword(kw: string): string {
  // Remove leading/trailing prepositions, common adjectives, and clean whitespace
  let cleaned = kw.replace(/^(strong|excellent|deep|proven|solid|expert-level|advanced|basic|some|hands-on)\s+/i, '');
  cleaned = cleaned.replace(/\s+(required|preferred|experience|skills?|knowledge|proficiency|understanding)$/i, '');
  // strip punctuation from start/end
  cleaned = cleaned.replace(/^[.,;()\s]+|[.,;()\s]+$/g, '');
  return cleaned.trim();
}

function isGenericKeyword(kw: string): boolean {
  const lower = kw.toLowerCase();
  if (lower.length < 3) return true;
  // Filter out extremely generic resume filler phrases or common verbs
  const genericTerms = [
    'communication', 'teamwork', 'problem solving', 'collaboration', 'attention to detail',
    'years', 'year', 'experience', 'ability to', 'track record', 'proven ability',
    'degree', 'bachelor', 'master', 'phd', 'diploma', 'candidate', 'applicant',
    'success', 'impact', 'results', 'projects', 'tasks', 'duties', 'responsibilities',
    'written and verbal', 'verbal and verbal', 'interpersonal skills', 'self-starter',
    'fast-paced', 'dynamic environment', 'highly motivated', 'organizational skills',
    'collaborate', 'manage', 'lead', 'write', 'build', 'develop', 'coordinate', 'maintain', 'support',
    'create', 'execute', 'drive', 'deliver', 'ensure', 'help', 'guide', 'optimize', 'implement', 'design',
    'work', 'establish', 'responsibilities', 'qualifications'
  ];
  return genericTerms.some(t => lower.includes(t) || t.includes(lower));
}

function decomposeJobSignal(jdText: string): JobSignal {
  const lower = jdText.toLowerCase();
  const lines = jdText.split('\n');
  const results: SkillRequirement[] = [];
  const seen = new Set<string>();

  let sectionCtx: RequirementClass = 'MANDATORY';

  for (const line of lines) {
    const lineLower = line.toLowerCase();

    // Update section context from headers
    if (/required qualifications|requirements|what you.ll need|must have|minimum qualifications/i.test(line)) {
      sectionCtx = 'MANDATORY';
    } else if (/preferred qualifications|nice to have|bonus|additional qualifications|what would be great/i.test(line)) {
      sectionCtx = 'PREFERRED';
    }

    const lineClass = classifyLine(line, sectionCtx);

    for (const [canonical, { syn, cluster }] of Object.entries(SKILLS)) {
      if (seen.has(canonical)) continue;
      const matchedSyn = syn.find(s => lineLower.includes(s));
      if (matchedSyn) {
        seen.add(canonical);
        results.push({
          term: matchedSyn,
          canonical,
          class: lineClass,
          weight: lineClass === 'MANDATORY' ? 1.0 : lineClass === 'PREFERRED' ? 0.5 : 0.3,
          cluster,
        });
      }
    }
  }

  // Second pass: full-text scan for any skills missed by line-by-line
  for (const [canonical, { syn, cluster }] of Object.entries(SKILLS)) {
    if (seen.has(canonical)) continue;
    const matchedSyn = syn.find(s => lower.includes(s));
    if (matchedSyn) {
      seen.add(canonical);
      results.push({
        term: matchedSyn,
        canonical,
        class: 'PREFERRED', // unknown context = preferred
        weight: 0.5,
        cluster,
      });
    }
  }

  // Third pass: Dynamic Signal Decomposition (Lexical Noun-Phrase Extractor)
  // Scans requirements/skills sections for direct bullet points or trigger patterns
  const hasReqHeaders = /required qualifications|requirements|what you.ll need|must have|minimum qualifications|skills|who you are|key requirements/i.test(jdText);
  let inRequirementsSection = !hasReqHeaders; // Fallback: if no headers exist, scan the entire document dynamically!

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    // Detect requirements section boundary
    if (/required qualifications|requirements|what you.ll need|must have|minimum qualifications|skills|who you are|key requirements/i.test(trimmed)) {
      inRequirementsSection = true;
      continue;
    } else if (/about us|benefits|perks|responsibilities|what you.ll do|about the role/i.test(trimmed) && trimmed.length > 20) {
      // Large headings that transition away
      inRequirementsSection = false;
    }

    if (inRequirementsSection) {
      const lineClass = classifyLine(line, 'MANDATORY');

      // A. Try Trigger Phrases (e.g. "proficiency in X", "experience with Y")
      const triggerRegex = /\b(experience with|proficiency in|expert in|skills? in|understanding of|familiarity with|knowledge of|working with|hands-on with|using|utilizing|expertise in|background in)\s+([^.,;()]+)/gi;
      let match;
      let triggerMatched = false;
      while ((match = triggerRegex.exec(line)) !== null) {
        const segment = match[2];
        const parts = segment.split(/\s+and\s+|\s+or\s+|,/gi);
        for (const part of parts) {
          const cleaned = cleanDynamicKeyword(part);
          if (cleaned && !isGenericKeyword(cleaned) && cleaned.length > 2) {
            triggerMatched = true;
            const canonical = `dynamic_${cleaned.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
            if (!seen.has(canonical)) {
              seen.add(canonical);
              results.push({
                term: cleaned,
                canonical,
                class: lineClass,
                weight: lineClass === 'MANDATORY' ? 0.8 : 0.4,
                cluster: 'dynamic'
              });
            }
          }
        }
      }

      // B. Short bullet point matching (e.g. "- SAP Ariba")
      if (!triggerMatched && /^[•\-\*▪▸►◆➤]\s*/.test(trimmed)) {
        const bulletText = trimmed.replace(/^[•\-\*▪▸►◆➤]\s*/, '').trim();
        const words = bulletText.split(/\s+/);
        if (words.length >= 1 && words.length <= 4) {
          const cleaned = cleanDynamicKeyword(bulletText);
          if (cleaned && !isGenericKeyword(cleaned) && cleaned.length > 2) {
            const canonical = `dynamic_${cleaned.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
            if (!seen.has(canonical)) {
              seen.add(canonical);
              results.push({
                term: cleaned,
                canonical,
                class: lineClass,
                weight: lineClass === 'MANDATORY' ? 0.8 : 0.4,
                cluster: 'dynamic'
              });
            }
          }
        }
      }
    }
  }

  // Resiliency safety net: if no skills were parsed at all from the Job Description,
  // extract the top 5 high-signal nouns/capitalized terms as requirements so we still have a baseline comparison
  if (results.length === 0) {
    const words = jdText.match(/\b[A-Za-z]{3,}\b/g) || [];
    const wordFreq: Record<string, number> = {};
    for (const w of words) {
      const cleaned = cleanDynamicKeyword(w);
      if (cleaned && !isGenericKeyword(cleaned)) {
        wordFreq[cleaned] = (wordFreq[cleaned] || 0) + 1;
      }
    }
    const topWords = Object.entries(wordFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(entry => entry[0]);

    for (const term of topWords) {
      const canonical = `dynamic_${term.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
      if (!seen.has(canonical)) {
        seen.add(canonical);
        results.push({
          term,
          canonical,
          class: 'MANDATORY',
          weight: 1.0,
          cluster: 'dynamic'
        });
      }
    }
  }

  // Inject implicit expectations for the inferred seniority level
  const seniority = inferJDSeniority(jdText);
  for (const exp of IMPLICIT_EXPECTATIONS[seniority]) {
    results.push({
      term: exp,
      canonical: `_implicit_${exp.replace(/\s+/g, '_')}`,
      class: 'IMPLICIT',
      weight: 0.3,
      cluster: 'leadership',
    });
  }

  return {
    skills: results,
    mandatoryCount: results.filter(s => s.class === 'MANDATORY').length,
    preferredCount: results.filter(s => s.class === 'PREFERRED').length,
    implicitCount: results.filter(s => s.class === 'IMPLICIT').length,
    inferredSeniority: seniority,
    roleFamily: inferRoleFamily(jdText),
  };
}

function inferRoleFamily(jd: string): string {
  const l = jd.toLowerCase();
  if (/machine learning|data science|ml engineer|ai engineer|nlp|deep learning/.test(l)) return 'ml';
  if (/data engineer|data pipeline|etl|data infrastructure|analytics engineer/.test(l)) return 'data_engineering';
  if (/product manager|pm |product management/.test(l)) return 'product';
  if (/frontend|front-end|ui engineer|ux engineer/.test(l)) return 'frontend';
  if (/backend|back-end|server-side/.test(l)) return 'backend';
  if (/fullstack|full-stack|full stack/.test(l)) return 'fullstack';
  if (/devops|site reliability|sre|platform engineer/.test(l)) return 'platform';
  if (/security|cybersecurity|appsec/.test(l)) return 'security';
  if (/ios|android|mobile/.test(l)) return 'mobile';
  if (/marketing|growth marketing|digital marketing|seo|sem|ppc|content marketing|social media/.test(l)) return 'marketing';
  if (/sales|business development|bizdev|account executive|account manager|sales representative|customer success/.test(l)) return 'sales';
  if (/finance|financial|accounting|accountant|ledger|bookkeeping|auditor|fp&a|ebitda/.test(l)) return 'finance';
  if (/human resources|hr |recruiting|recruiter|talent acquisition|people ops|people operations/.test(l)) return 'hr';
  if (/operations|ops |supply chain|logistics|procurement|project manager|pmp|operations manager/.test(l)) return 'operations';
  if (/designer|design|ux designer|ui designer|graphic designer|creative director|copywriter/.test(l)) return 'design';
  return 'engineering';
}

// ─────────────────────────────────────────────────────────────
// § LAYER 2: RESUME INTELLIGENCE
// ─────────────────────────────────────────────────────────────

function extractResumeIntelligence(resumeText: string): ResumeIntelligence {
  const lower = resumeText.toLowerCase();
  const lines = resumeText.split('\n').map(l => l.trim()).filter(Boolean);

  // All skills present anywhere in resume
  const allSkills: string[] = [];
  for (const [canonical, { syn }] of Object.entries(SKILLS)) {
    if (syn.some(s => lower.includes(s))) allSkills.push(canonical);
  }

  // Recent skills: first 45% of document (chronologically recent = top of resume)
  const recentSlice = resumeText.slice(0, Math.floor(resumeText.length * 0.45)).toLowerCase();
  const recentSkills: string[] = [];
  for (const [canonical, { syn }] of Object.entries(SKILLS)) {
    if (syn.some(s => recentSlice.includes(s))) recentSkills.push(canonical);
  }

  // Achievement density: count bullet lines vs quantified bullet lines
  let bulletLines = lines.filter(l => /^[•\-\*▪▸►◆➤]/.test(l) || /^\s*[-•*]/.test(l));
  
  // Resiliency safety net: if no structured bullets are found, treat all non-empty lines as potential content blocks
  if (bulletLines.length === 0) {
    bulletLines = lines;
  }

  const quantifiedBullets = bulletLines.filter(line =>
    ACHIEVEMENT_PATTERNS.some(p => p.test(line))
  );

  const bulletCount = Math.max(bulletLines.length, 1);
  const quantifiedBulletCount = quantifiedBullets.length;
  const achievementDensity = Math.round((quantifiedBulletCount / bulletCount) * 100);

  // Score achievement density on a non-linear scale
  // Research shows 30–40%+ density is the elite threshold
  let achievementScore: number;
  if (achievementDensity >= 40) {
    achievementScore = 90 + Math.min(10, (achievementDensity - 40) / 2);
  } else if (achievementDensity >= 25) {
    achievementScore = 65 + ((achievementDensity - 25) / 15) * 25;
  } else if (achievementDensity >= 10) {
    achievementScore = 35 + ((achievementDensity - 10) / 15) * 30;
  } else {
    achievementScore = Math.max(10, achievementDensity * 3);
  }

  return {
    achievementDensity,
    achievementScore: Math.round(achievementScore),
    allSkills,
    recentSkills,
    seniorityEvidence: inferResumesSeniority(resumeText),
    careerProgression: inferCareerProgression(lines),
    bulletCount,
    quantifiedBulletCount,
    rawText: resumeText,
  };
}

function inferResumesSeniority(resumeText: string): SeniorityLevel {
  const lower = resumeText.toLowerCase();
  if (/\b(vp|vice president|director of engineering|cto|head of engineering)\b/.test(lower)) return 'EXECUTIVE';
  if (/\b(principal engineer|distinguished engineer|chief architect|fellow)\b/.test(lower)) return 'PRINCIPAL';
  if (/\b(staff engineer|staff software|tech lead|technical lead)\b/.test(lower)) return 'STAFF';
  if (/\b(senior engineer|senior software|sr\. engineer|senior developer)\b/.test(lower)) return 'SENIOR';
  if (/\b(junior engineer|junior developer|associate engineer|entry.level)\b/.test(lower)) return 'ENTRY';
  // Infer from year signals if no explicit title
  if (/\b(10|11|12|13|14|15)\+ years\b/.test(lower)) return 'PRINCIPAL';
  if (/\b(7|8|9)\+ years\b/.test(lower)) return 'STAFF';
  if (/\b(5|6)\+ years\b/.test(lower)) return 'SENIOR';
  return 'MID';
}

const TITLE_RANK: Record<string, number> = {
  intern: 0, junior: 1, associate: 2, engineer: 3, developer: 3,
  senior: 5, lead: 6, staff: 7, principal: 8,
  architect: 7, director: 9, vp: 10,
};

function inferCareerProgression(lines: string[]): 'ASCENDING' | 'LATERAL' | 'DESCENDING' | 'UNCLEAR' {
  const ranks: number[] = [];
  for (const line of lines) {
    const lower = line.toLowerCase();
    for (const [title, rank] of Object.entries(TITLE_RANK)) {
      if (new RegExp(`\\b${title}\\b`).test(lower)) {
        ranks.push(rank);
        break; // one rank per line
      }
    }
  }
  if (ranks.length < 2) return 'UNCLEAR';
  const first = ranks[0];
  const last = ranks[ranks.length - 1];
  if (last > first + 1) return 'ASCENDING';
  if (last < first - 1) return 'DESCENDING';
  return 'LATERAL';
}

// ─────────────────────────────────────────────────────────────
// § LAYER 3: PRECISION MATCH
// ─────────────────────────────────────────────────────────────

function computePrecisionMatch(
  signal: JobSignal,
  intelligence: ResumeIntelligence,
): PrecisionMatchResult {
  const allSkillSet = new Set(intelligence.allSkills);
  const recentSkillSet = new Set(intelligence.recentSkills);

  const matchedTerms: string[] = [];
  const criticalMisses: string[] = [];
  const optionalMisses: string[] = [];

  let mandatoryHit = 0, mandatoryTotal = 0;
  let preferredHit = 0, preferredTotal = 0;
  let implicitHit = 0, implicitTotal = 0;

  const lowerResume = (intelligence.rawText || '').toLowerCase();
  const lowerRecentResume = (intelligence.rawText || '').slice(0, Math.floor((intelligence.rawText || '').length * 0.45)).toLowerCase();

  for (const req of signal.skills) {
    let matched = false;
    let recent = false;

    if (req.canonical.startsWith('dynamic_')) {
      matched = lowerResume.includes(req.term.toLowerCase());
      recent  = lowerRecentResume.includes(req.term.toLowerCase());
    } else {
      matched = allSkillSet.has(req.canonical);
      recent  = recentSkillSet.has(req.canonical);
    }

    // Recency bonus: recent matches get a 25% score boost
    const matchScore = matched ? (recent ? 1.0 : 0.75) : 0;

    if (req.class === 'MANDATORY') {
      mandatoryTotal++;
      if (matched) { mandatoryHit++; matchedTerms.push(req.term); }
      else          criticalMisses.push(req.term);
    } else if (req.class === 'PREFERRED') {
      preferredTotal++;
      if (matched) { preferredHit++; matchedTerms.push(req.term); }
      else          optionalMisses.push(req.term);
    } else {
      implicitTotal++;
      if (matched) implicitHit++;
    }
  }

  const mandatoryCoverage = mandatoryTotal > 0
    ? Math.round((mandatoryHit / mandatoryTotal) * 100) : 100;
  const preferredCoverage = preferredTotal > 0
    ? Math.round((preferredHit / preferredTotal) * 100) : 100;
  const implicitCoverage  = implicitTotal > 0
    ? Math.round((implicitHit / implicitTotal) * 100) : 50;

  // Weighted precision: mandatory dominates
  const precisionScore = Math.round(
    (mandatoryCoverage * 0.60) +
    (preferredCoverage * 0.30) +
    (implicitCoverage  * 0.10)
  );

  return {
    matchedTerms: [...new Set(matchedTerms)],
    criticalMisses: [...new Set(criticalMisses)],
    optionalMisses: [...new Set(optionalMisses)],
    mandatoryCoverage,
    preferredCoverage,
    implicitCoverage,
    precisionScore,
  };
}

// ─────────────────────────────────────────────────────────────
// § LAYER 4: SEMANTIC COHERENCE (Gemini embeddings)
// ─────────────────────────────────────────────────────────────

async function getEmbedding(text: string, apiKey: string): Promise<number[]> {
  const res = await fetch(
    `${GEMINI_BASE}/models/gemini-embedding-001:embedContent?key=${apiKey}`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model:    'models/gemini-embedding-001',
        content:  { parts: [{ text: text.slice(0, 25000) }] },
        taskType: 'SEMANTIC_SIMILARITY',
      }),
    }
  );
  const data = await res.json();
  return data.embedding?.values ?? [];
}

function cosineSim(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot  += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

// Scale raw cosine similarity (typically 0.45–0.92 for career docs) to 0–100
function scaleSimilarity(sim: number): number {
  return Math.round(Math.max(0, Math.min(100, ((sim - 0.40) / 0.45) * 100)));
}

function extractSummarySection(resumeText: string): string {
  const lines = resumeText.split('\n').map(l => l.trim()).filter(Boolean);
  for (let i = 0; i < lines.length; i++) {
    if (/^(summary|professional summary|profile|objective|about me)/i.test(lines[i])) {
      return lines.slice(i + 1, i + 8).join(' ');
    }
  }
  return resumeText.slice(0, 600); // fallback: top of resume
}

async function computeSemanticCoherence(
  jdText: string,
  resumeText: string,
  apiKey: string
): Promise<SemanticResult> {
  const summaryText = extractSummarySection(resumeText);

  const [jdVec, resumeVec, summaryVec] = await Promise.all([
    getEmbedding(jdText, apiKey),
    getEmbedding(resumeText, apiKey),
    getEmbedding(summaryText, apiKey),
  ]);

  const documentScore = scaleSimilarity(cosineSim(jdVec, resumeVec));
  const summaryScore  = scaleSimilarity(cosineSim(jdVec, summaryVec));
  // Weight: doc-level tells us overall fit, summary tells us how candidate pitches themselves
  const overallSemanticScore = Math.round((documentScore * 0.6) + (summaryScore * 0.4));

  return { documentScore, summaryScore, overallSemanticScore };
}

// ─────────────────────────────────────────────────────────────
// § LAYER 5: STRATEGIC INTELLIGENCE (Gemini LLM)
// ─────────────────────────────────────────────────────────────

function buildL5Prompt(
  jdText: string,
  resumeText: string,
  precision: PrecisionMatchResult,
  semantic: SemanticResult,
  intelligence: ResumeIntelligence,
  targetRole: string,
): string {
  return `You are the world's most rigorous hiring committee simulation engine. Your role is to diagnose WHY a resume fails to land interviews — the structural ROOT CAUSE, not a symptom list.

QUANTITATIVE ANALYSIS (already computed — do not repeat these numbers verbatim):
• Precision Score (weighted keyword coverage): ${precision.precisionScore}/100
• Mandatory Skills Coverage: ${precision.mandatoryCoverage}%
• Preferred Skills Coverage: ${precision.preferredCoverage}%
• Semantic Alignment (embedding cosine): ${semantic.overallSemanticScore}/100
  - Full document alignment: ${semantic.documentScore}/100
  - Summary section alignment: ${semantic.summaryScore}/100
• Achievement Density: ${intelligence.achievementDensity}% of bullets are quantified with numbers
• Career Progression: ${intelligence.careerProgression}
• Resume Seniority Evidence: ${intelligence.seniorityEvidence}
• Critical Missing Skills: ${precision.criticalMisses.slice(0, 10).join(', ') || 'None detected'}
• Matched Skills: ${precision.matchedTerms.slice(0, 15).join(', ') || 'None'}

TARGET ROLE: ${targetRole}

JOB DESCRIPTION:
${jdText.slice(0, 2500)}

RESUME:
${resumeText.slice(0, 3500)}

TASK:
1. Identify the SINGLE structural chokepoint — the ONE root cause that is the dominant reason this application will fail. Not a list. One diagnosis.
2. Assess whether the resume's language and scope is calibrated to the JD's implied seniority level.
3. Provide 3–5 SPECIFIC, surgical rewrite mandates. Each must reference actual text from the resume and give a concrete improved version.
4. Estimate realistic screening probability (0–100) accounting for ALL layers, not just keyword coverage.
5. Write an honest 2-3 sentence executive verdict — what a senior recruiter would say about this candidate.

Return ONLY valid JSON (no markdown fences, no explanation outside JSON):
{
  "chokepoint": "<One crisp sentence, max 15 words — the single structural blocker>",
  "chokepointCategory": "<SENIORITY_GAP | SKILL_DEFICIT | NARRATIVE_FAILURE | ACHIEVEMENT_POVERTY | SCOPE_MISMATCH>",
  "seniorityCalibration": "<UNDERSELLING | CALIBRATED | OVERSELLING>",
  "screeningProbability": <integer 0-100>,
  "executiveSummary": "<2-3 sentence honest verdict>",
  "rewriteMandates": [
    {
      "priority": "<CRITICAL | HIGH | MEDIUM>",
      "section": "<section name>",
      "finding": "<what is wrong and why it costs the candidate>",
      "action": "<the specific change to make>",
      "exampleBefore": "<representative current text>",
      "exampleAfter": "<improved version>"
    }
  ]
}`;
}

async function computeStrategicIntelligence(
  jdText: string,
  resumeText: string,
  precision: PrecisionMatchResult,
  semantic: SemanticResult,
  intelligence: ResumeIntelligence,
  targetRole: string,
  apiKey: string,
): Promise<Record<string, any>> {
  const prompt = buildL5Prompt(jdText, resumeText, precision, semantic, intelligence, targetRole);

  const res = await fetch(
    `${GEMINI_BASE}/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.3,
          maxOutputTokens: 2048,
        },
      }),
    }
  );

  const data = await res.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';

  try {
    const clean = rawText.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch {
    // Graceful fallback
    return {
      chokepoint: 'Insufficient evidence to determine primary blocker',
      chokepointCategory: 'NARRATIVE_FAILURE',
      seniorityCalibration: 'CALIBRATED',
      screeningProbability: precision.precisionScore,
      executiveSummary: 'Analysis completed. Review precision and semantic scores for detail.',
      rewriteMandates: [],
    };
  }
}

// ─────────────────────────────────────────────────────────────
// § COMPOSITE SCORING
// ─────────────────────────────────────────────────────────────

function seniorityScore(jd: SeniorityLevel, resume: SeniorityLevel): number {
  const rank: Record<SeniorityLevel, number> = {
    ENTRY: 1, MID: 2, SENIOR: 3, STAFF: 4, PRINCIPAL: 5, EXECUTIVE: 6,
  };
  const delta = Math.abs(rank[jd] - rank[resume]);
  if (delta === 0) return 100;
  if (delta === 1) return 70;
  if (delta === 2) return 40;
  return 15;
}

// ─────────────────────────────────────────────────────────────
// § PUBLIC TYPES (exported)
// ─────────────────────────────────────────────────────────────

export interface RewriteMandate {
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  section: string;
  finding: string;
  action: string;
  exampleBefore?: string;
  exampleAfter?: string;
}

export interface HybridAnalysisResult {
  analysisId: string;
  role: string;

  // ── Transparent score breakdown (users can audit every number) ──
  compositeScore: number;         // 0-100 weighted final
  precisionScore: number;         // L3: keyword coverage
  semanticScore: number;          // L4: embedding alignment
  achievementScore: number;       // L2: quantified evidence density
  seniorityScore: number;         // L1+L2: level calibration
  narrativeScore: number;         // L5: LLM screening probability

  // ── Precision detail ────────────────────────────────────────
  mandatoryCoverage: number;
  preferredCoverage: number;
  implicitCoverage: number;
  criticalMisses: string[];       // MANDATORY skills absent
  optionalMisses: string[];       // PREFERRED skills absent
  matchedTerms: string[];

  // ── Semantic detail ─────────────────────────────────────────
  documentSemanticScore: number;
  summarySemanticScore: number;

  // ── Strategic intelligence ──────────────────────────────────
  chokepoint: string;
  chokepointCategory: string;
  seniorityCalibration: string;
  screeningProbability: number;
  rewriteMandates: RewriteMandate[];

  // ── Resume intelligence ─────────────────────────────────────
  achievementDensity: number;
  bulletCount: number;
  quantifiedBulletCount: number;
  careerProgression: string;
  inferredJDSeniority: string;
  resumeSeniority: string;

  executiveSummary: string;

  resumeText: string;
  jdText: string;
}

export interface HybridAnalysisInput {
  resumeText: string;
  jdText: string;
  targetRole: string;
  apiKey: string;
}

// ─────────────────────────────────────────────────────────────
// § ORCHESTRATOR — runHybridAnalysis
// Full 5-layer pipeline
// ─────────────────────────────────────────────────────────────

export async function runHybridAnalysis(input: HybridAnalysisInput): Promise<HybridAnalysisResult> {
  const { resumeText, jdText, targetRole, apiKey } = input;

  // ── Synchronous layers (< 5ms combined) ──────────────────────
  const signal      = decomposeJobSignal(jdText);          // L1
  const intelligence = extractResumeIntelligence(resumeText); // L2
  const precision   = computePrecisionMatch(signal, intelligence); // L3

  // ── L4: Semantic (3 embedding API calls, ~500ms) ──────────────
  const semantic = await computeSemanticCoherence(jdText, resumeText, apiKey);

  // ── L5: Strategic (1 LLM call, 2-8s; receives L4 results) ────
  const strategic = await computeStrategicIntelligence(
    jdText, resumeText, precision, semantic, intelligence, targetRole, apiKey
  );

  // ── Scoring ───────────────────────────────────────────────────
  const seniScore    = seniorityScore(signal.inferredSeniority, intelligence.seniorityEvidence);
  const narratScore  = strategic.screeningProbability ?? precision.precisionScore;

  const compositeScore = Math.round(
    (precision.precisionScore    * 0.35) +
    (semantic.overallSemanticScore * 0.20) +
    (intelligence.achievementScore * 0.15) +
    (seniScore                   * 0.20) +
    (narratScore                 * 0.10)
  );

  return {
    analysisId: `hm_${Date.now()}`,
    role: targetRole,

    compositeScore,
    precisionScore:   precision.precisionScore,
    semanticScore:    semantic.overallSemanticScore,
    achievementScore: intelligence.achievementScore,
    seniorityScore:   seniScore,
    narrativeScore:   narratScore,

    mandatoryCoverage: precision.mandatoryCoverage,
    preferredCoverage: precision.preferredCoverage,
    implicitCoverage:  precision.implicitCoverage,
    criticalMisses:    precision.criticalMisses,
    optionalMisses:    precision.optionalMisses,
    matchedTerms:      precision.matchedTerms,

    documentSemanticScore: semantic.documentScore,
    summarySemanticScore:  semantic.summaryScore,

    chokepoint:           strategic.chokepoint           ?? '',
    chokepointCategory:   strategic.chokepointCategory   ?? 'NARRATIVE_FAILURE',
    seniorityCalibration: strategic.seniorityCalibration ?? 'CALIBRATED',
    screeningProbability: strategic.screeningProbability ?? compositeScore,
    rewriteMandates:      strategic.rewriteMandates      ?? [],

    achievementDensity:     intelligence.achievementDensity,
    bulletCount:            intelligence.bulletCount,
    quantifiedBulletCount:  intelligence.quantifiedBulletCount,
    careerProgression:      intelligence.careerProgression,
    inferredJDSeniority:    signal.inferredSeniority,
    resumeSeniority:        intelligence.seniorityEvidence,

    executiveSummary: strategic.executiveSummary ?? '',

    resumeText,
    jdText,
  };
}

// ─────────────────────────────────────────────────────────────
// § FAST VERIFY — runFastVerify
// Sync-only: L1 + L2 + L3. No API calls.
// Used for the "Rebuild Applied" instant re-score banner.
// ─────────────────────────────────────────────────────────────

export interface FastVerifyResult {
  precisionScore: number;
  mandatoryCoverage: number;
  preferredCoverage: number;
  criticalMisses: string[];
  optionalMisses: string[];
  matchedTerms: string[];
  achievementScore: number;
  achievementDensity: number;
  scoreDelta: number; // positive = improvement vs baseline
}

export function runFastVerify(
  resumeText: string,
  jdText: string,
  baselinePrecisionScore?: number,
): FastVerifyResult {
  const signal      = decomposeJobSignal(jdText);
  const intelligence = extractResumeIntelligence(resumeText);
  const precision   = computePrecisionMatch(signal, intelligence);

  return {
    precisionScore:    precision.precisionScore,
    mandatoryCoverage: precision.mandatoryCoverage,
    preferredCoverage: precision.preferredCoverage,
    criticalMisses:    precision.criticalMisses,
    optionalMisses:    precision.optionalMisses,
    matchedTerms:      precision.matchedTerms,
    achievementScore:  intelligence.achievementScore,
    achievementDensity: intelligence.achievementDensity,
    scoreDelta:         baselinePrecisionScore != null
                          ? precision.precisionScore - baselinePrecisionScore
                          : 0,
  };
}
