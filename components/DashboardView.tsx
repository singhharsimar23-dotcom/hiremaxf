
import React, { useMemo } from 'react';
import DashboardWidget from './DashboardWidget';
import RealityCheckDetail from './ActiveStakingDetail';
import ActionCard from './StakingCard';
import { QUICK_ACTIONS } from '../constants';
import { AppView, DiagnosticResult, UserPlan } from '../types';

interface DashboardViewProps {
    currentAnalysis: DiagnosticResult | null;
    plan: UserPlan; // Although passed, might not be used directly here if not needed
    onNavigate: (view: AppView) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ currentAnalysis, plan, onNavigate }) => {

    // Memoize values to prevent unnecessary re-calculations
    const marketFitValue = useMemo(() =>
        currentAnalysis?.foundation?.marketReadiness || currentAnalysis?.marketReadinessLabel || '---',
        [currentAnalysis]
    );

    const strengthsValue = useMemo(() =>
        currentAnalysis?.foundation?.strengthsSnapshot?.length || currentAnalysis?.eightPoints?.length || '---',
        [currentAnalysis]
    );

    const visibilityValue = useMemo(() =>
        currentAnalysis?.foundation?.atsShield || (currentAnalysis?.overallScore ? 'Optimized' : '---'),
        [currentAnalysis]
    );

    const readinessValue = useMemo(() =>
        currentAnalysis ? `${currentAnalysis.overallScore}%` : '---',
        [currentAnalysis]
    );

    const readinessStatus = useMemo(() =>
        currentAnalysis ? (currentAnalysis.overallScore > 80 ? 'good' : 'needs-work') : 'neutral',
        [currentAnalysis]
    );

    return (
        <div className="max-w-[1400px] mx-auto px-6 md:px-10 py-12 animate-in fade-in duration-500">
            <div className="mb-12 flex justify-between items-start">
                <div>
                    <h1 className="text-4xl font-bold text-white mb-2">
                        Profile Impact: <span className="text-blue-500">{currentAnalysis ? currentAnalysis.overallScore : '---'}</span>
                    </h1>
                    <p className="text-slate-500 font-medium">
                        Profile Status: Active | <span className="text-xs uppercase tracking-widest bg-slate-800 text-slate-300 px-2 py-0.5 rounded">{plan}</span>
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                <DashboardWidget
                    label="Market Fit"
                    value={marketFitValue}
                    status="neutral"
                    onClick={() => onNavigate('full-review')}
                />
                <DashboardWidget
                    label="Top Strengths"
                    value={strengthsValue}
                    status="good"
                    onClick={() => onNavigate('full-review')}
                />
                <DashboardWidget
                    label="Recruiter Visibility"
                    value={visibilityValue}
                    status="good"
                    onClick={() => onNavigate('full-review')}
                />
                <DashboardWidget
                    label="Overall Readiness"
                    value={readinessValue}
                    status={readinessStatus}
                    onClick={() => onNavigate('full-review')}
                />
            </div>

            <div className="mb-16">
                <RealityCheckDetail onStart={() => onNavigate('ai-review')} />
            </div>

            <div className="space-y-6">
                <h3 className="text-white font-bold text-xl uppercase tracking-tight ml-2">Quick Actions</h3>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {QUICK_ACTIONS.map(action => (
                        <ActionCard
                            key={action.id}
                            data={action}
                            onClick={() => {
                                if (action.id === 'new') onNavigate('resume-editor');
                                if (action.id === 'review') onNavigate('ai-review');
                            }}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};
