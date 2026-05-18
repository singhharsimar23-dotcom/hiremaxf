# Market Coverage
> Last Updated: 2026-03-11

---

## Target Employer Market

HireMax focuses on **structured hiring pipelines** — companies that use ATS systems. This deliberately excludes job postings without structured data (handshake referrals, recruiter InMails, undocumented openings) because those cannot be automated or scored reliably.

---

## Supported ATS Platforms

| ATS | Tier | Used By | Parsing Method |
|-----|------|---------|---------------|
| **Greenhouse** | 1 (Highest quality) | High-growth startups, Series A–C | Direct API: `boards.greenhouse.io/api/v1/boards/{company}/jobs` |
| **Lever** | 1 | Tech startups, mid-size teams | Direct API: `api.lever.co/v0/postings/{company}` |
| **Ashby** | 1 | Modern AI/ML companies, engineering-first | Direct API: `api.ashbyhq.com/job.list` |
| **Workday** | 2 (Enterprise) | Fortune 500, enterprise tech | Scraping `*.myworkdayjobs.com` |
| **SmartRecruiters** | 2 | Mid-to-large tech companies | RSS + direct API |
| **iCIMS** | 2 | Enterprise companies | HTML scraping |
| **Google Jobs** | Meta-Board | Global job market | SerpAPI Search |
| **Indeed** | Meta-Board | Global job market | SerpAPI Search |
| **LinkedIn** | Meta-Board | Professional network | SerpAPI Search (Google Dorking) |
| **Jobicy** | Board | Remote tech & non-tech | REST API |
| **Himalayas** | Board | Remote tech ecosystem | REST API |
| **RemoteOK** | Board | Remote engineering & design | JSON API |
| **WeWorkRemotely** | Board | Remote engineering roles | REST API/RSS feed |
| **Arbeitnow** | Board | Remote/EU tech | REST API |
| **Remotive** | Board | Remote-first startups | Direct API |
| **WorkingNomads** | Board | Remote tech roles | REST API |
| **Dice** | Board | US tech roles | REST API (ScraperAPI) |
| **BuiltIn** | Board | City-based tech communities | API (ScraperAPI) |
| **Cord** | Board | European tech | REST API |
| **Otta** | Board | London/EU tech | GraphQL API |
| **Hired** | Board | US senior engineering | REST API |
| **Jooble** | Board | Aggregator (100+ sources) | API |
| **Careerjet** | Board | Aggregator (50+ sources) | REST API |

---

## ATS Coverage Strategy

### Tier 1 ATS — Highest Signal Quality
**Greenhouse, Lever, Ashby**

Why: Used by the highest-quality engineering employers (Stripe, Figma, Linear, Notion, OpenAI, Anthropic, Scale AI, etc.). These APIs return:
- Structured job titles and requirements
- Office location with remote/hybrid designation
- Department and team classification
- Direct application URL (bypassing job board intermediaries)

These jobs use `is_direct_ats = true` in `job_pointers`, giving them preference in ranking.

### Tier 2 ATS — Enterprise Quality
**Workday, SmartRecruiters, iCIMS**

Why: Used by large companies (Microsoft, Google, Meta, Amazon, Salesforce, etc.). The structured data is good but the hiring process is slower and more competitive. Scraped via HTML parsing with lower reliability.

### Job Boards — Volume and Coverage
**WeWorkRemotely, Dice, Indeed, etc.**

Why: High volume of listings that wouldn't appear in direct ATS APIs. Quality is mixed — some sources provide excellent structured data (WorkingNomads), others are noisy (generic aggregators). Quality score filtering (`> 0.5`) removes the worst.

---

## Company Quality Filters

Not every scraped job enters the ranking system. The following checks apply:

| Filter | Threshold | Implementation |
|--------|-----------|---------------|
| Missing company name | Required | `if (!job.company) continue` in all scrapers |
| Missing title | Required | `if (!job.title) continue` in all scrapers |
| Quality score | `> 0.5` | Enforced in `match_jobs_v3` RPC `WHERE quality_score > 0.5` |
| Expired posting | Auto-filtered | `WHERE expires_at IS NULL OR expires_at > now()` |
| Duplicate fingerprint | SHA-256 | Insert skipped if fingerprint exists |
| Low credibility company | Planned (not enforced) | `companies.credibility_score` column exists but not yet used as filter |

---

## Market Segments

| Segment | Target Companies | Primary ATS | Coverage |
|---------|-----------------|-------------|---------|
| **AI/ML Startups** | Anthropic, Scale, Cohere, Mistral, etc. | Ashby, Greenhouse | High |
| **High-Growth Startups** | Series A–C, YC companies | Greenhouse, Lever | High |
| **Mid-Size Tech** | 100–2000 employees, SaaS | Lever, SmartRecruiters, BuiltIn | Medium |
| **Enterprise Tech** | Fortune 500, FAANG | Workday, iCIMS | Medium |
| **Remote-First** | DTC, distributed teams | WeWorkRemotely, Remotive | High |
| **Finance/Fintech** | Stripe, Plaid, Brex | Greenhouse | Medium |

---

## Estimated Reach

| Source Type | Estimated Active Listings |
|------------|--------------------------|
| Tier 1 ATS (Greenhouse + Lever + Ashby) | ~80,000 per scrape cycle |
| Tier 2 ATS (Workday + SmartRecruiters) | ~50,000 per scrape cycle |
| Job Boards (total) | ~100,000+ per scrape cycle |
| **Current `job_pointers` total** | **76,685** |
| Discovery buffer (unprocessed) | 169,593 |

---

## Geographic Coverage

| Region | Coverage |
|--------|---------|
| US Remote | ✅ Primary (largest segment) |
| US West (SF, Seattle, LA) | ✅ High |
| US East (NYC, Boston) | ✅ High |
| US Central (Chicago, Austin, Denver) | ✅ Medium |
| Europe (UK, Germany) | ⚠️ Partial (Cord, Otta) |
| Canada | ⚠️ Partial (aggregators only) |
| Asia Pacific | ❌ Not yet covered |

---

## Current Weaknesses

1. **LinkedIn not scraped** — The largest job board in the world due to anti-scraping measures. The absence of LinkedIn means missing ~40% of the job market.
2. **Job freshness decay** — Scrapers don't run frequently enough to catch jobs in the first 24h window consistently. Most jobs appear 1–3 days after posting.
3. **Skill extraction not happening** — `required_skills` and `tech_stack` arrays are empty for most `job_pointers` rows because the enrichment agent hasn't run over the corpus.
4. **European coverage is thin** — Cord and Otta have limited free API access. UK/EU market is underrepresented.
---

## Market Coverage Update (2026-03-26)

### Google Jobs, Indeed, and Free Feeds Expanded
By transitioning completely to the uncapped `ats-engine-ultimate` run by `discovery-orchestrator`, we introduced simultaneous coverage of massive general boards using **SerpAPI** (Google Jobs and Indeed), alongside direct hits to new high-volume sources: Jobicy, Himalayas, RemoteOK, Arbeitnow, and Remotive.

### LinkedIn Discovery Resolved (The Google Jobs Backdoor)
We successfully eradicated the critical weakness of "LinkedIn not scraped" by implementing and deploying the **Google Jobs Backdoor**.
- **Method**: Using `google-linkedin-scout` to natively query Google Search (`site:linkedin.com/jobs/view`) targeting tech-focused roles spanning 50 US States and 7 top-level Role Pillars.
- **Impact**: We systematically capture the high-security "LinkedIn-only" market without invoking direct scraping blockers or IP bans.
- **Coverage**: Extrapolates to **thousands of high-signal LinkedIn pointers** generated weekly.
- **Deduplication**: Deep URL normalization ensures no duplicate LinkedIn jobs clutter `job_pointers` across different state/pillar search iterations.
