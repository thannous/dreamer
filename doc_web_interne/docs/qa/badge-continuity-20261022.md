# Badge continuity — local implementation, 2026-10-22

Owner: badge-continuity work package. Base: `3705ef9c3d24195ae7cc42e937f1b9c7c233a664`
(Claude badge collection). Branch: `codex/badge-continuity-20261022`.
No remote migration, production publish, physical-device installation or Store action.

## Behavior

The original ledger was local only: a fresh client lost recorded readings, searches,
edits and original acquisition dates. The account now has one private `badge_ledgers`
row with a revision. The client unions distinct identities, keeps maxima and earliest
tier dates, then uses compare-and-swap; a conflicting write returns the current row
for another merge. Replaying an ambiguous acknowledgement does not add facts twice.
A newly crossed threshold after merging devices is stamped. Journal identities and
calendar keys are retained up to gold, so later-deleted dreams can still contribute.
Stable request/server identities take precedence over colliding local timestamps.
Legacy maxima remain, but identities never stored by an older client cannot be inferred.

The local ledger is also the durable pending state. Launch, local changes,
foreground/reconnection and active 30-second retries restore/upload it. Local progress
remains usable when offline or when the migration is absent. Collection status says
local, pending, backed up or retry pending in all six locales. No remote success is
claimed in mock mode. The SQL function binds the expected account and keeps RLS;
a late response only merges into the still-active scope. Confirmed account deletion
removes the local copy after pending writes; the remote FK cascades with auth.users.
Ordinary dream deletion does not revoke earned rewards.

The payload has no narrative, personal notes, queries or emotion data. The SQL check
accepts only known family IDs, bounded identifier arrays, counts and up to three dates.
Unknown fields, invalid types/identifiers and oversized values are rejected. Functions
use SECURITY INVOKER, fixed search_path and explicit grants; no anonymous table/RPC access.

## Local evidence

Passed on this worktree's final functional diff:

- `mise exec -- npm run test:file -- services/__tests__/badgeLedgerStore.test.ts services/__tests__/badgeLedgerSync.test.ts services/__tests__/accountDeletionService.test.ts lib/__tests__/badgeLedger.test.ts --watchman=false`: 4 suites, 27 tests.
- `mise exec -- npm run typecheck:app` and `mise exec -- npm run typecheck:tests`.
- `mise exec -- npm run test:testerarmy:typecheck`.
- Focused Expo lint on the changed store/transport/status, account cleanup, badge hosts,
  ledger and collection; `git diff --check`.

The named isolation gap is scheduling: deterministic simultaneous CAS writers,
lost acknowledgement, account change between awaits and late local writes cannot be
reliably forced through a UI journey. These tests use an in-memory transport and
storage, so they do not prove real Supabase or native SQLite behavior.

## Real backend journey prepared, integration owner runs it

`tools/e2e/tests/backend-badge-continuity.web.e2e.ts` contains:

1. Real RPC revisions, stale-write rejection, owner/other/anonymous isolation, prohibited
   owner reassignment, bounded-payload rejection and auth.users deletion cascade.
2. A UI save and symbol read, failed backup service while local state persists,
   reload/recovery, then a completely fresh authenticated browser restoring facts
   and original acquisition dates.

Use the repository's owned native Supabase runner, not production or an arbitrary
existing stack: `mise exec -- npm run test:e2e:backend -- tests/backend-badge-continuity.web.e2e.ts`.
The parent integration work package owns the single stack and its evidence artifacts;
these journeys were not executed separately in this child worktree. Database contracts
include the table columns and RPC signature. The parent also owns final integration
with Claude's overlapping ledger fixes, independent review, verify:pr and delivery.

Native/mobile, actual reinstall, production migration and multi-device production
behavior remain unqualified until their respective authorized runs.
