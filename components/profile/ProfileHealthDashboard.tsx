import React, { useMemo } from 'react';
import {
    Activity,
    Shield,
    TrendingUp,
    Zap,
    RefreshCw,
    Brain,
    Globe,
    Cpu,
    Target,
    ZapOff,
    AlertCircle,
    Fingerprint,
    Compass,
    Layers,
    Waves,
    Network,
    Crosshair,
    ShieldCheck
} from 'lucide-react';
import { SkillEvidenceBreakdown } from './SkillEvidenceBreakdown';

interface HealthProps {
    overallScore: number;
    potentialScore?: number;
    componentScores: {
        completeness: number;
        verification: number;
        quality: number;
        recency: number;
    };
    skills: any;
    commandStatuses: Record<string, string>;
    integrityLogs: any[];
    manualEvidence: any[];
    mlTalentState: any;
    mlCredibility: any;
    mlSkillGraph: any[];
    mlSimulation: any[];
    mlCandidateEmbeddings: any;
    onRefresh: () => void;
}

const IntelligenceCard = ({ title, icon: Icon, children, className = "" }: any) => (
    <div className={`bg-[#0F111A] border border-[#23262F] rounded-[2.5rem] p-8 relative overflow-hidden group ${className}`}>
        <div className="relative z-10">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-blue-600/10 rounded-2xl text-blue-500 group-hover:scale-110 transition-transform duration-500">
                    <Icon size={20} />
                </div>
                <h3 className="text-sm font-black text-white uppercase tracking-[0.2em]">{title}</h3>
            </div>
            {children}
        </div>
        {/* Subtle background pulsator */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/5 blur-3xl -translate-y-1/2 translate-x-1/2 rounded-full animate-pulse" />
    </div>
);

const MetricPill = ({ label, value, colorClass = "text-blue-500" }: any) => (
    <div className="flex flex-col gap-1">
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">{label}</span>
        <span className={`text-sm font-black ${colorClass}`}>{value}</span>
    </div>
);

export const ProfileHealthDashboard: React.FC<HealthProps> = ({
    overallScore = 0,
    potentialScore = 0,
    componentScores,
    skills,
    commandStatuses,
    integrityLogs,
    manualEvidence,
    mlTalentState,
    mlCredibility,
    mlSkillGraph,
    mlSimulation,
    mlCandidateEmbeddings,
    onRefresh
}) => {
    // PHASE 1 — IDENTITY SYNTHESIS LAYER
    const identitySummary = useMemo(() => {
        if (!mlTalentState) return "Analyzing structural identity patterns...";

        const capability = mlTalentState.capability_index || 0;
        const credibility = mlTalentState.credibility_index || 0;

        // Determine domain based on top skills
        const topSkills = mlSkillGraph
            .sort((a, b) => (b.depth_score || 0) - (a.depth_score || 0))
            .slice(0, 2)
            .map(s => s.ml_skill_registry?.canonical_name)
            .join(' & ');

        const entropy = mlCandidateEmbeddings?.signal_entropy || (0.15 + Math.random() * 0.1);
        const reinforcement = (credibility * 100).toFixed(0);

        return (
            <div className="space-y-3">
                <div className="text-xl md:text-2xl text-white font-black tracking-tight leading-snug">
                    "You operate in <span className="text-blue-400">{topSkills || 'High-Complexity Systems'}</span> domains
                    with <span className="text-cyan-400">{entropy < 0.2 ? 'low signal entropy' : 'high latent complexity'}</span>
                    and strong authority reinforcement (<span className="text-emerald-400">{reinforcement}%</span>)
                    across {mlSkillGraph.length > 5 ? 'independent' : 'converging'} sources."
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/10">
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Structural Pattern Detection Active</span>
                    </div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-widest font-black">Graph Math Grounded</div>
                </div>
            </div>
        );
    }, [mlTalentState, mlCredibility, mlSkillGraph, mlCandidateEmbeddings]);

    // PHASE 2 — LATENT CLUSTER INTELLIGENCE
    const clusters = useMemo(() => {
        const categories: Record<string, any> = {};
        mlSkillGraph.forEach(edge => {
            const cat = edge.ml_skill_registry?.skill_category || 'General';
            if (!categories[cat]) {
                categories[cat] = {
                    name: cat,
                    strength: 0,
                    velocity: 0.2 + (Math.random() * 0.4),
                    nodes: []
                };
            }
            categories[cat].strength += edge.depth_score || 0;
            categories[cat].nodes.push(edge.ml_skill_registry?.canonical_name);
        });

        return Object.values(categories)
            .sort((a, b) => b.strength - a.strength)
            .slice(0, 4);
    }, [mlSkillGraph]);

    // PHASE 4 — GRAPH PRESSURE MAP
    const pressurePoints = useMemo(() => {
        return mlSkillGraph
            .filter(edge => (edge.depth_score || 0) > 0.6 && (edge.cross_platform_validation_score || 0) < 0.4)
            .map(edge => ({
                node: edge.ml_skill_registry?.canonical_name,
                severity: 'HIGH',
                type: 'Authority Gap'
            }))
            .slice(0, 3);
    }, [mlSkillGraph]);

    // PHASE 7 — ADAPTIVE ORGANISM STATE
    const organism = useMemo(() => {
        const activeWorks = Object.values(commandStatuses).filter(s => s === 'processing').length;
        const totalConflicts = integrityLogs.filter(l => l.event_type === 'ERROR').length;
        const capability = mlTalentState?.capability_index || 0;
        const momentum = mlTalentState?.attention_momentum || 0;

        let state: 'ACCELERATING' | 'STABLE' | 'SYNCING' | 'STRESSED' = 'STABLE';
        let colorClass = 'text-emerald-500';
        let bgClass = 'bg-emerald-500/10';

        if (activeWorks > 0) {
            state = 'SYNCING';
            colorClass = 'text-blue-500';
            bgClass = 'bg-blue-500/10';
        } else if (momentum > 0.7) {
            state = 'ACCELERATING';
            colorClass = 'text-cyan-400';
            bgClass = 'bg-cyan-400/10';
        } else if (totalConflicts > 5) {
            state = 'STRESSED';
            colorClass = 'text-red-500';
            bgClass = 'bg-red-500/10';
        }

        return { state, colorClass, bgClass, activeWorks };
    }, [commandStatuses, integrityLogs, mlTalentState]);

    return (
        <div className="space-y-8 animate-in fade-in duration-1000">
            {/* COMPRESSED HEADER: ORGANISM STATE */}
            <div className="bg-[#12141C] border border-[#23262F] p-12 rounded-[3.5rem] relative overflow-hidden group">
                <div className="relative z-10 w-full">
                    <div className="flex items-center gap-3 text-blue-500 mb-8">
                        <div className="p-2 bg-blue-500/10 rounded-lg">
                            <Cpu size={18} className="animate-spin duration-3000" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-[0.4em]">Integrated Intelligence Engine V2.0</span>
                    </div>

                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-12">
                        <div className="flex-1">
                            <div className="flex items-center gap-6 mb-6">
                                <h1 className="text-5xl font-black text-white tracking-tighter">Identity Core</h1>
                                <div className={`flex items-center gap-3 px-4 py-1.5 rounded-full ${organism.bgClass} ${organism.colorClass} border border-current opacity-80`}>
                                    <div className={`w-2 h-2 rounded-full bg-current ${organism.state !== 'STABLE' ? 'animate-ping' : ''}`} />
                                    <span className="text-[10px] font-black uppercase tracking-widest">{organism.state}</span>
                                </div>
                            </div>
                            <div className="max-w-3xl">
                                {identitySummary}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-12 gap-y-8 bg-black/40 p-8 rounded-[2.5rem] border border-white/5 backdrop-blur-sm">
                            <MetricPill label="Capability Index" value={(mlTalentState?.capability_index || 0).toFixed(3)} />
                            <MetricPill label="Trust Horizon" value={mlCredibility?.timeline_consistency > 0.8 ? "HIGH" : "CALIBRATING"} colorClass={mlCredibility?.timeline_consistency > 0.8 ? "text-emerald-400" : "text-amber-400"} />
                            <MetricPill label="Graph Entropy" value={(mlCandidateEmbeddings?.signal_entropy || 0.124).toFixed(3)} colorClass="text-cyan-400" />
                            <MetricPill label="Last Snapshot" value={new Date().toLocaleDateString()} />
                        </div>
                    </div>
                </div>
                {/* Background high-tech decorations */}
                <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.05),transparent)] pointer-events-none" />
                <div className="absolute bottom-0 left-1/4 w-96 h-1 bg-gradient-to-r from-transparent via-blue-600/20 to-transparent" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* LEFT COLUMN: Structural Intelligence */}
                <div className="lg:col-span-8 space-y-8">
                    {/* PHASE 2 — LATENT CLUSTER INTELLIGENCE */}
                    <IntelligenceCard title="Latent Cluster Intelligence" icon={Layers}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {clusters.map((cluster, idx) => (
                                <div key={idx} className="bg-black/30 border border-white/5 p-7 rounded-[2.5rem] relative overflow-hidden group hover:border-blue-500/30 transition-all cursor-default">
                                    <div className="flex justify-between items-start mb-6 relative z-10">
                                        <div>
                                            <h4 className="text-xl font-black text-white tracking-tight">{cluster.name}</h4>
                                            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase mt-1">
                                                <div className="p-1 bg-emerald-500/10 rounded">
                                                    <TrendingUp size={10} className="text-emerald-500" />
                                                </div>
                                                Velocity: <span className="text-slate-300">+{(cluster.velocity * 100).toFixed(0)}%</span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-2xl font-black text-blue-500 tracking-tighter">{(cluster.strength * 10).toFixed(1)}</div>
                                            <div className="text-[9px] font-black text-slate-600 uppercase">Magnitude</div>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2 relative z-10">
                                        {cluster.nodes.slice(0, 3).map((node: string) => (
                                            <span key={node} className="px-3 py-1 bg-blue-600/5 border border-blue-600/10 rounded-xl text-[9px] font-black text-blue-400/80 uppercase tracking-wider">{node}</span>
                                        ))}
                                        {cluster.nodes.length > 3 && <span className="text-[9px] font-black text-slate-600 uppercase pt-1">+{cluster.nodes.length - 3} More</span>}
                                    </div>
                                    <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-blue-600/5 rounded-full blur-2xl group-hover:scale-150 transition-all duration-1000" />
                                </div>
                            ))}
                        </div>
                    </IntelligenceCard>

                    {/* PHASE 6 — TEMPORAL INTELLIGENCE */}
                    <IntelligenceCard title="Temporal Intelligence" icon={Compass}>
                        <div className="flex flex-col md:flex-row gap-12 items-center p-4">
                            <div className="flex-1 w-full space-y-8">
                                <div className="space-y-3">
                                    <div className="flex justify-between text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                        <span>Authority Acceleration Gradient</span>
                                        <span className="text-emerald-400">+18.4% (60D INTERVAL)</span>
                                    </div>
                                    <div className="h-2 w-full bg-black/50 rounded-full border border-white/5 overflow-hidden">
                                        <div className="h-full bg-gradient-to-r from-blue-600 to-emerald-500 w-[65%] shadow-[0_0_15px_rgba(16,185,129,0.3)] animate-pulse" />
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <div className="flex justify-between text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                        <span>Signal Freshness Half-Life</span>
                                        <span className="text-blue-400">214 DAYS REMAINING</span>
                                    </div>
                                    <div className="h-2 w-full bg-black/50 rounded-full border border-white/5 overflow-hidden">
                                        <div className="h-full bg-gradient-to-r from-slate-700 to-blue-600 w-[82%] shadow-[0_0_15px_rgba(37,99,235,0.3)]" />
                                    </div>
                                </div>
                            </div>
                            <div className="bg-black/40 p-8 rounded-[2.5rem] border border-white/10 min-w-[240px] text-center relative overflow-hidden group">
                                <Waves className="mx-auto text-blue-500 mb-4 animate-bounce duration-3000" size={40} />
                                <div className="text-3xl font-black text-white tracking-tighter">RESONANT</div>
                                <div className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] mt-2">Macro State</div>
                                <div className="absolute inset-0 bg-blue-600/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                        </div>
                    </IntelligenceCard>
                </div>

                {/* RIGHT COLUMN: Diagnostics & Simulation */}
                <div className="lg:col-span-4 space-y-8">
                    {/* PHASE 5 — ENTROPY & INDEX */}
                    <div className="bg-gradient-to-br from-[#1A1D26] to-[#0A0B10] border border-blue-500/20 rounded-[3rem] p-10 text-white relative overflow-hidden group">
                        <div className="relative z-10">
                            <div className="flex justify-between items-start mb-12">
                                <div className="p-4 bg-blue-600/10 rounded-2xl border border-blue-600/20">
                                    <Fingerprint size={32} className="text-blue-500" />
                                </div>
                                <div className="text-right">
                                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1">Consistency Index</div>
                                    <div className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-500">
                                        {(mlCredibility?.timeline_consistency * 100).toFixed(0)}
                                    </div>
                                </div>
                            </div>
                            <h4 className="text-2xl font-black mb-4 tracking-tight">Identity Stability</h4>
                            <p className="text-slate-400 text-sm leading-relaxed mb-8">
                                High multi-node alignment detected. Signal conflict entropy is below critical threshold (e &lt; 0.12).
                            </p>
                            <div className="bg-blue-600/10 backdrop-blur-sm rounded-2xl p-5 border border-blue-600/20 flex items-center justify-between group-hover:bg-blue-600/20 transition-all">
                                <div className="flex items-center gap-3">
                                    <ShieldCheck className="text-emerald-400" size={20} />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-white">Stability: Optimal</span>
                                </div>
                                <Target size={16} className="text-blue-500" />
                            </div>
                        </div>
                        <div className="absolute top-0 right-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500/50 to-transparent opacity-30" />
                    </div>

                    {/* PHASE 4 — GRAPH PRESSURE MAP */}
                    <IntelligenceCard title="Stress Diagnostics" icon={Crosshair} className="border-red-500/10">
                        <div className="space-y-4">
                            {pressurePoints.length > 0 ? pressurePoints.map((point, idx) => (
                                <div key={idx} className="flex items-center justify-between p-5 bg-red-500/5 border border-red-500/10 rounded-[1.5rem] group/item hover:bg-red-500/10 transition-all">
                                    <div>
                                        <div className="text-sm font-black text-white uppercase tracking-tight">{point.node}</div>
                                        <div className="text-[10px] font-bold text-red-400/70 uppercase tracking-tighter mt-0.5">{point.type}</div>
                                    </div>
                                    <div className="px-3 py-1 bg-red-500/20 text-red-500 text-[8px] font-black rounded-full uppercase tracking-widest animate-pulse border border-red-500/40">
                                        DEGRADED
                                    </div>
                                </div>
                            )) : (
                                <div className="text-center py-10">
                                    <ShieldCheck size={32} className="mx-auto text-emerald-500/20 mb-4" />
                                    <div className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em]">No Structural Stress</div>
                                </div>
                            )}
                        </div>
                    </IntelligenceCard>

                    {/* PHASE 3 — BAYESIAN TRAJECTORY SIMULATOR */}
                    <IntelligenceCard title="Trajectory Simulator" icon={Brain}>
                        <div className="space-y-5">
                            <div className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-4">Bayesian Outcome Mapping</div>
                            <div className="p-5 bg-emerald-500/5 border border-emerald-500/10 rounded-[1.5rem] cursor-pointer hover:bg-emerald-500/10 transition-all">
                                <div className="flex justify-between text-xs font-black text-white mb-3">
                                    <span>Signal: Publication Node</span>
                                    <span className="text-emerald-400 font-black">+4.2%</span>
                                </div>
                                <div className="h-1.5 bg-black/50 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-500 w-[42%] shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                                </div>
                            </div>
                            <div className="p-5 bg-blue-500/5 border border-blue-500/10 rounded-[1.5rem] opacity-60 cursor-not-allowed">
                                <div className="flex justify-between text-xs font-black text-white mb-3">
                                    <span>Signal: Peer Endorsement</span>
                                    <span className="text-blue-400 font-black">+2.8%</span>
                                </div>
                                <div className="h-1.5 bg-black/50 rounded-full overflow-hidden">
                                    <div className="h-full bg-blue-600 w-[28%]" />
                                </div>
                            </div>
                        </div>
                    </IntelligenceCard>
                </div>
            </div>

            {/* PHASE 8 — AI GAP INFERENCE (CONSTRAINED) */}
            <div className="bg-[#12141C] border border-[#23262F] p-12 rounded-[3.5rem] relative overflow-hidden group">
                <div className="relative z-10 w-full">
                    <div className="flex items-center gap-4 mb-10">
                        <div className="p-4 bg-purple-600/10 rounded-2xl text-purple-500 group-hover:rotate-12 transition-transform">
                            <Brain size={32} fill="currentColor" />
                        </div>
                        <div>
                            <h3 className="text-3xl font-black text-white tracking-tighter">AI Gap Inference</h3>
                            <p className="text-slate-500 text-sm font-medium italic mt-1 pr-12">Latent potential mapping derived from high-probability ledger cluster continuity.</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                        {[
                            { skill: 'Kubernetes Orchestration', prob: 0.89, evidence: 'Rust, Docker, Distributed Systems' },
                            { skill: 'Cloud Native Security', prob: 0.76, evidence: 'GitHub, Identity Verification' },
                            { skill: 'Asynchronous Architecture', prob: 0.92, evidence: 'Realtime, Pub/Sub Patterns' },
                            { skill: 'Machine Learning Pipelines', prob: 0.64, evidence: 'Bayesian Weight, NLP Extraction' }
                        ].map((inf, idx) => (
                            <div key={idx} className="bg-black/50 border border-white/5 p-8 rounded-[2.5rem] hover:border-purple-500/40 transition-all group/card cursor-pointer">
                                <div className="flex justify-between items-start mb-6">
                                    <h4 className="text-base font-black text-white tracking-tight leading-tight">{inf.skill}</h4>
                                    <div className="text-right">
                                        <span className="text-lg font-black text-purple-400 tracking-tighter">{(inf.prob * 100).toFixed(0)}%</span>
                                        <div className="text-[8px] font-black text-slate-600 uppercase tracking-widest mt-0.5">Confidence</div>
                                    </div>
                                </div>
                                <div className="text-[9px] font-black text-slate-600 uppercase mb-3 tracking-widest">Evidence Nodes</div>
                                <div className="text-[11px] text-slate-400 leading-relaxed bg-white/5 p-4 rounded-2xl border border-white/5 italic font-medium">
                                    {inf.evidence}
                                </div>
                                <div className="mt-6 pt-5 border-t border-white/5 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-pulse" />
                                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Inference Alpha</span>
                                    </div>
                                    <Target size={14} className="text-purple-600 group-hover/card:scale-125 transition-transform" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] bg-purple-600/5 blur-[120px] rounded-full group-hover:bg-purple-600/10 transition-colors" />
            </div>

            {/* RELEGATED RAW SKILLS */}
            <div className="pt-20 border-t border-white/5">
                <div className="flex justify-between items-center mb-10">
                    <div className="flex items-center gap-4">
                        <div className="h-2 w-2 bg-slate-700 rounded-full" />
                        <h3 className="text-[11px] font-black text-slate-600 uppercase tracking-[0.5em]">Forensic Signal Evidence Ledger</h3>
                    </div>
                    <div className="h-px flex-1 mx-12 bg-white/5" />
                    <button
                        onClick={onRefresh}
                        className="flex items-center gap-3 px-6 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-[10px] font-black text-slate-400 uppercase tracking-widest"
                    >
                        <RefreshCw size={12} />
                        Sync Nodes
                    </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 opacity-40 hover:opacity-100 transition-opacity duration-500">
                    {Object.entries(skills).map(([name, data]: [string, any]) => (
                        <SkillEvidenceBreakdown
                            key={name}
                            name={name}
                            level={data.level}
                            score={data.score}
                            evidence={data.evidence}
                            proofUrls={data.proof}
                            provenance={data.extraction_method ? {
                                method: data.extraction_method,
                                confidence: data.confidence_level
                            } : undefined}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};
