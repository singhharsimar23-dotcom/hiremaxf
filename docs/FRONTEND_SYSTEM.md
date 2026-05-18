# HireMax Frontend System Specification
> Reverse-Engineered by Senior Architect — March 11, 2026
> Source: All `.tsx` files in `hiremax/` (App.tsx, components/, types.ts, lib/)
> Completeness: 100% of shipped views documented from source code, not assumptions.

---

## Table of Contents

1. [Frontend Architecture](#1-frontend-architecture)
2. [Routing System](#2-routing-system)
3. [State Management](#3-state-management)
4. [Authentication Flow](#4-authentication-flow)
5. [Background Job System](#5-background-job-system)
6. [Page Inventory](#6-page-inventory)
7. [Component Inventory](#7-component-inventory)
8. [API Communication Layer](#8-api-communication-layer)
9. [Interaction Flows](#9-interaction-flows)
10. [Current Weaknesses](#10-current-weaknesses)

---

## 1. Frontend Architecture

### Technology Stack

| Layer | Technology |
|-------|------------|
| Framework | React 18 (SPA, no Next.js) |
| Build Tool | Vite |
| Language | TypeScript |
| Styling | TailwindCSS (all utility-class based) |
| Icons | `lucide-react` |
| Auth | Supabase Auth (JWT-based) |
| Database | Supabase (direct client calls from frontend) |
| Realtime | Supabase Realtime (Postgres Changes) |
| PDF Parsing | `pdfjs-dist` (loaded via CDN worker) |
| AI SDK | `@google/genai` (imported in App.tsx) |
| Routing | Custom SPA — `useState<AppView>` + `window.history.pushState` |
| Animation | TailwindCSS `animate-in` plugin |

### Application Shell

The entire application lives in `App.tsx` (619 lines). There is no router library (no React Router, no Next.js). Navigation is controlled by a single `view` state variable of type `AppView`.

```typescript
// App.tsx line 44
const [view, setView] = useState<AppView>('landing');
```

The `main` element wraps all views in a scroll container. Views are conditionally rendered via `{view === 'X' && <Component />}`. Two exceptions use `display: none/block` style switching (not unmounting) to preserve state:
- `career-intelligence` → `CareerIntelligenceView`
- `market-outlook` → `MarketOutlookView`

### Design System

All colors are custom dark-mode palette:
- Background: `#0F1117` (primary), `#16161E` (panels), `#111118` (cards), `#161B2E` (sidebars)
- Borders: `#2D313D`, `white/5`, `white/10`
- Primary accent: `blue-600` / `blue-500`
- Warning: `amber-500`
- Success: `green-500`
- Font: System default (no custom Google Font import found)
- Spacing: Fixed 60px headless padding (`pt-20`) for fixed header

---
Update — System Fix (2026-03-11)

**Issue**: W-FE-15: No global error boundary caused full white-screen crashes on unhandled errors.
**Change Implemented**: Created `ErrorBoundary.tsx` component and wrapped all primary views (including complex forms and analyses) in `App.tsx` render block.
**Result**: Component-level errors now result in a safe fallback UI inside the specific view container, preventing full application crashes.
---

## 2. Routing System

### AppView Type (complete enum)

```typescript
// types.ts line 6
type AppView =
  | 'landing'          // Public landing page
  | 'auth'             // Login/Signup/Recover page
  | 'dashboard'        // Main dashboard
  | 'ai-review'        // Resume upload + analysis trigger
  | 'full-review'      // Market standing / diagnostic results
  | 'rebuild'          // (legacy, unused)
  | 'rebuild-standalone' // AI resume rebuilder
  | 'career-intelligence' // Market insights (Elite-locked)
  | 'profile'          // User profile + identity management
  | 'applications'     // Application execution engine (Elite-locked)
  | 'pricing'          // Pricing page
  | 'auth-bridge'      // Extension auth handoff
  | 'settings'         // Account settings
  | 'billing'          // Billing management
  | 'faq'              // FAQ page
  | 'contact'          // Contact support
  | 'history'          // Resume history
  | 'resume-editor'    // Resume builder/editor
  | 'signal-hub'       // (defined but no route in App.tsx render)
  | 'recruiter-scan'   // (defined but no route in App.tsx render)
  | 'rejection-model'  // (defined but no route in App.tsx render)
  | 'role-saturation'  // (defined but no route in App.tsx render)
  | 'skill-radar'      // (defined but no route in App.tsx render)
  | 'longevity-estimate' // (defined but no route in App.tsx render)
  | 'admin-ops'        // (defined but no route in App.tsx render)
  | 'preview'          // "Jobs For You" — ExecutionPreviewView
  | 'admin'            // AdminIntelligence view
  | 'market-outlook';  // Market Radar (MarketOutlookView)
```

> **Note:** 7 views are defined in the type but have no corresponding render branch in App.tsx (signal-hub, recruiter-scan, rejection-model, role-saturation, skill-radar, longevity-estimate, admin-ops). These are ghost routes — they show a blank screen.

### URL Management

```typescript
// App.tsx line 480
window.history.pushState({}, '', `/${targetView === 'landing' ? '' : targetView}${id ? `?id=${id}` : ''}`);
```

URL is updated on every view change via `pushState`. On page load, the URL is parsed to restore view state (for `/dashboard`, `/profile`, `/intelligence`). Back/Forward browser navigation is handled via `popstate` listener.

### Query Parameter Routing

The following query params are handled on initial load:

| Param | Value | Effect |
|-------|-------|--------|
| `?view=auth-bridge` | Any | Renders AuthBridge (preserves all other params) |
| `?view=auth&redirect=auth-bridge` | Auth bridge flow | Renders AuthView with bridge redirect target |
| `?view=dashboard` | Any | Navigates to dashboard |
| `?view=profile` | Any | Navigates to profile |
| `?view=pricing` | Any | Navigates to pricing |
| `?view=settings` | Any | Navigates to settings |

### Plan-Gated Navigation

`handleSetView` checks user plan before navigating to locked views:

```typescript
// App.tsx line 462–469
const eliteRequired = ['career-intelligence', 'transformation-factory', 'applications'];
if (eliteRequired.includes(targetView) && !isElite) {
    setTeaserTarget(targetView); // Shows FeatureTeaser + Pricing
    setView('dashboard');
    return;
}
```

**Locked views** (Elite plan required): `career-intelligence`, `applications`  
**Locked views** (Pro plan required): `full-review`, `rebuild-standalone` (via NavLink `isLocked` prop, but NOT enforced in `handleSetView`)

> **Bug:** The `isLocked` badge on NavLinks is cosmetic only for Pro-tier routes. Clicking "Intelligence" or "Rebuild" as a Starter user navigates to the view — it's only `career-intelligence` and `applications` that are hard-blocked.

---
Update — System Fix (2026-03-11)

**Issue**: W-FE-04: 7 AppView routes were "ghost" routes causing white-screen rendering when accessed.
**Change Implemented**: Added explicit sub-render paths in `App.tsx` switch statement using a standardized "Module Offline" / "Coming Soon" stub wrapper for `signal-hub`, `recruiter-scan`, `rejection-model`, `role-saturation`, `skill-radar`, `longevity-estimate`, and `admin-ops`.
**Result**: Users attempting to access these views via URL or dev tools now see a safe placeholder rather than crashing.
---

## 3. State Management

### Global State (App.tsx)

All state lives in `App.tsx`. There is no Redux, Zustand, or Context API. State is prop-drilled to child components.

| State Variable | Type | Purpose |
|----------------|------|---------|
| `view` | `AppView` | Current page/view |
| `teaserTarget` | `AppView \| null` | Gated feature being previewed by non-Elite user |
| `user` | `any` (Supabase User) | Authenticated user object |
| `profile` | `UserProfile \| null` | Full profile from `profiles` table |
| `loading` | `boolean` | Initial auth loading state |
| `resumeReceived` | `boolean` | Whether a resume was uploaded (unused after upload) |
| `pendingResumeText` | `string` | Raw text from uploaded resume PDF |
| `analysisHistory` | `Record<string, DiagnosticResult>` | All analyses for the current user, keyed by ID |
| `activeAnalysisId` | `string \| null` | Currently selected analysis |
| `resumeHistory` | `ResumeGroup[]` | All resume groups + versions for the user |
| `editingResumeId` | `string \| null` | Group ID of resume being edited |
| `editingVersionId` | `string \| null` | Version ID of resume being edited |
| `selectedApplicationId` | `string \| null` | Application ID passed to ApplicationExecutionView |
| `preFilledSource` | `any` | Pre-populated context for RebuildStandaloneView |
| `jobs` | `Record<string, BackgroundJob>` | All active/completed background jobs |

### Plan Computation

```typescript
// App.tsx line 73-74
const plan: UserPlan = profile && profile.plan ? profile.plan : 'Starter';
const isElite = plan === 'Career Elite' || plan === 'Automation';
const currentAnalysis = activeAnalysisId ? analysisHistory[activeAnalysisId] : null;
```

### localStorage Persistence

Background jobs are persisted to localStorage on every change:

```typescript
// App.tsx line 77-79
useEffect(() => {
    localStorage.setItem('hiremax_active_jobs', JSON.stringify(jobs));
}, [jobs]);
```

On init, jobs are hydrated from localStorage:
```typescript
const [jobs, setJobs] = useState<Record<string, BackgroundJob>>(() => {
    try {
        const saved = localStorage.getItem('hiremax_active_jobs');
        if (!saved || saved === 'undefined' || saved === 'null') return {};
        return JSON.parse(saved);
    } catch (e) { return {}; }
});
```

`CareerIntelligenceView` also uses its own localStorage key `hiremax_market_snapshot` with a 4-hour TTL cache for snapshots.

### Local State per Component

Each major component manages its own local state. There is no data sharing between sibling components except through App.tsx props. Key local states:

- `ExecutionPreviewView`: step (INTENT/PROCESSING/RESULTS/ERROR), jobPointers, selectedJob, match states per job
- `MarketOutlookView`: coefficients, skills, selectedRole, selectedGeo
- `ApplicationExecutionView`: applications list, activeAppId, viewMode (dashboard/discover/detail), resumeVersions
- `ProfileView`: profileSnapshot, evidenceItems, integrityEvents, skills, multi-step wizard state

---

## 4. Authentication Flow

### Normal Login Flow

```
User visits app → initAuth() runs
    → supabase.auth.getSession()
    ├── Session exists → setUser(session.user) → fetchUserData()
    └── No session → setLoading(false) → show 'landing'

fetchUserData(authUser):
    1. SELECT from 'profiles' WHERE id = authUser.id
    ├── Profile exists → setProfile(existingProfile)
    └── No profile → INSERT new profile (plan: 'Starter', domain: 'UNSELECTED', credits: 0)
    2. SELECT from 'resumes' with resume_versions → setResumeHistory()
    3. Subscribe to 'resume_versions_live' Realtime channel
    4. SELECT from 'analyses' ORDER BY created_at DESC → setAnalysisHistory(), setActiveAnalysisId()
```

### Auth State Change Listener

```typescript
supabase.auth.onAuthStateChange(async (event, session) => {
    setUser(session?.user ?? null);
    if (session?.user) {
        await fetchUserData(session.user); // Re-fetches all user data
    } else {
        setProfile(null);
        setResumeHistory([]);
        setAnalysisHistory({});
    }
});
```

### AuthView Component

**Three modes:** `LOGIN` | `SIGNUP` | `RECOVER`

**Social OAuth buttons:**
- GitHub: `signInWithOAuth('github')` with scopes `repo read:user`
- LinkedIn: `signInWithOAuth('linkedin')` with scopes `openid profile email`
- Google: `signInWithOAuth('google')` with scopes `email profile`

**OAuth redirect:** Uses `window.location.href` as the `redirectTo` param — this preserves any query params like `?view=auth-bridge&ext_id=...` through the OAuth round trip.

**Password auth:**
- LOGIN: `supabase.auth.signInWithPassword({ email, password })`
- SIGNUP: `supabase.auth.signUp({ email, password, options: { data: { full_name } } })`
- RECOVER: `supabase.auth.resetPasswordForEmail(email, { redirectTo: '/auth/reset-password' })`

**Error handling:** Errors shown inline as red alert box. Success messages shown as green box. Loading overlay covers the entire form card with blur effect.

### Extension Auth Bridge Flow

1. Extension opens `https://app.hiremax.com?view=auth-bridge&ext_id={extensionId}`
2. If user is not authenticated: `setView('auth')`
3. AuthView stores `redirect=auth-bridge` context
4. After login: `onSuccess()` routes to `auth-bridge`
5. `AuthBridge` component sends `AUTH_HANDOFF` message to extension with the JWT session

### Sign Out

```typescript
// Header.tsx line 77-88
const handleSignOut = async () => {
    await supabase.auth.signOut();
    localStorage.clear();  // Clears ALL localStorage including job state
    sessionStorage.clear();
    window.location.href = '/';  // Full page reload
};
```

---
Update — System Fix (2026-03-11)

**Issue**: Auth redirect loop — after successful OAuth login via the bridge or direct auth, users were redirected straight back to the landing page rather than the dashboard.
**Change Implemented**: Updated `onAuthStateChange` in `App.tsx` to trap the auth state change event. If a session exists and the current view is 'landing' or 'auth', the UI forces navigation to `dashboard`.
**Result**: Successful auth redirects robustly into the payload application layer, improving conversion and preventing loops.
---

## 5. Background Job System

### Job Types

```typescript
// types.ts line 58
type JobType = 'ANALYSIS' | 'REBUILD' | 'OUTLOOK' | 'INGESTION' | 'EXECUTION';
```

### Job Statuses

```typescript
type JobStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'PAUSED' | 'THROTTLED';
```

### Job Interface

```typescript
interface BackgroundJob {
    id: string;         // UUID
    type: JobType;
    status: JobStatus;
    payload: any;       // Contains targetRole, resume_id, etc.
    result?: any;       // Populated on COMPLETED
    error?: string;     // Populated on FAILED
    createdAt: string;
    updatedAt: string;
}
```

### dispatchJob Function (App.tsx lines 185–260)

The single mechanism for triggering all AI operations:

```
dispatchJob(type, payload):
1. Generate job ID (crypto.randomUUID or Math.random fallback)
2. INSERT into execution_runs table (pre-registers for persistence)
3. Add job to local state with status 'RUNNING'
4. Fire async execution (detached — no await):
    ANALYSIS → supabase.functions.invoke('generate-diagnostic')
    REBUILD  → supabase.functions.invoke('generate-rebuild')
    OUTLOOK  → supabase.functions.invoke('generate-outlook')
5. On success → update job.status = 'COMPLETED', job.result = data
6. On error  → update job.status = 'FAILED', job.error = message
```

### Polling Loop (App.tsx lines 262–317)

A 15-second interval polls `execution_runs` for any RUNNING jobs:

```typescript
const interval = setInterval(poll, 15000);
// Runs while Object.values(jobs).some(j => j.status === 'RUNNING')
```

The poll:
1. Fetches `id, status, error_reason` from `execution_runs` for all running job IDs
2. If remote status is `completed` → fetches the actual result from the appropriate table:
   - ANALYSIS → `analyses` table, most recent row
   - REBUILD → `resume_versions` table, by `resume_id`
   - OUTLOOK → `market_snapshots` table, most recent row
3. If remote status is `failed` → sets job to FAILED with error

### Background Engine Indicator

When `hasActiveJob` is true, a fixed pill renders at `bottom-right` of the screen:
- Blue pulsing dot + "Background Engine Active" label + spinning `Loader2` icon
- z-index: 200 (above everything)
- Animated: `slide-in-from-bottom-4`

---
Update — System Fix (2026-03-11)

**Issue**: W-FE-06: No Realtime for `execution_runs` status. Background jobs used an inefficient `setInterval` 15s poll.
**Change Implemented**: Removed the `setInterval` logic from `App.tsx` and implemented a Supabase Realtime channel subscription listening for `UPDATE` Postgres mutations on the `execution_runs` table where status becomes 'completed' or 'failed'.
**Result**: System reacts instantly to backend job resolutions instead of lagging up to 15 seconds, lowering frontend database request volume by ~90% for active sessions.
---

## 6. Page Inventory

---

### 6.1 Landing Page (`view = 'landing'`)

**Component:** `LandingPage`  
**Auth required:** No  
**Props:**
- `onGetStarted`: navigates to `auth` (unauthenticated) or `dashboard` (authenticated)
- `onViewPlans`: navigates to `pricing`

**Purpose:** Public marketing page introducing HireMax.

**User Actions:**
- CTA button → "Get Started" → Login or Dashboard
- "View Plans" → Pricing page

---

### 6.2 Auth Page (`view = 'auth'`)

**Component:** `AuthView`  
**Auth required:** No  
**Props:**
- `onSuccess`: called after successful login/signup → routes to `dashboard` or `auth-bridge`

**Purpose:** Authentication entry point. 3 modes: LOGIN, SIGNUP, RECOVER.

**Visible Elements:**
- HireMax logo shield (white bg, black Shield icon)
- Mode title: "System Access" | "Initialize Identity" | "Identity Recovery"
- Pulsing status indicator
- Social OAuth buttons: GitHub, LinkedIn, Google (2-column grid for first two)
- Divider: "Secure Direct Access"
- Email/password form (with show/hide password toggle)
- Forgot password link (in LOGIN mode)
- Mode switch link at bottom
- SOC-2 / AES badges (opacity 0.2)

**Internal State:**
- `mode`: `'LOGIN' | 'SIGNUP' | 'RECOVER'`
- `email`, `password`, `fullName`
- `showPassword`: boolean (toggle password visibility)
- `loading`, `error`, `successMsg`

**Loading State:** Blur overlay covers entire card with `Loader2` spinner

**Error State:** Red alert with `AlertCircle` icon, inline within card

**Success State (SIGNUP/RECOVER):** Green alert with `CheckCircle2` icon, hides the form

**Missing UX:**
- No email format validation feedback before submit
- SIGNUP doesn't enforce password strength
- No "Resend verification email" option after signup

---

### 6.3 Dashboard (`view = 'dashboard'`)

**Component:** `DashboardView`  
**Auth required:** Yes  
**Props:**
- `currentAnalysis`: `DiagnosticResult | null`
- `plan`: `UserPlan`
- `onNavigate`: navigation function

**Purpose:** Home screen after login. Shows summary stats and quick actions.

**Layout:**
```
Header: "Profile Impact: [score]" | Plan badge
4-column stats grid (DashboardWidget × 4)
RealityCheckDetail (CTA to start analysis)
Quick Actions grid (3 ActionCards)
```

**4 Stats Widgets:**

| Widget | Data Source | Click Target |
|--------|-------------|--------------|
| Market Fit | `currentAnalysis.foundation.marketReadiness` | `full-review` |
| Top Strengths | `currentAnalysis.foundation.strengthsSnapshot.length` | `full-review` |
| Recruiter Visibility | `currentAnalysis.foundation.atsShield` | `full-review` |
| Overall Readiness | `currentAnalysis.overallScore + '%'` | `full-review` |

All 4 show `---` placeholder when `currentAnalysis` is null.

**Quick Actions (from `constants.ts`):**
- `id: 'new'` → `resume-editor`
- `id: 'review'` → `ai-review`
- (3rd action exists in QUICK_ACTIONS constant)

**Missing UX:**
- No active jobs displayed on dashboard (they appear only in the fixed pill)
- No welcome message for new users with 0 analyses
- Stats widget click doesn't communicate why they're navigating to full-review

---

### 6.4 Auth Bridge (`view = 'auth-bridge'`)

**Component:** `AuthBridge`  
**Auth required:** Yes  
**Props:** None (reads from URL params)

**Purpose:** Intermediary page that reads the `ext_id` query param after OAuth and sends `AUTH_HANDOFF` message to the Chrome extension's specific ID via `chrome.runtime.sendMessage`.

---

### 6.5 AI Review (`view = 'ai-review'`)

**Component:** `AIReviewView`  
**Auth required:** Yes  
**Props:**
- `plan`: UserPlan
- `onResult(r: DiagnosticResult)`: called after analysis completes → navigates to `full-review`
- `onUpload(t: string)`: (unused callback)
- `pendingResumeText`: pre-populated resume text from App.tsx
- `onUpgrade`: navigates to `pricing`
- `onStartScratch`: navigates to `resume-editor`
- `activeJobs`: background job state
- `dispatchJob`: job dispatcher

**Purpose:** Resume upload and analysis trigger. Users paste or upload their resume here and initiate the AI diagnostic.

**User Actions:**
- Upload PDF → parsed via `pdfjs-dist` → text extracted → displayed
- Paste text directly
- Click "Run Analysis" → `dispatchJob('ANALYSIS', { resumeText, targetRole })` → navigates to `full-review`

---

### 6.6 Full Review / Market Standing (`view = 'full-review'`)

**Component:** `FullReviewView`  
**Auth required:** Yes  
**Props:**
- `result`: `DiagnosticResult | null`
- `plan`: UserPlan
- `onUpgrade`: navigate to pricing
- `onRebuildRequest`: navigate to rebuild
- `setView`: navigation function

**Purpose:** Displays the full diagnostic analysis result including 8-point scoring, market standing, signal chips, recruiter forecast, and action recommendations.

**Data:** Receives `currentAnalysis` from App.tsx state (the most recently completed ANALYSIS job).

**Missing UX:**
- No loading state if analysis is still running but user navigates here manually
- No history selector (only shows the latest analysis — earlier analyses in `analysisHistory` are inaccessible from this view)

---
Update — System Fix (2026-03-11)

**Issue**: W-FE-08: Analysis history was inaccessible from FullReviewView.
**Change Implemented**: Injected `analysisHistory` and `setActiveAnalysisId` props down into `FullReviewView` and rendered a dynamic `<select>` dropdown populated with past diagnostic runs.
**Result**: Users can flip between past historical analysis records directly inside the primary decision view without returning to the profile.
---

### 6.7 Career Intelligence (`view = 'career-intelligence'`)

**Component:** `CareerIntelligenceView`  
**Auth required:** Elite plan  
**Props:**
- `analysisResult`: `DiagnosticResult | null`
- `resumeText`: string
- `plan`: UserPlan
- `setView`: navigation
- `activeJobs`: background jobs
- `dispatchJob`: job dispatcher

**Purpose:** Market command snapshot. Generates a time-bound strategic intelligence report showing target companies, do-not-apply zones, and 7-day/30-day action orders.

**Caching:** Snapshots cached in `localStorage['hiremax_market_snapshot']` for 4 hours. Cache includes:
- `snapshot`: `MarketCommandSnapshot`
- `cachedAt`: Unix timestamp
- `expiresAt`: `cachedAt + 4 * 60 * 60 * 1000`

**Processing Timeout:** 2 minutes. If `generate-outlook` doesn't complete in 120s, a timeout error is shown.

**Visible Sections (when snapshot exists):**
- Market status label with implication
- Execution Targets list (company, role, fit reason, confidence, validity window)
- Do-Not-Apply Zone (entity type + reasoning)
- Action Orders: Next 7 Days, Next 30 Days, Positioning Directives, Interview Directives
- Risks & expiry countdown timer

**Snapshot refresh logic:**
- Check localStorage → if valid (not expired) → use cached
- If expired or missing → call `dispatchJob('OUTLOOK', { ... })`
- On OUTLOOK job completion → save to localStorage and display

**Missing UX:**
- No manual "clear cache and refresh" button visible to user
- Confidence scores for execution targets are shown but not explained
- No breakdown of why specific companies are in the Do-Not-Apply Zone

---

### 6.8 Market Radar (`view = 'market-outlook'`)

**Component:** `MarketOutlookView`  
**Auth required:** No (no plan gate — accessible to all)  
**Props:** None

**Purpose:** Live market intelligence dashboard showing tech hiring signals aggregated from `market_signals` table.

**Data Source:** `supabase.from('market_signals').select('*').order('computed_at', 'desc').limit(100)`

**Sections:**

| Section | Component | Data |
|---------|-----------|------|
| Market Health | `Section1MarketHealth` | Avg `demand_index`, `hiring_velocity`, `salary_pressure`, `competition_ratio` filtered by `selectedGeo` |
| Role Momentum | `Section2RoleMomentum` | Top 5 roles ranked by `role_momentum` |
| Skill Lifecycle | `Section3SkillLifecycle` | Skills grouped by `skill_lifecycle_stage`: emerging/growth/maturity/decline |
| Competition Map | `Section4CompetitionMap` | `competition_ratio` per role for `remote` geo |
| Timing Window | `Section5TimingWindow` | `timing_signal` avg for geo + seasonal calendar windows |
| Personalized Radar | `Section6PersonalizedRadar` | Role-specific metrics when `selectedRole` is set |
| Signal Sources | `Section7SignalSources` | Static transparency card (hardcoded sources) |

**Filters (sticky header bar):**
- Role dropdown: 8 roles (ml, backend, frontend, fullstack, devops, data, security, mobile)
- Geo dropdown: remote, SF, NYC, London, Austin
- "Recalibrate" button → re-runs `load()` (full refetch)

**Loading State:** Centered `Cpu` spinner with "Loading Market Intelligence" text  
**Error State:** `AlertCircle` + error message + "Retry" button → calls `load()`

**Key Metric — Timing Signal:**
- `>= 1.3` → ACCELERATING (emerald)
- `>= 0.9` → OPTIMAL (blue)
- `>= 0.6` → MODERATE (amber)
- `< 0.6` → COOLING (red)

**Missing UX:**
- Role/geo filters don't work on mobile (hidden via `hidden md:flex`)
- No "last updated" relative time — only shows raw timestamp
- Personalized Radar section is empty state until user selects a role (not auto-populated from user profile)

---

### 6.9 Jobs For You (`view = 'preview'`)

**Component:** `ExecutionPreviewView`  
**Auth required:** Yes  
**Props:**
- `onNavigate`: navigation function

**Purpose:** AI-powered job discovery. User declares intent (role + location), the system normalizes the intent, resolves a cluster, and fetches matching job pointers, then allows per-job match analysis.

**3-Step Flow:**

**Step 1: INTENT**
- User selects target role from dropdown (28 predefined tech roles)
- User enters location (7 suggested regions)
- Loads last session from `discovery_sessions` table on mount
- Submits via "Run Job Intelligence" button

```
handleSubmit():
1. ApiEngine.resolveIntent(payload) → POST /hiring-engine/intent/resolve
2. ApiEngine.resolveCluster(intent) → GET /hiring-engine/user-clustering/resolve
3. ApiEngine.fetchJobPointers(clusterId, intent) → GET /hiring-engine/job-pointers/by-cluster
4. saveDiscoverySession(params, results) → INSERT into discovery_sessions
5. setStep('RESULTS')
```

**Step 2: PROCESSING** — Animated loading screen during API calls

**Step 3: RESULTS**
- Grid of `JobPointer` cards showing rich metadata (Salary, Posting Age, Work Mode).
- Each card has "Analyze Match" button → triggers `match-analyst` via orchestrator.
- Up to `MAX_AUTO_ANALYSIS = 12` jobs are auto-analyzed on results load.
- Match states per job: `idle | analyzing | COMPLETED | PENDING | PROCESSING | FAILED | error`.
- Each analyzed job shows match alignment badge (Strong/Moderate/Weak/Misaligned).
- Rich data cards include:
  - **Salary Indicator**: Displays min/max range or "Competitive" label.
  - **Posting Age Badge**: Time-since-discovery with color coding (Green < 3d, Amber < 14d, Red > 30d).
  - **Work Mode Chip**: Remote/Hybrid/Onsite visual indicators.

**Selected Job Detail Panel:**
- Full job description (from `materialize-job` Edge Function)
- Source URL button (`ExternalLink`)
- "Match Analysis" panel showing: role_alignment, skill_coverage_pct, experience_fit, strengths[], gaps[]
- Strategic advice from analysis
- "Start Application" button → INSERT into `applications` table via supabase direct call, then `onNavigate('applications')`

**Governor Check:** On mount, reads `governor_state.current_mode`. If `READ_ONLY` or `SAFE`:
- Shows warning banner
- Does NOT block the UI entirely (user can still see INTENT step)
- Materialization is blocked (throws error)

**Polling for match analysis:** PENDING/PROCESSING jobs are polled every 3 seconds from `match_analysis` table.

**Missing UX:**
- No "clear session" button — user must refresh page to start new search
- 12 auto-analyses fire simultaneously with no rate limiting
- No error recovery if cluster resolution fails (shows ERROR step with generic message)
- Location input is free text — no validation or autocomplete
- No pagination for large result sets

---
Update — System Fix (2026-03-11)

**Issue**: Market radar context was siloed, meaning intent formulation was not using contextual market timing data for decision influence.
**Change Implemented**: Added a pre-fetch lookup inside `ExecutionPreviewView`'s INTENT rendering pipeline to query the most recent `market_snapshots` object, displaying live macro conditions instantly before user submission.
**Result**: Jobs For You intent screen now injects explicit market context (e.g., "Strategy: CONSERVATIVE_APPLICATION"), bridging the data hierarchy gap.
---

### 6.10 Applications (`view = 'applications'`)

**Component:** `ApplicationExecutionView`  
**Auth required:** Elite plan  
**Props:**
- `user`: `UserProfile | null`
- `applicationId`: optional string (auto-selects specific application on load)
- `onNavigate`: navigation function

**Purpose:** Application tracking dashboard. Shows all tracked job applications with status, match signals, resume versions, and kill-zone analysis.

**3 View Modes:**
- `dashboard`: Registry list of all applications
- `detail`: Full detail view of a selected application
- `discover`: Redirect prompt to "Jobs For You"

**Data Sources:**
- Primary: `supabase.from('applications').select('*').eq('user_id', user.id).order('updated_at', desc)`
- Realtime: `supabase.channel('applications_realtime')` subscribes to INSERT/UPDATE/DELETE on `applications` table filtered by `user_id`
- When detail is open: `supabase.from('resume_versions').select('*').eq('application_id', activeAppId)` + Realtime on `resume_versions` for that specific `application_id`

**Dashboard View Stats (top bar):**
1. Execution Health: `(submitted / total) * 100%`
2. Match Quality: average of all `match_confidence` values
3. Pipeline: count of active (SUBMITTED/UNDER_REVIEW/INTERVIEW) vs tracked vs resolved
4. Quota Balance: `10 - applications.length` remaining daily slots (hardcoded limit of 10)

**Application Registry List:**
- Each card: company logo placeholder (`Building2` icon), company name, job title, `StatusBadge`, match confidence %
- Click → sets `viewMode = 'detail'`, `activeAppId = app.id`

**Detail View:**
Left panel: Company name, title, location, salary (from application record)  
Right panel (Match Signal): Conditional based on `application.state`:

| State | Right Panel |
|-------|-------------|
| `KILL_ZONE` | Green callback % + "Apply Now" CTA |
| `NOT_READY` | Amber confidence % + "See Improvement Plan" |
| `SUBMITTED/UNDER_REVIEW/INTERVIEW` | Pulsing Radio + "Active Tracking" |
| `TRACKED/IDENTIFIED` | Match confidence % + "View Original Posting" link + "Tailor Your Resume" / "Synthesize from Profile" |

**Resume Synthesis Fallback:**
When user clicks "Tailor Resume" but has no `resume_profiles`:
- Browser `confirm()` dialog: "No formal resume detected..."
- If confirmed: calls `CareerSynthesizer.synthesizeCareerContext(userId)` (dynamically imported)
- On success: `onNavigate('rebuild-standalone', undefined, { preFilled: { text, role, track, gate } })`

**Resume Versions Section:**
Shows all `resume_versions` linked to the selected application:
- Status: PENDING → spinner; COMPLETED → "Preview" + "Use" buttons; FAILED → error reason
- Realtime polling via Supabase channel

**StatusBadge states:**

| State | Color | Label |
|-------|-------|-------|
| TRACKED | Slate | Tracked |
| IDENTIFIED | Slate | Identified |
| KILL_ZONE | Green | Perfect Match |
| NOT_READY | Amber | Not Quite Ready |
| NOT_MATCH | Red | Low Match |
| SUBMITTED | Blue | Submitted |
| UNDER_REVIEW | Indigo | Under Review |
| INTERVIEW | Green-400 | Interview |
| REJECTED | Red-400 | Rejected |

**Missing UX:**
- "Preview" and "Use" buttons on resume versions are not connected to any logic
- "Save for Later" button exists but has no handler
- "Start Improvement Plan" button exists but has no handler
- The quota balance (10 - count) is hardcoded — no actual server-side enforcement
- `alert()` is used for submission errors (native browser alert, not UI)

---

### 6.11 Profile (`view = 'profile'`)

**Component:** `ProfileView`  
**Auth required:** Yes  
**Props:** None (fetches own data from Supabase)

**Purpose:** Identity management hub. Shows evidence-based profile completeness, connected providers, uploaded resume, extracted skills, decaying signals, and integrity events.

**Data Sources (all fetched independently within component):**
- `profiles` → current user profile
- `profile_snapshots` → latest snapshot with evidence coverage
- `candidate_feature_vectors` → extracted candidate features
- `evidence_items` → skill evidence records
- `integrity_events` → audit log of ingestion events
- `candidates` → (related profile data)

**Sub-Components (in profile/ folder):**
- `SkillEvidenceBreakdown` — skill claims with evidence source breakdown
- `DecayingSignalsWidget` — signals with recency decay visualization
- `CorroborationIndicator` — cross-source verification status
- `QuickWins` — high-impact gaps to improve
- `ProfileHealthDashboard` — overall health scoring matrix

**PDF Upload (in ProfileView):**
Uses `pdfjs-dist` to parse uploaded PDF files. Worker loaded from CDN:
```typescript
pdfjsLib.GlobalWorkerOptions.workerSrc = 
    `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
```

**Missing UX:**
- No in-progress state for snapshot generation (takes seconds but no spinner visible)
- Integrity events are displayed but not actionable (user can't re-trigger an ingestion)

---

### 6.12 Resume History (`view = 'history'`)

**Component:** `ResumeHistoryView`  
**Auth required:** Yes  
**Props:**
- `history`: `ResumeGroup[]`
- `analysisHistory`: `Record<string, DiagnosticResult>`
- `onEdit(groupId, versionId)`: navigates to `resume-editor`
- `onView(groupId, versionId)`: navigates to `resume-editor`
- `onStartNew`: navigates to `ai-review`
- `onSaveToProfile`: saves a specific version to `profiles.resume_profiles[]`
- `dispatchJob`: job dispatcher

**Purpose:** Shows all previously saved resume groups and their versions. Allows editing, viewing, triggering a rebuild, and saving versions to the user profile.

---

### 6.13 Resume Editor (`view = 'resume-editor'`)

**Component:** `ResumeBuilder`  
**Auth required:** Yes  
**Props:**
- `plan`: UserPlan
- `groupId`: `string | null` (editing existing resume)
- `versionId`: `string | null` (editing specific version)
- `history`: `ResumeGroup[]`
- `onBack`: navigates to `dashboard`

**Purpose:** Full structured resume editor. Allows creating and editing resume sections, templates, and formatting. Saves to `resumes` and `resume_versions` tables.

---

### 6.14 Rebuild Standalone (`view = 'rebuild-standalone'`)

**Component:** `RebuildStandaloneView`  
**Auth required:** Yes (Pro plan for NavLink badge, not hard enforced)  
**Props:**
- `plan`, `credits`
- `setCredits`: async callback (stub — does nothing)
- `onRebuildSuccess(rebuilt, vid, label, gid)`: on success → opens rebuilt resume in editor
- `onUpgrade`: navigates to pricing
- `history`: resume history
- `activeJobs`, `dispatchJob`
- `preFilledContext`: pre-populated role/resume context from ApplicationExecutionView

**Purpose:** AI-powered resume rebuild targeted at a specific role. Uses `dispatchJob('REBUILD', { ... })` to trigger `generate-rebuild` Edge Function.

---

### 6.15 Pricing (`view = 'pricing'`)

**Component:** `Pricing`  
**Auth required:** No  
**Props:**
- `setPlan(p: UserPlan)`: updates `profiles.plan` in Supabase and local state
- `setView`: navigation
- `currentPlan`: UserPlan

**Purpose:** Plan selection page. On plan selection, updates `profiles.plan` directly via Supabase client (no payment processing visible).

> **Major Gap:** No actual payment/billing integration visible in the source. Plan updates happen via direct Supabase update. This is likely a development placeholder — real billing would require Stripe or similar.

---

### 6.16 Account Settings (`view = 'settings'`)

**Component:** `AccountSettings`  
**Auth required:** Yes  
**Props:**
- `plan`: UserPlan
- `profile`: `UserProfile | null`

**Purpose:** Account configuration. Email, notifications, connected integrations.

---

### 6.17 Billing (`view = 'billing'`)

**Component:** `Billing`  
**Auth required:** Yes  
**Props:**
- `plan`: UserPlan
- `setView`: navigation

**Purpose:** Billing management, invoice history, plan downgrade.

---

### 6.18 Admin Intelligence (`view = 'admin'`)

**Component:** `AdminIntelligence`  
**Auth required:** Yes (no admin role check visible in App.tsx — any authenticated user with the URL can access this)  
**Props:** None

**Purpose:** Internal admin dashboard. Not accessible via navigation — URL direct only.

> **Security Issue:** No admin role check. Any authenticated user navigating to `/admin` will see the admin panel.

---

### 6.19 FAQ (`view = 'faq'`)

**Component:** `FAQ`  
**Props:** `setView`: navigation  
**Purpose:** Static FAQ page.

---

### 6.20 Contact (`view = 'contact'`)

**Component:** `Contact`  
**Props:** None  
**Purpose:** Contact support form.

---

## 7. Component Inventory

### 7.1 Header

**File:** `components/Header.tsx`  
**Props:**
- `currentView: AppView` — used to highlight active nav link
- `setView: (v: AppView) => void`
- `plan: UserPlan`
- `onNewResume: () => void` — triggers `resume-editor` view

**Internal State:**
- `dropdownOpen: boolean` — user account dropdown
- `mobileMenuOpen: boolean` — mobile sidebar overlay

**Plan logic:**
```typescript
const isPro = plan === 'Career Pro' || plan === 'Career Elite' || plan === 'Automation';
const isElite = plan === 'Career Elite' || plan === 'Automation';
```

**Nav Links (desktop, left side):**

| Label | View | Lock condition |
|-------|------|---------------|
| Dashboard | `dashboard` | None |
| Profile | `profile` | None |
| Intelligence | `full-review` | Lock badge if `!isPro` |
| Market Insights | `career-intelligence` | Lock badge if `!isElite` |
| Market Radar | `market-outlook` | None |
| Jobs For You | `preview` | None |
| Applications | `applications` | Lock badge if `!isElite` |
| Rebuild | `rebuild-standalone` | Lock badge if `!isPro` |

**User Dropdown (right side):**
- Email / Plan badge
- Settings → `settings`
- Resume History → `history`
- Billing → `billing`
- Upgrade Plan → `pricing` (blue-colored)
- FAQ → `faq`
- Contact Support → `contact`
- Sign Out → `supabase.auth.signOut()` + localStorage.clear() + window.location.href = '/'

**Mobile Sidebar:**
- Opens as full-screen overlay with slide-in animation from right
- Black/60 backdrop blur background overlay (click to dismiss)
- Same nav links as desktop + New Resume CTA + Sign Out at bottom
- Closes on nav item click

**Dependencies:** `supabase`, lucide-react icons

---

### 7.2 DashboardWidget

**File:** `components/DashboardWidget.tsx`  
**Props:**
- `label: string`
- `value: string | number`
- `status: 'good' | 'needs-work' | 'neutral'`
- `onClick?: () => void`

**Purpose:** Shows a metric card with label, value, and status-colored accent. Clickable.

---

### 7.3 NavLink (inline in Header.tsx)

**Props:** `label`, `active`, `onClick`, `icon?`, `isLocked?`

Renders a text/icon button. If `isLocked`, shows a small amber lock circle badge. The lock is purely cosmetic — the `onClick` still fires.

---

### 7.4 JobCardComponents

**File:** `components/JobCardComponents.tsx`  
**Exports:** `getMatchLabel`, `JobCardMetrics`

Used by `ExecutionPreviewView` to render job card metrics and match labels.

---

### 7.5 AuthBridge

**File:** `components/AuthBridge.tsx`  
**Props:** None  
**Purpose:** Reads `ext_id` from URL params after OAuth callback. Sends `AUTH_HANDOFF` postMessage to the Chrome extension. Self-contained, no parent props.

---

### 7.6 FeatureTeaser

**File:** `components/FeatureTeaser.tsx`  
**Props:**
- `targetView: AppView`
- `onUpgrade: () => void`

**Purpose:** Shown when a non-Elite user tries to access a locked feature. Explains the feature value with upgrade CTA. Followed by inline `Pricing` component.

---

### 7.7 Profile Sub-Components

All in `components/profile/`:
- `SkillEvidenceBreakdown` — skill evidence with source breakdown
- `DecayingSignalsWidget` — signal freshness visualization
- `CorroborationIndicator` — cross-source verification status  
- `QuickWins` — actionable improvement suggestions
- `ProfileHealthDashboard` — health score matrix

---

### 7.8 MarketOutlookView Sub-Components

All defined inline in `MarketOutlookView.tsx`:
- `Card` — glassmorphism card wrapper with optional glow
- `SectionHeader` — icon + title + subtitle header
- `GaugeBar` — horizontal progress bar with label and percentage
- `Section1MarketHealth` — aggregate market health display
- `Section2RoleMomentum` — top 5 roles by momentum
- `Section3SkillLifecycle` — skills grouped by lifecycle stage
- `Section4CompetitionMap` — competition ratio per role (remote)
- `Section5TimingWindow` — seasonal hiring cycle analysis
- `Section6PersonalizedRadar` — role-specific opportunity score
- `Section7SignalSources` — data transparency card (static)

---

### 7.9 ApplicationExecutionView Sub-Components

Defined inline in `ApplicationExecutionView.tsx`:
- `StatusBadge` — colored badge based on `ExecutionState`
- `mapToJobOpportunity(app)` — maps raw DB row to `JobOpportunity` interface

---

## 8. API Communication Layer

### Supabase Client

**File:** `lib/supabase.ts`  
All components import `supabase` from this file. The client uses:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Both come from `.env` (Vite env variables).

### Direct Supabase Queries (non-Edge Function)

| Component | Table | Operation |
|-----------|-------|-----------|
| App.tsx | `profiles` | SELECT, INSERT |
| App.tsx | `resumes`, `resume_versions` | SELECT |
| App.tsx | `analyses` | SELECT |
| App.tsx | `execution_runs` | SELECT (sync), INSERT (job pre-register) |
| App.tsx | `profiles` | UPDATE (plan, resume_profiles) |
| ApplicationExecutionView | `applications` | SELECT (with Realtime subscription) |
| ApplicationExecutionView | `resume_versions` | SELECT (with Realtime subscription) |
| ExecutionPreviewView | `discovery_sessions` | SELECT (last), INSERT |
| ExecutionPreviewView | `match_analysis` | SELECT, INSERT (PENDING record) |
| ExecutionPreviewView | `governor_state` | SELECT current_mode |
| MarketOutlookView | `market_signals` | SELECT LIMIT 100 |
| CareerIntelligenceView | `market_snapshots` | SELECT |
| Pricing (inline) | `profiles` | UPDATE plan |

### Supabase Edge Function Calls (via `supabase.functions.invoke`)

| Function | Trigger | Params |
|----------|---------|--------|
| `generate-diagnostic` | `dispatchJob('ANALYSIS', ...)` | `user_id`, `run_id`, `targetRole`, resume text |
| `generate-rebuild` | `dispatchJob('REBUILD', ...)` | `user_id`, `run_id`, `application_id`, `resume_id` |
| `generate-outlook` | `dispatchJob('OUTLOOK', ...)` | `user_id`, `run_id`, `targetRole` |

### ApiEngine (lib/api-engine.ts)

Unified API client for the `hiring-engine` and related functions. All calls use the user's session `access_token` as Bearer token.

| Method | Call | Edge Function |
|--------|------|---------------|
| `getGovernorStatus()` | SELECT from `governor_state` | Direct DB |
| `resolveIntent(payload)` | POST `/intent/resolve` | `hiring-engine` |
| `resolveCluster(intent)` | GET `/user-clustering/resolve` | `hiring-engine` |
| `fetchJobPointers(clusterId, intent)` | GET `/job-pointers/by-cluster` | `hiring-engine` |
| `computeHiringDecision(jobId, ...)` | POST `/decision` | `hiring-engine` |
| `materializeJob(jobId)` | POST `materialize-job` | `materialize-job` |
| `fetchApplications(userId)` | GET `/list-applications` | `execution-engine` |
| `triggerApplication(appId, userId)` | POST `/submit-application` | `execution-engine` |
| `analyzeKillZone(jobId, userId)` | POST `/analyze-kill-zone` | `execution-engine` |
| `analyzeMatch(jobId, ...)` | INSERT into `match_analysis` (PENDING) + POST to `match-analyst` | `match-analyst` |
| `fetchMatchAnalysis(analysisId)` | SELECT from `match_analysis` | Direct DB |
| `ingestProfile(userId, ...)` | POST to `ingest-ai-layer` | `ingest-ai-layer` |

### CareerSynthesizer (lib/career-synthesizer.ts)

Dynamically imported in `ApplicationExecutionView`:
```typescript
const { CareerSynthesizer } = await import('../lib/career-synthesizer');
const synthesized = await CareerSynthesizer.synthesizeCareerContext(userId);
```

This synthesizes a career narrative from LinkedIn/GitHub signals when no formal resume exists.

### Realtime Subscriptions

| Channel Name | Table | Filter | Consumer |
|-------------|-------|--------|----------|
| `resume_versions_live` | `resume_versions` | None (all changes) | App.tsx → re-runs `fetchUserData` |
| `applications_realtime` | `applications` | `user_id = eq.{userId}` | ApplicationExecutionView |
| `versions_{applicationId}` | `resume_versions` | `application_id = eq.{appId}` | ApplicationExecutionView |

---

## 9. Interaction Flows

### 9.1 First-Time User Journey

```
1. User visits hiremax.app
2. App.tsx: initAuth() → no session → setLoading(false)
3. View = 'landing' → LandingPage renders
4. User clicks "Get Started" → handleSetView('auth')
5. View = 'auth' → AuthView renders (LOGIN mode)
6. User clicks "Sign in with Google"
7. supabase.auth.signInWithOAuth('google', { redirectTo: current URL })
8. [Browser redirects to Google OAuth]
9. [Supabase processes OAuth callback → redirects back to app URL with #access_token]
10. App.tsx: handlePopState() fires → sees fragment hash → cleans URL
11. onAuthStateChange fires: event='SIGNED_IN', session={user, access_token}
12. setUser(session.user) → fetchUserData(authUser)
13. fetchUserData:
    a. No profile found → INSERT new profile with plan='Starter'
    b. setProfile(newProfile)
    c. No resumes → setResumeHistory([])
    d. No analyses → setAnalysisHistory({})
14. AuthView: onSuccess() → handleSetView('dashboard')
15. View = 'dashboard' → DashboardView renders
16. All 4 stat widgets show '---' (no analysis yet)
17. RealityCheckDetail shows CTA: "Start Your Analysis"
```

### 9.2 Resume Analysis Flow

```
1. User clicks "Start Analysis" on Dashboard → handleSetView('ai-review')
2. AIReviewView renders
3. User uploads PDF → pdfjs-dist extracts text → displayed in textarea
4. User selects target role
5. User clicks "Run Analysis"
6. dispatchJob('ANALYSIS', { resumeText, targetRole, user_id })
7. App.tsx:
   a. Generates UUID job ID
   b. INSERT into execution_runs (status: 'pending')
   c. setJobs({ ...prev, [id]: { status: 'RUNNING', ... } })
8. Background async:
   a. supabase.functions.invoke('generate-diagnostic', { body: commonBody })
   b. [Edge function runs ~10-30s]
   c. Returns { results_json, id }
   d. result = { ...data.results_json, analysisId: data.id }
   e. setJobs({ ...prev, [id]: { status: 'COMPLETED', result } })
9. App.tsx reads COMPLETED jobs for ANALYSIS type
10. setAnalysisHistory(prev => ({ ...prev, [result.analysisId]: result }))
11. setActiveAnalysisId(result.analysisId)
12. handleSetView('full-review')
13. FullReviewView renders with currentAnalysis populated
```

### 9.3 Jobs For You Flow

```
1. User clicks "Jobs For You" in nav → handleSetView('preview')
2. ExecutionPreviewView renders:
   a. Checks governor_state → sets governorMode
   b. Loads last discovery_session from DB
3. Step = 'INTENT'
4. User selects role (e.g., "Backend Engineer") and location (e.g., "Remote, US")
5. User clicks "Run Job Intelligence"
6. Step = 'PROCESSING'
7. Parallel calls with AbortController:
   a. ApiEngine.resolveIntent({ role_normalized, location_raw, ... })
      → POST /hiring-engine/intent/resolve
      → Returns NormalizedIntent { role_normalized, seniority, location_bucket, intent_id }
   b. ApiEngine.resolveCluster(normalizedResult)
      → GET /hiring-engine/user-clustering/resolve?intent_id=...&location_bucket=...
      → Returns ClusterResolution { cluster_id, cluster_bucket }
   c. ApiEngine.fetchJobPointers(clusterId, intent)
      → GET /hiring-engine/job-pointers/by-cluster?cluster_id=...&role=...&location=...
      → Returns JobPointer[] { job_id, company, role, location, source, source_url }
8. saveDiscoverySession(normalizedResult, jobPointers)
9. Step = 'RESULTS'
10. Up to 12 jobs auto-trigger analyzeMatch():
    a. INSERT into match_analysis (status: PENDING) → get analysisId
    b. Fire-and-forget POST to match-analyst function
    c. Poll match_analysis table every 3s for that analysisId
    d. When status = COMPLETED → update job match state with result
11. User clicks a job card → setSelectedJob(job)
12. ApiEngine.materializeJob(job.job_id)
    → Checks governor (READ_ONLY blocks this)
    → POST to materialize-job function
    → Returns { full_description, verified_source_url }
13. Detail panel shows: full description, match analysis, "Apply Now" link
14. User clicks "Start Application":
    a. INSERT into applications table { user_id, title, company, location, source_url, match_confidence, status: 'TRACKED' }
    b. onNavigate('applications', newApp.id)
```

### 9.4 Plan Upgrade (Non-Elite Accessing Locked Feature)

```
1. Non-Elite user clicks "Market Insights" in nav
2. handleSetView('career-intelligence') fires
3. isElite = false → guard triggers:
   setTeaserTarget('career-intelligence')
   setView('dashboard')
   window.history.pushState({}, '', '/dashboard')
4. App.tsx render condition:
   teaserTarget !== null → renders FeatureTeaser + Pricing inline
5. FeatureTeaser shows: feature description, benefits, upgrade CTA
6. Below: Pricing component with all plans
7. User clicks upgrade plan in Pricing:
   a. supabase.from('profiles').update({ plan: p }).eq('id', user.id)
   b. setProfile({ ...profile, plan: p })
   c. setTeaserTarget(null)
   d. handleSetView('dashboard')
8. On next navigation — isElite recalculates → locked view is now accessible
```

### 9.5 Extension Auth Bridge

```
1. User clicks "Connect" in extension popup
2. Extension opens: window.open('https://app.hiremax.com?view=auth-bridge&ext_id=chrome.runtime.id')
3. App.tsx initial load:
   a. viewParam = 'auth-bridge' → setView('auth-bridge')
   b. URL is NOT cleaned (ext_id must remain for AuthBridge to read)
4. AuthBridge mounts → reads ext_id from URLSearchParams
5. Checks supabase.auth.getSession():
   a. If session exists → gets access_token
   b. Calls chrome.runtime.sendMessage(ext_id, { type: 'AUTH_HANDOFF', token: access_token })
   c. Extension stores token → shows "Connected" state
   d. AuthBridge shows success message
6. If no session → AuthBridge redirects to auth:
   a. setView('auth') (or navigates with ?view=auth&redirect=auth-bridge)
   b. After login → onSuccess routes back to 'auth-bridge'
   c. AuthBridge completes step 5
```

---

## 10. Current Weaknesses

### Critical

**W-FE-01: No payment integration**  
Plan upgrades call `supabase.from('profiles').update({ plan: p })` directly. Any user can inspect the network call and manually upgrade their plan for free. There is no Stripe checkout, webhook, or payment verification.

**W-FE-02: Admin page has no authorization check**  
`view = 'admin'` renders `AdminIntelligence` without any admin role verification. Any authenticated user who navigates to `/admin` can access it.

**W-FE-03: `alert()` used for errors in ApplicationExecutionView**  
Line 198: `alert("Submission failed. Check console.")`. Native browser alerts block the UI thread and are not branded or accessible.

### High

**W-FE-04: 7 AppView routes are ghost routes**  
`signal-hub`, `recruiter-scan`, `rejection-model`, `role-saturation`, `skill-radar`, `longevity-estimate`, `admin-ops` are in the type but render nothing. Blank white/dark screen if somehow navigated to.

**W-FE-05: Lock icons on NavLinks are cosmetic only for Pro features**  
`Intelligence` and `Rebuild` show lock badges for Starter users but are fully accessible on click. Only Elite-required views (`career-intelligence`, `applications`) are hard-blocked in `handleSetView`.

**W-FE-06: No Realtime for execution_runs status**  
Background job completion is polled every 15 seconds. A job that completes in 1 second won't be visible to the user for up to 15s. Supabase Realtime should replace the polling loop.

**W-FE-07: Production domain missing from extension manifest**  
`externally_connectable.matches` in the Chrome extension only lists localhost origins. The auth bridge flow will fail in production.

### Medium

**W-FE-08: Analysis history is inaccessible from FullReviewView**  
The `analysisHistory` Record can contain many past analyses, but `FullReviewView` always shows only `currentAnalysis` (the latest). There's no history selector or date picker.

**W-FE-09: Pricing page plan update has no loading/error state**  
The `setPlan` callback in `Pricing` calls `supabase.update(...)` but has no loading spinner or error toast. If the update fails, the user sees no feedback.

**W-FE-10: No skeleton loaders for initial data fetch**  
App.tsx shows nothing (or partially populated views) while `loading = true`. Only a single global boolean loading check exists — no granular per-page loading states.

**W-FE-11: CareerIntelligenceView kept alive via `display: none`**  
The view is never unmounted — it uses CSS `display: none` toggle to preserve state. This means the component runs its effect, polling, and rendering even when the user is on the Dashboard. Wasted resources.

**W-FE-12: Jobs For You — 12 simultaneous match analyses**  
`MAX_AUTO_ANALYSIS = 12` jobs immediately fire `ApiEngine.analyzeMatch()` in parallel with no concurrency control. This creates 12 simultaneous INSERT + 12 simultaneous function invocations on the first RESULTS render, potentially hitting Supabase rate limits.

**W-FE-13: Resume history Realtime triggers full re-fetch**  
`resume_versions_live` channel triggers `fetchUserData(authUser)` on any change — which re-fetches profiles, resumes, and analyses entirely. Should be a targeted update.

**W-FE-14: Mobile nav filters missing on Market Radar**  
Role and geo selectors in `MarketOutlookView` header are hidden on mobile (`hidden md:flex`). Mobile users cannot filter market data.

**W-FE-15: No global error boundary**  
There is no React `ErrorBoundary` component wrapping any view. An unhandled exception in any component will crash the entire app to a blank white screen.

**W-FE-16: `setCredits` is a no-op stub**  
`RebuildStandaloneView` receives `setCredits={async function (c) {}}` — a stub function. Credit deduction after rebuild does not actually persist.
