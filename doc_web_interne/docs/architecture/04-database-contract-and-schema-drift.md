# Spec 04: Treat the Database as a Versioned Contract and Detect Drift Early

## Verification Snapshot (2026-03-15)

### Confirmed

- `supabase/migrations/*` still contains critical trigger, quota, auth-metadata, and RPC behavior that the app depends on.
- `services/supabaseDreamService.ts` still assumes concrete dream columns such as `client_request_id`, `analysis_status`, `analysis_request_id`, `has_person`, and `has_animal`.
- `services/quota/SupabaseQuotaProvider.ts` still depends on `quota_limits` and `quota_usage`.
- `supabase/functions/api/routes/quota.ts` still depends on `get_guest_quota_status`, `increment_guest_quota`, and `mark_fingerprint_upgraded`.

### Inferred

- Drift between local migrations and the deployed database would still break critical write paths in ways the mobile client cannot correct, even though this repo does not contain a formal drift report.

### Wrong / stale

- The contract and readiness mechanisms proposed here are not implemented yet. There is no checked-in DB contract manifest, no `app_contract` table migration, and no repo-local smoke-test or readiness script covering these database objects.

## Problem

The app depends on a large amount of database behavior that is not just schema:

- RLS policies
- trigger order
- quota enforcement functions
- guest quota RPCs
- auth metadata update behavior

Confirmed evidence:

- `supabase/migrations/*` contains critical trigger and quota logic
- `services/supabaseDreamService.ts` assumes specific columns and fallback behavior
- `services/quota/SupabaseQuotaProvider.ts` depends on `quota_limits` and `quota_usage`
- `supabase/functions/api/routes/quota.ts` depends on `get_guest_quota_status` and `increment_guest_quota`

If migrations drift from production or are applied incorrectly, core write paths break in ways the mobile app cannot recover from.

## Goals

- define the minimum required database contract explicitly
- block releases when schema or trigger drift is detected
- catch breaking DB changes before they hit mobile clients
- provide an operational health check for critical DB capabilities

## Non-goals

- replacing Supabase migrations
- removing all trigger-based enforcement

## Target Architecture

## 1. Define a contract manifest

Create an internal manifest that names required database objects:

- tables: `dreams`, `quota_limits`, `quota_usage`, `guest_usage`
- functions: `get_guest_quota_status`, `increment_guest_quota`, `mark_fingerprint_upgraded`
- trigger functions for analysis, exploration, and chat quota enforcement
- required indexes and uniqueness constraints such as `dreams(user_id, client_request_id)`

This can live as code or JSON in the repo and be checked in CI.

## 2. Add migration smoke tests

CI should:

1. boot a fresh local Supabase instance
2. apply all migrations
3. run a smoke test script that verifies:
   - authenticated dream create/update/delete
   - analysis quota enforcement
   - chat quota enforcement
   - guest quota RPC behavior
   - subscription metadata update path

## 3. Add a schema drift check against remote

Release workflow should compare:

- local migration state
- local generated types
- remote schema snapshot

If remote contains unmanaged changes, the release should fail until they are codified.

## 4. Add a backend readiness check

Expose an internal health endpoint or script that verifies:

- required functions exist
- required triggers exist on `public.dreams`
- required policy names exist
- `quota_limits` contains rows for all supported tiers and periods

This should run after deploy and before mobile rollout.

## 5. Version the contract

Add a small `app_contract` table:

```sql
create table public.app_contract (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
```

Example:

- `db_contract_version = 4`

The backend can expose this in health checks and the client can report it in diagnostics.

## Implementation Plan

## Phase 1

- write the contract manifest
- add local migration smoke tests

## Phase 2

- add remote drift detection to release flow
- add post-deploy readiness script

## Phase 3

- add contract version reporting and operational dashboards

## Observability

Track:

- migration application failures
- schema drift detection failures
- readiness check failures by object type
- post-deploy canary failures for dream create/chat/analyze

Alert when:

- required RPC or trigger is missing after deploy
- post-deploy canary fails twice in a row

## Acceptance Criteria

- a missing trigger or RPC is caught in CI or post-deploy health checks before user traffic depends on it
- mobile releases are blocked if production drift is detected
- engineers can answer "what DB behavior is required for this app to function" from one manifest

## Risks

- smoke tests need maintenance as the schema evolves
- remote drift checks may surface existing unmanaged changes that require cleanup work first

## Open Questions

- whether to store the contract manifest in repo code, SQL comments, or both
- whether health checks should run from Edge Functions or external CI only
