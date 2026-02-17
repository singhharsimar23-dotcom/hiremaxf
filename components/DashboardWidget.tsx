
import React from 'react';
import { Lock, ArrowRight } from 'lucide-react';

interface DashboardWidgetProps {
    label: string;
    value: string | number;
    status: 'good' | 'neutral' | 'needs-work';
    locked?: boolean;
    disabled?: boolean;
    onUpgrade?: () => void;
    onClick?: () => void;
}

const DashboardWidget: React.FC<DashboardWidgetProps> = ({
    label,
    value,
    status,
    locked,
    disabled,
    onUpgrade,
    onClick
}) => {
    const styles = {
        'good': 'text-green-400 border-green-500/20 bg-green-500/5',
        'neutral': 'text-blue-400 border-blue-500/20 bg-blue-500/5',
        'needs-work': 'text-amber-400 border-amber-500/20 bg-amber-500/5'
    };

    if (locked) {
        return (
            <div
                onClick={onUpgrade}
                className="flex flex-col gap-3 p-8 rounded-[2rem] border border-slate-800 bg-slate-900/40 relative group overflow-hidden cursor-pointer"
            >
                <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <Lock size={20} className="text-slate-400 mb-2" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-blue-400">Upgrade Required</span>
                </div>
                <div className="flex items-center justify-between opacity-30">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">{label}</span>
                </div>
                <span className="text-3xl font-bold tracking-tight opacity-30">{value}</span>
            </div>
        );
    }

    const currentStyle = styles[status] || styles['neutral'];

    return (
        <div
            onClick={disabled ? undefined : onClick}
            className={`flex flex-col gap-3 p-8 rounded-[2rem] border ${currentStyle} shadow-xl transition-all ${disabled ? 'opacity-40 grayscale-[0.5] cursor-default' :
                    (onClick ? 'cursor-pointer hover:border-current hover:scale-[1.01]' : 'cursor-default')
                }`}
        >
            <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">{label}</span>
                {onClick && !disabled && <ArrowRight size={14} className="opacity-40" />}
            </div>
            <span className="text-3xl font-bold tracking-tight">{value}</span>
        </div>
    );
};

export default DashboardWidget;
