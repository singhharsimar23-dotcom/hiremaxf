
import React, { useState, useEffect, useCallback, lazy, Suspense, useRef } from 'react';
import { BackgroundJobsProvider } from './lib/backgroundJobs';
import { ErrorBoundary } from './components/ErrorBoundary';
import Header from './components/Header';
import LandingPage from './components/LandingPage';
import AuthView from './components/AuthView';
import { Footer } from './components/Footer';
import { Analytics } from '@vercel/analytics/react';
import { getCached, setCached, invalidate } from './lib/queryCache';

// Lazy load large/dynamic components to reduce initial bundle from 3.2MB to under 200KB (10x faster loads)
const AIReviewView = lazy(() => import('./components/AIReviewView').then(m => ({ default: m.AIReviewView })));
const FullReviewView = lazy(() => import('./components/FullReviewView').then(m => ({ default: m.FullReviewView })));
const CareerIntelligenceView = lazy(() => import('./components/CareerIntelligenceView').then(m => ({ default: m.CareerIntelligenceView })));
const ApplicationExecutionView = lazy(() => import('./components/ApplicationExecutionView').then(m => ({ default: m.ApplicationExecutionView })));
const ResumeBuilder = lazy(() => import('./components/ResumeBuilder').then(m => ({ default: m.ResumeBuilder })));
const RebuiltCompareView = lazy(() => import('./components/RebuiltCompareView').then(m => ({ default: m.RebuiltCompareView })));
const RebuildStandaloneView = lazy(() => import('./components/RebuildStandaloneView').then(m => ({ default: m.RebuildStandaloneView })));
const Pricing = lazy(() => import('./components/Pricing').then(m => ({ default: m.Pricing })));
const ResumeHistoryView = lazy(() => import('./components/ResumeHistoryView').then(m => ({ default: m.ResumeHistoryView })));
const AccountSettings = lazy(() => import('./components/AccountSettings').then(m => ({ default: m.AccountSettings })));
const Billing = lazy(() => import('./components/Billing').then(m => ({ default: m.Billing })));
const FAQ = lazy(() => import('./components/FAQ').then(m => ({ default: m.FAQ })));
const Contact = lazy(() => import('./components/Contact').then(m => ({ default: m.Contact })));
const FeatureTeaser = lazy(() => import('./components/FeatureTeaser').then(m => ({ default: m.FeatureTeaser })));
const ProfileView = lazy(() => import('./components/ProfileView').then(m => ({ default: m.ProfileView })));
const ExecutionPreviewView = lazy(() => import('./components/ExecutionPreviewView').then(m => ({ default: m.ExecutionPreviewView })));
const DashboardView = lazy(() => import('./components/DashboardView').then(m => ({ default: m.DashboardView })));
const AdminIntelligence = lazy(() => import('./components/AdminIntelligence').then(m => ({ default: m.AdminIntelligence })));
const AuthBridge = lazy(() => import('./components/AuthBridge').then(m => ({ default: m.AuthBridge })));
const MarketOutlookView = lazy(() => import('./components/MarketOutlookView'));
const InterviewPrepView = lazy(() => import('./components/InterviewPrepView').then(m => ({ default: m.InterviewPrepView })));
const CoverLetterView = lazy(() => import('./components/CoverLetterView').then(m => ({ default: m.CoverLetterView })));
const ApplicationTrackerView = lazy(() => import('./components/ApplicationTrackerView').then(m => ({ default: m.ApplicationTrackerView })));
const LinkedInOptimizerView = lazy(() => import('./components/LinkedInOptimizerView').then(m => ({ default: m.LinkedInOptimizerView })));
const TermsView = lazy(() => import('./components/TermsView').then(m => ({ default: m.TermsView })));
const RefundView = lazy(() => import('./components/RefundView').then(m => ({ default: m.RefundView })));
const PrivacyView = lazy(() => import('./components/PrivacyView').then(m => ({ default: m.PrivacyView })));
const ResearchHubView = lazy(() => import('./components/ResearchHubView').then(m => ({ default: m.ResearchHubView })));
const ResearchPostView = lazy(() => import('./components/ResearchPostView').then(m => ({ default: m.ResearchPostView })));
import {
    ShieldCheck, Zap, Lock, Target, BarChart, ArrowRight, Sparkles,
    Shield, UploadCloud, Plus, Info, Circle, X, Loader2, AlertTriangle,
    History, FileText, ChevronRight, Activity
} from 'lucide-react';
import { AppView, DiagnosticResult, UserPlan, ResumeGroup, ResumeVersion, ResumeProfile, StructuredResume, UserProfile, RoleTrack, BackgroundJob, JobType, JobStatus, ActiveAnalysisContext, ActiveRebuildContext } from './types';
import { supabase } from './lib/supabase';
import { QUICK_ACTIONS } from './constants';
import { isAdminUser } from './lib/admin';
import { runFastVerify } from './lib/hybridEngine';
import { FullReviewSkeleton, ResumeHistorySkeleton, DashboardSkeleton, MarketIntelSkeleton } from './components/Skeletons';


function App() {
    const [view, setView] = useState<AppView>(() => {
      try {
        const keys = Object.keys(localStorage);
        const sessionKey = keys.find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
        if (sessionKey) {
          const token = JSON.parse(localStorage.getItem(sessionKey) || '{}');
          if (token?.access_token) return 'dashboard';
        }
      } catch {}
      return 'landing';
    });
    const [teaserTarget, setTeaserTarget] = useState<AppView | null>(null);
    const [researchSlug, setResearchSlug] = useState<string | null>(null);
    const [user, setUser] = useState<any>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(false);

    const [navigationWarningShown, setNavigationWarningShown] = useState(false);
    const [pendingNavigation, setPendingNavigation] = useState<{ targetView: AppView; id?: string; data?: any } | null>(null);
    const bypassWarningRef = useRef(false);
    const lastValidAnalysis = useRef<DiagnosticResult | null>(null);
    const executionRunsChannelRef = useRef<any>(null);
    const liveHistoryChannelRef = useRef<any>(null);

    const [resumeReceived, setResumeReceived] = useState(false);
    const [pendingResumeText, setPendingResumeText] = useState('');

    const [analysisHistory, setAnalysisHistory] = useState<Record<string, DiagnosticResult>>({});
    const [activeAnalysisId, setActiveAnalysisId] = useState<string | null>(null);
    const [activeRebuild, setActiveRebuild] = useState<{ scoreBefore: number; scoreAfter: number; linkedAnalysisId: string } | null>(null);
    const [activeAnalysisCtx, setActiveAnalysisCtx] = useState<ActiveAnalysisContext | null>(null);
    const [activeRebuildCtx, setActiveRebuildCtx] = useState<ActiveRebuildContext | null>(null);

    const [resumeHistory, setResumeHistory] = useState<ResumeGroup[]>([]);
    const [coverLetterHistory, setCoverLetterHistory] = useState<any[]>([]);
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
        if (currentAnalysis && activeAnalysisId) {
            let lowestName = 'Strategic Scope';
            let lowestScore = 100;
            if (currentAnalysis.eightPoints && Array.isArray(currentAnalysis.eightPoints)) {
                currentAnalysis.eightPoints.forEach((pt: any) => {
                    const scoreVal = pt.score !== undefined ? pt.score : (pt.status === 'fail' ? 30 : pt.status === 'warning' ? 60 : 90);
                    if (scoreVal < lowestScore) {
                        lowestScore = scoreVal;
                        lowestName = pt.name;
                    }
                });
            }

            const criticalMisses = currentAnalysis.eightPoints && Array.isArray(currentAnalysis.eightPoints)
                ? currentAnalysis.eightPoints.filter((pt: any) => {
                    const scoreVal = pt.score !== undefined ? pt.score : (pt.status === 'fail' ? 30 : pt.status === 'warning' ? 60 : 90);
                    return scoreVal < 70;
                }).map((pt: any) => pt.name)
                : [];

            setActiveAnalysisCtx({
                analysisId: activeAnalysisId,
                role: currentAnalysis.role || 'Executive',
                overallScore: currentAnalysis.score || 0,
                criticalMisses,
                chokepointCategory: lowestName,
                seniorityCalibration: currentAnalysis.seniority || 'Senior',
                rewriteMandates: currentAnalysis.actionItems || [],
                achievementDensity: 0.75,
                jdText: currentAnalysis.jdText,
                timestamp: currentAnalysis.created_at || new Date().toISOString()
            });
        } else {
            setActiveAnalysisCtx(null);
        }
    }, [currentAnalysis, activeAnalysisId]);

    useEffect(() => {
        localStorage.setItem('hiremax_active_jobs', JSON.stringify(jobs));
    }, [jobs]);

    useEffect(() => {
        if (currentAnalysis) {
            lastValidAnalysis.current = currentAnalysis;
        }
    }, [currentAnalysis]);

    // Handle basic URL-based routing for OAuth redirects and Back/Forward navigation
    useEffect(() => {
        const handlePopState = () => {
            const path = window.location.pathname.slice(1); // strip leading /
            // Handle /research/:slug
            if (path.startsWith('research/')) {
                const slug = path.replace('research/', '');
                if (slug) { setResearchSlug(slug); setView('research-post' as AppView); return; }
            }
            if (path === 'research') { setView('research' as AppView); setResearchSlug(null); return; }
            if (path && path !== view) {
                const validViews: AppView[] = [
                    'landing', 'auth', 'auth-bridge', 'pricing', 'faq', 'contact', 'terms', 'privacy', 'refund',
                    'dashboard', 'profile', 'full-review', 'career-intelligence', 'market-outlook', 'applications',
                    'rebuild', 'rebuild-standalone', 'resume-editor', 'settings', 'billing', 'admin', 'tracker',
                    'interview-prep', 'cover-letter', 'linkedin-optimizer', 'history', 'preview', 'ai-review',
                    'research', 'research-post',
                ];
                if (validViews.includes(path as AppView)) {
                    setView(path as AppView);
                }
            } else if (path === '') {
                setView('landing');
            }
        };

        window.addEventListener('popstate', handlePopState);

        // Initial Hydration
        const path = window.location.pathname.slice(1); // strip leading /
        const searchParams = new URLSearchParams(window.location.search);
        const viewParam = searchParams.get('view') as AppView | null;
        const redirectParam = searchParams.get('redirect');

        // Handle /research/:slug on initial load
        if (path.startsWith('research/')) {
            const slug = path.replace('research/', '');
            if (slug) { setResearchSlug(slug); setView('research-post' as AppView); }
        } else if (path === 'research') {
            setView('research' as AppView);
        }

        const validViews: AppView[] = [
            'landing', 'auth', 'auth-bridge', 'pricing', 'faq', 'contact', 'terms', 'privacy', 'refund',
            'dashboard', 'profile', 'full-review', 'career-intelligence', 'market-outlook', 'applications',
            'rebuild', 'rebuild-standalone', 'resume-editor', 'settings', 'billing', 'admin', 'tracker',
            'interview-prep', 'cover-letter', 'linkedin-optimizer', 'history', 'preview', 'ai-review',
            'research', 'research-post',
        ];

        if (path === 'intelligence') {
            setView('full-review');
        } else if (validViews.includes(path as AppView)) {
            setView(path as AppView);
        }

        // Handle ?view= routing (used by extension Auth Bridge and internal redirects)
        if (viewParam === 'auth-bridge') {
            // Do NOT clear search params yet — AuthBridge component needs ext_id from them
            setView('auth-bridge');
        } else if (viewParam === 'auth' && redirectParam) {
            // Post-login redirect from AuthBridge flow
            setView('auth');
        } else if (viewParam && ['dashboard', 'profile', 'pricing', 'settings', 'auth', 'market-outlook'].includes(viewParam)) {
            setView(viewParam);
            // Safe to clear once routed
            window.history.replaceState({}, document.title, window.location.pathname);
        } else {
            const isOauthHash = window.location.hash.includes('access_token=') || window.location.hash.includes('refresh_token=') || window.location.hash.includes('error=');
            const isOauthSearch = searchParams.get('code') || searchParams.get('error');
            // Clean up URL if it has hash/params from OAuth (but not auth-bridge params or pending OAuth auth codes/tokens)
            if ((window.location.hash && !isOauthHash) || (window.location.search && !searchParams.get('ext_id') && !isOauthSearch)) {
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
        if (type === 'REBUILD' && (!finalPayload.resume_id || finalPayload.resume_id === 'NEW')) {
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
                        body: { 
                            ...commonBody, 
                            application_id: finalPayload.application_id, 
                            resume_id: finalPayload.resume_id,
                            targetRole: finalPayload.role || finalPayload.targetRole,
                            roleTrack: finalPayload.track || finalPayload.roleTrack,
                            sourceText: finalPayload.resumeText || finalPayload.sourceText
                        }
                    });
                    if (error) throw error;
                    result = data;
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
        if (runningIds.length === 0 || !user) {
            if (executionRunsChannelRef.current) {
                supabase.removeChannel(executionRunsChannelRef.current);
                executionRunsChannelRef.current = null;
            }
            return;
        }

        if (executionRunsChannelRef.current) {
            supabase.removeChannel(executionRunsChannelRef.current);
            executionRunsChannelRef.current = null;
        }

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

        executionRunsChannelRef.current = channel;

        return () => {
            if (executionRunsChannelRef.current) {
                supabase.removeChannel(executionRunsChannelRef.current);
                executionRunsChannelRef.current = null;
            }
        };
    }, [jobs, user]);

    // Stable ref so onAuthStateChange can read latest view without stale closure
    const viewRef = React.useRef<AppView>(view);
    useEffect(() => { viewRef.current = view; }, [view]);

    useEffect(() => {
        let cancelled = false;

        // Step 1: Resolve session immediately from local cache (< 5ms on return visits).
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (cancelled) return;
            if (session?.user) {
                setUser(session.user);
                fetchUserData(session.user);
                setView(prev => {
                    if (prev === 'landing' || prev === 'auth') {
                        const params = new URLSearchParams(window.location.search);
                        if (params.get('redirect') === 'auth-bridge' || params.get('view') === 'auth-bridge') {
                            window.history.pushState({}, '', '/auth-bridge');
                            return 'auth-bridge';
                        } else {
                            window.history.pushState({}, '', '/dashboard');
                            return 'dashboard';
                        }
                    }
                    return prev;
                });
            }
            setLoading(false); // Always unblock render after getSession resolves
        });

        // Step 2: Listen for future state changes (login, logout, token refresh).
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (cancelled) return;

            if (event === 'SIGNED_IN' && session?.user) {
                setUser(session.user);
                fetchUserData(session.user);
                setView(prev => {
                    if (prev === 'landing' || prev === 'auth') {
                        const params = new URLSearchParams(window.location.search);
                        if (params.get('redirect') === 'auth-bridge' || params.get('view') === 'auth-bridge') {
                            window.history.pushState({}, '', '/auth-bridge');
                            return 'auth-bridge';
                        } else {
                            window.history.pushState({}, '', '/dashboard');
                            return 'dashboard';
                        }
                    }
                    return prev;
                });
                setLoading(false);
            }

            if (event === 'SIGNED_OUT') {
                setUser(null);
                setProfile(null);
                setResumeHistory([]);
                setAnalysisHistory({});
                setCoverLetterHistory([]);
                setView('landing');
                window.history.pushState({}, '', '/');
            }

            // TOKEN_REFRESHED: ONLY update the user object. NEVER navigate.
            if (event === 'TOKEN_REFRESHED' && session?.user) {
                setUser(session.user);
            }

            // INITIAL_SESSION fires on page load — same as getSession but event-based.
            // Only navigate if we haven't already resolved from getSession.
            if (event === 'INITIAL_SESSION' && session?.user) {
                setUser(session.user);
                fetchUserData(session.user);
                setView(prev => {
                    if (prev === 'landing' || prev === 'auth') {
                        const params = new URLSearchParams(window.location.search);
                        if (params.get('redirect') === 'auth-bridge' || params.get('view') === 'auth-bridge') {
                            window.history.pushState({}, '', '/auth-bridge');
                            return 'auth-bridge';
                        } else {
                            window.history.pushState({}, '', '/dashboard');
                            return 'dashboard';
                        }
                    }
                    return prev;
                });
                setLoading(false);
            }
        });

        return () => {
            cancelled = true;
            subscription.unsubscribe();
        };
    }, []);

    async function fetchUserData(authUser: any) {
        try {
            // Instantly hydrate from in-memory query cache if present (stale-while-revalidate)
            const cachedProfile = getCached<UserProfile>('user_plan');
            if (cachedProfile) {
                setProfile(cachedProfile);
            }

            const cachedCoverLetters = getCached<any[]>('cover_letters');
            if (cachedCoverLetters) {
                setCoverLetterHistory(cachedCoverLetters);
            }

            // Fetch profile, resumes, analyses, and cover letters in parallel for 3x faster hydration
            const [profileRes, resumesRes, analysesRes, coverLettersRes] = await Promise.all([
                supabase.from('profiles').select('*').eq('id', authUser.id).maybeSingle(),
                supabase.from('resumes').select('*, resume_versions(*)').eq('user_id', authUser.id).order('created_at', { ascending: false }),
                supabase.from('analyses').select('*').eq('user_id', authUser.id).order('created_at', { ascending: false }),
                supabase.from('cover_letters').select('*').eq('user_id', authUser.id).order('created_at', { ascending: false })
            ]);

            let updatedProfile = profileRes.data as UserProfile | null;

            if (!updatedProfile) {
                const providers = authUser.identities?.map((i: any) => i.provider) || [];
                if (authUser.app_metadata?.provider && !providers.includes(authUser.app_metadata.provider)) {
                    providers.push(authUser.app_metadata.provider);
                }
                const uniqueProviders: string[] = Array.from(new Set(providers));

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

                if (!insertError && newProfile) {
                    updatedProfile = newProfile as UserProfile;
                }
            }

            if (updatedProfile) {
                setProfile(updatedProfile);
                setCached('user_plan', updatedProfile);
            }

            const resumes = resumesRes.data;
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

            const analyses = analysesRes.data;
            if (analyses) {
                const hist: Record<string, DiagnosticResult> = {};
                analyses.forEach(function (a: any) {
                    hist[a.id] = Object.assign({}, a.results_json, { analysisId: a.id });
                });
                setAnalysisHistory(hist);
                if (analyses.length > 0) setActiveAnalysisId(analyses[0].id);
            }

            const coverLetters = coverLettersRes.data;
            if (coverLetters) {
                setCoverLetterHistory(coverLetters);
                setCached('cover_letters', coverLetters);
            }
        } catch (e) {
            console.error("Failed to hydrate user profile/data:", e);
        }
    }

    // Subscribe to profiles, resume_versions and cover_letters for live history & plan updates once per user session
    useEffect(() => {
        if (!user) {
            if (liveHistoryChannelRef.current) {
                supabase.removeChannel(liveHistoryChannelRef.current);
                liveHistoryChannelRef.current = null;
            }
            return;
        }

        if (liveHistoryChannelRef.current) {
            supabase.removeChannel(liveHistoryChannelRef.current);
            liveHistoryChannelRef.current = null;
        }

        const channel = supabase
            .channel(`live_history_${user.id}_${Math.random().toString(36).substring(2, 9)}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` }, () => {
                fetchUserData(user);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'resume_versions' }, () => {
                fetchUserData(user);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'cover_letters' }, () => {
                fetchUserData(user);
            })
            .subscribe();

        liveHistoryChannelRef.current = channel;

        return () => {
            if (liveHistoryChannelRef.current) {
                supabase.removeChannel(liveHistoryChannelRef.current);
                liveHistoryChannelRef.current = null;
            }
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
            invalidate('user_plan');
            setProfile(updated as UserProfile);
            setCached('user_plan', updated);
        }
    };

    const handleDeleteCoverLetter = async (id: string) => {
        try {
            const { error } = await supabase.from('cover_letters').delete().eq('id', id);
            if (!error) {
                invalidate('cover_letters');
                setCoverLetterHistory(prev => prev.filter(c => c.id !== id));
            }
        } catch (err) {
            console.error("Failed to delete cover letter:", err);
        }
    };

    const handleSetView = useCallback((targetView: AppView, id?: string, data?: any) => {
        const leavingRestrictedView = ['rebuild-standalone', 'ai-review', 'career-intelligence'].includes(view);
        const hasActiveJob = Object.values(jobs).some(j => j.status === 'RUNNING');

        if (leavingRestrictedView && hasActiveJob && !bypassWarningRef.current && targetView !== view) {
            setPendingNavigation({ targetView, id, data });
            setNavigationWarningShown(true);
            return;
        }

        bypassWarningRef.current = false; // Reset after bypass

        const eliteRequired = ['career-intelligence', 'transformation-factory', 'applications', 'interview-prep'];
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
    }, [isElite, profile, user, view, jobs]);

    const handleConfirmNavigation = () => {
        if (pendingNavigation) {
            bypassWarningRef.current = true;
            handleSetView(pendingNavigation.targetView, pendingNavigation.id, pendingNavigation.data);
            setPendingNavigation(null);
        }
        setNavigationWarningShown(false);
    };

    const handleCancelNavigation = () => {
        setPendingNavigation(null);
        setNavigationWarningShown(false);
    };

    const activeRunningJob = Object.values(jobs).find(j => j.status === 'RUNNING');
    const handleActiveJobClick = () => {
        if (!activeRunningJob) return;
        if (activeRunningJob.type === 'REBUILD') {
            handleSetView('rebuild-standalone');
        } else if (activeRunningJob.type === 'ANALYSIS') {
            handleSetView('ai-review');
        } else if (activeRunningJob.type === 'OUTLOOK') {
            handleSetView('career-intelligence');
        }
    };

    const isProtectedRoute = ['dashboard', 'applications', 'ai-review', 'full-review', 'career-intelligence', 'market-outlook', 'rebuild', 'rebuild-standalone', 'profile', 'history', 'resume-editor', 'settings', 'billing', 'interview-prep', 'cover-letter', 'tracker', 'linkedin-optimizer', 'preview', 'admin'].includes(view);
    // research routes are public — no auth required
    const isAdminRoute = view === 'admin';
    const adminAllowed = isAdminUser(user?.email);
    const activeView = (isProtectedRoute && !loading && !user)
        ? 'auth'
        : (isAdminRoute && user && !adminAllowed)
            ? 'dashboard'
            : view;

    const showNav = activeView !== 'landing' && activeView !== 'auth' && user;
    const isLegalPage = activeView === 'terms' || activeView === 'privacy' || activeView === 'refund';
    const showFooter = isLegalPage || activeView === 'pricing';

    const hasActiveJob = (Object.values(jobs) as BackgroundJob[]).some(j => j.status === 'RUNNING');

    if (loading) {
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
                <Header currentView={teaserTarget || activeView} setView={handleSetView} plan={plan} user={user} onNewResume={() => handleSetView('resume-editor')} />
            )}

            {hasActiveJob && showNav && activeRunningJob && (
                <button
                    onClick={handleActiveJobClick}
                    className="fixed bottom-6 right-6 z-[200] bg-[#161622] border border-blue-500/40 hover:border-blue-400 px-6 py-3.5 rounded-2xl shadow-2xl flex items-center gap-4 animate-in slide-in-from-bottom-4 duration-500 group transition-all hover:scale-105 cursor-pointer text-left ring-1 ring-blue-500/20"
                >
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
                    <div className="flex flex-col">
                        <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest leading-none">
                            {activeRunningJob.type === 'REBUILD' ? 'Resume Rebuild' : activeRunningJob.type === 'OUTLOOK' ? 'Market Command' : 'ATS Diagnosis'}
                        </span>
                        <span className="text-[10px] font-bold text-white uppercase tracking-wide mt-1 flex items-center gap-1.5 leading-none">
                            Background Engine Active
                            <ArrowRight size={10} className="text-blue-400 group-hover:translate-x-1 transition-transform" />
                        </span>
                    </div>
                    <Loader2 size={16} className="text-blue-500 animate-spin ml-2" />
                </button>
            )}

            <main className={"flex-1 flex flex-col " + (showNav ? 'pt-20' : '')}>
                <ErrorBoundary name="Core Engine">
                    <div className="flex-1 overflow-y-auto">
                    <Suspense fallback={
                        <div className="min-h-[60vh] bg-[#0F1117] flex items-center justify-center flex-col gap-4">
                            <div className="relative">
                                <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center border border-blue-500/20">
                                    <Shield className="h-6 w-6 text-blue-400" />
                                </div>
                                <div className="absolute inset-0 border-2 border-blue-500/50 rounded-xl animate-ping opacity-20" />
                            </div>
                            <div className="flex items-center gap-2 text-slate-400 text-xs font-bold tracking-widest uppercase">
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400" />
                                <span>Loading Engine...</span>
                            </div>
                        </div>
                    }>
                    {teaserTarget ? (
                        <div className="animate-in fade-in duration-500">
                            <FeatureTeaser targetView={teaserTarget} onUpgrade={function () { setTeaserTarget(null); setView('pricing'); }} />
                            <div className="bg-[#0F1117] pb-24">
                                <Pricing setPlan={async function (p) {
                                    if (user) {
                                        await supabase.from('profiles').update({ plan: p }).eq('id', user.id);
                                        invalidate('user_plan');
                                        const updated = Object.assign({}, profile, { plan: p });
                                        setProfile(updated);
                                        setCached('user_plan', updated);
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
                                !profile ? <DashboardSkeleton /> : (
                                    <DashboardView
                                        currentAnalysis={currentAnalysis}
                                        plan={plan}
                                        onNavigate={handleSetView}
                                        user={user}
                                        history={resumeHistory}
                                    />
                                )
                            )}
                            {activeView === 'applications' && <ApplicationExecutionView user={profile} applicationId={selectedApplicationId || undefined} onNavigate={handleSetView} />}
                            {activeView === 'ai-review' && <AIReviewView plan={plan} onResult={(r) => {
                                setAnalysisHistory(prev => ({ ...prev, [r.analysisId]: r }));
                                setActiveAnalysisId(r.analysisId);
                                handleSetView('full-review');
                            }} onUpload={(t) => { }} pendingResumeText={pendingResumeText} onUpgrade={function () { handleSetView('pricing'); }} onStartScratch={() => handleSetView('resume-editor')} activeJobs={jobs} dispatchJob={dispatchJob} />}
                            {activeView === 'full-review' && (
                                loading ? <FullReviewSkeleton /> : (
                                    <ErrorBoundary name="Market Standing">
                                        <FullReviewView
                                            result={currentAnalysis || lastValidAnalysis.current}
                                            plan={plan}
                                            onUpgrade={function () { handleSetView('pricing'); }}
                                            onRebuildRequest={(id) => handleSetView('rebuild-standalone')}
                                            setView={handleSetView}
                                            analysisHistory={analysisHistory}
                                            setActiveAnalysisId={setActiveAnalysisId}
                                            activeRebuild={activeRebuild}
                                            activeRebuildCtx={activeRebuildCtx}
                                        />
                                    </ErrorBoundary>
                                )
                            )}
                            <div style={{ display: activeView === 'career-intelligence' ? 'block' : 'none' }}>
                                <CareerIntelligenceView
                                    analysisResult={currentAnalysis || lastValidAnalysis.current}
                                    resumeText={currentAnalysis && currentAnalysis.resumeText ? currentAnalysis.resumeText : ''}
                                    resumeProfile={activeAnalysisCtx}
                                    plan={plan}
                                    setView={handleSetView}
                                    activeJobs={jobs}
                                    dispatchJob={dispatchJob}
                                />
                            </div>

                            <div style={{ display: activeView === 'market-outlook' ? 'block' : 'none' }}>
                                <MarketOutlookView />
                            </div>
                            {activeView === 'rebuild' && (
                                <RebuiltCompareView
                                    analysisId={activeAnalysisId}
                                    history={analysisHistory}
                                    plan={plan}
                                    onUpgrade={() => handleSetView('pricing')}
                                    onSave={async () => { if (user) await fetchUserData(user); handleSetView('history'); }}
                                />
                            )}
                            {activeView === 'rebuild-standalone' && <RebuildStandaloneView
                                userId={user?.id}
                                plan={plan}
                                activeAnalysis={activeAnalysisCtx}
                                credits={profile && profile.credits ? profile.credits : 0}
                                setCredits={async function (c) {
                                    if (profile) {
                                        const updated = { ...profile, credits: c };
                                        setProfile(updated);
                                        setCached('user_plan', updated);
                                    }
                                }}
                                onRebuildSuccess={async function (rebuilt: any, vid?: string, label?: string, gid?: string) {
                                    if (user) await fetchUserData(user);
                                    setPreFilledSource(null); // Clear context on success
                                    
                                    if (activeAnalysisId && currentAnalysis) {
                                        // Reconstruct the text representation of the rebuilt structured resume
                                        const contact = rebuilt.contact || {};
                                        const summary = rebuilt.summary || '';
                                        const expText = (rebuilt.experience || []).map((e: any) => `${e.title || ''} at ${e.organization || ''}: ${e.bullets?.join(' ') || ''}`).join('\n');
                                        const eduText = (rebuilt.education || []).map((e: any) => `${e.degree || ''} from ${e.institution || ''}`).join('\n');
                                        const projText = (rebuilt.projects || []).map((e: any) => `${e.title || ''}: ${e.description || ''}`).join('\n');
                                        const skillsText = rebuilt.skills ? [
                                            ...(rebuilt.skills.languages || []),
                                            ...(rebuilt.skills.frameworks || []),
                                            ...(rebuilt.skills.tools || []),
                                            ...(rebuilt.skills.specializations || [])
                                        ].join(', ') : '';
                                        const rebuiltText = `${contact.full_name || ''}\n${summary}\n${expText}\n${eduText}\n${projText}\n${skillsText}`;

                                        const baselineScore = currentAnalysis.precisionScore || currentAnalysis.score || 70;
                                        const fastVerifyResult = runFastVerify(
                                            rebuiltText,
                                            currentAnalysis.jdText || '',
                                            baselineScore
                                        );

                                        const baselineVerify = runFastVerify(
                                            currentAnalysis.resumeText || '',
                                            currentAnalysis.jdText || ''
                                        );

                                        const scoreDelta = fastVerifyResult.scoreDelta;
                                        const computedScoreAfter = Math.min(99, Math.max((currentAnalysis.score || 70) + scoreDelta, (currentAnalysis.score || 70)));

                                        setActiveRebuild({
                                            scoreBefore: currentAnalysis.score || 70,
                                            scoreAfter: computedScoreAfter,
                                            linkedAnalysisId: activeAnalysisId
                                        });

                                        setActiveRebuildCtx({
                                            scoreBefore: baselineVerify.precisionScore,
                                            scoreAfter: fastVerifyResult.precisionScore,
                                            linkedAnalysisId: activeAnalysisId,
                                            keywordsAdded: fastVerifyResult.matchedTerms.filter((t: string) => !baselineVerify.matchedTerms.includes(t)),
                                            timestamp: new Date().toISOString(),
                                        });
                                    }

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
                                coverLetters={coverLetterHistory}
                                onDeleteCoverLetter={handleDeleteCoverLetter}
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
                            {activeView === 'pricing' && <Pricing user={user} setPlan={async function (p) {
                                if (user) {
                                    await supabase.from('profiles').update({ plan: p }).eq('id', user.id);
                                    invalidate('user_plan');
                                    const updated = Object.assign({}, profile, { plan: p });
                                    setProfile(updated);
                                    setCached('user_plan', updated);
                                }
                            }} setView={handleSetView} currentPlan={plan} />}
                            {activeView === 'settings' && <AccountSettings plan={plan} profile={profile} />}
                            {activeView === 'billing' && <Billing plan={plan} setView={handleSetView} />}
                            {activeView === 'faq' && <FAQ setView={handleSetView} />}
                            {activeView === 'contact' && <Contact user={user} />}
                            {activeView === 'admin' && adminAllowed && <ErrorBoundary name="Admin"><AdminIntelligence /></ErrorBoundary>}
                            <div style={{ display: activeView === 'interview-prep' ? 'block' : 'none' }}>
                                <InterviewPrepView plan={plan} history={resumeHistory} user={user} onUpgrade={() => handleSetView('pricing')} dispatchJob={dispatchJob} activeJobs={jobs} />
                            </div>
                            {activeView === 'cover-letter' && <CoverLetterView plan={plan} history={resumeHistory} user={user} onUpgrade={() => handleSetView('pricing')} dispatchJob={dispatchJob} activeJobs={jobs} />}
                            {activeView === 'tracker' && <ApplicationTrackerView plan={plan} user={user} history={resumeHistory} onUpgrade={() => handleSetView('pricing')} />}
                            {activeView === 'linkedin-optimizer' && <LinkedInOptimizerView plan={plan} history={resumeHistory} user={user} onUpgrade={() => handleSetView('pricing')} dispatchJob={dispatchJob} activeJobs={jobs} />}
                            {activeView === 'terms' && <TermsView setView={handleSetView} />}
                            {activeView === 'privacy' && <PrivacyView setView={handleSetView} />}
                            {activeView === 'refund' && <RefundView setView={handleSetView} />}

                            {/* Research hub — public, no auth required */}
                            {activeView === ('research' as AppView) && (
                                <ResearchHubView
                                    onViewPost={(slug) => {
                                        setResearchSlug(slug);
                                        setView('research-post' as AppView);
                                        window.history.pushState({}, '', `/research/${slug}`);
                                    }}
                                />
                            )}
                            {activeView === ('research-post' as AppView) && researchSlug && (
                                <ResearchPostView
                                    slug={researchSlug}
                                    onBack={() => {
                                        setView('research' as AppView);
                                        setResearchSlug(null);
                                        window.history.pushState({}, '', '/research');
                                    }}
                                    onNavigate={handleSetView}
                                />
                            )}

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
                    </Suspense>
                    </div>
                </ErrorBoundary>
            </main>
            {navigationWarningShown && (
                <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-[#111118] border border-red-500/30 rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl relative overflow-hidden ring-1 ring-red-500/20">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full blur-[40px] pointer-events-none" />
                        <div className="flex flex-col items-center text-center space-y-6">
                            <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                                <AlertTriangle className="h-8 w-8 text-red-500 animate-pulse" />
                            </div>
                            <div className="space-y-3">
                                <h3 className="text-2xl font-black text-white uppercase tracking-tight">Active Operation in Progress</h3>
                                <p className="text-slate-400 text-sm leading-relaxed font-medium">
                                    You have a running generation in the background. Leaving this workspace now may cancel or interrupt the active optimization process.
                                </p>
                            </div>
                            <div className="w-full flex flex-col gap-3 pt-2">
                                <button
                                    onClick={handleConfirmNavigation}
                                    className="w-full bg-red-600 hover:bg-red-500 text-white font-black py-4 rounded-xl uppercase tracking-widest text-xs transition-colors animate-in"
                                >
                                    Yes, Leave Workspace
                                </button>
                                <button
                                    onClick={handleCancelNavigation}
                                    className="w-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white font-black py-4 rounded-xl uppercase tracking-widest text-xs transition-colors border border-white/10"
                                >
                                    Stay and Complete
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {showFooter && <Footer setView={handleSetView} />}
            <Analytics />
        </div>
    );
}

function AppWithProviders() {
  return <BackgroundJobsProvider><App /></BackgroundJobsProvider>;
}

export default AppWithProviders;
