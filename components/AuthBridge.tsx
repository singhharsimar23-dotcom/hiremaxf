import React, { useEffect, useState } from 'react';
import { ShieldCheck, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

// This component bridges the Supabase session from the Web App to the Chrome Extension
export const AuthBridge = () => {
    const [status, setStatus] = useState<'LOADING' | 'SUCCESS' | 'ERROR' | 'IDLE'>('LOADING');
    const [extensionId, setExtensionId] = useState<string | null>(null);

    useEffect(() => {
        const handoffSession = async () => {
            try {
                // 1. Get Session
                const { data: { session } } = await supabase.auth.getSession();

                if (!session) {
                    // Redirect to login if not authenticated
                    window.location.href = '/auth?redirect=auth-bridge';
                    return;
                }

                // 2. Identify Extension
                // In production, the ID is fixed. In dev, it might vary.
                // We can try to detect it or user passes it via URL param if needed. 
                // For now, we broadcast to the "externally_connectable" listener.
                // Note: chrome.runtime.sendMessage from a web page requires the Extension ID.
                // We will try to find it from a query param, or assume a fixed one if deployed.

                // Strategy: The Extension Popup opens this page with ?ext_id=...
                const params = new URLSearchParams(window.location.search);
                const targetId = params.get('ext_id');

                if (!targetId) {
                    // Fallback: If no ID provided, we can't send the message securely.
                    // Show instruction to user.
                    setStatus('IDLE');
                    return;
                }

                setExtensionId(targetId);

                // 3. Send Message
                // @ts-ignore - Chrome API available if externally_connectable matches
                if (window.chrome && window.chrome.runtime) {
                    // @ts-ignore
                    window.chrome.runtime.sendMessage(targetId, {
                        type: 'AUTH_HANDOFF',
                        session: {
                            access_token: session.access_token,
                            refresh_token: session.refresh_token,
                            user: session.user
                        }
                    }, (response: any) => {
                        if (response && response.success) {
                            setStatus('SUCCESS');
                            // Optional: Close tab after 2 seconds
                            setTimeout(() => window.close(), 2000);
                        } else {
                            console.error("Extension handshake failed:", response);
                            setStatus('ERROR');
                        }
                    });
                } else {
                    console.error("Chrome Runtime not found. Is the extension installed?");
                    setStatus('ERROR');
                }

            } catch (e) {
                console.error("Auth Bridge Error:", e);
                setStatus('ERROR');
            }
        };

        setTimeout(handoffSession, 500); // Small delay for UX
    }, []);

    return (
        <div className="min-h-screen bg-[#0F1117] flex items-center justify-center p-4">
            <div className="bg-[#161B2E] border border-gray-800 rounded-2xl p-8 max-w-md w-full shadow-2xl text-center">

                {status === 'LOADING' && (
                    <div className="flex flex-col items-center">
                        <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
                        <h2 className="text-xl font-bold text-white mb-2">Connecting to HireMax...</h2>
                        <p className="text-gray-400">Securely syncing your session.</p>
                    </div>
                )}

                {status === 'SUCCESS' && (
                    <div className="flex flex-col items-center animate-in zoom-in duration-300">
                        <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mb-4">
                            <CheckCircle className="w-10 h-10 text-green-500" />
                        </div>
                        <h2 className="text-xl font-bold text-white mb-2">Connected Successfully</h2>
                        <p className="text-gray-400">You can now use the extension. This tab will close automatically.</p>
                    </div>
                )}

                {status === 'ERROR' && (
                    <div className="flex flex-col items-center">
                        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
                            <XCircle className="w-10 h-10 text-red-500" />
                        </div>
                        <h2 className="text-xl font-bold text-white mb-2">Connection Failed</h2>
                        <p className="text-gray-400 mb-4">We couldn't reach the extension.</p>
                        <button
                            onClick={() => window.location.reload()}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                        >
                            Retry
                        </button>
                    </div>
                )}

                {status === 'IDLE' && (
                    <div className="flex flex-col items-center">
                        <ShieldCheck className="w-12 h-12 text-blue-500 mb-4" />
                        <h2 className="text-xl font-bold text-white mb-2">Auth Bridge Ready</h2>
                        <p className="text-gray-400 mb-4 text-sm">
                            Please open this page from the Extension's "Connect Account" button to verify the target ID.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};
