# Spec 03: Converge Subscription State on a Single Server-Side Source of Truth

## Verification Snapshot (2026-03-15)

### Confirmed

- `services/subscriptionServiceReal.ts` still reads RevenueCat directly on-device.
- `supabase/functions/revenuecat-webhook/index.ts` still writes tier changes into `auth.users.raw_app_meta_data`.
- `supabase/functions/api/routes/subscription.ts` still performs direct RevenueCat lookups and updates auth metadata in-band.
- `hooks/useSubscriptionInternal.ts` still uses optimistic local tier updates plus polling/reconciliation loops around `refreshUser(...)` and `/subscription/sync`.
- Database quota enforcement still depends on `auth.jwt() -> app_metadata ->> 'tier'` in migrations such as `20251220000000_unify_quota_tables.sql` and `20251222115718_remote_schema.sql`.

### Inferred

- The convergence lag described here is still plausible because server enforcement depends on JWT freshness after webhook-driven metadata changes.

### Wrong / stale

- There is still no `public.subscription_state` table or `subscription_events` audit table in `supabase/migrations/*`.
- Quota enforcement has not moved to a server-owned subscription table lookup; JWT/app metadata remains the enforcement path.
- Monotonic versioning and version-based client convergence are not implemented yet.

## Problem

Subscription state currently spans multiple layers:

- RevenueCat customer info
- RevenueCat webhook updates
- scheduled reconcile job
- Supabase `app_metadata.tier`
- client-side RevenueCat status cache
- JWT freshness for DB trigger-based quota checks

Confirmed evidence:

- `services/subscriptionServiceReal.ts` reads RevenueCat directly on-device
- `supabase/functions/revenuecat-webhook/index.ts` writes tier into Supabase auth metadata
- `supabase/functions/api/routes/subscription.ts` also performs RevenueCat lookups and updates metadata
- `hooks/useSubscriptionInternal.ts` runs reconciliation loops and optimistic local tier updates
- `services/quota/SupabaseQuotaProvider.ts` and DB triggers rely on tier-dependent quota enforcement

This creates convergence lag and inconsistent authorization during purchase, restore, expiration, and account switching.

## Goals

- define one authoritative subscription state for server enforcement
- make convergence measurable and bounded
- remove dependence on stale JWT claims for quota correctness
- keep client UX fast without making the client authoritative

## Non-goals

- replacing RevenueCat
- removing client-side paywall or RevenueCat SDK usage

## Target Architecture

## 1. Add a server-owned subscription state table

Create:

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

Rules:

- only server-side jobs/functions write this table
- webhook and reconcile paths update the same record model
- `app_metadata.tier` becomes a cache for client convenience, not the source of truth

## 2. Move quota enforcement to table lookups, not JWT metadata

DB quota checks must read `public.subscription_state` by `auth.uid()` inside security definer functions or server-owned RPCs.

Do not depend on:

- `auth.jwt() -> app_metadata.tier`
- client-side optimistic tier state
- session refresh racing a webhook

## 3. Introduce monotonic versioning

Each subscription update increments `version`.

Client flow after purchase or restore:

1. RevenueCat purchase succeeds.
2. Client calls `POST /subscription/refresh`.
3. Server fetches RevenueCat, updates `subscription_state`, mirrors cache to `app_metadata`, returns `version`.
4. Client waits until local status reflects at least that version.

This replaces unbounded reconciliation loops.

## 4. Unify webhook and refresh semantics

Server update paths:

- webhook: push-based, best latency
- refresh endpoint: explicit pull after purchase/restore
- reconcile job: backstop for missed webhook delivery

All three must call the same update function and emit the same audit record shape.

## 5. Keep an audit trail

Add `subscription_events` for debugging:

- event source
- prior tier
- next tier
- RevenueCat customer id
- event timestamp
- processing timestamp
- outcome

## Implementation Plan

## Phase 1

- add `subscription_state` and `subscription_events`
- refactor webhook and `/subscription/sync` to write those tables first

## Phase 2

- change quota enforcement to read `subscription_state`
- stop using JWT tier claims for server correctness

## Phase 3

- replace client reconciliation loops with version-based refresh

## Observability

Track:

- webhook processing latency
- refresh endpoint success rate
- reconcile updates per run
- difference between RevenueCat state and `subscription_state`
- time-to-convergence after purchase

Alert when:

- convergence exceeds 60 seconds
- webhook failures exceed 1% over 15 minutes
- reconcile changes spike unexpectedly

## Acceptance Criteria

- paid users stop hitting free-tier quota checks after server refresh completes
- expired users are downgraded consistently even if the client was offline
- account switch cannot leak previous subscription state into the next user session
- all server-side quota decisions can be explained from `subscription_state` plus audit events

## Risks

- changing quota enforcement touches critical DB triggers and RPCs
- backfilling existing users into `subscription_state` needs careful rollout

## Open Questions

- whether `premium` should remain as an alias or be removed entirely from all client/server types
- whether to expose subscription version to the app via auth refresh or a dedicated endpoint only
