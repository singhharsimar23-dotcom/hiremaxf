import { useState, useEffect, useCallback } from 'react';

declare const chrome: any;

export type ExtensionState =
    | 'INITIALIZING'
    | 'UNLINKED'
    | 'IDLE'
    | 'ANALYZING'
    | 'READY'
    | 'RUNNING'
    | 'SUCCESS'
    | 'ERROR';

export type JobContext = {
    title?: string;
    company?: string;
    strategy?: string;
    risk?: 'LOW' | 'MEDIUM' | 'HIGH';
    confidence?: number;
} | null;

interface AuthUser {
    id?: string;
    email?: string;
    name?: string;
}

interface StateData {
    state: ExtensionState;
    context: JobContext;
    user: AuthUser | null;
    error?: string;
}

export function useExtensionState() {
    const [data, setData] = useState<StateData>({
        state: 'INITIALIZING',
        context: null,
        user: null
    });

    // ----------------------------------------------------------------
    // INIT: Ask background for current auth state on every popup open.
    // Background checks storage.session (correct layer), handles
    // token refresh, and probes open tabs for zero-click auth.
    // ----------------------------------------------------------------
    useEffect(() => {
        const init = async () => {
            try {
                // Ask background service worker for the current auth state
                const authState: any = await sendToBackground({ type: 'GET_AUTH_STATE' });

                if (!authState || !authState.authenticated) {
                    setData(prev => ({ ...prev, state: 'UNLINKED', user: null }));
                    return;
                }

                setData(prev => ({
                    ...prev,
                    state: 'IDLE',
                    user: {
                        id: authState.user_id,
                        email: authState.email,
                        name: authState.name
                    }
                }));

                // Additionally check if active tab is a job page (live context update)
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (tab?.url) {
                    const isJobPage = /job|career|apply|vacancy|position|greenhouse|lever|workday|ashby|smartrecruiter|bamboohr|jobvite|icims/i.test(tab.url);
                    if (isJobPage && data.context) {
                        setData(prev => ({ ...prev, state: 'READY' }));
                    }
                }

            } catch (e: any) {
                console.error('[POPUP] Init failed', e);
                setData(prev => ({ ...prev, state: 'ERROR', error: e.message || 'Initialization failed' }));
            }
        };

        init();
    }, []);

    // ----------------------------------------------------------------
    // RUNTIME MESSAGE LISTENER
    // Background broadcasts AUTH_STATE_CHANGED when auth changes.
    // This means popup updates immediately after Connect Account succeeds.
    // ----------------------------------------------------------------
    useEffect(() => {
        const listener = (request: any) => {
            if (request.type === 'AUTH_STATE_CHANGED') {
                if (request.payload?.authenticated) {
                    setData(prev => ({
                        ...prev,
                        state: 'IDLE',
                        user: {
                            email: request.payload.email,
                            name: request.payload.name
                        },
                        error: undefined
                    }));
                } else {
                    setData(prev => ({ ...prev, state: 'UNLINKED', user: null }));
                }
            }

            if (request.type === 'STATE_UPDATE') {
                setData(prev => ({
                    ...prev,
                    state: request.payload.state,
                    context: request.payload.context || prev.context,
                    error: request.payload.error
                }));
            }
        };

        chrome.runtime.onMessage.addListener(listener);
        return () => chrome.runtime.onMessage.removeListener(listener);
    }, []);

    // ----------------------------------------------------------------
    // ACTIONS
    // ----------------------------------------------------------------

    /** Open auth-bridge on the HireMax web app */
    const connectAuth = useCallback(() => {
        // Tell background to handle URL resolution and tab management
        chrome.runtime.sendMessage({ type: 'CONNECT_ACCOUNT' });
    }, []);

    /** Sign out — clears session everywhere */
    const signOut = useCallback(async () => {
        await sendToBackground({ type: 'SIGN_OUT' });
        setData(prev => ({ ...prev, state: 'UNLINKED', user: null, context: null }));
    }, []);

    /** Trigger autofill on active tab */
    const executeAutoFill = useCallback(async () => {
        setData(prev => ({ ...prev, state: 'RUNNING' }));
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) {
            chrome.tabs.sendMessage(tab.id, { type: 'START_EXECUTION' });
        }
    }, []);

    /** Stop execution on active tab */
    const stopExecution = useCallback(async () => {
        setData(prev => ({ ...prev, state: 'IDLE' }));
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) {
            chrome.tabs.sendMessage(tab.id, { type: 'STOP_EXECUTION' });
        }
    }, []);

    return {
        ...data,
        connectAuth,
        signOut,
        executeAutoFill,
        stopExecution
    };
}

// ----------------------------------------------------------------
// HELPER: Promise-wrapped chrome.runtime.sendMessage
// ----------------------------------------------------------------
function sendToBackground(message: any): Promise<any> {
    return new Promise((resolve) => {
        try {
            chrome.runtime.sendMessage(message, (response: any) => {
                if (chrome.runtime.lastError) {
                    console.warn('[POPUP] BG message error:', chrome.runtime.lastError.message);
                    resolve(null);
                } else {
                    resolve(response);
                }
            });
        } catch (e) {
            resolve(null);
        }
    });
}
