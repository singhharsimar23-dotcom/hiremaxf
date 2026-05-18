# Browser Extension
> Name: HireMax Execution Engine
> Manifest Version: 3
> Extension Version: 1.0.7
> Files: `chrome-extension/`
> Last Updated: 2026-03-11

---

## Purpose

Interact with ATS job application forms on any website. The extension automatically detects when a user is on a job application form, displays a recommendation overlay, classifies form fields, and autofills them with resume data.

---

## Capabilities

| Capability | Implementation |
|-----------|---------------|
| ATS form detection | `content.js` — DOM analysis + URL pattern matching |
| Overlay UI | `overlay/` — injected React component showing job context |
| Autofill | `content.js` + `ats-adapter.js` — field mapping + event dispatch |
| AI field classification | Background → `execution-engine/evaluate-context` API call |
| Manual field override | Context menu → `SAVE_MANUAL_MAPPING` → learning loop |
| Essay/rich answer generation | Background → `execution-engine/generate-rich-answers` |
| Auth session management | `background.js` — JWT storage, refresh, handoff |
| Telemetry | `telemetry-buffer.js` — batched events flushed every 30s or 10 events |
| Heartbeat | 30s interval → `execution-engine/heartbeat` (keep execution session alive) |

---

## Supported ATS Sites

The extension runs on `https://*/*` (all URLs), with specialized field adapters for:

| ATS Platform | Domain Pattern | Adapter Strategy |
|-------------|---------------|-----------------|
| **Greenhouse** | `boards.greenhouse.io`, `apply.greenhouse.io` | Known field IDs: `first_name`, `last_name`, `email`, `resume`, `phone` |
| **Lever** | `jobs.lever.co` | Named fields: `name`, `email`, `phone`, `org`, `resume` |
| **Workday** | `*.myworkdayjobs.com` | Data-automation-id attributes |
| **Ashby** | `jobs.ashbyhq.com` | Custom JSON form schema |
| **iCIMS** | `*.icims.com` | Complex multi-step form with iframe nesting |
| **SmartRecruiters** | `*.smartrecruiters.com` | Standard HTML forms |
| **Generic** | All other sites | AI classification via `evaluate-context` endpoint |

---

## Core Modules

### 1. `background.js` (Service Worker)

The central hub of the extension — runs persistently as a Manifest V3 service worker.

**Responsibilities:**
- Session management: stores JWT in `chrome.storage.session` (ephemeral) + user identity in `chrome.storage.local` (persistent)
- Token refresh: auto-refreshes JWT 5 minutes before expiry using Supabase `/auth/v1/token?grant_type=refresh_token`
- Zero-click tab sync: probes open HireMax tabs for an active session on popup open
- Message routing: Internal (content → background) and external (web app → extension) message bus
- API calls: All calls to `execution-engine` routed through background to keep auth token server-only

**Message Types (Internal):**
```
ANALYZE_PAGE         → field classification API call
FLUSH_TELEMETRY      → batch telemetry write
UI_UPDATE            → pass message to content script
HEARTBEAT            → execution session keepalive
SAVE_MANUAL_MAPPING  → persist user's field override
RECORD_EXECUTION_AUDIT → log outcome
APPLICATION_SUBMITTED → log application event
FETCH_SIGNED_RESUME  → get JIT Supabase Storage URL for resume
GENERATE_RICH_ANSWERS → call Gemini for essay answers
GET_AUTH_STATE       → popup queries current auth
CONNECT_ACCOUNT      → open auth-bridge web page
SIGN_OUT             → clear session
```

**Message Types (External — from web app):**
```
AUTH_HANDOFF  → web app passes Supabase session to extension after login
```
Security: Validated against `KNOWN_ORIGINS` whitelist (`localhost:3000`, `localhost:5173`).

### 2. `content.js` (Content Script)

Injected into every tab at `document_idle`. This is the active intelligence layer.

**Responsibilities:**
- Detect if current page is a job application form
- Build DOM hash and field inventory
- Apply autofill values received from background
- Listen for form submission events
- Trigger overlay display

**Field Detection Strategy:**
1. Pattern match URL against known ATS domains
2. Look for known field identifiers: `name`, `aria-label`, `placeholder`, `data-automation-id`
3. Hash the DOM structure for idempotent re-analysis
4. Classify ambiguous fields by sending to `evaluate-context` API

### 3. Utility Modules

| File | Purpose |
|------|---------|
| `utils/state-machine.js` | Execution state machine (TRACKED → IDENTIFIED → KILL_ZONE → SUBMITTED) |
| `utils/telemetry-buffer.js` | Buffers telemetry events, flushes every 30s or 10 events |
| `utils/dom-hasher.js` | Stable DOM structure hash for form caching |
| `utils/field-ontology.js` | Field type taxonomy: name, email, phone, resume, cover_letter, linkedin, etc. |
| `utils/ats-adapter.js` | ATS-specific autofill strategies (Greenhouse, Lever, Workday, etc.) |

### 4. Overlay UI

A React application injected into the page as a shadow DOM component:
- Shows job recommendation context (match score, probability, key reasons)
- Provides quick "Apply" / "Skip" actions
- Displays missing skills and resume improvement tips
- Bundled by Vite into `dist/overlay/overlay.js` + `overlay.css`

### 5. Popup UI

The extension popup (badge click):
- Auth state display (logged in / not logged in)
- Connect Account button → opens auth-bridge
- Current execution status
- Quick stats (applications submitted today)
- Bundled into `dist/popup/index.html`

---

## Auth Flow

```
User clicks "Connect Account" in popup
    ↓
Background opens localhost:5173/?view=auth-bridge&ext_id=<extension_id>
    ↓
User logs in via Supabase Auth on the web app
    ↓
AuthBridge.tsx calls chrome.runtime.sendMessage(ext_id, { type: 'AUTH_HANDOFF', session })
    ↓
background.js receives session, stores JWT in chrome.storage.session
    ↓
Popup receives AUTH_STATE_CHANGED broadcast
```

**Security:** Only origins in `KNOWN_ORIGINS` can send `AUTH_HANDOFF`. Extension ID is validated by Chrome.

---

## Current Weaknesses

1. **`SUPABASE_ANON_KEY` hardcoded in background.js** — Anyone who installs or decompiles the extension has the anon key. This is low-risk (anon key is designed to be public) but creates a false impression of security.
2. **MV3 service worker lifecycle** — Service workers can be terminated by Chrome. Any in-progress `setTimeout`-based operations will be lost. The heartbeat must re-initialize on each message.
3. **No production URL in externally_connectable** — `externally_connectable.matches` only includes localhost. The production web app domain must be added before app store release.
4. **Iframe autofill not supported** — Many enterprise ATS systems (iCIMS, Workday enterprise) render application forms in iframes. The `all_frames: true` content script setting mitigates this partially, but cross-origin iframes cannot be scripted.
5. **No shadow DOM penetration strategy** — Web Components-based ATS forms (some Workday implementations) are not consistently detected.
