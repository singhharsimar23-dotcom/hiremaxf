import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, Loader2, Mail, Copy, Check, BarChart2, Star, ExternalLink, Zap, TrendingUp, AlertTriangle, ChevronRight, Trash2, Calendar, Briefcase, Command, LayoutGrid, List as ListIcon, Search, Building2, MapPin, DollarSign, Clock, ArrowRight, Eye, UserX, Inbox, Sparkles } from 'lucide-react';
import { ResumeGroup, UserPlan } from '../types';
import { supabase } from '../lib/supabase';
import { GoogleGenAI } from '@google/genai';

const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

interface JobApp {
  id: string; user_id: string; company_name: string; role_title: string;
  job_url?: string; status: string; applied_at: string; last_activity_at: string;
  follow_up_due_at?: string; resume_group_id?: string;
  salary_range?: string; location?: string; company_stage?: string;
  source?: string; notes?: string; contact_name?: string;
  offer_amount?: string; excitement_level?: number;
}

const COLS = [
  { key: 'saved',        label: 'Wishlist',     dot: 'bg-slate-400',  border: 'border-slate-700/50' },
  { key: 'applied',      label: 'Applied',      dot: 'bg-blue-400',   border: 'border-blue-500/30' },
  { key: 'interviewing', label: 'Interviewing', dot: 'bg-amber-400',  border: 'border-amber-500/30' },
  { key: 'offer',        label: 'Offer',        dot: 'bg-green-400',  border: 'border-green-500/30' },
  { key: 'closed',       label: 'Rejected',     dot: 'bg-red-500',    border: 'border-red-500/30' },
];

const SRC_COLOR: Record<string, string> = {
  LinkedIn: 'bg-blue-500/15 text-blue-300',
  Referral: 'bg-green-500/15 text-green-300',
  Recruiter: 'bg-violet-500/15 text-violet-300',
  'Company Site': 'bg-slate-500/15 text-slate-300',
  Other: 'bg-slate-700/50 text-slate-400'
};

const daysAgo = (d: string) => Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
const isOverdue = (due?: string) => due && new Date(due).getTime() < Date.now();
const isSoon = (due?: string) => due && !isOverdue(due) && new Date(due).getTime() - Date.now() < 86400000;

const avatarBg = (name: string) => {
  if (!name) return 'bg-slate-800';
  const palette = ['bg-blue-600', 'bg-violet-600', 'bg-emerald-600', 'bg-amber-600', 'bg-rose-600', 'bg-cyan-600'];
  return palette[name.charCodeAt(0) % palette.length] || 'bg-slate-800';
};

const formatDate = (d: string) => {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(d));
};

interface Props { user: any; plan: UserPlan; history: ResumeGroup[]; onUpgrade: () => void; }

interface AddForm { company: string; role: string; source: string; job_url: string; salary_range: string; follow_up_due_at: string; status: string; }
const EMPTY_FORM: AddForm = { company: '', role: '', source: 'LinkedIn', job_url: '', salary_range: '', follow_up_due_at: '', status: 'applied' };

export const ApplicationTrackerView: React.FC<Props> = ({ user }) => {
  const [apps, setApps] = useState<JobApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewType, setViewType] = useState<'pipeline' | 'list'>('pipeline');

  const [drawerApp, setDrawerApp] = useState<JobApp | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  const [cmdKOpen, setCmdKOpen] = useState(false);
  const [addMode, setAddMode] = useState<'smart' | 'manual'>('manual');
  const [addForm, setAddForm] = useState<AddForm>(EMPTY_FORM);
  const [cmdKInput, setCmdKInput] = useState('');
  const [cmdKSaving, setCmdKSaving] = useState(false);
  const cmdKRef = useRef<HTMLInputElement>(null);

  const [fuText, setFuText] = useState<Record<string, string>>({});
  const [fuLoading, setFuLoading] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const [notes, setNotes] = useState('');
  const notesTimer = useRef<any>(null);

  // Command Palette Listener
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCmdKOpen((open) => !open);
      }
      if (e.key === 'Escape') setCmdKOpen(false);
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  useEffect(() => {
    if (cmdKOpen && cmdKRef.current) cmdKRef.current.focus();
  }, [cmdKOpen]);

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase.from('job_applications').select('*').eq('user_id', user.id).order('applied_at', { ascending: false });
      if (error) throw error;
      if (data) setApps(data);
    } catch (e) {
      console.error("Failed to load applications:", e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
    if (!user) return;
    const ch = supabase.channel(`tracker_${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_applications', filter: `user_id=eq.${user.id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, load]);

  useEffect(() => {
    if (drawerApp) setDrawerApp(apps.find(a => a.id === drawerApp.id) || null);
  }, [apps]);

  const execManualAdd = async () => {
    if (!addForm.company || !addForm.role) return;
    setCmdKSaving(true);
    const fu = new Date(); fu.setDate(fu.getDate() + 7);
    await supabase.from('job_applications').insert({
      company_name: addForm.company, role_title: addForm.role, user_id: user.id,
      status: addForm.status, source: addForm.source,
      applied_at: new Date().toISOString(), last_activity_at: new Date().toISOString(), follow_up_due_at: fu.toISOString()
    });
    setAddForm(EMPTY_FORM); setCmdKSaving(false); setCmdKOpen(false); load();
  };

  const execSmartAdd = async () => {
    if (!cmdKInput.trim()) return;
    setCmdKSaving(true);
    try {
      const ai = new GoogleGenAI({ apiKey: GEMINI_KEY });
      const r = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: `Extract job details from this text: "${cmdKInput}". Return JSON with exactly these keys: "company" (string), "role" (string), "source" (string: LinkedIn, Referral, Recruiter, Company Site, or Other). Make reasonable guesses. If unknown, use "Unknown". Do not use markdown blocks, just raw JSON.`
      });
      let parsed = { company: "Unknown Company", role: "Unknown Role", source: "Other" };
      try {
        const txt = r.text?.replace(/```json/g, '').replace(/```/g, '') || '{}';
        parsed = JSON.parse(txt);
      } catch (err) {}
      
      const fu = new Date(); fu.setDate(fu.getDate() + 7);
      await supabase.from('job_applications').insert({
        company_name: parsed.company || 'Unknown', role_title: parsed.role || 'Unknown', user_id: user.id,
        status: 'applied', source: parsed.source || 'Other',
        applied_at: new Date().toISOString(), last_activity_at: new Date().toISOString(), follow_up_due_at: fu.toISOString()
      });
      setCmdKInput(''); setCmdKOpen(false); load();
    } catch(e) {
      console.error("Smart add failed", e);
    }
    setCmdKSaving(false);
  };

  const move = async (id: string, status: string) => {
    await supabase.from('job_applications').update({ status, last_activity_at: new Date().toISOString() }).eq('id', id);
    setApps(p => p.map(a => a.id === id ? { ...a, status } : a));
  };

  const autoSaveNotes = (id: string, val: string) => {
    setNotes(val);
    clearTimeout(notesTimer.current);
    notesTimer.current = setTimeout(() => supabase.from('job_applications').update({ notes: val }).eq('id', id), 700);
  };

  const updateField = async (id: string, field: string, val: any) => {
    await supabase.from('job_applications').update({ [field]: val }).eq('id', id);
    setApps(p => p.map(a => a.id === id ? { ...a, [field]: val } : a));
  };

  const deleteApp = async (id: string) => {
    await supabase.from('job_applications').delete().eq('id', id);
    setDrawerApp(null);
    setApps(p => p.filter(a => a.id !== id));
  };

  const genFollowUp = async (app: JobApp) => {
    setFuLoading(app.id);
    try {
      const ai = new GoogleGenAI({ apiKey: GEMINI_KEY });
      const r = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: `Write a professional follow-up email. Company: ${app.company_name}. Role: ${app.role_title}. Applied ${daysAgo(app.applied_at)} days ago. Contact: ${app.contact_name || 'Hiring Team'}. Max 80 words. Return only the email body.`
      });
      setFuText(p => ({ ...p, [app.id]: r.text || '' }));
    } catch { }
    setFuLoading(null);
  };

  const copy = (text: string, key: string) =>
    navigator.clipboard.writeText(text).then(() => { setCopied(key); setTimeout(() => setCopied(null), 2000); });

  const active = apps.filter(a => !['closed'].includes(a.status));
  const appliedCount = apps.filter(a => a.status !== 'saved').length;
  const interviews = apps.filter(a => ['interviewing', 'offer'].includes(a.status));
  const offers = apps.filter(a => a.status === 'offer');
  const overdue = apps.filter(a => isOverdue(a.follow_up_due_at) && !['closed', 'offer', 'saved'].includes(a.status));
  
  const interviewRate = appliedCount > 0 ? Math.round(interviews.length / appliedCount * 100) : 0;
  const offerRate = interviews.length > 0 ? Math.round(offers.length / interviews.length * 100) : 0;

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-slate-200">
      
      {/* ═══ Add Application Modal ═══ */}
      <AnimatePresence>
        {cmdKOpen && (
          <div className="fixed inset-0 z-[300] flex items-start justify-center pt-[15vh] px-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setCmdKOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: -20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: -20 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="relative w-full max-w-xl bg-[#111118]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col"
            >
              <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-white/5">
                <div className="flex items-center gap-6">
                  <button onClick={() => setAddMode('manual')} className={`pb-2 text-sm font-bold border-b-2 transition-all ${addMode === 'manual' ? 'border-blue-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>Manual Entry</button>
                  <button onClick={() => setAddMode('smart')} className={`pb-2 text-sm font-bold border-b-2 transition-all flex items-center gap-1.5 ${addMode === 'smart' ? 'border-indigo-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}><Zap size={14}/> Smart Add (AI)</button>
                </div>
                <button onClick={() => setCmdKOpen(false)} className="mb-2 text-slate-500 hover:text-white transition-colors"><X size={18} /></button>
              </div>

              <div className="p-6 bg-[#0A0A0F]/50">
                {addMode === 'smart' ? (
                  <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="flex items-center border border-white/10 bg-[#16161E] rounded-xl px-4 py-3 focus-within:border-indigo-500/50 focus-within:shadow-[0_0_15px_rgba(99,102,241,0.2)] transition-all">
                      <Zap size={18} className="text-indigo-400 mr-3 shrink-0" />
                      <input
                        ref={cmdKRef} value={cmdKInput} onChange={e => setCmdKInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && execSmartAdd()}
                        placeholder='Paste job details... e.g. "Senior Frontend at Stripe via LinkedIn"'
                        className="flex-1 bg-transparent border-none outline-none text-white placeholder:text-slate-600 text-sm"
                      />
                      {cmdKSaving ? <Loader2 size={16} className="animate-spin text-indigo-500 ml-2" /> : <button onClick={execSmartAdd} disabled={!cmdKInput.trim()} className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white p-1.5 rounded-lg ml-2 transition-colors"><ArrowRight size={14}/></button>}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-4 flex items-center gap-1.5 bg-indigo-500/5 inline-flex px-3 py-1.5 rounded-md border border-indigo-500/10"><Sparkles size={12} className="text-indigo-400"/> AI automatically extracts Company, Role, Source, and Sets Dates.</p>
                  </div>
                ) : (
                  <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="grid grid-cols-2 gap-5">
                      <div>
                        <label className="block text-[10px] font-black uppercase text-slate-500 mb-1.5 tracking-widest">Company Name <span className="text-blue-500">*</span></label>
                        <input value={addForm.company} onChange={e => setAddForm({...addForm, company: e.target.value})} className="w-full bg-[#16161E] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-blue-500/50 focus:bg-[#1E1E2A] transition-all" placeholder="e.g. Acme Corp" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase text-slate-500 mb-1.5 tracking-widest">Role Title <span className="text-blue-500">*</span></label>
                        <input value={addForm.role} onChange={e => setAddForm({...addForm, role: e.target.value})} className="w-full bg-[#16161E] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-blue-500/50 focus:bg-[#1E1E2A] transition-all" placeholder="e.g. Software Engineer" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-5">
                      <div>
                        <label className="block text-[10px] font-black uppercase text-slate-500 mb-1.5 tracking-widest">Source</label>
                        <select value={addForm.source} onChange={e => setAddForm({...addForm, source: e.target.value})} className="w-full bg-[#16161E] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-300 outline-none focus:border-blue-500/50 focus:bg-[#1E1E2A] transition-all appearance-none cursor-pointer">
                          {['LinkedIn','Referral','Recruiter','Company Site','Other'].map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase text-slate-500 mb-1.5 tracking-widest">Status</label>
                        <select value={addForm.status} onChange={e => setAddForm({...addForm, status: e.target.value})} className="w-full bg-[#16161E] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-300 outline-none focus:border-blue-500/50 focus:bg-[#1E1E2A] transition-all appearance-none cursor-pointer">
                          {COLS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="flex justify-end pt-3">
                      <button onClick={execManualAdd} disabled={!addForm.company || !addForm.role || cmdKSaving} className="flex items-center gap-2 bg-white hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed text-black text-xs font-black uppercase tracking-widest px-6 py-2.5 rounded-xl transition-all shadow-[0_0_15px_rgba(255,255,255,0.1)] hover:shadow-[0_0_20px_rgba(255,255,255,0.2)]">
                        {cmdKSaving ? <Loader2 size={14} className="animate-spin"/> : <Plus size={14}/>} Add Application
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ═══ FAANG Header ═══ */}
      <div className="sticky top-0 z-40 bg-[#0A0A0F]/80 backdrop-blur-2xl border-b border-white/5">
        <div className="max-w-[1600px] mx-auto px-8 h-16 flex items-center justify-between">
          
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                <Briefcase size={14} className="text-white" />
              </div>
              <h1 className="text-lg font-black text-white tracking-tight">Execution Engine</h1>
            </div>
            
            <div className="h-4 w-px bg-white/10" />
            
            <div className="flex items-center bg-[#13131B] border border-white/5 rounded-lg p-0.5">
              <button onClick={() => setViewType('pipeline')} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${viewType === 'pipeline' ? 'bg-[#1E1E2A] text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}>
                <LayoutGrid size={14} /> Board
              </button>
              <button onClick={() => setViewType('list')} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${viewType === 'list' ? 'bg-[#1E1E2A] text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}>
                <ListIcon size={14} /> List
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button onClick={() => setCmdKOpen(true)} className="flex items-center gap-3 px-3 py-1.5 rounded-lg border border-white/10 bg-[#13131B] text-slate-400 hover:text-slate-200 transition-colors text-sm">
              <Search size={14} /> Quick Action...
              <div className="flex items-center gap-1"><kbd className="bg-white/10 border border-white/10 px-1.5 rounded text-[10px] font-sans">⌘</kbd><kbd className="bg-white/10 border border-white/10 px-1.5 rounded text-[10px] font-sans">K</kbd></div>
            </button>
            <button onClick={() => setCmdKOpen(true)} className="flex items-center gap-2 bg-white text-black font-black text-xs uppercase tracking-widest px-4 py-2 rounded-lg hover:bg-slate-200 transition-all shadow-lg shadow-white/5">
              <Plus size={14} /> New App
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-8 py-8 flex gap-8">

        {/* ═══ Main View Area ═══ */}
        <div className="flex-1 min-w-0">
          
          {loading ? (
            <div className="flex items-center justify-center h-64"><Loader2 size={24} className="text-blue-500 animate-spin" /></div>
          ) : viewType === 'pipeline' ? (
            
            /* PIPELINE VIEW (Kanban) */
            <div className="flex gap-4 overflow-x-auto pb-8 snap-x">
              {COLS.map(col => {
                const colApps = apps.filter(a => a.status === col.key);
                return (
                  <div key={col.key} className="flex flex-col shrink-0 w-[280px] snap-center"
                    onDragOver={e => { e.preventDefault(); setDragOver(col.key); }}
                    onDragLeave={() => setDragOver(null)}
                    onDrop={e => { e.preventDefault(); if (dragging) move(dragging, col.key); setDragging(null); setDragOver(null); }}>
                    
                    <div className="flex items-center justify-between mb-3 px-1 group/header">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${col.dot} shadow-[0_0_8px_currentColor]`} />
                        <h3 className="text-slate-300 font-bold text-sm">{col.label}</h3>
                        <span className="text-xs font-semibold text-slate-500 bg-white/5 px-2 py-0.5 rounded-md border border-white/5">{colApps.length}</span>
                      </div>
                      <button onClick={() => setCmdKOpen(true)} className="p-1 text-slate-500 opacity-0 group-hover/header:opacity-100 hover:text-white hover:bg-white/10 rounded transition-all" title={`Add to ${col.label}`}>
                        <Plus size={14} />
                      </button>
                    </div>

                    <div className={`flex-1 rounded-2xl p-2 min-h-[300px] transition-colors duration-200 ${dragOver === col.key ? 'bg-white/5 border border-dashed border-white/20' : 'bg-[#111118]/50 border border-white/5'}`}>
                      <AnimatePresence>
                        {colApps.map(app => {
                          const over = isOverdue(app.follow_up_due_at) && !['closed', 'offer'].includes(app.status);
                          return (
                            <motion.div layout layoutId={app.id} key={app.id}
                              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                              draggable onDragStart={() => setDragging(app.id)} onDragEnd={() => setDragging(null)}
                              onClick={() => { setDrawerApp(app); setNotes(app.notes || ''); }}
                              className={`mb-2 bg-[#16161E] border border-white/5 rounded-xl p-4 cursor-pointer group hover:bg-[#1C1C28] hover:border-white/10 hover:shadow-xl transition-all ${dragging === app.id ? 'opacity-40 scale-95 cursor-grabbing' : 'cursor-grab'}`}
                            >
                              <div className="flex items-start justify-between gap-3 mb-3">
                                <div className={`w-8 h-8 rounded-lg ${avatarBg(app.company_name)} flex items-center justify-center text-white font-black text-xs shrink-0`}>
                                  {app.company_name ? app.company_name.slice(0, 2).toUpperCase() : '??'}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-white font-bold text-sm truncate">{app.company_name || 'Unknown'}</p>
                                  <p className="text-slate-400 text-xs truncate mt-0.5">{app.role_title}</p>
                                </div>
                                {over && <AlertTriangle size={12} className="text-red-400 shrink-0" />}
                              </div>
                              <div className="flex items-center justify-between mt-4">
                                <div className="flex items-center gap-1 text-slate-500 text-xs">
                                  <Clock size={11} /> {daysAgo(app.applied_at)}d
                                </div>
                                {app.source && <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-current/20 ${SRC_COLOR[app.source] || SRC_COLOR.Other}`}>{app.source}</span>}
                              </div>
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>
                      {colApps.length === 0 && (
                        <button onClick={() => setCmdKOpen(true)} className="w-full h-24 border border-dashed border-white/5 rounded-xl flex items-center justify-center text-slate-500 hover:text-white hover:border-white/20 transition-colors text-xs font-medium group/drop">
                          <Plus size={14} className="mr-1 opacity-50 group-hover/drop:opacity-100 transition-opacity" /> Drop or Add Job
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            
          ) : (
            
            /* LIST VIEW (Database Table) */
            <div className="bg-[#111118] border border-white/5 rounded-2xl overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead className="bg-[#16161E] border-b border-white/5">
                  <tr>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-widest w-1/3">Company & Role</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-widest">Status</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-widest">Applied</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-widest">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {apps.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-12 text-center">
                        <p className="text-slate-500 mb-4">No applications tracked yet.</p>
                        <button onClick={() => setCmdKOpen(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-white text-black font-bold text-xs uppercase tracking-widest rounded-lg hover:bg-slate-200 transition-colors shadow-lg shadow-white/5">
                          <Plus size={14} /> Add First Job
                        </button>
                      </td>
                    </tr>
                  ) : (
                    apps.map(app => (
                      <tr key={app.id} onClick={() => { setDrawerApp(app); setNotes(app.notes || ''); }} className="hover:bg-white/[0.02] cursor-pointer group transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg ${avatarBg(app.company_name)} flex items-center justify-center text-white font-black text-xs shrink-0`}>
                              {app.company_name ? app.company_name.slice(0, 2).toUpperCase() : '??'}
                            </div>
                            <div>
                              <p className="text-white font-bold text-sm">{app.company_name || 'Unknown'}</p>
                              <p className="text-slate-400 text-xs">{app.role_title}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {COLS.map(c => c.key === app.status && (
                            <div key={c.key} className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${c.dot} shadow-[0_0_8px_currentColor]`} />
                              <span className="text-slate-300 text-xs font-semibold">{c.label}</span>
                            </div>
                          ))}
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-slate-400 text-xs">{formatDate(app.applied_at)}</span>
                        </td>
                        <td className="px-6 py-4">
                          {app.source ? <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-current/20 ${SRC_COLOR[app.source] || SRC_COLOR.Other}`}>{app.source}</span> : <span className="text-slate-600 text-xs">—</span>}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ═══ Intelligence Pulse Sidebar ═══ */}
        <div className="w-[280px] shrink-0 space-y-6">
          <div className="bg-[#111118] border border-white/5 rounded-2xl p-6 sticky top-24 shadow-2xl">
            <h3 className="text-white font-bold text-sm mb-6 flex items-center gap-2"><ActivityIcon /> Intelligence Pulse</h3>
            
            <div className="space-y-6">
              {/* Funnel */}
              <div>
                <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-3">Conversion Pipeline</p>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="bg-[#16161E] rounded-xl p-3 border border-white/5">
                    <p className="text-slate-400 text-xs font-semibold mb-1">Applied</p>
                    <p className="text-white font-black text-xl">{appliedCount}</p>
                  </div>
                  <div className="bg-indigo-500/10 rounded-xl p-3 border border-indigo-500/20">
                    <p className="text-indigo-300 text-xs font-semibold mb-1">Interviews</p>
                    <p className="text-indigo-400 font-black text-xl">{interviews.length}</p>
                  </div>
                </div>
                
                {/* Visual Funnel Bar */}
                <div className="bg-[#16161E] border border-white/5 rounded-xl p-4 mb-2 relative overflow-hidden">
                   <div className="flex justify-between items-end mb-2">
                     <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Interview Rate</span>
                     <span className={`font-black text-sm ${interviewRate >= 20 ? 'text-green-400' : interviewRate >= 10 ? 'text-amber-400' : 'text-slate-300'}`}>{interviewRate}%</span>
                   </div>
                   <div className="h-1.5 w-full bg-[#0A0A0F] rounded-full overflow-hidden">
                     <div className={`h-full rounded-full transition-all duration-1000 ${interviewRate >= 20 ? 'bg-green-500' : interviewRate >= 10 ? 'bg-amber-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(interviewRate, 100)}%` }} />
                   </div>
                </div>

                <div className="bg-[#16161E] border border-white/5 rounded-xl p-4 relative overflow-hidden">
                   <div className="flex justify-between items-end mb-2">
                     <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Offer Rate</span>
                     <span className={`font-black text-sm ${offerRate >= 50 ? 'text-green-400' : offerRate > 0 ? 'text-amber-400' : 'text-slate-300'}`}>{offerRate}%</span>
                   </div>
                   <div className="h-1.5 w-full bg-[#0A0A0F] rounded-full overflow-hidden">
                     <div className={`h-full rounded-full transition-all duration-1000 ${offerRate >= 50 ? 'bg-green-500' : offerRate > 0 ? 'bg-amber-500' : 'bg-indigo-500'}`} style={{ width: `${Math.min(offerRate, 100)}%` }} />
                   </div>
                </div>
              </div>

              {/* Action Center */}
              <div className="border-t border-white/5 pt-6">
                <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-3">Action Center</p>
                {overdue.length > 0 ? (
                  <div className="space-y-2">
                    {overdue.slice(0, 3).map(a => (
                      <div key={a.id} className="flex items-center justify-between bg-red-500/10 border border-red-500/20 rounded-xl p-3 cursor-pointer hover:bg-red-500/20 transition-colors" onClick={() => { setDrawerApp(a); setNotes(a.notes || ''); }}>
                        <div className="min-w-0 pr-2">
                          <p className="text-red-100 text-xs font-bold truncate">{a.company_name}</p>
                          <p className="text-red-400 text-[10px] truncate">Follow-up Overdue</p>
                        </div>
                        <ArrowRight size={14} className="text-red-400 shrink-0" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-[#16161E] border border-white/5 rounded-xl p-4 flex flex-col items-center justify-center text-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center"><Check size={14} className="text-green-400"/></div>
                    <p className="text-slate-400 text-xs font-medium">Inbox Zero. Great job.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Notion-Style Deep-Dive Drawer ═══ */}
      <AnimatePresence>
        {drawerApp && (
          <div className="fixed inset-0 z-[150] flex justify-end">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDrawerApp(null)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            
            <motion.div 
              initial={{ x: '100%', opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative w-full max-w-2xl bg-[#0D0D14] border-l border-white/10 shadow-2xl h-full overflow-y-auto" 
              onClick={e => e.stopPropagation()}
            >
              {/* Cover Header */}
              <div className={`h-32 w-full ${avatarBg(drawerApp.company_name)} relative`}>
                 <div className="absolute inset-0 bg-gradient-to-t from-[#0D0D14] to-transparent opacity-80" />
                 <button onClick={() => setDrawerApp(null)} className="absolute top-4 right-4 w-8 h-8 bg-black/20 hover:bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center text-white transition-colors">
                   <X size={16} />
                 </button>
              </div>

              <div className="px-10 pb-12 -mt-10 relative z-10">
                {/* Logo Icon */}
                <div className={`w-20 h-20 rounded-2xl ${avatarBg(drawerApp.company_name)} border-4 border-[#0D0D14] flex items-center justify-center text-white font-black text-3xl mb-6 shadow-xl`}>
                  {drawerApp.company_name ? drawerApp.company_name.slice(0, 2).toUpperCase() : '??'}
                </div>

                {/* Editable Title */}
                <div className="mb-8">
                  <input value={drawerApp.company_name} onChange={e => updateField(drawerApp.id, 'company_name', e.target.value)}
                    className="w-full bg-transparent text-white font-black text-4xl md:text-5xl outline-none placeholder:text-slate-700 tracking-tight mb-2" placeholder="Company Name" />
                  <input value={drawerApp.role_title} onChange={e => updateField(drawerApp.id, 'role_title', e.target.value)}
                    className="w-full bg-transparent text-slate-400 font-bold text-xl outline-none placeholder:text-slate-700" placeholder="Role Title" />
                </div>

                {/* Notion-style Properties Grid */}
                <div className="space-y-1 mb-8 border-b border-white/5 pb-8">
                  <PropertyRow icon={<LayoutGrid size={14}/>} label="Status">
                    <select value={drawerApp.status} onChange={e => move(drawerApp.id, e.target.value)}
                      className="bg-transparent text-sm font-semibold text-white outline-none cursor-pointer appearance-none">
                      {COLS.map(c => <option key={c.key} value={c.key} className="bg-[#16161E]">{c.label}</option>)}
                    </select>
                  </PropertyRow>
                  <PropertyRow icon={<Calendar size={14}/>} label="Applied On">
                    <span className="text-sm text-slate-300">{formatDate(drawerApp.applied_at)}</span>
                  </PropertyRow>
                  <PropertyRow icon={<Building2 size={14}/>} label="Source">
                    <select value={drawerApp.source || 'Other'} onChange={e => updateField(drawerApp.id, 'source', e.target.value)}
                      className="bg-transparent text-sm text-slate-300 outline-none cursor-pointer appearance-none">
                      {['LinkedIn','Referral','Recruiter','Company Site','Other'].map(s => <option key={s} value={s} className="bg-[#16161E]">{s}</option>)}
                    </select>
                  </PropertyRow>
                  <PropertyRow icon={<DollarSign size={14}/>} label="Salary">
                    <input value={drawerApp.salary_range || ''} onChange={e => updateField(drawerApp.id, 'salary_range', e.target.value)}
                      className="bg-transparent text-sm text-slate-300 outline-none w-full placeholder:text-slate-600" placeholder="e.g. $120k - $150k" />
                  </PropertyRow>
                  <PropertyRow icon={<ExternalLink size={14}/>} label="Link">
                    <input value={drawerApp.job_url || ''} onChange={e => updateField(drawerApp.id, 'job_url', e.target.value)}
                      className="bg-transparent text-sm text-blue-400 outline-none w-full placeholder:text-slate-600" placeholder="https://" />
                  </PropertyRow>
                  <PropertyRow icon={<Star size={14}/>} label="Excitement">
                    <div className="flex gap-1">
                      {[1,2,3,4,5].map(s => (
                        <button key={s} onClick={() => updateField(drawerApp.id, 'excitement_level', s)}>
                          <Star size={14} className={s <= (drawerApp.excitement_level || 0) ? 'text-amber-400 fill-amber-400' : 'text-slate-700 hover:text-slate-500'} />
                        </button>
                      ))}
                    </div>
                  </PropertyRow>
                </div>

                {/* Scratchpad (Rich Text feel) */}
                <div className="mb-10">
                  <h3 className="text-white font-bold text-lg mb-4">Scratchpad</h3>
                  <textarea value={notes} onChange={e => autoSaveNotes(drawerApp.id, e.target.value)}
                    placeholder="Drop interview notes, recruiter emails, and thoughts here..."
                    className="w-full min-h-[300px] bg-transparent text-slate-300 text-base leading-relaxed outline-none resize-none placeholder:text-slate-600 border-none p-0 focus:ring-0" />
                </div>

                {/* Actions */}
                <div className="space-y-3 pt-6 border-t border-white/5">
                  <p className="text-slate-500 text-xs font-semibold uppercase tracking-widest mb-3">AI Tools</p>
                  
                  <div className="bg-[#16161E] border border-blue-500/20 rounded-xl p-5 relative overflow-hidden group">
                    <div className="absolute right-0 top-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl group-hover:bg-blue-500/20 transition-colors" />
                    <div className="relative z-10 flex flex-col gap-4">
                      <div>
                        <h4 className="text-white font-bold text-sm mb-1">Generate Follow-up</h4>
                        <p className="text-slate-400 text-xs">Let Gemini draft a polite check-in email based on your status.</p>
                      </div>
                      <button onClick={() => genFollowUp(drawerApp)} disabled={!!fuLoading}
                        className="self-start flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-sm font-bold transition-colors shadow-lg shadow-blue-500/20">
                        {fuLoading === drawerApp.id ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />} Draft Email
                      </button>
                      
                      {fuText[drawerApp.id] && (
                        <div className="mt-2 bg-[#0A0A0F] border border-white/10 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-blue-400">Drafted Email</span>
                            <button onClick={() => copy(fuText[drawerApp.id], drawerApp.id)} className="text-xs text-slate-400 hover:text-white flex items-center gap-1">
                              {copied === drawerApp.id ? <Check size={12} className="text-green-400"/> : <Copy size={12}/>} Copy
                            </button>
                          </div>
                          <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{fuText[drawerApp.id]}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <button onClick={() => { if (window.confirm('Delete this application forever?')) deleteApp(drawerApp.id); }}
                    className="w-full flex items-center justify-center gap-2 py-3 text-red-500 hover:bg-red-500/10 rounded-xl text-sm font-semibold transition-colors mt-8">
                    <Trash2 size={14} /> Delete Application
                  </button>
                </div>

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
    </div>
  );
};

const ActivityIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
);

const PropertyRow: React.FC<{icon: React.ReactNode, label: string, children: React.ReactNode}> = ({icon, label, children}) => (
  <div className="flex items-center gap-4 py-1.5 group">
    <div className="w-32 flex items-center gap-2 text-slate-500 shrink-0">
      {icon}
      <span className="text-sm font-medium">{label}</span>
    </div>
    <div className="flex-1 min-w-0">
      {children}
    </div>
  </div>
);
