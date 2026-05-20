import { useState, useEffect } from 'react';
import { Sparkles, X, ChevronRight, Play, Loader2, CheckCircle, Target, Zap, ShieldCheck, AlertTriangle, ArrowRight, Brain } from 'lucide-react';

declare const chrome: any;

interface ValidationItem {
    fieldName: string;
    status: 'ok' | 'empty' | 'not_found' | 'missing_file' | 'mismatch';
    required: boolean;
}

interface OverlayContext {
    confidence: number;
    title: string;
    match_reason: string;
    field_count: number;
    platform?: string;
    local_resolved?: number;
}

type OverlayState = 'HIDDEN' | 'MINIMIZED' | 'EXPANDED' | 'RUNNING' | 'SUCCESS' | 'VALIDATION' | 'MULTI_STEP' | 'REVIEW_REQUIRED';

export default function Overlay() {
    const [s, setS] = useState<OverlayState>('HIDDEN');
    const [ctx, setCtx] = useState<OverlayContext | null>(null);
    const [progress, setProgress] = useState(0);
    const [statusLabel, setStatusLabel] = useState('Initializing...');
    const [validationResults, setValidationResults] = useState<ValidationItem[]>([]);
    const [filledCount, setFilledCount] = useState(0);
    const [failedFields, setFailedFields] = useState<any[]>([]);

    useEffect(() => {
        const listener = (msg: any) => {
            switch (msg.type) {
                case 'SHOW_OVERLAY':
                    setCtx(msg.context);
                    setS('MINIMIZED');
                    setProgress(0);
                    setValidationResults([]);
                    break;

                case 'EXECUTION_STARTED':
                    setS('RUNNING');
                    setProgress(10);
                    setStatusLabel('Scanning form fields...');
                    break;

                case 'FIELD_FILLED':
                    setProgress(prev => Math.min(prev + 12, 88));
                    setStatusLabel(
                        msg.details?.intent === 'custom_question'
                            ? `AI answering: "${msg.details?.field}"...`
                            : `Filling: ${msg.details?.field}...`
                    );
                    break;

                case 'NEXT_STEP_NAVIGATED':
                    setS('MULTI_STEP');
                    setStatusLabel('Moving to next step...');
                    setTimeout(() => {
                        setS('RUNNING');
                        setProgress(10);
                        setStatusLabel('Scanning next step...');
                    }, 1800);
                    break;

                case 'VALIDATION_RESULTS':
                    setValidationResults(msg.results || []);
                    break;

                case 'REVIEW_REQUIRED':
                    setS('REVIEW_REQUIRED');
                    setStatusLabel(msg.message || 'Please review before submitting.');
                    break;

                case 'EXECUTION_COMPLETE':
                    setS('SUCCESS');
                    setProgress(100);
                    setFilledCount(msg.filledCount || 0);
                    setStatusLabel('All fields filled');
                    break;

                case 'EXECUTION_FAILED':
                    setS('VALIDATION');
                    setProgress(100);
                    setFailedFields(msg.failedFields || []);
                    setStatusLabel(msg.message || 'Some fields need attention');
                    break;
            }
        };
        chrome.runtime.onMessage.addListener(listener);
        return () => chrome.runtime.onMessage.removeListener(listener);
    }, []);

    if (s === 'HIDDEN') return null;

    const platformBadge = ctx?.platform ? (
        <span className="text-[9px] font-bold uppercase tracking-widest bg-blue-500/20 text-blue-300 border border-blue-500/20 rounded px-1.5 py-0.5">
            {ctx.platform}
        </span>
    ) : null;

    return (
        <div className="font-sans antialiased text-white p-4 pointer-events-auto select-none">

            {/* Minimized Pill */}
            {s === 'MINIMIZED' && (
                <div
                    className="flex items-center space-x-3 bg-[#161B2E]/90 backdrop-blur-md border border-blue-500/40 rounded-full px-5 py-2.5 shadow-[0_0_20px_rgba(59,130,246,0.2)] cursor-pointer hover:scale-105 transition-all duration-300 animate-in slide-in-from-bottom-10 fade-in group"
                    onClick={() => setS('EXPANDED')}
                >
                    <div className="relative">
                        <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-cyan-400 rounded-full opacity-70 blur group-hover:opacity-100 transition-opacity animate-pulse" />
                        <div className="relative bg-[#0F1117] rounded-full p-2">
                            <Sparkles className="w-4 h-4 text-blue-400" />
                        </div>
                    </div>
                    <div className="flex flex-col pr-2">
                        <div className="flex items-center space-x-2">
                            <span className="text-[11px] font-black uppercase tracking-wider text-white">HireMax</span>
                            {platformBadge}
                        </div>
                        <div className="flex items-center space-x-2">
                            <span className="text-[10px] text-blue-300">{Math.round((ctx?.confidence || 0.98) * 100)}% Match</span>
                            <span className="w-1 h-1 rounded-full bg-blue-500/50" />
                            <span className="text-[10px] text-cyan-400 font-bold">{ctx?.field_count || 0} Fields</span>
                            {(ctx?.local_resolved ?? 0) > 0 && (
                                <>
                                    <span className="w-1 h-1 rounded-full bg-blue-500/50" />
                                    <span className="text-[10px] text-green-400">{ctx?.local_resolved} local</span>
                                </>
                            )}
                        </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-blue-500/50" />
                </div>
            )}

            {/* Expanded Card */}
            {s === 'EXPANDED' && (
                <div className="w-[320px] bg-[#0F1117] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                    <div className="h-1 bg-gradient-to-r from-blue-600 via-cyan-400 to-blue-600" />
                    <div className="p-5">
                        <div className="flex justify-between items-start mb-5">
                            <div className="flex items-center space-x-2">
                                <Zap className="w-4 h-4 text-cyan-400 fill-cyan-400/20" />
                                <h3 className="font-bold text-sm tracking-tight text-white">Execution Ready</h3>
                                {platformBadge}
                            </div>
                            <button onClick={() => setS('MINIMIZED')} className="text-slate-500 hover:text-white transition-colors p-1 hover:bg-white/5 rounded">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="bg-[#161B2E] border border-white/5 rounded-xl p-3 mb-5 space-y-2.5">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Context</span>
                                <span className="text-[10px] font-medium text-white max-w-[160px] truncate">{ctx?.title}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-1.5">
                                    <Target className="w-3 h-3 text-blue-400" />
                                    <span className="text-[11px] text-slate-300">Identity Match</span>
                                </div>
                                <span className="text-[11px] text-green-400 font-bold flex items-center">
                                    <ShieldCheck className="w-3 h-3 mr-1" /> VERIFIED
                                </span>
                            </div>
                            {(ctx?.local_resolved ?? 0) > 0 && (
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-1.5">
                                        <Brain className="w-3 h-3 text-purple-400" />
                                        <span className="text-[11px] text-slate-300">Local Ontology</span>
                                    </div>
                                    <span className="text-[11px] text-purple-300 font-bold">
                                        {ctx?.local_resolved}/{ctx?.field_count} instant
                                    </span>
                                </div>
                            )}
                        </div>

                        <button
                            onClick={() => {
                                setS('RUNNING');
                                chrome.runtime.sendMessage({ type: "START_EXECUTION" });
                            }}
                            className="w-full group relative flex items-center justify-center space-x-3 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-bold transition-all shadow-lg shadow-blue-600/20 active:scale-95 overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                            <Play className="w-4 h-4 fill-white" />
                            <span className="text-sm">Initiate Autonomous Fill</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Running State */}
            {(s === 'RUNNING' || s === 'MULTI_STEP') && (
                <div className="w-[300px] bg-[#0F1117] border border-blue-500/30 rounded-2xl shadow-2xl p-5 overflow-hidden">
                    <div className="flex items-center space-x-4 mb-4">
                        <div className="relative">
                            <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                            <Sparkles className="absolute inset-0 m-auto w-3 h-3 text-cyan-300 animate-pulse" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-sm font-black text-white uppercase tracking-tighter italic">
                                {s === 'MULTI_STEP' ? 'Next Step' : 'Filling Form'}
                            </div>
                            <div className="text-[10px] text-blue-300 font-bold animate-pulse truncate">{statusLabel}</div>
                        </div>
                    </div>
                    <div className="h-1 w-full bg-blue-900/50 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-blue-600 to-cyan-400 transition-all duration-500 ease-out shadow-[0_0_10px_rgba(34,211,238,0.5)]"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Review Required — Before Multi-Step Submit */}
            {s === 'REVIEW_REQUIRED' && (
                <div className="w-[300px] bg-[#0F1117] border border-yellow-500/30 rounded-2xl shadow-2xl p-5 animate-in zoom-in-95 duration-300">
                    <div className="flex items-center space-x-3 mb-3">
                        <div className="bg-yellow-500/20 p-2 rounded-full">
                            <AlertTriangle className="w-5 h-5 text-yellow-400" />
                        </div>
                        <div>
                            <div className="text-sm font-black text-white">Review Before Submit</div>
                            <div className="text-[10px] text-yellow-300">All fields filled. Human review required.</div>
                        </div>
                    </div>
                    <div className="text-[11px] text-slate-400 bg-white/5 rounded-lg p-2.5 italic border border-white/5">
                        {statusLabel}
                    </div>
                    <button onClick={() => setS('HIDDEN')} className="mt-3 w-full text-[11px] text-slate-400 hover:text-white transition-colors">
                        Dismiss
                    </button>
                </div>
            )}

            {/* Validation State — Fields Need Attention */}
            {s === 'VALIDATION' && (
                <div className="w-[320px] bg-[#0F1117] border border-orange-500/30 rounded-2xl shadow-2xl p-5 animate-in zoom-in-95 duration-300">
                    <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center space-x-2">
                            <AlertTriangle className="w-4 h-4 text-orange-400" />
                            <span className="text-sm font-black text-white">Action Required</span>
                        </div>
                        <button onClick={() => setS('HIDDEN')} className="text-slate-500 hover:text-white p-0.5">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    <p className="text-[11px] text-orange-300 mb-3">{statusLabel}</p>
                    <div className="space-y-1.5 max-h-[150px] overflow-y-auto">
                        {failedFields.slice(0, 6).map((f: any, i) => (
                            <div key={i} className="flex items-center justify-between bg-white/5 rounded-lg px-2.5 py-1.5">
                                <span className="text-[10px] text-white truncate max-w-[160px]">{f.fieldName}</span>
                                <span className={`text-[9px] font-bold uppercase ${f.status === 'empty' ? 'text-orange-400' : f.status === 'not_found' ? 'text-red-400' : 'text-yellow-400'}`}>
                                    {f.status?.replace('_', ' ')}
                                </span>
                            </div>
                        ))}
                    </div>
                    <button onClick={() => setS('HIDDEN')} className="mt-3 w-full text-[11px] text-slate-500 hover:text-white transition-colors">
                        Dismiss — I'll fix manually
                    </button>
                </div>
            )}

            {/* Success State */}
            {s === 'SUCCESS' && (
                <div className="w-[300px] bg-[#0F1117] border border-green-500/30 rounded-2xl shadow-2xl p-5 animate-in slide-in-from-right duration-500">
                    <div className="flex items-center space-x-4 mb-4">
                        <div className="bg-green-500/20 p-2 rounded-full">
                            <CheckCircle className="w-6 h-6 text-green-500" />
                        </div>
                        <div className="flex-1">
                            <div className="text-sm font-black text-white uppercase tracking-wider">Mission Complete</div>
                            <div className="text-[10px] text-green-300 font-bold">{filledCount} fields filled · Resume injected</div>
                        </div>
                        <button onClick={() => setS('HIDDEN')} className="p-1 hover:bg-white/5 rounded transition-colors">
                            <X className="w-4 h-4 text-slate-500" />
                        </button>
                    </div>
                    <div className="text-[11px] text-slate-400 bg-white/5 rounded-lg p-3 border border-white/5 italic">
                        Please review all fields before clicking Submit. HireMax has handled the heavy lifting.
                    </div>
                    {validationResults.filter(v => v.status !== 'ok').length > 0 && (
                        <div className="mt-3 space-y-1">
                            <div className="flex items-center space-x-1.5 mb-1.5">
                                <ArrowRight className="w-3 h-3 text-yellow-400" />
                                <span className="text-[10px] text-yellow-400 font-bold">Minor items to review:</span>
                            </div>
                            {validationResults.filter(v => v.status !== 'ok').slice(0, 3).map((v, i) => (
                                <div key={i} className="text-[10px] text-slate-400 flex justify-between bg-white/5 rounded px-2 py-1">
                                    <span className="truncate max-w-[160px]">{v.fieldName}</span>
                                    <span className="text-yellow-500">{v.status}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

        </div>
    );
}
