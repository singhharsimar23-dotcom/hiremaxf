# System Observability
> Last Updated: 2026-03-11

---

## Metrics

### Job Ingestion
| Metric | Query | Alert Threshold |
|--------|-------|----------------|
| New jobs (7d) | `SELECT count(*) FROM job_pointers WHERE created_at > now() - interval '7d'` | < 1,000 |
| Discovery buffer backlog | `SELECT count(*) FROM discovery_buffer` | > 50,000 |
| Per-source new job rate | `SELECT source, count(*) FROM job_pointers WHERE created_at > now() - interval '24h' GROUP BY source` | Source drops to 0 |
| Quality score avg | `SELECT avg(quality_score) FROM job_pointers WHERE created_at > now() - interval '7d'` | < 0.6 |
| Null company rate | `SELECT count(*) FROM job_pointers WHERE company_name IS NULL` / total | > 5% |

### Ranking
| Metric | Query |
|--------|-------|
| match_jobs_v3 result count | Logged in hiring-engine response |
| Vector similarity avg | Would require job embeddings (not yet implemented) |
| Decision distribution | `SELECT decision, count(*) FROM hiring_decisions GROUP BY decision` |

### LLM
| Metric | Source |
|--------|--------|
| Analysis completion rate | `SELECT count(*) FROM analyses WHERE created_at > now() - interval '24h'` |
| Average diagnostic latency | `analyses.updated_at - analyses.created_at` |
| Credit usage | `profiles.credits` decrement rate |

### API Response
| Metric | Source |
|--------|--------|
| Edge Function errors (24h) | `SELECT count(*) FROM integrity_events WHERE created_at > now() - interval '24h'` |
| Heartbeat failures | `execution_logs` with `level = 'error'` AND message LIKE '%HEARTBEAT%' |

---

## Monitoring

### Database Health
```sql
-- Table sizes
SELECT relname, n_live_tup FROM pg_stat_user_tables ORDER BY n_live_tup DESC LIMIT 20;

-- Index usage
SELECT schemaname, tablename, indexname, idx_scan FROM pg_stat_user_indexes ORDER BY idx_scan DESC;

-- Slow queries
SELECT query, mean_exec_time, calls FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;

-- Buffer cache hit rate (should be > 99%)
SELECT sum(heap_blks_hit)/(sum(heap_blks_hit)+sum(heap_blks_read)) as cache_hit_rate
FROM pg_stathdr;
```

### Governor State
The `governor_state` table provides a single-row system health signal:
```sql
SELECT current_mode, scrape_success_rate, total_jobs_processed, last_updated FROM governor_state;
```
`scrape_success_rate` is updated by `governor-reporter` after each scrape run. If it drops below the configured threshold, `current_mode` automatically moves to `READ_ONLY`.

### Vector Search Performance
| Check | Expected |
|-------|----------|
| pgvector index type | HNSW (faster than IVFFlat at scale) |
| `match_jobs_v3` query time | < 200ms for 76k rows |
| Candidate embedding exists | `SELECT count(*) FROM ml_candidate_embeddings WHERE embedding IS NOT NULL` |

### Extension Errors
All extension runtime errors are logged via `RECORD_EXECUTION_AUDIT` → `execution_audits` table:
- ATS detection failures
- Field fill failures
- Auth session errors

---

## Alerts

### Critical (Immediate action required)
| Alert | Trigger | Action |
|-------|---------|--------|
| Governor in READ_ONLY or SAFE | `governor_state.current_mode != 'CONTROLLED'` | Investigate ingestion failure |
| Auth errors spike | `integrity_events.event_type = 'RUNTIME_ERROR'` count > 10 in 1h | Check JWT config |
| Zero new jobs for 24h | `job_pointers` insert rate drops to 0 | Scraper scheduling failure |
| `discovery_buffer` > 200k rows | Buffer processor not running | Trigger buffer drain manually |

### Warning (Monitor closely)
| Alert | Trigger |
|-------|---------|
| Quality score drops below 0.6 avg | Data source returning garbage |
| Company null rate > 10% | Company insert race condition spiking |
| Latency > 5s on `hiring-engine` | DB or vector search issue |

### Edge Function Logs
All Edge Function logs viewable via:
```
Supabase Dashboard → Edge Functions → [function name] → Logs
```
Or via MCP: `mcp_supabase-mcp-server_get_logs(project_id, service='edge-function')`

---

## Ingestion Telemetry

Each scraper run logs to:
- `discovery_runs`: aggregate stats (jobs_found, jobs_new, jobs_updated)
- `ingestion_logs`: per-run metadata
- `source_reliability_v2`: per-source success rate tracking

**Accessing recent runs:**
```sql
SELECT source, jobs_found, jobs_new, jobs_updated, started_at 
FROM discovery_runs 
ORDER BY started_at DESC 
LIMIT 20;
```

---

## Current Weaknesses

1. **No alerting infrastructure** — There are no active alerts. All monitoring requires manual SQL queries. No Slack/email/PagerDuty integration.
2. **No query performance monitoring** — `pg_stat_statements` is available but not regularly reviewed. `match_jobs_v3` has not been EXPLAIN ANALYZED at production scale (76k rows).
3. **No LLM latency tracking** — Gemini API call duration is not recorded. The only signal is analysis `created_at` vs `updated_at`.
4. **Extension errors not centrally aggregated** — `execution_audits` is per-user. No global error rate dashboard for the extension.
5. **`scrape_success_rate` calculation unclear** — `governor_state.scrape_success_rate` is currently `0.5` (appears hardcoded). The `governor-reporter` function needs to update it from actual `discovery_runs` data.
