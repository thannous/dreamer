# TI-633 — Dreamer performance implementation

Owner: current TI-633 integration chat. Requested 2026-09-28, delivery target same day.
Base after requested rebase: 491f40c96c36cf5d3c20dea78ec1d7a2d20e4ea1. Scope: Dreamer only.
Authorized: implementation, focused validation, commits and public PR delivery; local
instrumented Android before/after builds. Installation is conditional on compatible
signing and verified data backup/restoration, without uninstall or data clearing.
Paid AI calls, EAS cloud builds and production publication are not authorized.
Existing root AGENTS.md and process sprint edits are preserved outside this worktree.

## Qualification plan and evidence

- TI-634: runner CLI fixtures exercise successful, mixed, all-invalid and missing-marker
  runs through JSON/CSV and exit status. Synthetic ADB responses are tooling evidence only.
- Storage/sync: preserve durable acknowledgement, account scope, identity, conflicts,
  guest quota and interrupted writes. Document failure-model exceptions before adding
  isolated coverage; retain device recovery qualification as a separate requirement.
- Physical baseline: candidate identity, runtime/OTA, signature, settings and preconditions
  must be recorded before measurement; no device performance gain inferred from host tests.
- Native font/bundle decisions require comparable native artifacts; no speculative removal.

## Validation commands

TI-634 CLI: `mise exec -- npm run test:file -- scripts/measure-android-performance-cli.test.js scripts/measure-android-performance.test.js --watchman=false`

Status: implementation in progress. No runtime gain qualified yet.

### TI-636/637 storage failure model (before implementation)

The existing device journeys cannot deterministically interrupt a SQLite transaction
between row changes and its commit, corrupt the checkpoint, or count serialization
of unchanged rows. A focused storage boundary suite uses real host SQLite and reopen
between operations, with injected transaction failures. It covers migration rollback,
retry, empty versus unreadable, duplicate identity, account isolation, deletion,
acknowledged writes after restart and incremental serialization. This is an isolation
exception for recovery semantics; native SQLite/Expo and device UI remain unqualified
until their own checks. Legacy data is retained; no fallback to stale legacy data after
a committed migration or database error. Remote server checkpoint uses a separate
namespace and full, unmodified server rows only, committed after traversal completion.

### TI-638 concurrency exception (before implementation)

Device E2E cannot hold one specific server response while releasing another at an
exact queue transition. Extend the existing sync-engine boundary tests for an
unrelated stalled replay, concurrent same-identity calls, pending remote creation,
account switches and durable acknowledgement. Retain the existing idempotency and
conflict tests. A targeted replay may wait for an already-submitted batch containing
the same identity, because its receipt is required; it must not wait on a batch
containing only other dreams. Server analysis submission must reject an unresolved
or conflicting target rather than submit an old transcript.

### TI-641 bounded image failure/cache contract (before implementation)

Extend the resolver tests for signed-URL rotation, version replacement and account
scope. A deterministic clock covers expiry/capacity because waiting through repeated
native network failures cannot reliably assert these boundaries in device E2E.
Stable disk identity is emitted only after successful authorization and only when a
content version is available; no source URI means no cached private image render.
Prefetch must use the identical key and variant as the rendered card.

### Journal scroll worker boundary (before implementation)

A device trace cannot deterministically assert that a journal-only scenario never
opens a detail page. A small worker-boundary test drives the existing journey with
synthetic UI nodes and records the requested action window before adding the phase.
Actual FrameTimeline collection remains a release-device requirement.

## Local qualification, 2026-09-28

| Ticket | Implemented / observed | Remaining qualification |
|---|---|---|
| TI-634 | Invalid CLI runs excluded; raw JSON/CSV retained; sample counts and null empty aggregates; 12 runner tests passed. | CI on final PR head. |
| TI-635 | Correlated save/analysis markers, font/list/content/sync stages, journal-scroll window. | Native before/after baseline, 100/1000/5000 synthetic datasets on an isolated approved account, request/byte/frame distributions. No gain claimed. |
| TI-636 | Durable account/schema-scoped server checkpoint after complete traversal; malformed cache falls back to full traversal. | Native restart/network-volume comparison and end-to-end account recovery. |
| TI-637 | Atomic native SQLite record transactions; unchanged references skip serialization; legacy retained; web adapter unchanged; migration/rollback/reopen host SQLite checks passed. | Expo SQLite durability and interruption on the qualified native candidate. |
| TI-638 | Target-only replay; same-identity receipts serialized; unresolved/conflicting target blocks analysis; other dreams may continue separately. | Real network contention and server analysis journey; no paid AI calls made. |
| TI-639 | Selected dream passed through memo boundary; unchanged selected row references retained. | Release React/native render and PSS measurement. |
| TI-640 | Scroll offset/translation run through Reanimated; drag origin retained when list does not remount; 22 route layout tests passed. | Physical rotation, keyboard, accessibility and frame qualification. |
| TI-641 | Bounded expiring account-scoped failure cache, authorized stable source keys, matching native prefetch identity; resolver/cache tests passed. | Native transfer/cache-hit and cross-account screen evidence. |
| TI-642 | Eleven runtime font assets matched by SHA-256 against installed APK; fonts-settled marker added. | Comparable baseline before deciding on native preload/deferred fonts. No font removal or native font configuration change. |

Focused suite: 376 assertions / 11 suites passed, `/tmp/ti633-focused.json`.
Follow-up: 116 assertions / 3 suites passed (including 8 reader assertions),
`/tmp/ti633-followup.json`. Journal-only worker assertion passed separately.
`typecheck:app` and `typecheck:tests` passed. Focused lint: no errors; existing
React Compiler warnings remain. Final committed `test:prepush` evidence is recorded
in the delivery follow-up. These local checks are not physical performance evidence.

### Browser journey (mock, synthetic content only)

Start from this branch with:
`EXPO_PUBLIC_MOCK_PERSISTENCE=true EXPO_PUBLIC_PERFORMANCE_TRACING=true mise exec -- npm run web -- --profile .env.mock --port 8094`.
Use an isolated `npx --no-install agent-browser --session ti633` session at
`http://127.0.0.1:8094`. Seed only its localStorage key
`noctalia_mock_dogfood_v1:gemini_dream_journal_first_launch_completed` with `true`;
then open `/journal`. The existing startup flow may route an empty guest to recording.
Enter the synthetic text "TI633 synthetic journal. Je marche dans une forêt lumineuse
et je retrouve un carnet bleu près de la rivière." and add it to the journal.
Observed: detail opens, mock analysis completes and reader opens; close reader,
return to journal, search `no-match-ti633` (card absent), search `TI633` (card present).
Artifacts: `/tmp/ti633-web-detail.png`, `/tmp/ti633-web-search.png` plus the tool's
accessible snapshots. This validates the web/mock flow only, not durable real storage.
The unchanged onboarding uses an unsupported web `StatusBar.pushStackEntry`;
EnrichedMarkdown also reports a web parsing failure with unqualified reading colours.
Neither is counted as passing visual qualification. No user account or paid API used.

### Installed Motorola / native prerequisites

Read-only inventory under the existing Dreamer device lock:
Motorola edge 60 fusion, Android 16, arm64-v8a, 1220x2712, font scale 1.0,
peak refresh setting 60 Hz. Base package `com.tanuki75.noctalia`, Play install
`com.android.vending`, version 3.4.5 / 82. Four installed APK/split files.
Base SHA-256: `9d81dc772cc18f012f0d3b4447977338a13f973eda36b2fbeee0745a858bc755`.
Play certificate SHA-256: `6a8cb2e2cdd2c1fdd7c5cfcf00d7c3cc5861c2cd3faf49f69a312535a44fee0f`.
The current process has no retained runtime identity event; active OTA/commit is
unknown. Manifest has no profileable tag and `allowBackup=false`.

User authorized release instrumented before/after builds and installation only with
compatible signature and verified backup/restoration, with no uninstall/data clearing.
The canonical local builder uses the debug certificate
`fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`.
It differs from Play: physical installation is blocked before any install attempt.
No `.qa` package, OTA, data reset, account switch or installation was performed.
A copy of the existing generated Android project is reused for local builds with
`npm run android:release:local -- --abi arm64-v8a --profileable --reuse-native-project`;
no Expo prebuild. Native source/config changes are absent from this patch.

Private inventory: `/tmp/ti633-native/inventory.json`, pulled APKs and manifest.
17 font files occupy 3,034,656 uncompressed bytes, including icon fonts. SHA matching
confirms all 11 `useFonts` variants: Space Grotesk regular/medium/bold, Lora
regular/italic/bold/bold-italic and Fraunces regular/medium/semibold/bold. They are
used by `global.css`/`constants/theme.ts`; journal titles use Lora bold, search/body
Space Grotesk, other first-screen headings use the display family. Presence as Expo
assets is not native font pre-registration. Keep current typography until equivalent
release candidates can be measured. F8 route/build separation remains under TI-561;
no second-app architecture change was made in this performance patch.


## Delivery update after rebase, 2026-09-28

PR: https://github.com/thannous/dreamer/pull/228 (draft).
Code candidate: `bae6b33a3578fcc41a2238e585cc7ce465d18a37`.
`git pull --rebase origin master` completed without conflicts; range-diff confirms
both patch commits are unchanged. Updated AGENTS.md and version-sync guidance applied.
`mise exec -- npm run release:versions:check -- --platform android` read EAS 3.4.5 / 82,
with no local changes. The build wrapper also synchronized that same counter.

`mise exec -- npm run test:prepush` passed on this code candidate against base
`491f40c96c36cf5d3c20dea78ec1d7a2d20e4ea1`: app/test types, 195 suites and 2,605
assertions passed; one existing skipped test. Private report:
`/tmp/ti633-prepush-rebased.log`. Documentation-only follow-ups reuse this evidence.

### Completed local native builds

Both use the existing generated native projects (no prebuild), Temurin 17.0.20.1,
arm64-v8a, production-apk release, R8/resource shrinking and profileable enabled.
Reproduce in the corresponding baseline/candidate checkout:

```sh
JAVA_HOME=/Users/timax/.local/share/mise/installs/java/temurin-17.0.20+101 ANDROID_HOME=/Users/timax/Library/Android/sdk mise exec -- npm run android:release:local -- --abi arm64-v8a --profileable --reuse-native-project
```

| Artifact | Baseline | Candidate |
|---|---|---|
| Source | `491f40c96c36cf5d3c20dea78ec1d7a2d20e4ea1` | `bae6b33a3578fcc41a2238e585cc7ce465d18a37` |
| APK SHA-256 | `a499a2060822e24ab25689eb80673494ff1864f6ff856dc9dbe0c67468062b49` | `a2f12ed4fb25913ecec73a064117b69cbba089d082b558be09a791cc2a468e5a` |
| Bytes | 89,344,971 | 89,355,511 |
| Embedded update ID | `d0469f7b-fd90-4a4e-87e0-421247c5a68e` | `21ee893e-f143-41eb-8a35-0a37d39c5d37` |
| New storage marker in bundle | absent | present |

Each APK is `dist/android/production-apk-profileable-release.apk` in its managed
worktree (`dreamer-performance-baseline/noctalia` or `dreamer-performance/noctalia`).
Both manifests identify `com.tanuki75.noctalia`, 3.4.5 / 82, shell profiling enabled;
`apksigner verify` passes with the local certificate documented above. Runtime/OTA
actually launched: unobserved, as neither APK was installed. Backend unchanged.
These artifact sizes do not measure Play download size or a runtime improvement.

Initial baseline compilation at the previous base failed under Java 25.0.3 in
expo-updates/nitro Prefab generation (`GeneratePrefabPackages.kt`, restricted
`java.lang.System` warning). The retry used Java 17 and the new master, then succeeded;
no repeated attempt under unchanged conditions. Private build logs:
`/tmp/ti633-baseline-build.log`, `/tmp/ti633-baseline-build-jdk17.log`,
`/tmp/ti633-candidate-build-jdk17.log`. APK inventories:
`/tmp/ti633-baseline-apk.json`, `/tmp/ti633-candidate-apk.json`.

### Fixtures, cost and remaining gate

100/1,000/5,000 synthetic records were generated as local JSON in
`/tmp/ti633-synthetic/`, with a manifest and generation script
`/tmp/ti633-generate-fixtures.py`. No AI generation, upload, paid API call or personal
account import occurred. Placeholder images do not represent real image transfer loads.
No large-dataset device measurement has been performed.

Native installation remains blocked by the Play/local signature mismatch and the
absence of a verified data backup/restoration path. No installation was attempted.
Next prerequisite: an authorized compatible-signed candidate and a verified preservation
path for the existing account and guest journal. Native SQLite recovery and before/after
performance remain open; the PR stays draft, unmerged, and TI-633 is not complete.


### Device-discovered write latency, before corrective implementation

The 5,000-row synthetic native journal exposed a 31.31-second first favorite commit.
The fixture was inserted in ascending order, while the UI sorts descending; the store
issued a separate asynchronous SQL bridge call for every moved row, plus normalized
image rows. Prepending a new dream can also move all positions. This is real excessive
bridge overhead, even though the fixture magnifies the initial reordering. Corrective
plan: batch inserts, position updates and deletes within the same exclusive transaction,
keep unchanged-record serialization avoidance and atomic acknowledgement. Existing real
SQLite rollback/reopen tests plus the repeated native favorite/restart journey validate
this change; no new isolated suite is required. Preserve the failed short-timeout
recovery attempt and the eventual commit event as evidence.

Second device observation: after batching, subsequent 5,000-row favorite writes still
took 2,381/935 ms. The engine unnecessarily reloaded every identity through SQLite
even with a matching cached scope revision. Reuse that revision-validated identity
set; retain the database lookup after eviction/revision mismatch. Existing scope,
rollback and reopen tests cover cache invalidation; remeasure the same UI journey.
