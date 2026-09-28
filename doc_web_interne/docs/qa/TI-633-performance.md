# TI-633 — Dreamer performance implementation

Owner: current TI-633 integration chat. Requested 2026-09-28, delivery target same day.
Base: 15c2e62da9205838b5682536c5cd643ef74d9445. Scope: Dreamer only.
Authorized: implementation, focused validation, commits and PR delivery. Native builds,
reinstallations, paid AI calls and production publication require explicit authorization.
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
