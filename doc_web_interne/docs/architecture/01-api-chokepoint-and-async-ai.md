# Spec 01: Break Up the API Chokepoint and Move AI Work Off the Request Path

## Verification Snapshot (2026-07-22)

### Confirmed

- `supabase/functions/api/index.ts` is still a single edge-function router for guest session, quota, subscription sync/reconcile, chat, dream analysis, and image generation.
- `supabase/functions/api/routes/dreams.ts` and the legacy `images.ts` routes still call Gemini synchronously inside the request lifecycle.
- `supabase/functions/api/routes/subscription.ts` still performs in-band RevenueCat lookups before returning.
- The synchronous `/analyzeDream` compatibility route remains, while authenticated clients can use durable `analyze_dream` jobs behind `EXPO_PUBLIC_ANALYSIS_JOBS_ENABLED`.
- Image generation now uses durable `ai_jobs` rows and the dedicated `image-job-worker` Edge Function.
- Image reconciliation reads one job and one affected dream with foreground-aware backoff.
- Authenticated chat turns use atomic begin/complete RPCs and append-only message rows; `dreams.chat_history` is retained as a compatibility projection.
- Quota status uses one authenticated snapshot RPC or a backend-signed guest session; arbitrary client fingerprints no longer authorize quota reads or upgrade marking.
- New AI job/chat tables are private and are exposed only through narrowly granted RPCs; client-readable Realtime on `ai_jobs` remains intentionally disabled.
- The recovered historical schema baseline now survives a full `supabase db reset --local --no-seed`: all 44 tracked migrations apply and all 46 database contract checks pass.
- The production backend now contains the same 44 migration versions and active `api` v92, `analysis-job-worker` v1, and `image-job-worker` v11 deployments. The authenticated analysis client flag remains disabled.

### Inferred

- The remaining operational risk is source-derived rather than measured: unrelated command, quota, subscription, chat, transcription, and synchronous analysis requests still share the `api` function failure domain.

### Still open / not production-proven

- The target split by failure domain is not implemented yet. There are no dedicated `guest-session-api`, `quota-api`, `dream-command-api`, `chat-api`, or `subscription-api` functions.
- The migrations and backend functions are production-deployed, but the durable authenticated-analysis path is not production-used until a separately validated client build enables its feature flag.
- The failure-domain split into separate public API functions remains unimplemented; durable analysis ownership does not by itself isolate the monolithic router.
- The full local migration reset and focused PostgreSQL 17.6 behavior checks pass, and the production schema/function rollout is verified. End-to-end production behavior remains gated on the flagged client build and telemetry.

## Problem

The current backend is a single Supabase Edge Function named `api` that handles:

- guest session creation
- quota reads and mutation
- subscription sync and reconcile
- dream analysis
- chat
- image generation

Confirmed evidence:

- `supabase/functions/api/index.ts` routes all of these concerns through one function
- `supabase/functions/api/routes/dreams.ts` and `images.ts` call Gemini synchronously inside the request lifecycle
- `supabase/functions/api/routes/subscription.ts` also depends on external RevenueCat lookups in-band

This creates a single failure domain. Cold starts, latency spikes, upstream outages, or function saturation affect unrelated critical paths at once.

## Goals

- reduce correlated outages between AI, quota, guest auth, and subscription flows
- bound user-facing latency for write paths
- make AI/image processing retryable and observable
- preserve idempotency for dream analysis and image generation

## Non-goals

- changing the AI vendor
- redesigning the dream analysis UX
- replacing Supabase as the core backend

## Target Architecture

## 1. Split functions by failure domain

Replace the single `api` function with separate Edge Functions:

- `guest-session-api`
- `quota-api`
- `dream-command-api`
- `chat-api`
- `subscription-api`
- `ai-worker`

Rules:

- `guest-session-api`, `quota-api`, and `subscription-api` must never call Gemini
- `dream-command-api` may validate input and enqueue work, but must not perform long-running AI calls
- `chat-api` can remain synchronous initially, but it should be isolated from image generation and subscription traffic

## 2. Introduce async jobs for analysis and image generation

Add a durable job table in Postgres:

```sql
create table public.ai_jobs (
  id uuid primary key,
  user_id uuid references auth.users(id) on delete cascade,
  dream_id bigint references public.dreams(id) on delete cascade,
  job_type text not null check (job_type in ('analyze_dream', 'generate_image')),
  status text not null check (status in ('queued', 'running', 'succeeded', 'failed')),
  request_payload jsonb not null,
  result_payload jsonb,
  error_code text,
  error_message text,
  attempt_count integer not null default 0,
  max_attempts integer not null default 3,
  client_request_id text not null,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

create unique index idx_ai_jobs_type_request
  on public.ai_jobs(job_type, client_request_id);
```

## 3. Make the client submit commands, not long-running requests

Client flow:

1. `dream-command-api` validates auth/quota/idempotency.
2. It writes `dreams.analysis_status = 'pending'` and inserts an `ai_jobs` row.
3. It returns immediately with `202 Accepted` and the job id.
4. The client polls job status or subscribes via Realtime.
5. `ai-worker` executes the Gemini call and writes the result back to `dreams`.

## 4. Keep quota claim-before-cost semantics

Quota-consuming actions must claim quota before the expensive AI call starts.

For analysis:

- persist pending state
- insert quota usage or reserve quota atomically
- enqueue job

For image generation:

- reserve image quota before the worker runs
- release reservation only if the job fails before any billable upstream call

## 5. Add per-function timeout budgets

- `guest-session-api`: 5-10s
- `quota-api`: 3-5s
- `subscription-api`: 8-10s
- `dream-command-api`: 5-10s
- `chat-api`: 20-30s
- `ai-worker`: background retry budget, not tied to mobile request timeout

## Implementation Plan

## Phase 1

- create `ai_jobs`
- add job status read endpoint
- move image generation behind the queue first

## Phase 2

- move dream analysis behind the queue
- keep chat synchronous but isolated in its own function

## Phase 3

- evaluate whether chat also needs queued or streaming worker execution

## Observability

Add metrics and logs for:

- request count, p95, p99, and 5xx by function
- queue depth by `job_type`
- oldest queued job age
- worker attempt count and terminal failure rate
- cold start duration by function

Alert when:

- queue age exceeds 2 minutes for analysis
- any function has >2% 5xx over 5 minutes
- worker failure rate exceeds 5% over 15 minutes

## Acceptance Criteria

- guest session and quota endpoints remain healthy during Gemini degradation
- image generation failures do not impact subscription sync or chat route latency
- client can survive app restart while a job is queued or running
- a duplicate client submission with the same `client_request_id` returns the existing job/result

## Risks

- queue processing introduces state transitions the client must handle cleanly
- background workers require operational ownership and retry policy discipline

## Open Questions

- whether to use polling only or Supabase Realtime for job completion
- whether chat should move directly to streaming rather than a simple synchronous split
