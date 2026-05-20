// content.js
// V6: Universal Autofill Agent
// Integrations: Local Ontology | ATS Adapter | Multi-Step FSM | Rich Question Handling | Validation Layer

console.log("[HireMax] Content Script V6: Universal Autofill Agent");

let pendingStrategy = null;
let currentExecutionId = null;
let observer = null;
let mutationTimeout = null;
let isExecuting = false;
let currentPlatform = null; // Set by ATS Adapter at init

// --- DEPENDENCY RESOLUTION ---
// All utils are loaded before content.js via manifest injection order
const FSM = window.HireMaxFSM;
const Telemetry = window.HireMaxTelemetry;
const Hasher = window.HireMaxHasher;
const Ontology = window.HireMaxOntology;
const ATS = window.HireMaxATS;

// ==============================================================
// 1. INITIALIZATION & SPA SUPPORT
// ==============================================================
const init = async () => {
    // Detect ATS platform first (cached for entire session)
    currentPlatform = ATS.detect();

    if (!isPotentialJobPage()) {
        console.log("[HireMax] Dormant mode — non-job page. Monitoring for SPA transitions.");
        setupObserver();
        return;
    }

    console.log("[HireMax] Initializing Universal Agent...");

    const state = await FSM.getCurrentState();
    if (state === FSM.STATES.FILLING) {
        Telemetry.log("RECOVERY", "WARN", { state });
    }

    setupObserver();
    // Wait for DOM to fully stabilize before first scan
    await domStabilize();
    debouncedScan();
};

const isPotentialJobPage = () => {
    const url = window.location.href.toLowerCase();
    const body = document.body.innerText.toLowerCase().slice(0, 3000);

    if (currentPlatform) return true; // Known ATS is always a job page

    const urlMatch = /job|career|apply|vacancy|position|opening|recruit|talent|intern/.test(url);
    const bodyMatch = /apply now|submit application|upload resume|upload cv|cover letter|work authorization|visa sponsorship/.test(body);
    const hasFileInput = !!document.querySelector('input[type="file"]');

    return urlMatch || bodyMatch || hasFileInput;
};

// ==============================================================
// 2. DOM STABILIZATION
// Wait until no new significant nodes are added for a window of time.
// Critical for React/Vue/Angular apps that render forms asynchronously.
// ==============================================================
const domStabilize = (timeoutMs = 2000, quietMs = 400) => {
    return new Promise(resolve => {
        let quietTimer = null;
        const maxTimer = setTimeout(resolve, timeoutMs); // Never wait more than timeoutMs

        const obs = new MutationObserver(() => {
            if (quietTimer) clearTimeout(quietTimer);
            quietTimer = setTimeout(() => {
                obs.disconnect();
                clearTimeout(maxTimer);
                resolve();
            }, quietMs);
        });

        obs.observe(document.body, { childList: true, subtree: true });

        // If no mutations at all, resolve after quietMs
        quietTimer = setTimeout(() => {
            obs.disconnect();
            clearTimeout(maxTimer);
            resolve();
        }, quietMs);
    });
};

// ==============================================================
// 3. MUTATION OBSERVER (SPA + Late-Loading Fields)
// ==============================================================
const setupObserver = () => {
    if (observer) observer.disconnect();

    observer = new MutationObserver((mutations) => {
        if (isExecuting) return; // Pause during fill to avoid feedback loops

        let shouldTrigger = false;
        for (const m of mutations) {
            if (m.addedNodes.length > 0
                && m.target.tagName !== 'SCRIPT'
                && m.target.tagName !== 'STYLE') {
                shouldTrigger = true;
                break;
            }
        }

        if (shouldTrigger) debouncedScan();
    });

    observer.observe(document.body, { childList: true, subtree: true, attributes: false });
};

const debouncedScan = () => {
    if (mutationTimeout) clearTimeout(mutationTimeout);
    mutationTimeout = setTimeout(executeScan, 800);
};

// ==============================================================
// 4. PAGE SCAN — LOCAL-FIRST CLASSIFICATION
// ==============================================================
const executeScan = async () => {
    if (isExecuting) return;

    // Iframe context: report fields to parent, don't run full agent
    if (window !== window.top) {
        const context = await Hasher.calculate();
        if (context.fields.length > 0) {
            chrome.runtime.sendMessage({
                type: "IFRAME_CONTEXT_REPORT",
                payload: { url: window.location.href, fields: context.fields }
            });
        }
        return;
    }

    const currentState = await FSM.getCurrentState();
    if (currentState === FSM.STATES.COMPLETE) return;

    await FSM.transition(FSM.STATES.SCANNING);
    await domStabilize(1500, 300);

    const context = await Hasher.calculate();
    if (context.fields.length === 0) {
        await FSM.transition(FSM.STATES.IDLE);
        return;
    }

    // --- LOCAL ONTOLOGY PASS ---
    // Classify fields locally. Only send truly ambiguous fields to AI.
    let classifiedLocally = 0;
    const localMappings = {};
    const ambiguousFields = [];

    for (const field of context.fields) {
        const result = Ontology.classify(field);
        if (result && result.confidence >= 0.9) {
            localMappings[field.name || field.id || `field_${field.index}`] = {
                intent: result.intent,
                selector: field.selector,
                semantic_label: field.semantic_label,
                confidence: result.confidence,
                type: field.type,
                is_required: field.is_required,
                _local: true // Mark as locally-classified
            };
            classifiedLocally++;
        } else {
            ambiguousFields.push(field);
        }
    }

    Telemetry.log("LOCAL_CLASSIFICATION", "INFO", {
        total: context.fields.length,
        resolved: classifiedLocally,
        ambiguous: ambiguousFields.length,
        platform: currentPlatform?.platformKey || 'UNIVERSAL'
    });

    const idempotencyKey = context.hash + "_" + Math.floor(Date.now() / 60000);

    Telemetry.log("PAGE_ANALYSIS_REQUESTED", "INFO", {
        fieldCount: context.fields.length,
        locallyResolved: classifiedLocally,
        platform: currentPlatform?.adapter?.name || 'Universal'
    });

    // Send to backend for AI enrichment of ambiguous fields + strategy assembly
    chrome.runtime.sendMessage({
        type: "ANALYZE_PAGE",
        payload: {
            ...context.page_context,
            dom_hash: context.hash,
            fields: context.fields,               // all fields for backend knowledge base
            ambiguous_fields: ambiguousFields,     // only ambiguous need AI classification
            local_mappings: localMappings,         // pre-classified fields to enrich strategy
            idempotency_key: idempotencyKey,
            version: "1.0.6",
            job_id: new URLSearchParams(window.location.search).get('job_id') || null,
            ats_platform: currentPlatform?.platformKey || null
        }
    }, async (response) => {
        if (!response || !response.success || response.error) {
            const errMsg = response?.error || 'Connection Failed';
            console.error("[SCAN] Remote Scan Failed:", errMsg);
            chrome.runtime.sendMessage({ type: "UI_UPDATE", payload: { status: 'FAILED', message: errMsg } });
            return;
        }

        const strategy = response.strategy;

        // Precision Gate: block low-probability matches
        if (strategy.action === "BLOCK_LOW_PROBABILITY") {
            chrome.runtime.sendMessage({
                type: "UI_UPDATE",
                payload: {
                    status: 'FAILED',
                    message: "Match score too low. Manual application recommended to avoid flag."
                }
            });
            console.warn("[GUARD] Execution blocked: Low match probability", strategy.score);
            return;
        }

        if (strategy && !strategy.error) {
            pendingStrategy = strategy;
            currentExecutionId = strategy.execution_id;
            await FSM.transition(FSM.STATES.FIELD_MATCHING);
            chrome.runtime.sendMessage({
                type: "UI_UPDATE",
                payload: {
                    type: "SHOW_OVERLAY",
                    context: {
                        confidence: strategy.confidence || 0.99,
                        title: document.title,
                        match_reason: strategy.reason,
                        field_count: context.fields.length,
                        platform: currentPlatform?.adapter?.name || 'Universal',
                        local_resolved: classifiedLocally
                    }
                }
            });
        }
    });
};

// ==============================================================
// 5. MESSAGE LISTENERS
// ==============================================================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "START_EXECUTION") {
        if (pendingStrategy) {
            executeStrategy(pendingStrategy);
            sendResponse({ success: true });
        } else {
            Telemetry.log("START_NO_STRATEGY", "ERROR");
            sendResponse({ success: false, error: "NO_STRATEGY" });
        }
    } else if (request.type === "DRY_RUN") {
        pendingStrategy = request.payload;
        FSM.transition(FSM.STATES.DRY_RUN);
        visualizeDryRun(pendingStrategy);
    }
});

// ==============================================================
// 6. STRATEGY EXECUTION ENGINE
// ==============================================================
async function executeStrategy(strategy) {
    console.log("[HireMax] V6: Executing Universal Fill Strategy");
    isExecuting = true;
    const startTime = Date.now();
    await FSM.transition(FSM.STATES.FILLING, strategy.execution_id);

    const { mapping, execution_id, constraints, resume_asset, job_id } = strategy;
    let successCount = 0;
    let failedFields = [];
    let filledFields = [];
    const richQueueFields = []; // Custom questions to answer via AI

    chrome.runtime.sendMessage({ type: "UI_UPDATE", payload: { type: "EXECUTION_STARTED" } });

    for (const [fieldName, fieldConfig] of Object.entries(mapping)) {
        const { selector, semantic_label, value, type: fieldType, intent } = fieldConfig;

        // Skip custom questions now — process them as a batch afterward
        if (intent === 'custom_question' && !value) {
            richQueueFields.push({ fieldName, fieldConfig });
            continue;
        }

        let element = null;
        let attempts = 0;
        const maxAttempts = 5;

        // ATS adapter: check for platform-optimized selector first
        const atsSelector = ATS.getSelector(currentPlatform, intent || fieldName);
        const effectiveSelector = atsSelector || selector;

        while (!element && attempts < maxAttempts) {
            element = await resilientFind(effectiveSelector, semantic_label, fieldName, intent);
            if (!element) {
                attempts++;
                if (attempts < maxAttempts) await sleep(500);
            }
        }

        if (element) {
            if (constraints?.check_honeypots && isTrapField(element)) {
                Telemetry.log("HONEYPOT_SKIPPED", "WARN", { fieldName });
                failedFields.push({ fieldName, reason: "HONEYPOT_SKIPPED" });
                continue;
            }

            try {
                if (fieldType === 'file' || intent === 'resume' || fieldName.toLowerCase().includes('resume')) {
                    await handleFileUpload(element, resume_asset, execution_id);
                } else {
                    await humanizedInject(element, value);
                }

                visualHighlight(element, 'success');
                successCount++;
                filledFields.push(fieldName);

                chrome.runtime.sendMessage({
                    type: "UI_UPDATE",
                    payload: { type: "FIELD_FILLED", details: { field: fieldName, intent } }
                });
            } catch (err) {
                Telemetry.log("FILL_ERROR", "ERROR", { fieldName, err: err.message });
                failedFields.push({ fieldName, reason: "JS_ERROR" });
            }
        } else {
            Telemetry.log("FIELD_NOT_FOUND", "WARN", { fieldName, semantic_label });
            failedFields.push({ fieldName, reason: "NOT_FOUND" });
        }
    }

    // --- RICH QUESTION HANDLER ---
    // Process custom/open-ended questions via backend AI
    if (richQueueFields.length > 0) {
        await handleRichQuestions(richQueueFields, strategy, filledFields, failedFields);
    }

    isExecuting = false;

    // --- VALIDATION LAYER ---
    await FSM.transition(FSM.STATES.VALIDATION_CHECK);
    const validationResults = await runValidation(mapping, failedFields);

    // Emit rich validation summary to overlay
    chrome.runtime.sendMessage({
        type: "UI_UPDATE",
        payload: {
            type: "VALIDATION_RESULTS",
            results: validationResults
        }
    });

    const criticalFailures = validationResults.filter(v => v.required && v.status !== 'ok');

    if (criticalFailures.length === 0 && failedFields.length === 0) {
        await FSM.transition(FSM.STATES.COMPLETE);
        Telemetry.log("EXECUTION_COMPLETE", "INFO");
        chrome.runtime.sendMessage({ type: "UI_UPDATE", payload: { type: "EXECUTION_COMPLETE", filledCount: filledFields.length } });
    } else {
        await FSM.transition(FSM.STATES.FAILED);
        chrome.runtime.sendMessage({
            type: "UI_UPDATE",
            payload: {
                type: "EXECUTION_FAILED",
                failedFields: validationResults.filter(v => v.status !== 'ok'),
                message: `${filledFields.length} filled, ${criticalFailures.length} require attention`
            }
        });
    }

    // Async audit — non-blocking
    chrome.runtime.sendMessage({
        type: "RECORD_EXECUTION_AUDIT",
        payload: {
            execution_id,
            job_id,
            domain: window.location.hostname,
            ats_platform: currentPlatform?.platformKey || 'UNIVERSAL',
            status: criticalFailures.length === 0 ? "SUCCESS" : "PARTIAL_FAIL",
            filled_fields: filledFields.length,
            failed_fields: failedFields,
            rich_questions_handled: richQueueFields.length,
            duration_ms: Date.now() - startTime,
            metadata: {
                matched_fields: mapping ? Object.keys(mapping).length : 0,
                is_manual_override: !strategy?.confidence || strategy.confidence < 0.5
            }
        }
    });

    // --- MULTI-STEP: Check for "Next" button after fill ---
    await handleMultiStep(strategy);
}

// ==============================================================
// 7. MULTI-STEP APPLICATION NAVIGATOR
// ==============================================================
async function handleMultiStep(strategy) {
    const nextBtn = ATS.findNextButton(currentPlatform);
    if (!nextBtn) return; // No next step detected

    const submitBtn = ATS.findSubmitButton(currentPlatform);
    const isNextAlsoSubmit = submitBtn && nextBtn === submitBtn;

    if (isNextAlsoSubmit) {
        // If the only "next" IS the submit, show the review prompt only — never auto-submit
        chrome.runtime.sendMessage({
            type: "UI_UPDATE",
            payload: {
                type: "REVIEW_REQUIRED",
                message: "All fields filled. Review and click Submit when ready."
            }
        });
        return;
    }

    // Advance to next step automatically
    await FSM.transition(FSM.STATES.WAITING_FOR_NEXT_PAGE);
    Telemetry.log("MULTI_STEP_ADVANCE", "INFO", { url: window.location.href });

    await sleep(600); // Allow React to re-render validation
    nextBtn.click();

    // After navigation, wait for DOM to stabilize then re-scan
    await sleep(1200);
    await domStabilize(2000, 400);
    pendingStrategy = null; // Reset — new page needs a fresh scan

    chrome.runtime.sendMessage({
        type: "UI_UPDATE",
        payload: { type: "NEXT_STEP_NAVIGATED", message: "Moved to next step, scanning..." }
    });

    debouncedScan();
}

// ==============================================================
// 8. VALIDATION LAYER
// ==============================================================
async function runValidation(mapping, failedFields) {
    const results = [];

    for (const [fieldName, fieldConfig] of Object.entries(mapping)) {
        const el = await resilientFind(fieldConfig.selector, fieldConfig.semantic_label, fieldName, fieldConfig.intent);

        if (!el) {
            results.push({ fieldName, status: failedFields.some(f => f.fieldName === fieldName) ? 'not_found' : 'ok', required: fieldConfig.is_required });
            continue;
        }

        let status = 'ok';

        // Check for still-empty required fields
        if (fieldConfig.is_required) {
            const val = el.value?.trim();
            const isFileInput = el.type === 'file';
            const isEmpty = !val || val === '';
            const hasNoFile = isFileInput && (!el.files || el.files.length === 0);

            if (isEmpty && !isFileInput) status = 'empty';
            if (hasNoFile) status = 'missing_file';
        }

        // Check for visible dropdown mismatch
        if (el.tagName === 'SELECT' && el.value && el.value !== fieldConfig.value) {
            status = 'mismatch';
        }

        if (status !== 'ok') {
            visualHighlight(el, 'warning');
        }

        results.push({ fieldName, status, required: fieldConfig.is_required });
    }

    return results;
}

// ==============================================================
// 9. RICH QUESTION HANDLER
// ==============================================================
async function handleRichQuestions(queue, strategy, filledFields, failedFields) {
    if (queue.length === 0) return;

    Telemetry.log("RICH_QUESTIONS_START", "INFO", { count: queue.length });

    const answers = await new Promise(resolve => {
        chrome.runtime.sendMessage({
            type: "GENERATE_RICH_ANSWERS",
            payload: {
                fields: queue.map(q => ({
                    fieldName: q.fieldName,
                    label: q.fieldConfig.semantic_label,
                    type: q.fieldConfig.type
                })),
                execution_id: strategy.execution_id,
                job_id: strategy.job_id
            }
        }, resolve);
    });

    if (!answers || !answers.success) {
        Telemetry.log("RICH_QUESTIONS_FAILED", "WARN");
        return;
    }

    for (const item of queue) {
        const answer = answers.answers?.[item.fieldName];
        if (!answer) continue;

        const el = await resilientFind(item.fieldConfig.selector, item.fieldConfig.semantic_label, item.fieldName, 'custom_question');
        if (el) {
            await humanizedInject(el, answer);
            visualHighlight(el, 'ai');
            filledFields.push(item.fieldName);
            chrome.runtime.sendMessage({
                type: "UI_UPDATE",
                payload: { type: "FIELD_FILLED", details: { field: item.fieldName, intent: 'custom_question' } }
            });
        }
    }
}

// ==============================================================
// 10. RESILIENT FIELD FINDER
// ==============================================================
async function resilientFind(fallbackSelector, semanticLabel, configName, intent) {
    // 0. ATS-optimized selector try first
    if (intent && currentPlatform) {
        const atsSelector = ATS.getSelector(currentPlatform, intent);
        if (atsSelector) {
            const el = Hasher.deepQuerySelectorAll(atsSelector).find(x => x && x.offsetParent !== null);
            if (el) return el;
        }
    }

    // 1. Semantic label match via current DOM
    const currentContext = await Hasher.calculate();
    let bestMatch = null;
    let highestScore = 0;

    for (const field of currentContext.fields) {
        let score = 0;
        const sl = (field.semantic_label || '').toLowerCase();
        const cn = (configName || '').toLowerCase();
        const sls = (semanticLabel || '').toLowerCase();

        if (sls && sl.includes(sls)) score += 5;
        if (field.name === configName) score += 4;
        if (sl.includes(cn)) score += 2;

        if (score > highestScore && score >= 2) {
            highestScore = score;
            bestMatch = field;
        }
    }

    if (bestMatch?.selector) {
        const el = Hasher.deepQuerySelectorAll(bestMatch.selector).find(x => x);
        if (el) return el;
    }

    // 2. Fallback selector
    if (fallbackSelector) {
        const el = Hasher.deepQuerySelectorAll(fallbackSelector).find(x => x);
        if (el) return el;
    }

    // 3. Shadow DOM name/id query
    const allInputs = Hasher.deepQuerySelectorAll('input, select, textarea');
    return allInputs.find(i => i.name === configName || i.id === configName) || null;
}

// ==============================================================
// 11. INJECTION LOGIC
// ==============================================================
async function humanizedInject(el, val) {
    if (!val) return;
    el.focus();

    if (el.tagName === 'SELECT') {
        // Try direct value set first
        el.value = val;
        if (!el.value || el.value !== val) {
            // Try case-insensitive option match
            const options = Array.from(el.options);
            const match = options.find(o =>
                o.text.toLowerCase().includes(val.toLowerCase()) ||
                o.value.toLowerCase().includes(val.toLowerCase())
            );
            if (match) el.value = match.value;
        }
        el.dispatchEvent(new Event('change', { bubbles: true }));

    } else if (el.type === 'checkbox') {
        const shouldCheck = /yes|true|1/i.test(String(val));
        if (el.checked !== shouldCheck) {
            el.click();
        }

    } else if (el.type === 'radio') {
        const options = document.querySelectorAll(`input[type="radio"][name="${el.name}"]`);
        for (const opt of options) {
            if (opt.value.toLowerCase() === val.toLowerCase() ||
                (opt.labels?.[0]?.innerText || '').toLowerCase().includes(val.toLowerCase())) {
                opt.click();
                break;
            }
        }

    } else {
        el.value = "";

        // Humanized typing: simulate character-by-character for textareas and long strings
        if (el.tagName === 'TEXTAREA' || val.length > 50) {
            const chunks = val.match(/.{1,5}/g) || [];
            for (const chunk of chunks) {
                el.value += chunk;
                el.dispatchEvent(new Event('input', { bubbles: true }));
                await sleep(Math.random() * 30 + 10);
            }
        } else {
            // React-compatible: use native setter to bypass value caching
            const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
            if (nativeSetter) nativeSetter.call(el, val);
            else el.value = val;
            el.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }

    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
}

// ==============================================================
// 12. FILE UPLOAD
// ==============================================================
async function handleFileUpload(el, resume_asset, execution_id) {
    if (!resume_asset || !resume_asset.asset_id) return;
    try {
        Telemetry.log("RESUME_UPLOAD_START", "INFO", { asset_id: resume_asset.asset_id });

        const signedUrlResult = await new Promise((resolve) => {
            chrome.runtime.sendMessage({
                type: "FETCH_SIGNED_RESUME",
                payload: {
                    asset_id: resume_asset.asset_id,
                    execution_id: execution_id,
                    checksum: resume_asset.checksum
                }
            }, resolve);
        });

        if (!signedUrlResult || !signedUrlResult.success) {
            throw new Error(signedUrlResult?.error || "Failed to acquire signed JIT URL");
        }

        const response = await fetch(signedUrlResult.url);
        if (response.status === 403) throw new Error("JIT Signed URL Expired or Forbidden");

        const blob = await response.blob();
        const file = new File([blob], "Resume_Optimized.pdf", { type: "application/pdf" });

        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        el.files = dataTransfer.files;
        el.dispatchEvent(new Event('change', { bubbles: true }));

        Telemetry.log("RESUME_UPLOAD_SUCCESS", "INFO");
    } catch (err) {
        Telemetry.log("RESUME_UPLOAD_FAILED", "ERROR", { err: err.message });
        throw err;
    }
}

// ==============================================================
// 13. SAFETY & VISUAL HELPERS
// ==============================================================
function visualHighlight(el, mode = 'success') {
    el.style.transition = "all 0.4s ease";
    if (mode === 'success') {
        el.style.border = "2px solid #00f2ff";
        el.style.boxShadow = "0 0 10px rgba(0, 242, 255, 0.25)";
    } else if (mode === 'warning') {
        el.style.border = "2px solid #ffaa00";
        el.style.boxShadow = "0 0 10px rgba(255, 170, 0, 0.25)";
    } else if (mode === 'ai') {
        el.style.border = "2px solid #a855f7";
        el.style.boxShadow = "0 0 10px rgba(168, 85, 247, 0.25)";
    }
}

function visualizeDryRun(strategy) {
    Object.entries(strategy.mapping).forEach(async ([name, config]) => {
        const el = await resilientFind(config.selector, config.semantic_label, name, config.intent);
        if (el) {
            el.style.outline = "2px dashed #ff9900";
            el.title = `HireMax: ${name} → ${config.value}`;
        }
    });
}

function isTrapField(el) {
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || el.offsetParent === null) return true;
    const rect = el.getBoundingClientRect();
    if (rect.height < 5 || rect.width < 5) return true;
    const name = el.name || el.id;
    return !!(name && /(honeypot|website|url_confirm|d_name)/i.test(name));
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ==============================================================
// 14. SPA NAVIGATION HOOKS
// ==============================================================
window.addEventListener('popstate', async () => {
    await FSM.transition(FSM.STATES.IDLE);
    pendingStrategy = null;
    currentPlatform = ATS.detect();
    init();
});

window.addEventListener('hashchange', async () => {
    await FSM.transition(FSM.STATES.IDLE);
    pendingStrategy = null;
    init();
});

// ==============================================================
// BOOT
// ==============================================================
if (document.readyState === 'complete') init();
else window.addEventListener('load', init);
