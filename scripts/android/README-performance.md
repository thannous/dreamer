# Reading performance through the canonical runner

## Native commit safety

Keep `reanimated.staticFeatureFlags.DISABLE_COMMIT_PAUSING_MECHANISM` set to
`false` in `package.json` while using the stable, prebuilt React Native runtime.
Setting it to `true` requires React Native's `preventShadowTreeCommitExhaustion`
to be active in the compiled runtime. Without that protection, animated updates
can starve React commits: the debug runtime can abort at
`ShadowTree.cpp` with `attempts < 1024`. See the
[Reanimated feature flag contract](https://docs.swmansion.com/react-native-reanimated/docs/guides/feature-flags/#disable_commit_pausing_mechanism).

This is a native compile-time setting. Rebuild the app after changing it; Metro
reloads cannot validate it. Retest the chat's thinking-to-response transition and
scrolling, and verify that the installed APK is the rebuilt artifact. A successful
debug retest does not establish Release frame performance or iOS behavior.

## Reading measurements

Keep startup modes (`cold`, `warm`, `resume`, `all`) unchanged. Reading uses Python 3's standard library, adb, Android SDK `apkanalyzer`/`apksigner`, and an explicitly supplied official Perfetto `trace_processor_shell`.

Use the repository device lock around the canonical command. Leave the base Noctalia app open and the reference card reachable in the journal. The runner never installs, clears data, changes settings, or chooses a different dream.

```sh
node scripts/android-device-lock.js wrap --owner dreamer --device SERIAL -- \
  npm run android:perf:measure -- --mode reading --device SERIAL \
  --scenario /private/path/scenario.json --trace-processor /path/trace_processor_shell \
  --phases reading-open --pilot --output /private/path/pilot
```

A private scenario specifies the already inspected card, gesture coordinates for that device, and expected installed code. Do not commit dream identifiers or device evidence.

```json
{
  "targetTestId": "existing-card-test-id",
  "dreamLabelSha256": "sha256-of-the-reference-card-label",
  "swipe": [610, 2180, 650, 600],
  "expected": {
    "versionCode": 76,
    "certificateSha256": "verified-play-certificate-digest",
    "runtimeVersion": "verified-native-fingerprint",
    "updateId": "verified-embedded-or-ota-update-id"
  }
}
```

`--pilot` performs one pass and checks the installed APK manifest, signing certificate, current process's runtime event and a one-second real Simpleperf probe. An absent `PROFILEABLE_BY_SHELL` dumpsys field is never interpreted as a negative result. If the runtime event has expired, relaunch once and perform the pilot before warming the scenario. Override SDK discovery with `--apkanalyzer` / `--apksigner` when necessary.

For iterations, specify only affected `--phases`, among `detail-open,detail-scroll,reading-open,reading-scroll`. Preparatory navigation is outside measurement windows. After a valid pilot, warm once, fix the repetition count, and run the final series in a new directory (default five runs, all four phases). Do not rerun to obtain a favorable result.

```sh
node scripts/android-device-lock.js wrap --owner dreamer --device SERIAL -- \
  npm run android:perf:measure -- --mode reading --device SERIAL \
  --scenario /private/path/scenario.json --trace-processor /path/trace_processor_shell \
  --runs 5 --output /private/path/final --baseline /private/path/before/report.json
```

The report saves phase windows atomically before analysis, stops/pulls only its own trace in `finally`, checks Perfetto error counters, and writes `report.json` / `report.md`. Each trace also has a bounded 120-second lifetime. `--resume` with the same output, scenario, installed code, settings, phases and repetition count recovers the previous trace and skips valid phases. An interrupted phase without a complete saved window is rerun; failed traces remain evidence, never counted as successful. Keep raw artifacts private. A forcibly killed process cannot guarantee immediate cleanup; the trace duration bounds that case.

Comparison uses actual application surface frames from FrameTimeline, never gfxinfo's surface aggregation. P95 is a frame duration, not click-to-content latency. CPU is a separate protocol. The conservative per-phase verdict is `gain observed`, `regression`, or `indeterminate`: at least three valid runs, matching scenario/device/settings, median battery temperatures within 2°C, >=10% P95 difference with non-overlapping per-run P95 ranges, and no missed-frame rate increase >0.2 percentage points for a gain. These are working comparison rules, not release acceptance thresholds or a statistical/battery claim. Raw run values remain available; a baseline with missing provenance/conditions is not silently accepted. Stage durations are recorded rather than estimating a process speedup.

Validation:

```sh
npx jest --runTestsByPath scripts/measure-android-performance.test.js --runInBand --watchman=false
python3 -m unittest discover -s scripts/android -p 'test_*.py'
```

## Main pages and the owned QA app

The reading worker also accepts `--package com.tanuki75.noctalia.qa`, the existing
side-by-side Dreamer QA profile. Its default stays the base package; other products
remain refused. Runtime `applicationId` must match the selected package, and package
identity is part of comparison conditions. The selected app must own the foreground
window and each UI target before input. A failed UI journey invalidates its trace
even when FrameTimeline is healthy; resume must replay that failed phase.
Release/signature/PID/font/trace health
checks and comparison thresholds stay in force. This additive path follows the
retirement of TI-429's base-only harness; it does not authorize changing personal data.

Use one phase per screen scenario: `screen-scroll` or `screen-open`. Preparation
and UI-tree validation remain outside the measurement windows. A screen scenario
names `screenTestId`, `targetTestId` and `targetLabelSha256` for inspected, existing
reference content, plus `swipe`, `expected`, and a redacted `name`. `screen-open`
also names `originScreenTestId`, `navigationTestId` and `returnTestId`; the last
returns to the origin before each subsequent measured tap. Both modes verify the
expected screen/content afterwards. Missing or changed content is a failure.

Optional `settleMs` (0–10000, default 1200) fixes the post-action capture window;
include the full entrance when that is the question, for example 2800 ms on Trends.
It is a measurement boundary, not a click-to-content latency. Keep it identical
between candidates; it participates in the scenario hash. Pilot one sample before
defining the final series. For example, under the existing device lock:

```sh
npm run android:perf:measure -- --mode reading --device SERIAL \
  --package com.tanuki75.noctalia.qa --phases screen-scroll \
  --scenario /private/path/trends.json --trace-processor /path/trace_processor_shell \
  --pilot --output /private/path/trends-pilot
```

Functional navigation uses the existing native configuration with
`E2E_PERF_SCOPE=main-pages`; it selects the QA package explicitly. Use the connected
phone's name for the SDK's `E2E_PERF_DEVICE` and its adb serial for the device lock.
This scope never resets or seeds the phone. An emulator fixture and a physical
existing QA journal are distinct preconditions and must be reported separately.

## Static artwork and APK size

`AtmosphericBackground` keeps the upper ornament and the horizon in separate,
content-bounded SVG viewports. Android's `react-native-svg` implementation uses a
bitmap per viewport and recreates it after detachment. Excluding the transparent
middle reduces those bitmap allocations without changing the paths, scale, theme
colours, or stroke widths. Check both variants in portrait and landscape when
changing their bounds; allow room for strokes and antialiasing. Capture uses an
instant native-stack transition because it is a peer in the bottom navigation.

Import icon families directly (for example `@expo/vector-icons/Ionicons`). The
package barrel brings unrelated font assets into the Metro bundle. Eight opaque
Lucid illustrations use lossless WebP; their decoded RGBA pixels and dimensions
match the original PNGs. Keep alpha artwork unchanged unless its decoded pixels
also match. Do not reduce image quality or remove features to meet a size target.

A local `production-apk`, profileable, `arm64-v8a` Release comparison against
`347090f5`, built with Node 24 and JDK 17 via `npm run android:release:local`, gives:

| APK content | Before (bytes) | After (bytes) |
| --- | ---: | ---: |
| Signed APK | 103,482,113 | 99,006,405 |
| Embedded Hermes bundle | 14,894,580 | 14,614,360 |
| Compressed Android resources | 28,416,122 | 24,224,598 |
| DEX | 28,719,600 | 28,719,600 |
| Native libraries | 27,266,312 | 27,266,312 |

This is a 4,475,708-byte APK reduction (4.33%). It is not a Play download-size,
installed-size, or runtime-memory claim. Keep bundle/native compression defaults:
compressing them merely to reduce APK bytes can trade installation/startup work
against that figure. Reproduce with the same ABI and build profile, preserve the
first APK before building the second, and compare ZIP entry sizes as well as the
complete signed APK. Profileable APKs remain local validation artifacts.

Device traces, journal content, UI trees, and device-specific metrics stay in a
private output directory. Before reinstalling a physical build, verify its
package, version, signature, data backup coverage, and restoration method; an old
backup is not proof that newer local data is covered. Use the existing
`tests/android/navigation-retention.py` under the device lock for repeated
Capture/Journal navigation without clearing app data.

## Startup report schema 2

Startup JSON retains every raw run with `valid` and `failureReasons`; CSV appends
`valid,failure_reasons`. Summary `count` now counts valid runs only; `totalCount`,
`validCount` and `invalidCount` disambiguate the population. Each metric has its
own finite-value `count`. No valid observations yields null percentiles, not zero.
Fatal/development counters and top-level failures still cover all runs, and any
invalid run keeps exit code 2. Consumers of schema 1 must account for this change.
`warm` remains a task return after 250 ms, not Android activity recreation.

Run the synthetic transport CLI check with
`npm run test:file -- scripts/measure-android-performance-cli.test.js --watchman=false`.
This verifies reporting and failure handling; it provides no app timing evidence.

### Journal scroll and user latency markers (TI-635)

Use the existing private scenario contract with `--mode reading --phases journal-scroll`.
The capture verifies the reference card before scrolling and does not open the detail
or reader for a journal-only phase. Use a short viewport where the search header
collapses; preserve orientation/font scale and swipe coordinates between candidates.
Pilot first (`--pilot`), then define the run count before the series. Never seed a
personal journal. The default reading phases remain unchanged.

With `EXPO_PUBLIC_PERFORMANCE_TRACING=true`, new markers distinguish
`startup.fonts_settled`, `journal.first_list_painted`, `journal.first_useful_content`
(first viewable card), `journal.interaction`, `journal.sync_complete`,
`journal.save_requested`, `journal.save_acknowledged`, `journal.storage_started`,
`journal.storage_normalized`, `journal.storage_committed`, `analysis.requested`,
`analysis.target_synced`, `analysis.http_started`, `analysis.job_accepted`,
`analysis.result_observed`, and `analysis.text_displayed` (reader modal onShow).
Storage/analysis stages carry a bounded process-local numeric `trace`; no dream
identity, transcript, signed URL or account identifier is logged. A storage commit
includes queue wait and SQLite transaction time, not only serialization. HTTP result
observation includes polling/network delay and is not model execution duration.
A list paint is not synchronization completion, and an empty/loading list is not
proof that the intended dataset was rendered. Keep the UI assertions with the trace.

## Optional local Noxcturnal transformer (SDK 58)

`NOCTALIA_METRO_NOXCTURNAL=1 npm run start` opts a local Metro session into
Expo's experimental Rust transformer. The same flag works with a local
`npx expo export --platform android --clear`. The flag is ignored when
`EAS_BUILD=true`; the default Release transformer stays unchanged.

Four alternating cold Android exports on 2026-10-19, with identical application
inputs, Uniwind and React Compiler, measured 13.50/13.83 s with Babel and
11.37/11.10 s with Noxcturnal. Hermes bytecode increased from about 12.47 MB to
12.67 MB. This is bundling evidence, not a startup or frame-rate improvement.
Expo falls back to Babel for unsupported modules, including worklets/codegen;
do not disable those transforms to make the pilot faster. Device performance
comparisons should identify the selected transformer and use the same setting.

Expo Atlas is available as a pinned development dependency. Use
`EXPO_ATLAS=true npx expo export --platform android` to inspect transformed module
weights separately from the final Hermes bundle and native APK size.
