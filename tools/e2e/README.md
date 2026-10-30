# TesterArmy E2E

Default framework for new journeys since the owner's 2026-10-05 instruction.
All active E2E entry points use this runner since 2026-10-21; the duplicated
Playwright test runners are retired. The complete web campaign is
`mise exec -- npm run test:testerarmy:all`: four Dreamer locale/feature contexts
and their coverage union, Lucid, Meditation, the built site, four personas through
the saved ChatGPT Pro login and the owned local backend. It requires that login
and fails without actual model calls; no API-key fallback is configured. Use
`npm run test:testerarmy:login` only if a saved login is missing. Native runs retain
their separate identified Release/device requirements. See the
[journey guide](../../e2e/README.md) and
[migration record](../../doc_web_interne/docs/qa/full-testerarmy-20261021.md).

Follow https://docs.expo.dev/guides/using-e2e/ and the skill bundled in this
package's `node_modules/e2e/skills/e2e/`. Dependencies and lockfile are isolated
from the application's Playwright version. The locked runtime is `e2e` 0.22.0,
`@e2e-dev/web` 0.15.4, `@e2e-dev/mobile` 0.12.5 and `agent-device` 0.21.35
(a direct pin with a matching override for the mobile engine). `SDK_PINS` in `qualification.mjs`
holds the same four versions; the runner refuses another installed version and
a report from another runner or engine. The engine peer ranges accept e2e 0.22.0.
Web 0.15.4 drives `playwright-core` 1.64.1, so the matcher Playwright moves to
1.64.1 too and both share one Chromium build.
Node 24.22.1 is pinned by the root mise file and satisfies e2e 0.22's
`^22.22.3 || >=24.8.0` requirement. The runner uses e2e's bundled TypeScript
loader; the scoped public matcher preload is unchanged.

Local web runs use several workers: half the CPU cores, at most eight, or
`E2E_WORKERS=<n>`. Files run in parallel against the one local server, each
attempt in its own browser context and storage; a file's tests stay in order.
CI (`CI` set) keeps one worker and shards across containers, and native runs keep
one worker per named device. e2e starts the slowest files first when the
previous report sits in the same output directory. Each run gets a new one, so
the runner keeps the report of the last run with no `--grep`, `--tag` or
`--shard` in `$(git rev-parse --git-common-dir)/verify-cache/e2e-durations/` and
seeds it into the next output directory; a seed the run does not replace is
deleted. A blocked run, or one where no test passed, leaves the kept report as
it was. Without that file, files start in collection order.

What 0.22.0 changes here:

- A secret fill no longer stops the model's screenshots (#1437, breaking
  upstream). Secure fields stay masked in captures and secret values stay
  redacted from text, but a model step after a fill now sees the screen. No step
  here combines the two: ordinary regressions make no model call (qualification
  refuses any token), personas sign in through mock profiles, and the journeys
  that type a password (native `credentials.user(...)`, web local-backend
  accounts) use no model. A future model journey that signs in must use
  disposable test accounts.
  `StepExecutorContext.pixelsTainted` is gone; nothing here read it.
- A test whose cleanup fails now ends the run with exit 3 and is named in the
  summary (#1233). `run.mjs` already refused such a report (`cleanup` other than
  `complete`); now the SDK exit code says so too and no `qualification.json` is
  written.
- Mobile 0.12.5: a step on a control the keyboard is moving waits for it to land
  (#1297), a locator whose target changes during the transition wait or a newer
  snapshot is resolved again (#1300, #1413), `fill` and `clear` re-read the field
  first (#1410), and `press('Enter')` taps an unfocused field before the key
  (#1421). It depends on `agent-device` 0.21.35 itself, the version already pinned,
  so the override now matches it. The iOS keyboard helpers in
  `native-backend-fixtures.ts` and the 44 pt tab clearance stay until a native run
  shows they are no longer needed.
- Locators take `filter({ hasNot, hasNotText })` as in Playwright (#1334, #1037),
  and `toHaveCount(0)` reads a locator under a closed frame as zero (#1354).
  `agent.assert` and `agent.waitFor` take `params` like `agent.act` (#1463).
- Web 0.15.4: `web()` targets accept `app.permissions` grants such as
  `clipboard-read` (#1429), `browser.waitForDownloads()` collects several files
  (#1048), `route.fetch()` reads the upstream response in a handler (#1044), and
  screenshots no longer edit inputs' inline style to hide the caret (#1288). The
  share journeys keep their scripted clipboard, which also covers a refused copy.
- `app.startRecording()` and `app.stopRecording()` film one span of a test that
  sets `{ video: 'off' }` (#1381).
- `e2e mcp` sessions get `run_code`, which runs test lines such as an `expect`
  on the live screen, and `open_session` takes a `test`
  (`tests/<file>.e2e.ts:<line>`) to run it and stay on the screen where it
  passed or failed (#1315, #1316). A config tool named `run_code` is refused;
  none is defined here.
- `--reporter ''` is a usage error (#1351); `run.mjs` and the bug bash always
  pass named reporters.
  See the [official changelog](https://github.com/tester-army/e2e/blob/main/packages/e2e/CHANGELOG.md#0220).

What 0.21.3 changes here:

- `app.screenshot()` returns the absolute path of the file it wrote, not a path
  relative to the attempt directory (#1326). The iPhone sandbox flow records that
  path as `sheetCapture` and checks that it is absolute; the purchase attestation
  takes it as is.
- `app.screenshot()`, `toHaveScreenshot()` and assertion and failure captures
  continue after a secret fill, with secure fields masked; the model still gets
  no pixels after the fill (#1218). No test here worked around the old stop.
- `e2e run` accepts `--action-timeout` and `--assertion-timeout` (#1310). `run.mjs`
  does not pass them through: a qualifying run keeps the config's timeouts.
- The web engine drives Playwright 1.64.1 and its Chromium; `npm run
  test:testerarmy:browsers` installs it. `@e2e-dev/mobile` 0.12.4 uses
  `agent-device` 0.21.29; this package overrides it with the pinned 0.21.35
  for the upstream iOS toolbar-occlusion fixes. The native evidence identifies
  the tested device and does not qualify every iPhone Duo layout.
  See the [official release notes](https://github.com/tester-army/e2e/releases/tag/e2e%400.21.3).

What 0.21.2 changes here:

- With several workers, `--shard` counts a skipped test in one shard only.
  Failure summaries and trace pages name the step that actually ended the test.
- Web `scrollUntilVisible` no longer pauses 100 ms between swipes (web 0.15.2).
  Web 0.15.1 adds `browser.keyboard.down()`/`up()` for held keys and modifier
  sequences; `tap`, `double_tap` and `right_click` accept modifier keys.
- On Android, locators and `expect` keep waiting while the app reports no readable
  foreground content after a cold start (mobile 0.12.3). `getByTestId` falls back
  to a resource id without its `<package>:id/` prefix, so `toHaveCount(0)` can now
  find such a node. Mobile 0.12.2 maps iOS element types to roles for `getByRole`
  and keeps video, resets, settings, alerts and clipboard on the selected device.
- Cached actions record their model and a replay with another model is flagged;
  an iOS navigation-bar or Android toolbar title change makes old recordings
  `REPLAY_STALE` under `--strict-cache`. This harness runs with `cache: 'off'`.
  See the [official release notes](https://github.com/tester-army/e2e/releases/tag/e2e%400.21.2).

What 0.21.1 changes here:

- Corrects CLI broken-pipe handling, timeout reporting and hosted-session deadline
  handling. The qualification report and trace format remain compatible.
- Adds `run()` from `e2e/runner` and an optional measured `keyboardVisible`
  observation. This harness keeps its existing CLI and engines; receiving mobile
  keyboard measurements requires a supporting mobile engine.
- Corrects MCP locator advice and the bug-bash skill's repro glob example.
  See the [official release notes](https://github.com/tester-army/e2e/releases/tag/e2e%400.21.1).

What 0.21.0 changes here:

- Reads (`textContent()`, `inputValue()`, `getAttribute()`, `isEnabled()`,
  `isChecked()`, `boundingBox()`...) wait for one match until the action timeout
  instead of failing at once on zero matches. `isVisible()`, `isHidden()` and
  `count()` still answer from the current screen.
- One `agent.act` per atomic goal: two outcomes worth checking are two calls,
  each pinned by its own check, so a split flow fails at the goal that broke.
- `--max-duration <ms>` (config `maxDuration`) stops a run after that long;
  `E2E_CACHE_DIR` or `--cache-dir` lets worktrees share one replay cache.
- On the web, `web({ colorScheme, reducedMotion })` and
  `browser.emulateMedia()` set what `@media` rules read; a target `command`
  can name host variables to pass through with `inheritEnv`.
- The report shape and trace pages are the 0.20 ones; qualification is unchanged.

What 0.20 changes here:

- A trace is a Markdown page per test, `results/<test>/trace.md`, on every
  engine, native included. There is no Playwright trace any more. Each page
  lists every step with the node it landed on, what an assertion read while it
  waited, the screen's changes and, on the web, what the app logged (console,
  uncaught errors, failed requests). Read it first when a run fails. The config
  keeps a page for every test (`trace: 'on'`), and qualification requires one
  for each passed test and hashes it with the other evidence.
- Screenshots, videos and downloads moved from `artifacts/` to
  `results/<test>/attempt-<n>/`; `failures/` is gone and `summary.md` links each
  failure to its trace page.
- `expect(screen).toHaveScreenshot()` compares the screen or one element with a
  committed PNG per target and OS (`<test file>-snapshots/`). Mac baselines never
  serve Linux CI. No journey uses it yet: a baseline needs its own reviewed
  screen and a CI-written Linux file.
- On a device, `device.setAirplaneMode(true)` takes an Android 11+ emulator
  offline (Wi-Fi and cellular); `setNetwork('offline')` cuts Wi-Fi only. Both
  are unsupported on an iOS Simulator. Restore the network in `afterEach`.
- `device.locator()` roles are agent-device kinds (`text`, `button`,
  `text-field`, `navigation-bar`), no longer iOS class names (`StaticText`).
- A test that records a soft failure and then calls `test.skip` now fails.

These pins describe the current package, not a permanent version ceiling. Within
requested work, read the candidate version's installed skill/topics and peer ranges,
update only this isolated package/lockfile, then pilot collection/loader, one relevant
real journey and its report/cleanup. A compatible candidate may be adopted after
its applicable checks pass without another generic permission request. Keep exact
pins and existing provider budgets; an upgrade does not enable a provider or Jev.

New journeys are written from this directory with `npx e2e run --watch`
(e2e 0.22.0). Watch reruns when a test, a neighbouring source file, or the
config is saved. It is for authoring. Qualifying runs stay on `run.mjs`.

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

`test:testerarmy:browsers` installs the engine's exact Chromium version and
keeps the full browser for local `--headed` runs. For headless-only hosts, use
`npm run test:testerarmy:browsers -- --only-shell`; Linux CI adds `--with-deps`.
The headless shell is the same executable the unchanged engine already launches.
The portable Node installer resolves Playwright from `@e2e-dev/web`, verifies
matcher version parity and preserves other projects' installed browsers.
It does not reuse the root application's different Playwright installation.

App commands run the existing package scripts through pinned Node's `--run`,
including on Windows, where directly spawning `npm` cannot execute `npm.cmd`.
Matcher preloads use file URLs and the inherited PATH keeps its original casing.
Common guard tests simulate link metadata over real files on every OS; they need
no Windows symlink privilege and keep the same cases and assertions.

Discovery starts no engine: `mise exec -- node tools/e2e/run.mjs lucid web list`.
To use an already open local Chrome instead of downloading or launching a test
browser, enable its remote debugging and set `E2E_WEB_CDP_ENDPOINT` to its
loopback DevTools HTTP or WebSocket URL before running the same commands.
The engine creates its own test context, preserves existing tabs and sessions,
and disconnects without closing Chrome. An invalid or unreachable endpoint
fails the run; it does not fall back to launching another browser.
The web products start separate local servers on ports 8096–8099; root app
services are mocked and external requests are blocked in app tests. Meditation
web proves routing/storage on the web only, not native audio or purchases.
Dreamer and Lucid retain Metro transforms by default and set both variant markers
explicitly. `E2E_KEEP_METRO_CACHE=0` requests a cold diagnostic; `1` explicitly
retains the cache. Other values fail. The Metro fingerprint isolates public,
native/router and effective RevenueCat resolver inputs. SDK replay remains off:
every selected journey and assertion still executes. Meditation keeps its cold
start until it has equivalent profile fingerprinting.
All Expo products probe Metro's `/status` endpoint during startup so repeated
short health requests do not restart static route compilation. Each journey
still opens the app and checks its actual UI and state.
Meditation web has a 180-second test and lifecycle budget: the public `app.open()`
and `app.restart()` methods use `config.timeout`, capped by the remaining test
budget. A per-test timeout alone does not raise that lifecycle limit. Other
products and native targets keep 120 seconds; action/assertion limits and retries
remain unchanged.
The app shows the onboarding story unless
`EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED=false`. The config forwards an
explicit value to the app command: `true` only when the run sets it, as in
`EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED=true mise exec -- node tools/e2e/run.mjs dreamer web run --trace`.
Without it, the story test is explicitly skipped and does not constitute
qualification of the shipped onboarding.
Dreamer also verifies that Quick Settings actually selects French and both
themes while preserving the Capture draft and language after reload. This
guards the web click regression from using a native gesture pressable there.
The journey opens the real Settings control, checks that preferences are
actionable, and requires closed drawers to expose no accessible radio controls.
It exercises the panel at 390 and 1280 pixels.

## Feature personas (opt-in pilot)

Dreamer's personas describe different needs, not only languages. Their English
goals run against the French real UI on web, iOS Simulator and Android emulator,
using the existing synthetic mock accounts:

| Persona | Account fixture | Goal and exact outcome |
| --- | --- | --- |
| Camille, just awake | New | Keep notes for later; reopen the one entry and recover the exact editable story without a reading or paywall. |
| Alex, regular journaler | Existing free | Find a cloud-garden dream, add it to favourites, reopen it through that filter with its story intact. The fixture starts unfavourited. |
| Samira, reflecting | Plus | Check the dream's title in the conversation, send one exact question, receive a simulated reply, then find the same dream, question and reply on revisit. |
| Inès, guest without an account | Guest (no profile), AI pre-allowed | Web only. At the 10 offered chat exchanges, and with the 2 lifetime guest analyses spent, the page says so once and leads to the account form; Plus never promises the analyses back. From the empty journal, start a remembered dream with one invitation to write. |
| Lucas, exhausted free quota | Existing free | Keep a dream, inspect the Plus offer, decline it and retain the story; verify free allowance and zero mock purchase/restore calls. |

Definitions live in [dreamer-personas.ts](dreamer-personas.ts); journeys in
[web journeys](tests/dreamer-personas.web.e2e.ts) and
[native journeys](tests/dreamer-personas.mobile.e2e.ts). Deterministic
setup chooses the account through the mock UI. Each `agent.act()` discovers one
functional outcome through visible controls, immediately followed by exact
assertions. Model-reported success alone never passes a test. Exact text entry,
setup and persistence checks use SDK locators without model calls.

Use an existing ChatGPT Plus/Pro subscription through the SDK's supported login,
after the account owner has chosen that access. No API key or paid gateway is
enabled by installing the dependencies. Authentication stays outside Git:

```sh
cd tools/e2e
mise exec -- npx e2e login openai
mise exec -- npx e2e models openai
```

From the repository root, collect without login/model calls, pilot one persona,
then run the four only after the pilot works:

```sh
E2E_PERSONAS=1 E2E_WORKERS=1 E2E_WEB_LOCALE=fr-FR mise exec -- npm run test:testerarmy -- list --tag personas
E2E_PERSONAS=1 E2E_WORKERS=1 E2E_WEB_LOCALE=fr-FR mise exec -- npm run test:testerarmy -- run --tag persona-morning
E2E_PERSONAS=1 E2E_WORKERS=1 E2E_WEB_LOCALE=fr-FR mise exec -- npm run test:testerarmy -- run --tag personas
```

Act uses `gpt-6.1-terra` and assert uses `gpt-6.1-sol` (`tools/e2e/persona-models.mjs`).
e2e 0.21.3 `chatgpt(id)` forwards the id and does not embed a catalog; these are
the OpenAI ids, and `gpt-6.1-sol` is the id this repo already qualified.
`E2E_PERSONA_MODEL` or `E2E_PERSONA_ACT_MODEL` overrides act.
`E2E_PERSONA_JUDGE_MODEL` overrides the judge. Set both back to `gpt-6.1-sol`
to restore the single-model campaign. Each goal allows at most 16 actions, 12 model calls
and 32,000 input tokens per request. Each test has a 240-second timeout; retries
and replay stay off. Use one worker. The full suite has seven agent goals.
It is not a human usability study or a performance/framerate measurement.

Without `E2E_PERSONAS=1`, no persona test is registered and ordinary regressions
retain their zero-model-call contract. Personas refuse other products and multiple
workers. Web requires `fr-FR`, isolates each browser context and blocks traffic
outside the local origin. Native setup selects French through visible settings;
`run.mjs` requires an identified `mock-persistent` Release on an owned virtual
device before setup may clear its synthetic data. Never point the campaign at a
personal account or real dream journal.

The canonical runner retains each test's trace, screenshot, exact source and
input identity, model usage, persona name and rerun environment in its unique
`.e2e/dreamer-{web,ios,android}/` directory. Qualification accepts model calls only for this
explicit campaign, checks the declared persona and actual model calls, and retains
all existing assertion, artifact and cleanup checks. A missing login or an
unexecuted journey is not a pass. Qualify a persona campaign with its `run`;
`collect` is reserved for the historical four-locale regression campaign and
does not aggregate persona runs. RTL, real service behaviour, physical-device
performance and Store behaviour remain outside this campaign. See the [SDK's subscription guide](https://e2e.tester.army/docs/subscriptions)
for access options; Claude uses an Anthropic API key rather than the Claude Code
session.

### Native personas with Sol

The [2026-10-20 native campaign](../../doc_web_interne/docs/qa/dreamer-native-personas-20261020.md)
records four passing personas on each platform, the exact builds and rerun commands.

First prepare an isolated native project and create its `mock-persistent`
`release.json` with the [native Release runner](#native-release-provenance-and-diagnostic-handoff).
Compile with mock persistence/audio enabled, the standard QA fixtures
(`EXPO_PUBLIC_MOCK_SHOWCASE` unset), and OTA disabled. Reuse an unchanged native
Release after test-only changes: the runner checks both app and native input
hashes, and records build-source and test-source revisions separately.

Collection below makes no model call and needs no device or receipt. For a run,
set an exact available Simulator UDID or dedicated emulator serial plus its AVD
name, and resolve the receipt to that platform's immutable build output:

```sh
E2E_PERSONAS=1 mise exec -- npm run test:testerarmy:mobile -- dreamer ios list --tag personas
E2E_PERSONAS=1 mise exec -- npm run test:testerarmy:mobile -- dreamer android list --tag personas

E2E_PERSONAS=1 E2E_PERSONA_MODEL=gpt-6.1-sol \
  E2E_DEVICE=SIMULATOR_UDID E2E_RELEASE_RECEIPT=IOS_BUILD_RUN/release.json \
  mise exec -- npm run test:testerarmy:mobile -- dreamer ios run --install-release --tag persona-morning
E2E_PERSONAS=1 E2E_PERSONA_MODEL=gpt-6.1-sol \
  E2E_DEVICE=emulator-5554 E2E_AVD_NAME=Noctalia_Personas_QA \
  E2E_RELEASE_RECEIPT=ANDROID_BUILD_RUN/release.json \
  mise exec -- npm run test:testerarmy:mobile -- dreamer android run --install-release --tag persona-morning
```

Once the pilot passes, replace `persona-morning` with `personas` to run all four
on each platform. Do not set `E2E_WORKERS` for native: each invocation owns one
explicit device and its lock. The first recorded action is `app.open()`, followed
by a fresh synthetic app state. Native assertions use accessibility locators,
keyboard dismissal, scroll-to-visible and the native AI consent dialog. Samira
checks the completed reply and edits an unsent draft after reopening; Lucas checks
zero purchase and restore calls. The runner retains installed binary identity
before/after the campaign and SDK cleanup diagnostics.

## Historical Dreamer UI parity

The 83 historical browser cases across 16 families run through TesterArmy with
their exact UI assertions, including mock billing, capture/edit/chat, continuous
reading, reflection, symbol dictionary, Explorer, settings persistence, Home,
Trends, responsive navigation, Journal geometry and feature-sheet stories.
The original Playwright web suite remains for local runs. Since the owner decision
of 2026-10-08, CI runs these 83 cases only here: every Playwright title has a
TesterArmy counterpart, with a stricter quota assertion and one Europe/Paris
browser timezone. Backend suites remain required. The relevant
functional assertions protect the current contract.
An obsolete expectation may be revised with a recorded product reason and a
focused current journey. Preserve the old red/pass result as history; it does not
automatically block feature or framework adoption or permit silently bypassing CI.

The public `surfaceOf()` Page/context keeps CSS, geometry, keyboard, image and
clock checks. TesterArmy owns isolated attempts and traces; the pinned isolated
Playwright 1.64.1 package supplies matchers only. The parity fixture preserves
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
EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED=false E2E_WEB_LOCALE=en-US mise exec -- node tools/e2e/run.mjs dreamer web run --grep 'feature sheets stay disabled when switched off'
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

All validation runs locally through `verify:pr` and `verify:release` on Windows
and Linux, with the same common cases and assertions. CircleCI runs only an
optional installation benchmark (manual/API trigger plus `run_e2e_benchmark=true`);
see the [CircleCI guide](../../doc_web_interne/docs/circleci-migration.md).
`npm run test:testerarmy:benchmark` reproduces it locally without root dependencies:
three isolated locked npm installs, each followed by full Chromium and headless
shell downloads into separate empty directories, in alternating order.
`-- --runs 1` is a quick pilot. Reports and logs are under
`.tmp/e2e-benchmark/results/`; disposable packages/browsers stay outside that
artifact directory. No system packages, app, suite, model, native build or device
are launched. Timings do not qualify application behavior.
Local journeys retain their existing reports, screenshots, trace pages and source
identity under `tools/e2e/.e2e/`. `E2E_KEEP_METRO_CACHE=1` drops Metro's `--clear`
for Dreamer and Lucid when explicitly requested; fingerprint isolation remains.

`npm run dependencies:check` validates the installed Expo SDK's expected native
dependencies before the app quality checks. Dreamer and Lucid share the root
manifest. Meditation has its own manifest and check:
`npm --prefix apps/meditation run dependencies:check`.
Run the affected check before a local native build; CI checks both manifests.

## Dreamer native recovery journeys

`npm run release:simulators` chains the native build and run commands below (production,
`mock-persistent` and `local-backend` profiles, iOS Simulator then Android emulator) for one
candidate commit in a managed workspace and writes one report; see
[simulator tests](../../doc_web_interne/docs/tests-simulateurs.md).

The [native journey runbook](native-journeys.md) covers real local Auth/storage,
offline sync, account isolation, analysis/chat recovery and system recognition
from a QA audio file. It gives identified iOS/Android build and run commands,
shared-backend locking, owned-app termination between platforms, and the explicit
limit: file recognition does not qualify physical microphone capture. The
[campaign evidence](../../doc_web_interne/docs/qa/dreamer-native-missing-journeys-20261022.md)
identifies fresh runs and justified reuse separately: composite coverage is not a
fresh 6/6 campaign, and excluded iOS speech remains unqualified.

## Android release evidence

Since the owner decision of 2026-10-14, Maestro is retired and this runner holds
the Android release journeys. `npm run android:gates:strict` passes its
TesterArmy check only when a run under `tools/e2e/.e2e/dreamer-android/` has a
final `end.json` with `applicationQualified: true` and exit 0, for the installed
`production-apk` build of `com.tanuki75.noctalia` whose versionCode is the
candidate's (`QA_ANDROID_VERSION_CODE`, else `app.json`). The run must also be on
the commit under qualification, from a clean working tree whose source stayed
stable, without `--grep`, `--tag`, `--exclude-tag`, `--tag-mode` or `--shard`; its
build receipt must name that same commit as its source; its folder must be
complete and pass `verifyEvidenceFiles`; its `source-start.json` and
`source-end.json` must both name that commit, record an empty working tree and
hold equal file maps (`compareSnapshots`), whatever `end.json` says, since
`end.json` is outside the run manifest; and the APK it tested and installed must
have the sha256 of the candidate APK named by `QA_ANDROID_RELEASE_APK`. Build that profile with
the native build command below (`E2E_BUILD_PROFILE=production-apk`), then run
`E2E_DEVICE=<emulator-serial> E2E_RELEASE_RECEIPT=<its release.json> npm run test:testerarmy:mobile -- dreamer android run --install-release`.
Its journeys stay offline; they do not prove purchases, real voice or backend
accounts. Real voice and RevenueCat Test Store purchases follow the manual
checklists (the voice one is an optional manual test that does not block
`android:gates:strict`, owner decision 2026-10-17) of `doc_web_interne/docs/android-expo57-qa-runbook.md` and
`doc_web_interne/docs/revenuecat-qa-workflow.md`.

## Native Release provenance and diagnostic handoff

Current delivered native evidence and retained limits: [retrospective qualification](../../doc_web_interne/docs/qa/native-retro-qualification-20261006.md). Historical reports retain their original source/build identities.

Requested native implementation/QA includes necessary local generation in its
isolated worktree after SDK/profile checks; reuse compatible existing native
projects first and prefer explicit `prebuild --no-install` when generation is needed.
Do not regenerate another task's project or ask for this same scope
again. Data ownership, signing, providers/budgets, EAS/Store and publication remain
separate boundaries. The build runner below still requires an existing native project.
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
  EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED=true \
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
all `EXPO_PUBLIC_*` inputs plus the native/router profile selectors and effective
RevenueCat web-stub setting. Release
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
(Free `3 / 3`, the five-analysis fixture capped at its limit; Plus unlimited), and account Journal isolation after sign-out.
These are real browser UI journeys with the historical mock profiles, not
qualification of backend durability, RLS, native storage or real purchases.
Run selections after the explicit `run` argument, for example:
`E2E_WEB_PORT=4511 mise exec -- npm run test:testerarmy -- run --grep 'account allowance'`.
The optional web port override is ignored for native targets.

Other coverage: Dreamer onboarding/empty-save/draft mode continuity; Lucid
required intention/experience and entry to sleep settings; Meditation onboarding,
restart persistence and tabs; generated site homepage/internal navigation.
Native counterparts exercise the explicit invariants in [NATIVE-MATRIX.md](NATIVE-MATRIX.md)
on identified Release builds. Browser-only assertions remain covered on the web;
existing CI gates still apply. Native gaps are explicit limits, not automatic
blockers for unrelated functional work or adoption.

Lucid also checks dark time-field contrast, nondefault sleep times surviving a
reload, full tab and shortcut labels at 320/360/390 pixels, light/dark programs,
beginner WBTB restrictions, shared account-form validation, two morning captures
persisted in Journal and their confirmed sign linked to both Atlas sources,
and stabilization/SSILD pause and resume after reload. Browser locale is French
for this suite. These mock-service browser journeys do not qualify native Lucid.
The existing Playwright visual journey remains; native Lucid runs here (`lucid.mobile.e2e.ts`).

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

Keep one canonical output and compact handoff with source/build/device, verdict,
exact rerun and the media needed to understand the outcome. Complete logs stay
local when useful for diagnosis; private data is not uploaded without authorization.
Use the existing runner and campaign collector rather than copying and fully
rehashing the same media at every handoff/status update. Repeat integrity work
when bytes are transferred, inputs change, corruption is suspected or a required
release check needs it. This does not remove the runner's identity, artifact or
final verdict checks. Optional video need not be enabled to qualify screenshot/UI
journeys; media actually requested by a body remains required for that run.

Browser fixtures may perform only their existing public `browser.route` and
`browser.setViewport` setup before the first `app.open()`. UI actions before that
open are refused; native ordering stays strict. SDK exit0 alone is insufficient. A qualified run needs the exact fresh report,
runner/engine/target/agent/source/origin, unchanged inputs, zero model use, every
selected runnable pair passed once, native `app.open()` first, complete cleanup, no
secondary errors, and intact declared/requested artifacts. A body requesting no
media and declaring none still keeps its trace page. A missing trace page or
requested video is refused. Source/output/install/lock failures are independent final checks;
primary SDK failures and SIGINT130/SIGTERM143 retain priority over secondary errors.
After process completion the wrapper releases only its own lock, including when
resource cleanup is failed/missing. `resourceCleanup` records that limitation and
the final verdict remains nonqualifying; no unknown session/recorder is killed.
`qualification.json` records SDK validation; only final `end.json` exit0 completes
that invocation. Preserve both when reporting its verdict.

While the SDK runs, the wrapper keeps a 1 s heartbeat. A gap of 30 s or more means
the whole host stopped running processes (a VM snapshot or pause, heavy memory
reclaim), so attempt deadlines expired with nothing running. `end.json` lists each
gap in `hostStalls`, the console prints it, and a failed run also gets the secondary
error `HOST_STALL`. It never turns a failure into a pass and never fails a pass: rerun
the campaign on a quiet host and judge that run. A failure that shows no host stall is
the app's or the test's.

For a browser campaign set one unique `E2E_CAMPAIGN_ID` on every invocation,
then run `node tools/e2e/run.mjs <product> web collect` locally.
`--shard <index>/<total>` splits one context into contiguous slices when needed;
collect their finalized evidence under the same campaign ID. A missing or failed slice leaves the union
incomplete, so collection fails. The collector revalidates reports, artifacts and final
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
This package pins `@e2e-dev/decision` for one use only: the optional decision
filter of the PR parcours gate (`zones.mjs`, `decision-verdict.mjs`, installed
`docs/filters.mdx`, OpenAI `gpt-6-luna`), which stays off until `OPENAI_API_KEY` is set. Its
`decisionExecutor` for `agent.act` is not configured; exact journeys require no
model dependency.
Use a provider barrier when replay must never call a model; strict cache alone
does not forbid a call on a cache miss. Existing Playwright, backend and
CI checks remain until an explicitly reviewed pipeline change. Still-relevant
assertions remain until their replacement passes; obsolete historical criteria
may be revised with their current product reason and old result preserved.
A listed or
typechecked test is not evidence that the user journey passed.

## agent-device inspection and live exploration

The host CLI and the official `agent-device` Codex skill are installed. This
package pins `agent-device` 0.21.35 for its local CLI and the mobile engine
through a targeted dependency override. A globally installed CLI may have a different version; the guarded
package commands use this local pin. Read its version-matched `help workflow`
or `help debugging` for specialized work. Use exact compatible pins for a measured
upgrade, not a floating `@latest` runtime or a global engine replacement.

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

## Interrupted CI campaign evidence

Local web SDK runs keep complete stdout/stderr in each immutable `sdk.log`.
A fixed, queryless console line every60s says only that this runner's own SDK child
is still open and its elapsed time; it does not claim test progress. It stops on
close/finally and never forwards SDK/app content. Matcher/action/lifecycle/retry
budgets are unchanged. CircleCI no longer launches these campaigns.

`web collect` still requires all exact current contexts and complete finalized
proof for qualification. After an interruption it inspects each owned campaign
candidate independently and writes `campaign-incomplete.json` with `qualified:false`,
missing proof files, SDK/wrapper exits and hashes of the available report/log bytes.
It returns nonzero and never writes a qualifying `campaign.json`. The original
reports, logs and partial media remain in the uploaded directory; an interrupted
ZIP/video is not claimed complete. No SDK test or app is launched by collection.

## Physical iPhone Apple Sandbox billing

The opt-in `run-iphone-sandbox-local.mjs` uses the existing developer-signed app on an owned
physical iPhone. It does not install/reset the app or change macOS security settings.
Configure the ignored `.env.ios-sandbox.local` from `.env.ios-sandbox.example`, retaining the
existing signed runner, device/account identity and private evidence/preflight. Start the
canonical local Metro profile before `--check` or a run; `--list` needs no device/Metro.

```sh
mise exec -- node tools/e2e/run-iphone-sandbox-local.mjs --check
mise exec -- node tools/e2e/run-iphone-sandbox-local.mjs --list --grep 'restores receipt'
mise exec -- node tools/e2e/run-iphone-sandbox-local.mjs --grep 'restores receipt'
```

An explicit `--grep` is required. One worker and zero retries cannot be overridden through
this wrapper. Fresh purchases also require `--allow-sandbox-purchase`; verify the actual
Apple test-only/no-charge sheet and expected account before physical confirmation. The
native sheet may be absent from the app accessibility tree. Resume an already completed
purchase with the continuation test; do not tap Buy again to check it. Original failures,
human steps and continuation passes stay distinct evidence.

See the [reusable iOS runbook](../../doc_web_interne/docs/revenuecat-qa-workflow.md#ios-physique--réutiliser-la-préparation-sandbox)
and the [dated qualification](../../doc_web_interne/docs/qa/revenuecat-ios-sandbox-20261016.md).
This developer-client proof does not qualify Release/TestFlight or production delivery.

Receipt qualification also binds Metro to the clean checked-out source, resolves the device
name to the inspected physical UDID and checks source/profile stability at completion.
A purchase continuation requires `--resume-attempt <id>` within 15 minutes, an explicit
attempt-bound `purchase-attestation.json`, and a native PURCHASE matching RevenueCat's
`store_transaction_id`. A renewal or stale state is refused. See the runbook for the private
attestation fields. Run `mise exec -- node --test tools/e2e/iphone-sandbox-guards.test.mjs`
for the documented unsafe-device/stale-evidence counterexamples without touching a phone.

### PR #633 collection native qualification

Run the `pr633-collection` tag on an identified owned `mock-persistent` Release.
The journey saves a fresh story, returns to the journal, reveals a card, closes it
and reopens it; Android also runs with a cold image cache and airplane mode,
restoring connectivity in `finally`. Inspect the retained screenshots and verify
the full 720 px source through the native cache or image-decoder trace; an
accessible image wrapper alone does not prove the artwork loaded.

The saved-dream journey uses one ordinary locator tap and asserts the journal
immediately after it; a second tap or an app restart must not stand in for that
outcome. The native capture seal owns the arrival animation, so the stack does
not add another transition over that handoff.
