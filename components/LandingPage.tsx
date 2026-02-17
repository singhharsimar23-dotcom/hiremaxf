import React, { useState, useEffect } from 'react';
import {
   Shield,
   ArrowRight,
   Zap,
   Sparkles,
   ShieldCheck,
   Activity,
   Cpu,
   Layers,
   Target,
   Radio,
   Workflow,
   ArrowUpRight,
   Terminal,
   MonitorPlay,
   Fingerprint,
   Box,
   FastForward
} from 'lucide-react';

interface LandingPageProps {
   onGetStarted: () => void;
   onViewPlans?: () => void;
}

// Visual Component: The live system flow animation for Hero
const SystemFlowAnimation = () => {
   return (
      <div className="relative w-full aspect-square md:aspect-video bg-[#0D0D14] rounded-[3.5rem] border border-white/5 overflow-hidden shadow-2xl group">
         <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.05),transparent_70%)]" />

         {/* Node Network */}
         <div className="absolute inset-10 flex items-center justify-between z-10">
            {/* Source Node */}
            <div className="flex flex-col items-center gap-4 animate-in fade-in slide-in-from-left-8 duration-1000">
               <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 group-hover:border-blue-500/50 transition-colors">
                  <Fingerprint size={28} />
               </div>
               <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Candidate Data</span>
            </div>

            {/* Engine Central Node */}
            <div className="relative">
               <div className="absolute inset-0 bg-blue-500/20 blur-3xl animate-pulse" />
               <div className="w-24 h-24 rounded-3xl bg-blue-600 border border-blue-400 flex items-center justify-center text-white shadow-[0_0_50px_rgba(59,130,246,0.3)] z-20 relative animate-spin-slow">
                  <Cpu size={40} />
               </div>
               <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 whitespace-nowrap">
                  <span className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-500">HireMax Engine</span>
               </div>
               {/* Flow Particles */}
               {[...Array(6)].map((_, i) => (
                  <div
                     key={i}
                     className="absolute w-1 h-1 bg-blue-400 rounded-full animate-flow-particle"
                     style={{
                        '--angle': `${i * 60}deg`,
                        animationDelay: `${i * 0.2}s`
                     } as React.CSSProperties}
                  />
               ))}
            </div>

            {/* Target Variations */}
            <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-right-8 duration-1000">
               {[
                  { label: "Variant A (Startup)", icon: Zap, color: "text-amber-500" },
                  { label: "Variant B (Big Tech)", icon: ShieldCheck, color: "text-green-500" },
                  { label: "Variant C (Infra)", icon: Layers, color: "text-blue-500" }
               ].map((v, i) => (
                  <div key={i} className="flex items-center gap-4 bg-white/5 border border-white/10 px-4 py-3 rounded-2xl group/variant hover:border-white/20 transition-all">
                     <v.icon size={14} className={v.color} />
                     <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{v.label}</span>
                  </div>
               ))}
            </div>
         </div>

         {/* Background Status Log */}
         <div className="absolute bottom-8 left-8 font-mono text-[9px] text-slate-600 space-y-1 opacity-50 group-hover:opacity-100 transition-opacity">
            <div className="flex items-center gap-2"><div className="w-1 h-1 rounded-full bg-green-500" /> ATS Compatibility Verified</div>
            <div className="flex items-center gap-2"><div className="w-1 h-1 rounded-full bg-blue-500" /> Auto-Deployment Active</div>
            <div className="flex items-center gap-2"><div className="w-1 h-1 rounded-full bg-slate-500" /> Responses Monitored...</div>
         </div>

         <style>{`
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow { animation: spin-slow 20s linear infinite; }
        
        @keyframes flow-particle {
          0% { transform: rotate(var(--angle)) translateX(0) scale(1); opacity: 0; }
          20% { opacity: 1; }
          100% { transform: rotate(var(--angle)) translateX(150px) scale(0); opacity: 0; }
        }
        .animate-flow-particle { animation: flow-particle 2s linear infinite; }
      `}</style>
      </div>
   );
};

// Visual Component: Rejection vs HireMax comparison
const RejectionFilterVisual = () => {
   return (
      <div className="grid md:grid-cols-2 gap-8 w-full max-w-5xl mx-auto py-20">
         {/* Generic Path */}
         <div className="bg-[#16161E] rounded-[2.5rem] border border-red-500/10 p-10 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-[0.03] text-red-500">
               <Target size={120} />
            </div>
            <p className="text-[10px] font-black text-red-500 uppercase tracking-[0.3em] mb-8">The Generic Loop</p>
            <div className="space-y-4 mb-12">
               <div className="h-4 w-3/4 bg-white/5 rounded-full" />
               <div className="h-4 w-1/2 bg-white/5 rounded-full" />
               <div className="h-20 w-full bg-white/5 rounded-3xl" />
            </div>
            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 flex items-center justify-between">
               <div className="flex items-center gap-3">
                  <Activity size={18} className="text-red-500" />
                  <span className="text-[10px] font-black text-red-500 uppercase">Filtered: No Signal Found</span>
               </div>
               <span className="text-[10px] font-bold text-red-900 uppercase">Automatic</span>
            </div>
         </div>

         {/* HireMax Path */}
         <div className="bg-[#16161E] rounded-[2.5rem] border border-blue-500/20 p-10 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-[0.03] text-blue-500">
               <Zap size={120} />
            </div>
            <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em] mb-8">The HireMax Loop</p>
            <div className="space-y-4 mb-12">
               <div className="h-4 w-3/4 bg-blue-500/20 rounded-full animate-pulse" />
               <div className="h-4 w-1/2 bg-blue-500/20 rounded-full animate-pulse delay-75" />
               <div className="h-20 w-full bg-blue-500/10 rounded-3xl border border-blue-500/20" />
            </div>
            <div className="bg-blue-600 border border-blue-400 rounded-2xl p-6 flex items-center justify-between shadow-[0_0_30px_rgba(59,130,246,0.2)]">
               <div className="flex items-center gap-3">
                  <ShieldCheck size={18} className="text-white" />
                  <span className="text-[10px] font-black text-white uppercase">System Gate: Bypass Ready</span>
               </div>
               <span className="text-[10px] font-bold text-blue-100 uppercase">Automated</span>
            </div>
         </div>
      </div>
   );
};

const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted, onViewPlans }) => {
   return (
      <div className="min-h-screen bg-[#0B0F1A] text-slate-300 selection:bg-blue-500/30 font-sans overflow-x-hidden">

         {/* SECTION 1: HERO - AUTOMATION FIRST */}
         <section className="relative pt-32 pb-40 px-10">
            <div className="max-w-[1400px] mx-auto">
               <div className="grid lg:grid-cols-12 gap-20 items-center">
                  <div className="lg:col-span-6 space-y-12">
                     <div className="inline-flex items-center gap-3 bg-white/5 border border-white/10 px-4 py-2 rounded-full">
                        <span className="relative flex h-2 w-2">
                           <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                           <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                        </span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Autonomous Deployment Loop v5.4</span>
                     </div>

                     <h1 className="text-7xl md:text-[6.5rem] font-black text-white tracking-tighter leading-[0.85] uppercase">
                        Rejection is <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 via-indigo-400 to-indigo-600">Deterministic.</span>
                     </h1>

                     <p className="text-2xl text-slate-400 font-medium leading-relaxed max-w-xl">
                        HireMax synthesizes your background, simulates hiring decisions, and automates applications — before rejection happens.
                     </p>

                     <div className="flex flex-col sm:flex-row items-center gap-6 pt-6">
                        <button
                           onClick={onGetStarted}
                           className="w-full sm:w-auto bg-blue-600 text-white font-black px-12 py-6 rounded-2xl text-xl uppercase tracking-widest hover:bg-blue-500 hover:shadow-[0_0_60px_rgba(59,130,246,0.4)] transition-all flex items-center justify-center gap-4 group"
                        >
                           Activate Automation <ArrowRight className="group-hover:translate-x-2 transition-transform" />
                        </button>
                        <button
                           onClick={() => document.getElementById('engine-logic')?.scrollIntoView({ behavior: 'smooth' })}
                           className="w-full sm:w-auto border border-white/10 text-white font-bold px-10 py-6 rounded-2xl text-lg hover:bg-white/5 transition-all"
                        >
                           See How it Works
                        </button>
                     </div>
                  </div>

                  <div className="lg:col-span-6">
                     <SystemFlowAnimation />
                  </div>
               </div>
            </div>
         </section>

         {/* SECTION 2: THE PROBLEM (REJECTION FILTER) */}
         <section className="py-32 bg-[#0D0D12] border-y border-white/5 px-10">
            <div className="max-w-4xl mx-auto text-center space-y-6 mb-20">
               <h2 className="text-[10px] font-black uppercase tracking-[0.5em] text-blue-500">The Mechanical Barrier</h2>
               <h3 className="text-5xl font-black text-white tracking-tighter uppercase">98% of Rejections are Predictable</h3>
               <p className="text-slate-500 text-xl font-medium leading-relaxed">
                  Hiring committees use deterministic heuristics. If your profile doesn't satisfy the system's "Signal Map," you are filtered automatically.
               </p>
            </div>
            <RejectionFilterVisual />
         </section>

         {/* SECTION 3: SYSTEM OVERVIEW (DIAGRAM) */}
         <section id="engine-logic" className="py-40 px-10">
            <div className="max-w-7xl mx-auto">
               <div className="grid lg:grid-cols-2 gap-32 items-center">
                  <div className="space-y-16">
                     <div className="space-y-4">
                        <h3 className="text-4xl font-black text-white tracking-tighter uppercase">Hiring Execution System</h3>
                        <p className="text-slate-500 text-lg leading-relaxed">
                           HireMax isn't a resume editor. It is an end-to-end execution system that manages the entire application lifecycle.
                        </p>
                     </div>

                     <div className="space-y-12">
                        {[
                           { t: "Deterministic Synthesis", d: "Resumes are generated from scratch for every specific role, not edited from a master copy.", icon: Workflow },
                           { t: "Predictive Simulation", d: "The engine simulates ATS and recruiter scans to verify success before a single application is sent.", icon: MonitorPlay },
                           { t: "Autonomous Deployment", d: "Once verified, applications are deployed automatically across target perimeters.", icon: Radio }
                        ].map((item, i) => (
                           <div key={i} className="flex gap-8 group">
                              <div className="w-16 h-16 rounded-[1.5rem] bg-[#16161E] border border-white/10 flex items-center justify-center text-blue-500 shrink-0 group-hover:scale-110 transition-transform">
                                 <item.icon size={28} />
                              </div>
                              <div className="space-y-2">
                                 <h4 className="text-white font-black text-xl uppercase tracking-tight">{item.t}</h4>
                                 <p className="text-slate-500 leading-relaxed font-medium">{item.d}</p>
                              </div>
                           </div>
                        ))}
                     </div>
                  </div>

                  <div className="relative">
                     <div className="absolute inset-0 bg-blue-600/5 blur-[100px] rounded-full" />
                     <div className="bg-[#111118] border border-white/5 p-12 rounded-[4rem] shadow-2xl relative">
                        <div className="space-y-8">
                           <div className="flex items-center justify-between border-b border-white/5 pb-8">
                              <div className="flex items-center gap-4">
                                 <Box className="text-blue-500" />
                                 <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Continuous Processing</span>
                              </div>
                              <div className="flex items-center gap-2 px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full">
                                 <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                 <span className="text-[8px] font-black text-green-500 uppercase tracking-widest">Active</span>
                              </div>
                           </div>

                           <div className="grid grid-cols-2 gap-6">
                              {[
                                 { l: "Matches Found", v: "142" },
                                 { l: "Signals Synthesized", v: "842k" },
                                 { l: "Variants Generated", v: "12" },
                                 { l: "Deployments Ready", v: "4" }
                              ].map((stat, i) => (
                                 <div key={i} className="p-6 bg-white/5 border border-white/5 rounded-3xl">
                                    <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1">{stat.l}</p>
                                    <p className="text-2xl font-black text-white">{stat.v}</p>
                                 </div>
                              ))}
                           </div>

                           <div className="pt-8 border-t border-white/5 flex justify-center">
                              <button onClick={onGetStarted} className="text-blue-500 font-black text-[10px] uppercase tracking-[0.4em] hover:text-white transition-colors">Open System Dashboard →</button>
                           </div>
                        </div>
                     </div>
                  </div>
               </div>
            </div>
         </section>

         {/* SECTION 4: AUTOMATION AS DEFAULT */}
         <section className="py-32 bg-[#0D0D12] relative overflow-hidden px-10">
            <div className="max-w-[1400px] mx-auto text-center space-y-12">
               <h2 className="text-6xl md:text-[8rem] font-black text-white/5 tracking-tighter uppercase leading-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 select-none pointer-events-none whitespace-nowrap">
                  Continuous • Execution • Autonomous
               </h2>
               <div className="relative z-10 space-y-12">
                  <div className="space-y-4">
                     <h3 className="text-5xl font-black text-white tracking-tighter uppercase">The Set-and-Forget Career Loop</h3>
                     <p className="text-slate-400 text-xl font-medium max-w-2xl mx-auto">
                        Upload your raw experience once. HireMax monitors the market, adapts your variants, and applies 24/7.
                     </p>
                  </div>
                  <div className="flex justify-center">
                     <div className="w-1 h-20 bg-gradient-to-b from-blue-600 to-transparent" />
                  </div>
                  <button
                     onClick={onGetStarted}
                     className="bg-white text-black font-black px-16 py-8 rounded-3xl text-2xl uppercase tracking-[0.2em] hover:scale-105 transition-all shadow-2xl"
                  >
                     Launch Autonomous Mode
                  </button>
               </div>
            </div>
         </section>

         {/* SECTION 5: MODES OF CONTROL */}
         <section className="py-40 px-10">
            <div className="max-w-7xl mx-auto">
               <div className="grid md:grid-cols-3 gap-8">
                  {[
                     {
                        mode: "Manual Pulse",
                        label: "One-Time Rebuild",
                        desc: "Surgical re-architecture of a single document for a high-priority role.",
                        action: "Start Rebuild",
                        accent: "border-slate-800"
                     },
                     {
                        mode: "Strategic Flow",
                        label: "Career Pro",
                        desc: "Continuous match monitoring and unlimited variants for multiple career paths.",
                        action: "Join Pro",
                        accent: "border-blue-500/30 bg-blue-500/5 shadow-2xl shadow-blue-500/5"
                     },
                     {
                        mode: "Autonomous Loop",
                        label: "Automation Factory",
                        desc: "Full execution. From artifact ingestion (GitHub/LinkedIn) to assisted application dispatch.",
                        action: "Activate Factory",
                        accent: "border-indigo-500/50 bg-[#111118]"
                     }
                  ].map((item, i) => (
                     <div key={i} className={`p-12 rounded-[3.5rem] border flex flex-col h-full group ${item.accent}`}>
                        <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] mb-4">{item.mode}</p>
                        <h4 className="text-3xl font-black text-white tracking-tight uppercase mb-6">{item.label}</h4>
                        <p className="text-slate-500 text-base font-medium leading-relaxed mb-12 flex-1">{item.desc}</p>
                        <button onClick={onGetStarted} className="w-full py-5 rounded-2xl border border-white/10 text-white font-black uppercase text-xs tracking-widest group-hover:bg-white group-hover:text-black transition-all">
                           {item.action}
                        </button>
                     </div>
                  ))}
               </div>
            </div>
         </section>

         {/* SECTION 6: SOCIAL PROOF (DIAGNOSTIC STYLE) */}
         <section className="py-32 bg-[#0D0D12] border-y border-white/5">
            <div className="max-w-[1400px] mx-auto px-10">
               <div className="grid md:grid-cols-3 gap-12">
                  {[
                     "Identified structural signal misalignment in Staff Engineering track before rejection.",
                     "Surfaced 42% more deterministic metrics from raw project READMEs.",
                     "Automated bypass of ATS keyword filters for 3 Tier-1 tech placements."
                  ].map((text, i) => (
                     <div key={i} className="space-y-4">
                        <Terminal size={14} className="text-blue-500" />
                        <p className="text-slate-400 font-mono text-sm leading-relaxed border-l border-white/10 pl-6 italic">
                           "{text}"
                        </p>
                        <p className="text-[9px] font-black text-slate-700 uppercase tracking-widest pl-6">— Observation Log {i + 1}</p>
                     </div>
                  ))}
               </div>
            </div>
         </section>

         {/* SECTION 7: FINAL CTA */}
         <section className="py-60 relative overflow-hidden px-10">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.1),transparent_70%)]" />
            <div className="max-w-4xl mx-auto text-center relative z-10 space-y-16">
               <div className="space-y-6">
                  <h2 className="text-7xl md:text-[8rem] font-black text-white tracking-tighter uppercase leading-[0.85]">
                     Stop Guessing. <br />
                     <span className="text-blue-500">Execute.</span>
                  </h2>
                  <p className="text-2xl text-slate-500 font-medium max-w-2xl mx-auto">
                     The hiring market is automated. Your career execution should be too.
                  </p>
               </div>

               <div className="flex flex-col md:flex-row items-center justify-center gap-8">
                  <button
                     onClick={onGetStarted}
                     className="w-full md:w-auto bg-blue-600 text-white font-black px-20 py-8 rounded-[2.5rem] text-2xl uppercase tracking-[0.2em] hover:bg-blue-500 hover:shadow-[0_0_80px_rgba(59,130,246,0.5)] transition-all"
                  >
                     Activate HireMax
                  </button>
                  <button
                     onClick={onViewPlans}
                     className="w-full md:w-auto text-white font-black px-12 py-8 rounded-[2.5rem] border border-white/10 text-xl uppercase tracking-widest hover:bg-white/5 transition-all"
                  >
                     Review Tiers
                  </button>
               </div>
            </div>
         </section>

         {/* Footer */}
         <footer className="py-24 px-10 border-t border-white/5 bg-[#0B0F1A]">
            <div className="max-w-[1400px] mx-auto flex flex-col md:flex-row justify-between items-center gap-12">
               <div className="flex items-center gap-3">
                  <Shield className="text-white" size={24} />
                  <span className="text-white font-black text-xl tracking-tight">HireMax</span>
               </div>
               <div className="flex gap-12">
                  {['Security', 'Status', 'API', 'Docs'].map(item => (
                     <button key={item} className="text-[10px] font-black text-slate-700 uppercase tracking-widest hover:text-white transition-all">{item}</button>
                  ))}
               </div>
               <p className="text-[10px] font-black text-slate-800 uppercase tracking-[0.5em]">© 2025 Autonomous Career Intelligence</p>
            </div>
         </footer>
      </div>
   );
};

export default LandingPage;