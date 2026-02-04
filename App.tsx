
import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import LandingPage from './components/LandingPage';
import AuthView from './components/AuthView';
import { AIReviewView } from './components/AIReviewView';
import { FullReviewView } from './components/FullReviewView';
import { CareerIntelligenceView } from './components/CareerIntelligenceView';
import { TransformationFactory } from './components/TransformationFactory';
import { ApplicationsView } from './components/ApplicationsView';
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
import { 
  ShieldCheck, Zap, Lock, Target, BarChart, ArrowRight, Sparkles, 
  Shield, UploadCloud, Plus, Info, Circle, X, Loader2, AlertTriangle,
  History, FileText, ChevronRight, Activity
} from 'lucide-react';
import { AppView, DiagnosticResult, UserPlan, ResumeGroup, StructuredResume, UserProfile, RoleTrack, BackgroundJob, JobType, JobStatus } from './types';
import { supabase } from './lib/supabase';
import { GoogleGenAI } from "@google/genai";
import { QUICK_ACTIONS } from './constants';

function DashboardWidget(props: any) {
  const label = props.label;
  const value = props.value;
  const status = props.status;
  const locked = props.locked;
  const disabled = props.disabled;
  const onUpgrade = props.onUpgrade;
  const onClick = props.onClick;

  const styles = {
    'good': 'text-green-400 border-green-500/20 bg-green-500/5',
    'neutral': 'text-blue-400 border-blue-500/20 bg-blue-500/5',
    'needs-work': 'text-amber-400 border-amber-500/20 bg-amber-500/5'
  };

  if (locked) {
    return (
      <div 
        onClick={onUpgrade}
        className="flex flex-col gap-3 p-8 rounded-[2rem] border border-slate-800 bg-slate-900/40 relative group overflow-hidden cursor-pointer"
      >
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <Lock size={20} className="text-slate-400 mb-2" />
          <span className="text-[10px] font-black uppercase tracking-widest text-blue-400">Upgrade Required</span>
        </div>
        <div className="flex items-center justify-between opacity-30">
          <span className="text-[10px] font-black uppercase tracking-[0.2em]">{label}</span>
        </div>
        <span className="text-3xl font-bold tracking-tight opacity-30">{value}</span>
      </div>
    );
  }

  const currentStyle = (styles as any)[status] || styles['neutral'];

  return (
    <div 
      onClick={disabled ? undefined : onClick}
      className={"flex flex-col gap-3 p-8 rounded-[2rem] border " + currentStyle + " shadow-xl transition-all " + (disabled ? 'opacity-40 grayscale-[0.5] cursor-default' : (onClick ? 'cursor-pointer hover:border-current hover:scale-[1.01]' : 'cursor-default'))}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">{label}</span>
        {onClick && !disabled && <ArrowRight size={14} className="opacity-40" />}
      </div>
      <span className="text-3xl font-bold tracking-tight">{value}</span>
    </div>
  );
}

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

  const [jobs, setJobs] = useState<Record<string, BackgroundJob>>(() => {
    const saved = localStorage.getItem('hiremax_active_jobs');
    return saved ? JSON.parse(saved) : {};
  });

  const plan: UserPlan = profile && profile.plan ? profile.plan : 'Starter';
  const isElite = plan === 'Career Elite' || plan === 'Automation';
  const currentAnalysis = activeAnalysisId ? analysisHistory[activeAnalysisId] : null;

  useEffect(() => {
    localStorage.setItem('hiremax_active_jobs', JSON.stringify(jobs));
  }, [jobs]);

  const dispatchJob = useCallback(async (type: JobType, payload: any) => {
    const id = crypto.randomUUID();
    const newJob: BackgroundJob = {
      id,
      type,
      status: 'RUNNING',
      payload,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    setJobs(prev => ({ ...prev, [id]: newJob }));

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      let result;

      if (type === 'ANALYSIS' || type === 'REBUILD' || type === 'OUTLOOK') {
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: payload.prompt,
          config: { responseMimeType: "application/json" }
        });
        result = JSON.parse(response.text || '{}');
      }

      setJobs(prev => {
        const updated = { ...prev };
        updated[id] = { ...prev[id], status: 'COMPLETED', result, updatedAt: new Date().toISOString() };
        return updated;
      });
    } catch (e: any) {
      setJobs(prev => {
        const updated = { ...prev };
        updated[id] = { ...prev[id], status: 'FAILED', error: e.message, updatedAt: new Date().toISOString() };
        return updated;
      });
    }
    
    return id;
  }, []);

  useEffect(() => {
    const cleanup = setInterval(() => {
      setJobs(prev => {
        const now = new Date().getTime();
        const updated = { ...prev };
        let changed = false;
        Object.keys(updated).forEach(id => {
          const job = updated[id];
          const jobTime = new Date(job.updatedAt).getTime();
          if (job.status !== 'RUNNING' && now - jobTime > 300000) {
            delete updated[id];
            changed = true;
          }
        });
        return changed ? updated : prev;
      });
    }, 60000);
    return () => clearInterval(cleanup);
  }, []);

  useEffect(function() {
    async function initAuth() {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session && session.user ? session.user : null);
      if (session && session.user) await fetchUserData(session.user);
      setLoading(false);

      const { data: { subscription } } = supabase.auth.onAuthStateChange(async function(event, session) {
        setUser(session && session.user ? session.user : null);
        if (session && session.user) {
          await fetchUserData(session.user);
        } else {
          setProfile(null);
          setResumeHistory([]);
          setAnalysisHistory({});
        }
      });

      return function() {
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

    const currentProvider = authUser.app_metadata?.provider || authUser.identities?.[0]?.provider;
    
    let updatedProfile: UserProfile;

    if (!existingProfile) {
      const { data: newProfile, error: insertError } = await supabase.from('profiles').insert({
        id: authUser.id,
        email: authUser.email,
        full_name: authUser.user_metadata?.full_name || 'System User',
        plan: 'Starter',
        domain: 'UNSELECTED',
        credits: 0,
        connected_providers: currentProvider ? [currentProvider] : []
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
      const mapped = resumes.map(function(r: any) {
        return {
          id: r.id,
          name: r.name,
          versions: r.resume_versions.map(function(v: any) {
            return {
              versionId: v.id,
              type: v.version_type,
              createdAt: v.created_at,
              updatedAt: v.created_at,
              templateId: v.template_id,
              data: v.data
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
      analyses.forEach(function(a: any) {
        hist[a.id] = Object.assign({}, a.results_json, { analysisId: a.id });
      });
      setAnalysisHistory(hist);
      if (analyses.length > 0) setActiveAnalysisId(analyses[0].id);
    }
  }

  const handleSetView = function(targetView: AppView) {
    const eliteRequired = ['career-intelligence', 'transformation-factory', 'applications'];
    if (eliteRequired.indexOf(targetView) !== -1 && !isElite) {
      setTeaserTarget(targetView);
      setView('dashboard'); 
      return;
    }
    setTeaserTarget(null);
    setView(targetView);
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
               <FeatureTeaser targetView={teaserTarget} onUpgrade={function() { setTeaserTarget(null); setView('pricing'); }} />
               <div className="bg-[#0F1117] pb-24">
                  <Pricing setPlan={async function(p) {
                    if (user) {
                      await supabase.from('profiles').update({ plan: p }).eq({ id: user.id });
                      setProfile(Object.assign({}, profile, { plan: p }));
                    }
                    setTeaserTarget(null);
                    handleSetView('dashboard');
                  }} setView={handleSetView} currentPlan={plan} />
               </div>
            </div>
          ) : (
            <>
              {view === 'landing' && <LandingPage onGetStarted={function() { handleSetView(user ? 'dashboard' : 'auth'); }} onViewPlans={function() { handleSetView('pricing'); }} />}
              {view === 'auth' && <AuthView onSuccess={function() { handleSetView('dashboard'); }} />}
              {view === 'dashboard' && (
                <div className="max-w-[1400px] mx-auto px-10 py-12">
                   <div className="mb-12 flex justify-between items-start">
                    <div>
                      <h1 className="text-4xl font-bold text-white mb-2">Market Standing: <span className="text-blue-500">{currentAnalysis ? currentAnalysis.overallScore : '---'}</span></h1>
                      <p className="text-slate-500 font-medium">Profile Integrity: Verified | <span className="text-xs uppercase tracking-widest">{plan}</span></p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                    <DashboardWidget label="Market Fit" value={currentAnalysis?.foundation.marketReadiness || '---'} status="neutral" onClick={() => handleSetView('full-review')} />
                    <DashboardWidget label="Strengths" value={currentAnalysis?.foundation.strengthsSnapshot.length || '---'} status="good" onClick={() => handleSetView('full-review')} />
                    <DashboardWidget label="ATS Shield" value={currentAnalysis?.foundation.atsShield || '---'} status="good" onClick={() => handleSetView('full-review')} />
                    <DashboardWidget label="Readiness" value={currentAnalysis ? `${currentAnalysis.overallScore}%` : '---'} status={currentAnalysis ? (currentAnalysis.overallScore > 80 ? 'good' : 'needs-work') : 'neutral'} onClick={() => handleSetView('full-review')} />
                  </div>

                  <div className="mb-16">
                    <RealityCheckDetail onStart={() => handleSetView('ai-review')} />
                  </div>

                  <div className="space-y-6">
                    <h3 className="text-white font-bold text-xl uppercase tracking-tight ml-2">Quick Actions</h3>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                      {QUICK_ACTIONS.map(action => (
                        <ActionCard key={action.id} data={action} onClick={() => { if(action.id === 'new') handleSetView('resume-editor'); if(action.id === 'review') handleSetView('ai-review'); }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {view === 'transformation-factory' && (
                <TransformationFactory 
                  plan={plan} 
                  profile={profile} 
                  onUpdateProfile={(p) => setProfile(p)} 
                />
              )}
              {view === 'applications' && <ApplicationsView plan={plan} profile={profile} />}
              {view === 'ai-review' && <AIReviewView plan={plan} onResult={(r) => { handleSetView('full-review'); }} onUpload={(t) => {}} pendingResumeText={pendingResumeText} onUpgrade={function() { handleSetView('pricing'); }} onStartScratch={() => handleSetView('resume-editor')} activeJobs={jobs} dispatchJob={dispatchJob} />}
              {view === 'full-review' && <FullReviewView result={currentAnalysis} plan={plan} onUpgrade={function() { handleSetView('pricing'); }} onRebuildRequest={(id) => handleSetView('rebuild-standalone')} setView={handleSetView} />}
              {view === 'career-intelligence' && <CareerIntelligenceView analysisResult={currentAnalysis} resumeText={currentAnalysis && currentAnalysis.resumeText ? currentAnalysis.resumeText : ''} plan={plan} setView={handleSetView} activeJobs={jobs} dispatchJob={dispatchJob} />}
              {view === 'rebuild-standalone' && <RebuildStandaloneView plan={plan} credits={profile && profile.credits ? profile.credits : 0} setCredits={async function(c) {}} onRebuildSuccess={function(rebuilt: any) {}} onUpgrade={function() { handleSetView('pricing'); }} history={resumeHistory} activeJobs={jobs} dispatchJob={dispatchJob} />}
              {view === 'history' && <ResumeHistoryView history={resumeHistory} analysisHistory={analysisHistory} onEdit={function(gid, vid) { handleSetView('resume-editor'); }} onView={function(gid, vid) { handleSetView('resume-editor'); }} onStartNew={function() { handleSetView('ai-review'); }} />}
              {view === 'resume-editor' && <ResumeBuilder plan={plan} groupId={editingResumeId} versionId={editingVersionId} history={resumeHistory} onBack={function() { handleSetView('dashboard'); }} />}
              {view === 'pricing' && <Pricing setPlan={async function(p) {}} setView={handleSetView} currentPlan={plan} />}
              {view === 'settings' && <AccountSettings plan={plan} />}
              {view === 'billing' && <Billing plan={plan} setView={handleSetView} />}
              {view === 'faq' && <FAQ setView={handleSetView} />}
              {view === 'contact' && <Contact />}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
