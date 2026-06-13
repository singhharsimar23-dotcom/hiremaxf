import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { isAdminUser } from '../lib/admin';
import {
  Brain, Save, History, AlertTriangle, CheckCircle2, Loader2, ArrowRight,
  Target, Zap, BookOpen, Calendar, BarChart2, CheckCheck, X, Clock,
  TrendingUp, Send, RefreshCw, Globe, Linkedin, MessageSquare, FileText
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

// ============================================================
// TYPES
// ============================================================
interface WeightDefinition {
  id: string; name: string; description: string;
  default_value: number; min_bound: number; max_bound: number;
}
interface WeightSet {
  id: string; version: number; weights: Record<string, number>;
  status: string; deployed_at: string;
}
interface ResearchBrief {
  id: string; title: string; core_finding: string;
  content_pillar: string; citation_potential: string;
  supporting_data: Array<{ stat: string; source: string; context: string }>;
  sams_angle: string; status: string; generated_at: string;
}
interface ContentPiece {
  id: string; brief_id: string; content_type: string; title: string;
  platform: string; status: string; scheduled_for: string | null; published_at: string | null;
}
interface PillarPerf {
  pillar: string; week_start: string; ai_citation_sessions: number;
  linkedin_impressions: number; reddit_upvotes: number; total_score: number;
}

// ============================================================
// CONSTANTS
// ============================================================
const ADMIN_API_URL = import.meta.env.VITE_INTELLIGENCE_ADMIN_URL || '';

const PILLAR_LABELS: Record<string, string> = {
  entry_level_collapse: 'Entry-Level Collapse',
  compensation_reality: 'Compensation Reality',
  ai_hiring_impact: 'AI Hiring Impact',
  remote_work_divide: 'Remote Work Divide',
  skills_velocity: 'Skills Velocity',
};
const PILLAR_COLORS: Record<string, string> = {
  entry_level_collapse: '#EF4444',
  compensation_reality: '#10B981',
  ai_hiring_impact: '#8B5CF6',
  remote_work_divide: '#3B82F6',
  skills_velocity: '#F59E0B',
};
const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  blog: <FileText size={12} />,
  linkedin: <Linkedin size={12} />,
  reddit: <MessageSquare size={12} />,
  hn: <Globe size={12} />,
  newsletter: <Send size={12} />,
};

// ============================================================
// HELPERS
// ============================================================
async function apiCall(path: string, opts: RequestInit = {}, password?: string): Promise<any> {
  if (!ADMIN_API_URL) {
    // Fall back to direct Supabase calls
    return null;
  }
  const res = await fetch(`${ADMIN_API_URL}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${password || ''}`,
      ...(opts.headers as Record<string, string> || {}),
    },
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

function citationColor(potential: string): { bg: string; text: string; border: string } {
  if (potential === 'high') return { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' };
  if (potential === 'medium') return { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' };
  return { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/30' };
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hrs = Math.floor(diff / 3600000);
  if (hrs < 1) return 'Just now';
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ============================================================
// SUB-COMPONENTS
// ============================================================

// Brief card with angle form
const BriefCard: React.FC<{ brief: ResearchBrief; password: string; onRefresh: () => void }> = ({ brief, password, onRefresh }) => {
  const [angle, setAngle] = useState(brief.sams_angle || '');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const citStyle = citationColor(brief.citation_potential);
  const isPending = brief.status === 'awaiting_angle' || brief.status === 'pending';
  const isApproved = brief.status === 'approved';
  const isRejected = brief.status === 'rejected';

  const handleApprove = async (withAngle: boolean) => {
    setSubmitting(true);
    try {
      if (withAngle && angle.trim().length >= 5) {
        await supabase.from('research_briefs').update({
          sams_angle: angle.trim(),
          sams_angle_added_at: new Date().toISOString(),
          status: 'approved',
          reviewed_at: new Date().toISOString(),
        }).eq('id', brief.id);
      } else {
        await supabase.from('research_briefs').update({
          status: 'approved',
          reviewed_at: new Date().toISOString(),
        }).eq('id', brief.id);
      }
      setDone(true);
      setTimeout(onRefresh, 800);
    } catch (e: any) {
      alert('Failed: ' + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    setSubmitting(true);
    await supabase.from('research_briefs').update({
      status: 'rejected', reviewed_at: new Date().toISOString(),
    }).eq('id', brief.id);
    setSubmitting(false);
    onRefresh();
  };

  if (done) {
    return (
      <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-6 flex items-center gap-3">
        <CheckCheck size={20} className="text-emerald-400" />
        <span className="text-emerald-300 font-bold text-sm">Approved — content generation started</span>
      </div>
    );
  }

  return (
    <div className={`bg-[#12141C] border rounded-2xl p-6 transition-all ${isRejected ? 'border-red-500/20 opacity-50' : isApproved ? 'border-emerald-500/20' : 'border-[#23262F]'}`}>
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span style={{ background: PILLAR_COLORS[brief.content_pillar] + '20', color: PILLAR_COLORS[brief.content_pillar], borderColor: PILLAR_COLORS[brief.content_pillar] + '40' }}
              className="text-[9px] font-black px-2 py-0.5 rounded-md border uppercase tracking-widest">
              {PILLAR_LABELS[brief.content_pillar] || brief.content_pillar}
            </span>
            <span className={`text-[9px] font-black px-2 py-0.5 rounded-md border uppercase tracking-widest ${citStyle.bg} ${citStyle.text} ${citStyle.border}`}>
              {brief.citation_potential} citation potential
            </span>
            <span className="text-[10px] text-slate-500 flex items-center gap-1"><Clock size={9} />{timeAgo(brief.generated_at)}</span>
          </div>
          <h3 className="text-white font-black text-base leading-tight">{brief.title}</h3>
        </div>
      </div>

      {/* Core finding */}
      <p className="text-slate-400 text-sm leading-relaxed mb-4 line-clamp-3">{brief.core_finding}</p>

      {/* Supporting data stats */}
      {brief.supporting_data?.length > 0 && (
        <div className="space-y-2 mb-4">
          {brief.supporting_data.slice(0, 3).map((d, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              <span className="text-blue-400 font-black shrink-0">{d.stat}</span>
              <span className="text-slate-500">({d.source})</span>
              <span className="text-slate-400 flex-1">{d.context}</span>
            </div>
          ))}
        </div>
      )}

      {/* Sam's angle textarea — required for high potential */}
      {isPending && (
        <div className="mb-4">
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
            Your angle {brief.citation_potential === 'high' ? '(required for HIGH potential)' : '(optional but recommended)'}
          </label>
          <textarea
            id={`angle-${brief.id}`}
            value={angle}
            onChange={e => setAngle(e.target.value)}
            placeholder="1-3 sentences from your perspective. What does this mean for job seekers right now?"
            rows={3}
            className="w-full bg-[#0A0B10] border border-[#2D313D] focus:border-blue-500/50 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 resize-none focus:outline-none transition-colors"
          />
          <div className="text-right text-[10px] text-slate-600 mt-1">{angle.length} chars</div>
        </div>
      )}

      {/* Actions */}
      {isPending && (
        <div className="flex gap-2">
          <button
            onClick={() => handleApprove(true)}
            disabled={submitting || (brief.citation_potential === 'high' && angle.trim().length < 5)}
            className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-xs py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {submitting ? <Loader2 size={12} className="animate-spin" /> : <CheckCheck size={12} />}
            {brief.citation_potential === 'high' && angle.trim().length < 5 ? 'Add angle to approve' : 'Approve + Generate Content'}
          </button>
          <button
            onClick={() => handleApprove(false)}
            disabled={submitting}
            className="bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white font-black text-xs px-3 py-2.5 rounded-xl transition-colors border border-white/10"
            title="Approve without angle"
          >
            Skip →
          </button>
          <button
            onClick={handleReject}
            disabled={submitting}
            className="bg-red-500/10 hover:bg-red-500/20 text-red-400 font-black text-xs px-3 py-2.5 rounded-xl transition-colors border border-red-500/20"
          >
            <X size={12} />
          </button>
        </div>
      )}
      {isApproved && <div className="text-xs text-emerald-400 font-bold flex items-center gap-1"><CheckCheck size={12} /> Approved — content in pipeline</div>}
      {isRejected && <div className="text-xs text-red-400 font-bold flex items-center gap-1"><X size={12} /> Rejected</div>}
    </div>
  );
};

// Content calendar card
const CalendarCard: React.FC<{ piece: ContentPiece }> = ({ piece }) => {
  const platformColor: Record<string, string> = {
    blog: 'border-blue-500/30 bg-blue-500/5',
    linkedin: 'border-sky-500/30 bg-sky-500/5',
    reddit: 'border-orange-500/30 bg-orange-500/5',
    hn: 'border-amber-500/30 bg-amber-500/5',
    newsletter: 'border-purple-500/30 bg-purple-500/5',
  };
  const timeStr = piece.scheduled_for
    ? new Date(piece.scheduled_for).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC', timeZoneName: 'short' })
    : piece.published_at ? 'Published' : 'Unscheduled';

  return (
    <div className={`border rounded-xl p-4 ${platformColor[piece.platform] || 'border-white/10 bg-white/5'}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-slate-400">{PLATFORM_ICONS[piece.platform]}</span>
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{piece.content_type.replace(/_/g, ' ')}</span>
        <span className={`ml-auto text-[9px] font-black px-1.5 py-0.5 rounded uppercase ${piece.status === 'published' ? 'text-emerald-400' : piece.status === 'scheduled' ? 'text-blue-400' : 'text-slate-500'}`}>
          {piece.status}
        </span>
      </div>
      <p className="text-white text-xs font-bold line-clamp-2 mb-2">{piece.title}</p>
      <div className="flex items-center gap-1 text-slate-500 text-[10px]">
        <Clock size={9} />
        <span>{timeStr}</span>
      </div>
    </div>
  );
};

// ============================================================
// TABS
// ============================================================
type Tab = 'weights' | 'briefs' | 'calendar' | 'performance';

const TABS: Array<{ id: Tab; label: string; icon: React.ReactNode }> = [
  { id: 'weights', label: 'Scoring Weights', icon: <Target size={14} /> },
  { id: 'briefs', label: 'Research Briefs', icon: <BookOpen size={14} /> },
  { id: 'calendar', label: 'Content Calendar', icon: <Calendar size={14} /> },
  { id: 'performance', label: 'Performance', icon: <BarChart2 size={14} /> },
];

// ============================================================
// MAIN COMPONENT
// ============================================================
export const AdminIntelligence: React.FC = () => {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('briefs');
  const [adminPassword, setAdminPassword] = useState('');
  const [requireManualApproval, setRequireManualApproval] = useState<boolean>(true);
  const [manualApprovalLoading, setManualApprovalLoading] = useState<boolean>(false);

  // Weights tab state
  const [definitions, setDefinitions] = useState<WeightDefinition[]>([]);
  const [currentSet, setCurrentSet] = useState<WeightSet | null>(null);
  const [weightHistory, setWeightHistory] = useState<WeightSet[]>([]);
  const [formWeights, setFormWeights] = useState<Record<string, number>>({});
  const [weightLoading, setWeightLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [runningOpt, setRunningOpt] = useState(false);
  const [optResult, setOptResult] = useState<any>(null);

  // Briefs tab state
  const [briefs, setBriefs] = useState<ResearchBrief[]>([]);
  const [briefsLoading, setBriefsLoading] = useState(false);
  const [briefFilter, setBriefFilter] = useState<string>('awaiting_angle');

  // Calendar tab state
  const [contentPieces, setContentPieces] = useState<ContentPiece[]>([]);
  const [calLoading, setCalLoading] = useState(false);

  // Performance tab state
  const [perfData, setPerfData] = useState<PillarPerf[]>([]);
  const [perfLoading, setPerfLoading] = useState(false);

  // Auth check
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      const isAdmin = isAdminUser(user?.email);
      setAuthorized(isAdmin);
      if (user && isAdmin) {
        supabase.from('profiles').select('require_manual_approval').eq('id', user.id).maybeSingle().then(({ data }) => {
          if (data) {
            setRequireManualApproval(data.require_manual_approval !== false);
          }
        });
      }
    });
    // Detect URL hash for tab
    if (window.location.hash === '#intelligence-briefs') setActiveTab('briefs');
  }, []);

  // Fetch weights data
  const fetchWeights = useCallback(async () => {
    setWeightLoading(true);
    try {
      const { data: defs } = await supabase.from('scoring_weights_definitions').select('*').order('name');
      setDefinitions(defs || []);
      const { data: active } = await supabase.from('scoring_weight_sets').select('*').eq('status', 'ACTIVE').order('version', { ascending: false }).limit(1).maybeSingle();
      setCurrentSet(active);
      if (active) { setFormWeights(active.weights); }
      else { const d: Record<string, number> = {}; defs?.forEach((def: WeightDefinition) => d[def.name] = def.default_value); setFormWeights(d); }
      const { data: hist } = await supabase.from('scoring_weight_sets').select('*').order('version', { ascending: false }).limit(10);
      setWeightHistory(hist || []);
    } finally { setWeightLoading(false); }
  }, []);

  // Fetch briefs
  const fetchBriefs = useCallback(async () => {
    setBriefsLoading(true);
    try {
      let q = supabase.from('research_briefs').select('*').order('generated_at', { ascending: false }).limit(30);
      if (briefFilter !== 'all') q = q.eq('status', briefFilter);
      const { data } = await q;
      setBriefs(data as ResearchBrief[] || []);
    } finally { setBriefsLoading(false); }
  }, [briefFilter]);

  // Fetch calendar
  const fetchCalendar = useCallback(async () => {
    setCalLoading(true);
    const { data } = await supabase.from('content_pieces').select('*').order('scheduled_for', { ascending: true }).limit(100);
    setContentPieces(data as ContentPiece[] || []);
    setCalLoading(false);
  }, []);

  // Fetch performance
  const fetchPerformance = useCallback(async () => {
    setPerfLoading(true);
    const { data } = await supabase.from('pillar_performance').select('*').order('week_start', { ascending: false }).limit(50);
    setPerfData(data as PillarPerf[] || []);
    setPerfLoading(false);
  }, []);

  useEffect(() => { if (authorized) { fetchWeights(); fetchBriefs(); } }, [authorized, fetchWeights]);
  useEffect(() => { if (authorized && activeTab === 'briefs') fetchBriefs(); }, [activeTab, briefFilter, authorized, fetchBriefs]);
  useEffect(() => { if (authorized && activeTab === 'calendar') fetchCalendar(); }, [activeTab, authorized, fetchCalendar]);
  useEffect(() => { if (authorized && activeTab === 'performance') fetchPerformance(); }, [activeTab, authorized, fetchPerformance]);

  // Weights actions
  const handleWeightChange = (name: string, value: string) => {
    const n = parseFloat(value);
    if (!isNaN(n)) setFormWeights(prev => ({ ...prev, [name]: n }));
  };

  const handleDeployNewVersion = async () => {
    setSaving(true);
    try {
      const nextVersion = (currentSet?.version || 0) + 1;
      const { error } = await supabase.from('scoring_weight_sets').insert({ version: nextVersion, weights: formWeights, status: 'ACTIVE', parent_weight_set_id: currentSet?.id, deployed_at: new Date().toISOString() });
      if (error) throw error;
      if (currentSet) await supabase.from('scoring_weight_sets').update({ status: 'ARCHIVED' }).eq('id', currentSet.id);
      await fetchWeights();
      alert(`Successfully deployed Intelligence Engine v${nextVersion}`);
    } catch (e: any) { alert(`Failed to deploy: ${e.message}`); }
    finally { setSaving(false); }
  };

  const handleRunOptimization = async () => {
    setRunningOpt(true);
    try {
      const { data, error } = await supabase.functions.invoke('optimize-weights');
      if (error) throw error;
      setOptResult(data);
      if (data.candidate_version) fetchWeights();
    } catch (err: any) { alert('Optimization failed: ' + err.message); }
    finally { setRunningOpt(false); }
  };

  const handleToggleManualApproval = async () => {
    setManualApprovalLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not logged in');
      const newValue = !requireManualApproval;
      const { error } = await supabase
        .from('profiles')
        .update({ require_manual_approval: newValue })
        .eq('id', user.id);
      if (error) throw error;
      setRequireManualApproval(newValue);
    } catch (e: any) {
      alert('Failed to update setting: ' + e.message);
    } finally {
      setManualApprovalLoading(false);
    }
  };

  // Performance chart data
  const chartData = Object.keys(PILLAR_LABELS).map(pillar => {
    const total = perfData.filter(p => p.pillar === pillar).reduce((s, p) => s + (p.ai_citation_sessions || 0), 0);
    return { pillar: PILLAR_LABELS[pillar], sessions: total, color: PILLAR_COLORS[pillar] };
  });

  const publishedCount = contentPieces.filter(p => p.status === 'published').length;
  const scheduledCount = contentPieces.filter(p => p.status === 'scheduled').length;
  const pendingBriefs = briefs.filter(b => b.status === 'awaiting_angle' || b.status === 'pending').length;

  // Auth guards
  if (authorized === null) return <div className="flex items-center justify-center min-h-[40vh]"><Loader2 className="animate-spin text-blue-400" /></div>;
  if (!authorized) return (
    <div className="max-w-lg mx-auto mt-24 text-center px-6">
      <AlertTriangle className="mx-auto text-amber-400 mb-4" size={32} />
      <h2 className="text-xl font-bold text-white mb-2">Access denied</h2>
      <p className="text-slate-400 text-sm">This area is restricted to administrators.</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0A0B10] text-slate-200">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-3 text-blue-400 mb-2">
              <Brain size={20} />
              <span className="font-bold tracking-widest uppercase text-sm">HireMax Intelligence Engine</span>
            </div>
            <h1 className="text-3xl font-black text-white">Intelligence Console</h1>
          </div>
          {/* Quick stats */}
          <div className="flex gap-4 text-center">
            <div className="bg-[#12141C] border border-[#23262F] rounded-xl p-3 min-w-[80px]">
              <div className="text-2xl font-black text-amber-400">{pendingBriefs}</div>
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Pending</div>
            </div>
            <div className="bg-[#12141C] border border-[#23262F] rounded-xl p-3 min-w-[80px]">
              <div className="text-2xl font-black text-blue-400">{scheduledCount}</div>
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Scheduled</div>
            </div>
            <div className="bg-[#12141C] border border-[#23262F] rounded-xl p-3 min-w-[80px]">
              <div className="text-2xl font-black text-emerald-400">{publishedCount}</div>
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Published</div>
            </div>
          </div>
        </div>

        {/* Tab navigation */}
        <div className="flex gap-1 bg-[#12141C] border border-[#23262F] rounded-2xl p-1">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${activeTab === tab.id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* ==================== BRIEFS TAB ==================== */}
        {activeTab === 'briefs' && (
          <div className="space-y-4">
            {/* Autonomous Mode Toggle Banner */}
            <div className="bg-[#12141C] border border-[#23262F] rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <h3 className="text-white font-bold text-base flex items-center gap-2">
                  <Zap size={16} className={requireManualApproval ? "text-slate-400" : "text-amber-400 animate-pulse"} />
                  Autonomous Publishing Mode
                </h3>
                <p className="text-xs text-slate-400 max-w-xl">
                  {requireManualApproval 
                    ? "Currently in Manual Mode. New briefs will be sent to your email and require you to add an angle and approve them before publishing."
                    : "Currently in Fully Autonomous Mode. New briefs will be automatically approved and published every hour."}
                </p>
              </div>
              <button 
                onClick={handleToggleManualApproval}
                disabled={manualApprovalLoading}
                className={`w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                  requireManualApproval 
                    ? "bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700" 
                    : "bg-amber-600 hover:bg-amber-500 text-white"
                }`}
              >
                {manualApprovalLoading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                {requireManualApproval ? "Enable Autonomous Mode" : "Disable Autonomous Mode"}
              </button>
            </div>

            {/* Filter bar */}
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                {[['awaiting_angle', 'Needs Angle'], ['pending', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected'], ['all', 'All']].map(([val, label]) => (
                  <button key={val} onClick={() => setBriefFilter(val)}
                    className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-colors ${briefFilter === val ? 'bg-blue-600 text-white' : 'bg-white/5 text-slate-400 hover:text-white border border-white/10'}`}>
                    {label}
                  </button>
                ))}
              </div>
              <button onClick={fetchBriefs} className="text-slate-400 hover:text-white transition-colors">
                <RefreshCw size={14} />
              </button>
            </div>

            {briefsLoading && <div className="flex items-center justify-center py-12"><Loader2 className="animate-spin text-blue-500" /></div>}
            {!briefsLoading && briefs.length === 0 && (
              <div className="text-center py-16 text-slate-500">
                <BookOpen size={32} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm font-bold">No briefs in this category</p>
                <p className="text-xs mt-1">Pipeline runs daily at 6am UTC and generates new briefs</p>
              </div>
            )}
            <div className="space-y-4">
              {briefs.map(brief => (
                <BriefCard key={brief.id} brief={brief} password={adminPassword} onRefresh={fetchBriefs} />
              ))}
            </div>
          </div>
        )}

        {/* ==================== CALENDAR TAB ==================== */}
        {activeTab === 'calendar' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-white font-black text-lg">Content Pipeline</h2>
              <button onClick={fetchCalendar} className="text-slate-400 hover:text-white transition-colors"><RefreshCw size={14} /></button>
            </div>
            {calLoading && <div className="flex items-center justify-center py-12"><Loader2 className="animate-spin text-blue-500" /></div>}
            {!calLoading && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {contentPieces.length === 0 ? (
                  <div className="col-span-3 text-center py-16 text-slate-500">
                    <Calendar size={32} className="mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-bold">No content scheduled yet</p>
                    <p className="text-xs mt-1">Approve a research brief to generate content</p>
                  </div>
                ) : (
                  contentPieces.map(p => <CalendarCard key={p.id} piece={p} />)
                )}
              </div>
            )}
          </div>
        )}

        {/* ==================== PERFORMANCE TAB ==================== */}
        {activeTab === 'performance' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-white font-black text-lg">Citation Intelligence</h2>
              <button onClick={fetchPerformance} className="text-slate-400 hover:text-white transition-colors"><RefreshCw size={14} /></button>
            </div>

            {perfLoading && <div className="flex items-center justify-center py-12"><Loader2 className="animate-spin text-blue-500" /></div>}

            {!perfLoading && (
              <>
                {/* Pillar performance bar chart */}
                <div className="bg-[#12141C] border border-[#23262F] rounded-2xl p-6">
                  <h3 className="text-white font-black text-sm mb-6 flex items-center gap-2"><TrendingUp size={16} className="text-blue-400" />AI Citation Sessions by Pillar</h3>
                  {chartData.every(d => d.sessions === 0) ? (
                    <div className="text-center py-8 text-slate-500 text-sm">
                      <BarChart2 size={28} className="mx-auto mb-2 opacity-30" />
                      Citation data accumulates after content is published and AI crawlers visit.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                        <XAxis dataKey="pillar" tick={{ fill: '#64748B', fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: '#64748B', fontSize: 10 }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ background: '#12141C', border: '1px solid #23262F', borderRadius: '12px', fontSize: 12 }} />
                        <Bar dataKey="sessions" radius={[6, 6, 0, 0]}>
                          {chartData.map((d, i) => <Cell key={i} fill={d.color} fillOpacity={0.8} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>

                {/* Pillar breakdown table */}
                <div className="bg-[#12141C] border border-[#23262F] rounded-2xl p-6">
                  <h3 className="text-white font-black text-sm mb-4">Pillar Rankings</h3>
                  <div className="space-y-3">
                    {chartData.sort((a, b) => b.sessions - a.sessions).map((d, i) => (
                      <div key={d.pillar} className="flex items-center gap-3">
                        <span className="text-slate-600 font-black text-sm w-4">{i + 1}</span>
                        <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div
                            style={{
                              width: chartData[0].sessions > 0 ? `${(d.sessions / chartData[0].sessions) * 100}%` : '0%',
                              background: d.color,
                            }}
                            className="h-full rounded-full transition-all"
                          />
                        </div>
                        <span className="text-slate-300 text-xs font-bold w-32 truncate">{d.pillar}</span>
                        <span className="text-slate-400 text-xs">{d.sessions} sessions</span>
                        {i === 0 && d.sessions > 0 && <span className="text-[10px] text-emerald-400 font-black">🔥 write more</span>}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ==================== WEIGHTS TAB ==================== */}
        {activeTab === 'weights' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-[#12141C] border border-[#23262F] rounded-2xl p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2"><Target size={20} className="text-blue-500" />Global Scoring Weights</h2>
                  {saving ? (
                    <div className="flex items-center gap-2 text-blue-400 text-sm font-bold animate-pulse"><Loader2 size={16} className="animate-spin" />Deploying...</div>
                  ) : (
                    <button onClick={handleDeployNewVersion} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2">
                      <Save size={16} />Deploy Changes
                    </button>
                  )}
                </div>
                {weightLoading ? <div className="flex items-center justify-center py-8"><Loader2 className="animate-spin text-blue-500" /></div> : (
                  <div className="space-y-6">
                    {definitions.map(def => {
                      const val = formWeights[def.name] ?? def.default_value;
                      const isModified = val !== (currentSet?.weights[def.name] ?? def.default_value);
                      return (
                        <div key={def.id} className="group">
                          <div className="flex justify-between mb-2">
                            <label className="text-sm font-bold text-slate-300">{def.name.replace(/_/g, ' ').toUpperCase()}</label>
                            <span className={`text-sm font-mono ${isModified ? 'text-amber-400' : 'text-slate-500'}`}>{(val || 0).toFixed(2)}</span>
                          </div>
                          <input type="range" min={def.min_bound} max={def.max_bound} step={0.1} value={val}
                            onChange={e => handleWeightChange(def.name, e.target.value)}
                            className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                          <div className="flex justify-between mt-1 text-[10px] text-slate-600 font-bold uppercase tracking-widest">
                            <span>Min: {def.min_bound}</span><span>Max: {def.max_bound}</span>
                          </div>
                          <p className="text-xs text-slate-500 mt-2">{def.description}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-6">
              <div className="bg-gradient-to-br from-blue-900/20 to-purple-900/20 border border-blue-500/20 rounded-2xl p-6">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Brain size={18} className="text-blue-400" />Active Learning</h3>
                <p className="text-xs text-slate-400 mb-4">Trigger gradient descent to analyze recent outcomes and propose optimized weights.</p>
                <button onClick={handleRunOptimization} disabled={runningOpt}
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 mb-4">
                  {runningOpt ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
                  {runningOpt ? 'Learning...' : 'Run Learning Loop'}
                </button>
                {optResult && (
                  <div className="space-y-2 text-xs bg-[#0F1117] p-3 rounded-lg border border-slate-800">
                    <div className="flex justify-between"><span className="text-slate-500">Samples</span><span>{optResult.samples || 0}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">MSE</span><span className={`font-mono ${optResult.mse > 1000 ? 'text-red-400' : 'text-emerald-400'}`}>{Math.round(optResult.mse || 0)}</span></div>
                    {optResult.candidate_version && (
                      <div className={`mt-2 pt-2 border-t border-slate-800 text-center font-bold ${optResult.auto_promoted ? 'text-blue-400' : 'text-emerald-400'}`}>
                        {optResult.auto_promoted ? `Auto-Promoted v${optResult.candidate_version}` : `Candidate v${optResult.candidate_version} Created`}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="bg-[#12141C] border border-[#23262F] rounded-2xl p-6">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><History size={18} className="text-slate-400" />Deployment History</h3>
                <div className="space-y-4">
                  {weightHistory.map(set => (
                    <div key={set.id} className={`p-4 rounded-xl border ${set.status === 'ACTIVE' ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-slate-900 border-slate-800'}`}>
                      <div className="flex justify-between items-start mb-2">
                        <div className="font-bold text-white">v{set.version}.0</div>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-widest ${set.status === 'ACTIVE' ? 'bg-emerald-500 text-black' : 'bg-slate-800 text-slate-500'}`}>{set.status}</span>
                      </div>
                      <div className="text-xs text-slate-500">{new Date(set.deployed_at).toLocaleDateString()}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-6">
                <h3 className="text-sm font-bold text-amber-500 mb-2 flex items-center gap-2"><AlertTriangle size={16} />Intelligence Warning</h3>
                <p className="text-xs text-amber-200/70 leading-relaxed">Manually deploying weights overrides the automated learning loop. Validate against historical data before deploying to production.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Re-export Save icon for existing import compatibility
export { Save };
