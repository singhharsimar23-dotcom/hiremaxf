// background.js - Service Worker
// Handles API communication with Supabase

// CONSTANTS - TODO: Replace with your actual project details before packing
const SUPABASE_PROJECT_REF = "sppeyjftunxphvfzhjcd";
const SUPABASE_URL = `https://${SUPABASE_PROJECT_REF}.supabase.co`;
const SUPABASE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/execution-engine`;
const SUPABASE_ANON_KEY = "PLACEHOLDER_KEY"; // User must replace this or utilize a build script to inject it.

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "ANALYZE_PAGE") {
        handleAnalyzePage(request.payload, sendResponse);
        return true; // Keep channel open for async response
    }

    if (request.type === "TELEMETRY") {
        handleTelemetry(request.payload);
        return false;
    }

    if (request.type === "UI_UPDATE") {
        // Forward UI updates to the tab (Overlay)
        if (sender.tab) {
            chrome.tabs.sendMessage(sender.tab.id, request.payload);
        }
        return false;
    }

    if (request.type === "HEARTBEAT") {
        handleHeartbeat(request.payload, sendResponse);
        return true;
    }
});

// Listener for External Messages (Auth Bridge from Web App)
chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
    if (request.type === "AUTH_HANDOFF") {
        handleAuthHandoff(request.session, sendResponse);
        return true; // Async response
    }
});

async function handleAuthHandoff(session, sendResponse) {
    try {
        if (!session || !session.access_token || !session.user) {
            sendResponse({ success: false, error: "INVALID_SESSION" });
            return;
        }

        // Save session to local storage
        await chrome.storage.local.set({
            session: session,
            user_id: session.user.id,
            access_token: session.access_token,
            refresh_token: session.refresh_token,
            expires_at: session.expires_at || (Date.now() / 1000 + 3600) // Default 1hr if missing
        });

        console.log("[BG] Auth Handoff Successful", session.user.id);
        sendResponse({ success: true });
    } catch (err) {
        console.error("[BG] Auth Handoff Failed:", err);
        sendResponse({ success: false, error: err.message });
    }
}

async function handleAnalyzePage(payload, sendResponse) {
    try {
        console.log("[BG] Analyzing Context:", payload.url);

        // Fetch user_id from storage (assumed logged in via extension options/popup)
        const { user_id } = await chrome.storage.local.get("user_id");

        if (!user_id) {
            sendResponse({ error: "USER_NOT_LOGGED_IN" });
            return;
        }

        const response = await fetch(`${SUPABASE_FUNCTION_URL}/evaluate-context`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify({
                user_id: user_id,
                url: payload.url,
                page_title: payload.title,
                dom_structure_hash: payload.dom_hash,
                extension_version: payload.version,
                idempotency_key: payload.idempotency_key
            })
        });

        if (response.status === 426) {
            sendResponse({ success: true, strategy: { error: "UPGRADE_REQUIRED" } });
            return;
        }

        if (!response.ok) {
            const errText = await response.text();
            console.error("[BG] API Error:", errText);
            sendResponse({ error: "API_ERROR", details: errText });
            return;
        }

        const data = await response.json();
        sendResponse({ success: true, strategy: data });

    } catch (err) {
        console.error("[BG] Network Error:", err);
        sendResponse({ error: "NETWORK_ERROR", details: err.message });
    }
}

async function handleHeartbeat(payload, sendResponse) {
    try {
        const response = await fetch(`${SUPABASE_FUNCTION_URL}/heartbeat`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify(payload)
        });

        if (response.status === 410) { // Gone / Lock Lost
            sendResponse({ error: "LOCK_LOST" });
            return;
        }

        sendResponse({ success: true });
    } catch (err) {
        console.error("[BG] Heartbeat Failed:", err);
        // Don't fail the client immediately on network blip
        sendResponse({ success: false });
    }
}

async function handleTelemetry(payload) {
    try {
        await fetch(`${SUPABASE_FUNCTION_URL}/record-telemetry`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify(payload)
        });
    } catch (err) {
        console.error("[BG] Telemetry Failed:", err);
    }
}
