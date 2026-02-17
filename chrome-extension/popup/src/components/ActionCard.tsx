import React from 'react';
import { Play, Square, ExternalLink } from 'lucide-react';
import { clsx } from 'clsx';
import { JobContext } from '../hooks/useExtensionState';

interface ActionCardProps {
    context: JobContext;
    onExecute: () => void;
    onStop: () => void;
    isRunning: boolean;
}

export const ActionCard: React.FC<ActionCardProps> = ({ context, onExecute, onStop, isRunning }) => {
    if (!context) return null;

    return (
        <div className="bg-card border border-border p-4 rounded-xl space-y-4">
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="font-semibold text-white truncate max-w-[200px]">{context.title || "Unknown Role"}</h3>
                    <p className="text-sm text-text-secondary truncate max-w-[200px]">{context.company || "Unknown Company"}</p>
                </div>
                <div className={clsx(
                    "text-xs px-2 py-1 rounded font-medium border",
                    context.risk === 'LOW' ? "border-green-500/30 text-green-400 bg-green-500/10" :
                        context.risk === 'MEDIUM' ? "border-yellow-500/30 text-yellow-400 bg-yellow-500/10" :
                            "border-red-500/30 text-red-400 bg-red-500/10"
                )}>
                    {context.risk || "UNKNOWN"} RISK
                </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs text-text-secondary">
                <div className="bg-background/50 p-2 rounded">
                    <div className="uppercase text-[10px] opacity-70">Strategy</div>
                    <div className="font-mono text-white">{context.strategy || "Heuristic v1"}</div>
                </div>
                <div className="bg-background/50 p-2 rounded">
                    <div className="uppercase text-[10px] opacity-70">Confidence</div>
                    <div className="font-mono text-white">{(context.confidence || 0) * 100}%</div>
                </div>
            </div>

            {!isRunning ? (
                <button
                    onClick={onExecute}
                    className="w-full flex items-center justify-center space-x-2 bg-primary hover:bg-blue-600 text-white font-medium py-2.5 rounded-lg transition-all active:scale-[0.98]"
                >
                    <Play className="w-4 h-4 fill-current" />
                    <span>Auto-Fill Application</span>
                </button>
            ) : (
                <button
                    onClick={onStop}
                    className="w-full flex items-center justify-center space-x-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 font-medium py-2.5 rounded-lg transition-all"
                >
                    <Square className="w-4 h-4 fill-current" />
                    <span>Stop Execution</span>
                </button>
            )}
        </div>
    );
};
