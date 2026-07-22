# Implementation Plan: Server-Owned Durable AI Command

## Selected Design And Constraints

The selected design is Option 2 from the hardening proposal: one idempotent server command owns quota authorization, durable state transitions, analysis persistence, and image enqueueing. Local capture remains available independently. Native speech files with pre-existing changes are outside this plan.

## Source Revision And Drift Check

- Design revision: `5a675e0d2d6ff164e3b43f6c28216fa602c14c8b`
- Evidence digest: `b00837e3c7968f3bf46eca3353eecda08aa2db4c5612a153f9bf7dc7028c1c6c`
- Initial drift: unrelated user-owned speech changes only

Relevant drift must be rechecked before every migration or worker change.

## Affected Components

- `app/recording.tsx`
- `hooks/useDreamSaving.ts`
- `hooks/useDreamJournal.ts`
- `services/geminiServiceReal.ts`
- `services/supabaseDreamService.ts`
- `services/quota/SupabaseQuotaProvider.ts`
- `supabase/functions/api/routes/dreams.ts`
- `supabase/functions/api/routes/imageJobs.ts`
- `supabase/functions/api/services/imageJobs.ts`
- `supabase/functions/analysis-job-worker/index.ts`
- additive admission, quota snapshot, analysis job, and normalized-chat migrations

## Ordered Work Packages

1. Add shared server request bounds, strict request identifiers, conservative retry policy, and focused tests.
2. Persist dreams before optional categorization; prevent enrichment from overwriting pending or completed analysis.
3. Return or fetch only the affected dream after image completion and add foreground-aware exponential polling.
4. Add an additive `analyze_dream` job type plus an atomic service-role command RPC that enforces idempotency, per-actor active limits, burst limits, global backlog cutoff, quota claim, and pending state.
5. Add an analysis worker that claims one job, calls the structured analysis model, persists the result, and inserts an image job using the returned `imagePrompt`.
6. Switch authenticated clients to analysis commands behind a compatibility flag; retain synchronous guest analysis until equivalent guest result storage is proven.
7. Evaluate private Realtime completion events; retain targeted status polling as the mandatory recovery path.
8. Consolidate quota status into one snapshot RPC and remove mandatory client preflight from the paid action path.
9. Store new authenticated chat turns in append-only rows with atomic begin/complete RPCs; retain `dreams.chat_history` as a compatibility projection. Retire legacy synchronous image/full-analysis endpoints only after production usage evidence.

## Compatibility And Migration

All schema changes are additive first. Existing `generate_image` jobs keep their current worker. The client accepts both synchronous analysis results and `202` job acknowledgements during rollout. Old endpoints remain until telemetry proves no supported build calls them.

The authenticated analysis client path is guarded by `EXPO_PUBLIC_ANALYSIS_JOBS_ENABLED=true` and defaults off. Deployment order is migrations, API function, analysis worker, then a client build with the flag enabled. Disabling the flag restores the synchronous compatibility path without deleting queued data.

Realtime is deliberately deferred in this implementation. `ai_jobs` has no client-readable RLS policy and is intentionally service-only; exposing it merely to save a handful of bounded, backoff-controlled status reads would enlarge the privacy boundary. Foreground-aware polling reads one job and then one dream. A private, user-scoped completion channel can be added later if measured polling volume justifies that boundary.

Quota status follows the same authority boundary. Authenticated reads use one snapshot RPC scoped by `auth.uid()`. Guest reads fail closed unless the request includes a valid backend-signed guest session bound to the submitted fingerprint and platform. Account-upgrade marking additionally requires the signed guest proof captured before sign-in, so an authenticated caller cannot mark an arbitrary fingerprint as upgraded.

Authenticated chat keeps the synchronous provider call for compatibility, but its command lifecycle is now durable and idempotent. A stable request UUID returns an in-progress response or the cached completed turn; a three-minute lease permits recovery, and the incremented attempt token prevents a late response from an older provider attempt from winning. Direct table access is revoked and only scoped RPCs may begin, complete, or fail a turn.

## Tactical Protections During Migration

- Enforce transcript, prompt, message, request-id, URL, and payload limits before provider work.
- Require a server-validated actor and an idempotency key for every paid command.
- Keep claim-before-cost and fail closed when quota or subscription authority is unavailable.
- Bound per-actor active jobs and request bursts, and reject new work when the global queue is above its configured ceiling.
- Never log transcript, prompt, audio, fingerprint, bearer tokens, or model response bodies.
- Persist only hashed actors in synchronous rate buckets; use job status and aggregate bucket counts as content-free operational metrics.

## Tests And Security Validation

- Duplicate commands return the existing job and never consume quota twice.
- Concurrent distinct commands above the actor limit are rejected before provider work.
- Oversized or malformed inputs fail before quota or provider calls.
- Worker retries cannot run the same queued attempt concurrently.
- A failed pre-provider attempt releases only reservations that are safe to release.
- A stale categorization result cannot overwrite pending or completed analysis.
- Guests without a valid signed session cannot reach provider work.
- Native speech recognition and Android-only server fallback behavior remain unchanged.

Database validation now covers both the full repository history and focused behavior:

- the first tracked migration contains the recovered, idempotent baseline for the Dashboard-created `public.dreams`, `public.quota_usage`, and `public.waitlist_subscribers` tables, so later historical `ALTER TABLE` statements have a reproducible starting point;
- the historical waitlist `bigint` to UUID conversion now changes the column type before installing its UUID default, and the generated Realtime trigger is conditional because `realtime.subscription` is platform-owned and may not yet exist during application migration replay;
- `supabase db reset --local --no-seed` recreates the database and applies all 44 tracked migrations through `20260722134500_add_idempotent_chat_turns.sql`, including the service-only `ai_jobs` grant correction;
- `supabase migration list --local` reports the same 44 versions locally and in the reset database, `npm run db:contract:check:local` passes all 46 checks, and Supabase database lint reports no errors;
- all five new migrations also apply in order on an isolated PostgreSQL 17.6 harness, where behavior assertions cover actor/global rate limits, exact quota consumption, idempotency input binding, job completion with prompt reuse, chat replay/concurrency/attempt leases, normalized quota counts, and absence of direct client grants.

The final source snapshot also passes:

- all 204 Jest suites (1,929 tests), including native speech-recognition and Android fallback coverage;
- all 76 Deno API and webhook tests and `deno check --frozen` for the API, analysis worker, and image worker;
- application and test TypeScript checks;
- full lint with zero errors (the repository still reports 57 non-blocking React/lint warnings outside this hardening gate);
- a full tracked local Supabase reset, migration-history alignment, and all 46 database contract checks (database lint retains one non-blocking unused-variable warning in `complete_authenticated_chat_turn`);
- the mobile security audit with zero failed automated checks; dynamic device, release-artifact, and supply-chain checks remain explicit manual/release gates.

## Performance And Resource Benchmarks

Record command acknowledgement latency, provider latency, queue age, attempts, terminal failures, per-dream fetch bytes, polling requests per completed job, and Gemini calls per analyzed dream. Compare the current flow with the candidate on the same scripted workload; no percentage target is claimed before a baseline exists.

## Rollout And Rollback

The backend rollout completed in production on 2026-07-22: the service-only grant correction and five additive migrations were applied, followed by the API function, analysis worker, and updated image worker. The client flag remains disabled, so authenticated analysis continues to use the synchronous compatibility path until a separately validated client build enables `EXPO_PUBLIC_ANALYSIS_JOBS_ENABLED=true`. Disable that flag to return a flagged client to synchronous analysis. Keep new rows readable and drain queued jobs before removing worker code. Database rollback is forward-compatible: stop creating the new job type before removing any additive object.

## Acceptance Criteria

- Saving a valid dream does not await any AI request.
- One client command owns each analysis request and is idempotent across retries and restarts.
- Analysis and its initial image use one shared `imagePrompt` generation.
- The server, not cached client state, authorizes quota and concurrent paid work.
- Image completion updates one dream without reloading the full collection.
- Costly routes reject malformed, oversized, burst, concurrent, duplicate, and backlog-exceeding work before provider invocation.
- Focused tests, app typecheck, test typecheck, and relevant Deno route/worker tests pass. Database contract validation requires an initialized local or configured validation database; an empty database is not a valid contract target.

## Production Rollout Evidence And Remaining Gates

- Authenticated analysis defaults: one active/free, two active/Plus, four/free and twelve/Plus per ten-minute window, three worker attempts, and a global backlog ceiling of 200. All are bounded environment overrides.
- Quick categorization remains optional and non-blocking; it never delays durable save and has no automatic transport retry.
- Guest analysis remains synchronous behind signed guest identity and atomic quotas; the authenticated job flag does not change guest behavior.
- Production migration history contains the same 44 versions as the tracked repository. The latest deployed versions are `20260722120413`, `20260722123000`, `20260722124500`, `20260722130000`, `20260722133000`, and `20260722134500`.
- Production Edge Functions are active as `api` v92, `analysis-job-worker` v1, and `image-job-worker` v11. External unauthenticated worker probes return `401`, while the API CORS probe returns `200`.
- `anon` and `authenticated` have no direct table privileges on `ai_jobs`; `service_role` retains only `SELECT`, `INSERT`, `UPDATE`, and `DELETE`. The authenticated command RPCs are deliberately executable only by `authenticated` and `service_role`, with an empty `search_path`.
- Post-rollout Supabase advisors add only expected notices for private RLS tables without client policies, authenticated command RPCs, and new/unused indexes. The unindexed `dream_chat_messages.user_id` foreign key remains a non-blocking performance follow-up.
- Production telemetry must prove supported-client usage before any legacy endpoint is removed.
- No feature-flagged mobile build has been produced or deployed; client activation and production telemetry remain separate release gates.
