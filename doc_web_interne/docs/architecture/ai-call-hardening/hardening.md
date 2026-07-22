# Security Hardening Review: Noctalia AI Calls

## Evidence Basis

The original audit inspected the mobile orchestration, Edge Function routes, quota providers, durable image worker, and relevant migrations at revision `5a675e0d`. It found strong existing pieces—signed guest sessions, claim-before-cost analysis quotas, and an idempotent image queue—but split client/server ownership created redundant calls, stale-state races, and places where paid-work controls could drift.

The detailed evidence inventory is in [context.md](./context.md). The worktree contained unrelated voice-path edits at audit start; this review deliberately excludes them.

## Implementation Snapshot (2026-07-22)

The recommended option is now implemented locally, without deployment:

- dream capture persists before optional categorization or analysis;
- authenticated analysis can use one durable server-owned command behind `EXPO_PUBLIC_ANALYSIS_JOBS_ENABLED`, which defaults off for compatibility;
- analysis persistence and initial image admission reuse the same structured `imagePrompt`;
- image reconciliation polls one job and fetches one affected dream with foreground-aware `2/4/8/15s` backoff;
- authenticated quota status is returned by one `auth.uid()`-scoped snapshot RPC, while guests must present a signed guest token bound to their fingerprint;
- synchronous AI routes use hashed fixed-window actor/global admission, and durable jobs add exact actor concurrency, rate, retry, and global-backlog controls;
- authenticated chat uses normalized append-only messages, stable UUID request IDs, cached replay, one pending turn per dream, actor concurrency caps, stale leases, and attempt tokens that reject late provider responses;
- paid synchronous calls have no automatic transport retry, inputs and model outputs are bounded, and AI logs exclude transcripts, prompts, fingerprints, user IDs, and model bodies.

New AI state tables are private: direct `anon` and `authenticated` table access is revoked, RLS remains enabled, and narrow `SECURITY DEFINER` RPCs use an empty `search_path` and server-derived identity. Realtime remains deferred until a private user-scoped channel is justified by measured polling volume.

## Constraints

- Native speech recognition remains the primary path; `/transcribe` remains Android fallback only.
- Local dream capture must continue to work when guest AI bootstrap or the network is unavailable.
- Server quota claims, not cached client status, authorize paid work.
- Existing image jobs and offline dream mutations must migrate compatibly.
- No production deployment or destructive database action is authorized by this review.
- No measured latency or infrastructure budget was supplied; we use a balanced profile and add measurement gates.

## Opportunity Portfolio

| Opportunity | Evidence | Options | Recommendation | Proposal |
| --- | --- | --- | --- | --- |
| Centralize paid AI command ownership | Blocking save, client orchestration, duplicated image prompt, uneven retries and limits (`E-SAVE`, `E-ORCH`, `E-PROMPT`, `E-RETRY`, `E-INPUT`) | 1. Local controls; 2. Server-owned durable command; 3. Split functions and push delivery | Implement Option 2 incrementally; keep Option 1 controls during migration and defer function splitting until telemetry justifies it | [Centralize AI command ownership](./proposals/centralize-ai-command-ownership.md) |

## Recommendation Summary

I recommend a server-owned durable analysis command because it reuses the job and quota foundations already present without forcing an immediate multi-function deployment. The client should save first, submit one idempotent command, and observe server-owned state. The analysis worker should persist the structured result and enqueue the image with the `imagePrompt` it already produced.

We should keep local input bounds, targeted image refresh, conservative retries, and polling backoff as tactical controls throughout the migration. Realtime delivery is useful after the state owner is stable, but it is not an authorization boundary and polling remains the recovery path.

## Next Decisions

- Choose initial authenticated per-actor burst and concurrency limits from telemetry; conservative defaults must remain environment-configurable.
- Decide whether automatic quick categorization is removed or becomes a non-blocking job. It must not delay durable save.
- Confirm whether iOS guest AI is intentionally unsupported before changing guest-session platform policy.
- Split the monolithic `api` function only after measuring correlated latency or saturation; analysis-job ownership does not require that split first.
