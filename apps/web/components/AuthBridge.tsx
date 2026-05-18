import React, { useEffect, useState } from 'react';
import { ShieldCheck, Loader2, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';

/**
 * AuthBridge — Secure session handoff from web app to Chrome Extension.
 *
 * Flow:
 * 1. Extension popup opens this page: /?view=auth-bridge&ext_id=<extension_id>
 * 2. If user is logged in → immediately sends AUTH_HANDOFF to the extension
 * 3. If user is NOT logged in → stores ext_id in sessionStorage, redirects to /auth
 * 4. After auth, Supabase redirects back → we restore ext_id and complete handoff
 *
 * Security:
 * - We only send the session to the chrome.runtime.id provided in the URL param
 * - The extension's manifest.json validates the sender origin via externally_connectable
 * - We never log or store tokens beyond the handoff
 */
export const AuthBridge = () => {
    const [status, setStatus] = useState<'LOADING' | 'SUCCESS' | 'ERROR' | 'NO_EXTENSION'>('LOADING');
    const [errorMsg, setErrorMsg] = useState('');
    const [countdown, setCountdown] = useState(3);

    useEffect(() => {
        const run = async () => {
            try {
                // --- Step 1: Get extension ID ---
                const params = new URLSearchParams(window.location.search);
                let extId = params.get('ext_id');

                // Fallback 1: sessionStorage (session-lived)
                if (!extId) {
                    extId = sessionStorage.getItem('hiremax_ext_id');
                }

                // Fallback 2: localStorage (persistent)
                if (!extId) {
                    extId = localStorage.getItem('hiremax_ext_id');
                }

                if (!extId) {
                    setStatus('NO_EXTENSION');
                    setErrorMsg('Extension ID missing. Please open the bridge from the HireMax extension popup.');
                    return;
                }

                // Persist for future recovery
                sessionStorage.setItem('hiremax_ext_id', extId);
                localStorage.setItem('hiremax_ext_id', extId);

                // --- Step 2: Get Supabase session ---
                const { data: { session }, error } = await supabase.auth.getSession();

                if (error) throw error;

                if (!session) {
                    // Not logged in → redirect to auth, preserving ext_id for recovery
                    const currentOrigin = window.location.origin;
                    window.location.href = `${currentOrigin}/?view=auth&redirect=auth-bridge`;
                    return;
                }

                // --- Step 3: Send to extension ---
                if (!window.chrome?.runtime?.sendMessage) {
                    setStatus('NO_EXTENSION');
                    setErrorMsg('Chrome extension not detected. Please install HireMax.');
                    return;
                }

                window.chrome.runtime.sendMessage(
                    extId,
                    {
                        type: 'AUTH_HANDOFF',
                        session: {
                            access_token: session.access_token,
                            refresh_token: session.refresh_token,
                            expires_in: session.expires_in,
                            user: session.user
                        }
                    },
                    (response: any) => {
                        // Clear stored ext_id after use
                        sessionStorage.removeItem('hiremax_ext_id');

                        if (chrome.runtime.lastError) {
                            console.error('[AuthBridge] Runtime error:', chrome.runtime.lastError.message);
                            setStatus('ERROR');
                            setErrorMsg('Extension not reachable. Ensure it is installed and enabled, then retry.');
                            return;
                        }

                        if (response?.success) {
                            setStatus('SUCCESS');
                            // Auto-close countdown
                            let t = 3;
                            const interval = setInterval(() => {
                                t--;
                                setCountdown(t);
                                if (t === 0) {
                                    clearInterval(interval);
                                    window.close();
                                }
                            }, 1000);
                        } else {
                            setStatus('ERROR');
                            setErrorMsg(response?.error || 'Handshake failed. Try again.');
                        }
                    }
                );

            } catch (e: any) {
                console.error('[AuthBridge] Error:', e);
                setStatus('ERROR');
                setErrorMsg(e.message || 'An unexpected error occurred.');
            }
        };

        // Small delay so the page renders before firing the handoff
        const timer = setTimeout(run, 400);
        return () => clearTimeout(timer);
    }, []);

    return (
        <div className="min-h-screen bg-[#0F1117] flex items-center justify-center p-4">
            <div className="bg-[#161B2E] border border-gray-800 rounded-2xl p-8 max-w-md w-full shadow-2xl text-center">

                {/* Loading */}
                {status === 'LOADING' && (
                    <div className="flex flex-col items-center space-y-4">
                        <div className="relative">
                            <div className="absolute inset-0 bg-blue-500/20 rounded-full animate-ping" />
                            <div className="relative bg-blue-500/10 rounded-full p-4">
                                <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                            </div>
                        </div>
                        <h2 className="text-xl font-bold text-white">Connecting Extension</h2>
                        <p className="text-gray-400 text-sm">Securely syncing your session...</p>
                    </div>
                )}

                {/* Success */}
                {status === 'SUCCESS' && (
                    <div className="flex flex-col items-center space-y-4 animate-in zoom-in duration-300">
                        <div className="bg-green-500/10 rounded-full p-4">
                            <CheckCircle className="w-10 h-10 text-green-400" />
                        </div>
                        <h2 className="text-xl font-bold text-white">Connected!</h2>
                        <p className="text-gray-400 text-sm">
                            HireMax extension is now linked to your account.
                        </p>
                        <div className="bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-2 text-green-400 text-sm font-medium">
                            Closing in {countdown}s...
                        </div>
                        <button
                            onClick={() => window.close()}
                            className="text-gray-500 hover:text-white text-xs transition-colors"
                        >
                            Close now
                        </button>
                    </div>
                )}

                {/* Error */}
                {status === 'ERROR' && (
                    <div className="flex flex-col items-center space-y-4">
                        <div className="bg-red-500/10 rounded-full p-4">
                            <XCircle className="w-10 h-10 text-red-400" />
                        </div>
                        <h2 className="text-xl font-bold text-white">Connection Failed</h2>
                        <p className="text-gray-400 text-sm">{errorMsg}</p>
                        <button
                            onClick={() => window.location.reload()}
                            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-lg font-medium transition-colors"
                        >
                            <RefreshCw className="w-4 h-4" />
                            <span>Retry</span>
                        </button>
                    </div>
                )}

                {/* No Extension Detected */}
                {status === 'NO_EXTENSION' && (
                    <div className="flex flex-col items-center space-y-4">
                        <div className="bg-gray-800 rounded-full p-4">
                            <ShieldCheck className="w-10 h-10 text-gray-500" />
                        </div>
                        <h2 className="text-xl font-bold text-white">Extension Not Found</h2>
                        <p className="text-gray-400 text-sm">
                            {errorMsg || 'Please open this page from the HireMax extension\'s "Connect Account" button.'}
                        </p>
                        <a
                            href="https://chrome.google.com/webstore"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-lg font-medium transition-colors text-sm"
                        >
                            Install Extension
                        </a>
                    </div>
                )}
            </div>
        </div>
    );
};
