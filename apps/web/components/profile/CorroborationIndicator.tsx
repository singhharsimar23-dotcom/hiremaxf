import React from 'react';
import { CheckCircle2, ShieldCheck, Info } from 'lucide-react';

interface Source {
    name: string;
    authority: number;
}

interface CorroborationProps {
    sources: Source[];
    trustScore: number;
    isVerified: boolean;
}

export const CorroborationIndicator: React.FC<CorroborationProps> = ({ sources, trustScore, isVerified }) => {
    const confidenceLevel = sources.length >= 3 ? 'HIGH' : sources.length === 2 ? 'MEDIUM' : 'LOW';
    const confidenceColor = sources.length >= 3 ? 'text-emerald-400' : sources.length === 2 ? 'text-blue-400' : 'text-slate-400';

    return (
        <div className="mt-3 p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-sm">
            <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                    <div className="flex -space-x-1.5">
                        {sources.map((_, i) => (
                            <div key={i} className={`w-5 h-5 rounded-full border-2 border-slate-900 flex items-center justify-center bg-emerald-500/20 ${confidenceColor}`}>
                                <CheckCircle2 size={12} />
                            </div>
                        ))}
                    </div>
                    <span className={`text-xs font-bold uppercase tracking-widest ${confidenceColor}`}>
                        {confidenceLevel} NODE CONSENSUS
                    </span>
                    <span className="text-xs text-slate-500 font-medium">({sources.length} nodes)</span>
                </div>
                {isVerified && (
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/20">
                        <ShieldCheck size={10} />
                        FORENSIC
                    </div>
                )}
            </div>

            <div className="space-y-2.5 mb-4">
                {sources.map((source, i) => (
                    <div key={i} className="flex justify-between items-center text-xs">
                        <div className="flex items-center gap-2 text-slate-300">
                            <div className="w-1.5 h-1.5 rounded-full bg-slate-700" />
                            <span className="font-semibold">{source.name}</span>
                        </div>
                        <span className="font-bold text-slate-500">{(source.authority * 100).toFixed(0)}% Authority</span>
                    </div>
                ))}
            </div>

            <div className="pt-3 border-t border-slate-800/50 flex justify-between items-center">
                <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium italic">
                    <Info size={12} className="text-slate-500" />
                    Trust Score Calculation
                </div>
                <div className="text-sm font-bold text-slate-200">
                    {(trustScore).toFixed(2)} / 1.00
                </div>
            </div>
        </div>
    );
};
