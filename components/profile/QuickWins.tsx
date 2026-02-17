import React from 'react';
import { Zap, Clock, ArrowUpRight } from 'lucide-react';

interface QuickWin {
    title: string;
    impact: number;
    timeEstimate: string;
    action: string;
    onAction: () => void;
}

interface QuickWinsProps {
    wins: QuickWin[];
}

export const QuickWins: React.FC<QuickWinsProps> = ({ wins }) => {
    if (wins.length === 0) return null;

    return (
        <div className="p-6 rounded-2xl bg-blue-500/5 border border-blue-500/10 shadow-lg shadow-blue-500/5">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400">
                    <Zap size={20} fill="currentColor" />
                </div>
                <div>
                    <h3 className="text-lg font-black text-white uppercase tracking-tight italic">
                        Quick Wins - Boost Your Profile in &lt;30 Minutes
                    </h3>
                    <p className="text-sm text-slate-400">High-impact actions with low implementation effort.</p>
                </div>
            </div>

            <div className="space-y-3">
                {wins.map((win, i) => (
                    <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-blue-500/40 transition-all group">
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-blue-400 font-black text-lg">+{win.impact}</span>
                                <h4 className="font-bold text-slate-200">{win.title}</h4>
                            </div>
                            <div className="flex items-center gap-3 text-[11px] text-slate-500 font-bold uppercase tracking-wider">
                                <div className="flex items-center gap-1">
                                    <Clock size={10} />
                                    {win.timeEstimate}
                                </div>
                                <div className="w-1 h-1 rounded-full bg-slate-700" />
                                <span>{win.action}</span>
                            </div>
                        </div>
                        <button
                            onClick={win.onAction}
                            className="ml-4 px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-black uppercase tracking-widest hover:bg-blue-500 hover:scale-105 active:scale-95 transition-all shadow-lg shadow-blue-600/20 flex items-center gap-2"
                        >
                            Start
                            <ArrowUpRight size={14} />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};
