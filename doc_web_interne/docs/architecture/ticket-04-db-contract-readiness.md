# Ticket 04: Database Contract Manifest and Readiness Checks

## Objective

Implement the smallest operational safety slice that makes the database contract explicit and testable before mobile releases depend on it.

This ticket is about drift detection and readiness verification, not a full infrastructure overhaul.

## Verified Current State

- `supabase/migrations/*` contains critical application behavior, not just schema.
- the app depends on tables such as `dreams`, `quota_limits`, `quota_usage`, and `guest_usage`.
- the app depends on functions such as `get_guest_quota_status`, `increment_guest_quota`, and `mark_fingerprint_upgraded`.
- quota and chat behavior also depend on triggers and trigger functions defined in migrations.
- there is no checked-in DB contract manifest.
- there is no repo-local readiness script or smoke-test script covering these required objects.

## Problem to Solve in This Slice

Today there is no single machine-checkable contract for “what database behavior must exist for the app to work”.

This ticket should add that contract and a lightweight readiness check.

## Scope

In scope:

- add a repo-local DB contract manifest
- add a readiness-check script that verifies required objects
- document or wire the script into the existing validation flow if practical

Out of scope:

- full remote-vs-local schema diff pipeline
- full local Supabase smoke test environment if that is too large for one pass
- dashboards or external monitoring systems

## Expected Deliverables

### 1. Contract Manifest

Add a checked-in manifest describing required objects.

Suggested coverage:

- tables:
  - `dreams`
  - `quota_limits`
  - `quota_usage`
  - `guest_usage`
- functions:
  - `get_guest_quota_status`
  - `increment_guest_quota`
  - `mark_fingerprint_upgraded`
- triggers or trigger functions required for:
  - authenticated monthly quota enforcement
  - chat quota enforcement
- required uniqueness/index assumptions where practical

The format can be JSON, TS, or another repo-friendly machine-readable format.

### 2. Readiness Check Script

Add a script that validates required DB objects exist.

At minimum verify:

- required tables exist
- required functions exist
- required trigger names or trigger functions exist on `public.dreams`
- quota limit rows exist for supported tiers/periods where expected

The script may target:

- a local Supabase instance
- a configured project
- or a SQL/admin connection already used in this repo

Choose the smallest approach that works with the existing repo tooling.

### 3. Documentation

Document:

- what the contract covers
- how to run the readiness check
- what failures mean

## Required Repo Inspection

Inspect at minimum:

- `supabase/migrations/*`
- `services/supabaseDreamService.ts`
- `services/quota/SupabaseQuotaProvider.ts`
- `supabase/functions/api/routes/quota.ts`
- existing scripts in `scripts/*`
- package scripts in `package.json`

## Deliverables

1. contract manifest file
2. readiness check script
3. package script wiring if appropriate
4. docs or README update if needed
5. tests or validation of the script where feasible
6. commit(s)

## Validation

Run the most relevant repo commands:

```bash
npm run typecheck:app
npm run lint
```

Also run the new readiness check directly and report the result.

If repo-wide validation is blocked by baseline failures, separate baseline from new issues clearly.

## Final Report Format

- findings first
- what was implemented
- what remains out of scope
- risks and follow-ups
- validation results
- exact files changed
- commit hashes

## Important Constraints

- do not revert unrelated user changes
- keep the contract manifest aligned to actual repo evidence
- prefer a small useful readiness check over a big incomplete CI redesign
- do not stop at analysis if implementation is feasible
