# Dreamer guide reading progression

Implementation owner: Codex guide-progress work package, 2026-10-22. Based on
Claude badge PR #552 (`3705ef9c3d24195ae7cc42e937f1b9c7c233a664`); parent integrates
with its final badge fixes. No deployment or remote migration is authorized by this change.

## Product contract

- Eight stable guide IDs across all six languages. Opening only marks **visited**;
  a bookmark marks **in progress**. Only the reader's **Mark as completed** action
  completes the guide. No timer, scroll percentage, or exercise claims comprehension.
- Resume uses a content-section bookmark and current layout, rather than a pixel
  offset tied to one language or text size. The list offers the latest unfinished guide.
- Four practical guides offer optional exercises into existing journal, recording,
  recall and lucid ritual routes. They never block completion or require disrupted sleep.
- `guide_viewed` is retained as a backward-compatible badge event name, emitted only
  for explicit completions from now on. Existing earned tiers and old ledger keys
  remain; historical views are never converted into completed reading records.

## Persistence and accounts

`GuideReadingHost` permanently follows Dreamer authentication, including account changes while
all guide screens are closed. It preserves the guest-to-account transition through auth loading.
`guideReadingStore` stores `noctalia_guide_reading_v1:guest` or `user:<id>` locally.
A guest-to-account transition reserves the guest payload for its first owner with
`__claimOwner`, writes that owner's merged state, then removes the guest key. An
interrupted transfer can finish locally when another scope opens without exposing
its contents to the new account. A cold authenticated start does not claim unrelated
unclaimed guest data automatically.

`guide_reading_progress` stores one row per user/guide. RLS and the merge RPC require
ownership and Dreamer's legacy/journal product scope. Latest timestamp wins between actual bookmarks; a newer section-zero visit never replaces
a positive bookmark or its timestamp; completion is monotone. Local state stays usable when offline or before
the migration is installed, with visible retry. Sync occurs on focus, foreground,
leaving the screen and completion. Remote responses and queued work cannot publish
into another account. No journal text or exercise answer is sent with this state.

Call `forgetGuideReading(userId)` after successful account deletion alongside the
badge cleanup. It cancels publication, fences queued writes and removes the user's
local key after started writes finish. It must not run on ordinary sign-out.

## Validation

The focused browser journey covers list → visited without reward → bookmark → reload
→ resume → explicit completion → optional ritual → reload → exactly two unique guide
events → bronze. A successful final-feature artifact (before the final deletion-claim cleanup delta) is:
`tools/e2e/.e2e/dreamer-web/1792689579799-12397-9f41b6e6-f18c-4753-ba32-9c93c2451cca`.
The final handoff supplies the latest repeat artifact and commit identity.

Rerun from the task worktree:

```sh
E2E_WEB_PORT=8132 E2E_WORKERS=1 mise exec -- npm run test:testerarmy -- run --grep 'guide reading resumes'
mise exec -- npm run test:file -- services/__tests__/guideReadingStore.test.ts --watchman=false
mise exec -- npm run typecheck:app
mise exec -- npm run typecheck:tests
mise exec -- npm run test:testerarmy:typecheck
```

Ten isolated recovery checks cover storage failure, account-change races, offline
retry, monotone completion, deletion and interrupted guest transfer. Those failure
orders cannot be driven reliably through the ordinary mock browser journey.

`backend-guide-progress.web.e2e.ts` is reserved for the parent's canonical native local
Supabase run: real RPC ownership/RLS, invalid records, stale writes, and restoring
bookmarks/completion in a second empty browser. Native device layout, deployed database
and production restoration are not qualified by local browser/mock proof.
