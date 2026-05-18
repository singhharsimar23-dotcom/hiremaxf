import React, { useMemo, useState } from 'react';
import {
    Shield,
    AlertTriangle,
    CheckCircle2,
    XCircle,
    Fingerprint,
    Scale,
    RotateCcw,
    Zap,
    TrendingUp,
    Linkedin,
    Github,
    FileText,
    Globe
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface TruthLabProps {
    evidence: any[];
    onActionComplete: () => void;
}

const SourceIcon = ({ source }: { source: string }) => {
    switch (source.toUpperCase()) {
        case 'LINKEDIN': return <Linkedin size={14} className="text-[#0077B5]" />;
        case 'GITHUB': return <Github size={14} className="text-white" />;
        case 'RESUME': return <FileText size={14} className="text-emerald-500" />;
        default: return <Globe size={14} className="text-slate-500" />;
    }
};

export const TruthLab: React.FC<TruthLabProps> = ({ evidence, onActionComplete }) => {
    const [resolvingId, setResolvingId] = useState<string | null>(null);

    // Group evidence by claim_type and name/key
    const groupedEvidence = useMemo(() => {
        const groups: Record<string, any[]> = {};
        evidence.forEach(ev => {
            const key = `${ev.claim_type}:${ev.claim_data?.name || ev.claim_data?.title || 'Unknown'}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(ev);
        });
        
        // Only return groups with more than one source or high discordance (mocked for now)
        return Object.entries(groups)
            .map(([key, items]) => {
                const [type, name] = key.split(':');
                return { key, type, name, items };
            })
            .sort((a, b) => b.items.length - a.items.length);
    }, [evidence]);

    const handlePromote = async (item: any) => {
        setResolvingId(item.id);
        try {
            // In a real system, this would trigger an RPC to mark as canonical
            // For now, we update the evidence_ledger to store the resolution
            const { error } = await supabase
                .from('evidence_ledger')
                .update({ 
                    manual_resolution_data: { 
                        resolved_as: 'CANONICAL', 
                        resolved_at: new Date().toISOString() 
                    } 
                })
                .eq('id', item.id);

            if (error) throw error;
            
            // Trigger Snapshot Rebuild to reflect the new Canonical Truth
            await supabase.functions.invoke('snapshot-builder', {
                body: { user_id: item.user_id }
            });

            onActionComplete();
        } catch (e) {
            console.error("Resolution failed", e);
        } finally {
            setResolvingId(null);
        }
    };

    return (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-5 duration-1000">
            {/* Header */}
            <div className="bg-[#12141C] border border-[#23262F] p-12 rounded-[3.5rem] relative overflow-hidden">
                <div className="relative z-10">
                    <div className="flex items-center gap-3 text-emerald-500 mb-8">
                        <div className="p-2 bg-emerald-500/10 rounded-lg">
                            <Scale size={18} />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-[0.4em]">Identity Synthesis Layer V7.0</span>
                    </div>
                    <h1 className="text-5xl font-black text-white tracking-tighter mb-6">Truth Lab</h1>
                    <p className="text-slate-400 max-w-2xl text-lg leading-relaxed">
                        Reconcile conflicting evidence across your independent identity nodes. 
                        Multi-source discordance detected in <span className="text-white font-bold">{groupedEvidence.filter(g => g.items.length > 1).length} markers</span>.
                    </p>
                </div>
                <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.05),transparent)] pointer-events-none" />
            </div>

            {/* Evidence Matrix */}
            <div className="grid grid-cols-1 gap-8">
                {groupedEvidence.map((group) => (
                    <div key={group.key} className="bg-[#0F111A] border border-[#23262F] rounded-[2.5rem] overflow-hidden group hover:border-emerald-500/30 transition-all">
                        <div className="p-8 border-b border-white/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div>
                                <div className="flex items-center gap-3 mb-2">
                                    <span className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[9px] font-black text-slate-500 uppercase tracking-widest">{group.type}</span>
                                    {group.items.length > 1 && (
                                        <span className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full text-[9px] font-black text-amber-500 uppercase tracking-widest">
                                            <AlertTriangle size={10} />
                                            Discordant Signal
                                        </span>
                                    )}
                                </div>
                                <h3 className="text-2xl font-black text-white tracking-tight">{group.name}</h3>
                            </div>
                            <div className="flex items-center gap-6">
                                <div className="text-right">
                                    <div className="text-2xl font-black text-white tracking-tighter">{group.items.length}</div>
                                    <div className="text-[9px] font-black text-slate-600 uppercase">Input Nodes</div>
                                </div>
                                <div className="w-px h-8 bg-white/5" />
                                <div className="text-right">
                                    <div className="text-2xl font-black text-emerald-500 tracking-tighter">
                                        {(group.items.reduce((acc, curr) => acc + (curr.final_weight || 0), 0) / group.items.length * 100).toFixed(0)}%
                                    </div>
                                    <div className="text-[9px] font-black text-slate-600 uppercase">Avg Confidence</div>
                                </div>
                            </div>
                        </div>

                        <div className="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {group.items.map((item) => (
                                <div key={item.id} className="bg-black/40 border border-white/5 p-6 rounded-3xl relative overflow-hidden group/item hover:bg-black/60 transition-all">
                                    <div className="flex justify-between items-start mb-6">
                                        <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/5">
                                            <SourceIcon source={item.source} />
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{item.source}</span>
                                        </div>
                                        <div className="text-[10px] font-bold text-slate-600">
                                            {new Date(item.ingested_at).toLocaleDateString()}
                                        </div>
                                    </div>

                                    <div className="space-y-4 mb-8">
                                        {Object.entries(item.claim_data || {}).map(([k, v]) => (
                                            <div key={k} className="flex flex-col">
                                                <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1">{k}</span>
                                                <span className="text-sm font-medium text-slate-300 break-words line-clamp-2">{String(v)}</span>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="flex items-center justify-between pt-6 border-t border-white/5">
                                        <div className="space-y-1">
                                            <div className="text-[10px] font-black text-slate-500 uppercase">Weight</div>
                                            <div className="text-lg font-black text-white tracking-tighter">{(item.final_weight || 0).toFixed(3)}</div>
                                        </div>
                                        
                                        {item.manual_resolution_data?.resolved_as === 'CANONICAL' ? (
                                            <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-500 text-[10px] font-black uppercase tracking-widest">
                                                <CheckCircle2 size={12} />
                                                Canonical
                                            </div>
                                        ) : (
                                            <button 
                                                onClick={() => handlePromote(item)}
                                                disabled={resolvingId !== null}
                                                className="px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[9px] font-black text-slate-300 uppercase tracking-widest transition-all hover:text-white hover:border-emerald-500/40"
                                            >
                                                {resolvingId === item.id ? 'Processing...' : 'Promote to Canonical'}
                                            </button>
                                        )}
                                    </div>
                                    
                                    {/* Decoration */}
                                    <div className="absolute -top-10 -right-10 w-24 h-24 bg-emerald-500/5 blur-2xl rounded-full opacity-0 group-item-hover:opacity-100 transition-opacity" />
                                </div>
                            ))}
                        </div>
                    </div>
                ))}

                {groupedEvidence.length === 0 && (
                    <div className="text-center py-40 bg-[#12141C] border border-dashed border-white/10 rounded-[3rem]">
                        <Fingerprint size={48} className="mx-auto text-slate-700 mb-6" />
                        <h3 className="text-xl font-black text-slate-500 uppercase tracking-[0.2em]">Zero Signal Conflict Detected</h3>
                        <p className="text-slate-600 mt-4">All identity nodes are in structural alignment.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
