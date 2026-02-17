import React, { useState, useEffect, useMemo } from 'react';
import {
    Play, Loader2, Target, Search, Building2, MapPin, ArrowRight, Check, ListOrdered, Layers, Workflow, Radio, FileText, RefreshCw, Briefcase, Box, ShieldCheck, ShieldX, Globe2, ShieldAlert, Cpu, Timer, BarChart, ChevronRight, AlertCircle, AlertTriangle, XCircle, Send, Clock, Calendar, Mail, Linkedin, ExternalLink, ArrowLeft, Terminal, Sparkles, UserCheck, ZapOff, CheckCircle2, History
} from 'lucide-react';
import { UserPlan, UserProfile, JobOpportunity, ExecutionState, KillZoneAnalysis, ImprovementPlan, ApplicationTracking, ImprovementStep } from '../types';
import { supabase } from '../lib/supabase';
import { ApiEngine } from '../lib/api-engine';

// --- HELPER COMPONENTS ---

const StatusBadge: React.FC<{ state: ExecutionState }> = ({ state }) => {
    const config: Record<string, { label: string, color: string, icon: any }> = {
        'TRACKED': { label: 'Tracked', color: 'text-slate-400 bg-white/5', icon: Target },
        'IDENTIFIED': { label: 'Identified', color: 'text-slate-500 bg-slate-500/10', icon: Box },
        'KILL_ZONE': { label: 'Perfect Match', color: 'text-green-500 bg-green-500/10', icon: ShieldCheck },
        'NOT_READY': { label: 'Not Quite Ready', color: 'text-amber-500 bg-amber-500/10', icon: AlertCircle },
        'NOT_MATCH': { label: 'Low Match', color: 'text-red-500 bg-red-500/10', icon: ShieldX },
        'SUBMITTED': { label: 'Submitted', color: 'text-blue-500 bg-blue-500/10', icon: Send },
        'UNDER_REVIEW': { label: 'Under Review', color: 'text-indigo-500 bg-indigo-500/10', icon: Radio },
        'INTERVIEW': { label: 'Interview', color: 'text-green-400 bg-green-400/10', icon: UserCheck },
        'REJECTED': { label: 'Rejected', color: 'text-red-400 bg-red-400/10', icon: ZapOff },
    };

    const c = config[state] || { label: state, color: 'text-slate-500 bg-white/5', icon: Target };
    return (
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full border border-white/5 ${c.color}`}>
            <c.icon size={12} />
            <span className="text-[9px] font-black uppercase tracking-widest">{c.label}</span>
        </div>
    );
};

// Helper to map DB application records to UI JobOpportunity objects
const mapToJobOpportunity = (app: any): JobOpportunity => ({
    id: app.id,
    title: app.title,
    company: app.company,
    location: app.location,
    type: 'Full-time',
    salary: 'TBD',
    posted_at: app.created_at,
    description_snippet: '',
    match_confidence: app.match_confidence || 0,
    company_state: 'ACTIVE',
    discovery_method: 'SEARCH',
    confidence_tier: app.match_confidence > 0.8 ? 'HIGH' : 'MEDIUM',
    freshness_window: 'RECENT',
    source_ats: 'Internal',
    state: app.status as ExecutionState,
    analysis: app.match_confidence ? {
        inKillZone: app.match_confidence > 0.8,
        percentile: Math.round(app.match_confidence * 100),
        estimatedCallbackRate: app.match_confidence,
        confidence: app.match_confidence,
        matchBreakdown: {
            skillsMatch: 'High',
            experienceMatch: true,
            companyTierMatch: true,
            githubScore: 0,
            minorGaps: []
        },
        competitionAnalysis: {
            estimatedApplicants: 100,
            yourRank: 'Top 10',
            competitiveAdvantage: []
        }
    } : undefined
});

interface ApplicationExecutionViewProps {
    user: UserProfile | null;
    applicationId?: string;
}

export const ApplicationExecutionView: React.FC<ApplicationExecutionViewProps> = ({ user, applicationId }) => {
    const [applications, setApplications] = useState<JobOpportunity[]>([]);
    const [activeAppId, setActiveAppId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'dashboard' | 'discover' | 'detail'>('dashboard');
    const [submitting, setSubmitting] = useState(false);
    const [resumeVersions, setResumeVersions] = useState<any[]>([]);

    // Multi-step Application Wizard State
    const [wizardStep, setWizardStep] = useState(1);

    useEffect(() => {
        async function loadApplicationsData() {
            if (!user) return;
            try {
                setLoading(true);
                const data = await ApiEngine.fetchApplications(user.id);
                const mapped = (data || []).map(mapToJobOpportunity);
                setApplications(mapped);

                // If an applicationId was passed from App.tsx, auto-select it
                if (applicationId) {
                    setActiveAppId(applicationId);
                    setViewMode('detail');
                }
            } catch (err) {
                console.error('Failed to load applications:', err);
            } finally {
                setLoading(false);
            }
        }
        loadApplicationsData();

        // Realtime subscription for applications
        const channel = supabase
            .channel('applications_realtime')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'applications',
                filter: `user_id=eq.${user?.id}` // Use optional chaining for user.id
            }, (payload) => {
                if (payload.eventType === 'INSERT') {
                    setApplications(prev => [...prev, mapToJobOpportunity(payload.new)]);
                } else if (payload.eventType === 'UPDATE') {
                    setApplications(prev => prev.map(a => a.id === payload.new.id ? mapToJobOpportunity(payload.new) : a));
                } else if (payload.eventType === 'DELETE') {
                    setApplications(prev => prev.filter(a => a.id === payload.old.id));
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, applicationId]);

    useEffect(() => {
        if (!activeAppId) return;

        const loadVersions = async () => {
            const { data, error } = await supabase
                .from('resume_versions')
                .select('*')
                .eq('application_id', activeAppId)
                .order('created_at', { ascending: false });

            if (!error) setResumeVersions(data || []);
        };

        loadVersions();

        // Realtime subscription for resume versions
        const versionChannel = supabase
            .channel(`versions_${activeAppId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'resume_versions',
                filter: `application_id=eq.${activeAppId}`
            }, (payload) => {
                if (payload.eventType === 'INSERT') {
                    setResumeVersions(prev => [payload.new, ...prev]);
                } else if (payload.eventType === 'UPDATE') {
                    setResumeVersions(prev => prev.map(v => v.id === payload.new.id ? payload.new : v));
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(versionChannel);
        };
    }, [activeAppId]);

    const activeApp = useMemo(() => applications.find(a => a.id === activeAppId), [applications, activeAppId]);

    const handleSelectApp = (id: string) => {
        setActiveAppId(id);
        setViewMode('detail');
    };

    const handleStartApply = async () => {
        if (!activeApp || !user) return;
        setSubmitting(true);

        try {
            await ApiEngine.triggerApplication(activeApp.id, user.id);
            // Refresh state locally
            setApplications(prev => prev.map(a => a.id === activeApp.id ? { ...a, state: 'SUBMITTED' } : a));
        } catch (err) {
            console.error("Submission failed", err);
            alert("Submission failed. Check console.");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center min-h-[70vh] gap-6 text-slate-500">
            <Loader2 className="animate-spin" size={48} /><p className="text-[10px] font-black uppercase tracking-widest">Loading your applications…</p>
        </div>
    );

    return (
        <div className="max-w-[1500px] mx-auto py-12 px-10 animate-in fade-in duration-700">
            {/* Navigation Header */}
            <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-8 border-b border-white/5 pb-10">
                <div className="space-y-6">
                    <div className="flex items-center gap-4">
                        <div className="bg-blue-600 px-3 py-1 rounded text-[10px] font-black text-white uppercase tracking-widest">Applications</div>
                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">AI-Powered Match Tracking</span>
                    </div>
                    <h2 className="text-8xl font-black text-white tracking-tighter uppercase leading-none">Applications</h2>
                </div>
                <div className="flex gap-4">
                    {viewMode !== 'dashboard' && (
                        <button onClick={() => setViewMode('dashboard')} className="font-black px-6 py-5 rounded-2xl border border-white/10 text-slate-400 hover:text-white transition-all uppercase tracking-widest text-xs flex items-center gap-3">
                            <ArrowLeft size={18} /> Registry
                        </button>
                    )}
                    <button onClick={() => setViewMode('discover')} className="font-black px-8 py-5 rounded-2xl bg-blue-600 text-white hover:bg-blue-500 transition-all uppercase tracking-widest text-xs shadow-2xl flex items-center gap-3">
                        <Search size={18} /> Find Matches
                    </button>
                </div>
            </div>

            {viewMode === 'dashboard' && (
                <div className="space-y-12">
                    {/* Performance Overview (Mocked for MVP) */}
                    <div className="bg-[#111118] border border-white/5 p-12 rounded-[3.5rem] shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-12 opacity-[0.02] text-white pointer-events-none">
                            <BarChart size={240} />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 relative z-10">
                            <div className="space-y-6">
                                <div>
                                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.4em] mb-2">Execution Health</p>
                                    <h3 className="text-4xl font-black text-white uppercase tracking-tighter">87% <span className="text-blue-500">Callback</span></h3>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-slate-500">
                                        <span>Target: 90%</span>
                                        <span>{applications.filter(a => ['INTERVIEW', 'SUBMITTED'].includes(a.state || '')).length} Successful</span>
                                    </div>
                                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                                        <div className="h-full bg-blue-600 w-[87%]" />
                                    </div>
                                </div>
                            </div>
                            {/* ... (Other stat blocks kept static for visual fidelity) ... */}
                            <div className="space-y-2">
                                <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.4em] mb-2">Market Standing</p>
                                <h3 className="text-4xl font-black text-white uppercase tracking-tighter">94th <span className="text-slate-500 text-xl font-bold">PCTL</span></h3>
                                <p className="text-[9px] font-bold text-green-500 uppercase">↑ 7pts this month</p>
                            </div>
                            <div className="space-y-2">
                                <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.4em] mb-2">Preparation</p>
                                <h3 className="text-4xl font-black text-white uppercase tracking-tighter">5/7 <span className="text-slate-500 text-xl font-bold">STEPS</span></h3>
                                <p className="text-[9px] font-bold text-slate-500 uppercase">Ready in est. 2 weeks</p>
                            </div>
                            <div className="space-y-2">
                                <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.4em] mb-2">Quota Balance</p>
                                <h3 className="text-4xl font-black text-white uppercase tracking-tighter">{10 - applications.length}/10 <span className="text-slate-500 text-xl font-bold">LEFT</span></h3>
                                <button className="text-[9px] font-black text-blue-500 hover:text-white uppercase tracking-widest">Upgrade Access →</button>
                            </div>
                        </div>
                    </div>

                    {/* Registry List */}
                    <div className="space-y-6">
                        <div className="flex items-center justify-between px-2">
                            <h3 className="text-white font-black uppercase text-xs tracking-widest flex items-center gap-2"><Layers size={14} className="text-blue-500" /> Your Applications</h3>
                            <span className="text-[10px] font-bold text-slate-600 uppercase">{applications.length} persistent tracks</span>
                        </div>
                        {applications.length === 0 ? (
                            <div className="p-12 text-center border border-white/5 rounded-[2.5rem]">
                                <p className="text-slate-500 font-medium">No tracked applications yet. Use "Find Matches" to discover roles that fit your profile.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-4">
                                {applications.map(app => (
                                    <div key={app.id} onClick={() => handleSelectApp(app.id)} className="bg-[#111118] border border-white/5 p-8 rounded-[2.5rem] flex flex-col md:flex-row justify-between items-center gap-12 group hover:border-blue-500/30 transition-all cursor-pointer shadow-xl">
                                        <div className="flex items-center gap-8 flex-1">
                                            <div className="w-16 h-16 rounded-[1.5rem] bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 group-hover:text-blue-500 transition-colors">
                                                <Building2 size={28} />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-3 mb-1">
                                                    <h4 className="text-2xl font-black text-white uppercase tracking-tight">{app.company}</h4>
                                                    <StatusBadge state={app.state || 'IDENTIFIED'} />
                                                </div>
                                                <p className="text-blue-500 text-[11px] font-black uppercase tracking-widest">{app.title}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-16 text-right">
                                            <div className="hidden lg:block">
                                                <p className="text-[9px] font-black text-slate-700 uppercase tracking-widest mb-1">Probability</p>
                                                <p className="text-2xl font-black text-white">{(app.match_confidence * 100).toFixed(0)}%</p>
                                            </div>
                                            <button className="p-4 bg-white/5 rounded-2xl text-slate-500 group-hover:text-white group-hover:bg-blue-600 transition-all">
                                                <ChevronRight size={20} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {viewMode === 'detail' && activeApp && (
                <div className="space-y-12 animate-in slide-in-from-bottom-8">
                    {/* Job Detail Header */}
                    <div className="bg-[#111118] border border-white/5 p-12 rounded-[3.5rem] flex flex-col md:flex-row justify-between items-start gap-12 shadow-2xl relative overflow-hidden">
                        <div className="space-y-6">
                            <button onClick={() => setViewMode('dashboard')} className="text-[10px] font-black text-slate-600 hover:text-white uppercase tracking-widest flex items-center gap-2 mb-4">
                                <ArrowLeft size={12} /> Back to Registry
                            </button>
                            <div>
                                <h3 className="text-6xl font-black text-white uppercase tracking-tighter leading-none mb-4">{activeApp.company}</h3>
                                <div className="flex flex-wrap items-center gap-6">
                                    <p className="text-blue-500 text-xl font-bold uppercase tracking-tight">{activeApp.title}</p>
                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-800" />
                                    <p className="text-slate-400 font-medium">{activeApp.location}</p>
                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-800" />
                                    <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">{activeApp.salary}</p>
                                </div>
                            </div>
                        </div>
                        <div className="bg-[#161B2E] border border-white/5 p-8 rounded-[2.5rem] min-w-[320px] shadow-2xl text-center">
                            <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-6">Match Signal</p>
                            {activeApp.state === 'KILL_ZONE' && (
                                <div className="space-y-6">
                                    <div className="flex flex-col items-center">
                                        <p className="text-5xl font-black text-green-500">{(activeApp.analysis?.estimatedCallbackRate! * 100).toFixed(0)}%</p>
                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-2">Callback Probability</p>
                                    </div>
                                    <button
                                        onClick={handleStartApply}
                                        disabled={submitting}
                                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-5 rounded-2xl transition-all uppercase tracking-widest text-xs shadow-xl flex items-center justify-center gap-3 ring-offset-2 focus:ring-2">
                                        {submitting ? <Loader2 className="animate-spin" /> : <>Apply Now <ArrowRight size={14} /></>}
                                    </button>
                                </div>
                            )}
                            {activeApp.state === 'NOT_READY' && (
                                <div className="space-y-6">
                                    <div className="flex flex-col items-center">
                                        <p className="text-5xl font-black text-amber-500">{(activeApp.analysis?.estimatedCallbackRate! * 100).toFixed(0)}%</p>
                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-2">Not Quite Ready</p>
                                    </div>
                                    <button className="w-full bg-amber-500/10 border border-amber-500/20 text-amber-500 font-black py-5 rounded-2xl transition-all uppercase tracking-widest text-xs">
                                        See Improvement Plan
                                    </button>
                                </div>
                            )}
                            {['INTERVIEW', 'SUBMITTED', 'UNDER_REVIEW'].includes(activeApp.state || '') && (
                                <div className="space-y-6">
                                    <div className="flex flex-col items-center">
                                        <div className="w-16 h-16 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500 mb-2">
                                            <Radio className="animate-pulse" />
                                        </div>
                                        <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Active Tracking</p>
                                    </div>
                                    <div className="text-white font-black uppercase text-xs tracking-widest">{activeApp.state?.replace('_', ' ')}</div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Kill Zone Analysis - Specific View */}
                    {(activeApp.state === 'KILL_ZONE' || activeApp.state === 'NOT_READY') && activeApp.analysis && (
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                            <div className="lg:col-span-8 space-y-10">
                                <div className={`${activeApp.state === 'KILL_ZONE' ? 'bg-green-500/5 border-green-500/10' : 'bg-amber-500/5 border-amber-500/10'} p-12 rounded-[3.5rem] shadow-2xl relative overflow-hidden border`}>
                                    <div className={`absolute top-0 right-0 p-12 opacity-[0.03] ${activeApp.state === 'KILL_ZONE' ? 'text-green-500' : 'text-amber-500'}`}>
                                        <ShieldCheck size={200} />
                                    </div>
                                    <div className={`flex items-center gap-4 ${activeApp.state === 'KILL_ZONE' ? 'text-green-500' : 'text-amber-500'} mb-4`}>
                                        <Target size={24} />
                                        <h4 className="text-xl font-black uppercase tracking-widest">
                                            {activeApp.state === 'KILL_ZONE' ? '🎯 Match Analysis' : '⚠️ Gap Analysis'}
                                        </h4>
                                    </div>
                                    <p className="text-[10px] font-medium text-slate-500 mb-10 leading-relaxed max-w-lg">
                                        {activeApp.state === 'KILL_ZONE'
                                            ? 'Your profile signals strongly align with this role. This verdict is based on verified skill matches, role proximity, and evidence density.'
                                            : 'Your current profile signals do not yet meet the threshold for this role. The gaps below show exactly what to strengthen.'}
                                    </p>
                                    <div className="grid md:grid-cols-2 gap-12 mb-12">
                                        <div className="space-y-2">
                                            <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Market Percentile</p>
                                            <h5 className="text-5xl font-black text-white">{activeApp.analysis.percentile}th <span className={`${activeApp.state === 'KILL_ZONE' ? 'text-green-500' : 'text-amber-500'} text-sm font-black tracking-widest`}>TOP {100 - activeApp.analysis.percentile}%</span></h5>
                                        </div>
                                        <div className="space-y-2">
                                            <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Est. Callback Rate</p>
                                            <h5 className="text-5xl font-black text-white">{(activeApp.analysis.estimatedCallbackRate * 100).toFixed(0)}%</h5>
                                        </div>
                                    </div>
                                    <div className="h-[1px] bg-white/5 mb-10" />
                                    <div className="space-y-8">
                                        <p className="text-white font-black uppercase text-xs tracking-widest">Detailed Breakdown:</p>
                                        {activeApp.analysis.matchBreakdown.minorGaps?.length > 0 && (
                                            <div className="flex flex-wrap gap-4">
                                                {(activeApp.analysis.matchBreakdown.minorGaps as any[]).map((gap: any, i: number) => (
                                                    <div key={i} className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl w-fit">
                                                        <AlertTriangle size={14} className="text-amber-500" />
                                                        <span className="text-amber-500 font-bold text-[10px] uppercase tracking-widest">{gap.label}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="lg:col-span-4 space-y-8">
                                <div className="bg-[#161B2E] border border-white/5 p-10 rounded-[2.5rem] shadow-xl space-y-8">
                                    <h4 className="text-white font-black uppercase text-xs tracking-widest border-b border-white/5 pb-6">Action Required</h4>
                                    <div className="space-y-4">
                                        {activeApp.state === 'KILL_ZONE' ? (
                                            <button onClick={handleStartApply} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-5 rounded-2xl transition-all uppercase tracking-widest text-[10px] shadow-xl">Apply Now</button>
                                        ) : (
                                            <button className="w-full bg-amber-500 hover:bg-amber-600 text-black font-black py-5 rounded-2xl transition-all uppercase tracking-widest text-[10px] shadow-xl">Start Improvement Plan</button>
                                        )}
                                        <button className="w-full bg-white/5 border border-white/5 text-slate-500 hover:text-white font-black py-5 rounded-2xl transition-all uppercase tracking-widest text-[10px]">Save for Later</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Tracking View */}
                    {activeApp.tracking && ['SUBMITTED', 'INTERVIEW', 'REJECTED'].includes(activeApp.state || '') && (
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                            <div className="lg:col-span-8 space-y-10">
                                <div className="bg-[#111118] border border-white/5 p-12 rounded-[3.5rem] shadow-2xl space-y-12">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-3">
                                            <History size={20} className="text-blue-500" /> Application Timeline
                                        </h4>
                                        <div className="flex items-center gap-2 text-[10px] font-bold text-green-500 uppercase">
                                            <CheckCircle2 size={14} /> Synchronized with Inbox
                                        </div>
                                    </div>
                                    <div className="space-y-10 relative">
                                        <div className="absolute left-[7px] top-2 bottom-2 w-[1px] bg-slate-800" />
                                        {activeApp.tracking.timeline.map((event, i) => (
                                            <div key={i} className="relative pl-10">
                                                <div className={`absolute left-0 top-1.5 w-4 h-4 rounded-full border-4 border-[#111118] z-10 ${event.type === 'outcome' ? 'bg-green-500' : 'bg-blue-500'}`} />
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-4">
                                                        <p className="text-white font-black text-sm uppercase tracking-tight">{event.label}</p>
                                                        <span className="text-slate-600 text-[9px] font-bold uppercase">{new Date(event.timestamp).toLocaleString()}</span>
                                                    </div>
                                                    <p className="text-slate-500 text-xs font-medium leading-relaxed">{event.description}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Resume Rebuilds Section */}
                    <div className="bg-[#111118] border border-white/5 p-12 rounded-[3.5rem] shadow-2xl space-y-8 mt-12">
                        <div className="flex items-center justify-between">
                            <h4 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-3">
                                <FileText size={20} className="text-blue-500" /> Linked Resume Versions
                            </h4>
                            <span className="text-[10px] font-bold text-slate-600 uppercase">{resumeVersions.length} versions generated</span>
                        </div>

                        {resumeVersions.length === 0 ? (
                            <div className="py-8 text-center bg-white/5 rounded-2xl border border-dashed border-white/10">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">No custom resumes generated for this application yet.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {resumeVersions.map((v) => (
                                    <div key={v.id} className="bg-[#161B2E] border border-white/5 p-6 rounded-2xl space-y-4 hover:border-blue-500/30 transition-all group">
                                        <div className="flex justify-between items-start">
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-lg ${v.status === 'COMPLETED' ? 'bg-green-500/10 text-green-500' : v.status === 'FAILED' ? 'bg-red-500/10 text-red-500' : 'bg-blue-500/10 text-blue-500'}`}>
                                                    {v.status === 'PENDING' || v.status === 'PROCESSING' ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                                                </div>
                                                <div>
                                                    <p className="text-white font-black text-[10px] uppercase tracking-widest">Version {v.id.slice(0, 4)}</p>
                                                    <p className="text-[9px] font-bold text-slate-500">{new Date(v.created_at).toLocaleDateString()}</p>
                                                </div>
                                            </div>
                                            <div className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter ${v.status === 'COMPLETED' ? 'bg-green-500/20 text-green-500' : 'bg-white/5 text-slate-500'}`}>
                                                {v.status}
                                            </div>
                                        </div>

                                        {v.status === 'COMPLETED' && (
                                            <div className="flex gap-2">
                                                <button className="flex-1 bg-white/5 hover:bg-white/10 text-white text-[9px] font-black py-2 rounded-lg uppercase tracking-widest transition-all">Preview</button>
                                                <button className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-[9px] font-black py-2 rounded-lg uppercase tracking-widest transition-all">Use</button>
                                            </div>
                                        )}
                                        {v.status === 'FAILED' && (
                                            <p className="text-[9px] text-red-400 font-medium italic">Error: {v.error_reason || "Rebuild failed"}</p>
                                        )}
                                        {(v.status === 'PENDING' || v.status === 'PROCESSING') && (
                                            <div className="space-y-2">
                                                <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                                                    <div className="h-full bg-blue-600 animate-pulse w-full" />
                                                </div>
                                                <p className="text-[8px] font-black text-blue-500 uppercase tracking-widest animate-pulse">AI Engine Rebuilding...</p>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {viewMode === 'discover' && (
                <div className="animate-in fade-in zoom-in duration-500 py-20 text-center">
                    <Cpu size={64} className="text-blue-500 mx-auto mb-8 animate-spin-slow" />
                    <h3 className="text-3xl font-black text-white uppercase tracking-tighter mb-4">Governed Discovery Active</h3>
                    <p className="text-slate-500 font-medium max-w-xl mx-auto">
                        Redirecting to global search...
                    </p>
                    {/* In real app, this would mount the search view */}
                </div>
            )}

            <style>{`
        .animate-spin-slow { animation: spin 8s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
        </div>
    );
};
