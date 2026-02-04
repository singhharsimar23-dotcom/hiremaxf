# HireMax: Ingestion Backend

## Overview
This directory contains the primitives for career artifact and market data ingestion. Logic is strictly isolated by Ingestion Mode to ensure security, cost-predictability, and fidelity honesty.

## Directory Structure
Ingestion logic is partitioned by trust level and technical mechanism:

- `/oauth/`: Authenticated API handlers (GitHub, LinkedIn, Jira). Requires secure token management.
- `/public_profile/`: Fetchers for user-provided public URLs (Scholar, HuggingFace, Portfolios). Uses standard HTTP clients without auth.
- `/manual/`: Handlers for text/file artifacts uploaded directly via UI.
- `/db/`: Schema definitions for append-only raw data storage, including `ingestion_mode` metadata.

## Core Principles
1. **Mode Isolation**: Logic for scraping public profiles MUST NOT reside in OAuth handlers.
2. **Honest Trust Signals**: Metadata must clearly distinguish between verified (OAuth) and unverified (Public/Manual) sources.
3. **Snapshot Only**: HireMax does not support continuous background synchronization. Ingestion is atomic and user-triggered.
4. **Append-Only Storage**: Raw data payloads are immutable. Disconnection marks data as inactive but preserves auditability.

## Deployment
Mode-specific functions should be deployed as isolated edge functions to prevent cross-contamination of logic or secrets.
