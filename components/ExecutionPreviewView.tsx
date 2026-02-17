import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
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
type MatchState = 'idle' | 'analyzing' | 'done' | 'error';

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

interface ExecutionPreviewViewProps {
    onNavigate?: (view: any, id?: string) => void;
}

// Match analysis state per job
interface JobMatchState {
    id?: string; // Analysis ID
    state: MatchState | 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
    analysis: MatchAnalysis | null;
    heuristic: { inKillZone: boolean; matchScore: number } | null;
    error_reason?: string;
}

// Derive user-facing label from analysis + heuristic
function getMatchLabel(m: JobMatchState): { label: string; color: string; bgColor: string; borderColor: string } {
    if (m.state === 'analyzing' || m.state === 'PROCESSING')
        return { label: 'Analyzing…', color: 'text-blue-400', bgColor: 'bg-blue-500/10', borderColor: 'border-blue-500/20' };
    if (m.state === 'PENDING')
        return { label: 'Queued', color: 'text-slate-400', bgColor: 'bg-white/5', borderColor: 'border-white/10' };
    if (m.state === 'FAILED' || m.state === 'error' || !m.analysis)
        return { label: 'Analysis Failed', color: 'text-red-400', bgColor: 'bg-red-500/10', borderColor: 'border-red-500/20' };

    const a = m.analysis;
    if (a.role_alignment === 'strong' && a.skill_coverage_pct >= 60)
        return { label: 'Perfect Match', color: 'text-green-400', bgColor: 'bg-green-500/10', borderColor: 'border-green-500/20' };
    if (a.role_alignment === 'moderate' || (a.role_alignment === 'strong' && a.skill_coverage_pct < 60))
        return { label: 'Strong Candidate', color: 'text-blue-400', bgColor: 'bg-blue-500/10', borderColor: 'border-blue-500/20' };
    return { label: 'Potential Fit', color: 'text-slate-400', bgColor: 'bg-white/5', borderColor: 'border-white/10' };
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

                if (data && !error) {
                    setNormalizedResult(data.search_params);
                    setJobPointers(data.results_snapshot);
                    setStep('RESULTS');
                    // Re-trigger background analysis for the loaded jobs
                    setTimeout(() => runBackgroundAnalysis(data.results_snapshot), 300);
                }
            } catch (err) {
                console.error("Failed to load session:", err);
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
    const [analysisProgress, setAnalysisProgress] = useState({ done: 0, total: 0 });
    const [expandedJob, setExpandedJob] = useState<string | null>(null);

    // Race Condition Protection
    const abortControllerRef = useRef<AbortController | null>(null);
    const analysisRunRef = useRef(0);

    // Inputs
    const [roleInput, setRoleInput] = useState('');
    const [locationInput, setLocationInput] = useState('');
    const [seniority, setSeniority] = useState('');

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
        const fetchGovernor = async () => {
            const mode = await ApiEngine.getGovernorStatus();
            setGovernorMode(mode);
        };
        fetchGovernor();
    }, []);

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

                // Trigger new analysis (Fire and Forget via API Engine)
                const description = `${job.role} at ${job.company}, ${job.location}`;
                const { id } = await ApiEngine.analyzeMatch(
                    job.job_id, user.id, description, job.role, job.company
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
                location_raw: locationInput
            }, signal);

            if (signal.aborted) return;
            setNormalizedResult(intent);

            const cluster = await ApiEngine.resolveCluster(intent, signal);
            if (signal.aborted) return;

            const pointers = await ApiEngine.fetchJobPointers(cluster.cluster_id, intent, signal);
            if (signal.aborted) return;
            setJobPointers(pointers);
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
        if (!m || m.state !== 'done' || !m.analysis) return null;
        const a = m.analysis;

        return (
            <div className="mt-4 space-y-4 animate-in slide-in-from-top-4 duration-300">
                {/* Rationale */}
                <p className="text-slate-400 text-[11px] leading-relaxed italic">{a.rationale}</p>

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
                            {a.gaps.map((g, i) => (
                                <span key={i} className="text-[9px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-lg">{g}</span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Confidence */}
                <div className="flex items-center justify-between pt-2 border-t border-white/5">
                    <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">AI Confidence</span>
                    <div className="flex items-center gap-2">
                        <div className="h-1 w-16 bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full transition-all duration-700" style={{ width: `${a.analysis_confidence}%` }} />
                        </div>
                        <span className="text-[9px] font-black text-slate-400">{a.analysis_confidence}%</span>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="max-w-[1400px] mx-auto py-12 px-10 animate-in fade-in duration-700 font-sans selection:bg-blue-500/30">

            {/* Header — TERMINOLOGY: "Jobs For You" */}
            <div className="mb-20 flex flex-col md:flex-row justify-between items-end gap-8 border-b border-white/5 pb-12">
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <div className={`px-3 py-1 rounded text-[10px] font-black text-white uppercase tracking-[0.2em] ${governorMode === 'READ_ONLY' ? 'bg-red-600' : 'bg-blue-600'}`}>
                            {governorMode === 'READ_ONLY' ? 'System Locked' : 'Smart Discovery'}
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
            </div>

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
                                        className="w-full bg-[#0D0D12] border border-white/5 rounded-2xl p-6 text-xl font-bold text-white outline-none appearance-none cursor-pointer"
                                    >
                                        <option value="" disabled>Experience level</option>
                                        <option>Junior (0-2y)</option><option>Mid-Level (3-5y)</option>
                                        <option>Senior (6-9y)</option><option>Staff+ (10y+)</option>
                                    </select>
                                </div>

                                <div className="flex items-end">
                                    <button
                                        type="submit"
                                        disabled={governorMode === 'READ_ONLY'}
                                        className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white font-black py-8 rounded-3xl transition-all uppercase tracking-[0.4em] text-sm shadow-2xl flex items-center justify-center gap-4 group"
                                    >
                                        Find Matching Jobs <ArrowRight size={24} className="group-hover:translate-x-2 transition-transform" />
                                    </button>
                                </div>
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

                    {/* Progress Indicator — CHANGE 6 */}
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

                    {/* Job Cards with Inline Analysis — CHANGE 5 */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {jobPointers.map(job => {
                            const m = matchStates[job.job_id] || { state: 'idle', analysis: null, heuristic: null };
                            const label = getMatchLabel(m);
                            const isExpanded = expandedJob === job.job_id;

                            return (
                                <div key={job.job_id} className="bg-[#111118] border border-white/5 p-8 rounded-[3rem] hover:border-blue-500/30 transition-all group relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-6 opacity-[0.02] text-white pointer-events-none"><ShieldCheck size={160} /></div>
                                    <div className="relative z-10 space-y-5">
                                        <div className="flex items-center justify-between">
                                            <Building2 size={22} className="text-slate-500 group-hover:text-blue-500 transition-colors" />
                                            {/* INLINE MATCH BADGE — CHANGE 5 */}
                                            <span className={`text-[8px] font-black px-2.5 py-1 rounded-lg uppercase tracking-widest border ${label.bgColor} ${label.color} ${label.borderColor} flex items-center gap-1.5`}>
                                                {m.state === 'analyzing' && <Loader2 size={8} className="animate-spin" />}
                                                {m.state === 'done' && m.analysis && m.analysis.role_alignment === 'strong' && <CheckCircle2 size={8} />}
                                                {label.label}
                                            </span>
                                        </div>
                                        <div>
                                            <p className="text-white font-black text-xl tracking-tighter uppercase">{job.company}</p>
                                            <p className="text-blue-500 text-[11px] font-black uppercase tracking-widest">{job.role}</p>
                                        </div>
                                        <div className="flex items-center gap-2 text-slate-500">
                                            <MapPin size={12} />
                                            <span className="text-[10px] font-black uppercase tracking-widest">{job.location}</span>
                                        </div>

                                        {/* Skill coverage bar (only when done) */}
                                        {m.state === 'done' && m.analysis && (
                                            <div className="space-y-1.5">
                                                <div className="flex justify-between">
                                                    <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Skill Match</span>
                                                    <span className="text-[9px] font-black text-white">{m.analysis.skill_coverage_pct}%</span>
                                                </div>
                                                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full transition-all duration-1000 ease-out ${m.analysis.skill_coverage_pct >= 60 ? 'bg-green-500' :
                                                            m.analysis.skill_coverage_pct >= 35 ? 'bg-blue-500' : 'bg-amber-500'
                                                            }`}
                                                        style={{ width: `${m.analysis.skill_coverage_pct}%` }}
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        {/* Expandable details */}
                                        {m.state === 'done' && m.analysis && (
                                            <button
                                                onClick={() => setExpandedJob(isExpanded ? null : job.job_id)}
                                                className="w-full flex items-center justify-center gap-2 py-2 text-[9px] font-black text-slate-500 hover:text-blue-400 uppercase tracking-widest transition-all"
                                            >
                                                {isExpanded ? 'Hide Details' : 'View Analysis'}
                                                <ChevronDown size={12} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                            </button>
                                        )}

                                        {isExpanded && <AnalysisCard jobId={job.job_id} />}

                                        {/* Action buttons */}
                                        <div className="flex flex-col gap-2 pt-1">
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleMaterialize(job)}
                                                    className="flex-1 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-black text-[9px] uppercase tracking-[0.15em] rounded-xl transition-all flex items-center justify-center gap-2"
                                                >
                                                    <Target size={12} /> View Details
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
            {selectedJob && (
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
                                    {(() => {
                                        const m = matchStates[selectedJob.job_id];
                                        if (m?.state === 'done' && m.analysis) {
                                            const lbl = getMatchLabel(m);
                                            return (
                                                <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border ${lbl.bgColor} ${lbl.color} ${lbl.borderColor}`}>
                                                    {lbl.label}
                                                </span>
                                            );
                                        }
                                        return null;
                                    })()}
                                </div>
                                <h2 className="text-4xl md:text-5xl font-black text-white uppercase tracking-tighter leading-tight">{selectedJob.company}</h2>
                                <p className="text-slate-400 text-xl font-black uppercase">{selectedJob.role}</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Region</p>
                                    <div className="flex items-center gap-3">
                                        <MapPin size={18} className="text-blue-500" />
                                        <span className="text-lg font-black text-white uppercase">{selectedJob.location}</span>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Confidence ID</p>
                                    <div className="flex items-center gap-3">
                                        <ShieldCheck size={18} className="text-green-500" />
                                        <span className="text-lg font-black text-white uppercase">{(selectedJob.fingerprint || selectedJob.job_id).substring(0, 8)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Job Description (Lightweight Preview) */}
                            <div className="bg-white/5 border border-white/5 rounded-[2rem] p-6 max-h-[300px] overflow-y-auto custom-scrollbar font-mono text-[11px] leading-relaxed text-slate-400 italic">
                                {selectedJob.role} role at {selectedJob.company} in {selectedJob.location}.
                                <br /><br />
                                <span className="opacity-50 text-[9px] uppercase tracking-widest">Metadata Hash: {selectedJob.fingerprint || selectedJob.job_id}</span>
                            </div>

                            {/* Inline Gemini analysis in modal */}
                            {(() => {
                                const m = matchStates[selectedJob.job_id];
                                if (!m) return null;

                                return (
                                    <div className="bg-white/[0.02] border border-white/5 rounded-[2rem] p-6 md:p-8">
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-3">
                                                <Sparkles size={16} className="text-blue-400" />
                                                <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">AI Status: {m.state}</p>
                                            </div>
                                            {m.state === 'FAILED' && (
                                                <button
                                                    onClick={() => runBackgroundAnalysis([selectedJob])}
                                                    className="text-[9px] font-black text-blue-500 hover:text-white uppercase tracking-widest underline underline-offset-4"
                                                >
                                                    Retry Analysis
                                                </button>
                                            )}
                                        </div>
                                        <AnalysisCard jobId={selectedJob.job_id} />
                                        {m.state === 'PENDING' || m.state === 'PROCESSING' ? (
                                            <div className="flex flex-col items-center py-8 gap-4">
                                                <Loader2 size={24} className="animate-spin text-blue-500" />
                                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Analysis in progress... checking data sources</p>
                                            </div>
                                        ) : null}
                                    </div>
                                );
                            })()}

                            <div className="flex flex-col md:flex-row gap-4 pt-4">
                                <button
                                    onClick={async () => {
                                        try {
                                            setMatLoading(true);
                                            setMatError(null);
                                            setMatSuccess(false);

                                            const { data: { user } } = await supabase.auth.getUser();
                                            if (!user) throw new Error("Authentication required");

                                            // ENTERPRISE SAVE: Instant, Deterministic, Idempotent
                                            const { data, error } = await supabase
                                                .from('applications')
                                                .upsert({
                                                    user_id: user.id,
                                                    job_pointer_id: selectedJob.job_id,
                                                    status: 'TRACKED',
                                                    title: selectedJob.role,
                                                    company: selectedJob.company,
                                                    location: selectedJob.location,
                                                    source_url: selectedJob.source_url,
                                                    match_confidence: matchStates[selectedJob.job_id]?.heuristic?.matchScore || 0
                                                }, { onConflict: 'user_id, job_pointer_id' })
                                                .select('id')
                                                .single();

                                            if (error) throw error;
                                            if (data) setLastSavedAppId(data.id);

                                            setMatSuccess(true);
                                            // We don't force navigation here, we just show success. 
                                            // The user can choose to click "Execute" or continue discovery.
                                            setTimeout(() => {
                                                setMatSuccess(false);
                                                // Don't null selectedJob yet, let them click "Execute"
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
                                {(matchStates[selectedJob.job_id]?.state === 'COMPLETED' || lastSavedAppId) && (
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
            )}

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
