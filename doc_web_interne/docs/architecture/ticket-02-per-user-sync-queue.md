# Ticket 02: Per-User Offline Sync Queue and Convergence Slice

## Objective

Implement the smallest meaningful slice that fixes the most dangerous offline sync divergence issue in the current app: the mutation queue is still globally scoped and is cleared on auth transitions.

This ticket is not a full sync redesign. It focuses on per-user queue isolation and durable replay behavior across account changes.

## Verified Current State

- `hooks/useOfflineSyncQueue.ts` persists pending mutations locally.
- `hooks/useDreamPersistence.ts` reloads pending mutations and applies them over cached dreams on startup.
- `services/storageServiceReal.ts` stores pending mutations under one global key: `gemini_dream_journal_pending_mutations`.
- `context/AuthContext.tsx` calls `clearRemoteDreamStorage()` on user change.
- `clearRemoteDreamStorage()` removes both cached remote dreams and pending mutations.
- `createDreamInSupabase(...)` already uses `client_request_id` upsert semantics, so duplicate create replay is partially mitigated.
- There is still no server-side revision/conflict contract for dreams.

## Problem to Solve in This Slice

The queue is not isolated by user scope.

That causes two high-risk behaviors:

- pending authenticated work can be cleared during account switching
- queued work from one account can be mixed with another account’s local state

## Scope

In scope:

- namespace the local mutation queue by `userScope`
- stop deleting incompatible queues on auth transitions
- make queue loading respect the active `userScope`
- keep local replay deterministic after restart and account switch
- add tests for account-switch behavior

Out of scope:

- full server-side batch sync RPC
- conflict resolution UI
- full CRDT or collaborative sync
- introducing DB revision fields unless strictly necessary for this slice

## Expected Design

### 1. Add User-Scoped Queue Storage

Replace the current single pending-mutations store with a per-user-scope store.

Suggested model:

```ts
type UserScope = 'guest' | `user:${string}`;
```

Examples:

- guest queue lives under `guest`
- authenticated queue lives under `user:<supabase-user-id>`

The active session should only read and write its own queue.

### 2. Preserve Inactive Queues

On sign-in, sign-out, or account switch:

- do not delete another scope’s queue automatically
- hide incompatible queues from the active session
- only operate on the current scope

### 3. Keep Replay Deterministic

Replay order must remain stable and based on persisted mutation ordering.

Mutations must continue to preserve:

- mutation id
- operation type
- created timestamp
- stable `client_request_id` where applicable

### 4. Keep Existing Idempotency Behavior

Do not regress existing protections:

- create replay must keep using `client_request_id`
- update/delete replay must remain safe when remote IDs are missing or stale

## Required Repo Inspection

Inspect at minimum:

- `hooks/useDreamJournal.ts`
- `hooks/useDreamPersistence.ts`
- `hooks/useOfflineSyncQueue.ts`
- `context/AuthContext.tsx`
- `services/storageService.ts`
- `services/storageServiceReal.ts`
- `services/supabaseDreamService.ts`
- relevant tests in `hooks/__tests__/*` and `services/__tests__/*`

## Deliverables

1. per-user queue storage implementation
2. auth-transition changes so queues are not erased across accounts
3. hook changes to read/write only the active queue
4. tests covering:
   - guest to authenticated transition
   - authenticated account switch
   - app restart with queued work
5. validation results
6. commit(s)

## Validation

Run the most relevant repo commands:

```bash
npm run typecheck:app
npm run typecheck:tests
npm run test -- --runInBand
npm run lint
```

Also run targeted tests for:

- `hooks/__tests__/useOfflineSyncQueue.test.tsx`
- `hooks/__tests__/useDreamPersistence.test.tsx`
- any touched storage or auth-context tests

If validation is blocked by pre-existing repo failures, report baseline vs new failures clearly.

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
- preserve data safety and replay determinism
- prefer one cohesive user-scope slice over a broad partial sync redesign
- do not stop at analysis if implementation is feasible
