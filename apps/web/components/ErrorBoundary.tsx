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
    }

    private handleReset = () => {
        this.setState({ hasError: false, errorMessage: '' });
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center gap-6">
                    <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center border border-red-500/20">
                        <AlertTriangle size={28} className="text-red-500" />
                    </div>
                    <div className="space-y-2 max-w-md">
                        <h2 className="text-lg font-black text-white uppercase tracking-tight">
                            {this.props.name ? `${this.props.name} Error` : 'Component Error'}
                        </h2>
                        <p className="text-slate-500 text-sm font-medium">
                            {this.state.errorMessage}
                        </p>
                        <p className="text-slate-600 text-[10px] font-black uppercase tracking-widest">
                            Other pages are unaffected. You can navigate away or reset this view.
                        </p>
                    </div>
                    <button
                        onClick={this.handleReset}
                        className="flex items-center gap-2 px-6 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-xs font-black uppercase tracking-widest hover:bg-white/10 transition-all"
                    >
                        <RefreshCw size={14} />
                        Reset View
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
