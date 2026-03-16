# Spec 02: Make Offline Sync Durable and Convergent

## Status

Closed on 2026-03-16.

Implemented in app code, storage, UI, tests, and Supabase migration/RPC. Operational observability is now wired for:

- pending mutation count per user
- oldest pending mutation age
- replay success rate
- conflict rate
- queue-clear incidents while pending mutations exist

## Verification Snapshot (2026-03-15)

### Confirmed

- `hooks/useOfflineSyncQueue.ts` still models the authoritative sync queue as a locally persisted mutation list.
- `services/storageServiceReal.ts` stores pending mutations under a single global `gemini_dream_journal_pending_mutations` key rather than a per-user namespace.
- `context/AuthContext.tsx` still calls `clearRemoteDreamStorage()` on user change, which clears both the cached remote dreams and the pending mutation queue.
- `hooks/useDreamPersistence.ts` still hydrates cached remote dreams plus pending mutations and overlays them locally with `applyPendingMutations(...)`.
- There are still no server-side revision or conflict fields in the `dreams` contract exposed by `services/supabaseDreamService.ts` or the checked migrations.

### Inferred

- Silent overwrite risk remains because sync replays client state without server revision checks or structured conflict responses.

### Wrong / stale

- "app kill before replay" is overstated as a loss mode. Pending mutations are persisted in local storage and reloaded on restart, so app restarts are not the primary durability gap.
- Duplicate create replay is partially mitigated already: `createDreamInSupabase(...)` upserts on `(user_id, client_request_id)`, and `useOfflineSyncQueue.ts` ensures `clientRequestId` values for queued creates/updates.
- The convergence and isolation problems are still real, but they are driven more by global queue scope, auth-transition clearing, and missing conflict markers than by simple process death.

## Problem

The app is offline-first, but the authoritative mutation queue is currently local-only and vulnerable to divergence.

Confirmed evidence:

- `hooks/useOfflineSyncQueue.ts` persists pending mutations only on-device
- `hooks/useDreamPersistence.ts` loads cached dreams plus pending mutations, then replays them
- `context/AuthContext.tsx` clears remote dream cache on user change
- `services/storageServiceReal.ts` stores cached remote dreams and pending mutations as local JSON payloads

Failure cases:

- app kill before replay
- account switch with pending authenticated work
- duplicate create/update replay after partial success
- silent overwrite when local and remote both changed

## Goals

- never silently drop a user mutation
- preserve per-user queue isolation across auth transitions
- support deterministic replay after app restart
- add conflict detection instead of implicit last-write-wins everywhere

## Non-goals

- full CRDT collaboration
- multi-device real-time co-editing

## Target Architecture

## 1. Promote mutations to a first-class sync log

Add a local sync log model with explicit state:

```ts
type SyncMutationStatus = 'pending' | 'sending' | 'acked' | 'failed' | 'blocked';

type SyncMutation = {
  id: string;
  userScope: string;
  entityType: 'dream';
  entityKey: string;
  operation: 'create' | 'update' | 'delete';
  clientRequestId: string;
  baseRevision?: string;
  clientUpdatedAt: number;
  payload: unknown;
  status: SyncMutationStatus;
  retryCount: number;
  lastError?: string;
};
```

Requirements:

- queue is namespaced by `userScope`
- logout must not delete queued work automatically
- switching accounts must hide incompatible queues from the active session, not erase them

## 2. Reintroduce explicit revision fields on `dreams`

The server needs durable conflict markers. Add:

- `updated_at timestamptz not null default now()`
- `client_updated_at timestamptz`
- `revision_id uuid not null default gen_random_uuid()`

Every accepted mutation must update `updated_at` and `revision_id`.

## 3. Add a batch sync contract

Instead of replaying one mutation at a time through scattered table writes, add a dedicated sync endpoint or RPC:

- input: ordered mutations for one user
- output: per-mutation ack, reject, or conflict

Server responsibilities:

- apply idempotency by `client_request_id`
- compare `baseRevision` with current `revision_id`
- reject conflicting updates with a structured conflict payload

## 4. Separate optimistic UI state from sync state

Each dream in local state should carry:

- `syncState: 'clean' | 'pending' | 'conflict' | 'failed'`
- `lastSyncedAt`
- `lastSyncError`

The user should be able to see when a dream is still pending or failed, especially before logout or reinstall.

## 5. Preserve deletes with tombstones

Deletes should not depend only on a disappearing local record.

Add tombstones to the local queue until the server acknowledges the delete. Otherwise a stale cached dream can reappear after a fallback reload.

## Implementation Plan

## Phase 1

- add `updated_at`, `client_updated_at`, `revision_id` to `public.dreams`
- replace the current queue shape with a versioned mutation log

## Phase 2

- add server batch sync endpoint
- return structured conflict responses

## Phase 3

- add UI for sync state, retry, and conflict resolution

## Observability

Track:

- pending mutation count per user
- oldest pending mutation age
- replay success rate
- conflict rate
- queue loss incidents after auth changes

Alert when:

- oldest pending mutation age exceeds 1 hour
- replay success drops below 99%
- queue is cleared while pending count was non-zero

Implemented notes:

- queue metrics are emitted during hydration and every pending-queue persistence cycle
- replay metrics are emitted after each sync batch with aggregate success/conflict rates
- queue-clearing code emits an explicit alert if pending mutations exist before deletion

## Acceptance Criteria

- force-closing the app during replay does not lose queued work
- switching users does not delete another user's queued mutations
- duplicate create replay does not create duplicate dreams
- conflicting updates are surfaced as conflicts, not hidden overwrites

## Risks

- adding revisions changes server write contracts and migration complexity
- conflict handling needs explicit product decisions for merge UX

## Open Questions

- whether failed queues should be exportable for support/debugging
- whether guest-created local dreams should migrate through the same sync log once authenticated
