# Connector Architecture

## Purpose
Connectors fetch raw payloads from external providers. Parsing, normalization, scoring, identity, and persistence are handled downstream by adapters + ingestion core.

## Runtime Boundary
- Connectors may import shared utility modules from `core/shared/*` (timeouts, scraper helpers, DB client wrappers are outside connector business logic).
- Connectors must not write directly to `job_pointers`.
- Connectors should return raw batches and throw on upstream non-404 failures so outages are observable.

## Invocation Path
`infra/workers/index.ts` -> `core/ingestion-engine/group_processor.ts` -> `infra/adapters/registry.ts` -> adapter -> connector.

## Error Contract
- `404`: treated as source-not-found / empty board (`[]` allowed).
- other non-2xx: throw typed error (`*_FETCH_FAILED ...`) so failures are logged and quarantining can trigger.
- timeout: throw (do not silently return empty arrays).

## Drift Notes
- Current codebase uses hybrid adapter patterns (legacy adapter objects + BaseConnector-based adapters).
- Registry bridges BaseConnector instances into the legacy adapter interface with runtime shape checks.
