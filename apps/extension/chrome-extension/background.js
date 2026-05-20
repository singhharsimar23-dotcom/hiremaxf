// background.js - HireMax Extension Service Worker
// V7: Production-Grade Auth, Session Management, Adaptive Heartbeats, Batch Telemetry

const SUPABASE_PROJECT_REF = "ssuknybhzcuusjardsve";
const SUPABASE_URL = `https://${SUPABASE_PROJECT_REF}.supabase.co`;
const SUPABASE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/execution-engine`;
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzdWtueWJoemN1dXNqYXJkc3ZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxNDY1MTIsImV4cCI6MjA4NDcyMjUxMn0.9XaUxtMi3btKZIA_sXQCNJI20-iwruxXISr2J1Kmr-g";

const KNOWN_ORIGINS = [
    'http://localhost:3000',
    'http://localhost:5173',
    'https://hiremax.app',
    'https://www.hiremax.app',
    'https://hiremax.site',
    'https://www.hiremax.site'
];

// ==============================================================
// 1. CONTEXT MENUS — Manual Field Override
// ==============================================================
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "hiremax_manual_override",
        title: "Assign HireMax Field",
        contexts: ["editable"]
    });

    const fields = ["First Name", "Last Name", "Email", "Resume", "Cover Letter", "LinkedIn", "Custom Question"];
    fields.forEach(f => {
        chrome.contextMenus.create({
            id: `assign_${f.replace(/\s+/g, '_')}`,
            parentId: "hiremax_manual_override",
            title: `Assign to: ${f}`,
            contexts: ["editable"]
        });
    });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (!info.menuItemId.startsWith("assign_")) return;
    const assignedField = info.menuItemId.replace("assign_", "").replace(/_/g, ' ');
    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (field) => {
            const el = document.activeElement;
            if (!el) return;
            let selectorPath = [];
            let current = el;
            while (current && current !== document.documentElement) {
                let selector = current.tagName.toLowerCase();
                if (current.id && !/\d{4,}/.test(current.id)) { selectorPath.unshift(`#${current.id}`); break; }
                if (current.hasAttribute('name')) { selectorPath.unshift(`${selector}[name="${current.getAttribute('name')}"]`); break; }
                if (current.hasAttribute('data-automation-id')) { selectorPath.unshift(`${selector}[data-automation-id="${current.getAttribute('data-automation-id')}"]`); break; }
                let parent = current.parentNode;
                if (parent && parent.children) { let idx = Array.from(parent.children).indexOf(current) + 1; selector += `:nth-child(${idx})`; }
                selectorPath.unshift(selector);
                const root = current.getRootNode();
                current = (root instanceof ShadowRoot) ? root.host : current.parentNode;
            }
            chrome.runtime.sendMessage({
                type: "SAVE_MANUAL_MAPPING",
                payload: { field, selector: selectorPath.join(" > "), url: window.location.href, tag: el.tagName }
            });
        },
        args: [assignedField]
    });
});

// ==============================================================
// 2. INTERNAL MESSAGE ROUTER (Content Script → Background)
// ==============================================================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.type) {
        case "ANALYZE_PAGE":
            handleAnalyzePage(request.payload, sendResponse);
            return true;
        case "FLUSH_TELEMETRY":
            handleBatchTelemetry(request.payload.events);
            return false;
        case "UI_UPDATE":
            if (sender.tab) chrome.tabs.sendMessage(sender.tab.id, request.payload).catch(() => { });
            return false;
        case "HEARTBEAT":
            handleAdaptiveHeartbeat(request.payload, sendResponse);
            return true;
        case "SAVE_MANUAL_MAPPING":
            saveManualMapping(request.payload);
            return false;
        case "RECORD_EXECUTION_AUDIT":
            recordExecutionAudit(request.payload);
            return false;
        case "APPLICATION_SUBMITTED":
            // Fired by overlay/content script after successful ATS form submission
            logApplicationEvent(request.payload);
            return false;
        case "FETCH_SIGNED_RESUME":
            handleFetchSignedResume(request.payload, sendResponse);
            return true;
        case "GENERATE_RICH_ANSWERS":
            handleRichAnswers(request.payload, sendResponse);
            return true;
        // Popup: check current auth state
        case "GET_AUTH_STATE":
            handleGetAuthState(sendResponse);
            return true;
        // Popup: open auth bridge
        case "CONNECT_ACCOUNT":
            handleConnectAccount();
            return false;
        // Popup: sign out
        case "SIGN_OUT":
            handleSignOut(sendResponse);
            return true;
    }
});

// ==============================================================
// 3. EXTERNAL MESSAGE ROUTER (Web App → Extension)
// ==============================================================
chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
    // Validate the sender is a known HireMax origin
    const origin = sender.origin || (sender.url ? new URL(sender.url).origin : null);
    const isKnownOrigin = KNOWN_ORIGINS.includes(origin);

    if (!isKnownOrigin) {
        console.warn('[BG] Rejected external message from unknown origin:', origin);
        sendResponse({ success: false, error: 'UNAUTHORIZED_ORIGIN' });
        return;
    }

    if (request.type === "AUTH_HANDOFF") {
        // Must use an async wrapper or return true to keep the channel open
        (async () => {
            try {
                await handleAuthHandoff(request.session);
                sendResponse({ success: true });
            } catch (err) {
                console.error('[BG] Handoff error:', err);
                sendResponse({ success: false, error: err.message });
            }
        })();
        return true;
    }
});

// ==============================================================
// 4. AUTH HANDLERS
// ==============================================================

/** Called by web app (AuthBridge) after Supabase login */
async function handleAuthHandoff(session) {
    if (!session?.access_token || !session?.user?.id) {
        throw new Error("INVALID_SESSION");
    }

    await saveSession(session);
    console.log("[BG] Auth Handoff Success →", session.user.email);

    // Notify all extension UI views that we're now authenticated
    broadcastAuthState({
        authenticated: true,
        email: session.user.email,
        name: session.user.user_metadata?.full_name
    });
}

/** Popup requests current auth state */
async function handleGetAuthState(sendResponse) {
    try {
        const session = await getValidSession();
        if (session) {
            const local = await chrome.storage.local.get(['user_email', 'user_name']);
            sendResponse({
                authenticated: true,
                user_id: session.user_id,
                email: session.user_email || local.user_email,
                name: session.user_name || local.user_name
            });
        } else {
            // Attempt zero-click tab probe before giving up
            const synced = await probeOpenTabs();
            if (synced) {
                const freshSession = await chrome.storage.session.get(['user_id', 'user_email', 'user_name']);
                sendResponse({ authenticated: true, user_id: freshSession.user_id, email: freshSession.user_email, name: freshSession.user_name });
            } else {
                sendResponse({ authenticated: false });
            }
        }
    } catch (err) {
        sendResponse({ authenticated: false, error: err.message });
    }
}

/** Popup: open auth-bridge on the web app */
async function handleConnectAccount() {
    const extId = chrome.runtime.id;

    // Find if there's an open HireMax tab
    const tabs = await chrome.tabs.query({});
    const hiremaxTab = tabs.find(t => t.url && KNOWN_ORIGINS.some(o => t.url.startsWith(o)));

    let authUrl;
    if (hiremaxTab) {
        const origin = new URL(hiremaxTab.url).origin;
        authUrl = `${origin}/?view=auth-bridge&ext_id=${extId}`;
        // Focus the existing tab instead of opening a new one
        chrome.tabs.update(hiremaxTab.id, { active: true, url: authUrl });
        chrome.windows.update(hiremaxTab.windowId, { focused: true });
    } else {
        // No HireMax tab open — open production URL
        authUrl = `https://www.hiremax.site/?view=auth-bridge&ext_id=${extId}`;
        chrome.tabs.create({ url: authUrl });
    }
}

/** Popup: sign out */
async function handleSignOut(sendResponse) {
    await clearSession();
    broadcastAuthState({ authenticated: false });
    sendResponse({ success: true });
}

// ==============================================================
// 5. SESSION HELPERS
// ==============================================================
async function saveSession(session) {
    const expiresAt = session.expires_in
        ? new Date(Date.now() + session.expires_in * 1000).toISOString()
        : new Date(Date.now() + 3600 * 1000).toISOString(); // default 1hr

    await chrome.storage.session.set({
        user_id: session.user.id,
        access_token: session.access_token,
        refresh_token: session.refresh_token || null,
        user_email: session.user.email,
        user_name: session.user.user_metadata?.full_name || null,
        token_expires_at: expiresAt
    });
    await chrome.storage.local.set({
        user_id: session.user.id,
        user_email: session.user.email,
        user_name: session.user.user_metadata?.full_name || null
    });
}

async function clearSession() {
    await chrome.storage.session.clear();
    await chrome.storage.local.remove(['user_id', 'user_email', 'user_name']);
}

async function getValidSession() {
    const session = await chrome.storage.session.get(['user_id', 'access_token', 'user_email', 'user_name', 'token_expires_at', 'refresh_token']);
    if (!session.user_id || !session.access_token) return null;

    // Check expiry
    if (session.token_expires_at) {
        const expiresAt = new Date(session.token_expires_at).getTime();
        const BUFFER_MS = 5 * 60 * 1000; // 5 min buffer
        if (Date.now() > expiresAt - BUFFER_MS) {
            console.log('[BG] Token near expiry, refreshing...');
            const ok = await refreshToken(session.refresh_token);
            if (!ok) { await clearSession(); return null; }
            return await chrome.storage.session.get(['user_id', 'access_token', 'user_email', 'user_name', 'token_expires_at']);
        }
    }

    return session;
}

async function refreshToken(refreshToken) {
    if (!refreshToken) return false;
    try {
        const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
            body: JSON.stringify({ refresh_token: refreshToken })
        });
        if (!res.ok) return false;
        const data = await res.json();
        await saveSession({ access_token: data.access_token, refresh_token: data.refresh_token, user: data.user, expires_in: data.expires_in });
        return true;
    } catch { return false; }
}

/** Zero-click sync: probe any open HireMax tabs for a live session */
async function probeOpenTabs() {
    return new Promise(resolve => {
        chrome.tabs.query({}, tabs => {
            const targets = tabs.filter(t => t.url && KNOWN_ORIGINS.some(o => t.url.startsWith(o)));
            if (!targets.length) { resolve(false); return; }
            let pending = targets.length;
            let found = false;
            for (const tab of targets) {
                chrome.tabs.sendMessage(tab.id, { type: 'HIREMAX_SESSION_PROBE' }, response => {
                    if (chrome.runtime.lastError) { /* ignore — tab may not have content script */ }
                    else if (response?.session && !found) {
                        found = true;
                        saveSession(response.session).then(() => resolve(true));
                        return;
                    }
                    pending--;
                    if (pending === 0 && !found) resolve(false);
                });
            }
        });
    });
}

function broadcastAuthState(state) {
    // Broadcast to all extension views
    chrome.runtime.sendMessage({ type: 'AUTH_STATE_CHANGED', payload: state }).catch(() => { });
}

// ==============================================================
// 6. ANALYZE PAGE (AI Field Classification Bridge)
// ==============================================================
async function handleAnalyzePage(payload, sendResponse) {
    try {
        const session = await getValidSession();
        if (!session) {
            sendResponse({ success: false, error: "USER_NOT_LOGGED_IN" });
            return;
        }

        const response = await fetch(`${SUPABASE_FUNCTION_URL}/evaluate-context`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
            body: JSON.stringify({
                user_id: session.user_id,
                url: payload.url,
                page_title: payload.title,
                dom_structure_hash: payload.dom_hash,
                fields: payload.fields,
                ambiguous_fields: payload.ambiguous_fields || [],
                local_mappings: payload.local_mappings || {},
                extension_version: payload.version,
                idempotency_key: payload.idempotency_key,
                ats_platform: payload.ats_platform || null
            })
        });

        if (response.status === 401) {
            await clearSession();
            broadcastAuthState({ authenticated: false });
            sendResponse({ success: false, error: "SESSION_EXPIRED" });
            return;
        }
        if (response.status === 426) { sendResponse({ success: true, strategy: { error: "UPGRADE_REQUIRED" } }); return; }
        if (response.status === 429) { sendResponse({ success: true, strategy: { error: "RATE_LIMITED" } }); return; }

        const data = await response.json();
        sendResponse({ success: true, strategy: data });
    } catch (err) {
        console.error("[BG] Analyze Error:", err);
        sendResponse({ success: false, error: "NETWORK_ERROR", details: err.message });
    }
}

// ==============================================================
// 7. RESUME (JIT Signed URL)
// ==============================================================
async function handleFetchSignedResume(payload, sendResponse) {
    try {
        const session = await getValidSession();
        if (!session) { sendResponse({ success: false, error: "USER_NOT_LOGGED_IN" }); return; }

        const response = await fetch(`${SUPABASE_FUNCTION_URL}/resume/get-signed-url`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
            body: JSON.stringify({ asset_id: payload.asset_id, execution_id: payload.execution_id, checksum: payload.checksum })
        });

        if (!response.ok) throw new Error(`Backend returned ${response.status}`);
        const data = await response.json();
        sendResponse({ success: true, url: data.url });
    } catch (err) {
        sendResponse({ success: false, error: err.message });
    }
}

// ==============================================================
// 8. HEARTBEAT
// ==============================================================
async function handleAdaptiveHeartbeat(payload, sendResponse) {
    try {
        const session = await chrome.storage.session.get('access_token');
        const response = await fetch(`${SUPABASE_FUNCTION_URL}/heartbeat`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token || SUPABASE_ANON_KEY}` },
            body: JSON.stringify(payload)
        });
        if (response.status === 410) sendResponse({ error: "LOCK_LOST" });
        else sendResponse({ success: true });
    } catch { sendResponse({ success: false }); }
}

// ==============================================================
// 9. TELEMETRY
// ==============================================================
async function handleBatchTelemetry(events) {
    if (!events || events.length === 0) return;
    try {
        const session = await chrome.storage.session.get('access_token');
        await fetch(`${SUPABASE_FUNCTION_URL}/record-telemetry-batch`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token || SUPABASE_ANON_KEY}` },
            body: JSON.stringify({ events })
        });
    } catch (err) { console.error("[BG] Telemetry flush failed:", err); }
}

// ==============================================================
// 10. MANUAL FIELD MAPPING (Learning Loop)
// ==============================================================
async function saveManualMapping(payload) {
    try {
        const session = await chrome.storage.session.get('access_token');
        await fetch(`${SUPABASE_FUNCTION_URL}/learn-mapping`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token || SUPABASE_ANON_KEY}` },
            body: JSON.stringify(payload)
        });
        chrome.notifications.create({
            type: "basic", iconUrl: "icons/icon128.png",
            title: "HireMax AI Learned",
            message: `Mapped "${payload.field}" — noted for future forms!`
        });
    } catch (err) { console.error("[BG] Manual map failed:", err); }
}

// ==============================================================
// 11. EXECUTION AUDIT
// ==============================================================
async function recordExecutionAudit(payload) {
    try {
        const session = await chrome.storage.session.get('access_token');
        await fetch(`${SUPABASE_FUNCTION_URL}/audit/execution`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token || SUPABASE_ANON_KEY}` },
            body: JSON.stringify({ ...payload, timestamp: new Date().toISOString() })
        });
    } catch (err) { /* fail silently — audit is non-blocking */ }
}

// ==============================================================
// 12. RICH ANSWERS (AI Essay Generation)
// ==============================================================
async function handleRichAnswers(payload, sendResponse) {
    try {
        const session = await getValidSession();
        if (!session) { sendResponse({ success: false, error: "USER_NOT_LOGGED_IN" }); return; }

        const response = await fetch(`${SUPABASE_FUNCTION_URL}/generate-rich-answers`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
            body: JSON.stringify({ user_id: session.user_id, fields: payload.fields, execution_id: payload.execution_id, job_id: payload.job_id })
        });

        if (!response.ok) { sendResponse({ success: false, error: `Backend ${response.status}` }); return; }
        const data = await response.json();
        sendResponse({ success: true, answers: data.answers || {} });
    } catch (err) {
        sendResponse({ success: false, error: err.message });
    }
}
