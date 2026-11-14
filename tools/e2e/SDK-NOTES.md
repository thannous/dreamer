# SDK version notes

What each TesterArmy SDK version changed for this harness, newest first. The versions
the harness runs today, and how to adopt a new one, are in the [README](README.md).

## 0.23.1

Adopted together with web 0.16.0, mobile 0.12.7, decision 0.3.3, agent-device 0.21.37
and the matcher Playwright 1.65.0 (released 2026-11-13). These five move as one:
decision 0.3.3 and web 0.16.0 ask for e2e 0.23.1, and an older runner refuses a
filter's `relevance` key and drops the whole filter.

- A test filter may score the tests it keeps (`relevance`, 0 to 1). With
  `--changed-since`, each target starts its likeliest files first, in bands at 75,
  50 and 25 %. `parcoursTouches` now scores a journey whose own file changed 1, a
  journey of a touched zone 0.75, and a parcours the model brings back with the
  model's score (0.5 when it gives none). With the PR gate's `--max-failures 3`
  a broken journey shows and stops the gate sooner. Scores never leave a test out.
- `decisionFilter()` returns those scores; `decision-verdict.mjs` keeps them with
  the cached verdict so `e2e list` and `e2e run` order the same way.
- `e2e run` keeps `<output>/timings.json`, smoothed over recent runs.
  `duration-history.mjs` now seeds that file into each new output directory and
  keeps it after a full run, instead of planting the previous `report.json` there
  (and deleting it when the run wrote none). The first run after this change has
  no timings history yet and starts in collection order.
- An app command that exits after readiness, even with code 0, now fails the run.
  Every managed command here stays in the foreground.
- Web 0.16.0: `headers` and `basicAuth` reach the app's own origin only
  (`credentialOrigins` lists others). `webEngine` passes `headers: {}` only to
  block service workers, so nothing changes. The `browser` fixture gains tabs
  (`tabs()`, `newTab()`, `waitForPopup()`); actions wait for an element to leave an
  `inert` subtree.
- Mobile 0.12.7: a test's own swipe and scroll skip agent-device's post-gesture
  wait (up to 3.5 s each, ignored by 0.21.36); the first tap within 2 s re-reads the
  control until two reads agree. A node under the soft keyboard counts as hidden
  and a tap the keyboard covers fails `ACTION_FAILED` naming the cover. Each
  device's prepare logs its boot and runner times. A native campaign qualifies it.
- PNG decoding moves to `@napi-rs/image` (screenshots 4 to 12 times faster, about
  20 MB more install).

## 0.23.0

- `test.fail` (or `{ fail: 'reason' }`) marks a test expected to fail: its failure
  is reported `passed` and a pass fails with `UNEXPECTED_PASS`. Qualification
  refuses such a result (`EXPECTED_FAILURE_NOT_PROOF`), so it never counts as a
  journey proof. No test uses it; a confirmed bug stays a red `bugbash` repro.
- `e2e doctor` checks that a run can start (config, browser build, agent-device,
  toolchain, devices, app build, models) without starting one:
  `npm run test:testerarmy:doctor` runs it through `run.mjs`.
- `inputValue()` on a node with no value and `isChecked()` on a node with no
  checked state now throw `ACTION_FAILED` instead of returning `''` or `false`.
- Mobile 0.12.6: snapshots and screenshots run within the timeout of the call
  that takes them, so a stalled device fails the step with `ACTION_FAILED`
  instead of the test timeout; `waitFor` and `expect` give their last snapshot
  extra time. Rerun the platform once before diagnosing such a failure.
- The `list` reporter prints each test as it finishes when stdout is not a TTY
  and ends with a `Failed` row per failure; failures and `.e2e/summary.md` quote
  the app's first 3 errors, redacted. `run.mjs` writes SDK output to `sdk.log`,
  so the terminal keeps the red-run digest, which quotes no app text.
- The explore planner tries another lens instead of finishing while steps
  remain, so a bug-bash charter usually ends on `step-limit`; with every step
  passed that is a complete charter. The agent gains `resize_viewport` (web).
- `app.baseUrl` never ends with a slash (every use here is `new URL(…, baseUrl)`),
  `timeout: 0` on a call means "until the test timeout", `route.fetch()` gains
  `body()`, and `e2e mcp` adds `run_tests` and `screenshot { path }`. A
  `run_tests` result is not evidence (it bypasses `run.mjs`); never start one beside
  an open native session.
- Engines run over the new engine protocol, still in the runner's process for
  `web()` and `mobile()`, so the matcher preload, the network guard and the
  service-worker probe are unchanged.

## 0.22.0

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
  (#1421). It depends on `agent-device` 0.21.35 itself; the override gives it the
  direct 0.21.36 pin (above). The iOS keyboard helpers in
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

## 0.21.3

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

## 0.21.2

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

## 0.21.1

- Corrects CLI broken-pipe handling, timeout reporting and hosted-session deadline
  handling. The qualification report and trace format remain compatible.
- Adds `run()` from `e2e/runner` and an optional measured `keyboardVisible`
  observation. This harness keeps its existing CLI and engines; receiving mobile
  keyboard measurements requires a supporting mobile engine.
- Corrects MCP locator advice and the bug-bash skill's repro glob example.
  See the [official release notes](https://github.com/tester-army/e2e/releases/tag/e2e%400.21.1).

## 0.21.0

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

## 0.20

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
  committed PNG per target and OS (`<test file>-snapshots/`, named
  `<name>-<target>-<os>.png`, for example `<name>-dreamer-web-darwin.png`). No journey
  uses it. run.mjs runs the SDK with `CI=1`, so it never writes a baseline: a missing
  one fails and the capture is attached under
  `results/<test>/attempt-<n>/snapshots/<test file>-snapshots/`. A first one comes from
  a direct `npx e2e run` in tools/e2e (CI unset, as in the authoring `--watch` loop)
  or from that attached capture, reviewed and committed; rewriting one needs
  `--update-snapshots`, which run.mjs refuses. Each OS that runs verify:pr needs its
  own reviewed file, with dynamic content masked. Adding one is an owner decision and
  needs a reviewed change.
- On a device, `device.setAirplaneMode(true)` takes an Android 11+ emulator
  offline (Wi-Fi and cellular); `setNetwork('offline')` cuts Wi-Fi only. Both
  are unsupported on an iOS Simulator. Restore the network in `afterEach`.
- `device.locator()` roles are agent-device kinds (`text`, `button`,
  `text-field`, `navigation-bar`), no longer iOS class names (`StaticText`).
- A test that records a soft failure and then calls `test.skip` now fails.
