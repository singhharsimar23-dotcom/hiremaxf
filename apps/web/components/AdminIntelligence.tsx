import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { isAdminUser } from '../lib/admin';
import { Brain, Save, History, AlertTriangle, CheckCircle2, Loader2, ArrowRight, Target, Zap } from 'lucide-react';

interface WeightDefinition {
    id: string;
    name: string;
    description: string;
    default_value: number;
    min_bound: number;
    max_bound: number;
}

interface WeightSet {
    id: string;
    version: number;
    weights: Record<string, number>;
    status: string;
    deployed_at: string;
}

export const AdminIntelligence: React.FC = () => {
    const [authorized, setAuthorized] = useState<boolean | null>(null);
    const [definitions, setDefinitions] = useState<WeightDefinition[]>([]);
    const [currentSet, setCurrentSet] = useState<WeightSet | null>(null);
    const [history, setHistory] = useState<WeightSet[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Form state corresponding to definitions
    const [formWeights, setFormWeights] = useState<Record<string, number>>({});

    // Optimization state
    const [optResult, setOptResult] = useState<any>(null);
    const [runningOpt, setRunningOpt] = useState(false);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const { data: defs } = await supabase.from('scoring_weights_definitions').select('*').order('name');
            setDefinitions(defs || []);

            const { data: active } = await supabase
                .from('scoring_weight_sets')
                .select('*')
                .eq('status', 'ACTIVE')
                .order('version', { ascending: false })
                .limit(1)
                .maybeSingle();

            setCurrentSet(active);
            if (active) {
                setFormWeights(active.weights);
            } else {
                const defaults: Record<string, number> = {};
                defs?.forEach(d => defaults[d.name] = d.default_value);
                setFormWeights(defaults);
            }

            const { data: hist } = await supabase
                .from('scoring_weight_sets')
                .select('*')
                .order('version', { ascending: false })
                .limit(10);
            setHistory(hist || []);
        } catch (error) {
            console.error("Error fetching intelligence data:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        supabase.auth.getUser().then(({ data: { user } }) => {
            setAuthorized(isAdminUser(user?.email));
        });
    }, []);

    useEffect(() => {
        if (authorized) fetchData();
    }, [authorized, fetchData]);

    if (authorized === null) {
        return (
            <div className="flex items-center justify-center min-h-[40vh]">
                <Loader2 className="animate-spin text-blue-400" />
            </div>
        );
    }

    if (!authorized) {
        return (
            <div className="max-w-lg mx-auto mt-24 text-center px-6">
                <AlertTriangle className="mx-auto text-amber-400 mb-4" size={32} />
                <h2 className="text-xl font-bold text-white mb-2">Access denied</h2>
                <p className="text-slate-400 text-sm">This area is restricted to administrators.</p>
            </div>
        );
    }

    const handleWeightChange = (name: string, value: string) => {
        const numVal = parseFloat(value);
        if (!isNaN(numVal)) {
            setFormWeights(prev => ({ ...prev, [name]: numVal }));
        }
    };

    const handleDeployNewVersion = async () => {
        setSaving(true);
        try {
            // 1. Get next version number
            const nextVersion = (currentSet?.version || 0) + 1;

            // 2. Insert new weight set
            const { error } = await supabase.from('scoring_weight_sets').insert({
                version: nextVersion,
                weights: formWeights,
                status: 'ACTIVE', // Auto-deploy for now (Phase 1)
                parent_weight_set_id: currentSet?.id,
                deployed_at: new Date().toISOString()
            });

            if (error) throw error;

            // 3. Mark old one as ARCHIVED (optional, or just rely on deployed_at sort)
            if (currentSet) {
                await supabase.from('scoring_weight_sets').update({ status: 'ARCHIVED' }).eq('id', currentSet.id);
            }

            await fetchData(); // Refresh UI
            alert(`Successfully deployed Intelligence Engine v${nextVersion}`);

        } catch (error: any) {
            alert(`Failed to deploy: ${error.message}`);
        } finally {
            setSaving(false);
        }
    };

    const handleRunOptimization = async () => {
        setRunningOpt(true);
        try {
            const { data, error } = await supabase.functions.invoke('optimize-weights');
            if (error) throw error;
            setOptResult(data);
            if (data.candidate_version) {
                // Refresh history to show the new CANDIDATE set
                fetchData();
            }
        } catch (err: any) {
            console.error("Optimization failed:", err);
            alert("Optimization failed: " + err.message);
        } finally {
            setRunningOpt(false);
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center min-h-screen bg-[#0A0B10]">
            <Loader2 className="animate-spin text-blue-500" size={32} />
        </div>
    );

    return (
        <div className="min-h-screen bg-[#0A0B10] text-slate-200 p-8">
            <div className="max-w-6xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex justify-between items-center">
                    <div>
                        <div className="flex items-center gap-3 text-blue-400 mb-2">
                            <Brain size={24} />
                            <span className="font-bold tracking-widest uppercase text-sm">HireMax Intelligence Engine</span>
                        </div>
                        <h1 className="text-3xl font-black text-white">Weight Management Console</h1>
                        <p className="text-slate-500 mt-1">Configure the mathematical logic driving profile scoring.</p>
                    </div>
                    <div className="text-right">
                        <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Active Version</div>
                        <div className="text-2xl font-black text-emerald-400">v{currentSet?.version || 1}.0</div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Main Config Panel */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-[#12141C] border border-[#23262F] rounded-2xl p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                    <Target size={20} className="text-blue-500" />
                                    Global Scoring Weights
                                </h2>
                                {saving ? (
                                    <div className="flex items-center gap-2 text-blue-400 text-sm font-bold animate-pulse">
                                        <Loader2 size={16} className="animate-spin" />
                                        Deploying v{(currentSet?.version || 0) + 1}...
                                    </div>
                                ) : (
                                    <button
                                        onClick={handleDeployNewVersion}
                                        className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2"
                                    >
                                        <Save size={16} />
                                        Deploy Changes
                                    </button>
                                )}
                            </div>

                            <div className="space-y-6">
                                {definitions.map(def => {
                                    const val = formWeights[def.name] ?? def.default_value;
                                    const isModified = val !== (currentSet?.weights[def.name] ?? def.default_value);

                                    return (
                                        <div key={def.id} className="group">
                                            <div className="flex justify-between mb-2">
                                                <label className="text-sm font-bold text-slate-300 block">
                                                    {def.name.replace(/_/g, ' ').toUpperCase()}
                                                </label>
                                                <span className={`text-sm font-mono ${isModified ? 'text-amber-400' : 'text-slate-500'}`}>
                                                    {(val || 0).toFixed(2)}
                                                </span>
                                            </div>
                                            <div className="relative">
                                                <input
                                                    type="range"
                                                    min={def.min_bound}
                                                    max={def.max_bound}
                                                    step={0.1}
                                                    value={val}
                                                    onChange={(e) => handleWeightChange(def.name, e.target.value)}
                                                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                                />
                                            </div>
                                            <div className="flex justify-between mt-1 text-[10px] text-slate-600 font-bold uppercase tracking-widest">
                                                <span>Min: {def.min_bound}</span>
                                                <span>Max: {def.max_bound}</span>
                                            </div>
                                            <p className="text-xs text-slate-500 mt-2 group-hover:text-slate-400 transition-colors">
                                                {def.description}
                                            </p>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>



                        // ... existing render ...

                    {/* Sidebar / History */}
                    <div className="space-y-6">
                        {/* Optimization Control Panel */}
                        <div className="bg-gradient-to-br from-blue-900/20 to-purple-900/20 border border-blue-500/20 rounded-2xl p-6">
                            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <Brain size={18} className="text-blue-400" />
                                Active Learning
                            </h3>

                            <p className="text-xs text-slate-400 mb-4">
                                Trigger the gradient descent algorithm to analyze recent outcomes and propose optimized weights.
                            </p>

                            <button
                                onClick={handleRunOptimization}
                                disabled={runningOpt}
                                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 mb-4"
                            >
                                {runningOpt ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
                                {runningOpt ? 'Learning...' : 'Run Learning Loop'}
                            </button>

                            {optResult && (
                                <div className="space-y-2 text-xs bg-[#0F1117] p-3 rounded-lg border border-slate-800">
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">Samples</span>
                                        <span className="text-slate-200">{optResult.samples || 0}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">MSE</span>
                                        <span className={`font-mono ${optResult.mse > 1000 ? 'text-red-400' : 'text-emerald-400'}`}>
                                            {Math.round(optResult.mse || 0)}
                                        </span>
                                    </div>
                                    {optResult.candidate_version && (
                                        <div className={`mt-2 pt-2 border-t border-slate-800 text-center font-bold ${optResult.auto_promoted ? 'text-blue-400' : 'text-emerald-400'}`}>
                                            {optResult.auto_promoted
                                                ? `Auto-Promoted v${optResult.candidate_version} to Active`
                                                : `New Candidate v${optResult.candidate_version} Created`
                                            }
                                        </div>
                                    )}
                                    {optResult.message && (
                                        <div className="mt-2 text-amber-500 text-center">
                                            {optResult.message}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="bg-[#12141C] border border-[#23262F] rounded-2xl p-6">
                            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <History size={18} className="text-slate-400" />
                                Deployment History
                            </h3>
                            <div className="space-y-4">
                                {history.map(set => (
                                    <div key={set.id} className={`p-4 rounded-xl border ${set.status === 'ACTIVE' ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-slate-900 border-slate-800'}`}>
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="font-bold text-white">v{set.version}.0</div>
                                            <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-widest ${set.status === 'ACTIVE'
                                                ? 'bg-emerald-500 text-black'
                                                : 'bg-slate-800 text-slate-500'
                                                }`}>
                                                {set.status}
                                            </span>
                                        </div>
                                        <div className="text-xs text-slate-500 mb-3">
                                            Deployed {new Date(set.deployed_at).toLocaleDateString()}
                                        </div>
                                        {/* Sample key stats */}
                                        <div className="grid grid-cols-2 gap-2 text-[10px]">
                                            <div className="text-slate-400">Work: <span className="text-slate-200">{set.weights.work_experience_weight}</span></div>
                                            <div className="text-slate-400">Skills: <span className="text-slate-200">{set.weights.skills_weight}</span></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-6">
                            <h3 className="text-sm font-bold text-amber-500 mb-2 flex items-center gap-2">
                                <AlertTriangle size={16} />
                                Intelligence Warning
                            </h3>
                            <p className="text-xs text-amber-200/70 leading-relaxed">
                                Manually deploying weights overrides the automated learning loop.
                                Ensure you have validated these parameters against historical data before deploying to production.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
