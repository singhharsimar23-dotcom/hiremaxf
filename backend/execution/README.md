
# HireMax: Execution Backend (v1.0)

## Overview
The Execution Backend manages the live lifecycle of job applications. It moves from deterministic resume synthesis to real-world dispatch. It is designed to run as isolated Supabase Edge Functions.

## Core Operations
1. **Validation**: Every run requires a verified `resume_id` and a `target_role`.
2. **Persistence**: No operation is performed without a database record in `execution_runs`.
3. **Auditability**: Every network request or state transition is logged in `execution_logs`.

## Execution Logic Flow
- `start_execution_run`: Validates user state, commits a run record, and triggers the target discovery loop.
- `execute_application`: Processes individual `execution_targets`. Handles the mapping of synthesized resume data to external ATS fields.
- `abort_execution`: Atomic termination of active processes.

## Safety & Limits
- **Rate Limiting**: Enforced at the Edge Function level by checking `profiles.metadata.applications_sent_today`.
- **Idempotency**: `execute_application` checks for an existing `submitted` status before dispatching to prevent duplicate applications.
