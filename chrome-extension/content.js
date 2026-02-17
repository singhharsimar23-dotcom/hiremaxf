// content.js
// The "Hand" of the Execution Engine. V2: Hardened.

console.log("[HireMax] Content Script V2 Loaded");

let heartbeatInterval = null;
let currentExecutionId = null;

// 1. Initial Scan & Handshake
(async () => {
    // Wait for DOM to settle
    await new Promise(r => setTimeout(r, 1000));

    const domHash = await window.HireMaxHasher.calculate();

    // Request Context Evaluation
    // Add Idempotency Key (Hash of URL + Time bucket)
    const idempotencyKey = await window.HireMaxHasher.sha256(window.location.href + Math.floor(Date.now() / 60000));

    chrome.runtime.sendMessage({
        type: "ANALYZE_PAGE",
        payload: {
            url: window.location.href,
            title: document.title,
            dom_hash: domHash,
            idempotency_key: idempotencyKey,
            version: "1.0.0"
        }
    }, (response) => {
        if (response && response.success && response.strategy) {
            if (response.strategy.error === "UPGRADE_REQUIRED") {
                alert("HireMax Extension Update Required");
                return;
            }
            executeStrategy(response.strategy);

            // Trigger Overlay
            chrome.runtime.sendMessage({
                type: "UI_UPDATE",
                payload: {
                    type: "SHOW_OVERLAY",
                    context: {
                        confidence: response.strategy.confidence || 0.95,
                        title: document.title,
                        match_reason: response.strategy.reason
                    }
                }
            });
        } else {
            console.log("[HireMax] No strategy active for this context.");
        }
    });
})();

// 2. Execution Logic
async function executeStrategy(strategy) {
    console.log("[HireMax] Executing Strategy V2:", strategy.action);
    const { mapping, lock_token, execution_id, constraints } = strategy;

    if (!mapping) return;

    // Start Heartbeat & Validation
    if (execution_id) {
        currentExecutionId = execution_id;

        // IMMEDIATE LOCK CHECK (Pre-Flight)
        const isLocked = await checkLock(execution_id);
        if (!isLocked) {
            console.error("[HireMax] Pre-flight lock check failed. Aborting.");
            alert("Session Lock Lost - Another agent may be working on this application.");
            return;
        }

        startHeartbeat(execution_id);
    }

    // Report Start
    chrome.runtime.sendMessage({
        type: "TELEMETRY",
        payload: { strategy_id: strategy.strategy_id, event: "EXECUTION_STARTED", details: { lock_token } }
    });

    for (const [fieldName, fieldConfig] of Object.entries(mapping)) {
        // Re-validate lock if loop is slow (every 5 fields?) - Optional optimization
        // For now, pre-check is sufficient for short forms.

        const { selector, value } = fieldConfig;

        // ... (Existing logic) ...
        let element = document.querySelector(selector);

        if (element) {
            // TRAP DEFENSE (Honeypot Check)
            if (constraints?.check_honeypots) {
                if (isTrapField(element)) {
                    console.warn(`[HireMax] Trap detected for ${fieldName}. Skipping.`);
                    // Report Trap
                    chrome.runtime.sendMessage({
                        type: "TELEMETRY",
                        payload: { strategy_id: strategy.strategy_id, event: "TRAP_DETECTED", details: { field: fieldName } }
                    });
                    continue;
                }
            }

            // Highlight & Inject
            element.style.border = "2px solid #00f2ff";

            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
            nativeInputValueSetter.call(element, value);

            const inputEvent = new Event('input', { bubbles: true });
            element.dispatchEvent(inputEvent);

            console.log(`[HireMax] Filled ${fieldName}`);

            chrome.runtime.sendMessage({
                type: "TELEMETRY",
                payload: { strategy_id: strategy.strategy_id, event: "FIELD_FILLED", details: { field: fieldName } }
            });
        } else {
            console.warn(`[HireMax] Selector not found: ${selector}`);
            chrome.runtime.sendMessage({
                type: "TELEMETRY",
                payload: { strategy_id: strategy.strategy_id, event: "FIELD_MISSING", details: { field: fieldName, selector } }
            });
        }
    }
}

function checkLock(execId) {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage({
            type: "HEARTBEAT",
            payload: { execution_id: execId }
        }, (res) => {
            if (res && res.error === "LOCK_LOST") {
                resolve(false);
            } else {
                resolve(true); // Success or generic error (fail open? No, fail closed is safer, but network blip?)
                // Actually, if network error, safely assume we hold it unless 410 explicitly returned.
                // res.success is true if OK.
            }
        });
    });
}

function startHeartbeat(execId) {
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    heartbeatInterval = setInterval(() => {
        chrome.runtime.sendMessage({
            type: "HEARTBEAT",
            payload: { execution_id: execId }
        }, (res) => {
            if (res && res.error === "LOCK_LOST") {
                console.error("[HireMax] Lock lost. Aborting.");
                clearInterval(heartbeatInterval);
                alert("Session Expired - Please refresh.");
            }
        });
    }, 10000); // 10s Heartbeat
}

function isTrapField(el) {
    // Visibility Check
    if (el.offsetParent === null) return true; // hidden
    if (window.getComputedStyle(el).visibility === 'hidden') return true;
    if (el.getBoundingClientRect().height < 5) return true; // tiny

    // Attribute Check
    if (el.getAttribute('tabindex') === '-1') return true;
    if (el.getAttribute('aria-hidden') === 'true') return true;

    // Name Check (Simple Regex)
    const name = el.name || el.id;
    if (name && /(honeypot|website|url_confirm|d_name)/i.test(name)) return true;

    return false;
}
