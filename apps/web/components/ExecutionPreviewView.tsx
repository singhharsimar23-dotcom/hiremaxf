import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { getMatchLabel, JobCardMetrics, SalaryIndicator, TechStackBrief, UrgencyBadge, EligibilityBadges, EnrichedJobDetailPanel, PostingAgeBadge, WorkModeBadge, SkillTagCloud, DeterministicIntelligenceBadges } from './JobCardComponents';
import {
    ArrowRight,
    AlertTriangle,
    Building2,
    MapPin,
    ExternalLink,
    X,
    Info,
    CheckCircle2,
    ChevronDown,
    Cpu,
    Fingerprint,
    Radio,
    Terminal,
    ShieldCheck,
    AlertCircle,
    Briefcase,
    Layers,
    ArrowLeft,
    Navigation,
    Search,
    Loader2,
    ShieldAlert,
    Sparkles,
    TrendingUp,
    Zap,
    ChevronRight,
    BarChart3,
    Target,
    RefreshCw
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { ApiEngine, NormalizedIntent, JobPointer, GovernorMode, MaterializedJob, MatchAnalysis } from '../lib/api-engine';

// --- TYPES & CONSTANTS ---

type Step = 'INTENT' | 'PROCESSING' | 'RESULTS' | 'ERROR';
type LocationBucket = 'US-WEST' | 'US-EAST' | 'US-CENTRAL' | 'US-REMOTE' | 'US-OTHER';
type MatchState = 'idle' | 'analyzing' | 'COMPLETED' | 'PENDING' | 'PROCESSING' | 'FAILED' | 'error';

const TECH_ROLES = [
    "AI Research Scientist", "Android Engineer", "Backend Engineer", "Blockchain Developer",
    "Cloud Architect", "Data Engineer", "Data Scientist", "DevOps Engineer",
    "Embedded Systems Engineer", "Engineering Manager", "Frontend Engineer", "Fullstack Engineer",
    "Game Developer", "Information Security Analyst", "iOS Engineer", "Machine Learning Engineer",
    "MLOps Engineer", "Mobile Engineer", "Network Engineer", "Product Manager",
    "QA Automation Engineer", "Reliability Engineer (SRE)", "Security Engineer", "Solutions Architect",
    "Staff Software Engineer", "Systems Administrator", "Technical Program Manager", "UI/UX Designer"
].sort();

const SUGGESTED_REGIONS = [
    "California, US (West)", "New York, US (East)", "Texas, US (Central)",
    "Seattle, WA (West)", "Chicago, IL (Central)", "Miami, FL (East)",
    "Remote, US"
];

const MAX_AUTO_ANALYSIS = 12;

interface CanonicalJob {
    id: string;
    skills: string[];
    tech_stack: string[];
    requirements: string[];
    responsibilities: string[];
    salary_min: number;
    salary_max: number;
    salary_currency: string;
    salary_period: string;
    experience_required: number;
    experience_level: string;
    education_required: string;
    employment_type: string;
    industry_tags: string[];
    sponsorship_type: string;
    clearance_level: string;
    role_category: string;
    seniority_band: string;
}

interface ExecutionPreviewViewProps {
    onNavigate?: (view: any, id?: string) => void;
}

// Match analysis state per job
interface JobMatchState {
    id?: string; // Analysis ID
    state: MatchState;
    analysis: MatchAnalysis | null;
    heuristic: { inKillZone: boolean; matchScore: number } | null;
    error_reason?: string;
}

export const ExecutionPreviewView: React.FC<ExecutionPreviewViewProps> = ({ onNavigate }) => {
    const [step, setStep] = useState<Step>('INTENT');
    const [governorMode, setGovernorMode] = useState<GovernorMode>('FULL');
    const [normalizedResult, setNormalizedResult] = useState<NormalizedIntent | null>(null);
    const [jobPointers, setJobPointers] = useState<JobPointer[]>([]);
    const [selectedJob, setSelectedJob] = useState<JobPointer | null>(null);
    const [materialization, setMaterialization] = useState<MaterializedJob | null>(null);
    const [matLoading, setMatLoading] = useState(false);
    const [matError, setMatError] = useState<string | null>(null);
    const [matSuccess, setMatSuccess] = useState(false);
    const [errorHeader, setErrorHeader] = useState('');
    const [loadingSession, setLoadingSession] = useState(false);
    const [lastSavedAppId, setLastSavedAppId] = useState<string | null>(null);
    const [marketContext, setMarketContext] = useState<any | null>(null);
    
    // --- PREMIUM JOB UI STATE ---
    const [selectedCanonicalJob, setSelectedCanonicalJob] = useState<CanonicalJob | null>(null);
    const [fetchingCanonical, setFetchingCanonical] = useState(false);

    // --- MARKET RADAR INTEGRATION (FIX 3) ---
    useEffect(() => {
        const loadMarketContext = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const { data } = await supabase
                .from('market_snapshots')
                .select('results_json')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (data?.results_json) {
                setMarketContext(data.results_json);
            }
        };
        // Only load if on the intent screen
        if (step === 'INTENT') {
            loadMarketContext();
        }
    }, [step]);

    // --- FETCH CANONICAL JOB DETAILS ON MODAL OPEN ---
    useEffect(() => {
        if (!selectedJob) {
            setSelectedCanonicalJob(null);
            return;
        }

        const fetchCanonical = async () => {
            setFetchingCanonical(true);
            try {
                // job_pointers.canonical_job_id points to canonical_jobs.id
                // We fetch through the relation using the pointer's ID
                const { data, error } = await supabase
                    .from('job_pointers')
                    .select('canonical_jobs(*)')
                    .eq('id', selectedJob.job_id)
                    .single();
                
                if (!error && data?.canonical_jobs) {
                    setSelectedCanonicalJob(data.canonical_jobs as unknown as CanonicalJob);
                }
            } catch (e) {
                console.error("Failed to fetch detailed job context", e);
            } finally {
                setFetchingCanonical(false);
            }
        };
        
        fetchCanonical();
    }, [selectedJob]);

    // --- SEARCH STATE PERSISTENCE ---
    const saveDiscoverySession = useCallback(async (params: NormalizedIntent, results: JobPointer[]) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // We keep it simple: one active session per user for now, or just append. 
            // For now, let's just insert a new one.
            await supabase.from('discovery_sessions').insert({
                user_id: user.id,
                search_params: params,
                results_snapshot: results
            });
        } catch (err) {
            console.error("Failed to save discovery session:", err);
        }
    }, []);

    useEffect(() => {
        const loadLastSession = async () => {
            setLoadingSession(true);
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;

                const { data, error } = await supabase
                    .from('discovery_sessions')
                    .select('*')
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (data && !error && data.search_params) {
                    const intent = data.search_params;
                    
                    // Pre-fill search parameters so user knows their default state
                    setRoleInput(intent.role_normalized || '');
                    if (intent.location_raw) setLocationInput(intent.location_raw);
                    if (intent.focus_skills) setFocusSkills(intent.focus_skills);
                    if (intent.momentum_preference) setMomentumPreference(intent.momentum_preference);

                    // Drop directly into processing mode for a fresh FAANG-style feed
                    setStep('PROCESSING');

                    try {
                        // CRITICAL FIX: resolveIntent MUST be called first to generate intent_id + location_bucket
                        // Without it, resolveCluster returns a bad cluster and fetchJobPointers gets no results
                        const PIPELINE_TIMEOUT = 20000;
                        const withTimeout = <T,>(p: Promise<T>) => Promise.race([
                            p,
                            new Promise<never>((_, reject) =>
                                setTimeout(() => reject(new Error('PIPELINE_TIMEOUT')), PIPELINE_TIMEOUT)
                            )
                        ]);

                        const freshIntent = await withTimeout(ApiEngine.resolveIntent({
                            role_normalized: intent.role_normalized || '',
                            seniority: intent.seniority || '',
                            location_raw: intent.location_raw || '',
                            focus_skills: intent.focus_skills,
                            momentum_preference: intent.momentum_preference
                        }));

                        setNormalizedResult(freshIntent);

                        const cluster = await withTimeout(ApiEngine.resolveCluster(freshIntent));
                        const pointers = await withTimeout(ApiEngine.fetchJobPointers(cluster.cluster_id, freshIntent));
                        
                        setJobPointers(pointers);
                        
                        // Populate instantaneous deterministic decisions
                        const instantDecisions: Record<string, any> = {};
                        pointers.forEach(p => {
                            if ((p as any).deterministic_decision) {
                                instantDecisions[p.job_id] = (p as any).deterministic_decision;
                            }
                        });
                        if (Object.keys(instantDecisions).length > 0) {
                            setDecisionStates(prev => ({...prev, ...instantDecisions}));
                        }

                        setStep('RESULTS');

                        if (pointers.length > 0) {
                            setTimeout(() => runBackgroundAnalysis(pointers), 300);
                        }
                    } catch (fetchErr: any) {
                        if (fetchErr?.message === 'PIPELINE_TIMEOUT') {
                            console.warn("[SESSION] Auto-restore timed out. Showing search form.");
                        } else {
                            console.error("Failed to fetch live feed:", fetchErr);
                        }
                        setStep('INTENT'); // Fall back to search form on any failure
                    }
                }
            } catch (err) {
                console.error("Failed to load session:", err);
                setStep('INTENT'); // Fall back gracefully
            } finally {
                setLoadingSession(false);
            }
        };

        if (step === 'INTENT') {
            loadLastSession();
        }
    }, []);

    // Match analysis state per job
    const [matchStates, setMatchStates] = useState<Record<string, JobMatchState>>({});
    const [decisionStates, setDecisionStates] = useState<Record<string, any>>({});
    const [analysisProgress, setAnalysisProgress] = useState({ done: 0, total: 0 });
    const [expandedJob, setExpandedJob] = useState<string | null>(null);

    // Race Condition Protection
    const abortControllerRef = useRef<AbortController | null>(null);
    const analysisRunRef = useRef(0);

    // Inputs
    const [roleInput, setRoleInput] = useState('');
    const [locationInput, setLocationInput] = useState('');
    const [seniority, setSeniority] = useState('');
    const [focusSkills, setFocusSkills] = useState<string[]>([]);
    const [momentumPreference, setMomentumPreference] = useState<'GROWTH' | 'STABILITY' | 'STRATEGIC'>('GROWTH');
    const [trendingSkills, setTrendingSkills] = useState<string[]>([]);

    // Autocomplete State
    const [showSuggestions, setShowSuggestions] = useState(false);
    const suggestionRef = useRef<HTMLDivElement>(null);

    const filteredSuggestions = useMemo(() => {
        if (!locationInput) return [];
        const query = locationInput.toLowerCase();
        return SUGGESTED_REGIONS
            .filter(r => r.toLowerCase().includes(query))
            .slice(0, 5);
    }, [locationInput]);

    useEffect(() => {
        const fetchGovernorData = async () => {
            const mode = await ApiEngine.getGovernorStatus();
            setGovernorMode(mode);

            // Predict trending skills for UI pulse
            if (roleInput) {
                const { data } = await supabase
                    .from('skill_evolution_signals')
                    .select('skill_name')
                    .eq('role_key', inferRoleKey(roleInput))
                    .order('skill_momentum', { ascending: false })
                    .limit(6);
                if (data && data.length > 0) {
                    setTrendingSkills(data.map(s => s.skill_name));
                } else {
                    // Fallback to role-affinity defaults
                    setTrendingSkills(ROLE_SKILL_AFFINITY[inferRoleKey(roleInput)]?.slice(0, 6) || []);
                }
            }
        };
        fetchGovernorData();
    }, [roleInput]);

    // Role key helper
    function inferRoleKey(role: string): string {
        const lower = role.toLowerCase();
        if (lower.includes('frontend')) return 'frontend';
        if (lower.includes('backend')) return 'backend';
        if (lower.includes('ml') || lower.includes('ai')) return 'ml';
        if (lower.includes('devops') || lower.includes('sre')) return 'devops';
        if (lower.includes('data')) return 'data';
        if (lower.includes('mobile')) return 'mobile';
        return 'fullstack';
    }

    const ROLE_SKILL_AFFINITY: Record<string, string[]> = {
        frontend: ['React', 'Next.js', 'Tailwind', 'TypeScript', 'Svelte', 'Vite'],
        backend: ['Node.js', 'Go', 'Python', 'PostgreSQL', 'Redis', 'Drizzle'],
        ml: ['OpenAI', 'LangChain', 'PyTorch', 'Vector DB', 'Claude', 'LlamaIndex'],
        devops: ['Terraform', 'Kubernetes', 'Docker', 'AWS', 'CI/CD', 'GitHub Actions'],
        data: ['Snowflake', 'BigQuery', 'Spark', 'dbt', 'SQL', 'Databricks'],
        mobile: ['React Native', 'Flutter', 'Swift', 'Kotlin', 'iOS', 'Android'],
        fullstack: ['TypeScript', 'Supabase', 'React', 'Node.js', 'API Design', 'Architecture']
    };

    // --- REALTIME SUBSCRIPTION FOR MATCH ANALYSIS ---
    useEffect(() => {
        if (step !== 'RESULTS' || jobPointers.length === 0) return;

        const channel = supabase
            .channel('match_analysis_realtime')
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'match_analysis',
                filter: `job_id=in.(${jobPointers.map(j => j.job_id).join(',')})`
            }, (payload) => {
                const updated = payload.new as any;
                setMatchStates(prev => ({
                    ...prev,
                    [updated.job_id]: {
                        id: updated.id,
                        state: updated.status,
                        analysis: updated.analysis,
                        heuristic: null,
                        error_reason: updated.error_reason
                    }
                }));

                if (updated.status === 'COMPLETED' || updated.status === 'FAILED') {
                    setAnalysisProgress(prev => ({ ...prev, done: prev.done + 1 }));
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [step, jobPointers]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (suggestionRef.current && !suggestionRef.current.contains(e.target as Node)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // --- AUTOMATIC BACKGROUND ANALYSIS (DB-BACKED) ---
    const runBackgroundAnalysis = useCallback(async (jobs: JobPointer[]) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const runId = ++analysisRunRef.current;
        const toAnalyze = jobs.slice(0, MAX_AUTO_ANALYSIS);
        setAnalysisProgress({ done: 0, total: toAnalyze.length });

        for (const job of toAnalyze) {
            if (analysisRunRef.current !== runId) return;

            try {
                // Check if analysis already exists and is COMPLETED
                const { data: existing } = await supabase
                    .from('match_analysis')
                    .select('*')
                    .eq('user_id', user.id)
                    .eq('job_id', job.job_id)
                    .maybeSingle();

                if (existing?.status === 'COMPLETED') {
                    setMatchStates(prev => ({
                        ...prev,
                        [job.job_id]: {
                            id: existing.id,
                            state: 'COMPLETED',
                            analysis: existing.analysis,
                            heuristic: null
                        }
                    }));
                    setAnalysisProgress(prev => ({ ...prev, done: prev.done + 1 }));
                    continue;
                }

                // 1. Get deterministic signals from predefined pointer or compute if missing
                let deterministicSignals: any = (job as any).deterministic_decision || null;

                if (!deterministicSignals) {
                    try {
                        deterministicSignals = await ApiEngine.computeHiringDecision(job.job_id, '', roleInput, 'BIG_TECH');
                        setDecisionStates(prev => ({ ...prev, [job.job_id]: deterministicSignals }));
                    } catch (err) {
                        console.error("Fast decision failed", err);
                    }
                }

                // 2. Trigger new analysis with full context
                const description = `${job.role} at ${job.company}, ${job.location}. 
                    Salary: ${job.salary_min || '?'}-${job.salary_max || '?'}. 
                    Tech: ${job.tech_stack?.join(', ') || 'Unknown'}. 
                    Skills: ${job.required_skills?.join(', ') || 'Unknown'}`;
                
                const { id } = await ApiEngine.analyzeMatch(
                    job.job_id, user.id, description, job.role, job.company, deterministicSignals
                );

                setMatchStates(prev => ({
                    ...prev,
                    [job.job_id]: { id, state: 'PENDING', analysis: null, heuristic: null }
                }));

            } catch (err) {
                console.error("Failed to start analysis for", job.job_id, err);
            }
        }
    }, []);

    const handleGenerate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!roleInput) return;

        if (governorMode === 'READ_ONLY') return;

        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();
        const signal = abortControllerRef.current.signal;

        setStep('PROCESSING');
        setMatchStates({});
        setExpandedJob(null);

        try {
            setNormalizedResult(null);
            const intent = await ApiEngine.resolveIntent({
                role_normalized: roleInput,
                seniority,
                location_raw: locationInput,
                focus_skills: focusSkills,
                momentum_preference: momentumPreference
            }, signal);

            if (signal.aborted) return;
            setNormalizedResult(intent);

            const cluster = await ApiEngine.resolveCluster(intent, signal);
            if (signal.aborted) return;

            const pointers = await ApiEngine.fetchJobPointers(cluster.cluster_id, intent, signal);
            if (signal.aborted) return;
            setJobPointers(pointers);

            // Populate deterministic decisions instantly
            const instantDecisions: Record<string, any> = {};
            pointers.forEach(p => {
                if ((p as any).deterministic_decision) {
                    instantDecisions[p.job_id] = (p as any).deterministic_decision;
                }
            });
            if (Object.keys(instantDecisions).length > 0) {
                setDecisionStates(instantDecisions);
            }

            if (intent && pointers.length > 0) {
                saveDiscoverySession(intent, pointers);
            }

            setStep('RESULTS');

            // Trigger background analysis AFTER rendering results (non-blocking)
            if (pointers.length > 0) {
                setTimeout(() => runBackgroundAnalysis(pointers), 300);
            }
        } catch (err: any) {
            if (err.name === 'AbortError') return;
            console.error("Pipeline Failed:", err);
            setErrorHeader(err.message);
            setStep('ERROR');
        } finally {
            if (abortControllerRef.current?.signal === signal) {
                abortControllerRef.current = null;
            }
        }
    };

    const handleMaterialize = async (job: JobPointer) => {
        setSelectedJob(job);
        setMatError(null);
        setMatSuccess(false);
        // We no longer fetch heavy description here. 
        // We use the pointer's data for the initial modal view.
    };

    // Inline analysis detail card
    const AnalysisCard: React.FC<{ jobId: string }> = ({ jobId }) => {
        const m = matchStates[jobId];
        const dec = decisionStates[jobId];
        if (!m || m.state !== 'COMPLETED' || !m.analysis) return null;
        const a = m.analysis;

        return (
            <div className="mt-4 space-y-4 animate-in slide-in-from-top-4 duration-300">
                {/* Rationale */}
                <p className="text-slate-400 text-[11px] leading-relaxed italic border-l-2 border-white/5 pl-4 py-1">{a.rationale}</p>

                {/* --- PROFILE EMPTY STATE CTA --- */}
                {a.error === 'NO_PROFILE_SNAPSHOT' && (
                    <div className="bg-blue-600/10 border border-blue-500/20 rounded-2xl p-6 text-center space-y-4">
                        <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest leading-relaxed">
                            System cannot compute match probabilities because your <span className="text-white">Profile Intelligence</span> is empty.
                        </p>
                        <button 
                            onClick={() => onNavigate && onNavigate('profile')}
                            className="bg-blue-600 hover:bg-blue-500 text-white text-[9px] font-black uppercase tracking-widest px-6 py-3 rounded-xl transition-all shadow-lg shadow-blue-500/10"
                        >
                            Complete Profile
                        </button>
                    </div>
                )}

                {/* --- FAANG-LEVEL DETERMINISTIC WIDGET --- */}
                {dec && dec.candidate_strength !== undefined && (
                    <div className="space-y-3 pt-2 pb-2">
                        <div className="flex items-center gap-2">
                            <Cpu size={12} className="text-blue-500" />
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Deterministic Base Signals</p>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                            {/* Candidate */}
                            <div className="bg-[#0A0A0F] border border-white/5 rounded-xl p-3 relative overflow-hidden group hover:border-blue-500/20 transition-all">
                                <div className="absolute -right-2 -top-2 p-2 opacity-5 group-hover:opacity-10 transition-opacity"><Target size={32} /></div>
                                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Candidate</p>
                                <div className="flex items-end gap-1">
                                    <span className="text-xl font-black text-white">{(dec.candidate_strength * 10).toFixed(1)}</span>
                                    <span className="text-[8px] font-bold text-slate-500 mb-1 relative top-[-2px]">/10</span>
                                </div>
                                <div className="h-0.5 w-full bg-white/5 mt-2 rounded-full overflow-hidden">
                                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${dec.candidate_strength * 100}%` }} />
                                </div>
                            </div>

                            {/* Market */}
                            <div className="bg-[#0A0A0F] border border-white/5 rounded-xl p-3 relative overflow-hidden group hover:border-amber-500/20 transition-all">
                                <div className="absolute -right-2 -top-2 p-2 opacity-5 group-hover:opacity-10 transition-opacity"><TrendingUp size={32} /></div>
                                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Market</p>
                                <div className="flex items-end gap-1">
                                    <span className="text-xl font-black text-white">{(dec.market_pressure_score * 10).toFixed(1)}</span>
                                    <span className="text-[8px] font-bold text-slate-500 mb-1 relative top-[-2px]">/10</span>
                                </div>
                                <div className="h-0.5 w-full bg-white/5 mt-2 rounded-full overflow-hidden">
                                    <div className="h-full bg-amber-500 rounded-full" style={{ width: `${dec.market_pressure_score * 100}%` }} />
                                </div>
                            </div>

                            {/* Discoverability */}
                            <div className="bg-[#0A0A0F] border border-white/5 rounded-xl p-3 relative overflow-hidden group hover:border-purple-500/20 transition-all">
                                <div className="absolute -right-2 -top-2 p-2 opacity-5 group-hover:opacity-10 transition-opacity"><Radio size={32} /></div>
                                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Visibility</p>
                                <div className="flex items-end gap-1">
                                    <span className="text-xl font-black text-white">{(dec.recruiter_surface_score * 10).toFixed(1)}</span>
                                    <span className="text-[8px] font-bold text-slate-500 mb-1 relative top-[-2px]">/10</span>
                                </div>
                                <div className="h-0.5 w-full bg-white/5 mt-2 rounded-full overflow-hidden">
                                    <div className="h-full bg-purple-500 rounded-full" style={{ width: `${dec.recruiter_surface_score * 100}%` }} />
                                </div>
                            </div>

                            {/* Timing */}
                            <div className="bg-[#0A0A0F] border border-white/5 rounded-xl p-3 relative overflow-hidden group hover:border-green-500/20 transition-all">
                                <div className="absolute -right-2 -top-2 p-2 opacity-5 group-hover:opacity-10 transition-opacity"><Zap size={32} /></div>
                                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Timing</p>
                                <div className="flex items-end gap-1">
                                    <span className="text-xl font-black text-white">{(dec.timing_advantage * 10).toFixed(1)}</span>
                                    <span className="text-[8px] font-bold text-slate-500 mb-1 relative top-[-2px]">/10</span>
                                </div>
                                <div className="h-0.5 w-full bg-white/5 mt-2 rounded-full overflow-hidden">
                                    <div className="h-full bg-green-500 rounded-full" style={{ width: `${dec.timing_advantage * 100}%` }} />
                                </div>
                            </div>

                            {/* Skills */}
                            <div className="bg-[#0A0A0F] border border-white/5 rounded-xl p-3 relative overflow-hidden group hover:border-cyan-500/20 transition-all">
                                <div className="absolute -right-2 -top-2 p-2 opacity-5 group-hover:opacity-10 transition-opacity"><BarChart3 size={32} /></div>
                                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Skills</p>
                                <div className="flex items-end gap-1">
                                    <span className="text-xl font-black text-white">{(dec.skill_opportunity_score * 10).toFixed(1)}</span>
                                    <span className="text-[8px] font-bold text-slate-500 mb-1 relative top-[-2px]">/10</span>
                                </div>
                                <div className="h-0.5 w-full bg-white/5 mt-2 rounded-full overflow-hidden">
                                    <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${dec.skill_opportunity_score * 100}%` }} />
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                {/* --- END DETERMINISTIC WIDGET --- */}

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white/5 rounded-xl p-3 space-y-1">
                        <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Skill Match</p>
                        <p className="text-lg font-black text-white">{a.skill_coverage_pct}%</p>
                    </div>
                    <div className="bg-white/5 rounded-xl p-3 space-y-1">
                        <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Experience</p>
                        <p className="text-sm font-black text-white capitalize">{a.experience_fit?.replace(/_/g, ' ')}</p>
                    </div>
                    <div className="bg-white/5 rounded-xl p-3 space-y-1">
                        <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Role Fit</p>
                        <p className="text-sm font-black text-white capitalize">{a.role_alignment}</p>
                    </div>
                    <div className="bg-white/5 rounded-xl p-3 space-y-1">
                        <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Domain</p>
                        <p className="text-sm font-black text-white capitalize">{a.domain_relevance?.replace(/_/g, ' ')}</p>
                    </div>
                </div>

                {/* Strengths & Gaps */}
                {a.strengths.length > 0 && (
                    <div className="space-y-2">
                        <p className="text-[8px] font-black text-green-500 uppercase tracking-widest">Strengths</p>
                        <div className="flex flex-wrap gap-1.5">
                            {a.strengths.map((s, i) => (
                                <span key={i} className="text-[9px] font-bold text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-lg">{s}</span>
                            ))}
                        </div>
                    </div>
                )}
                {a.gaps.length > 0 && (
                    <div className="space-y-2">
                        <p className="text-[8px] font-black text-amber-500 uppercase tracking-widest">Gaps to Close</p>
                        <div className="flex flex-wrap gap-1.5">
                            {a.gaps.map((g: string, i: number) => (
                                <span key={i} className="text-[9px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-lg">{g}</span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Strategic Insight */}
                {a.strategic_advice && (
                    <div className="space-y-2 mt-4">
                        <p className="text-[8px] font-black text-purple-400 uppercase tracking-widest flex items-center gap-1"><Sparkles size={10} /> Strategic Insight</p>
                        <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-3">
                            <p className="text-[10px] font-medium text-purple-200 leading-relaxed italic">
                                {a.strategic_advice}
                            </p>
                        </div>
                    </div>
                )}
                {/* Confidence & System Status */}
                <div className="flex flex-col gap-3 pt-4 border-t border-white/5">
                    <div className="flex items-center justify-between">
                        <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">AI Prediction Trust</span>
                        <div className="flex items-center gap-2">
                            <div className="h-1 w-20 bg-white/5 rounded-full overflow-hidden">
                                <div className={`h-full transition-all duration-700 ${a.analysis_confidence > 70 ? 'bg-blue-500' : 'bg-amber-500'}`} style={{ width: `${a.analysis_confidence}%` }} />
                            </div>
                            <span className="text-[9px] font-black text-slate-400">{a.analysis_confidence}%</span>
                        </div>
                    </div>
                    
                    {a.improvement_plan && a.improvement_plan.steps?.length > 0 && (
                        <div className="flex items-center justify-between bg-emerald-500/5 px-4 py-2 rounded-xl border border-emerald-500/10">
                            <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">Growth Path Available</span>
                            <span className="text-[9px] font-black text-emerald-400">+{a.improvement_plan.steps.length} Actions</span>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="max-w-[1400px] mx-auto py-12 px-10 animate-in fade-in duration-700 font-sans selection:bg-blue-500/30">

            {/* Header — TERMINOLOGY: "Jobs For You" */}
            <div className="mb-20 flex flex-col md:flex-row justify-between items-end gap-8 border-b border-white/5 pb-12">
                <div className="space-y-4">
                    <div className={`px-3 py-1 rounded text-[10px] font-black text-white uppercase tracking-[0.2em] ${governorMode === 'READ_ONLY' ? 'bg-red-600' : 'bg-blue-600'}`}>
                        {governorMode === 'READ_ONLY' ? 'System Locked' : 'Deterministic Scoring Active'}
                    </div>
                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">AI-Powered Match Analysis</span>
                </div>
                <h2 className="text-7xl font-black text-white tracking-tighter uppercase leading-none">Jobs For You</h2>
            </div>
            {(step === 'RESULTS' || step === 'ERROR') && (
                <button onClick={() => { setStep('INTENT'); setMatchStates({}); analysisRunRef.current++; }} className="flex items-center gap-2 text-[10px] font-black text-slate-500 hover:text-white uppercase tracking-[0.3em] transition-all bg-white/5 px-6 py-3 rounded-xl border border-white/5">
                    <ArrowLeft size={14} /> New Search
                </button>
            )}

            {step === 'INTENT' && (
                <div className="max-w-4xl mx-auto animate-in slide-in-from-bottom-8 duration-700">
                    {governorMode === 'READ_ONLY' || governorMode === 'SAFE' ? (
                        <div className="bg-amber-500/10 border border-amber-500/20 p-8 rounded-[2rem] mb-12 flex items-center gap-6">
                            <ShieldAlert className="text-amber-500" size={32} />
                            <div className="space-y-1">
                                <p className="text-amber-500 font-black uppercase text-xs tracking-widest">System Restricted</p>
                                <p className="text-slate-400 text-sm font-medium">The system is in {governorMode} mode. Discovery is paused.</p>
                            </div>
                        </div>
                    ) : null}

                    <div className={`bg-[#111118] border border-white/5 rounded-[4rem] p-16 shadow-2xl relative overflow-hidden ${governorMode === 'READ_ONLY' ? 'opacity-40 grayscale' : ''}`}>

                        {/* FIX 3: Inject Market Context hint from Radar so user strategy is informed */}
                        {marketContext && (
                            <div className="mb-10 bg-indigo-500/5 border border-indigo-500/10 p-5 rounded-2xl flex items-start gap-4">
                                <TrendingUp size={18} className="text-indigo-400 mt-0.5 shrink-0" />
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">Live Market Context</p>
                                    <p className="text-sm font-medium text-slate-400">
                                        The market is currently <span className="text-white font-bold">{marketContext.marketCondition}</span>.
                                        Strategy: <span className="text-emerald-400 font-bold">{marketContext.strategySignal}</span>
                                    </p>
                                </div>
                            </div>
                        )}

                        <form onSubmit={handleGenerate} className="relative z-10 space-y-12">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">

                                {/* Role Select */}
                                <div className="space-y-4">
                                    <label className="flex items-center gap-2 text-[11px] font-black text-slate-500 uppercase tracking-[0.3em] ml-2">
                                        <Briefcase size={14} className="text-blue-500" /> Target Role
                                    </label>
                                    <div className="relative">
                                        <select
                                            required
                                            disabled={governorMode === 'READ_ONLY'}
                                            value={roleInput}
                                            onChange={e => setRoleInput(e.target.value)}
                                            className="w-full bg-[#0D0D12] border border-white/5 rounded-2xl p-6 text-xl font-bold text-white outline-none appearance-none focus:border-blue-500/50 transition-all cursor-pointer"
                                        >
                                            <option value="" disabled>Choose your role</option>
                                            {TECH_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                                        </select>
                                        <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-600" size={20} />
                                    </div>
                                </div>

                                {/* Skill Pulse Multi-Select */}
                                <div className="space-y-4">
                                    <label className="flex items-center gap-2 text-[11px] font-black text-slate-500 uppercase tracking-[0.3em] ml-2">
                                        <Sparkles size={14} className="text-amber-500" /> Skill Pulse Focus
                                    </label>
                                    <div className="flex flex-wrap gap-2 bg-[#0D0D12] border border-white/5 rounded-2xl p-4 min-h-[82px] items-center">
                                        {trendingSkills.length > 0 ? trendingSkills.map(skill => (
                                            <button
                                                key={skill}
                                                type="button"
                                                onClick={() => {
                                                    setFocusSkills(prev => prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill]);
                                                }}
                                                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${focusSkills.includes(skill)
                                                        ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20'
                                                        : 'bg-white/5 border-white/5 text-slate-500 hover:text-white hover:bg-white/10'
                                                    }`}
                                            >
                                                {skill}
                                            </button>
                                        )) : <p className="text-[9px] font-bold text-slate-700 uppercase tracking-widest px-2">Select a role to see trending signals</p>}
                                    </div>
                                </div>

                                {/* Location Autocomplete */}
                                <div className="space-y-4 relative" ref={suggestionRef}>
                                    <label className="flex items-center gap-2 text-[11px] font-black text-slate-500 uppercase tracking-[0.3em] ml-2">
                                        <MapPin size={14} className="text-blue-500" /> Location
                                    </label>
                                    <div className="relative group">
                                        <input
                                            disabled={governorMode === 'READ_ONLY'}
                                            value={locationInput}
                                            onFocus={() => setShowSuggestions(true)}
                                            onChange={e => { setLocationInput(e.target.value); setShowSuggestions(true); }}
                                            className="w-full bg-[#0D0D12] border-b-2 border-white/5 focus:border-blue-500 p-6 text-3xl font-black text-white outline-none transition-all placeholder:text-slate-900"
                                            placeholder="e.g. Alaska"
                                        />
                                        {showSuggestions && filteredSuggestions.length > 0 && (
                                            <div className="absolute top-full left-0 w-full mt-2 bg-[#0D0D12] border border-white/10 rounded-2xl overflow-hidden z-50 shadow-2xl backdrop-blur-xl">
                                                {filteredSuggestions.map((suggestion) => (
                                                    <button
                                                        key={suggestion}
                                                        type="button"
                                                        onClick={() => { setLocationInput(suggestion); setShowSuggestions(false); }}
                                                        className="w-full px-6 py-4 text-left text-sm font-bold text-slate-400 hover:text-white hover:bg-blue-600/20 transition-all flex items-center justify-between border-b border-white/5 last:border-none"
                                                    >
                                                        {suggestion}
                                                        <Search size={14} className="opacity-30" />
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                                <div className="space-y-4">
                                    <label className="flex items-center gap-2 text-[11px] font-black text-slate-500 uppercase tracking-[0.3em] ml-2">
                                        <Layers size={14} className="text-blue-500" /> Seniority Level
                                    </label>
                                    <select
                                        disabled={governorMode === 'READ_ONLY'}
                                        value={seniority}
                                        onChange={e => setSeniority(e.target.value)}
                                        className="w-full bg-[#0D0D12] border border-white/5 rounded-2xl p-6 text-xl font-bold text-white outline-none appearance-none cursor-pointer focus:border-blue-500/50 transition-all"
                                    >
                                        <option value="">Any Level</option>
                                        <option>Junior (0-2y)</option><option>Mid-Level (3-5y)</option>
                                        <option>Senior (6-9y)</option><option>Staff+ (10y+)</option>
                                    </select>
                                </div>

                                {/* Momentum Strategy */}
                                <div className="space-y-4">
                                    <label className="flex items-center gap-2 text-[11px] font-black text-slate-500 uppercase tracking-[0.3em] ml-2">
                                        <TrendingUp size={14} className="text-blue-500" /> Momentum strategy
                                    </label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {(['GROWTH', 'STABILITY', 'STRATEGIC'] as const).map(strat => (
                                            <button
                                                key={strat}
                                                type="button"
                                                onClick={() => setMomentumPreference(strat)}
                                                className={`py-6 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${momentumPreference === strat
                                                        ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                                                        : 'bg-[#0D0D12] border-white/5 text-slate-600 hover:text-white hover:border-white/10'
                                                    }`}
                                            >
                                                {strat}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-center pt-8">
                                <button
                                    type="submit"
                                    disabled={governorMode === 'READ_ONLY'}
                                    className="w-full max-w-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white font-black py-8 rounded-3xl transition-all uppercase tracking-[0.4em] text-sm shadow-2xl flex items-center justify-center gap-4 group"
                                >
                                    Find Matching Jobs <ArrowRight size={24} className="group-hover:translate-x-2 transition-transform" />
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {step === 'PROCESSING' && (
                <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-8 animate-in fade-in zoom-in duration-500">
                    <Sparkles size={64} className="text-blue-500 animate-pulse" />
                    <div className="text-center font-mono text-[10px] text-slate-500 uppercase tracking-widest space-y-2">
                        <div className="flex items-center justify-center gap-3">
                            <Loader2 size={14} className="animate-spin" />
                            <p>Discovering matching opportunities…</p>
                        </div>
                        <p className="animate-pulse">Searching {locationInput || 'all regions'}…</p>
                    </div>
                </div>
            )}

            {step === 'ERROR' && (
                <div className="max-w-2xl mx-auto py-20 text-center space-y-8 animate-in slide-in-from-top-4 duration-500">
                    <div className="w-20 h-20 rounded-3xl bg-red-500/10 flex items-center justify-center text-red-500 mx-auto border border-red-500/20">
                        <ShieldAlert size={40} />
                    </div>
                    <div className="space-y-3">
                        <h3 className="text-3xl font-black text-white uppercase tracking-tighter">Something Went Wrong</h3>
                        <p className="text-slate-500 font-mono text-xs uppercase tracking-widest">{errorHeader}</p>
                    </div>
                    <button
                        onClick={() => setStep('INTENT')}
                        className="px-10 py-5 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-black uppercase text-[10px] tracking-[0.3em] transition-all"
                    >
                        Try Again
                    </button>
                </div>
            )}

            {step === 'RESULTS' && (
                <div className="space-y-8 animate-in slide-in-from-bottom-8 duration-1000">

                    {/* Progress Indicator */}
                    {analysisProgress.total > 0 && analysisProgress.done < analysisProgress.total && (
                        <div className="flex items-center gap-4 bg-blue-500/5 border border-blue-500/10 rounded-2xl px-6 py-4 animate-in fade-in duration-500">
                            <Sparkles size={16} className="text-blue-400 animate-pulse" />
                            <div className="flex-1">
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">
                                        Analyzing job matches… ({analysisProgress.done}/{analysisProgress.total})
                                    </p>
                                    <p className="text-[9px] font-bold text-slate-600">{Math.round((analysisProgress.done / analysisProgress.total) * 100)}%</p>
                                </div>
                                <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-blue-500 rounded-full transition-all duration-700 ease-out"
                                        style={{ width: `${(analysisProgress.done / analysisProgress.total) * 100}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Completed toast */}
                    {analysisProgress.total > 0 && analysisProgress.done === analysisProgress.total && (
                        <div className="flex items-center gap-3 bg-green-500/5 border border-green-500/10 rounded-2xl px-6 py-3 animate-in fade-in duration-500">
                            <CheckCircle2 size={14} className="text-green-400" />
                            <p className="text-[10px] font-black text-green-400 uppercase tracking-widest">
                                All {analysisProgress.total} jobs analyzed — results shown below
                            </p>
                        </div>
                    )}

                    {/* Cluster Info */}
                    <div className="bg-[#111118] border border-white/5 p-8 rounded-[2.5rem] flex items-center justify-between shadow-2xl">
                        <div className="flex items-center gap-6">
                            <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500 border border-blue-500/20"><Fingerprint size={28} /></div>
                            <div>
                                <p className="text-[9px] font-black text-slate-600 uppercase tracking-[0.4em]">Region</p>
                                <h3 className="text-2xl font-black text-white uppercase">{normalizedResult?.location_bucket}</h3>
                            </div>
                        </div>
                        <div className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border ${normalizedResult?.confidence_flag === 'OK' ? 'border-green-500/20 text-green-500' : 'border-amber-500/20 text-amber-500'}`}>
                            {normalizedResult?.confidence_flag} ({(normalizedResult?.location_confidence || 0) * 100}%)
                        </div>
                    </div>

                    {/* Job Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {jobPointers
                            .filter(job => !job.company.includes('RealCorp') || governorMode !== 'FULL') // Show RealCorp only in debug modes
                            .map(job => {
                                const m = matchStates[job.job_id] || { state: 'idle', analysis: null, heuristic: null };
                                const label = getMatchLabel(m);
                                const isExpanded = expandedJob === job.job_id;

                                return (
                                    <div key={job.job_id} className="bg-[#111118] border border-white/5 p-8 rounded-[3rem] hover:border-blue-500/30 transition-all group relative overflow-hidden flex flex-col h-full">
                                        <div className="absolute top-0 right-0 p-6 opacity-[0.02] text-white pointer-events-none"><ShieldCheck size={160} /></div>
                                        <div className="relative z-10 space-y-5 flex-1">
                                            <div className="flex items-start justify-between">
                                                <div className="space-y-2">
                                                    <Building2 size={24} className="text-slate-500 group-hover:text-blue-500 transition-colors" />
                                                    <UrgencyBadge score={job.hiring_urgency_score} />
                                                </div>
                                                <span className={`text-[8px] font-black px-2.5 py-1 rounded-lg uppercase tracking-widest border ${label.bgColor} ${label.color} ${label.borderColor} flex items-center gap-1.5`}>
                                                    {(m.state === 'analyzing' || m.state === 'PROCESSING') && <Loader2 size={8} className="animate-spin" />}
                                                    {m.state === 'COMPLETED' && m.analysis && m.analysis.role_alignment === 'strong' && <CheckCircle2 size={8} />}
                                                    {label.label}
                                                </span>
                                            </div>
                                            
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <p className="text-white font-black text-xl tracking-tighter uppercase line-clamp-1">{job.company}</p>
                                                    {job.source_platform && (
                                                        <span className="text-[7px] font-black bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded uppercase">{job.source_platform}</span>
                                                    )}
                                                </div>
                                                <p className="text-blue-500 text-[11px] font-black uppercase tracking-widest leading-none">{job.role}</p>
                                            </div>

                                            <div className="flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-2 text-slate-500">
                                                    <MapPin size={12} />
                                                    <span className="text-[10px] font-black uppercase tracking-widest">{job.location}</span>
                                                </div>
                                                <PostingAgeBadge days={(job as any).posting_age_days} />
                                            </div>

                                            <div className="flex items-center justify-between gap-2">
                                                <WorkModeBadge mode={(job as any).work_mode} />
                                                <SalaryIndicator min={job.salary_min} max={job.salary_max} currency={job.salary_currency} period={job.salary_period} raw={(job as any).salary_raw} />
                                            </div>

                                            <DeterministicIntelligenceBadges job={job as any} />
                                            <EligibilityBadges sponsorship={job.sponsorship_type} clearance={job.clearance_level} />

                                            {/* Skill tags with user-highlight */}
                                            <SkillTagCloud skills={job.required_skills || (job as any).tech_stack} maxVisible={6} />

                                            <TechStackBrief stack={(job as any).tech_stack} />

                                            {/* Enriched Job Intelligence Panel — additive, no-op if not enriched */}
                                            <EnrichedJobDetailPanel job={job as any} />

                                            {decisionStates[job.job_id] && (
                                                <div className="space-y-1.5 pt-2">
                                                    <div className="flex justify-between items-center bg-white/5 p-4 rounded-2xl border border-white/5 shadow-inner">
                                                        <div>
                                                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Hiring Prob</p>
                                                            <p className={`text-xl font-black uppercase tracking-tighter ${decisionStates[job.job_id].decision === 'APPLY' ? 'text-green-500' :
                                                                decisionStates[job.job_id].decision === 'WAIT' ? 'text-amber-500' : 'text-slate-500'
                                                                }`}>
                                                                {decisionStates[job.job_id].decision}
                                                            </p>
                                                        </div>
                                                        <div className="text-right">
                                                            <span className="text-3xl font-black text-white px-2 tracking-tighter">
                                                                {(decisionStates[job.job_id].interview_probability * 100).toFixed(0)}%
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            <JobCardMetrics m={m} job={job as any} />

                                            {m.state === 'COMPLETED' && m.analysis && (
                                                <button
                                                    onClick={() => setExpandedJob(isExpanded ? null : job.job_id)}
                                                    className="w-full flex items-center justify-center gap-2 py-2 text-[9px] font-black text-slate-500 hover:text-blue-400 uppercase tracking-widest transition-all"
                                                >
                                                    {isExpanded ? 'Hide Details' : 'View Intelligence Report'}
                                                    <ChevronDown size={12} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                                </button>
                                            )}

                                            {isExpanded && <AnalysisCard jobId={job.job_id} />}
                                        </div>

                                        <div className="flex flex-col gap-2 pt-4 relative z-10">
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleMaterialize(job)}
                                                    className="flex-1 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-black text-[9px] uppercase tracking-[0.15em] rounded-xl transition-all flex items-center justify-center gap-2"
                                                >
                                                    <Target size={12} /> Forensic View
                                                </button>
                                                {job.source_url && (
                                                    <a
                                                        href={job.source_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="py-3.5 px-4 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-xl transition-all"
                                                    >
                                                        <ExternalLink size={14} />
                                                    </a>
                                                )}
                                            </div>
                                            {m.state === 'FAILED' && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        runBackgroundAnalysis([job]);
                                                    }}
                                                    className="w-full py-3 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white font-black text-[9px] uppercase tracking-[0.2em] rounded-xl transition-all flex items-center justify-center gap-2 border border-red-500/20"
                                                >
                                                    <RefreshCw size={12} /> Retry Analysis
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        {jobPointers.length === 0 && (
                            <div className="col-span-full py-32 text-center bg-white/5 rounded-[4rem] border border-white/5 border-dashed">
                                <p className="text-slate-500 font-black uppercase tracking-widest text-xs">No matching jobs found for this role and region.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Materialization + Deep Analysis Modal */}
            {selectedJob && (() => {
                const job = selectedJob; // Capture for stable narrowing
                const m = matchStates[job.job_id];

                return (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 backdrop-blur-3xl bg-black/80 animate-in fade-in duration-300">
                        <div className="bg-[#0D0D12] border border-white/10 w-full max-w-4xl max-h-[90vh] rounded-[3rem] shadow-3xl shadow-blue-900/20 relative flex flex-col">

                            {/* Fixed Close Button Header */}
                            <div className="absolute top-0 right-0 p-6 z-50">
                                <button
                                    onClick={() => setSelectedJob(null)}
                                    className="bg-black/50 hover:bg-white/10 text-slate-400 hover:text-white p-2 rounded-full backdrop-blur-md transition-all border border-white/5"
                                >
                                    <X size={24} />
                                </button>
                            </div>

                            {/* Scrollable Content */}
                            <div className="p-8 md:p-12 space-y-8 overflow-y-auto custom-scrollbar">
                                <div className="space-y-2 mt-4">
                                    <div className="flex items-center justify-between pr-12">
                                        <p className="text-blue-500 text-[10px] font-black uppercase tracking-[0.4em]">Match Analysis</p>
                                        {m?.state === 'COMPLETED' && m.analysis && (
                                            <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border ${getMatchLabel(m).bgColor} ${getMatchLabel(m).color} ${getMatchLabel(m).borderColor}`}>
                                                {getMatchLabel(m).label}
                                            </span>
                                        )}
                                    </div>
                                    <h2 className="text-4xl md:text-5xl font-black text-white uppercase tracking-tighter leading-tight">{job.company}</h2>
                                    <p className="text-slate-400 text-xl font-black uppercase">{job.role}</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-4">
                                        <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Region</p>
                                        <div className="flex items-center gap-3">
                                            <MapPin size={18} className="text-blue-500" />
                                            <span className="text-lg font-black text-white uppercase">{job.location}</span>
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Confidence ID</p>
                                        <div className="flex items-center gap-3">
                                            <ShieldCheck size={18} className="text-green-500" />
                                            <span className="text-lg font-black text-white uppercase">{(job.fingerprint || job.job_id).substring(0, 8)}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Job Description & Details (Premium UI) */}
                                {fetchingCanonical ? (
                                    <div className="flex flex-col items-center justify-center p-8 border border-white/5 rounded-[2rem] bg-white/[0.02]">
                                        <Loader2 size={24} className="animate-spin text-blue-500 mb-4" />
                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Loading Premium Job Details...</p>
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        {/* Rich Requirements & Responsibilities */}
                                        {(selectedCanonicalJob?.requirements?.length || selectedCanonicalJob?.responsibilities?.length) ? (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                                                {selectedCanonicalJob.requirements && selectedCanonicalJob.requirements.length > 0 && (
                                                    <div className="bg-white/5 border border-white/5 rounded-[2rem] p-6 space-y-4">
                                                        <div className="flex items-center gap-3">
                                                            <Target size={16} className="text-blue-400" />
                                                            <h3 className="text-[10px] font-black text-white uppercase tracking-widest">Requirements</h3>
                                                        </div>
                                                        <ul className="space-y-3">
                                                            {selectedCanonicalJob.requirements.map((req, i) => (
                                                                <li key={i} className="flex gap-3 text-[11px] text-slate-300 leading-relaxed font-mono">
                                                                    <span className="text-blue-500/50 mt-0.5">•</span>
                                                                    <span>{req}</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}
                                                
                                                {selectedCanonicalJob.responsibilities && selectedCanonicalJob.responsibilities.length > 0 && (
                                                    <div className="bg-white/5 border border-white/5 rounded-[2rem] p-6 space-y-4">
                                                        <div className="flex items-center gap-3">
                                                            <Briefcase size={16} className="text-purple-400" />
                                                            <h3 className="text-[10px] font-black text-white uppercase tracking-widest">Responsibilities</h3>
                                                        </div>
                                                        <ul className="space-y-3">
                                                            {selectedCanonicalJob.responsibilities.map((resp, i) => (
                                                                <li key={i} className="flex gap-3 text-[11px] text-slate-300 leading-relaxed font-mono">
                                                                    <span className="text-purple-500/50 mt-0.5">•</span>
                                                                    <span>{resp}</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="bg-white/5 border border-white/5 rounded-[2rem] p-8 max-h-[400px] overflow-y-auto custom-scrollbar font-mono text-[11px] leading-relaxed text-slate-400">
                                                <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-4 border-b border-white/5 pb-2">Full Job Description</p>
                                                {job.job_description ? (
                                                    <div className="whitespace-pre-wrap">{job.job_description}</div>
                                                ) : (
                                                    <div className="italic">
                                                        {job.role} role at {job.company} in {job.location}.
                                                        <br /><br />
                                                        <span className="opacity-50 text-[9px] uppercase tracking-widest">Metadata Hash: {job.fingerprint || job.job_id}</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Premium Metadata Badging */}
                                        {selectedCanonicalJob && (
                                            <div className="flex flex-wrap gap-2 pt-2 border-t border-white/5 mt-4">
                                                {selectedCanonicalJob.salary_min && (
                                                    <div className="px-3 py-1.5 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-[10px] font-black tracking-widest uppercase flex items-center gap-2">
                                                        <BarChart3 size={12} />
                                                        {selectedCanonicalJob.salary_currency || '$'}{selectedCanonicalJob.salary_min / 1000}k 
                                                        {selectedCanonicalJob.salary_max ? ` - ${selectedCanonicalJob.salary_max / 1000}k` : '+'}
                                                        {selectedCanonicalJob.salary_period === 'yearly' ? '/yr' : ''}
                                                    </div>
                                                )}
                                                {selectedCanonicalJob.experience_required && (
                                                    <div className="px-3 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-black tracking-widest uppercase">
                                                        {selectedCanonicalJob.experience_required}+ YOE
                                                    </div>
                                                )}
                                                {selectedCanonicalJob.employment_type && (
                                                    <div className="px-3 py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[10px] font-black tracking-widest uppercase">
                                                        {selectedCanonicalJob.employment_type.replace('_', ' ')}
                                                    </div>
                                                )}
                                                {selectedCanonicalJob.sponsorship_type && selectedCanonicalJob.sponsorship_type !== 'NO_SPONSORSHIP' && (
                                                    <div className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-black tracking-widest uppercase">
                                                        {selectedCanonicalJob.sponsorship_type.replace('_', ' ')}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        
                                        {/* Market Intelligence Tags (Skills) */}
                                        {(selectedCanonicalJob?.skills?.length || selectedCanonicalJob?.tech_stack?.length) && (
                                            <div className="pt-2">
                                                <div className="flex flex-wrap gap-2">
                                                    {(selectedCanonicalJob.tech_stack || []).slice(0, 8).map((tech, idx) => (
                                                        <span key={`tech-${idx}`} className="px-2 py-1 rounded bg-slate-800 text-slate-300 text-[9px] font-black uppercase tracking-widest">{tech}</span>
                                                    ))}
                                                    {(selectedCanonicalJob.skills || []).slice(0, 10).map((skill, idx) => (
                                                        <span key={`skill-${idx}`} className="px-2 py-1 rounded border border-white/10 text-slate-400 text-[9px] font-black uppercase tracking-widest">{skill}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Inline Gemini analysis in modal */}
                                {m && (
                                    <div className="bg-white/[0.02] border border-white/5 rounded-[2rem] p-6 md:p-8">
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-3">
                                                <Sparkles size={16} className="text-blue-400" />
                                                <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">AI Status: {m.state}</p>
                                            </div>
                                            {m.state === 'FAILED' && (
                                                <button
                                                    onClick={() => runBackgroundAnalysis([job])}
                                                    className="text-[9px] font-black text-blue-500 hover:text-white uppercase tracking-widest underline underline-offset-4"
                                                >
                                                    Retry Analysis
                                                </button>
                                            )}
                                        </div>
                                        <AnalysisCard jobId={job.job_id} />
                                        {(m.state === 'PENDING' || m.state === 'PROCESSING') && (
                                            <div className="flex flex-col items-center py-8 gap-4">
                                                <Loader2 size={24} className="animate-spin text-blue-500" />
                                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Analysis in progress... checking data sources</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="flex flex-col md:flex-row gap-4 pt-4">
                                    <button
                                        onClick={async () => {
                                            try {
                                                setMatLoading(true);
                                                setMatError(null);
                                                setMatSuccess(false);

                                                const { data: { user } } = await supabase.auth.getUser();
                                                if (!user) throw new Error("Authentication required");

                                                const { data, error } = await supabase
                                                    .from('applications')
                                                    .upsert({
                                                        user_id: user.id,
                                                        job_pointer_id: job.job_id,
                                                        status: 'TRACKED',
                                                        title: job.role,
                                                        company: job.company,
                                                        location: job.location,
                                                        source_url: job.source_url,
                                                        match_confidence: m?.analysis?.skill_coverage_pct ? (m.analysis.skill_coverage_pct / 100) : 0
                                                    }, { onConflict: 'user_id, job_pointer_id' })
                                                    .select('id')
                                                    .single();

                                                if (error) throw error;
                                                if (data) setLastSavedAppId(data.id);

                                                setMatSuccess(true);
                                                setTimeout(() => {
                                                    setMatSuccess(false);
                                                }, 1500);
                                            } catch (e: any) {
                                                setMatError(e.message || "Failed to save job");
                                            } finally {
                                                setMatLoading(false);
                                            }
                                        }}
                                        disabled={matLoading || matSuccess}
                                        className="flex-1 bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black py-4 md:py-5 rounded-2xl transition-all uppercase tracking-[0.3em] text-xs flex items-center justify-center gap-3 shadow-lg"
                                    >
                                        {matLoading ? <Loader2 className="animate-spin" /> : <>Save to Tracker <ArrowRight size={14} /></>}
                                    </button>
                                    {(m?.state === 'COMPLETED' || lastSavedAppId) && (
                                        <button
                                            onClick={() => {
                                                const appId = lastSavedAppId;
                                                setSelectedJob(null);
                                                setLastSavedAppId(null);
                                                if (onNavigate) onNavigate('applications', appId || undefined);
                                            }}
                                            className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-black py-4 md:py-5 rounded-2xl transition-all uppercase tracking-[0.3em] text-xs"
                                        >
                                            Execute Optimized Application
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}

            <style>{`
                .animate-spin-slow { animation: spin 8s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 10px; }
            `}</style>
        </div>
    );
};
