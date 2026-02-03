
import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, Pause, Square, Search, Globe, Shield, Terminal, 
  Activity, ArrowRight, Zap, Target, Filter, AlertTriangle, 
  CheckCircle2, Loader2, Briefcase, Building2, ExternalLink,
  ChevronDown, Radio, Info, Lock, ShieldAlert, ShieldCheck,
  ChevronRight, ListOrdered, UserCircle, Gauge, Timer, AlertOctagon
} from 'lucide-react';
import { AgentLog, JobStatus, UserPlan, NormalizedJob, ScoringBreakdown } from '../types';

interface ApplicationsViewProps {
  plan: UserPlan;
}

const SOURCES = [
  { id: 'ats', label: 'Company ATS (Tier 1)', tier: 1, desc: 'Greenhouse, Lever, Ashby - Highest Reliability' },
  { id: 'aggregator', label: 'Structured Aggregators (Tier 2)', tier: 2, desc: 'Google Jobs, Wellfound - Moderate coverage' },
  { id: 'social', label: 'LinkedIn / Social (Tier 4)', tier: 4, desc: 'Session-bound agents - Strict throttling' },
];

export const ApplicationsView: React.FC<ApplicationsViewProps> = ({ plan }) => {
  const [status, setStatus] = useState<JobStatus>('QUEUED');
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [rankedJobs, setRankedJobs] = useState<NormalizedJob[]>([]);
  const [selectedSources, setSelectedSources] = useState<string[]>(['ats']);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  
  const [params, setParams] = useState({
    role: '',
    geography: 'Remote / US',
    mode: 'Manual',
    riskTolerance: 'Low'
  });

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const addLog = (agent: AgentLog['agent'], message: string, level: AgentLog['level'] = 'info') => {
    setLogs(prev => [...prev, {
      id: crypto.randomUUID(),
      agent,
      message,
      timestamp: new Date().toLocaleTimeString(),
      level
    }]);
  };

  const startExecution = () => {
    if (!params.role) return;
    setStatus('RUNNING');
    setLogs([]);
    setRankedJobs([]);
    
    // ORCHESTRATOR STEP 1: Discovery & Normalization
    addLog('Discovery', `Executing discovery run ID: ${crypto.randomUUID().slice(0, 8)}...`);
    
    setTimeout(() => {
      addLog('Parser', 'Normalizing raw job data from 12 discovered endpoints.');
      
      // ORCHESTRATOR STEP 2: Ranking Engine
      addLog('Ranker', 'Executing Ranking Engine v1.2 (Recency + Intent + Fit).');
      
      const simulatedJobs: NormalizedJob[] = [
        {
          id: 'j1',
          title: 'Senior Product Engineer',
          company: 'Linear',
          location: 'Remote',
          requirements: ['React', 'Node', 'Product Sense'],
          applyUrl: 'https://linear.app/careers',
          postedTime: '8h ago',
          source: 'Greenhouse',
          sourceType: 'ATS',
          scoring: { recency: 30, fit: 28, intent: 18, competition: 8, reliability: 10, total: 94 }
        },
        {
          id: 'j2',
          title: 'Staff Frontend Engineer',
          company: 'Vercel',
          location: 'San Francisco, CA',
          requirements: ['Next.js', 'React', 'Infrastructure'],
          applyUrl: 'https://vercel.com/careers',
          postedTime: '2h ago',
          source: 'Ashby',
          sourceType: 'ATS',
          scoring: { recency: 30, fit: 25, intent: 15, competition: 9, reliability: 10, total: 89 }
        }
      ];

      setTimeout(() => {
        setRankedJobs(simulatedJobs);
        addLog('Ranker', 'Ranking complete. 2 jobs passed minimum fit threshold.', 'success');
        
        // ORCHESTRATOR STEP 3: Sequential Processing
        processNextJob(simulatedJobs, 0);
      }, 800);
    }, 1000);
  };

  const processNextJob = (jobs: NormalizedJob[], index: number) => {
    if (index >= jobs.length) {
      setStatus('COMPLETED');
      addLog('Guard', 'Execution loop finalized. All queue targets addressed.', 'success');
      return;
    }

    const job = jobs[index];
    setActiveJobId(job.id);

    // 3A: THROTTLING ENGINE CHECK
    addLog('Guard', `Requesting submission permission for ${job.company}...`);
    
    setTimeout(() => {
      addLog('Guard', 'Throttling Check: PASSED. (Daily: 0/50, Burst: Ready).', 'success');

      // 3B: RESUME MATCHING ENGINE
      addLog('Matcher', `Analyzing 5-profile system for best fit: ${job.title}...`);
      
      setTimeout(() => {
        addLog('Matcher', 'Selected Profile #1 (Fullstack Primary). Fit: 92%.');
        addLog('Matcher', 'Generating customization instructions: Keyword reinforcement for "Infrastructure".');
        
        // 3C: APPLY AGENT
        addLog('Apply', `Synthesizing ${params.mode} application payload for ${job.company}...`);
        
        setTimeout(() => {
          addLog('Apply', `Payload READY. Dispatching via ${job.sourceType} handler...`);
          
          setTimeout(() => {
            addLog('Apply', `Submission confirmed. Tracking outcome ID: ${crypto.randomUUID().slice(0, 6)}`, 'success');
            processNextJob(jobs, index + 1);
          }, 1500);
        }, 1000);
      }, 1000);
    }, 1200);
  };

  const stopExecution = () => {
    setStatus('QUEUED');
    setActiveJobId(null);
    addLog('Guard', 'KILL_SWITCH: System abort requested by user. Terminating process.', 'error');
  };

  return (
    <div className="max-w-[1400px] mx-auto py-12 px-10 space-y-10 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row justify-between items-end gap-8">
        <div className="space-y-4">
           <div className="flex items-center gap-3 text-indigo-500 bg-indigo-500/5 w-fit px-4 py-1.5 rounded-full border border-indigo-500/10">
              <Radio size={16} className={status === 'RUNNING' ? 'animate-pulse' : ''} />
              <span className="text-[10px] font-black uppercase tracking-widest">Autonomous Execution v2.0</span>
           </div>
           <h2 className="text-6xl font-black text-white tracking-tighter uppercase leading-none">Market Execution</h2>
           <p className="text-slate-500 text-lg font-medium max-w-xl">
             Managed deployment loop. Coordinates ranking, profile matching, and safe throttled applying.
           </p>
        </div>

        <div className="flex gap-4">
          {status === 'RUNNING' ? (
            <button onClick={stopExecution} className="bg-red-600/10 border border-red-500/20 text-red-500 px-10 py-5 rounded-2xl flex items-center gap-3 hover:bg-red-500 hover:text-white transition-all font-black text-xs uppercase tracking-widest shadow-2xl">
              <Square size={20} fill="currentColor" /> Abort Execution Run
            </button>
          ) : (
            <button 
              onClick={startExecution} 
              disabled={!params.role}
              className="bg-blue-600 text-white px-16 py-6 rounded-2xl flex items-center gap-4 hover:bg-blue-500 transition-all font-black text-sm uppercase tracking-[0.2em] shadow-2xl shadow-blue-900/40 disabled:opacity-30"
            >
              <Play size={20} fill="currentColor" /> Initialize Deployment
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Left: Engine Config & Orchestrator Logs */}
        <div className="lg:col-span-4 space-y-10">
          <div className="bg-[#16161E] border border-[#1D1D26] p-10 rounded-[3rem] space-y-10 shadow-2xl">
            <div className="flex items-center gap-3 border-b border-white/5 pb-6">
              <Gauge size={20} className="text-blue-500" />
              <h3 className="text-white font-black uppercase text-xs tracking-[0.2em]">Execution Parameters</h3>
            </div>
            
            <div className="space-y-8">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Target Designation</label>
                <input 
                  value={params.role} 
                  onChange={e => setParams({...params, role: e.target.value})}
                  className="w-full bg-[#0D0D12] border border-[#2D313D] rounded-2xl p-5 text-white outline-none focus:border-blue-500 transition-all font-bold" 
                  placeholder="e.g. Senior Backend Engineer"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Apply Mode</label>
                  <select 
                    value={params.mode}
                    onChange={e => setParams({...params, mode: e.target.value})}
                    className="w-full bg-[#0D0D12] border border-[#2D313D] rounded-xl p-4 text-white outline-none focus:border-blue-500 font-bold appearance-none text-xs"
                  >
                    <option>Manual</option>
                    <option>Assisted</option>
                    <option>Auto</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Risk Buffer</label>
                  <select 
                    value={params.riskTolerance}
                    onChange={e => setParams({...params, riskTolerance: e.target.value})}
                    className="w-full bg-[#0D0D12] border border-[#2D313D] rounded-xl p-4 text-white outline-none focus:border-blue-500 font-bold appearance-none text-xs"
                  >
                    <option>Low</option>
                    <option>Medium</option>
                    <option>Aggressive</option>
                  </select>
                </div>
              </div>

              <div className="space-y-4 pt-6 border-t border-white/5">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Active Pipeline Sources</p>
                <div className="space-y-3">
                  {SOURCES.map(s => (
                    <button 
                      key={s.id}
                      onClick={() => setSelectedSources(prev => prev.includes(s.id) ? prev.filter(x => x !== s.id) : [...prev, s.id])}
                      className={`w-full p-4 rounded-2xl border text-left transition-all ${selectedSources.includes(s.id) ? 'bg-blue-600/5 border-blue-500' : 'bg-[#0D0D12] border-[#2D313D] opacity-40'}`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-white font-bold text-xs">{s.label}</span>
                        {s.tier === 1 && <ShieldCheck size={14} className="text-blue-500" />}
                      </div>
                      <p className="text-[10px] text-slate-500 font-medium leading-relaxed">{s.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* REAL-TIME ORCHESTRATOR LOGS */}
          <div className="bg-[#0D0D12] border border-[#2D313D] rounded-[3rem] overflow-hidden flex flex-col h-[520px] shadow-2xl">
            <div className="bg-[#16161E] px-10 py-5 border-b border-[#2D313D] flex items-center justify-between">
              <div className="flex items-center gap-3">
                 <Terminal size={14} className="text-blue-500" />
                 <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Engine Loop Control</span>
              </div>
              {status === 'RUNNING' && <Loader2 size={12} className="animate-spin text-blue-500" />}
            </div>
            <div ref={scrollRef} className="flex-1 p-10 font-mono text-[10px] space-y-4 overflow-y-auto custom-scrollbar">
              {logs.length === 0 && <p className="text-slate-800">SYSTEM_IDLE: Select parameters and activate engine...</p>}
              {logs.map(log => (
                <div key={log.id} className="flex gap-4 group animate-in slide-in-from-left-2 duration-300">
                  <span className="text-slate-800 shrink-0">[{log.timestamp}]</span>
                  <span className={`font-bold uppercase shrink-0 ${
                    log.level === 'error' ? 'text-red-500' : 
                    log.level === 'warn' ? 'text-amber-500' : 
                    log.level === 'success' ? 'text-green-500' : 'text-blue-500/80'
                  }`}>{log.agent}</span>
                  <span className="text-slate-500 leading-relaxed">{log.message}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Ranked Job Feed + Match Detail */}
        <div className="lg:col-span-8 space-y-10">
          
          {/* TIER 1: RANKING ENGINE HUD */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              { l: 'Identified', v: rankedJobs.length, i: Search, c: 'text-blue-500' },
              { l: 'Passed Ranking', v: rankedJobs.filter(j => (j.scoring?.total || 0) > 85).length, i: ListOrdered, c: 'text-indigo-500' },
              { l: 'Throttled', v: status === 'RUNNING' ? 'Safe' : '---', i: Timer, c: 'text-amber-500' },
              { l: 'Applied (v2)', v: 0, i: CheckCircle2, c: 'text-green-500' }
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
                <h3 className="text-white font-black text-2xl uppercase tracking-tight">Deployment Queue</h3>
                <div className="flex items-center gap-3">
                   <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Heuristic Model:</span>
                      <span className="text-[10px] font-black text-blue-500 uppercase">SIGNAL_FIT_v5</span>
                   </div>
                </div>
             </div>
             
             {rankedJobs.length === 0 ? (
               <div className="py-48 bg-[#111118] border border-white/5 border-dashed rounded-[4rem] text-center space-y-6">
                  <div className="w-20 h-20 rounded-[2.5rem] bg-white/5 flex items-center justify-center mx-auto text-slate-700">
                    <Briefcase size={40} />
                  </div>
                  <div className="space-y-2">
                    <p className="text-slate-500 font-black uppercase tracking-[0.2em] text-sm">Awaiting Queue Initialization</p>
                    <p className="text-slate-700 text-xs font-medium">RANKING ENGINE IDLE</p>
                  </div>
               </div>
             ) : (
               <div className="space-y-6">
                 {rankedJobs.map(job => (
                   <div key={job.id} className={`bg-[#16161E] border p-10 rounded-[3rem] transition-all shadow-2xl relative overflow-hidden group ${
                     activeJobId === job.id ? 'border-blue-500 ring-4 ring-blue-500/10' : 'border-white/5 hover:border-white/10'
                   }`}>
                      {activeJobId === job.id && (
                        <div className="absolute top-0 left-0 w-full h-1 bg-blue-500 animate-pulse" />
                      )}
                      
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-10">
                         <div className="flex items-center gap-8">
                            <div className="w-16 h-16 rounded-3xl bg-[#0D0D12] border border-white/10 flex items-center justify-center text-slate-400 group-hover:text-blue-500 transition-colors">
                               <Building2 size={32} />
                            </div>
                            <div className="space-y-2">
                               <div className="flex items-center gap-3">
                                  <p className="text-white font-black text-2xl uppercase tracking-tight">{job.role}</p>
                                  <span className="bg-[#1A1D26] px-3 py-1 rounded-lg text-[9px] font-black uppercase text-slate-500 tracking-widest">{job.source}</span>
                               </div>
                               <div className="flex items-center gap-3 text-sm">
                                  <span className="text-blue-500 font-bold">{job.company}</span>
                                  <div className="w-1 h-1 rounded-full bg-slate-800" />
                                  <span className="text-slate-500 font-medium">{job.location}</span>
                                  <div className="w-1 h-1 rounded-full bg-slate-800" />
                                  <span className="text-slate-500 font-medium italic">{job.postedTime}</span>
                               </div>
                            </div>
                         </div>

                         {/* RANKING BREAKDOWN */}
                         <div className="bg-[#0D0D12] p-6 rounded-3xl border border-white/5 flex items-center gap-8 shadow-inner">
                            <div className="text-center space-y-1">
                               <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Recency</p>
                               <p className="text-white font-bold">{job.scoring?.recency}/30</p>
                            </div>
                            <div className="w-[1px] h-8 bg-white/5" />
                            <div className="text-center space-y-1">
                               <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Fit Score</p>
                               <p className="text-white font-bold">{job.scoring?.fit}/30</p>
                            </div>
                            <div className="w-[1px] h-8 bg-white/5" />
                            <div className="text-right">
                               <div className="text-3xl font-black text-blue-500 leading-none">{job.scoring?.total}%</div>
                               <p className="text-[8px] font-black text-slate-700 uppercase tracking-[0.2em] mt-1">RANK PRIORITY</p>
                            </div>
                         </div>
                      </div>

                      {activeJobId === job.id && (
                        <div className="mt-10 pt-10 border-t border-white/5 animate-in fade-in slide-in-from-top-4 duration-700">
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                              <div className="space-y-4">
                                 <div className="flex items-center gap-2 text-indigo-400">
                                    <UserCircle size={16} />
                                    <h4 className="text-[10px] font-black uppercase tracking-widest">Resume Engine Output</h4>
                                 </div>
                                 <div className="bg-[#111118] p-6 rounded-2xl border border-indigo-500/10 space-y-3">
                                    <p className="text-slate-400 text-xs leading-relaxed italic">
                                       "Selected Profile #1 (Primary). Identified 3 skill gaps: K8s, Terraform, Scale. Injecting compensating signal from Project: Infrastructure Migration."
                                    </p>
                                    <div className="flex flex-wrap gap-2 pt-2">
                                       <span className="text-[8px] font-black uppercase tracking-widest bg-indigo-500/10 text-indigo-400 px-2 py-1 rounded">Signal Boost: Scale</span>
                                       <span className="text-[8px] font-black uppercase tracking-widest bg-indigo-500/10 text-indigo-400 px-2 py-1 rounded">Customized Bullets</span>
                                    </div>
                                 </div>
                              </div>
                              <div className="space-y-4">
                                 <div className="flex items-center gap-2 text-amber-500">
                                    <ShieldAlert size={16} />
                                    <h4 className="text-[10px] font-black uppercase tracking-widest">Safety Engine Status</h4>
                                 </div>
                                 <div className="bg-[#111118] p-6 rounded-2xl border border-amber-500/10 flex items-center justify-between">
                                    <div>
                                       <p className="text-white font-bold text-xs uppercase">Bypass Protocol Active</p>
                                       <p className="text-slate-500 text-[10px] mt-1 font-medium leading-relaxed">Simulated scan passed: 0% Red Flags detected.</p>
                                    </div>
                                    <div className="text-right">
                                       <span className="text-green-500 font-black text-xs uppercase tracking-widest">Safe to Dispatch</span>
                                    </div>
                                 </div>
                              </div>
                           </div>
                        </div>
                      )}
                   </div>
                 ))}
               </div>
             )}
          </div>

          {/* SYSTEM COMPLIANCE WIDGET */}
          <div className="p-12 border border-blue-500/20 bg-blue-500/5 rounded-[4rem] flex flex-col md:flex-row items-center justify-between gap-12 group">
             <div className="flex items-center gap-10">
                <ShieldCheck size={56} className="text-blue-500 shrink-0 group-hover:scale-110 transition-transform duration-700" />
                <div className="space-y-2">
                   <h4 className="text-white font-black text-2xl uppercase tracking-tight leading-none">Guard Architecture</h4>
                   <p className="text-slate-400 text-sm leading-relaxed font-medium max-w-xl">
                      Every application request is intercepted by the Throttling Engine. We enforce randomized human-like delays and source-specific limits to guarantee identity security and maintain 100% platform compliance.
                   </p>
                </div>
             </div>
             <div className="grid grid-cols-2 gap-x-12 gap-y-6 shrink-0">
                <div className="space-y-1">
                   <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Global Cap</p>
                   <p className="text-white font-black">50 / DAY</p>
                </div>
                <div className="space-y-1 text-right">
                   <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Burst Logic</p>
                   <p className="text-white font-black">DISABLED</p>
                </div>
                <div className="space-y-1">
                   <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Cooldown</p>
                   <p className="text-white font-black">420s (AVG)</p>
                </div>
                <div className="space-y-1 text-right">
                   <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Audit State</p>
                   <p className="text-green-500 font-black">OPTIMAL</p>
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};
