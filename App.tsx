
import React, { useState, useEffect, useCallback } from 'react';
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
        // Map path to view if needed, or use as is if they match
        const validViews: AppView[] = ['dashboard', 'profile', 'full-review', 'career-intelligence', 'applications', 'rebuild-standalone', 'resume-editor', 'pricing', 'settings', 'billing', 'faq', 'contact', 'admin'];
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
    if (path === 'profile') setView('profile');
    else if (path === 'dashboard') setView('dashboard');
    else if (path === 'intelligence') setView('full-review');

    // Clean up URL if it has hash/params from OAuth
    if (window.location.hash || window.location.search) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // SEO & UX: Dynamic Page Titles
  useEffect(() => {
    const titles: Record<string, string> = {
      'landing': 'HireMax | Next-Gen Job Intelligence',
      'dashboard': 'Dashboard | HireMax',
      'profile': 'Profile | HireMax',
      'career-intelligence': 'Market Outlook | HireMax',
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
          // 1. Anchor UI state with a PENDING resume_version
          const { data: vData, error: vError } = await supabase
            .from('resume_versions')
            .insert({
              resume_id: finalPayload.resume_id,
              application_id: finalPayload.application_id,
              version_type: 'optimized',
              status: 'PENDING',
              data: {} // Placeholder until worker completes
            })
            .select()
            .single();

          if (vError) throw vError;

          // 2. Trigger worker with the version_id
          const { data, error } = await supabase.functions.invoke('generate-rebuild', {
            body: { ...commonBody, version_id: vData.id }
          });
          if (error) throw error;
          result = { newResume: data.data };
        } else if (type === 'OUTLOOK') {
          const { data, error } = await supabase.functions.invoke('generate-outlook', { body: commonBody });
          if (error) throw error;
          result = data.results_json;
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

  useEffect(() => {
    const runningIds = Object.keys(jobs).filter(id => jobs[id].status === 'RUNNING');
    if (runningIds.length === 0) return;

    const poll = async () => {
      try {
        const { data: remoteRuns } = await supabase
          .from('execution_runs')
          .select('id, status, error_reason')
          .in('id', runningIds);

        if (!remoteRuns) return;

        for (const remote of remoteRuns) {
          const job = jobs[remote.id];
          if (!job) continue;

          if (remote.status === 'completed') {
            let fetchedResult: any = null;
            try {
              if (job.type === 'ANALYSIS') {
                const { data } = await supabase.from('analyses').select('*').eq('user_id', user!.id).order('created_at', { ascending: false }).limit(1).single();
                if (data) fetchedResult = { ...data.results_json, analysisId: data.id };
              } else if (job.type === 'REBUILD') {
                const rid = job.payload?.resume_id;
                if (rid) {
                  const { data } = await supabase.from('resume_versions').select('*').eq('resume_id', rid).order('created_at', { ascending: false }).limit(1).single();
                  if (data) fetchedResult = { newResume: data.data };
                }
              } else if (job.type === 'OUTLOOK') {
                const { data } = await supabase.from('market_snapshots').select('*').eq('user_id', user!.id).order('created_at', { ascending: false }).limit(1).single();
                if (data) fetchedResult = data.results_json;
              }
            } catch (err) {
              console.error("Poll result recovery failed:", err);
            }

            setJobs(prev => ({
              ...prev,
              [remote.id]: { ...prev[remote.id], status: 'COMPLETED', result: fetchedResult, updatedAt: new Date().toISOString() }
            }));
          } else if (remote.status === 'failed') {
            setJobs(prev => ({
              ...prev,
              [remote.id]: { ...prev[remote.id], status: 'FAILED', error: remote.error_reason || "Execution failed", updatedAt: new Date().toISOString() }
            }));
          }
        }
      } catch (e) {
        console.error("Polling error:", e);
      }
    };

    const interval = setInterval(poll, 15000);
    return () => clearInterval(interval);
  }, [jobs, user]);

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
          versions: r.resume_versions.map(function (v: any) {
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

    // Subscribe to resume_versions for live history updates
    supabase
      .channel('resume_versions_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'resume_versions' }, () => {
        fetchUserData(authUser); // Simplest way to refresh the whole tree
      })
      .subscribe();

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

  const handleSetView = function (targetView: AppView, id?: string) {
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
    window.history.pushState({}, '', `/${targetView === 'landing' ? '' : targetView}${id ? `?id=${id}` : ''}`);
  };

  const showNav = view !== 'landing' && view !== 'auth' && user;

  const hasActiveJob = (Object.values(jobs) as BackgroundJob[]).some(j => j.status === 'RUNNING');

  return (
    <div className="min-h-screen bg-[#0F1117] flex flex-col antialiased">
      {showNav && (
        <Header currentView={teaserTarget || view} setView={handleSetView} plan={plan} onNewResume={() => handleSetView('resume-editor')} />
      )}

      {hasActiveJob && showNav && (
        <div className="fixed bottom-6 right-6 z-[200] bg-[#16161E] border border-blue-500/30 px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-4 animate-in slide-in-from-bottom-4 duration-500">
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          <span className="text-[10px] font-black text-white uppercase tracking-widest">Background Engine Active</span>
          <Loader2 size={14} className="text-blue-500 animate-spin" />
        </div>
      )}

      <main className={"flex-1 flex flex-col " + (showNav ? 'pt-20' : '')}>
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
              {view === 'landing' && <LandingPage onGetStarted={function () { handleSetView(user ? 'dashboard' : 'auth'); }} onViewPlans={function () { handleSetView('pricing'); }} />}
              {view === 'auth' && <AuthView onSuccess={function () { handleSetView('dashboard'); }} />}
              {view === 'auth-bridge' && <AuthBridge />}
              {view === 'dashboard' && (
                <DashboardView
                  currentAnalysis={currentAnalysis}
                  plan={plan}
                  onNavigate={handleSetView}
                />
              )}
              {view === 'applications' && <ApplicationExecutionView user={profile} applicationId={selectedApplicationId || undefined} />}
              {view === 'ai-review' && <AIReviewView plan={plan} onResult={(r) => {
                setAnalysisHistory(prev => ({ ...prev, [r.analysisId]: r }));
                setActiveAnalysisId(r.analysisId);
                handleSetView('full-review');
              }} onUpload={(t) => { }} pendingResumeText={pendingResumeText} onUpgrade={function () { handleSetView('pricing'); }} onStartScratch={() => handleSetView('resume-editor')} activeJobs={jobs} dispatchJob={dispatchJob} />}
              {view === 'full-review' && <FullReviewView result={currentAnalysis} plan={plan} onUpgrade={function () { handleSetView('pricing'); }} onRebuildRequest={(id) => handleSetView('rebuild-standalone')} setView={handleSetView} />}
              {view === 'career-intelligence' && <CareerIntelligenceView analysisResult={currentAnalysis} resumeText={currentAnalysis && currentAnalysis.resumeText ? currentAnalysis.resumeText : ''} plan={plan} setView={handleSetView} activeJobs={jobs} dispatchJob={dispatchJob} />}
              {view === 'rebuild-standalone' && <RebuildStandaloneView
                plan={plan}
                credits={profile && profile.credits ? profile.credits : 0}
                setCredits={async function (c) { }}
                onRebuildSuccess={async function (rebuilt: any, vid?: string, label?: string, gid?: string) {
                  if (user) await fetchUserData(user);
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
              />}
              {view === 'profile' && <ProfileView />}
              {view === 'history' && <ResumeHistoryView
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

              {view === 'preview' && <ExecutionPreviewView onNavigate={(view: AppView, id?: string) => handleSetView(view, id)} />}
              {view === 'resume-editor' && <ResumeBuilder plan={plan} groupId={editingResumeId} versionId={editingVersionId} history={resumeHistory} onBack={function () { handleSetView('dashboard'); }} />}
              {view === 'pricing' && <Pricing setPlan={async function (p) { }} setView={handleSetView} currentPlan={plan} />}
              {view === 'settings' && <AccountSettings plan={plan} profile={profile} />}
              {view === 'billing' && <Billing plan={plan} setView={handleSetView} />}
              {view === 'faq' && <FAQ setView={handleSetView} />}
              {view === 'contact' && <Contact />}
              {view === 'admin' && <AdminIntelligence />}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
