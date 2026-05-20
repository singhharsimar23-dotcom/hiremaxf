import { Shield, Settings, AlertCircle, LogIn } from 'lucide-react';
import { useExtensionState } from './hooks/useExtensionState';
import { StatusBadge } from './components/StatusBadge';
import { ActionCard } from './components/ActionCard';

function App() {
    const { state, context, user, error, connectAuth, signOut, executeAutoFill, stopExecution } = useExtensionState();

    return (
        <div className="w-[360px] h-[500px] bg-background text-text-primary flex flex-col font-sans overflow-hidden">
            {/* Header */}
            <div className="h-14 border-b border-border flex items-center justify-between px-4 bg-background/80 backdrop-blur sticky top-0 z-10">
                <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 bg-gradient-to-tr from-primary to-blue-400 rounded-md flex items-center justify-center">
                        <Shield className="w-3.5 h-3.5 text-white" />
                    </div>
                    <span className="font-bold text-lg bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">HireMax</span>
                </div>
                <StatusBadge state={state} />
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">

                {/* Error Banner */}
                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-start space-x-3">
                        <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                        <div>
                            <h4 className="text-sm font-medium text-red-400">System Alert</h4>
                            <p className="text-xs text-red-300/80 mt-1">{error}</p>
                        </div>
                    </div>
                )}

                {/* Unlinked State */}
                {state === 'UNLINKED' && (
                    <div className="flex flex-col items-center justify-center py-8 space-y-4 text-center">
                        <div className="w-16 h-16 bg-card rounded-full flex items-center justify-center border border-border">
                            <Shield className="w-8 h-8 text-gray-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white">Connect Command Center</h2>
                            <p className="text-sm text-text-secondary mt-1 px-4">Link your HireMax account to enable autonomous execution.</p>
                        </div>
                        <button
                            onClick={connectAuth}
                            className="flex items-center space-x-2 bg-primary hover:bg-blue-600 text-white px-6 py-2.5 rounded-lg transition-all font-medium mt-2"
                        >
                            <LogIn className="w-4 h-4" />
                            <span>Connect Account</span>
                        </button>
                    </div>
                )}

                {/* Idle/No Context */}
                {state === 'IDLE' && (
                    <div className="flex flex-col items-center justify-center py-10 space-y-4 text-center opacity-60">
                        <div className="w-20 h-20 bg-card rounded-full flex items-center justify-center border border-border dashed-border">
                            <span className="animate-ping absolute inline-flex h-12 w-12 rounded-full bg-blue-400 opacity-10"></span>
                            <Shield className="w-8 h-8 text-blue-500/50" />
                        </div>
                        <p className="text-sm">Scanning for job applications...</p>
                    </div>
                )}

                {/* Active Context */}
                {(state === 'READY' || state === 'RUNNING' || state === 'ANALYZING' || state === 'SUCCESS') && (
                    <ActionCard
                        context={context}
                        onExecute={executeAutoFill}
                        onStop={stopExecution}
                        isRunning={state === 'RUNNING'}
                    />
                )}

            </div>

            {/* Footer */}
            <div className="h-12 border-t border-border bg-card flex items-center justify-between px-4 text-xs text-text-secondary">
                <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full ${state !== 'UNLINKED' && state !== 'ERROR' ? 'bg-green-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-gray-600'}`}></div>
                    <span>v1.0.6 &bull; {user?.name || user?.email || 'Not connected'}</span>
                </div>
                <div className="flex items-center space-x-2">
                    {state !== 'UNLINKED' && (
                        <button
                            onClick={signOut}
                            title="Sign out"
                            className="hover:text-red-400 transition-colors text-[10px] uppercase tracking-wider"
                        >
                            Sign Out
                        </button>
                    )}
                    <button className="hover:text-white transition-colors">
                        <Settings className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    )
}

export default App
