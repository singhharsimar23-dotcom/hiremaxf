
import React, { useState, useEffect, useCallback } from 'react';
import { BackgroundJobsProvider } from './lib/backgroundJobs';
import { ErrorBoundary } from './components/ErrorBoundary';
import Header from './components/Header';
import LandingPage from './components/LandingPage';
import AuthView from './components/AuthView';
import { AIReviewView } from './components/AIReviewView';
import { FullReviewView } from './components/FullReviewView';
import { CareerIntelligenceView } from './components/CareerIntelligenceView';
import { ApplicationsView } from './components/ApplicationsView';
import { ApplicationExecutionView } from './components/ApplicationExecutionView';
import { ResumeBuilder } from './components/ResumeBuilder';
import { RebuiltCompareView } from './components/RebuiltCompareView';
import { RebuildStandaloneView } from './components/RebuildStandaloneView';
import { Pricing } from './components/Pricing';
import { ResumeHistoryView } from './components/ResumeHistoryView';
import { SignalHub } from './components/SignalHub';
import { FeatureDetails } from './components/FeatureDetails';
import { AccountSettings } from './components/AccountSettings';
import { Billing } from './components/Billing';
import { FAQ } from './components/FAQ';
import { Contact } from './components/Contact';
import { FeatureTeaser } from './components/FeatureTeaser';
import RealityCheckDetail from './components/ActiveStakingDetail';
import ActionCard from './components/StakingCard';
import { ProfileView } from './components/ProfileView';
import { ExecutionPreviewView } from './components/ExecutionPreviewView';
import DashboardWidget from './components/DashboardWidget';
import { DashboardView } from './components/DashboardView';
import { AdminIntelligence } from './components/AdminIntelligence';
import { AuthBridge } from './components/AuthBridge';
import MarketOutlookView from './components/MarketOutlookView';
import { InterviewPrepView } from './components/InterviewPrepView';
import { CoverLetterView } from './components/CoverLetterView';
import { ApplicationTrackerView } from './components/ApplicationTrackerView';
import { LinkedInOptimizerView } from './components/LinkedInOptimizerView';
import { Footer } from './components/Footer';
import { TermsView } from './components/TermsView';
import { RefundView } from './components/RefundView';
import { PrivacyView } from './components/PrivacyView';
import {
    ShieldCheck, Zap, Lock, Target, BarChart, ArrowRight, Sparkles,
    Shield, UploadCloud, Plus, Info, Circle, X, Loader2, AlertTriangle,
    History, FileText, ChevronRight, Activity
} from 'lucide-react';
import { AppView, DiagnosticResult, UserPlan, ResumeGroup, ResumeVersion, ResumeProfile, StructuredResume, UserProfile, RoleTrack, BackgroundJob, JobType, JobStatus } from './types';
import { supabase } from './lib/supabase';
import { GoogleGenAI } from "@google/genai";
import { QUICK_ACTIONS } from './constants';


function App() {
    const [view, setView] = useState<AppView>('landing');
    const [teaserTarget, setTeaserTarget] = useState<AppView | null>(null);
    const [user, setUser] = useState<any>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);

    const [resumeReceived, setResumeReceived] = useState(false);
    const [pendingResumeText, setPendingResumeText] = useState('');

    const [analysisHistory, setAnalysisHistory] = useState<Record<string, DiagnosticResult>>({});
    const [activeAnalysisId, setActiveAnalysisId] = useState<string | null>(null);

    const [resumeHistory, setResumeHistory] = useState<ResumeGroup[]>([]);
    const [editingResumeId, setEditingResumeId] = useState<string | null>(null);
    const [editingVersionId, setEditingVersionId] = useState<string | null>(null);
    const [selectedApplicationId, setSelectedApplicationId] = useState<string | null>(null);
    const [preFilledSource, setPreFilledSource] = useState<any>(null);

    const [jobs, setJobs] = useState<Record<string, BackgroundJob>>(() => {
        try {
            const saved = localStorage.getItem('hiremax_active_jobs');
            if (!saved || saved === 'undefined' || saved === 'null') return {};
            return JSON.parse(saved);
        } catch (e) {
            console.error("Failed to parse initial jobs:", e);
            return {};
        }
    });

    const plan: UserPlan = profile && profile.plan ? profile.plan : 'Starter';
    const isElite = plan === 'Career Elite' || plan === 'Automation';
    const currentAnalysis = activeAnalysisId ? analysisHistory[activeAnalysisId] : null;

    useEffect(() => {
        localStorage.setItem('hiremax_active_jobs', JSON.stringify(jobs));
    }, [jobs]);

    // Handle basic URL-based routing for OAuth redirects and Back/Forward navigation
    useEffect(() => {
        const handlePopState = () => {
            const path = window.location.pathname.replace('/', '');
            if (path && path !== view) {
                const validViews: AppView[] = ['dashboard', 'profile', 'full-review', 'career-intelligence', 'market-outlook', 'applications', 'rebuild-standalone', 'resume-editor', 'pricing', 'settings', 'billing', 'faq', 'contact', 'admin', 'tracker', 'interview-prep', 'cover-letter', 'linkedin-optimizer', 'history', 'preview', 'ai-review', 'terms', 'privacy', 'refund'];
                if (validViews.includes(path as AppView)) {
                    setView(path as AppView);
                }
            } else if (path === '') {
                setView('landing');
            }
        };

        window.addEventListener('popstate', handlePopState);

        // Initial Hydration
        const path = window.location.pathname.replace('/', '');
        const searchParams = new URLSearchParams(window.location.search);
        const viewParam = searchParams.get('view') as AppView | null;
        const redirectParam = searchParams.get('redirect');

        if (path === 'profile') setView('profile');
        else if (path === 'dashboard') setView('dashboard');
        else if (path === 'intelligence') setView('full-review');

        // Handle ?view= routing (used by extension Auth Bridge and internal redirects)
        if (viewParam === 'auth-bridge') {
            // Do NOT clear search params yet — AuthBridge component needs ext_id from them
            setView('auth-bridge');
        } else if (viewParam === 'auth' && redirectParam) {
            // Post-login redirect from AuthBridge flow
            setView('auth');
        } else if (viewParam && ['dashboard', 'profile', 'pricing', 'settings', 'auth'].includes(viewParam)) {
            setView(viewParam);
            // Safe to clear once routed
            window.history.replaceState({}, document.title, window.location.pathname);
        } else {
            // Clean up URL if it has hash/params from OAuth (but not auth-bridge params)
            if (window.location.hash || (window.location.search && !searchParams.get('ext_id'))) {
                window.history.replaceState({}, document.title, window.location.pathname);
            }
        }

        return () => window.removeEventListener('popstate', handlePopState);
    }, []);


    // SEO & UX: Dynamic Page Titles
    useEffect(() => {
        const titles: Record<string, string> = {
            'landing': 'HireMax | Next-Gen Job Intelligence',
            'dashboard': 'Dashboard | HireMax',
            'profile': 'Profile | HireMax',
            'career-intelligence': 'Market Insights | HireMax',
            'market-outlook': 'Market Radar | HireMax',
            'full-review': 'Market Standing | HireMax',
            'transformation-factory': 'Transformation Factory | HireMax',
            'applications': 'Execution Engine | HireMax',
            'settings': 'Account Settings | HireMax'
        };
        document.title = titles[view] || 'HireMax';
    }, [view]);

    // Mass-Scale Rehydration: Pull active runs from DB on user change/refresh
    useEffect(() => {
        if (!user) return;
        const syncJobs = async () => {
            try {
                const { data: runs, error } = await supabase
                    .from('execution_runs')
                    .select('*')
                    .eq('user_id', user.id)
                    .eq('status', 'running')
                    .limit(5);

                if (runs && !error) {
                    setJobs(prev => {
                        const updated = { ...prev };
                        let changed = false;
                        runs.forEach(run => {
                            if (!updated[run.id]) {
                                const role = run.target_role || "Career Analysis";
                                updated[run.id] = {
                                    id: run.id,
                                    type: role.includes('Outlook') ? 'OUTLOOK' : role.includes('Rebuild') ? 'REBUILD' : 'ANALYSIS',
                                    status: 'RUNNING',
                                    payload: { targetRole: role },
                                    createdAt: run.created_at,
                                    updatedAt: run.created_at
                                };
                                changed = true;
                            }
                        });
                        return changed ? updated : prev;
                    });
                }
            } catch (e) {
                console.error("Sync error:", e);
            }
        };
        syncJobs();
    }, [user]);

    const dispatchJob = useCallback(async (type: JobType, payload: any) => {
        // Fallback for randomUUID which might be missing in some environments
        const id = (crypto as any).randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);

        // Consolidate payload with any derived IDs
        const finalPayload = { ...payload };
        if (type === 'REBUILD' && !finalPayload.resume_id) {
            finalPayload.resume_id = (crypto as any).randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);
        }

        // Pre-register job in DB for mass-scale persistence
        if (user) {
            await supabase.from('execution_runs').insert({
                id,
                user_id: user.id,
                target_role: finalPayload.targetRole || finalPayload.role || "Career Analysis",
                status: 'pending'
            });
        }

        const newJob: BackgroundJob = {
            id,
            type,
            status: 'RUNNING',
            payload: finalPayload,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        setJobs(prev => ({ ...prev, [id]: newJob }));

        // Detached background execution
        (async () => {
            try {
                let result: any;
                if (!user) throw new Error("Must be logged in to execute jobs");
                const commonBody = { ...finalPayload, user_id: user.id, run_id: id };

                if (type === 'ANALYSIS') {
                    const { data, error } = await supabase.functions.invoke('generate-diagnostic', { body: commonBody });
                    if (error) throw error;
                    result = { ...data.results_json, analysisId: data.id };
                } else if (type === 'REBUILD') {
                    // Trigger worker with the version_id (now handled entirely server-side to avoid RLS issues)
                    const { data, error } = await supabase.functions.invoke('generate-rebuild', {
                        body: { ...commonBody, application_id: finalPayload.application_id, resume_id: finalPayload.resume_id }
                    });
                    if (error) throw error;
                    result = { newResume: data.data };
                } else if (type === 'OUTLOOK') {
                    const { data, error } = await supabase.functions.invoke('generate-outlook', { body: commonBody });
                    if (error) throw error;
                    result = data.results_json;
                } else if (type === 'PREP') {
                    const { data, error } = await supabase.functions.invoke('generate-interview-prep', { body: commonBody });
                    if (error) throw error;
                    result = data;
                } else if (type === 'COVER_LETTER') {
                    const { data, error } = await supabase.functions.invoke('generate-cover-letter', { body: commonBody });
                    if (error) throw error;
                    result = data;
                } else if (type === 'LINKEDIN') {
                    const { data, error } = await supabase.functions.invoke('generate-linkedin', { body: commonBody });
                    if (error) throw error;
                    result = data;
                }

                setJobs((prev: Record<string, BackgroundJob>) => {
                    const updated = { ...prev };
                    if (updated[id]) {
                        updated[id] = { ...updated[id], status: 'COMPLETED', result, updatedAt: new Date().toISOString() };
                    }
                    return updated;
                });
            } catch (e: any) {
                console.error("Job execution failed:", e);
                setJobs((prev: Record<string, BackgroundJob>) => {
                    const updated = { ...prev };
                    if (updated[id]) {
                        updated[id] = { ...updated[id], status: 'FAILED', error: e.message || "Execution failed", updatedAt: new Date().toISOString() };
                    }
                    return updated;
                });
            }
        })();

        return id;
    }, [user]);

    // FIX 6: Replace polling with Supabase Realtime subscription on execution_runs.
    // This gives instant job completion feedback vs. up to 15 second polling delay.
    useEffect(() => {
        const runningIds = Object.keys(jobs).filter(id => jobs[id].status === 'RUNNING');
        if (runningIds.length === 0 || !user) return;

        // Closure-safe handler: resolves the final result for a completed run
        const resolveResult = async (runId: string, jobType: string, resumeId?: string): Promise<any> => {
            try {
                if (jobType === 'ANALYSIS') {
                    const { data } = await supabase.from('analyses').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).single();
                    if (data) return { ...data.results_json, analysisId: data.id };
                } else if (jobType === 'REBUILD') {
                    if (resumeId) {
                        const { data } = await supabase.from('resume_versions').select('*').eq('resume_id', resumeId).order('created_at', { ascending: false }).limit(1).single();
                        if (data) return { newResume: data.data };
                    }
                } else if (jobType === 'OUTLOOK') {
                    const { data } = await supabase.from('market_snapshots').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).single();
                    if (data) return data.results_json;
                }
            } catch (err) {
                console.error('Result resolution failed:', err);
            }
            return null;
        };

        const channel = supabase
            .channel(`execution_runs_realtime_${user.id}_${Math.random().toString(36).substring(2, 9)}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'execution_runs',
                    filter: `user_id=eq.${user.id}`
                },
                async (payload) => {
                    const remote = payload.new as { id: string; status: string; error_reason?: string };
                    if (!runningIds.includes(remote.id)) return;

                    const job = jobs[remote.id];
                    if (!job) return;

                    if (remote.status === 'completed') {
                        const fetchedResult = await resolveResult(remote.id, job.type, job.payload?.resume_id);
                        setJobs(prev => ({
                            ...prev,
                            [remote.id]: { ...prev[remote.id], status: 'COMPLETED', result: fetchedResult, updatedAt: new Date().toISOString() }
                        }));
                    } else if (remote.status === 'failed') {
                        setJobs(prev => ({
                            ...prev,
                            [remote.id]: { ...prev[remote.id], status: 'FAILED', error: remote.error_reason || 'Execution failed', updatedAt: new Date().toISOString() }
                        }));
                    }
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [jobs, user]);

    // Stable ref so onAuthStateChange can read latest view without stale closure
    const viewRef = React.useRef<AppView>(view);
    useEffect(() => { viewRef.current = view; }, [view]);

    useEffect(function () {
        async function initAuth() {
            const { data: { session } } = await supabase.auth.getSession();
            setUser(session && session.user ? session.user : null);
            if (session && session.user) await fetchUserData(session.user);
            setLoading(false);

            const { data: { subscription } } = supabase.auth.onAuthStateChange(async function (event, session) {
                setUser(session && session.user ? session.user : null);
                if (session && session.user) {
                    await fetchUserData(session.user);
                    // FIX 1: Navigate to dashboard after OAuth/email login if user is on
                    // the landing or auth page. Without this, the user stays on 'landing'
                    // because onAuthStateChange never drove navigation previously.
                    if (event === 'SIGNED_IN') {
                        const cv = viewRef.current;
                        if (cv === 'auth') {
                            // Preserve auth-bridge flow: if redirect=auth-bridge is in URL, go there instead
                            const params = new URLSearchParams(window.location.search);
                            if (params.get('redirect') === 'auth-bridge' || params.get('view') === 'auth-bridge') {
                                setView('auth-bridge');
                                window.history.pushState({}, '', '/auth-bridge');
                            } else {
                                setView('dashboard');
                                window.history.pushState({}, '', '/dashboard');
                            }
                        }
                    }
                } else {
                    setProfile(null);
                    setResumeHistory([]);
                    setAnalysisHistory({});
                }
            });

            return function () {
                subscription.unsubscribe();
            };
        }

        initAuth();
    }, []);

    async function fetchUserData(authUser: any) {
        const { data: existingProfile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', authUser.id)
            .single();

        const providers = authUser.identities?.map((i: any) => i.provider) || [];
        if (authUser.app_metadata?.provider && !providers.includes(authUser.app_metadata.provider)) {
            providers.push(authUser.app_metadata.provider);
        }
        const uniqueProviders: string[] = Array.from(new Set(providers));

        let updatedProfile: UserProfile;

        if (!existingProfile) {
            const { data: newProfile, error: insertError } = await supabase.from('profiles').insert({
                id: authUser.id,
                email: authUser.email,
                full_name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'User',
                avatar_url: authUser.user_metadata?.avatar_url || null,
                plan: 'Starter',
                domain: 'UNSELECTED',
                credits: 0,
                connected_providers: uniqueProviders
            }).select().single();

            if (insertError) return;
            updatedProfile = newProfile as UserProfile;
        } else {
            updatedProfile = existingProfile as UserProfile;
        }

        setProfile(updatedProfile);

        const resumesResult = await supabase
            .from('resumes')
            .select('*, resume_versions(*)')
            .eq('user_id', authUser.id)
            .order('created_at', { ascending: false });

        const resumes = resumesResult.data;
        if (resumes) {
            const mapped = resumes.map(function (r: any) {
                return {
                    id: r.id,
                    name: r.name,
                    versions: (r.resume_versions || []).map(function (v: any) {
                        return {
                            versionId: v.id,
                            type: v.version_type,
                            createdAt: v.created_at,
                            updatedAt: v.created_at,
                            templateId: v.template_id,
                            data: v.data,
                            status: v.status,
                            error_reason: v.error_reason
                        };
                    })
                };
            });
            setResumeHistory(mapped);
        }

        const analysesResult = await supabase
            .from('analyses')
            .select('*')
            .eq('user_id', authUser.id)
            .order('created_at', { ascending: false });

        const analyses = analysesResult.data;
        if (analyses) {
            const hist: Record<string, DiagnosticResult> = {};
            analyses.forEach(function (a: any) {
                hist[a.id] = Object.assign({}, a.results_json, { analysisId: a.id });
            });
            setAnalysisHistory(hist);
            if (analyses.length > 0) setActiveAnalysisId(analyses[0].id);
        }
    }

    // Subscribe to resume_versions for live history updates once per user session
    useEffect(() => {
        if (!user) return;

        const channel = supabase
            .channel(`resume_versions_live_${user.id}_${Math.random().toString(36).substring(2, 9)}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'resume_versions' }, () => {
                fetchUserData(user);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user]);

    const handleSaveToProfile = async (version: ResumeVersion, label: string) => {
        if (!profile || !user) return;

        const newProfileEntry: ResumeProfile = {
            id: version.versionId,
            label: label,
            targetRole: version.data.summary?.slice(0, 50) || "Professional Profile",
            isPrimary: true,
            data: version.data as StructuredResume
        };

        const updatedProfiles = [
            newProfileEntry,
            ...(profile.resume_profiles || []).map(p => ({ ...p, isPrimary: false }))
        ].slice(0, 5);

        const { data: updated, error } = await supabase
            .from('profiles')
            .update({ resume_profiles: updatedProfiles })
            .eq('id', user.id)
            .select()
            .single();

        if (!error && updated) {
            setProfile(updated as UserProfile);
        }
    };

    const handleSetView = useCallback((targetView: AppView, id?: string, data?: any) => {
        const eliteRequired = ['career-intelligence', 'transformation-factory', 'applications'];
        if (eliteRequired.indexOf(targetView) !== -1 && !isElite) {
            setTeaserTarget(targetView);
            setView('dashboard');
            window.history.pushState({}, '', '/dashboard');
            return;
        }
        setTeaserTarget(null);
        setView(targetView);
        if (id) {
            setSelectedApplicationId(id);
        } else {
            setSelectedApplicationId(null);
        }
        if (targetView === 'rebuild-standalone' && data?.preFilled) {
            setPreFilledSource(data.preFilled);
        }
        window.history.pushState({}, '', `/${targetView === 'landing' ? '' : targetView}${id ? `?id=${id}` : ''}`);
    }, [isElite, profile, user]);

    const isProtectedRoute = ['dashboard', 'applications', 'ai-review', 'full-review', 'career-intelligence', 'market-outlook', 'rebuild-standalone', 'profile', 'history', 'resume-editor', 'settings', 'billing', 'interview-prep', 'cover-letter', 'tracker', 'linkedin-optimizer', 'preview', 'admin'].includes(view);
    const activeView = (isProtectedRoute && !loading && !user) ? 'auth' : view;

    const showNav = activeView !== 'landing' && activeView !== 'auth' && user;
    const isLegalPage = activeView === 'terms' || activeView === 'privacy' || activeView === 'refund';
    const showFooter = activeView === 'landing' || isLegalPage || activeView === 'pricing';

    const hasActiveJob = (Object.values(jobs) as BackgroundJob[]).some(j => j.status === 'RUNNING');

    if (loading && activeView !== 'landing') {
        return (
            <div className="min-h-screen bg-[#0F1117] flex items-center justify-center flex-col gap-6">
                <div className="relative">
                    <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center border border-blue-500/20">
                        <Shield className="h-8 w-8 text-blue-400" />
                    </div>
                    <div className="absolute inset-0 border-2 border-blue-500/50 rounded-2xl animate-ping opacity-20" />
                </div>
                <div className="flex flex-col items-center gap-2">
                    <div className="flex items-center gap-2 text-blue-400 font-bold tracking-widest text-sm uppercase">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Initializing Core</span>
                    </div>
                    <p className="text-slate-500 text-xs">Authenticating session...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0F1117] flex flex-col antialiased">
            {showNav && (
                <Header currentView={teaserTarget || activeView} setView={handleSetView} plan={plan} onNewResume={() => handleSetView('resume-editor')} />
            )}

            {hasActiveJob && showNav && (
                <div className="fixed bottom-6 right-6 z-[200] bg-[#16161E] border border-blue-500/30 px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-4 animate-in slide-in-from-bottom-4 duration-500">
                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                    <span className="text-[10px] font-black text-white uppercase tracking-widest">Background Engine Active</span>
                    <Loader2 size={14} className="text-blue-500 animate-spin" />
                </div>
            )}

            <main className={"flex-1 flex flex-col " + (showNav ? 'pt-20' : '')}>
                <ErrorBoundary name="Core Engine">
                    <div className="flex-1 overflow-y-auto">
                    {teaserTarget ? (
                        <div className="animate-in fade-in duration-500">
                            <FeatureTeaser targetView={teaserTarget} onUpgrade={function () { setTeaserTarget(null); setView('pricing'); }} />
                            <div className="bg-[#0F1117] pb-24">
                                <Pricing setPlan={async function (p) {
                                    if (user) {
                                        await supabase.from('profiles').update({ plan: p }).eq('id', user.id);

                                        setProfile(Object.assign({}, profile, { plan: p }));
                                    }
                                    setTeaserTarget(null);
                                    handleSetView('dashboard');
                                }} setView={handleSetView} currentPlan={plan} />
                            </div>
                        </div>
                    ) : (
                        <>
                            {activeView === 'landing' && <LandingPage
                                onGetStarted={() => handleSetView(user ? 'dashboard' : 'auth')}
                                onViewPlans={() => handleSetView('pricing')}
                                onViewTerms={() => handleSetView('terms')}
                                onViewPrivacy={() => handleSetView('privacy')}
                                onViewRefund={() => handleSetView('refund')}
                            />}
                            {activeView === 'auth' && (
                                <AuthView
                                    onSuccess={() => {
                                        const params = new URLSearchParams(window.location.search);
                                        if (params.get('redirect') === 'auth-bridge') {
                                            setView('auth-bridge');
                                        } else {
                                            handleSetView('dashboard');
                                        }
                                    }}
                                />
                            )}
                            {activeView === 'auth-bridge' && <AuthBridge />}
                            {activeView === 'dashboard' && (
                                <DashboardView
                                    currentAnalysis={currentAnalysis}
                                    plan={plan}
                                    onNavigate={handleSetView}
                                    user={user}
                                    history={resumeHistory}
                                />
                            )}
                            {activeView === 'applications' && <ApplicationExecutionView user={profile} applicationId={selectedApplicationId || undefined} onNavigate={handleSetView} />}
                            {activeView === 'ai-review' && <AIReviewView plan={plan} onResult={(r) => {
                                setAnalysisHistory(prev => ({ ...prev, [r.analysisId]: r }));
                                setActiveAnalysisId(r.analysisId);
                                handleSetView('full-review');
                            }} onUpload={(t) => { }} pendingResumeText={pendingResumeText} onUpgrade={function () { handleSetView('pricing'); }} onStartScratch={() => handleSetView('resume-editor')} activeJobs={jobs} dispatchJob={dispatchJob} />}
                            {activeView === 'full-review' && (
                                <ErrorBoundary name="Market Standing">
                                    <FullReviewView
                                        result={currentAnalysis}
                                        plan={plan}
                                        onUpgrade={function () { handleSetView('pricing'); }}
                                        onRebuildRequest={(id) => handleSetView('rebuild-standalone')}
                                        setView={handleSetView}
                                        analysisHistory={analysisHistory}
                                        setActiveAnalysisId={setActiveAnalysisId}
                                    />
                                </ErrorBoundary>
                            )}
                            <div style={{ display: activeView === 'career-intelligence' ? 'block' : 'none' }}>
                                <CareerIntelligenceView
                                    analysisResult={currentAnalysis}
                                    resumeText={currentAnalysis && currentAnalysis.resumeText ? currentAnalysis.resumeText : ''}
                                    plan={plan}
                                    setView={handleSetView}
                                    activeJobs={jobs}
                                    dispatchJob={dispatchJob}
                                />
                            </div>

                            <div style={{ display: activeView === 'market-outlook' ? 'block' : 'none' }}>
                                <MarketOutlookView />
                            </div>
                            {activeView === 'rebuild-standalone' && <RebuildStandaloneView
                                plan={plan}
                                credits={profile && profile.credits ? profile.credits : 0}
                                setCredits={async function (c) { }}
                                onRebuildSuccess={async function (rebuilt: any, vid?: string, label?: string, gid?: string) {
                                    if (user) await fetchUserData(user);
                                    setPreFilledSource(null); // Clear context on success
                                    if (gid && vid) {
                                        setEditingResumeId(gid);
                                        setEditingVersionId(vid);
                                        handleSetView('resume-editor');
                                    } else {
                                        setView('history');
                                    }
                                }}
                                onUpgrade={function () { handleSetView('pricing'); }}
                                history={resumeHistory}
                                activeJobs={jobs}
                                dispatchJob={dispatchJob}
                                preFilledContext={preFilledSource}
                            />}
                            {activeView === 'profile' && <ProfileView />}
                            {activeView === 'history' && <ResumeHistoryView
                                history={resumeHistory}
                                analysisHistory={analysisHistory}
                                onEdit={function (gid, vid) {
                                    setEditingResumeId(gid);
                                    setEditingVersionId(vid);
                                    handleSetView('resume-editor');
                                }}
                                onView={function (gid, vid) {
                                    setEditingResumeId(gid);
                                    setEditingVersionId(vid);
                                    handleSetView('resume-editor');
                                }}
                                onStartNew={function () { handleSetView('ai-review'); }}
                                onSaveToProfile={handleSaveToProfile}
                                dispatchJob={dispatchJob}
                            />}

                            {activeView === 'preview' && <ExecutionPreviewView onNavigate={(view: AppView, id?: string) => handleSetView(view, id)} />}
                            {activeView === 'resume-editor' && <ResumeBuilder plan={plan} groupId={editingResumeId} versionId={editingVersionId} history={resumeHistory} onBack={function () { handleSetView('dashboard'); }} />}
                            {activeView === 'pricing' && <Pricing setPlan={async function (p) { }} setView={handleSetView} currentPlan={plan} />}
                            {activeView === 'settings' && <AccountSettings plan={plan} profile={profile} />}
                            {activeView === 'billing' && <Billing plan={plan} setView={handleSetView} />}
                            {activeView === 'faq' && <FAQ setView={handleSetView} />}
                            {activeView === 'contact' && <Contact user={user} />}
                            {activeView === 'admin' && <ErrorBoundary name="Admin"><AdminIntelligence /></ErrorBoundary>}
                            {activeView === 'interview-prep' && <InterviewPrepView plan={plan} history={resumeHistory} user={user} onUpgrade={() => handleSetView('pricing')} dispatchJob={dispatchJob} activeJobs={jobs} />}
                            {activeView === 'cover-letter' && <CoverLetterView plan={plan} history={resumeHistory} user={user} onUpgrade={() => handleSetView('pricing')} dispatchJob={dispatchJob} activeJobs={jobs} />}
                            {activeView === 'tracker' && <ApplicationTrackerView plan={plan} user={user} history={resumeHistory} onUpgrade={() => handleSetView('pricing')} />}
                            {activeView === 'linkedin-optimizer' && <LinkedInOptimizerView plan={plan} history={resumeHistory} user={user} onUpgrade={() => handleSetView('pricing')} dispatchJob={dispatchJob} activeJobs={jobs} />}
                            {activeView === 'terms' && <TermsView setView={handleSetView} />}
                            {activeView === 'privacy' && <PrivacyView setView={handleSetView} />}
                            {activeView === 'refund' && <RefundView setView={handleSetView} />}

                            {/* FIX 2: Ghost route stubs — prevent blank screens for defined-but-unrendered AppView values */}
                            {(['signal-hub', 'recruiter-scan', 'rejection-model', 'role-saturation', 'skill-radar', 'longevity-estimate', 'admin-ops'] as const).map(ghostView =>
                                activeView === ghostView ? (
                                    <div key={ghostView} className="flex flex-col items-center justify-center min-h-[70vh] gap-6 text-center px-6">
                                        <div className="w-16 h-16 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center">
                                            <Loader2 size={28} className="text-slate-600" />
                                        </div>
                                        <div className="space-y-2">
                                            <h2 className="text-lg font-black text-white uppercase tracking-tight">{ghostView.replace(/-/g, ' ')}</h2>
                                            <p className="text-slate-500 text-sm font-medium">This module is in development and will be available in a future release.</p>
                                        </div>
                                        <button
                                            onClick={() => handleSetView('dashboard')}
                                            className="text-[10px] font-black text-blue-500 hover:text-white uppercase tracking-widest transition-colors"
                                        >
                                            ← Return to Dashboard
                                        </button>
                                    </div>
                                ) : null
                            )}
                        </>
                    )}
                    </div>
                </ErrorBoundary>
            </main>
            {showFooter && <Footer setView={handleSetView} />}
        </div>
    );
}

function AppWithProviders() {
  return <BackgroundJobsProvider><App /></BackgroundJobsProvider>;
}

export default AppWithProviders;
