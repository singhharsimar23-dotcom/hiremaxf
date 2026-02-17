import { useState, useEffect } from 'react';
import { Sparkles, X, ChevronRight, Play, Loader2, CheckCircle } from 'lucide-react';

declare const chrome: any;


export default function Overlay() {
    const [s, setS] = useState<'HIDDEN' | 'MINIMIZED' | 'EXPANDED' | 'RUNNING' | 'SUCCESS'>('HIDDEN');
    const [ctx, setCtx] = useState<any>(null);

    useEffect(() => {
        // Listen for events
        const listener = (msg: any) => {
            if (msg.type === 'SHOW_OVERLAY') {
                setCtx(msg.context);
                setS('MINIMIZED');
            }
            if (msg.type === 'EXECUTION_STARTED') {
                setS('RUNNING');
            }
            if (msg.type === 'EXECUTION_COMPLETE') {
                setS('SUCCESS');
            }
        };
        chrome.runtime.onMessage.addListener(listener);
        return () => chrome.runtime.onMessage.removeListener(listener);
    }, []);

    if (s === 'HIDDEN') return null;

    return (
        <div className="font-sans antialiased text-white p-4 pointer-events-auto">

            {/* Minimized Pill */}
            {s === 'MINIMIZED' && (
                <div
                    className="flex items-center space-x-3 bg-[#161B2E] border border-blue-500/30 rounded-full px-4 py-2 shadow-2xl cursor-pointer hover:scale-105 transition-transform animate-in slide-in-from-bottom-10 fade-in duration-500"
                    onClick={() => setS('EXPANDED')}
                >
                    <div className="relative">
                        <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-cyan-500 rounded-full opacity-75 blur animate-pulse"></div>
                        <div className="relative bg-[#0F1117] rounded-full p-1.5">
                            <Sparkles className="w-4 h-4 text-blue-400" />
                        </div>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-xs font-bold text-white">HireMax Detected</span>
                        <span className="text-[10px] text-blue-300">{(ctx?.confidence || 0.95) * 100}% Confidence Match</span>
                    </div>
                    <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center">
                        <ChevronRight className="w-3 h-3 text-white/50" />
                    </div>
                </div>
            )}

            {/* Expanded Card */}
            {s === 'EXPANDED' && (
                <div className="w-[300px] bg-[#161B2E]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                    <div className="h-1 bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-500 animate-gradient"></div>
                    <div className="p-4">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="font-bold text-sm text-white">Ready to Auto-Fill</h3>
                                <p className="text-xs text-slate-400 mt-0.5">{ctx?.title || 'Job Application'}</p>
                            </div>
                            <button onClick={() => setS('MINIMIZED')} className="text-slate-500 hover:text-white">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="space-y-2 mb-4">
                            <div className="flex items-center justify-between text-xs p-2 bg-white/5 rounded-lg border border-white/5">
                                <span className="text-slate-400">Strategy</span>
                                <span className="text-cyan-300 font-mono">Heuristic v2</span>
                            </div>
                            <div className="flex items-center justify-between text-xs p-2 bg-white/5 rounded-lg border border-white/5">
                                <span className="text-slate-400">Risk Level</span>
                                <span className="text-green-400 font-bold">LOW</span>
                            </div>
                        </div>

                        <button
                            onClick={() => {
                                setS('RUNNING');
                                // Trigger content script
                                // @ts-ignore
                                chrome.runtime.sendMessage({ type: "START_EXECUTION" });
                            }}
                            className="w-full flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-lg font-medium transition-colors group"
                        >
                            <Play className="w-4 h-4 fill-white group-hover:scale-110 transition-transform" />
                            <span>Start Filling</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Running State */}
            {s === 'RUNNING' && (
                <div className="w-[280px] bg-[#161B2E]/95 backdrop-blur-xl border border-blue-500/30 rounded-xl shadow-2xl p-4 animate-pulse">
                    <div className="flex items-center space-x-3">
                        <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                        <div className="flex-1">
                            <div className="text-sm font-bold text-white">Filling Application...</div>
                            <div className="text-xs text-blue-300/80">Keep this tab open</div>
                        </div>
                    </div>
                </div>
            )}

            {/* Success State */}
            {s === 'SUCCESS' && (
                <div className="w-[280px] bg-[#161B2E]/95 backdrop-blur-xl border border-green-500/30 rounded-xl shadow-2xl p-4 animate-in slide-in-from-right duration-300">
                    <div className="flex items-center space-x-3">
                        <CheckCircle className="w-6 h-6 text-green-500" />
                        <div className="flex-1">
                            <div className="text-sm font-bold text-white">Done!</div>
                            <div className="text-xs text-green-300/80">Please review before submitting.</div>
                        </div>
                        <button onClick={() => setS('HIDDEN')}><X className="w-4 h-4 text-slate-500" /></button>
                    </div>
                </div>
            )}

        </div>
    );
}
