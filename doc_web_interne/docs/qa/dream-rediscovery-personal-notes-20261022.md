# Dream rediscovery and personal notes — 2026-10-22

Integration owner: parent Codex work package (parallel badges, guides and revisiting).
Base: `3705ef9c3d24195ae7cc42e937f1b9c7c233a664` (Claude badge implementation).
Scope: Dreamer; local implementation and verification, no remote migration or deployment.

## Behavior

- The existing anniversary card keeps priority. Otherwise Today offers one dream at least 30 local calendar days old, including unanalysed/unillustrated dreams. The choice is stable during a local day and no card appears without a candidate. No notification is added.
- Each dream has private personal notes, with creation date and later edit date. Add, edit and confirmed delete leave the original transcript and analysis intact. Notes are separate from AI chat/context. Six languages, theme tokens, minimum 44-point actions and accessible editor.
- Notes share the dream's existing guest/account storage, offline queue, revisions, ownership and deletion. No additional unscoped storage is introduced. A dream holds up to 50 notes of 4,000 characters; the UI communicates the limit and neither client nor database truncates data.
- Update intents merge independent note additions and detect edits/deletes of the same note; unrelated analysis changes are preserved. Existing offline conflicts retain both local and server dream versions for explicit resolution. The schema migration locks a target row before revision comparison, preventing concurrent devices from overwriting the winning revision.
- Old clients omitting `personal_notes` preserve it, including retried creates. A server response without support for personal notes cannot falsely acknowledge a notes write. Deployment of the new migration remains required for account synchronization.

## Evidence

- Browser: `E2E_WEB_PORT=8131 E2E_WORKERS=1 mise exec -- npm run test:testerarmy -- run --grep 'personal notes survive'` — PASS, exit 0, one scenario. Chromium 156, e2e 0.21.2, @e2e-dev/web 0.15.2, Node 24.22.1.
- Canonical local artifact in the implementation worktree: `tools/e2e/.e2e/dreamer-web/1792689155887-99026-a74c7a8e-807d-4ef6-b0a9-643f979c7f80/`. Source bytes are recorded in source-start/source-end, stable; base revision plus task changes was dirty during execution. Trace, screenshot and machine-readable report are retained there, not duplicated in Git.
- Assertions: add note, reload and find persisted note, edit, preserve original transcript, cancel deletion, confirm deletion, no rediscovery for recent dream, age owned fixture to 45 days, open rediscovery and prove original content and deleted note absence.
- Actual first failure exposed mock `getSavedDreams/saveDreams` ignoring the existing persistence flag. They now use the same namespaced mock persistence helpers as other values. Real account storage is unchanged. A selector casing mismatch and disallowed pre-open media setup were corrected; guards were not weakened.
- `mise exec -- npm run test:file -- lib/__tests__/dreamUtils.test.ts services/__tests__/journalDreamMapper.test.ts services/__tests__/journalMutationTransport.test.ts services/mocks/__tests__/storageServiceMock.test.ts --watchman=false` — 4 suites, 107 tests PASS.
- New isolated assertions are justified by races which a single browser cannot deterministically schedule: two note additions on the same base, edit/delete collision, max-count merge rejection without truncation, and an old server that falsely acknowledges unsupported fields.
- `typecheck:app`, `typecheck:tests`, `test:testerarmy:typecheck` and focused Expo lint passed. `git diff --check` passed.

## Remaining integration evidence

Parent owns SQL/runtime and account-isolation E2E on the integrated migrations: roundtrip/reinstallation, old-client omission, ownership denial, concurrent RPC revisions and deletion. Native device quality is not qualified by the mock browser run. No push, PR, merge, backend deployment or store operation was performed by this subtask.
