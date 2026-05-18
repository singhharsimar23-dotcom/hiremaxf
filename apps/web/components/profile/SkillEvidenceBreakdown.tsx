import React from 'react';
import { LucideIcon, Code, BookOpen, Clock, Zap, Target, Shield } from 'lucide-react';

interface SkillEvidenceProps {
    name: string;
    level: string;
    score: number;
    evidence: {
        depth: number;
        breadth: number;
        recency: number;
        impact: number;
        recognition: number;
    };
    proofUrls?: string[];
    provenance?: {
        method: string;
        confidence: string;
    };
}

const ProgressBar = ({ label, value, icon: Icon, color }: { label: string, value: number, icon: LucideIcon, color: string }) => (
    <div className="flex flex-col gap-1 w-full">
        <div className="flex justify-between items-center text-[9px] font-black text-slate-500 uppercase tracking-tighter">
            <div className="flex items-center gap-1.5">
                <Icon size={10} className={color} />
                <span>{label}</span>
            </div>
            <span>{Math.round(value * 100)}%</span>
        </div>
        <div className="h-1 w-full bg-black/40 rounded-full overflow-hidden">
            <div
                className={`h-full ${color.replace('text', 'bg')} transition-all duration-700 shadow-[0_0_8px_rgba(var(--tw-shadow-color),0.5)]`}
                style={{ width: `${value * 100}%` }}
            />
        </div>
    </div>
);

export const SkillEvidenceBreakdown: React.FC<SkillEvidenceProps> = ({
    name = 'Unknown Skill',
    level = 'Beginner',
    score = 0,
    evidence: evidenceProp,
    proofUrls = [],
    provenance
}) => {
    const evidence = evidenceProp || { depth: 0, breadth: 0, recency: 0, impact: 0, recognition: 0 };
    return (
        <div className="p-6 rounded-3xl bg-[#0A0B10] border border-[#23262F] hover:border-blue-500/40 transition-all group relative overflow-hidden">
            <div className="relative z-10">
                <div className="flex justify-between items-start mb-5">
                    <div className="max-w-[70%]">
                        <h3 className="text-base font-black text-white group-hover:text-blue-400 transition-colors tracking-tight truncate">{name}</h3>
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                            <span className="text-[9px] font-black px-2 py-0.5 rounded bg-blue-600/10 text-blue-400 uppercase tracking-widest border border-blue-600/20">
                                {level}
                            </span>
                            {provenance && (
                                <span className="text-[9px] font-black px-2 py-0.5 rounded bg-white/5 text-slate-400 uppercase tracking-widest border border-white/10">
                                    {provenance.method}:{provenance.confidence}
                                </span>
                            )}
                        </div>
                    </div>
                    {proofUrls && proofUrls.length > 0 && (
                        <div className="flex gap-1.5">
                            {proofUrls.map((url, i) => (
                                <a
                                    key={i}
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-2 rounded-xl bg-black border border-white/5 text-slate-500 hover:text-white hover:border-blue-500/50 transition-all"
                                    title={`View Proof #${i + 1}`}
                                >
                                    <Code size={12} />
                                </a>
                            ))}
                        </div>
                    )}
                </div>

                <div className="space-y-4">
                    <ProgressBar label="Structural Depth" value={evidence.depth} icon={Target} color="text-emerald-400" />
                    <ProgressBar label="Domain Breadth" value={evidence.breadth} icon={BookOpen} color="text-blue-400" />
                    <ProgressBar label="Temporal Recency" value={evidence.recency} icon={Clock} color="text-amber-400" />
                    <ProgressBar label="Impact Factor" value={evidence.impact} icon={Zap} color="text-purple-400" />
                    <ProgressBar label="Peer Recognition" value={evidence.recognition} icon={Shield} color="text-cyan-400" />
                </div>

                <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between">
                    <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Authority Persistence</span>
                    <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className={`w-1 h-3 rounded-full ${i <= Math.ceil(score * 5) ? 'bg-blue-600 shadow-[0_0_5px_rgba(37,99,235,0.5)]' : 'bg-white/5'}`} />
                        ))}
                    </div>
                </div>
            </div>
            {/* Background glow for the group hover */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-600/0 group-hover:bg-blue-600/5 blur-3xl transition-all rounded-full" />
        </div>
    );
};
