import React from 'react';
import { AlertTriangle, TrendingDown, ArrowRight } from 'lucide-react';

interface DecayingSignal {
    name: string;
    previousWeight: number;
    currentWeight: number;
    issue: string;
    impact: number;
    fixAction: string;
}

interface DecayingSignalsProps {
    signals: DecayingSignal[];
    onStartFix: (signal: DecayingSignal) => void;
}

export const DecayingSignalsWidget: React.FC<DecayingSignalsProps> = ({ signals, onStartFix }) => {
    if (signals.length === 0) return null;

    return (
        <div className="p-6 rounded-2xl bg-amber-500/5 border border-amber-500/20 shadow-lg shadow-amber-500/5">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-amber-500/20 text-amber-500 animate-pulse">
                    <AlertTriangle size={20} />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-white uppercase tracking-tight">
                        Attention: {signals.length} {signals.length === 1 ? 'signal is' : 'signals are'} decaying rapidly
                    </h3>
                    <p className="text-sm text-slate-400">Professional signals lose authority without recent evidence.</p>
                </div>
            </div>

            <div className="space-y-4">
                {signals.map((signal, i) => (
                    <div key={i} className="group p-4 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-amber-500/30 transition-all">
                        <div className="flex justify-between items-start mb-3">
                            <div className="flex items-center gap-2">
                                <TrendingDown size={14} className="text-amber-500" />
                                <span className="font-semibold text-slate-200">{signal.name} skill</span>
                            </div>
                            <div className="text-right">
                                <div className="text-xs text-slate-500 font-medium">Weight Shift</div>
                                <div className="text-sm font-bold text-slate-300">
                                    {signal.previousWeight.toFixed(2)} → <span className="text-amber-400">{signal.currentWeight.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div className="p-2.5 rounded-lg bg-slate-800/50">
                                <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Issue</div>
                                <div className="text-xs text-slate-300 leading-relaxed font-medium">{signal.issue}</div>
                            </div>
                            <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/10">
                                <div className="text-[10px] text-rose-400 uppercase font-bold tracking-wider mb-1">Impact</div>
                                <div className="text-xs text-rose-300 font-bold">-{signal.impact} profile strength points</div>
                            </div>
                        </div>

                        <button
                            onClick={() => onStartFix(signal)}
                            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-slate-800 text-white text-sm font-bold hover:bg-amber-500 hover:text-black transition-all group-hover:shadow-md"
                        >
                            <span>Fix: {signal.fixAction}</span>
                            <ArrowRight size={14} />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};
