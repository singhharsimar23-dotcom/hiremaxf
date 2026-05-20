/**
 * ErrorBoundary — Fix W-FE-15
 *
 * Wraps each major view so a runtime error in one component does NOT crash
 * the entire application to a blank white screen. Instead, an inline error
 * card is shown with a "Reload" action.
 *
 * Usage:
 *   <ErrorBoundary name="Dashboard">
 *     <DashboardView ... />
 *   </ErrorBoundary>
 */
import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
    children: React.ReactNode;
    /** Human-readable name for the boundary — shown in the error UI */
    name?: string;
}

interface State {
    hasError: boolean;
    errorMessage: string;
}

export class ErrorBoundary extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, errorMessage: '' };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, errorMessage: error.message || 'An unexpected error occurred.' };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        // Log to console so developers can inspect the full stack
        console.error(`[ErrorBoundary: ${this.props.name ?? 'Unknown'}]`, error, info.componentStack);

        // Check if the error is a Vite chunk dynamic import failure
        if (/Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk/i.test(error.message || '')) {
            const now = Date.now();
            const lastReload = sessionStorage.getItem('hiremax_chunk_reload');
            
            // Allow only one reload every 15 seconds to prevent infinite refresh loops
            if (!lastReload || now - parseInt(lastReload, 10) > 15000) {
                sessionStorage.setItem('hiremax_chunk_reload', now.toString());
                console.warn("[ErrorBoundary] Chunk load failure detected. Reloading to fetch the latest assets...");
                window.location.reload();
            }
        }
    }

    private handleReset = () => {
        this.setState({ hasError: false, errorMessage: '' });
    };

    render() {
        if (this.state.hasError) {
            const isChunkError = /Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk/i.test(this.state.errorMessage);
            return (
                <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center gap-6 animate-in fade-in duration-300">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center border ${
                        isChunkError 
                            ? "bg-blue-500/10 border-blue-500/20" 
                            : "bg-red-500/10 border-red-500/20"
                    }`}>
                        <AlertTriangle size={28} className={isChunkError ? "text-blue-400" : "text-red-500"} />
                    </div>
                    <div className="space-y-2 max-w-md">
                        <h2 className="text-lg font-black text-white uppercase tracking-tight">
                            {isChunkError ? 'Application Update Available' : (this.props.name ? `${this.props.name} Error` : 'Component Error')}
                        </h2>
                        <p className="text-slate-400 text-sm font-medium">
                            {isChunkError 
                                ? 'We have deployed a new version of HireMax. A page reload is required to load the updated modules.' 
                                : this.state.errorMessage}
                        </p>
                        <p className="text-slate-600 text-[10px] font-black uppercase tracking-widest">
                            {isChunkError 
                                ? 'No progress or data is lost. Clicking reload will fetch the latest update.' 
                                : 'Other pages are unaffected. You can navigate away or reset this view.'}
                        </p>
                    </div>
                    <button
                        onClick={() => {
                            if (isChunkError) {
                                window.location.reload();
                            } else {
                                this.handleReset();
                            }
                        }}
                        className={`flex items-center gap-2 px-6 py-3 border rounded-xl text-white text-xs font-black uppercase tracking-widest transition-all ${
                            isChunkError 
                                ? "bg-blue-600/10 border-blue-500/20 hover:bg-blue-600/20 shadow-[0_0_15px_rgba(59,130,246,0.1)]" 
                                : "bg-white/5 border-white/10 hover:bg-white/10"
                        }`}
                    >
                        <RefreshCw size={14} className={isChunkError ? "text-blue-400" : ""} />
                        {isChunkError ? 'Reload & Update' : 'Reset View'}
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
