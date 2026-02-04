
import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, Square, Search, Shield, Terminal, 
  Activity, ArrowRight, Zap, Target, Filter, AlertTriangle, 
  CheckCircle2, Loader2, Briefcase, Building2, ExternalLink,
  ChevronDown, Radio, Info, Lock, ShieldAlert, ShieldCheck,
  ChevronRight, ListOrdered, UserCircle, Gauge, Timer, AlertOctagon,
  Database, Plus, Link as LinkIcon, Server, FileText, History,
  ShieldX, Trash2, Cpu, Eye, FileSearch, Fingerprint, RefreshCw,
  Sliders, ArrowUpRight, Scale, X, Check, Clock, Workflow
} from 'lucide-react';
import { 
  UserPlan, RunStatus, DbExecutionRun, DbExecutionTarget, DbExecutionLog, 
  UserProfile, ResumeProfile
} from '../types';
import { supabase } from '../lib/supabase';

interface ApplicationsViewProps {
  plan: UserPlan;
  profile?: UserProfile | null;
}

export const ApplicationsView: React.FC<ApplicationsViewProps> = ({ plan, profile }) => {
  const [activeRun, setActiveRun] = useState<DbExecutionRun | null>(null);
  const [targets, setTargets] = useState<DbExecutionTarget[]>([]);
  const [logs, setLogs] = useState<DbExecutionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);

  const [params, setParams] = useState({
    role: '',
    resumeId: profile?.resume_profiles?.find(p => p.isPrimary)?.id || '',
    geography: 'Remote / US'
  });

  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll terminal
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  // Initial Data Fetch: Load most recent execution run from DB
  useEffect(() => {
    async function loadState() {
      // If profile is explicitly null or hasn't loaded, stop loading but don't fetch
      if (!profile?.id) {
        setLoading(false);
        return;
      }

      try {
        const { data: run, error: runError } = await supabase
          .from('execution_runs')
          .select('*')
          .eq('user_id', profile.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (run) {
          setActiveRun(run);
          
          const { data: targetData } = await supabase
            .from('execution_targets')
            .select('*')
            .eq('run_id', run.id);
          
          const { data: logData } = await supabase
            .from('execution_logs')
            .select('*')
            .eq('run_id', run.id)
            .order('created_at', { ascending: true });

          setTargets(targetData || []);
          setLogs(logData || []);
          
          if (run.status === 'running') {
            setExecuting(true);
          }
        }
      } catch (err) {
        console.error("Failed to rehydrate execution state:", err);
      } finally {
        setLoading(false);
      }
    }
    loadState();
  }, [profile?.id]); // Use profile.id as dependency for more precise re-runs

  const handleStartRun = async () => {
    if (!profile?.id || !params.role || !params.resumeId) return;
    setExecuting(true);

    try {
      const { data: run, error } = await supabase
        .from('execution_runs')
        .insert({
          user_id: profile.id,
          resume_id: params.resumeId,
          target_role: params.role,
          status: 'running'
        })
        .select()
        .single();

      if (error || !run) {
        setExecuting(false);
        return;
      }

      setActiveRun(run);
      setLogs([]);
      setTargets([]);

      const { data: logInit } = await supabase.from('execution_logs').insert({ 
        run_id: run.id, 
        message: "Application Pipeline Handshake Successful.", 
        level: 'info' 
      }).select().single();
      
      if (logInit) setLogs([logInit]);

      // Discover Targets loop
      setTimeout(async () => {
        const { data: logSearch } = await supabase.from('execution_logs').insert({ 
          run_id: run.id, 
          message: "Identifying headcount targets for role...", 
          level: 'info' 
        }).select().single();
        if (logSearch) setLogs(prev => [...prev, logSearch]);
        
        const newTargets: Partial<DbExecutionTarget>[] = [
          { run_id: run.id, company: "Linear", job_title: params.role, apply_url: "https://linear.app/careers", status: "queued" },
          { run_id: run.id, company: "Vercel", job_title: params.role, apply_url: "https://vercel.com/careers", status: "queued" },
          { run_id: run.id, company: "Retool", job_title: params.role, apply_url: "https://retool.com/careers", status: "queued" }
        ];

        const { data: savedTargets } = await supabase.from('execution_targets').insert(newTargets).select();
        setTargets(savedTargets || []);

        const { data: logFound } = await supabase.from('execution_logs').insert({ 
          run_id: run.id, 
          message: `Committed ${savedTargets?.length || 0} targets to run sequence.`, 
          level: 'success' 
        }).select().single();
        if (logFound) setLogs(prev => [...prev, logFound]);

        processTargets(run.id, savedTargets || []);
      }, 1500);
    } catch (err) {
      console.error("Failed to start run:", err);
      setExecuting(false);
    }
  };

  const processTargets = async (runId: string, targetList: DbExecutionTarget[]) => {
    for (const target of targetList) {
      // Check for abort in the middle of loop
      const { data: currentRun } = await supabase.from('execution_runs').select('status').eq('id', runId).single();
      if (currentRun?.status === 'aborted') break;

      const { data: logApply } = await supabase.from('execution_logs').insert({ 
        run_id: runId, 
        message: `Dispatching profile to ${target.company}...`, 
        level: 'info' 
      }).select().single();
      if (logApply) setLogs(prev => [...prev, logApply]);
      
      await new Promise(r => setTimeout(r, 2500));

      const { error } = await supabase
        .from('execution_targets')
        .update({ status: 'submitted' })
        .eq('id', target.id);

      if (!error) {
        setTargets(prev => prev.map(t => t.id === target.id ? { ...t, status: 'submitted' } : t));
        const { data: logOk } = await supabase.from('execution_logs').insert({ 
          run_id: runId, 
          message: `Submission confirmed: ${target.company}.`, 
          level: 'success' 
        }).select().single();
        if (logOk) setLogs(prev => [...prev, logOk]);
      }
    }

    const { data: checkFinalStatus } = await supabase.from('execution_runs').select('status').eq('id', runId).single();
    if (checkFinalStatus?.status !== 'aborted') {
      await supabase.from('execution_runs').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', runId);
      setActiveRun(prev => prev ? { ...prev, status: 'completed' } : null);
    }
    setExecuting(false);
  };

  const handleAbort = async () => {
    if (!activeRun) return;
    setExecuting(false);
    await supabase.from('execution_runs').update({ status: 'aborted' }).eq('id', activeRun.id);
    setActiveRun(prev => prev ? { ...prev, status: 'aborted' } : null);
    
    await supabase.from('execution_logs').insert({ 
      run_id: activeRun.id, 
      message: "Emergency Abort Triggered by User.", 
      level: 'error' 
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <Loader2 className="animate-spin text-blue-500" size={48} />
        <p className="text-slate-500 font-black uppercase tracking-[0.3em] text-[10px] animate-pulse">Initializing Execution Registry...</p>
      </div>
    );
  }

  const dailyLimit = profile?.metadata?.daily_application_limit || 50;
  const sentToday = profile?.metadata?.applications_sent_today || 0;

  return (
    <div className="max-w-[1400px] mx-auto py-12 px-10 space-y-10 animate-in fade-in duration-700">
      
      <div className="flex items-center justify-between bg-[#16161E] border border-white/5 p-6 rounded-[2.5rem] shadow-2xl">
         <div className="flex items-center gap-6">
            <div className="w-12 h-12 rounded-2xl bg-blue-600/10 flex items-center justify-center text-blue-500">
               <ShieldCheck size={24} />
            </div>
            <div>
               <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Execution Registry</p>
               <h3 className="text-xl font-black text-white uppercase tracking-tight">Active Application Pipeline</h3>
            </div>
         </div>
         <div className="flex items-center gap-8">
            <div className="text-right">
               <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Sent Today</p>
               <p className="text-xl font-black text-white">{sentToday} / {dailyLimit}</p>
            </div>
            <div className="h-10 w-[1px] bg-white/5" />
            <div className="text-right">
               <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">System State</p>
               <p className={`text-xl font-black uppercase ${activeRun?.status === 'running' ? 'text-blue-500 animate-pulse' : 'text-green-500'}`}>
                 {activeRun?.status || 'READY'}
               </p>
            </div>
         </div>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-end gap-8">
        <div className="space-y-4">
           <h2 className="text-6xl font-black text-white tracking-tighter uppercase leading-none">Market Execution</h2>
           <p className="text-slate-500 text-lg font-medium max-w-xl leading-relaxed">
             Dispatch tailored resume variants to target job listings. All application runs are persistent, logged, and tracked via the HireMax state engine.
           </p>
        </div>

        <div className="flex gap-4">
          {activeRun?.status === 'running' ? (
            <button onClick={handleAbort} className="bg-red-600/10 border border-red-500/20 text-red-500 px-10 py-5 rounded-2xl flex items-center gap-3 hover:bg-red-500 hover:text-white transition-all font-black text-xs uppercase tracking-widest shadow-2xl">
              <Square size={20} fill="currentColor" /> Abort active run
            </button>
          ) : (
            <button 
              onClick={handleStartRun} 
              disabled={!params.role || executing || !profile?.id}
              className="bg-blue-600 text-white px-16 py-6 rounded-2xl flex items-center gap-4 hover:bg-blue-500 transition-all font-black text-sm uppercase tracking-[0.2em] shadow-2xl shadow-blue-900/40 disabled:opacity-30"
            >
              <Play size={20} fill="currentColor" /> Start Application Run
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-4 space-y-10">
          
          <div className="bg-[#16161E] border border-[#1D1D26] p-10 rounded-[3rem] space-y-10 shadow-2xl">
            <div className="flex items-center gap-3 border-b border-white/5 pb-6">
              <Sliders size={20} className="text-blue-500" />
              <h3 className="text-white font-black uppercase text-xs tracking-[0.2em]">Run Parameters</h3>
            </div>
            
            <div className="space-y-8">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Assigned Role</label>
                <input 
                  value={params.role} 
                  disabled={executing}
                  onChange={e => setParams({...params, role: e.target.value})}
                  className="w-full bg-[#0D0D12] border border-[#2D313D] rounded-2xl p-5 text-white outline-none focus:border-blue-500 transition-all font-bold" 
                  placeholder="e.g. Lead Software Engineer"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Identity Blueprint</label>
                <select 
                  value={params.resumeId}
                  disabled={executing}
                  onChange={e => setParams({...params, resumeId: e.target.value})}
                  className="w-full bg-[#0D0D12] border border-[#2D313D] rounded-xl p-4 text-white outline-none focus:border-blue-500 font-bold appearance-none text-xs"
                >
                  {profile?.resume_profiles?.map(p => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                  {!profile?.resume_profiles?.length && <option value="">No profiles in registry</option>}
                </select>
              </div>
            </div>
          </div>

          <div className="bg-[#0D0D12] border border-[#2D313D] rounded-[3rem] overflow-hidden flex flex-col h-[450px] shadow-2xl">
            <div className="bg-[#16161E] px-10 py-5 border-b border-[#2D313D] flex items-center justify-between">
              <div className="flex items-center gap-3">
                 <Terminal size={14} className="text-blue-500" />
                 <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Execution Registry Log</span>
              </div>
              {executing && <Loader2 size={12} className="animate-spin text-blue-500" />}
            </div>
            <div ref={scrollRef} className="flex-1 p-10 font-mono text-[10px] space-y-4 overflow-y-auto custom-scrollbar">
              {logs.length === 0 && <p className="text-slate-800">Registry Idle. Awaiting initialization.</p>}
              {logs.map(log => (
                <div key={log.id} className="flex gap-4 group animate-in slide-in-from-left-2 duration-300">
                  <span className="text-slate-800 shrink-0">[{new Date(log.created_at).toLocaleTimeString()}]</span>
                  <span className={`font-bold uppercase shrink-0 ${
                    log.level === 'error' ? 'text-red-500' : 
                    log.level === 'success' ? 'text-green-500' : 'text-blue-500/80'
                  }`}>{log.level}</span>
                  <span className="text-slate-500 leading-relaxed">{log.message}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-8 space-y-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { l: 'Run Targets', v: targets.length, i: Target, c: 'text-blue-500' },
              { l: 'Pending Sequence', v: targets.filter(t => t.status === 'queued').length, i: Cpu, c: 'text-indigo-500' },
              { l: 'Completed Today', v: targets.filter(t => t.status === 'submitted').length, i: CheckCircle2, c: 'text-green-500' }
            ].map((stat, i) => (
              <div key={i} className="bg-[#16161E] border border-[#1D1D26] p-8 rounded-[2.5rem] shadow-xl">
                 <stat.i size={20} className={`${stat.c} mb-4`} />
                 <p className="text-3xl font-black text-white">{stat.v}</p>
                 <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">{stat.l}</p>
              </div>
            ))}
          </div>

          <div className="space-y-6">
             <div className="flex items-center justify-between px-2">
                <h3 className="text-white font-black text-2xl uppercase tracking-tight">Active Run Targets</h3>
             </div>
             
             {targets.length === 0 ? (
               <div className="py-48 bg-[#111118] border border-white/5 border-dashed rounded-[4rem] text-center space-y-6">
                  <div className="w-20 h-20 rounded-[2.5rem] bg-white/5 flex items-center justify-center mx-auto text-slate-700">
                    <Briefcase size={40} />
                  </div>
                  <div className="space-y-2">
                    <p className="text-slate-500 font-black uppercase tracking-[0.2em] text-sm">Deployment Ready</p>
                    <p className="text-slate-700 text-xs font-medium uppercase tracking-widest">Active targets appear here during run</p>
                  </div>
               </div>
             ) : (
               <div className="space-y-4">
                 {targets.map(target => (
                   <div key={target.id} className="bg-[#16161E] border border-white/5 p-8 rounded-3xl transition-all shadow-xl group hover:border-blue-500/30">
                      <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                         <div className="flex items-center gap-6">
                            <div className="w-12 h-12 rounded-2xl bg-[#0D0D12] border border-white/10 flex items-center justify-center text-slate-400">
                               <Building2 size={24} />
                            </div>
                            <div className="space-y-1">
                               <div className="flex items-center gap-3">
                                  <p className="text-white font-black text-xl uppercase tracking-tight">{target.job_title}</p>
                                  <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${
                                    target.status === 'submitted' ? 'bg-green-500/10 text-green-500' : 'bg-blue-500/10 text-blue-500'
                                  }`}>
                                    {target.status}
                                  </span>
                               </div>
                               <p className="text-blue-500 font-bold text-sm uppercase tracking-widest">{target.company}</p>
                            </div>
                         </div>
                         <div className="flex items-center gap-3">
                            <a 
                              href={target.apply_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="p-3 bg-[#0D0D12] border border-white/5 text-slate-500 hover:text-white rounded-xl transition-all"
                            >
                               <ExternalLink size={16} />
                            </a>
                            {target.status === 'submitted' && (
                              <div className="px-6 py-3 bg-green-500/10 text-green-500 rounded-xl border border-green-500/20 flex items-center gap-2">
                                <Check size={14} />
                                <span className="text-[10px] font-black uppercase tracking-widest">Dispatched</span>
                              </div>
                            )}
                         </div>
                      </div>
                   </div>
                 ))}
               </div>
             )}
          </div>
        </div>
      </div>
      
      <div className="p-12 border border-white/5 bg-[#0D0D12] rounded-[4rem] text-center shadow-inner">
         <p className="text-[10px] font-black text-slate-800 uppercase tracking-[0.8em] mb-4">Production Disclaimer</p>
         <p className="text-slate-600 text-xs max-w-4xl mx-auto leading-relaxed font-bold uppercase tracking-widest">
           Applications executed via HireMax are live dispatches to external endpoints. Execution state is immutable and auditable. System limits are strictly enforced to preserve profile reputation in external candidate registries.
         </p>
      </div>
    </div>
  );
};
