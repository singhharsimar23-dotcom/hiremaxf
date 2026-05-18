# Execution Engine V5: Deterministic Career Automation

**Version:** 5.0 (Enterprise-Resilient)  
**Status:** FULLY OPERATIONAL  
**Objective:** 95%+ reliability on major ATS (Workday, Greenhouse, Lever) with 0% data exposure risk.

---

## 1. Technical Architecture

The V5 Engine transforms from a linear script into a **Distributed Client Agent** coordinated by a central Finite State Machine (FSM).

### A. The Core FSM (Deterministic Transitions)
Unlike previous versions that relied on timeouts, V5 uses event-driven state transitions:
1.  **IDLE**: Awaiting page load and URL recognition.
2.  **SCANNING**: Deep-DOM traversal with `Hasher` fingerprinting.
3.  **FIELD_MATCHING**: Backend Evaluation (AI + Knowledge Base).
4.  **FILLING**: Humanized interaction (Debounced typing, event firing).
5.  **VALIDATION_CHECK**: Post-fill verification of DOM state.
6.  **COMPLETE / FAILED**: Final audit report and state dismissal.

---

## 2. Structural Resilience Features

### 2.1 Cross-Origin Iframe Bridge
**Problem**: ATS like Lever embed forms in third-party iframes that standard scripts cannot access.  
**V5 Solution**: 
- Scripts are injected into `all_frames`.
- Frames use `window.top.postMessage` to report their presence.
- The `ParentContentController` maps the frame-tree and delegates filling tasks to the specific frame-agent that owns the relevant DOM nodes.

### 2.2 Shadow DOM Penetration (Workday Fix)
**Problem**: Workday's "Cloud-Native" UI uses Shadow Roots that segment the DOM.  
**V5 Solution**: The `ElementFinder` recursive search utility now traverses `shadowRoot` properties automatically, ensuring no field is "hidden" from the engine.

### 2.3 JIT Secure Resume Fetch
**Security Strategy**: Pre-signed URLs are forbidden. 
1.  **Request**: Content script identifies a file-input.
2.  **Auth**: Dispatches a secure message to `background.js`.
3.  **Sign**: Background calls Supabase `/resume/get-signed-url` with current session.
4.  **Inject**: Background returns a **60s expiring URL**.
5.  **Clean**: URL is flushed from memory immediately after upload.

---

## 3. High-Throughput performance

### 3.1 In-Memory Context Coalescing
The Supabase Edge Function uses an **In-Memory Cache (Deno Map)** to store structural hash matches.
- **Result**: Repeated scans for the same ATS template (e.g., "Standard Greenhouse") return in **<50ms**, bypassing the Database and AI Resolution layers.

### 3.2 Telemetry Batching
To prevent network congestion, telemetry events are collected in a local buffer and "Flushed" in batches of 100 or every 30 seconds.
- **Reliability**: Events are preserved during page refreshes via `chrome.storage.session`.

---

## 4. Precision Gate (Protecting the Candidate)

**Threshold**: 0.70 Match Score.
- **Fail-Safe**: If the backend determines a match is low-signal, the extension **VETOES** the auto-fill.
- **Rationale**: Prevents users from being flagged as "Serial Spammers" by enterprise recruiters, preserving their long-term hiring reputation.

---
*Documentation Authored by Principal Systems Engineer (Execution V5 Team)*
