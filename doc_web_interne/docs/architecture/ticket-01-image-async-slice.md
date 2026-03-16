# Ticket 01: Async Image Generation Slice

## Objective

Implement the smallest shippable async job slice for image generation only.

The current backend still runs image generation synchronously inside the shared `api` edge function. This ticket introduces a durable async path for image generation without attempting to migrate the entire AI stack in one pass.

## Verified Current State

- `supabase/functions/api/index.ts` is still a single edge-function router.
- `supabase/functions/api/routes/images.ts` still performs Gemini image generation synchronously in the request path.
- There is no `ai_jobs` table in `supabase/migrations/*`.
- The mobile client still calls long-running image endpoints directly through `services/geminiServiceReal.ts`.
- Guest and authenticated quota enforcement already exists and must remain fail-safe.

## Scope

This ticket covers image generation only.

In scope:

- add a durable `ai_jobs` table
- add a command endpoint for creating image jobs
- return immediately with `202 Accepted` and a `jobId`
- add a dedicated worker to process queued image jobs
- add a job-status read endpoint
- update the client to submit image commands and observe job state
- preserve idempotency and quota correctness

Out of scope:

- migrating `analyzeDream` to async jobs
- redesigning the full backend topology
- replacing Gemini
- adding Realtime if simple polling is sufficient for this slice

## Expected Architecture

### 1. Database

Add a durable job table in Postgres:

```sql
create table public.ai_jobs (
  id uuid primary key,
  user_id uuid references auth.users(id) on delete cascade,
  dream_id bigint references public.dreams(id) on delete cascade,
  job_type text not null check (job_type in ('generate_image')),
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

If the final schema needs small adjustments for repo compatibility, keep the same durability and idempotency properties.

### 2. Command Endpoint

Create a dedicated command path for image generation.

Responsibilities:

- validate auth or guest session
- validate quota before expensive work starts
- enforce idempotency using `client_request_id`
- insert or reuse an `ai_jobs` row
- return `202 Accepted` with `jobId`

This endpoint must not call Gemini directly.

### 3. Worker

Create a separate worker edge function for image jobs.

Responsibilities:

- claim queued jobs
- mark `running`
- call Gemini
- store result payload
- mark `succeeded` or `failed`
- increment attempts and stop at `max_attempts`
- keep logs useful and non-sensitive

### 4. Job Status Read Endpoint

Add a read path that returns:

- `jobId`
- `status`
- `result_payload` when complete
- `error_code` and `error_message` when failed

The mobile app can use polling for this first slice.

### 5. Client Changes

Update the client so image generation is command-based instead of long-running request-based.

Expected flow:

1. client sends image command with stable `client_request_id`
2. server returns `202` and `jobId`
3. client stores pending state
4. client polls job status
5. client updates the dream when job completes

The client must survive app restart while a job is still queued or running.

## Quota and Safety Rules

- keep "claim before cost" semantics
- do not silently allow expensive guest actions when remote validation is unavailable
- fail closed for quota-sensitive actions
- if the job fails before billable upstream work starts, do not permanently consume quota
- duplicate submissions with the same `client_request_id` must reuse the existing job

## Required Repo Inspection

The implementation must be based on actual repo evidence, not assumptions.

Inspect at minimum:

- `hooks/useDreamJournal.ts`
- `hooks/useDreamPersistence.ts`
- `hooks/useOfflineSyncQueue.ts`
- `services/*`
- `context/*`
- `lib/*`
- `supabase/functions/api/*`
- `supabase/functions/revenuecat-webhook/index.ts`
- `supabase/migrations/*`

## Deliverables

1. migration adding `ai_jobs`
2. command endpoint for image jobs
3. worker for image jobs
4. job status endpoint
5. client updates for queued image generation
6. tests for changed behavior
7. validation results
8. commit(s)

## Validation

Run the most relevant commands available in the repo:

```bash
npm run typecheck:app
npm run test -- --runInBand
npm run lint
```

Also run any targeted tests relevant to touched files.

If validation is blocked by pre-existing repo failures, report that clearly and separate new failures from baseline failures.

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
- preserve idempotency and data safety
- prefer one cohesive end-to-end slice over broad partial edits
- do not stop at analysis if implementation is feasible
