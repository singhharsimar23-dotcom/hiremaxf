"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
   ShieldCheck,
   ArrowRight,
   Loader2,
   TrendingUp,
   Zap,
   AlertCircle,
   Cpu,
   Stamp,
   Shield,
   Lock,
   AlertTriangle,
   RefreshCw,
   Radar,
   AlertOctagon,
   Clock,
   Radio,
   Send,
   Target,
   ShieldAlert,
   Fingerprint,
   History,
   Activity,
   XCircle,
   CheckCircle2
} from 'lucide-react';
import { DiagnosticResult, UserPlan, MarketCommandSnapshot, AppView, BackgroundJob, JobType } from '../types';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================
interface CareerIntelligenceViewProps {
   analysisResult: DiagnosticResult | null;
   resumeText: string;
   plan: UserPlan;
   setView: (v: AppView) => void;
   activeJobs: Record<string, BackgroundJob>;
   dispatchJob: (type: JobType, payload: Record<string, unknown>) => Promise<string>;
}

interface CachedSnapshot {
   snapshot: MarketCommandSnapshot;
   cachedAt: number;
   expiresAt: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================
const CACHE_KEY = 'hiremax_market_snapshot';
const CACHE_DURATION_MS = 4 * 60 * 60 * 1000; // 4 hours
const PROCESSING_TIMEOUT_MS = 120000; // 2 minutes

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================
const safeLocalStorageGet = <T,>(key: string, fallback: T): T => {
   try {
      const item = localStorage.getItem(key);
      if (!item) return fallback;
      return JSON.parse(item) as T;
   } catch {
      return fallback;
   }
};

const safeLocalStorageSet = (key: string, value: unknown): boolean => {
   try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
   } catch {
      console.warn(`Failed to save to localStorage: ${key}`);
      return false;
   }
};

const safeLocalStorageRemove = (key: string): void => {
   try {
      localStorage.removeItem(key);
   } catch {
      // Silently fail
   }
};

const formatExpiry = (expiresAt: number): string => {
   const now = Date.now();
   if (expiresAt <= now) return 'Expired';

   const diff = expiresAt - now;
   const hours = Math.floor(diff / (60 * 60 * 1000));
   const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));

   if (hours > 0) return `${hours}h ${minutes}m`;
   return `${minutes}m`;
};

// ============================================================================
// COMPONENT
// ============================================================================
export const CareerIntelligenceView: React.FC<CareerIntelligenceViewProps> = ({
   analysisResult,
   plan,
   setView,
   activeJobs,
   dispatchJob
}) => {
   const [viewState, setViewState] = useState<'input' | 'processing' | 'snapshot'>('input');
   const [errorFeedback, setErrorFeedback] = useState<string | null>(null);
   const [successMessage, setSuccessMessage] = useState<string | null>(null);
   const [snapshot, setSnapshot] = useState<MarketCommandSnapshot | null>(null);
   const [snapshotExpiry, setSnapshotExpiry] = useState<number | null>(null);
   const [trackingJobId, setTrackingJobId] = useState<string | null>(null);
   const [processingStartTime, setProcessingStartTime] = useState<number | null>(null);

   const [targetRole, setTargetRole] = useState(analysisResult?.role || '');
   const [geography, setGeography] = useState('Remote / North America');
   const [expBand, setExpBand] = useState('Senior (5-8 years)');

   // Refs for cleanup
   const processingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

   // Clear toast messages after 5 seconds
   useEffect(() => {
      if (errorFeedback) {
         const timer = setTimeout(() => setErrorFeedback(null), 5000);
         return () => clearTimeout(timer);
      }
   }, [errorFeedback]);

   useEffect(() => {
      if (successMessage) {
         const timer = setTimeout(() => setSuccessMessage(null), 5000);
         return () => clearTimeout(timer);
      }
   }, [successMessage]);

   // Initialize from cache or running jobs (SEC-004 / REL-005)
   useEffect(() => {
      const initView = async () => {
         const { data: { session } } = await supabase.auth.getSession();
         const userId = session?.user?.id || 'anonymous';
         const userSpecificKey = `${CACHE_KEY}_${userId}`;


         // SECURE: Verify that current cache belongs to this user
         const allKeys = Object.keys(localStorage);
         allKeys.forEach(key => {
            if (key.startsWith(CACHE_KEY) && key !== userSpecificKey) {
               localStorage.removeItem(key);
            }
         });

         const cached = safeLocalStorageGet<CachedSnapshot | null>(userSpecificKey, null);
         const runningJob = Object.values(activeJobs).find(j => j.type === 'OUTLOOK' && j.status === 'RUNNING');

         if (runningJob) {
            setViewState('processing');
            setProcessingStartTime(new Date(runningJob.createdAt).getTime());
            setTrackingJobId(runningJob.id);
            if (runningJob.payload?.role) {
               setTargetRole(runningJob.payload.role as string);
               setGeography((runningJob.payload.geography as string) || geography);
            }
         } else if (cached && cached.expiresAt > Date.now()) {
            setSnapshot(cached.snapshot);
            setSnapshotExpiry(cached.expiresAt);
            setViewState('snapshot');
         }
      };

      initView();
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, []);

   // Track job status changes
   useEffect(() => {
      if (!trackingJobId) return;
      const activeJob = activeJobs[trackingJobId];

      if (!activeJob) return;

      if (activeJob.status === 'RUNNING') {
         setViewState('processing');
      } else if (activeJob.status === 'COMPLETED' && activeJob.result) {
         const result = activeJob.result;

         // Robustly map results with fallbacks to prevent crashes
         const newSnapshot: MarketCommandSnapshot = {
            id: result.id || `CMD-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
            timestamp: result.timestamp || new Date().toISOString(),
            expiry: formatExpiry(Date.now() + CACHE_DURATION_MS),
            context: {
               role: (activeJob.payload?.role as string) || targetRole,
               geography: (activeJob.payload?.geography as string) || geography,
               expBand: (activeJob.payload?.expBand as string) || expBand
            },
            marketStatus: result.marketStatus || { label: 'Inconclusive', implication: 'Data stream fragmented.' },
            executionTargets: Array.isArray(result.executionTargets) ? result.executionTargets : [],
            doNotApplyZone: Array.isArray(result.doNotApplyZone) ? result.doNotApplyZone : [],
            actionOrders: {
               next7Days: Array.isArray(result.actionOrders?.next7Days) ? result.actionOrders.next7Days : [],
               next30Days: Array.isArray(result.actionOrders?.next30Days) ? result.actionOrders.next30Days : [],
               positioningDirectives: Array.isArray(result.actionOrders?.positioningDirectives) ? result.actionOrders.positioningDirectives : [],
               interviewDirectives: Array.isArray(result.actionOrders?.interviewDirectives) ? result.actionOrders.interviewDirectives : []
            },
            risks: result.risks || { uncertainty: 'Limited data', refreshCondition: 'Wait for signal' }
         };

         const expiresAt = Date.now() + CACHE_DURATION_MS;
         const cacheEntry: CachedSnapshot = {
            snapshot: newSnapshot,
            cachedAt: Date.now(),
            expiresAt
         };

         const userKey = (window as any).__current_intel_key || `${CACHE_KEY}_anonymous`;

         setSnapshot(newSnapshot);
         setSnapshotExpiry(expiresAt);
         safeLocalStorageSet(userKey, cacheEntry);
         setViewState('snapshot');
         setTrackingJobId(null);
         setProcessingStartTime(null);
         setSuccessMessage('Market Command generated successfully!');

         // Clear processing timeout
         if (processingTimeoutRef.current) {
            clearTimeout(processingTimeoutRef.current);
            processingTimeoutRef.current = null;
         }
      } else if (activeJob.status === 'FAILED') {
         setErrorFeedback(activeJob.error || "Market projection failed. Please try again.");
         if (viewState === 'processing') setViewState('input');
         setTrackingJobId(null);
         setProcessingStartTime(null);

         // Clear processing timeout
         if (processingTimeoutRef.current) {
            clearTimeout(processingTimeoutRef.current);
            processingTimeoutRef.current = null;
         }
      }
   }, [activeJobs, trackingJobId, targetRole, geography, expBand, viewState]);

   // Processing timeout
   useEffect(() => {
      if (viewState === 'processing' && processingStartTime) {
         const elapsed = Date.now() - processingStartTime;
         const remaining = PROCESSING_TIMEOUT_MS - elapsed;

         if (remaining <= 0) {
            setErrorFeedback('Processing timed out. The server may be overloaded. Please try again.');
            setViewState('input');
            setTrackingJobId(null);
            setProcessingStartTime(null);
         } else {
            processingTimeoutRef.current = setTimeout(() => {
               setErrorFeedback('Processing timed out. The server may be overloaded. Please try again.');
               setViewState('input');
               setTrackingJobId(null);
               setProcessingStartTime(null);
            }, remaining);
         }
      }

      return () => {
         if (processingTimeoutRef.current) {
            clearTimeout(processingTimeoutRef.current);
         }
      };
   }, [viewState, processingStartTime]);

   const handleGenerate = useCallback(async () => {
      if (!targetRole.trim()) {
         setErrorFeedback('Please enter a target role designation.');
         return;
      }
      if (!geography.trim()) {
         setErrorFeedback('Please enter a geography perimeter.');
         return;
      }

      setErrorFeedback(null);
      setViewState('processing');
      setProcessingStartTime(Date.now());

      try {
         const jobId = await dispatchJob('OUTLOOK', { role: targetRole, geography, expBand });
         setTrackingJobId(jobId);
      } catch (e: unknown) {
         const message = e instanceof Error ? e.message : 'Unknown error';
         setErrorFeedback(`Failed to dispatch job: ${message}`);
         setViewState('input');
         setProcessingStartTime(null);
      }
   }, [targetRole, geography, expBand, dispatchJob]);

   const handleReset = useCallback(() => {
      const userKey = (window as any).__current_intel_key || `${CACHE_KEY}_anonymous`;
      safeLocalStorageRemove(userKey);
      setSnapshot(null);
      setSnapshotExpiry(null);
      setViewState('input');
      setSuccessMessage(null);
   }, []);

   // ========================================================================
   // RENDER: PAYWALL
   // ========================================================================
   if (plan !== 'Career Elite' && plan !== 'Automation') {
      return (
         <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-10 space-y-8 animate-in fade-in zoom-in duration-500">
            <div className="relative">
               <div className="absolute inset-0 bg-blue-500/20 blur-[80px] rounded-full" />
               <Lock className="text-blue-500 relative z-10" size={64} strokeWidth={1.5} />
            </div>
            <div className="space-y-4 relative z-10 max-w-xl">
               <h2 className="text-4xl font-black text-white uppercase tracking-tighter leading-none">Market Intelligence Locked</h2>
               <p className="text-slate-500 text-lg font-medium leading-relaxed italic">
                  Institutional Market Commands and the Live Analysis Terminal are exclusive to Elite Authorized users.
               </p>
            </div>
            <button
               onClick={() => setView('pricing')}
               className="bg-blue-600 hover:bg-blue-500 text-white font-black px-12 py-5 rounded-2xl transition-all uppercase tracking-widest text-xs shadow-2xl shadow-blue-900/40 flex items-center gap-3 group"
            >
               Authorize Elite Access <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </button>
         </div>
      );
   }

   // ========================================================================
   // RENDER: SNAPSHOT VIEW
   // ========================================================================
   if (viewState === 'snapshot' && snapshot) {
      const hasExecutionTargets = snapshot.executionTargets.length > 0;
      const hasExclusionZones = snapshot.doNotApplyZone.length > 0;
      const hasNext7Days = snapshot.actionOrders.next7Days.length > 0;
      const hasNext30Days = snapshot.actionOrders.next30Days.length > 0;
      const hasPositioningDirectives = snapshot.actionOrders.positioningDirectives.length > 0;
      const hasInterviewDirectives = snapshot.actionOrders.interviewDirectives.length > 0;

      return (
         <div className="max-w-[1400px] mx-auto py-12 px-10 animate-in fade-in duration-1000">

            {/* Toast Messages */}
            {errorFeedback && (
               <div className="fixed top-6 right-6 z-50 bg-red-600/90 border border-red-500 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-right duration-300">
                  <AlertTriangle size={20} />
                  <span className="text-sm font-medium">{errorFeedback}</span>
                  <button onClick={() => setErrorFeedback(null)} className="ml-2 hover:opacity-70">
                     <XCircle size={16} />
                  </button>
               </div>
            )}
            {successMessage && (
               <div className="fixed top-6 right-6 z-50 bg-green-600/90 border border-green-500 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-right duration-300">
                  <CheckCircle2 size={20} />
                  <span className="text-sm font-medium">{successMessage}</span>
                  <button onClick={() => setSuccessMessage(null)} className="ml-2 hover:opacity-70">
                     <XCircle size={16} />
                  </button>
               </div>
            )}

            {/* TOP HEADER SECTION */}
            <div className="flex flex-col md:flex-row justify-between items-start mb-20 gap-8">
               <div className="space-y-6">
                  <div className="flex items-center gap-4">
                     <div className="bg-blue-600 px-3 py-1 rounded text-[10px] font-black text-white uppercase tracking-widest shadow-lg shadow-blue-900/40">Institutional Product</div>
                     <span className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em]">ID: {snapshot.id}</span>
                  </div>
                  <h2 className="text-8xl font-black text-white tracking-tighter uppercase leading-none">Market Command</h2>
                  <div className="flex items-center gap-12 pt-2">
                     <div className="flex flex-col">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Active Perimeter</span>
                        <span className="text-sm font-bold text-white uppercase tracking-tight">{snapshot.context.role} | {snapshot.context.geography}</span>
                     </div>
                     <div className="flex flex-col">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Snapshot Validity</span>
                        <span className={`text-sm font-bold uppercase tracking-tight ${snapshotExpiry && snapshotExpiry > Date.now() ? 'text-amber-500' : 'text-red-500'}`}>
                           {snapshotExpiry ? `Expires: ${formatExpiry(snapshotExpiry)}` : snapshot.expiry}
                        </span>
                     </div>
                  </div>
               </div>
               <button
                  onClick={handleReset}
                  className="flex items-center gap-3 text-slate-500 hover:text-white transition-all text-[10px] font-black uppercase tracking-[0.2em] bg-white/5 px-8 py-4 rounded-xl border border-white/10 group"
               >
                  <RefreshCw size={14} className="group-hover:rotate-180 transition-transform duration-500" /> Recalibrate Command
               </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
               {/* LEFT COLUMN: PRIMARY DIRECTIVES */}
               <div className="lg:col-span-8 space-y-20">

                  {/* 1. MARKET STATUS */}
                  <div className="space-y-10">
                     <div className="flex items-center gap-4 text-blue-500">
                        <Activity size={24} />
                        <h3 className="text-xl font-black uppercase tracking-widest">1. Market Status Directive</h3>
                     </div>
                     <div className="bg-[#111118] border-l-4 border-blue-600 p-12 rounded-r-[3.5rem] shadow-2xl space-y-8 ring-1 ring-white/5">
                        <h4 className="text-6xl font-black text-white uppercase tracking-tighter leading-none">{snapshot.marketStatus.label}</h4>
                        <p className="text-slate-400 text-2xl font-medium leading-relaxed italic pl-8 border-l border-white/10">
                           "{snapshot.marketStatus.implication}"
                        </p>
                     </div>
                  </div>

                  {/* 2. EXECUTION TARGETS */}
                  <div className="space-y-10">
                     <div className="flex items-center justify-between px-2">
                        <div className="flex items-center gap-4 text-white">
                           <h3 className="text-xl font-black uppercase tracking-widest">2. Execution Targets</h3>
                        </div>
                        <div className="flex items-center gap-2 text-green-500 bg-green-500/5 px-4 py-1.5 rounded-full border border-green-500/10">
                           <ShieldCheck size={16} />
                           <span className="text-[10px] font-black uppercase tracking-widest">Verified Headcount</span>
                        </div>
                     </div>
                     <div className="bg-[#111118] border border-white/5 rounded-[3.5rem] overflow-hidden shadow-2xl p-8 space-y-4">
                        {hasExecutionTargets ? snapshot.executionTargets.map((target, i) => (
                           <div key={i} className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center p-10 bg-white/[0.02] border border-white/5 rounded-[2.5rem] group hover:border-blue-500/30 transition-all hover:bg-white/[0.04]">
                              <div className="md:col-span-4 space-y-1">
                                 <p className="text-white font-black text-3xl uppercase tracking-tight leading-none">{target.company}</p>
                                 <p className="text-blue-500 text-[10px] font-black uppercase tracking-widest pt-1">{target.roleTitle}</p>
                              </div>
                              <div className="md:col-span-6">
                                 <p className="text-slate-500 text-sm font-medium leading-relaxed italic">"{target.fitReason}"</p>
                              </div>
                              <div className="md:col-span-2 text-right">
                                 <div className="space-y-1">
                                    <p className="text-white font-black text-2xl">{target.confidence}%</p>
                                    <p className="text-slate-700 text-[9px] font-black uppercase tracking-widest">Signal Score</p>
                                 </div>
                              </div>
                           </div>
                        )) : (
                           <div className="text-center py-12 text-slate-600">
                              <p className="text-sm font-bold uppercase tracking-widest">No execution targets identified</p>
                              <p className="text-xs mt-2">Try recalibrating with different parameters</p>
                           </div>
                        )}
                     </div>
                  </div>

                  {/* 3. EXCLUSION ZONE */}
                  {hasExclusionZones && (
                     <div className="space-y-10">
                        <div className="bg-red-600/5 border border-red-500/20 p-16 rounded-[4rem] relative overflow-hidden ring-1 ring-red-500/10 shadow-2xl">
                           <div className="absolute top-0 right-0 p-12 opacity-[0.03] text-red-500 pointer-events-none">
                              <AlertOctagon size={240} />
                           </div>
                           <div className="flex items-center gap-4 text-red-500 mb-12 relative z-10">
                              <ShieldAlert size={28} />
                              <h3 className="text-xl font-black uppercase tracking-widest">3. Exclusion Zone (No Entry)</h3>
                           </div>
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-16 relative z-10">
                              {snapshot.doNotApplyZone.map((zone, i) => (
                                 <div key={i} className="space-y-4">
                                    <p className="text-red-500 font-black text-lg uppercase tracking-tight border-b border-red-500/20 pb-2">{zone.entityType}</p>
                                    <p className="text-slate-400 text-sm font-medium leading-relaxed italic">
                                       {zone.reasoning}
                                    </p>
                                 </div>
                              ))}
                           </div>
                        </div>
                     </div>
                  )}
               </div>

               {/* RIGHT COLUMN: ACTION SIDEBAR */}
               <div className="lg:col-span-4 space-y-12">

                  {/* 4. ACTION ORDERS */}
                  {(hasNext7Days || hasNext30Days) && (
                     <div className="bg-blue-600 rounded-[3.5rem] p-12 text-white shadow-[0_0_60px_rgba(59,130,246,0.15)] relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-10 opacity-10 group-hover:scale-110 transition-transform">
                           <Send size={180} />
                        </div>

                        <div className="relative z-10 space-y-12">
                           <div className="flex items-center gap-4">
                              <Target size={24} />
                              <h3 className="text-2xl font-black uppercase tracking-tighter">4. Action Orders</h3>
                           </div>

                           <div className="space-y-10">
                              {hasNext7Days && (
                                 <div className="space-y-6">
                                    <div className="flex items-center gap-3 text-blue-100/60 font-black text-[11px] uppercase tracking-widest">
                                       <Clock size={14} /> Next 7 Days (Tactical)
                                    </div>
                                    <div className="space-y-4">
                                       {snapshot.actionOrders.next7Days.map((order, i) => (
                                          <div key={i} className="bg-white/10 border border-white/10 p-6 rounded-2xl flex gap-5 backdrop-blur-sm">
                                             <span className="text-blue-200 font-black text-xl leading-none">{String(i + 1).padStart(2, '0')}</span>
                                             <p className="text-blue-50 text-xs font-bold leading-relaxed">{order}</p>
                                          </div>
                                       ))}
                                    </div>
                                 </div>
                              )}

                              {hasNext30Days && (
                                 <div className="space-y-6">
                                    <div className="flex items-center gap-3 text-blue-100/60 font-black text-[11px] uppercase tracking-widest">
                                       <TrendingUp size={14} /> Next 30 Days (Strategic)
                                    </div>
                                    <div className="space-y-4">
                                       {snapshot.actionOrders.next30Days.map((order, i) => (
                                          <div key={i} className="bg-white/10 border border-white/10 p-6 rounded-2xl flex gap-5 backdrop-blur-sm">
                                             <span className="text-blue-200 font-black text-xl leading-none">{String(i + 1).padStart(2, '0')}</span>
                                             <p className="text-blue-50 text-xs font-bold leading-relaxed">{order}</p>
                                          </div>
                                       ))}
                                    </div>
                                 </div>
                              )}
                           </div>
                        </div>
                     </div>
                  )}

                  {/* STRATEGIC DIRECTIVES */}
                  {(hasPositioningDirectives || hasInterviewDirectives) && (
                     <div className="bg-[#16161E] border border-white/5 p-12 rounded-[3.5rem] shadow-xl space-y-10">
                        {hasPositioningDirectives && (
                           <div className="space-y-8">
                              <div className="flex items-center gap-3">
                                 <Fingerprint size={18} className="text-indigo-400" />
                                 <h4 className="text-white font-black uppercase text-xs tracking-widest">Positioning Directives</h4>
                              </div>
                              <div className="space-y-6">
                                 {snapshot.actionOrders.positioningDirectives.map((order, i) => (
                                    <div key={i} className="flex gap-4 items-start">
                                       <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                                       <p className="text-slate-400 text-[11px] font-bold leading-relaxed uppercase">{order}</p>
                                    </div>
                                 ))}
                              </div>
                           </div>
                        )}

                        {hasPositioningDirectives && hasInterviewDirectives && (
                           <div className="h-[1px] bg-white/5" />
                        )}

                        {hasInterviewDirectives && (
                           <div className="space-y-8">
                              <div className="flex items-center gap-3">
                                 <Shield size={18} className="text-blue-500" />
                                 <h4 className="text-white font-black uppercase text-xs tracking-widest">Interview Defense</h4>
                              </div>
                              <div className="space-y-6">
                                 {snapshot.actionOrders.interviewDirectives.map((order, i) => (
                                    <div key={i} className="flex gap-4 items-start">
                                       <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                                       <p className="text-slate-400 text-[11px] font-bold leading-relaxed uppercase">{order}</p>
                                    </div>
                                 ))}
                              </div>
                           </div>
                        )}
                     </div>
                  )}

                  {/* 5. RISK REGISTER */}
                  <div className="bg-[#0D0D12] border border-white/5 p-12 rounded-[3.5rem] shadow-xl space-y-6">
                     <div className="flex items-center gap-4 text-slate-600">
                        <ShieldAlert size={20} />
                        <h3 className="text-xs font-black uppercase tracking-widest">5. Risk Register</h3>
                     </div>
                     <div className="space-y-2">
                        <p className="text-red-500 font-black text-[10px] uppercase tracking-widest">Primary Uncertainty</p>
                        <p className="text-slate-400 text-sm font-medium leading-relaxed italic">
                           "{snapshot.risks.uncertainty}"
                        </p>
                     </div>
                     <div className="space-y-2 pt-4 border-t border-white/5">
                        <p className="text-amber-500 font-black text-[10px] uppercase tracking-widest">Refresh Condition</p>
                        <p className="text-slate-500 text-xs font-medium leading-relaxed">
                           {snapshot.risks.refreshCondition}
                        </p>
                     </div>
                  </div>
               </div>
            </div>
         </div>
      );
   }

   // ========================================================================
   // RENDER: PROCESSING VIEW
   // ========================================================================
   if (viewState === 'processing') {
      const elapsed = processingStartTime ? Math.floor((Date.now() - processingStartTime) / 1000) : 0;

      return (
         <div className="flex flex-col items-center justify-center min-h-[70vh] gap-10">
            <Loader2 size={80} className="text-blue-500 animate-spin" strokeWidth={1.5} />
            <div className="text-center space-y-4">
               <h3 className="text-3xl font-black text-white uppercase tracking-tight">Generating Market Command</h3>
               <p className="text-slate-500 font-bold uppercase tracking-widest text-sm">Targeting {targetRole} Signal Maps</p>
               <p className="text-slate-600 text-[10px] font-black uppercase tracking-[0.4em] animate-pulse">
                  Running in background • {elapsed}s elapsed
               </p>
            </div>
            <button
               onClick={() => {
                  setViewState('input');
                  setTrackingJobId(null);
                  setProcessingStartTime(null);
               }}
               className="text-slate-600 hover:text-white text-[10px] font-black uppercase tracking-widest transition-colors"
            >
               Cancel
            </button>
         </div>
      );
   }

   // ========================================================================
   // RENDER: INPUT VIEW
   // ========================================================================
   return (
      <div className="max-w-4xl mx-auto py-24 px-10 space-y-12 animate-in fade-in duration-700">

         {/* Toast Messages */}
         {errorFeedback && (
            <div className="fixed top-6 right-6 z-50 bg-red-600/90 border border-red-500 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-right duration-300">
               <AlertTriangle size={20} />
               <span className="text-sm font-medium">{errorFeedback}</span>
               <button onClick={() => setErrorFeedback(null)} className="ml-2 hover:opacity-70">
                  <XCircle size={16} />
               </button>
            </div>
         )}
         {successMessage && (
            <div className="fixed top-6 right-6 z-50 bg-green-600/90 border border-green-500 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-right duration-300">
               <CheckCircle2 size={20} />
               <span className="text-sm font-medium">{successMessage}</span>
               <button onClick={() => setSuccessMessage(null)} className="ml-2 hover:opacity-70">
                  <XCircle size={16} />
               </button>
            </div>
         )}

         <div className="space-y-4">
            <div className="flex items-center gap-3 text-amber-500 bg-amber-500/5 w-fit px-4 py-1.5 rounded-full border border-amber-500/10">
               <Radio size={16} />
               <span className="text-[10px] font-black uppercase tracking-widest">Live Market Intelligence Terminal</span>
            </div>

            <h2 className="text-6xl font-black text-white tracking-tighter uppercase leading-none">Market Outlook</h2>
            <p className="text-slate-500 text-xl font-medium leading-relaxed max-w-2xl">
               Generates a high-fidelity market snapshot for strategic document calibration.
               Assists in mapping your experience against current hiring patterns.
            </p>
         </div>

         <div className="bg-[#16161E] border border-[#1D1D26] rounded-[4rem] p-16 space-y-12 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-10 opacity-[0.02] text-white pointer-events-none">
               <Radar size={320} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 relative z-10">
               <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-1">Target Designation</label>
                  <input
                     value={targetRole}
                     onChange={e => setTargetRole(e.target.value)}
                     onKeyDown={e => e.key === 'Enter' && handleGenerate()}
                     className="w-full bg-[#0D0D12] border border-[#2D313D] rounded-2xl p-6 text-white outline-none focus:border-blue-500 font-bold text-xl placeholder:text-slate-900 transition-all"
                     placeholder="e.g. Lead ML Engineer"
                  />
               </div>
               <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-1">Geography Perimeter</label>
                  <input
                     value={geography}
                     onChange={e => setGeography(e.target.value)}
                     onKeyDown={e => e.key === 'Enter' && handleGenerate()}
                     className="w-full bg-[#0D0D12] border border-[#2D313D] rounded-2xl p-6 text-white outline-none focus:border-blue-500 font-bold text-xl placeholder:text-slate-900 transition-all"
                     placeholder="e.g. Remote / North America"
                  />
               </div>
            </div>
            <div className="space-y-3 relative z-10">
               <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-1">Experience Band</label>
               <select
                  value={expBand}
                  onChange={e => setExpBand(e.target.value)}
                  className="w-full bg-[#0D0D12] border border-[#2D313D] rounded-2xl p-6 text-white outline-none focus:border-blue-500 font-bold text-lg transition-all appearance-none cursor-pointer"
               >
                  <option value="Entry (0-2 years)">Entry (0-2 years)</option>
                  <option value="Mid (3-5 years)">Mid (3-5 years)</option>
                  <option value="Senior (5-8 years)">Senior (5-8 years)</option>
                  <option value="Staff+ (8-12 years)">Staff+ (8-12 years)</option>
                  <option value="Principal/Director (12+ years)">Principal/Director (12+ years)</option>
               </select>
            </div>
            <button
               onClick={handleGenerate}
               disabled={!targetRole.trim()}
               className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-8 rounded-3xl transition-all uppercase tracking-[0.3em] text-sm shadow-2xl shadow-blue-900/40 flex items-center justify-center gap-4 group disabled:opacity-30 disabled:cursor-not-allowed relative z-10"
            >
               Generate Market Command <ArrowRight size={20} className="group-hover:translate-x-2 transition-transform" />
            </button>
         </div>

      </div>
   );
};
