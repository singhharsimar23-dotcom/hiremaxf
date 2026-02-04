# HireMax: Job & Artifact Ingestion Architecture

## 1. Executive Summary
The Ingestion Pipeline is a dual-purpose system:
1. **Market Ingestion**: Consuming job opportunities from ATS APIs.
2. **Artifact Ingestion**: Authenticating with providers (GitHub/LinkedIn) to extract career truth signals.

## 2. Ingestion Pipeline Model

### Phase 0: Identity Verification
- **Role Selection**: User defines their primary track (SWE, Product, etc.) to calibrate ingestion scope.
- **Provider Connection**: Specific "Connect [Platform]" actions triggered for authenticated data access.
- **Platform Reversibility**: Support for "Disconnect" to remove linkages and scoped data deletion.

### Phase 1: Deep Artifact Extraction (Stage-A)
- **Technical Signals**: Parsing repository READMEs, commit history, and language distributions.
- **Persona Signals**: Analyzing professional summaries and posts to map communication style (e.g., "Authoritative", "Tactical").
- **Design Rule**: Ingestion is non-intelligent. AI is used only for field extraction and normalization into standard JSON schemas.
- **Lookback Limiting**: Ingestion ignores low-signal, dated history to maintain focus on recent seniority.

### Phase 2: Signal Normalization (Stage-B)
- **Deterministic Extraction**: Converting raw GitHub JSON into "Architecture Nodes" (e.g., "Event-Driven Infrastructure").
- **Snapshot Logic**: All data is ingested as a static snapshot. Automatic background synchronization is disabled to ensure data stability and cost predictability.
- **Resync Protocol**: Users must manually trigger a "Resync" to update artifacts, paying the ingestion cost only when necessary.

### Phase 3: Profile Synthesis (Stage-C)
- **Truth Source Compilation**: Combining all verified signals into a structured `ResumeProfile`.
- **Registry Commit**: Storing the profile in the central registry for use in the Applications Execution loop.

## 3. Compliance & Ethics

### 3.1 Anti-Scraping Posture
HireMax **DOES NOT** scrape gated platforms. We use:
- **Direct APIs**: Greenhouse/Lever public endpoints.
- **Authenticated Connections**: User-authorized OAuth flows.

### 3.2 Signal Isolation
Personal Identifiable Information (PII) is isolated. The synthesis engine focuses on "Metric Hardening" and "Architectural Ownership" rather than sensitive personal data. Data stored in `/backend/ingestion/db/` is source-tagged and append-only.

## 4. Scaling for Anti-Gravity
In the production environment:
- **Isolated Workers**: Background workers in `/backend/ingestion/edge-functions/` handle platform-specific payloads.
- **Raw Storage**: No inference is performed at the database level during ingestion.
- **Audit Chain**: Every synthesized profile contains a lineage link back to the raw ingestion payload for verification.
- **Lifecycle Management**: Auditable platform disconnection events are logged in the activity stream.