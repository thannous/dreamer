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
