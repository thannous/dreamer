# TesterArmy E2E

Default framework for new journeys since the owner's 2026-10-05 instruction.
Follow https://docs.expo.dev/guides/using-e2e/ and the skill bundled in this
package's `node_modules/e2e/skills/e2e/`. Dependencies and lockfile are isolated
from the application's Playwright version. The locked runtime is `e2e` 0.18.0,
`@e2e-dev/web` 0.13.0, `@e2e-dev/mobile` 0.10.0 and `agent-device` 0.21.22.
The engine peer ranges accept e2e 0.18.0; web and matcher Playwright remain 1.63.0.
Node 24.19.0 is pinned by the root mise file and satisfies e2e 0.18's
`^22.22.3 || >=24.8.0` requirement. The runner uses e2e's bundled TypeScript
loader; the scoped public matcher preload is unchanged.

From the repository root:

```sh
mise exec -- npm run test:testerarmy:setup
mise exec -- npm run test:testerarmy:browsers
mise exec -- npm run test:testerarmy
mise exec -- npm run test:testerarmy:lucid
mise exec -- npm run test:testerarmy:meditation
mise exec -- npm run docs:build
mise exec -- npm run test:testerarmy:site
mise exec -- npm run test:testerarmy:typecheck
```

Discovery starts no engine: `mise exec -- node tools/e2e/run.mjs lucid web list`.
The web products start separate local servers on ports 8096–8099; root app
services are mocked and external requests are blocked in app tests. Meditation
web proves routing/storage on the web only, not native audio or purchases.
Each Expo web start clears its Metro bundle cache; Dreamer and Lucid also set
both variant markers explicitly. Switching products must not reuse the previous
product's embedded Expo configuration. Environment profiles and runner guards
still apply.
Meditation probes Metro's `/status` endpoint during startup so repeated short
health requests do not restart static route compilation on a cold Linux runner.
Its test still opens the app and checks onboarding, persisted state and every tab.
Meditation web has a 180-second test and lifecycle budget: the public `app.open()`
and `app.restart()` methods use `config.timeout`, capped by the remaining test
budget. A per-test timeout alone does not raise that lifecycle limit. Other
products and native targets keep 120 seconds; action/assertion limits and retries
remain unchanged.
For the opt-in onboarding story, use
`EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED=true mise exec -- node tools/e2e/run.mjs dreamer web run --trace`.
The config forwards this opt-in to the app command; without it, the story test
is explicitly skipped and does not constitute qualification of that feature.
Dreamer also verifies that Quick Settings actually selects French and both
themes while preserving the Capture draft and language after reload. This
guards the web click regression from using a native gesture pressable there.
The journey opens the real Settings control, checks that preferences are
actionable, and requires closed drawers to expose no accessible radio controls.
It exercises the panel at 390 and 1280 pixels.

## Historical Dreamer UI parity

The 83 historical browser cases across 16 families run through TesterArmy with
their exact UI assertions, including mock billing, capture/edit/chat, continuous
reading, reflection, symbol dictionary, Explorer, settings persistence, Home,
Trends, responsive navigation, Journal geometry and feature-sheet stories.
The original Playwright/backend/Maestro suites remain present and required.

The public `surfaceOf()` Page/context keeps CSS, geometry, keyboard, image and
clock checks. TesterArmy owns isolated attempts and traces; the pinned isolated
Playwright 1.63.0 package supplies matchers only. The parity fixture preserves
Desktop Chrome 1280x720 by default (explicit mobile overrides remain), with
30-second actions and 15-second exact assertions from the historical config.
Attempts allow 180 seconds because a fresh Linux locale campaign used 57 seconds
compiling its first client bundle before the first body; assertions and zero
retries remain unchanged. Stable journeys
retain their 390x844 viewport. Service workers and external real services remain
blocked, and each case starts with `app.open()`.

Cases requiring French or German use actual locale contexts, including
`navigator.language`, `Intl` and `Accept-Language`, through `E2E_WEB_LOCALE`.
Other locale cases are skipped with the exact rerun instruction, never counted
as passed. Four commands jointly qualify all cases:

```sh
EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED=true E2E_WEB_LOCALE=en-US mise exec -- node tools/e2e/run.mjs dreamer web run
EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED=true E2E_WEB_LOCALE=fr-FR mise exec -- node tools/e2e/run.mjs dreamer web run --tag locale-fr-FR
EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED=true E2E_WEB_LOCALE=de-DE mise exec -- node tools/e2e/run.mjs dreamer web run --tag locale-de-DE
EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED=false E2E_WEB_LOCALE=en-US mise exec -- node tools/e2e/run.mjs dreamer web run --grep 'feature sheets stay disabled by default'
```

The existing Dreamer CI check runs the same four passes and retains every
timestamped report, screenshot, trace, source/input hashes and browser-context
artifact. Lucid, Meditation and site commands keep their existing behavior;
locale flags apply only to web. `E2E_WEB_PORT` can select an isolated local port.
The matcher preload applies only to the CLI/workers. Expo receives the caller's
original `NODE_OPTIONS` value or absence; native and inspection commands receive
no preload. No model or replay is needed for these bodies.

Two historical selectors changed with responsive navigation: Today exposes a
back button on desktop and a tab on mobile, while Journal uses its visible
navigation ID. The reading-content assertion now requires substantive text
across words instead of requiring one twenty-character word, which the mock
French copy never contains. Remaining transcript, questions, symbols, state,
geometry and action assertions are retained. This is UI/mock qualification;
it does not prove backend interpretation, durability, purchases or native text.
No original test is removed on the basis of these results.

## Continuous integration and SDK checks

CircleCI runs the exact Dreamer and Lucid journeys in the Noctalia workflow,
Meditation in its own workflow, and the generated site after `docs:build` and
`docs:check`. Each job installs this package's locked e2e 0.18.0 dependencies
and Chromium, uses one worker with no replay or model, and retains JUnit, reports, screenshots,
traces and source identity under `tools/e2e/.e2e/`. Existing Playwright, backend,
Maestro and quality checks remain required.

`npm run dependencies:check` validates the installed Expo SDK's expected native
dependencies before the app quality checks. Dreamer and Lucid share the root
manifest. Meditation has its own manifest and check:
`npm --prefix apps/meditation run dependencies:check`.
Run the affected check before a local native build; CI checks both manifests.

## Native Release provenance and diagnostic handoff

Current delivered native evidence and retained limits: [retrospective qualification](../../doc_web_interne/docs/qa/native-retro-qualification-20261006.md). Historical reports retain their original source/build identities.

Use the existing native projects and the repository's build/prebuild rules.
`run.mjs <product> <platform> build` runs the installed Expo SDK dependency check
and an explicit Release command descriptor, then writes an immutable `release.json`.
It never generates a native project or selects a phone. The descriptor accepts
`gradlew :app:assembleRelease`, the existing Android Release script with
`--reuse-native-project`, or `xcodebuild -configuration Release ... build`.
Android requires Java 17, an installed SDK and an OTA-disabled embedded bundle.
iOS requires an existing project/Pods, an embedded JS bundle and a Simulator build.

Example from an isolated checkout with an existing Android project:

```sh
EXPO_NO_DOTENV=1 EXPO_OFFLINE=1 E2E_BUILD_PROFILE=production-apk \
  EXPO_PUBLIC_MOCK_MODE=false EXPO_PUBLIC_MOCK_PERSISTENCE=false \
  EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED=false \
  E2E_BUILD_COMMAND='["./gradlew",":app:assembleRelease","--no-daemon"]' \
  E2E_RELEASE_BINARY=android/app/build/outputs/apk/release/app-release.apk \
  mise exec -- node tools/e2e/run.mjs dreamer android build
E2E_DEVICE=emulator-5554 E2E_AVD_NAME=MyDedicatedQA \
  E2E_RELEASE_RECEIPT=tools/e2e/.e2e/dreamer-android/BUILD_RUN/release.json \
  mise exec -- node tools/e2e/run.mjs dreamer android run --install-release
```

Set `JAVA_HOME` to the installed Java 17 runtime as required by the existing local
Android build guide. Resolve `BUILD_RUN` to the exact newly printed receipt;
there is no latest-run fallback. The receipt contains build command/exit, source
and native-input hashes, actual version/bundle, APK SHA or complete `.app` hashes,
profile flags, OTA identity and signing state. The identified APK or `.app` is copied into that immutable
build output and its hash rechecked before the receipt is written, so rebuilding
the native cache does not invalidate an earlier rerun. Partial copies never
produce a successful receipt. Local package and CocoaPods links
are hashed with their in-checkout destinations; foreign links/cycles are refused.
Metro's public `cacheVersion` retains its upstream seed and includes a hash of
all `EXPO_PUBLIC_*` inputs plus the native/router profile selectors. Release
exports in CI can disable automatic cache resets; profiles must have separate
transform keys even when their source files are identical. Inputs are sorted
without locale rules, and values are never printed. See the official
[Metro configuration](https://metrobundler.dev/docs/configuration/#cacheversion).

New source inputs require a new build. Unchanged app/native input digests permit
reuse after a test-only commit; build-source and test-source revisions stay distinct.

`--install-release` is opt-in and simulator/emulator-only. The existing runner
holds the device lock, validates the receipt/source/binary, installs that binary,
pulls and hashes the installed APK (or hashes the installed Simulator `.app`),
then launches collection and SDK tests. The owner decision of2026-10-06 makes
installation/hash failures independent diagnostics: SDK continues on the owned QA
target, but a failed identity check cannot yield application qualification. An
invalid/missing build receipt, incompatible profile or foreign device still refuses
before launch. Without the install switch, the installed hash is still diagnosed.
The installed identity is checked again after the SDK returns. No EAS, Store,
physical install, unsigned storage fallback or model is enabled.

Profiles are `production-apk` (Dreamer real-service build; journeys stay offline),
`mock-persistent` (Dreamer synthetic account/data), `lucid-mock`, and
`meditation-local` (bundled content/audio). Load `.env.mock` or `.env.lucid.mock`
through `E2E_BUILD_ENV_FILE`, which uses the existing profile loader and disables
implicit dotenv mixing. Pass persistence/audio/feature flags explicitly. Lucid
Simulator persistence journeys require the existing entitlements and ad hoc local
signing (`CODE_SIGNING_ALLOWED=YES`, `CODE_SIGN_IDENTITY=-`); retain the signature
verification in the receipt. This is not a Store candidate.

The two Journal concurrency journeys require `mock-persistent` plus compile-time
`EXPO_PUBLIC_MOCK_CATEGORIZATION_DELAY_MS=30000` (allowed range 20000–60000).
The delay activates only in persistent mock mode. The real pending indicator
must be visible before editing and remain pending after the exact draft is entered;
its completion then precedes the unchanged-draft assertion and Journal round-trip.
No fixed test sleep or synthetic UI action is used. Other profiles explicitly skip
these cases; skips are not passes. See [the native coverage matrix](NATIVE-MATRIX.md).

Dreamer exact web coverage also exercises guest save/inline mock analysis,
authenticated save/rename/Journal round-trip, empty-search recovery, transcript
editing, cancelled and confirmed targeted deletion, favorite removal without
story loss, exhausted-quota refusal without story loss, exact fixture allowance
(Free `5 / 3`, Plus unlimited), and account Journal isolation after sign-out.
These are real browser UI journeys with the historical mock profiles, not
qualification of backend durability, RLS, native storage or real purchases.
Run selections after the explicit `run` argument, for example:
`E2E_WEB_PORT=4511 mise exec -- npm run test:testerarmy -- run --grep 'account allowance'`.
The optional web port override is ignored for native targets.

Other coverage: Dreamer onboarding/empty-save/draft mode continuity; Lucid
required intention/experience and entry to sleep settings; Meditation onboarding,
restart persistence and tabs; generated site homepage/internal navigation.
Native counterparts exercise the explicit invariants in [NATIVE-MATRIX.md](NATIVE-MATRIX.md)
on identified Release builds. Browser-only assertions and legacy suites remain required.

Lucid also checks dark time-field contrast, nondefault sleep times surviving a
reload, full tab and shortcut labels at 320/360/390 pixels, light/dark programs,
beginner WBTB restrictions, shared account-form validation, two morning captures
persisted in Journal and their confirmed sign linked to both Atlas sources,
and stabilization/SSILD pause and resume after reload. Browser locale is French
for this suite. These mock-service browser journeys do not qualify native Lucid.
The existing Playwright visual journey and native Maestro coverage remain.

## Complete verdict and immutable evidence

Every invocation has a fresh UUID output under
`tools/e2e/.e2e/<product>-<platform>/<timestamp>-<pid>-<uuid>/`; collisions never
overwrite prior evidence. `sdk.log` and each managed server's `app.log` are inside
that output, so all locale/flag partitions are uploaded by the existing CI artifact
step. `evidence.json` carries exact command, campaign/context, pins, test source,
build receipt and requested media. `source-start.json` / `source-end.json` retain
path→SHA inputs without raw diffs. `installed-start.json` / `installed-end.json`
identify the installed binary. `files.json` hashes output files written before the
final `end.json`; these two manifest files are deliberately outside that file set.

Browser fixtures may perform only their existing public `browser.route` and
`browser.setViewport` setup before the first `app.open()`. UI actions before that
open are refused; native ordering stays strict. SDK exit0 alone is insufficient. A qualified run needs the exact fresh report,
runner/engine/target/agent/source/origin, unchanged inputs, zero model use, every
selected runnable pair passed once, native `app.open()` first, complete cleanup, no
secondary errors, and intact declared/requested artifacts. A body requesting no
media and declaring none may produce a report only. Requested missing video/trace
is refused. Source/output/install/lock failures are independent final checks;
primary SDK failures and SIGINT130/SIGTERM143 retain priority over secondary errors.
After process completion the wrapper releases only its own lock, including when
resource cleanup is failed/missing. `resourceCleanup` records that limitation and
the final verdict remains nonqualifying; no unknown session/recorder is killed.
`qualification.json` records SDK validation; only final `end.json` exit0 completes
that invocation. Preserve both when reporting its verdict.

For a browser campaign set one unique `E2E_CAMPAIGN_ID` on every invocation,
then run `node tools/e2e/run.mjs <product> web collect`. CI uses its unique
`CIRCLE_WORKFLOW_JOB_ID`. The collector revalidates reports, artifacts and final
receipts and writes `campaign.json`: the actual passed union uses target/test/agent
identity, with contexts, repeats, selected skips and exclusions kept separately.
Dreamer requires EN/FR/DE with stories ON and EN with stories OFF. A failed or
missing context cannot produce a complete campaign. Do not infer a union from a
large selected count or include old unrelated reports. The current qualification
reference is the exact immutable `campaign.json` and its command/source, not an
old static pass count in this README.

The generated site has explicit canonical outputs from `docs:build`:
`docs-src/static/js/experience/` (including hashed chunks) and the served `docs/`
tree. The runner snapshots their bytes separately after the canonical build;
changes during tests fail. Source files elsewhere remain inputs. Generated tracked
changes remain visible as dirty state; no global clean or forged clean receipt is
used. Start/end snapshots detect persistent changes, not a transient mutation
restored between them.

`npm run test:testerarmy:guards` exercises observed failure modes with public
synthetic fixtures, without starting an engine or device. These controls supplement
real journeys and never establish application or physical qualification.

Agent goals can be added with an authorized model provider, one goal per call
and exact critical-outcome assertions. No provider is configured by default.
The optional `@e2e-dev/decision` / Jev setup described in the installed
`docs/decision-models.mdx` additionally requires `ai` 7.0.128 or later. This
package installs neither that executor nor `ai`; exact journeys require no
model dependency, and the upgrade does not enable a provider.
Use a provider barrier when replay must never call a model; strict cache alone
does not forbid a call on a cache miss. Existing Maestro, Playwright, backend and
CI checks remain until equivalent replacement journeys pass. A listed or
typechecked test is not evidence that the user journey passed.

## agent-device inspection and live exploration

The host CLI and the official `agent-device` Codex skill are installed. This
package uses the engine's exact `agent-device` 0.21.22 dependency through its
local CLI. A globally installed CLI may have a different version; the guarded
package commands use this local pin. Read its version-matched `help workflow`
or `help debugging` for specialized work. Do not replace the pinned native engine with `@latest`.

```sh
mise exec -- npm run agent-device:doctor
E2E_DEVICE=emulator-5554 mise exec -- npm run agent-device:inspect -- dreamer android
E2E_DEVICE='iPhone 17e' mise exec -- npm run agent-device:inspect -- dreamer ios
E2E_DEVICE='iPhone 17e' mise exec -- npm run agent-device:mcp -- dreamer ios
```

Replace `dreamer` with `lucid` or `meditation` to select that app. From
`apps/meditation`, use `npm run agent-device:inspect -- android` or
`npm run agent-device:mcp -- ios`, with the same explicit `E2E_DEVICE`.
Inspection opens the installed Release app, retains its initial UI tree and a
PNG, then closes the session. It neither installs nor clears app data, and it
is not a passed E2E test. Evidence stays in the existing per-run output tree.
The same device lock covers inspection, tests and the live MCP process.

The MCP entry uses `e2e mcp` with one session and the fixed native target. It
provides `open_session`, `call` (`observe`, `locate`, `tap`, `screenshot`, etc.)
and `close_session`, without configuring a model. Launch it through the package
script; direct `e2e mcp` or raw device commands bypass repository ownership
checks. Close the live session before running a test. Turn a reproduced issue
into an exact TesterArmy journey under `tests/`; retain existing coverage.

Physical-phone automation remains outside these disposable test targets. An
explicit device work package must use the existing shared device protocol and
app-specific profile. On an iPhone it also needs pairing, Developer Mode and
runner signing. No native build, reset, provider call or hosted session is added
by these inspection commands.

Selection flags may narrow a run, but config, target, worker and output overrides
are refused before device preflight. Use the explicit product/platform entry.
