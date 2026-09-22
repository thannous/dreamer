# Reading performance through the canonical runner

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
