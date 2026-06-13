# HireMax Intelligence Engine — Deployment Guide

## What Got Built

| Component | Location | Status |
|---|---|---|
| DB Migration | `supabase/migrations/20260610_intelligence_engine.sql` | ✅ Deployed to Supabase |
| `intelligence-pipeline` | `workers/intelligence-pipeline/` | 🔧 Ready to deploy |
| `intelligence-distributor` | `workers/intelligence-distributor/` | 🔧 Ready to deploy |
| `intelligence-content-factory` | `workers/intelligence-content-factory/` | 🔧 Ready to deploy |
| `intelligence-admin-api` | `workers/intelligence-admin-api/` | 🔧 Ready to deploy |
| Research Hub | `apps/web/components/ResearchHubView.tsx` | ✅ Built — deploys with Vercel |
| Research Post | `apps/web/components/ResearchPostView.tsx` | ✅ Built — deploys with Vercel |
| Admin Dashboard | `apps/web/components/AdminIntelligence.tsx` | ✅ Extended — deploys with Vercel |
| `robots.txt` | `apps/web/public/robots.txt` | ✅ Updated |
| `llms.txt` | `apps/web/public/llms.txt` | ✅ Updated |

---

## Pre-Deployment Checklist

### Step 1: Set ADMIN_PASSWORD in .env
Choose a strong password — this protects the brief approval API.
```
ADMIN_PASSWORD=your_strong_password_here
```

### Step 2: Get free API keys
- **BLS**: https://data.bls.gov/registrationEngine/ (instant)
- **FRED**: https://fred.stlouisfed.org/docs/api/api_key.html (instant)
- **Resend**: https://resend.com — replace the placeholder `RESEND_API_KEY` in `.env`
  - Verify `hiremax.site` domain in Resend dashboard
  - Add `intelligence@hiremax.site` as sender

### Step 3: LinkedIn Developer App
1. Go to https://www.linkedin.com/developers/apps
2. Create app → request `w_member_social` + `w_organization_social` permissions
3. Get `LINKEDIN_PERSON_ID` from: https://api.linkedin.com/v2/userinfo (after OAuth)
4. Get `LINKEDIN_ORG_ID` from your company page URL

---

## Deploy Workers — Run In Order

```powershell
# Navigate to workers directory
cd C:\Users\hprad\OneDrive\Desktop\hiremax\workers

# Login to Cloudflare (one time)
npx wrangler login

# Step A: Deploy admin-api first
cd intelligence-admin-api
npx wrangler deploy
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put ADMIN_PASSWORD
# Note the deployed URL, e.g. https://hiremax-intelligence-admin-api.XXX.workers.dev
cd ..

# Step B: Deploy content-factory
cd intelligence-content-factory
npx wrangler deploy
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put GEMINI_API_KEY
npx wrangler secret put ADMIN_PASSWORD
# Note the URL, e.g. https://hiremax-intelligence-content-factory.XXX.workers.dev
cd ..

# Step C: Update admin-api with content-factory URL
cd intelligence-admin-api
npx wrangler secret put CONTENT_FACTORY_URL
# Enter: https://hiremax-intelligence-content-factory.XXX.workers.dev
cd ..

# Step D: Deploy pipeline (cron: 6am UTC daily)
cd intelligence-pipeline
npx wrangler deploy
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put GEMINI_API_KEY
npx wrangler secret put BLS_API_KEY
npx wrangler secret put FRED_API_KEY
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put SAM_EMAIL   # enter: harsimar@hiremax.site
cd ..

# Step E: Deploy distributor (cron: */15 * * * *)
cd intelligence-distributor
npx wrangler deploy
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put SAM_EMAIL
# LinkedIn (when ready):
npx wrangler secret put LINKEDIN_ACCESS_TOKEN
npx wrangler secret put LINKEDIN_TOKEN_EXPIRES_AT
npx wrangler secret put LINKEDIN_PERSON_ID
npx wrangler secret put LINKEDIN_ORG_ID
cd ..
```

---

## Update Vercel Environment

In Vercel dashboard → Settings → Environment Variables, add:
```
VITE_INTELLIGENCE_ADMIN_URL = https://hiremax-intelligence-admin-api.XXX.workers.dev
```
Then trigger a redeploy.

---

## Test The Pipeline Manually

```powershell
# Trigger pipeline immediately (before waiting for 6am)
curl -X POST https://hiremax-intelligence-pipeline.XXX.workers.dev/trigger

# Check Supabase — should see rows in raw_data_points, trend_signals, research_briefs
# Then check your email at harsimar@hiremax.site
```

---

## Sam's Daily Flow (after everything is deployed)

1. Email arrives at `harsimar@hiremax.site` with research brief
2. Click "Add Your Angle + Approve" — opens admin at `hiremax.site/admin`
3. Tab: **Research Briefs** — type 1-3 sentences → click Approve
4. Content factory generates all 8 pieces automatically (takes ~2 min)
5. Check **Content Calendar** tab — posts appear scheduled
6. Distributor publishes them on schedule (every 15 min check)
7. Blog post appears at `hiremax.site/research/[slug]`
8. Monday: weekly report email arrives

---

## LinkedIn App Required Permissions

Request these in LinkedIn Developer app:
- `w_member_social` — post as Sam personally
- `w_organization_social` — post as HireMax company page  
- `r_basicprofile` — read Person ID

**Note**: LinkedIn API approval typically takes 1-2 weeks for `w_member_social`.

---

## Architecture Summary

```
6am UTC daily:
  intelligence-pipeline cron
    → fetchBLS + fetchFRED + fetchEurostat + fetchILO + fetchReddit + fetchHN
    → detectAnomalies (z-score analysis + cross-signal amplification)
    → generateBrief (Gemini 2.0 Flash)
    → Email Sam at harsimar@hiremax.site

Sam approves (2 min):
  AdminIntelligence.tsx (hiremax.site/admin)
    → "Research Briefs" tab → type angle → Approve
    → PATCH research_briefs + webhook to content-factory

intelligence-content-factory:
  → Generates 8 content pieces sequentially (4s gaps)
  → Quality gate (Gemini scores each, regenerates if < 7/10)
  → Schedules pieces in content_pieces table + blog_posts table

*/15 * * * *:
  intelligence-distributor cron
    → publishDueContent() → blog | linkedin | reddit | hn
    → Monday 8am: citation monitor + weekly report email

Public visitors:
  hiremax.site/research → ResearchHubView (reads blog_posts)
  hiremax.site/research/:slug → ResearchPostView (3 JSON-LD schemas)
  hiremax.site/llms.txt → updated by distributor on each blog publish
```
