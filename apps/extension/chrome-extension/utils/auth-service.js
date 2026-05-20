// utils/auth-service.js
// Production-grade Extension Auth Service
// Handles: session init, proactive tab-sync, token refresh, expiry detection

window.HireMaxAuth = {
    // Known HireMax web app origins (prod + dev)
    KNOWN_ORIGINS: [
        'http://localhost:3000',
        'http://localhost:5173',
        'https://hiremax.app',
        'https://www.hiremax.app',
        'https://hiremax.site',
        'https://www.hiremax.site'
    ],

    // Derive the base URL for the auth-bridge page
    getAuthBridgeUrl: function (extId) {
        // Check if any known HireMax tab is open — prefer it
        return new Promise(resolve => {
            chrome.tabs.query({}, tabs => {
                const hiremaxTab = tabs.find(t =>
                    t.url && this.KNOWN_ORIGINS.some(o => t.url.startsWith(o))
                );
                if (hiremaxTab) {
                    // Use the same origin as the open tab
                    const origin = new URL(hiremaxTab.url).origin;
                    resolve(`${origin}/?view=auth-bridge&ext_id=${extId}`);
                } else {
                    // Default to production
                    resolve(`https://www.hiremax.site/?view=auth-bridge&ext_id=${extId}`);
                }
            });
        });
    },

    // Check if we have a valid, non-expired session
    getSession: async function () {
        const session = await chrome.storage.session.get(['user_id', 'access_token', 'user_email', 'token_expires_at']);
        if (!session.user_id || !session.access_token) return null;

        // Check expiry (tokens expire after ~1hr by default in Supabase)
        if (session.token_expires_at) {
            const expiresAt = new Date(session.token_expires_at).getTime();
            const now = Date.now();
            const BUFFER = 5 * 60 * 1000; // refresh 5 min before expiry
            if (now > expiresAt - BUFFER) {
                console.log('[AUTH] Token near expiry, triggering refresh...');
                const refreshed = await this.refreshToken();
                if (!refreshed) return null;
                return await chrome.storage.session.get(['user_id', 'access_token', 'user_email', 'token_expires_at']);
            }
        }

        return session;
    },

    // Attempt to refresh token using Supabase REST
    refreshToken: async function () {
        try {
            const { refresh_token } = await chrome.storage.session.get('refresh_token');
            if (!refresh_token) return false;

            const SUPABASE_URL = 'https://ssuknybhzcuusjardsve.supabase.co';
            const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzdWtueWJoemN1dXNqYXJkc3ZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxNDY1MTIsImV4cCI6MjA4NDcyMjUxMn0.9XaUxtMi3btKZIA_sXQCNJI20-iwruxXISr2J1Kmr-g';

            const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': SUPABASE_ANON_KEY
                },
                body: JSON.stringify({ refresh_token })
            });

            if (!res.ok) {
                console.warn('[AUTH] Refresh failed, clearing session');
                await this.clearSession();
                return false;
            }

            const data = await res.json();
            await this.saveSession({
                access_token: data.access_token,
                refresh_token: data.refresh_token,
                user: data.user,
                expires_in: data.expires_in
            });
            console.log('[AUTH] Token refreshed successfully');
            return true;
        } catch (err) {
            console.error('[AUTH] Token refresh error:', err);
            return false;
        }
    },

    // Save session consistently
    saveSession: async function (session) {
        const expiresAt = session.expires_in
            ? new Date(Date.now() + session.expires_in * 1000).toISOString()
            : null;

        await chrome.storage.session.set({
            user_id: session.user.id,
            access_token: session.access_token,
            refresh_token: session.refresh_token || null,
            user_email: session.user.email,
            user_name: session.user.user_metadata?.full_name || null,
            token_expires_at: expiresAt
        });
        // Persist user_id to local so popup can check auth state after service worker restart
        await chrome.storage.local.set({
            user_id: session.user.id,
            user_email: session.user.email,
            user_name: session.user.user_metadata?.full_name || null
        });
    },

    // Clear all session data
    clearSession: async function () {
        await chrome.storage.session.clear();
        await chrome.storage.local.remove(['user_id', 'user_email', 'user_name']);
    },

    // Proactively pull session from open HireMax tab (if user is already logged in)
    // This enables zero-click sync — no "Connect Account" needed if web app is open
    probeOpenTabs: function () {
        return new Promise(resolve => {
            chrome.tabs.query({}, tabs => {
                const hiremaxTabs = tabs.filter(t =>
                    t.url && this.KNOWN_ORIGINS.some(o => t.url.startsWith(o))
                );
                if (hiremaxTabs.length === 0) { resolve(false); return; }

                let probed = 0;
                let resolved = false;
                for (const tab of hiremaxTabs) {
                    chrome.tabs.sendMessage(tab.id, { type: 'HIREMAX_SESSION_PROBE' }, (response) => {
                        probed++;
                        if (chrome.runtime.lastError) { /* tab not ready */ }
                        else if (response?.session && !resolved) {
                            resolved = true;
                            this.saveSession(response.session).then(() => resolve(true));
                        }
                        if (probed === hiremaxTabs.length && !resolved) resolve(false);
                    });
                }
            });
        });
    }
};
