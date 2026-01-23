
import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import LandingPage from './components/LandingPage';
import AuthView from './components/AuthView';
import { AIReviewView } from './components/AIReviewView';
import { FullReviewView } from './components/FullReviewView';
import { CareerIntelligenceView } from './components/CareerIntelligenceView';
import { ResumeBuilder } from './components/ResumeBuilder';
import { RebuiltCompareView } from './components/RebuiltCompareView';
import { RebuildStandaloneView } from './components/RebuildStandaloneView';
import { Templates } from './components/Templates';
import { Pricing } from './components/Pricing';
import { ResumeHistoryView } from './components/ResumeHistoryView';
import { SignalHub } from './components/SignalHub';
import { FeatureDetails } from './components/FeatureDetails';
import { AccountSettings } from './components/AccountSettings';
import { Billing } from './components/Billing';
import { FAQ } from './components/FAQ';
import { Contact } from './components/Contact';
import { 
  ShieldCheck,
  Zap,
  Lock,
  Target,
  BarChart,
  ArrowRight,
  Sparkles,
  Shield,
  UploadCloud,
  Plus,
  Info,
  Circle,
  X,
  Loader2
} from 'lucide-react';
import { AppView, DiagnosticResult, UserPlan, ResumeGroup, ResumeVersion, StructuredResume, ResumeTemplate } from './types';
import { supabase } from './lib/supabase';

const DashboardWidget: React.FC<{ 
  label: string; 
  value: string; 
  status: 'good' | 'neutral' | 'needs-work'; 
  locked?: boolean;
  disabled?: boolean;
  onUpgrade?: () => void;
  onClick?: () => void;
}> = ({ label, value, status, locked, disabled, onUpgrade, onClick }) => {
  const styles = {
    'good': 'text-green-400 border-green-500/20 bg-green-500/5',
    'neutral': 'text-blue-400 border-blue-500/20 bg-blue-500/5',
    'needs-work': 'text-amber-400 border-amber-500/20 bg-amber-500/5'
  };

  if (locked) {
    return (
      <div className="flex flex-col gap-3 p-8 rounded-[2rem] border border-slate-800 bg-slate-900/40 relative group overflow-hidden">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <Lock size={20} className="text-slate-400 mb-2" />
          <button onClick={onUpgrade} className="text-[10px] font-black uppercase tracking-widest text-blue-400 hover:text-white transition-colors">Available in Pro</button>
        </div>
        <div className="flex items-center justify-between opacity-30">
          <span className="text-[10px] font-black uppercase tracking-[0.2em]">{label}</span>
        </div>
        <span className="text-3xl font-bold tracking-tight opacity-30">{value}</span>
      </div>
    );
  }

  return (
    <div 
      onClick={disabled ? undefined : onClick}
      className={`flex flex-col gap-3 p-8 rounded-[2rem] border ${styles[status]} shadow-xl transition-all ${disabled ? 'opacity-40 grayscale-[0.5] cursor-default' : (onClick ? 'cursor-pointer hover:border-current hover:scale-[1.01]' : 'cursor-default')}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">{label}</span>
        {onClick && !disabled && <ArrowRight size={14} className="opacity-40" />}
      </div>
      <span className="text-3xl font-bold tracking-tight">{value}</span>
    </div>
  );
};

const App: React.FC = () => {
  const [view, setView] = useState<AppView>('landing');
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const [showIntro, setShowIntro] = useState<boolean>(false);
  const [showCommitModal, setShowCommitModal] = useState<boolean>(false);
  const [resumeReceived, setResumeReceived] = useState<boolean>(false);
  const [pendingResumeText, setPendingResumeText] = useState<string>('');
  
  const [analysisHistory, setAnalysisHistory] = useState<Record<string, DiagnosticResult>>({});
  const [activeAnalysisId, setActiveAnalysisId] = useState<string | null>(null);
  
  const [resumeHistory, setResumeHistory] = useState<ResumeGroup[]>([]);
  const [editingResumeId, setEditingResumeId] = useState<string | null>(null);
  const [editingVersionId, setEditingVersionId] = useState<string | null>(null);
  const [preloadedData, setPreloadedData] = useState<StructuredResume | null>(null);

  const plan: UserPlan = profile?.plan || 'Starter';
  const isPro = plan === 'Career Pro' || plan === 'Career Elite';
  const currentAnalysis = activeAnalysisId ? analysisHistory[activeAnalysisId] : null;
  const navigateToPricing = () => setView('pricing');

  useEffect(() => {
    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      if (session?.user) await fetchUserData(session.user.id);
      setLoading(false);

      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchUserData(session.user.id);
        } else {
          setProfile(null);
          setResumeHistory([]);
          setAnalysisHistory({});
        }
      });

      return () => subscription.unsubscribe();
    };

    initAuth();
  }, []);

  const fetchUserData = async (userId: string) => {
    // 1. Fetch Profile
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', userId).single();
    setProfile(prof);

    // 2. Fetch Resumes with Versions
    const { data: resumes } = await supabase
      .from('resumes')
      .select('*, resume_versions(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (resumes) {
      const mapped: ResumeGroup[] = resumes.map(r => ({
        id: r.id,
        name: r.name,
        versions: r.resume_versions.map((v: any) => ({
          versionId: v.id,
          type: v.version_type,
          createdAt: v.created_at,
          updatedAt: v.created_at,
          templateId: v.template_id,
          data: v.data
        }))
      }));
      setResumeHistory(mapped);
    }

    // 3. Fetch Analyses
    const { data: analyses } = await supabase
      .from('analyses')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (analyses) {
      const hist: Record<string, DiagnosticResult> = {};
      analyses.forEach(a => {
        hist[a.id] = { ...a.results_json, analysisId: a.id, resumeVersionId: a.resume_version_id };
      });
      setAnalysisHistory(hist);
      if (analyses.length > 0) setActiveAnalysisId(analyses[0].id);
    }
  };

  useEffect(() => {
    if (user && view === 'dashboard') {
      const hasSeenIntro = localStorage.getItem('hiremax_intro_seen');
      if (!hasSeenIntro) setShowIntro(true);
    }
  }, [view, user]);

  const hasResume = resumeHistory.length > 0 || pendingResumeText !== '';

  const dismissIntro = () => {
    setShowIntro(false);
    localStorage.setItem('hiremax_intro_seen', 'true');
  };

  const handleActionAttempt = (action: () => void) => {
    if (!hasResume) {
      setShowCommitModal(true);
    } else {
      action();
    }
  };

  const handleUploadResume = (text: string) => {
    setPendingResumeText(text);
    setResumeReceived(true);
    setShowCommitModal(false);
    setView('dashboard');
  };

  const handleAnalysisCompleted = async (result: DiagnosticResult) => {
    if (!user) return;

    // Save to DB
    const { data, error } = await supabase.from('analyses').insert({
      user_id: user.id,
      role: result.role,
      score: result.overallScore,
      results_json: result
    }).select().single();

    if (data) {
      setAnalysisHistory(prev => ({ ...prev, [data.id]: { ...result, analysisId: data.id } }));
      setActiveAnalysisId(data.id);
      setResumeReceived(false);
      setPendingResumeText('');
      
      // Auto-create a resume group if it's the first time
      const { data: res } = await supabase.from('resumes').insert({
        user_id: user.id,
        name: `Analysis: ${result.role}`
      }).select().single();

      if (res) {
        const { data: ver } = await supabase.from('resume_versions').insert({
          resume_id: res.id,
          version_type: 'original',
          data: {
            contact: { full_name: profile?.full_name || 'User', email: user.email, phone: '', location: '', links: [] },
            summary: result.resumeText.slice(0, 150),
            education: [],
            experience: [],
            projects: [],
            skills: { languages: [], frameworks: [], tools: [], specializations: [] },
            leadership: []
          }
        }).select().single();

        if (ver) {
          const newGroup: ResumeGroup = {
            id: res.id,
            name: res.name,
            versions: [{
              versionId: ver.id,
              type: 'original',
              createdAt: ver.created_at,
              updatedAt: ver.created_at,
              templateId: 'swe-mid',
              data: ver.data
            }]
          };
          setResumeHistory([newGroup, ...resumeHistory]);
        }
      }
    }
  };

  const handleBuildFromScratch = () => {
    setEditingResumeId(null);
    setEditingVersionId(null);
    setPreloadedData(null);
    setView('resume-editor');
  };

  const handleSaveManualResume = async (rebuilt: StructuredResume) => {
    if (!user) return;

    const { data: res } = await supabase.from('resumes').insert({
      user_id: user.id,
      name: rebuilt.contact.full_name || 'Manual Resume'
    }).select().single();

    if (res) {
      const { data: ver } = await supabase.from('resume_versions').insert({
        resume_id: res.id,
        version_type: 'original',
        data: rebuilt
      }).select().single();

      if (ver) {
        const newGroup: ResumeGroup = {
          id: res.id,
          name: res.name,
          versions: [{
            versionId: ver.id,
            type: 'original',
            createdAt: ver.created_at,
            updatedAt: ver.created_at,
            templateId: 'swe-mid',
            data: rebuilt
          }]
        };
        setResumeHistory([newGroup, ...resumeHistory]);
        setResumeReceived(true);
        setPendingResumeText(`${rebuilt.contact.full_name}\n${rebuilt.summary}`);
        setShowCommitModal(false);
        setView('dashboard');
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0F1A] flex items-center justify-center">
        <Loader2 className="text-blue-500 animate-spin" size={48} />
      </div>
    );
  }

  const showNav = view !== 'landing' && view !== 'auth' && user;

  return (
    <div className="min-h-screen bg-[#0F1117] flex flex-col antialiased">
      {showNav && (
        <Header 
          currentView={view} 
          setView={(v) => handleActionAttempt(() => setView(v))} 
          plan={plan} 
          onNewResume={() => handleActionAttempt(handleBuildFromScratch)} 
        />
      )}

      <main className={`flex-1 flex flex-col ${showNav ? 'pt-20' : ''} transition-all duration-300`}>
        <div className="flex-1 overflow-y-auto">
          {view === 'landing' && (
            <LandingPage onGetStarted={() => setView(user ? 'dashboard' : 'auth')} onViewPlans={() => setView('pricing')} />
          )}

          {view === 'auth' && (
            <AuthView onSuccess={() => setView('dashboard')} />
          )}

          {view === 'dashboard' && (
            <div className="max-w-[1400px] mx-auto px-10 py-12">
              <div className="mb-12 flex justify-between items-start">
                <div>
                  <h1 className="text-4xl font-bold text-white mb-2">Welcome, <span className="text-blue-500">{profile?.full_name || 'HireMax User'}</span></h1>
                  <p className="text-slate-500 font-medium">Deterministic resume evaluation system | <span className="text-xs uppercase tracking-widest">{plan}</span></p>
                </div>
                {plan === 'Starter' && (
                  <button 
                    onClick={() => setView('pricing')}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-xl shadow-blue-900/20"
                  >
                    <Zap size={18} /> Upgrade Account
                  </button>
                )}
              </div>

              {showIntro && (
                <div className="mb-12 p-10 bg-[#16161E] border border-blue-500/30 rounded-[3rem] animate-in fade-in slide-in-from-top-4 duration-500 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-8 opacity-5">
                    <ShieldCheck size={160} />
                  </div>
                  <div className="max-w-xl relative z-10">
                    <h3 className="text-3xl font-bold text-white mb-6 uppercase tracking-tighter">Before You Apply</h3>
                    <p className="text-slate-400 text-lg font-medium leading-relaxed mb-10">
                      HireMax evaluates resumes for specific roles, companies, and industries.<br/><br/>
                      It shows whether your resume is safe to submit before automated screening.
                    </p>
                    <div className="flex items-center gap-6">
                      <button 
                        onClick={dismissIntro}
                        className="bg-blue-600 hover:bg-blue-500 text-white font-black py-4 px-10 rounded-2xl transition-all shadow-xl shadow-blue-900/20 uppercase tracking-widest text-xs"
                      >
                        Continue to Dashboard
                      </button>
                      <button 
                        onClick={dismissIntro}
                        className="text-slate-500 hover:text-white font-bold uppercase tracking-widest text-[10px] transition-colors"
                      >
                        Explore for now
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {resumeReceived && (
                <div className="mb-12 p-8 bg-blue-600/5 border border-blue-500/20 rounded-[2.5rem] flex flex-col md:flex-row items-center justify-between gap-6 animate-in fade-in slide-in-from-top-4 duration-500">
                  <div className="flex items-center gap-6">
                    <div className="w-12 h-12 rounded-2xl bg-blue-600/10 flex items-center justify-center text-blue-500">
                      <ShieldCheck size={28} />
                    </div>
                    <div>
                      <h4 className="text-white font-bold text-lg leading-none mb-2">Resume received.</h4>
                      <p className="text-slate-500 text-sm font-medium">Ready to run hiring safety check.</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setView('ai-review')}
                    className="px-8 py-3.5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-500 transition-all shadow-lg flex items-center gap-2"
                  >
                    Run Hiring Safety Check <ArrowRight size={16} />
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-16">
                <div className="lg:col-span-8 space-y-12">
                  <div className="space-y-6">
                    <div className="flex items-center gap-3">
                      <ShieldCheck className="text-blue-500" size={24} />
                      <h2 className="text-xl font-bold text-white uppercase tracking-tight">Foundation Assessment</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <DashboardWidget 
                        label="ATS Score" 
                        value={currentAnalysis ? `${currentAnalysis.overallScore}/100` : "---"} 
                        status="neutral" 
                        disabled={!hasResume}
                      />
                      <DashboardWidget 
                        label="Market Readiness" 
                        value={currentAnalysis?.foundation?.marketReadiness ?? "---"} 
                        status="good" 
                        disabled={!hasResume}
                      />
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="flex items-center gap-3">
                      <Zap className={`text-amber-500 ${!isPro ? 'opacity-30' : ''}`} size={24} />
                      <h2 className={`text-xl font-bold text-white uppercase tracking-tight ${!isPro ? 'opacity-30' : ''}`}>8-Point Intelligence (Pro)</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <DashboardWidget 
                        label="Detailed Review" 
                        value={isPro ? (currentAnalysis ? "Analyze Report" : "Run Analysis") : "Locked"} 
                        status="neutral" 
                        locked={!isPro}
                        disabled={!hasResume && isPro}
                        onUpgrade={navigateToPricing}
                        onClick={() => handleActionAttempt(currentAnalysis ? () => setView('full-review') : () => setView('ai-review'))}
                      />
                      <DashboardWidget 
                        label="Rebuild Utility" 
                        value={isPro ? "Open Utility" : "Locked"} 
                        status="neutral" 
                        locked={!isPro}
                        disabled={!hasResume && isPro}
                        onUpgrade={navigateToPricing}
                        onClick={() => handleActionAttempt(() => setView('rebuild-standalone'))}
                      />
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-4 space-y-6">
                   <div className="bg-[#1A1D26] border border-[#2D313D] p-8 rounded-3xl space-y-6 shadow-2xl">
                      <h3 className="text-white font-bold text-lg flex items-center gap-2">
                         <Target size={20} className="text-blue-500" /> System Goal
                      </h3>
                      <p className="text-slate-400 text-sm leading-relaxed">
                        Follow the deterministic evaluation rules to ensure your resume is safe for high-volume recruiter screening.
                      </p>
                      <div className="flex flex-col gap-3">
                        <button 
                          onClick={() => handleActionAttempt(() => setView('ai-review'))}
                          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-blue-900/10"
                        >
                          Start Analysis
                        </button>
                        <button 
                          onClick={() => handleActionAttempt(handleBuildFromScratch)}
                          className="w-full bg-[#16161E] border border-[#2D313D] text-slate-300 hover:text-white font-bold py-3 rounded-xl transition-all"
                        >
                          Build from Scratch
                        </button>
                      </div>
                   </div>
                </div>
              </div>
            </div>
          )}

          {view === 'history' && (
            <ResumeHistoryView 
              history={resumeHistory} 
              analysisHistory={analysisHistory}
              onEdit={(gid, vid) => {
                setEditingResumeId(gid);
                setEditingVersionId(vid);
                setPreloadedData(null);
                setView('resume-editor');
              }}
              onView={(gid, vid) => {
                setEditingResumeId(gid);
                setEditingVersionId(vid);
                setPreloadedData(null);
                setView('resume-editor');
              }}
              onStartNew={() => setView('ai-review')}
            />
          )}

          {view === 'ai-review' && (
            <AIReviewView 
              plan={plan} 
              onResult={handleAnalysisCompleted} 
              onUpload={handleUploadResume}
              pendingResumeText={pendingResumeText}
              onUpgrade={navigateToPricing} 
              onStartScratch={handleBuildFromScratch}
            />
          )}

          {view === 'resume-editor' && (
            <ResumeBuilder 
              plan={plan} 
              groupId={editingResumeId}
              versionId={editingVersionId}
              history={resumeHistory}
              onBack={() => setView('dashboard')}
              onSaveManual={handleSaveManualResume}
              preloadedData={preloadedData}
            />
          )}

          {view === 'pricing' && <Pricing setPlan={async (p) => {
            // Update plan in Supabase
            if (user) {
              await supabase.from('profiles').update({ plan: p }).eq('id', user.id);
              setProfile({ ...profile, plan: p });
            }
            if (p === 'Career Elite') setView('career-intelligence');
            else if (p === 'Career Pro') setView(activeAnalysisId ? 'full-review' : 'ai-review');
            else setView('dashboard');
          }} setView={setView} currentPlan={plan} />}
        </div>
      </main>

      {showCommitModal && (
        <div className="fixed inset-0 z-[150] bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-[#16161E] border border-[#2D313D] w-full max-w-lg rounded-[3rem] p-12 shadow-2xl relative overflow-hidden">
            <button 
              onClick={() => setShowCommitModal(false)}
              className="absolute top-8 right-8 text-slate-500 hover:text-white transition-colors"
            >
              <X size={24} />
            </button>
            <div className="flex flex-col items-center text-center space-y-8">
              <div className="w-16 h-16 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center text-white">
                <Shield size={32} strokeWidth={1.5} />
              </div>
              <div className="space-y-4">
                <h3 className="text-3xl font-black text-white uppercase tracking-tighter">Resume Required</h3>
                <p className="text-slate-400 text-lg font-medium leading-relaxed">
                  To run a valid assessment, HireMax needs your resume.<br/><br/>
                  This allows company- and industry-specific evaluation.
                </p>
              </div>
              <div className="w-full flex flex-col gap-4 pt-4">
                <button 
                  onClick={() => { setView('ai-review'); setShowCommitModal(false); }}
                  className="w-full bg-blue-600 hover:bg-blue-50 text-white font-black py-5 rounded-2xl transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-3 shadow-xl shadow-blue-900/20 group"
                >
                  <UploadCloud size={20} className="group-hover:scale-110 transition-transform" />
                  Upload Resume
                </button>
                <button 
                  onClick={() => { handleBuildFromScratch(); setShowCommitModal(false); }}
                  className="w-full bg-white/5 border border-white/10 text-white hover:bg-white/10 font-black py-5 rounded-2xl transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-3"
                >
                  <Plus size={20} />
                  Build Resume from Scratch
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showNav && (
        <footer className="py-8 border-t border-[#1D1D26] bg-[#0D0D12] text-center">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
            © 2025 HireMax • Deterministic Evaluation System • No Training on User Data
          </p>
        </footer>
      )}
    </div>
  );
};

export default App;
