# Ticket 03: Server-Owned Subscription State Convergence Slice

## Objective

Implement the first real convergence slice that moves subscription truth toward a server-owned table instead of relying directly on `auth.users.raw_app_meta_data.tier` as the primary enforcement state.

This ticket should deliver a small but coherent server-side source-of-truth step, not a full billing architecture rewrite.

## Verified Current State

- `services/subscriptionServiceReal.ts` still reads RevenueCat directly on-device.
- `supabase/functions/revenuecat-webhook/index.ts` still writes tier changes into auth app metadata.
- `supabase/functions/api/routes/subscription.ts` still performs direct RevenueCat lookups and updates app metadata in-band.
- `hooks/useSubscriptionInternal.ts` still uses optimistic local tier changes and reconciliation loops.
- quota enforcement in migrations still reads `auth.jwt() -> app_metadata ->> 'tier'`.
- there is no `subscription_state` table in `supabase/migrations/*`.

## Problem to Solve in This Slice

Quota enforcement and subscription convergence still depend on JWT freshness and metadata propagation timing.

The main goal of this slice is to introduce a durable server-owned subscription record that webhook and refresh paths can both update.

## Scope

In scope:

- add `public.subscription_state`
- add a minimal audit trail table if needed for this slice
- refactor webhook and `/subscription/sync` to write `subscription_state`
- keep `app_metadata.tier` as a cache if necessary for compatibility
- preserve current client purchase/restore UX

Out of scope:

- fully removing app metadata usage from every path
- fully removing client-side RevenueCat reads
- complete version-based convergence if too large for one pass

## Expected Schema

Suggested starting point:

```sql
create table public.subscription_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tier text not null check (tier in ('free', 'plus')),
  is_active boolean not null,
  product_id text,
  entitlement_id text,
  source text not null,
  source_event_id text,
  source_updated_at timestamptz not null,
  version bigint not null default 1,
  updated_at timestamptz not null default now()
);
```

If the final schema needs compatibility-driven adjustments, keep the same core guarantees:

- one row per user
- server-owned writes only
- monotonic update tracking
- explicit source metadata

## Expected Implementation

### 1. Shared Server Update Path

Webhook and `/subscription/sync` must converge on one shared write model.

At minimum:

- infer the effective subscription tier
- update `subscription_state`
- then mirror cache fields into `app_metadata` only if still needed

### 2. Compatibility Layer

Do not break existing quota enforcement in one pass.

If quota triggers still depend on `app_metadata`, that is acceptable for this slice as long as:

- `subscription_state` becomes the first durable write target
- `app_metadata` is treated as a cache/mirror

### 3. Keep Observability Useful

Log enough context to debug:

- source path: webhook or sync
- prior tier
- next tier
- whether a durable row was created or updated

## Required Repo Inspection

Inspect at minimum:

- `services/subscriptionServiceReal.ts`
- `services/subscriptionSyncService.ts`
- `hooks/useSubscriptionInternal.ts`
- `context/AuthContext.tsx`
- `supabase/functions/revenuecat-webhook/index.ts`
- `supabase/functions/api/routes/subscription.ts`
- `supabase/migrations/*`

## Deliverables

1. migration adding `subscription_state`
2. shared server-side update path used by webhook and sync endpoint
3. compatibility-safe mirroring into `app_metadata` if required
4. tests for webhook/sync behavior where feasible
5. validation results
6. commit(s)

## Validation

Run the most relevant repo commands:

```bash
npm run typecheck:app
npm run test -- --runInBand
npm run lint
```

Also run targeted tests around subscription flows if available.

If validation is blocked by baseline repo issues, report baseline vs new failures clearly.

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
- preserve server-side correctness over optimistic client behavior
- prefer a narrow convergence slice over a broad partial rewrite
- do not stop at analysis if implementation is feasible
