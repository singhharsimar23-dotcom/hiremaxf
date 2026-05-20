# HireMax AI - Complete Architectural & Context Handoff Map
> **Context Purpose**: This document is engineered specifically for Cursor / LLM context windows. It contains the absolute source of truth mapping out every active page, its location, the core monorepo architecture, and active states.

---

## 📂 1. High-Level Monorepo Directory Mapping
HireMax is structured as a performant monorepo separating front-end client suites, background worker engines, database configurations, and automation scripts:

* 🌐 **`apps/web/`** - The primary customer-facing SaaS Web App (Vite + React 19 + TypeScript + HSL Vanilla CSS).
  * 📍 *Main Entrypoint*: [`apps/web/main.tsx`](file:///c:/Users/hprad/OneDrive/Desktop/hiremax/apps/web/main.tsx)
  * 📍 *Core Shell / Router*: [`apps/web/App.tsx`](file:///c:/Users/hprad/OneDrive/Desktop/hiremax/apps/web/App.tsx)
  * 📍 *Primary Styling*: [`apps/web/index.css`](file:///c:/Users/hprad/OneDrive/Desktop/hiremax/apps/web/index.css)
* 🧩 **`apps/extension/`** - Chrome Extension module that performs LinkedIn / Greenhouse / Indeed scraping, communicating with the SaaS app via an OAuth handshake.
* ⚙️ **`worker/`** - Cloudflare Worker running background workflows, semantic job enrichment (Groq/Gemini RAG), scraping sanitizers, and telemetry aggregators.
  * 📍 *Main Worker code*: [`worker/src/index.ts`](file:///c:/Users/hprad/OneDrive/Desktop/hiremax/worker/src/index.ts)
  * 📍 *Configuration*: [`wrangler.toml`](file:///c:/Users/hprad/OneDrive/Desktop/hiremax/wrangler.toml)
* 🗄️ **`supabase/`** - Supabase project configurations, schema definitions, and migration files.
* 🧪 **`tests/`** - E2E tests, ATS simulations, chaotic injection pipelines, and core verification suites.

---

## 🖥️ 2. Web App Routing & State Control Flow
The web application runs a highly performant **single-page state router** inside [`App.tsx`](file:///c:/Users/hprad/OneDrive/Desktop/hiremax/apps/web/App.tsx). 
* The active view is controlled via the `activeView` reactive state.
* To achieve **world-class load times (<150ms)**, the codebase splits heavy engines (like the Resume Builder and Outlook Charts) into dynamically loaded chunks using `React.lazy()`.
* Lightweight, public static pages (Landing, Login, FAQ, Legal) are statically imported to render instantaneously with **zero fallback flash**.

---

## 📄 3. Complete Active Views Registry
Below is the master inventory of every active view/page in the HireMax SaaS portal, its exact file path, and its active core functions:

### 🏠 **Core Public & Authentication Views** *(Static, Zero-Lag)*
| Page/View | File Location | Purpose & Capabilities |
| :--- | :--- | :--- |
| **Landing Page** | [`apps/web/components/LandingPage.tsx`](file:///c:/Users/hprad/OneDrive/Desktop/hiremax/apps/web/components/LandingPage.tsx) | Premium, sleek dark-themed SEO landing page with Outfit/Inter typography, animated stats, product carousels, and responsive layouts. |
| **Auth Screen** | [`apps/web/components/AuthView.tsx`](file:///c:/Users/hprad/OneDrive/Desktop/hiremax/apps/web/components/AuthView.tsx) | Handles User login & registration using Supabase Auth. Integrates dynamic redirection targeting standard `window.location.origin` flows. |
| **Pricing Screen** | [`apps/web/components/Pricing.tsx`](file:///c:/Users/hprad/OneDrive/Desktop/hiremax/apps/web/components/Pricing.tsx) | Subscription tier manager showing credit allocations, plan features, and integrated checkouts. |
| **Auth Bridge** | [`apps/web/components/AuthBridge.tsx`](file:///c:/Users/hprad/OneDrive/Desktop/hiremax/apps/web/components/AuthBridge.tsx) | Handshake screen communicating active Supabase OAuth access tokens directly to the Chrome Extension context. |
| **FAQ Page** | [`apps/web/components/FAQ.tsx`](file:///c:/Users/hprad/OneDrive/Desktop/hiremax/apps/web/components/FAQ.tsx) | Interactive product guide with searchable accordion groups. |
| **Contact Page** | [`apps/web/components/Contact.tsx`](file:///c:/Users/hprad/OneDrive/Desktop/hiremax/apps/web/components/Contact.tsx) | Direct client support portal pre-filling user metadata. |
| **Terms of Service** | [`apps/web/components/TermsView.tsx`](file:///c:/Users/hprad/OneDrive/Desktop/hiremax/apps/web/components/TermsView.tsx) | Legal documentation wrapper. |
| **Privacy Policy** | [`apps/web/components/PrivacyView.tsx`](file:///c:/Users/hprad/OneDrive/Desktop/hiremax/apps/web/components/PrivacyView.tsx) | Data governance documentation. |
| **Refund Policy** | [`apps/web/components/RefundView.tsx`](file:///c:/Users/hprad/OneDrive/Desktop/hiremax/apps/web/components/RefundView.tsx) | Guarantee policy details. |

---

### 🛡️ **Protected Application Dashboard Views** *(Lazy-Loaded for Performance)*
| Page/View | File Location | Purpose & Capabilities |
| :--- | :--- | :--- |
| **Dashboard** | [`apps/web/components/DashboardView.tsx`](file:///c:/Users/hprad/OneDrive/Desktop/hiremax/apps/web/components/DashboardView.tsx) | The cockpit. Lists active optimization pipelines, credits balances, active target job stats, and fast-action modules. |
| **AI Resume Scan** | [`apps/web/components/AIReviewView.tsx`](file:///c:/Users/hprad/OneDrive/Desktop/hiremax/apps/web/components/AIReviewView.tsx) | The scanner. Loads `pdfjs-dist` & `mammoth` directly in the browser to parse `.pdf` / `.docx` files, analyzing ATS fit score, parsing metadata, and generating dynamic score metrics. |
| **Deep ATS Score** | [`apps/web/components/FullReviewView.tsx`](file:///c:/Users/hprad/OneDrive/Desktop/hiremax/apps/web/components/FullReviewView.tsx) | Complete score audit. Shows metric rings, missing keywords, structural parsing warnings, and specific AI-action recommendations. |
| **Market Outlook** | [`apps/web/components/MarketOutlookView.tsx`](file:///c:/Users/hprad/OneDrive/Desktop/hiremax/apps/web/components/MarketOutlookView.tsx) | Geographical market maps. Renders local hiring velocity, role saturation charts, and salary percentiles by region using `recharts`. |
| **Career Intelligence**| [`apps/web/components/CareerIntelligenceView.tsx`](file:///c:/Users/hprad/OneDrive/Desktop/hiremax/apps/web/components/CareerIntelligenceView.tsx) | Maps competitive intelligence. Visualizes your resume standings against other real candidates using custom Skill Radar and Longevity charts. |
| **Resume Builder** | [`apps/web/components/ResumeBuilder.tsx`](file:///c:/Users/hprad/OneDrive/Desktop/hiremax/apps/web/components/ResumeBuilder.tsx) | A full-featured ATS resume customizer. Supports multi-version history, instant edits, real-time preview, and exports clean vector PDFs using `jspdf`. |
| **Compare Tool** | [`apps/web/components/RebuiltCompareView.tsx`](file:///c:/Users/hprad/OneDrive/Desktop/hiremax/apps/web/components/RebuiltCompareView.tsx) | Side-by-side original vs optimized resume semantic diff visualizer. |
| **Rebuild Tool** | [`apps/web/components/RebuildStandaloneView.tsx`](file:///c:/Users/hprad/OneDrive/Desktop/hiremax/apps/web/components/RebuildStandaloneView.tsx) | Tailors your resume to a specific job description instantly using structured Groq LLM generations. |
| **Job Tracker** | [`apps/web/components/ApplicationTrackerView.tsx`](file:///c:/Users/hprad/OneDrive/Desktop/hiremax/apps/web/components/ApplicationTrackerView.tsx) | Kanban board monitoring job funnels (Saved, Applied, Interviewing, Offered, Rejected). |
| **Interview Prep** | [`apps/web/components/InterviewPrepView.tsx`](file:///c:/Users/hprad/OneDrive/Desktop/hiremax/apps/web/components/InterviewPrepView.tsx) | Interactive prep coach. Simulates behavioral questions tailored to your active resume and targeted jobs. |
| **Cover Letter Gen** | [`apps/web/components/CoverLetterView.tsx`](file:///c:/Users/hprad/OneDrive/Desktop/hiremax/apps/web/components/CoverLetterView.tsx) | Automated dynamic cover letter tailoring matching semantic highlights. |
| **LinkedIn Optimizer**| [`apps/web/components/LinkedInOptimizerView.tsx`](file:///c:/Users/hprad/OneDrive/Desktop/hiremax/apps/web/components/LinkedInOptimizerView.tsx) | Formulates professional headlines, keyword alignments, and summary structures optimized for recruiting algorithms. |
| **Resume History** | [`apps/web/components/ResumeHistoryView.tsx`](file:///c:/Users/hprad/OneDrive/Desktop/hiremax/apps/web/components/ResumeHistoryView.tsx) | Complete archive of your saved and parsed resume revisions. |
| **Profile & Skills** | [`apps/web/components/ProfileView.tsx`](file:///c:/Users/hprad/OneDrive/Desktop/hiremax/apps/web/components/ProfileView.tsx) | Technical credentials database containing dynamic industry classifications, skill chips, and career details. |
| **Settings** | [`apps/web/components/AccountSettings.tsx`](file:///c:/Users/hprad/OneDrive/Desktop/hiremax/apps/web/components/AccountSettings.tsx) | Configuration for profile info, passwords, API integration tokens, and linked services. |
| **Billing Center** | [`apps/web/components/Billing.tsx`](file:///c:/Users/hprad/OneDrive/Desktop/hiremax/apps/web/components/Billing.tsx) | Active subscriptions dashboard. |
| **Preview Terminal** | [`apps/web/components/ExecutionPreviewView.tsx`](file:///c:/Users/hprad/OneDrive/Desktop/hiremax/apps/web/components/ExecutionPreviewView.tsx) | Technical log visualizer tracking back-end scrape triggers. |
| **Admin Operations** | [`apps/web/components/AdminIntelligence.tsx`](file:///c:/Users/hprad/OneDrive/Desktop/hiremax/apps/web/components/AdminIntelligence.tsx) | Internal analytics platform, user quotas editor, and system health status. |

---

## 🗃️ 4. Supabase Database Schema Context
All client states are stored in your Supabase project (`ssuknybhzcuusjardsve`). Key relational mappings you will interact with:
1. **`profiles`**: Stores user subscriptions (`plan` column: `'free' | 'pro' | 'elite'`), billing credentials, and credits allocation limits.
2. **`resumes`**: The parent record of a user's uploaded resume document.
3. **`resume_versions`**: Child table supporting infinite history, tracking optimized or tailored iterations linked back to the parent `resume_id`.
4. **`analyses`**: Stores detailed JSON scoring metrics, missing keywords, and ATS match score audits from parser uploads.
5. **`applications`**: Powering the Kanban Board Tracker, linking users, targets, and funnel stages.

---

## ⚙️ 5. What's Currently Active and Configured
1. **Authentication Flow (Optimized)**:
   * Redirection endpoints inside [`AuthView.tsx`](file:///c:/Users/hprad/OneDrive/Desktop/hiremax/apps/web/components/AuthView.tsx) are configured dynamically using `window.location.origin` (so they work on both `http://localhost:3000` and `https://hiremax.site` automatically).
   * Popstate listeners inside `App.tsx` capture post-consent redirects cleanly. **Hash cleanup is deferred** until auth resolving is completed, preventing session loss.
2. **Production Domain Setup**:
   * Custom domain: `https://hiremax.site`
   * Supabase callback endpoint needs `https://hiremax.site/**` whitelisted in `Redirect URLs`.
3. **Bundling performance**:
   * Bundling is configured in [`apps/web/vite.config.ts`](file:///c:/Users/hprad/OneDrive/Desktop/hiremax/apps/web/vite.config.ts) and runs smoothly via `npm run build`, maintaining a highly optimized lazy-loaded footprint.

---

## 🧠 6. Deep Technical Context for Cursor
* **vanilla CSS**: Avoid installing Tailwind dependencies unless explicitly instructed. Keep styling variables clean under `:root` styling tokens inside [`index.css`](file:///c:/Users/hprad/OneDrive/Desktop/hiremax/apps/web/index.css).
* **Supabase Client**: Standard client initialization occurs in [`apps/web/lib/supabase.ts`](file:///c:/Users/hprad/OneDrive/Desktop/hiremax/apps/web/lib/supabase.ts). Always query via this singleton instance.
* **Component Patterns**: Most components export named TSX variables. Use explicit React standard types and keep functions cleanly modularized.
