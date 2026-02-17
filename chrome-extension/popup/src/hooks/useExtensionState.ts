import { useState, useEffect } from 'react';

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

interface StateData {
    state: ExtensionState;
    context: JobContext;
    user: any | null;
    error?: string;
}

export function useExtensionState() {
    const [data, setData] = useState<StateData>({
        state: 'INITIALIZING',
        context: null,
        user: null
    });

    useEffect(() => {
        // 1. Initial Load: Check Storage for Auth & Last State
        const init = async () => {
            try {
                // @ts-ignore
                const storage = await chrome.storage.local.get(['session', 'user_id', 'last_context']);

                if (!storage.user_id) {
                    setData(prev => ({ ...prev, state: 'UNLINKED' }));
                    return;
                }

                // Check if we have active context
                // In a real implementation, we might query the active tab to see if it's a job page
                // For now, start IDLE, and let the message listener update us if Analysis happens
                setData(prev => ({
                    ...prev,
                    state: 'IDLE',
                    user: storage.session?.user,
                    context: storage.last_context || null
                }));

            } catch (e) {
                console.error("Init failed", e);
                setData(prev => ({ ...prev, state: 'ERROR', error: 'Failed to initialize' }));
            }
        };

        init();

        // 2. Listen for runtime messages (Background -> Popup)
        const listener = (request: any, sender: any, sendResponse: any) => {

            if (request.type === 'STATE_UPDATE') {
                // Background telling us state changed (e.g. Analysis complete)
                setData(prev => ({
                    ...prev,
                    state: request.payload.state,
                    context: request.payload.context || prev.context,
                    error: request.payload.error
                }));
            }

            if (request.type === 'AUTH_SUCCESS') {
                setData(prev => ({ ...prev, state: 'IDLE', user: request.user }));
            }
        };

        // @ts-ignore
        chrome.runtime.onMessage.addListener(listener);

        return () => {
            // @ts-ignore
            chrome.runtime.onMessage.removeListener(listener);
        }
    }, []);

    // Actions
    const connectAuth = () => {
        // Open Auth Bridge
        // @ts-ignore
        const extId = chrome.runtime.id;
        // @ts-ignore
        chrome.tabs.create({ url: `http://localhost:3000/auth-bridge?ext_id=${extId}` });
        // TODO: Use production URL in prod
    };

    const executeAutoFill = async () => {
        setData(prev => ({ ...prev, state: 'RUNNING' }));
        // Determine active tab
        // @ts-ignore
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) {
            // @ts-ignore
            chrome.tabs.sendMessage(tab.id, { type: 'EXECUTE_FILL' });
        }
    };

    const stopExecution = async () => {
        setData(prev => ({ ...prev, state: 'READY' })); // Revert to ready? or Idle
        // @ts-ignore
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) {
            // @ts-ignore
            chrome.tabs.sendMessage(tab.id, { type: 'STOP_EXECUTION' });
        }
    };

    return {
        ...data,
        connectAuth,
        executeAutoFill,
        stopExecution
    };
}
