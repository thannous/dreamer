# Journal editing during background categorization — 2026-10-06

Scope: keep the title/metadata and transcript editors open with their current
draft when categorization or synchronization refreshes the same dream. Reset
the editor when a different dream is opened. The user authorized direct delivery
to master; unrelated local work is excluded.

The prior effect reset every field and both edit states on any dream-object
update. The fix compares dream identities through `matchesDreamTarget`, which
also recognizes a local dream receiving its remote identity, and refreshes only
inactive editors for the same dream.

TesterArmy reproduces both failures deterministically using the browser clock:
save as the existing mock profile, pause the category response, open an editor,
type a distinct draft, then complete the response. Both fields disappeared on
base master 6ec5df37 (run 1791290010305-77239). Both journeys pass with the fix
(run 1791290084411-77578): the fields stay visible with the exact draft, the user
saves it, revisits it from Journal, and opens another dream without draft leakage.

The mock provider stores journal rows in memory; its existing save-completion
event witnesses the background update. Final assertions inspect the real UI.
An initial fixture attempt incorrectly expected these rows in localStorage and
is retained separately (run 1791289876900-76784). No application change masked it.

Rerun: `mise exec -- npm run test:testerarmy -- run --grep 'background categorization preserves'`.
The guarded runner retains source identity, report, JUnit, screenshots and traces.
Private copies and the final delivery record are under
`.tmp/journal-edit-race-2026-10-06/`. App/test types, focused lint and the canonical
pre-push check are required before the direct push. Existing compatibility
journeys remain intact.

This is Chromium evidence with isolated mock services. Physical iPhone/Android
Release behavior is not qualified. Device check: save a dream, immediately open
the title or story editor, type while its details arrive, then save and revisit it.
