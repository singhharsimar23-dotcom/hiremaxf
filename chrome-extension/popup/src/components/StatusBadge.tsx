import React from 'react';
import { Shield, Radio, ShieldAlert, CheckCircle, Loader2, Lock } from 'lucide-react';
import { clsx } from 'clsx';
import { ExtensionState } from '../hooks/useExtensionState';

interface StatusBadgeProps {
    state: ExtensionState;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ state }) => {
    const config = {
        'INITIALIZING': { icon: Loader2, color: 'text-gray-400', bg: 'bg-gray-500/10', label: 'Loading...', animate: 'animate-spin' },
        'UNLINKED': { icon: Lock, color: 'text-yellow-500', bg: 'bg-yellow-500/10', label: 'Not Connected', animate: '' },
        'IDLE': { icon: Shield, color: 'text-blue-400', bg: 'bg-blue-500/10', label: 'Standby', animate: '' },
        'ANALYZING': { icon: Loader2, color: 'text-blue-400', bg: 'bg-blue-500/10', label: 'Analyzing Context...', animate: 'animate-spin' },
        'READY': { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/10', label: 'Ready to Fill', animate: '' },
        'RUNNING': { icon: Radio, color: 'text-green-500', bg: 'bg-green-500/20', label: 'Executing...', animate: 'animate-pulse' },
        'SUCCESS': { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-500/10', label: 'Complete', animate: '' },
        'ERROR': { icon: ShieldAlert, color: 'text-red-500', bg: 'bg-red-500/10', label: 'Error', animate: '' },
    }[state] || { icon: Shield, color: 'text-gray-400', bg: 'bg-gray-500/10', label: 'Unknown', animate: '' };

    const Icon = config.icon;

    return (
        <div className={clsx("flex items-center space-x-2 px-3 py-1.5 rounded-full border border-white/5", config.bg)}>
            <Icon className={clsx("w-4 h-4", config.color, config.animate)} />
            <span className={clsx("text-xs font-medium", config.color)}>{config.label}</span>
        </div>
    );
};
