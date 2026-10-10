# Master integration — 2026-10-07

The integration starts from remote master `775d8709` and preserves the primary
checkout's local commits and uncommitted source work. Older local versions of
TesterArmy, shared navigation, Quick Settings and native Journal code are
superseded by their already delivered remote corrections. The Capture chat
snapshot is already represented by remote master; its stronger final assertions
and delivery record are retained. Local backup branches preserve both snapshots.

The remaining functional changes are Meditation's editorial path, history,
world-scoped supporting pages and single compact player, Dreamer's reader-driven
onboarding stories, the free-reflection Plus entry, and local iPhone tooling.

The onboarding tests now require explicit Continue actions and demonstrate that
elapsed time cannot advance a scene. The former autoplay/pause-time test belongs
to the previous contract. The feature-disabled collection guard is retained.
Meditation's tests retain purchase, quota and startup independence safeguards:
allowed practices omit redundant Free badges, world-led recommendations omit a
redundant explanatory paragraph, Back replaces Close on unavailable audio, and
the editorial path announces its current chapter as readable text.

Local environment: Node 24.19.0, TesterArmy e2e 0.18.0, web engine 0.13.0,
mobile engine 0.10.0; synthetic offline browser fixtures, one worker, no model.
The changed root app/test types and three affected suites passed (23 assertions)
on `ff44c4e0`; final committed pre-push validation is required before publication.
Root focused lint and Meditation lint/brand checks passed. Meditation types
passed; its initial suite had 59 passing suites and four outdated failures.
The four revised suites are checked together, preserving the unchanged coverage.

Fresh TesterArmy evidence: 17 onboarding journeys passed, with the feature-OFF
case explicitly excluded from the ON bundle. Meditation onboarding, restart,
every tab, editorial path, session details, history and world settings passed.
The app code remains unchanged after these runs; subsequent changes are tests
and this summary. Reports, source fingerprints and screenshots remain ignored
under `tools/e2e/.e2e/`, rather than being published with private raw evidence.

Rerun the affected browsers from a clean checkout:

```sh
EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED=true E2E_WEB_PORT=8136 mise exec -- node tools/e2e/run.mjs dreamer web run --grep 'feature sheet|story waits|motion stories|welcome and path|chosen path|onboarding story bridges' --trace
E2E_WEB_PORT=8138 mise exec -- node tools/e2e/run.mjs meditation web run --trace
```

These are local browser/mock results. Native Release, physical devices, Store,
backend deployment and production availability are not qualified by this merge.
Required remote CI remains enforced on the final integration head before merge.
