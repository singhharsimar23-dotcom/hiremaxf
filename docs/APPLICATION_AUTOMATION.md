# Application Automation
> Primary Function: `supabase/functions/execution-engine/`
> Extension counterpart: `chrome-extension/content.js`, `ats-adapter.js`
> Last Updated: 2026-03-11

---

## Process

The application automation pipeline runs when a user initiates an execution run from `ApplicationExecutionView.tsx` or `ExecutionPreviewView.tsx`.

### Step 1: Execution Run Created
```typescript
// Frontend
const run = await supabase.from('execution_runs').insert({
  user_id, resume_id, target_role, status: 'pending'
});
```
A list of matching jobs is loaded from `execution_targets`. Each target has: `job_title`, `company`, `apply_url`, `status: 'queued'`.

### Step 2: Extension Opens Job URL
Background opens each `apply_url` in a new tab via `chrome.tabs.create()`.

### Step 3: DOM Analysis
When the tab loads, `content.js` fires:
```
Page load detected
    ↓
DOM hash computed (dom-hasher.js)
    ↓
Fields collected: { selector, type, label, placeholder, aria-label }
    ↓
ANALYZE_PAGE message → background.js
    ↓
POST execution-engine/evaluate-context
    ↓
Returns: { strategy: { fills: [{selector, value}], ambiguous: [], skip_count } }
```

### Step 4: Field Classification
The `evaluate-context` endpoint:
1. Checks `dom_knowledge_base` for known field patterns for this URL/ATS type
2. If low confidence: calls Gemini with the field inventory and resume data
3. Returns a JSON mapping of `{ selector → field_type }` for each detected field
4. Caches result in `dom_knowledge_base` for future visits

### Step 5: Resume Data Retrieval
For file upload fields:
- `FETCH_SIGNED_RESUME` message → background → `execution-engine/resume/get-signed-url`
- Backend fetches a signed URL from Supabase Storage
- Content script uses the URL to programmatically upload the file

### Step 6: Autofill
```javascript
// content.js autofill loop
for (const fill of strategy.fills) {
  const el = findElement(fill.selector);  // tries ID, name, aria-label, nth-child
  if (el.tagName === 'SELECT') setSelectValue(el, fill.value);
  else if (el.type === 'file') injectFile(el, fill.signedUrl);
  else setInputValue(el, fill.value);
  
  // Dispatch native events for React/Angular compatibility
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  el.dispatchEvent(new Event('blur', { bubbles: true }));
}
```

### Step 7: Custom Questions (Rich Answers)
For non-standard essay fields:
- Detected by `field-ontology.js` as `type: 'essay'` or `type: 'custom_question'`
- `GENERATE_RICH_ANSWERS` message sent to background
- Background calls `execution-engine/generate-rich-answers`
- Gemini generates contextual, resume-grounded answer for each question
- Answer injected into the field

### Step 8: Submission
Extension waits for user confirmation or auto-submits (depending on plan + settings):
- `APPLICATION_SUBMITTED` event fires on success
- Background calls `execution-engine/audit/execution` to log outcome
- `execution_targets` row updated: `status: 'submitted'`
- `execution_runs` status updated if all targets complete

---

## Supported Fields

| Field Type | Detection Method | Fill Method |
|-----------|-----------------|------------|
| `first_name`, `last_name` | `name=` attribute, `aria-label` | Direct text input |
| `email` | `type="email"`, label matching | Direct text input |
| `phone` | `type="tel"`, label matching | Direct text input |
| `linkedin_url` | `aria-label="LinkedIn"`, placeholder | Direct text input |
| `github_url` | Label/placeholder matching | Direct text input |
| `resume` (file) | `type="file"` + `accept=".pdf"` | JIT signed URL upload |
| `cover_letter` | Large textarea + label analysis | Direct text / AI-generated |
| `salary_expectation` | Label matching | From profile metadata |
| Custom essay | AI classification | LLM-generated answer |
| Dropdown (years exp) | `<select>` + label + known values | Closest match select |
| Checkbox agreements | `[type="checkbox"]` near "agree" text | Auto-check |

---

## Edge Cases

| Case | Handling |
|------|---------|
| Multi-step forms | `state-machine.js` tracks step progress; each step re-analyzes DOM |
| Dynamic AJAX fields | Content script observes DOM mutations via `MutationObserver` |
| Shadow DOM fields | Partial support via `all_frames: true`; cross-origin shadow roots not penetrable |
| CAPTCHAs | Not bypassed — user must complete manually; execution pauses and waits |
| Session-gated forms | User must be logged in to the job site; extension surfaces prompt |
| Rate limiting (429) | Background receives 429, returns `RATE_LIMITED` — execution pauses |
| Expired session (401) | Background clears session, broadcasts `AUTH_STATE_CHANGED` |
| Upgrade required (426) | Application not submitted; upgrade prompt shown in overlay |

---

## Manual Override System

Users can right-click any editable field:
1. Context menu: **Assign HireMax Field → [First Name / Email / Resume / ...]**
2. Background builds a CSS selector path for the element
3. `SAVE_MANUAL_MAPPING` → `execution-engine/learn-mapping` → stored in `dom_knowledge_base`
4. Next time this URL is visited, the manual mapping is retrieved and applied before AI classification
5. Notification: "HireMax AI Learned — Mapped 'Email' — noted for future forms!"

---

## Telemetry Events

Every field interaction generates a telemetry event:

```javascript
{
  event_type: 'FIELD_FILLED' | 'FIELD_SKIPPED' | 'FORM_SUBMITTED' | 'ATS_DETECTED',
  ats_platform: string,
  execution_id: string,
  field_type: string,
  success: boolean,
  error?: string,
  timestamp: string
}
```

Events are buffered in `telemetry-buffer.js` and flushed every 30 seconds or every 10 events to `execution-engine/record-telemetry-batch`.

---

## Current Weaknesses

1. **No CAPTCHA handling** — Any ATS that serves a CAPTCHA will block the automation. No external CAPTCHA solver is integrated.
2. **File upload instability** — JIT signed URL approach requires the URL to remain valid until the form is submitted. Most Supabase signed URLs expire in 60 seconds — adequate but tight for slow connections.
3. **React/Vue controlled inputs** — Some ATS systems use React `controlled` inputs that require a native event simulation chain. The current `dispatchEvent` strategy works for most but fails on some Workday enterprise implementations.
4. **No retry logic** — If a field fill fails, the automation continues to the next field. Failed fills are logged but not retried.
5. **Parallel tab limits** — Chrome limits simultaneous tab operations. If an execution run has 20 targets, all 20 tabs are opened simultaneously, creating resource pressure.
6. **No human-in-the-loop review** — Automation submits without user preview by default. A wrong autofill can send incorrect information to an employer.
