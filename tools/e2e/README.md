# TesterArmy E2E

Default framework for new journeys since the owner's 2026-10-05 instruction.
Follow https://docs.expo.dev/guides/using-e2e/ and the skill bundled in this
package's `node_modules/e2e/skills/e2e/`. Dependencies and lockfile are isolated
from the application's Playwright version. Node is pinned by the root mise file.

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

## Continuous integration and SDK checks

CircleCI runs the exact Dreamer and Lucid journeys in the Noctalia workflow,
Meditation in its own workflow, and the generated site after `docs:build` and
`docs:check`. Each job installs this package's locked dependencies and Chromium,
uses one worker with no replay or model, and retains JUnit, reports, screenshots,
traces and source identity under `tools/e2e/.e2e/`. Existing Playwright, backend,
Maestro and quality checks remain required.

`npm run dependencies:check` validates the installed Expo SDK's expected native
dependencies before the app quality checks. Dreamer and Lucid share the root
manifest. Meditation has its own manifest and check:
`npm --prefix apps/meditation run dependencies:check`.
Run the affected check before a local native build; CI checks both manifests.

Native examples (use the actual dedicated running emulator or available Simulator):

```sh
E2E_DEVICE=emulator-5554 mise exec -- npm run test:testerarmy:mobile -- dreamer android
E2E_DEVICE='iPhone 17 Pro' mise exec -- npm run test:testerarmy:mobile -- meditation ios
```

No automatic builds, prebuilds, app installs, EAS sessions or model calls occur.
Install an app-specific Release binary first under the repository build rules.
The wrapper checks the installed package and refuses Android Debug binaries;
iOS Release identity must be established from the build evidence. It resolves
iOS names to one Simulator and refuses physical-device pools. Native tests clear
only the selected app's state; use a dedicated disposable emulator/simulator.
One worker and a per-device lock prevent concurrent runs of this wrapper.
Never delete a stale lock without checking the recorded owner.

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
Native counterparts are deliberately limited to installed-build checks. Add the
affected user journey here; legacy coverage is not yet fully migrated.

Lucid also checks dark time-field contrast, nondefault sleep times surviving a
reload, full tab and shortcut labels at 320/360/390 pixels, light/dark programs,
beginner WBTB restrictions, shared account-form validation, two morning captures
persisted in Journal and their confirmed sign linked to both Atlas sources,
and stabilization/SSILD pause and resume after reload. Browser locale is French
for this suite. These mock-service browser journeys do not qualify native Lucid.
The existing Playwright visual journey and native Maestro coverage remain.

Reports, JUnit, Markdown, screenshots and browser traces are in
`tools/e2e/.e2e/<product>-<platform>/<run>/`. `evidence.json` identifies source revision,
dirty tree, tracked diff digest, binary version and command. Failed checks remain
in the report. Identify any untracked application changes in the work package;
a binary version alone does not prove the source revision it contains.

Agent goals can be added with an authorized model provider, one goal per call
and exact critical-outcome assertions. No provider is configured by default.
Use a provider barrier when replay must never call a model; strict cache alone
does not forbid a call on a cache miss. Existing Maestro, Playwright, backend and
CI checks remain until equivalent replacement journeys pass. A listed or
typechecked test is not evidence that the user journey passed.

## agent-device inspection and live exploration

The host CLI and the official `agent-device` Codex skill are installed. This
package uses the engine's exact `agent-device` 0.21.20 dependency; the global CLI
is the same version. Read its version-matched `help workflow` or `help debugging`
for specialized work. Do not replace the pinned native engine with `@latest`.

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
