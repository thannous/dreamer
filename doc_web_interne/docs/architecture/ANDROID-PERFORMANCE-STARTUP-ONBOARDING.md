# Android performance — startup and onboarding

## Scope and proof levels

This runbook measures two isolated flows for `com.tanuki75.noctalia`:

1. killed process → first visible and interactive route;
2. fresh process on onboarding intro → `btn.onboarding.intro.next` → path screen.

Use a local Release build for user-facing frame and memory claims. Use a
non-debuggable profileable Release only for Simpleperf attribution. Emulator results
are comparative evidence, not production proof; the closing gate requires a
physical 60 Hz Android device. Local builds and installs do not authorize EAS,
OTA, Play submission, deployment, commit, or push.

## Instrumentation

Build with `EXPO_PUBLIC_PERFORMANCE_TRACING=true` to emit User Timing and
logcat records prefixed by `[NoctaliaPerf]`. The important boundaries are:

- `startup.root_mounted`, `startup.route_committed`,
  `startup.custom_splash_outro_started`, `startup.interactive`;
- `startup.notification_response_coalesced` and
  `startup.notification_navigation_coalesced` when Expo/native delivery or
  React effects expose the same response more than once;
- `onboarding.continue_pressed`, `onboarding.optimistic_state`,
  `onboarding.persistence_started`, `onboarding.persistence_finished`,
  `onboarding.step_rendered`, `onboarding.accessibility_focus`.

The flag is off by default. Never include user content or identifiers in a
performance marker.

The root stack is anchored on `(tabs)` for existing navigation/deep-link
semantics. While the startup guard is unresolved, `StartupRouteProvider` keeps
that transient tab route on a static placeholder. This prevents home-card
Moti/Reanimated work from starting on Fabric views that the guard is about to
detach. The full tab navigator mounts only after a committed `(tabs)`
destination. Do not remove this gate without repeating the five-start logcat
campaign.

## Build and preflight

Use the repository commands rather than direct Gradle wrappers:

```bash
# User-facing frame, startup and memory campaign:
EXPO_PUBLIC_PERFORMANCE_TRACING=true npm run android:release:local -- \
  --install --device <serial> --abi <arm64-v8a-or-x86_64>

# CPU attribution with Release optimizations and shell profiling enabled:
EXPO_PUBLIC_PERFORMANCE_TRACING=true npm run android:release:local -- \
  --profileable --install --device <serial> --abi <arm64-v8a-or-x86_64>

npm run test:e2e:onboarding
node ./scripts/run-maestro-android.js \
  --flow maestro/release-notification-permission.yml \
  --retries 0 --no-start-metro
```

`--profileable` is accepted only by the production APK profile. It enables
shell profiling but does not make the package debuggable. The generated Gradle
configuration defaults both diagnostic switches to false, so a normal Release
cannot inherit them accidentally. `--reuse-native-project` is an advanced
local option for an already-generated compatible Android project; it fails if
the required generated marker is absent.

Before every campaign, record:

```bash
git rev-parse HEAD
adb -s <serial> shell getprop ro.build.version.release
adb -s <serial> shell getprop ro.build.version.sdk
adb -s <serial> shell dumpsys package com.tanuki75.noctalia | \
  rg 'versionName|versionCode|DEBUGGABLE|profileable|isProfileable'
adb -s <serial> shell run-as com.tanuki75.noctalia id
adb -s <serial> shell dumpsys display > <artifact-dir>/display.txt
adb -s <serial> shell settings get global window_animation_scale
adb -s <serial> shell settings get global transition_animation_scale
adb -s <serial> shell settings get global animator_duration_scale
```

Keep the same device, refresh rate, animation scales, power mode and thermal
state for before/after. Run at least five repetitions per build.

For cross-run timing distributions, use linear interpolation with
`h = (n - 1) × p` (R-7) and state the method. Preserve every per-run value;
with only five runs, P90/P95/P99 are sample descriptors rather than stable
population estimates. For gfxinfo, report each run's P50/P90/P95/P99 and the
median of those per-run percentiles; do not imply that summary-only gfxinfo
files contain a pooled frame distribution.

## Focused capture

Create a run-specific directory outside the repository. Use task-specific
variables; do not reuse system variables such as `HOME`.

```bash
PERF_SERIAL=<serial>
PERF_PACKAGE=com.tanuki75.noctalia
PERF_ARTIFACT_DIR="$(mktemp -d "${TMPDIR:-/tmp}/noctalia-android-perf.XXXXXX")"
mkdir -p "$PERF_ARTIFACT_DIR"
```

Prepare onboarding intro on a dedicated test device. Clearing package data is
destructive and is permitted only on that disposable target. Confirm the intro
and derive tap coordinates from the UI tree, never from a screenshot:

```bash
adb -s "$PERF_SERIAL" exec-out uiautomator dump /dev/tty \
  > "$PERF_ARTIFACT_DIR/intro.xml"
rg 'btn.onboarding.intro.next' "$PERF_ARTIFACT_DIR/intro.xml"
```

For each transition run:

```bash
adb -s "$PERF_SERIAL" shell am force-stop "$PERF_PACKAGE"
adb -s "$PERF_SERIAL" logcat -c
adb -s "$PERF_SERIAL" shell am start -W -n "$PERF_ACTIVITY" \
  > "$PERF_ARTIFACT_DIR/transition-<n>-am-start.txt"
adb -s "$PERF_SERIAL" exec-out uiautomator dump /dev/tty \
  > "$PERF_ARTIFACT_DIR/transition-<n>-intro.xml"
rg 'btn.onboarding.intro.next' \
  "$PERF_ARTIFACT_DIR/transition-<n>-intro.xml"
adb -s "$PERF_SERIAL" shell dumpsys gfxinfo "$PERF_PACKAGE" reset
# Tap the centre computed from btn.onboarding.intro.next bounds.
adb -s "$PERF_SERIAL" shell input tap <x> <y>
# Stop after the path title/layout marker and a short stable idle period.
adb -s "$PERF_SERIAL" shell dumpsys gfxinfo "$PERF_PACKAGE" \
  > "$PERF_ARTIFACT_DIR/transition-<n>-gfxinfo.txt"
adb -s "$PERF_SERIAL" shell dumpsys gfxinfo "$PERF_PACKAGE" framestats \
  > "$PERF_ARTIFACT_DIR/transition-<n>-framestats.txt"
adb -s "$PERF_SERIAL" logcat -d -v epoch \
  > "$PERF_ARTIFACT_DIR/transition-<n>-logcat.txt"
adb -s "$PERF_SERIAL" exec-out uiautomator dump /dev/tty \
  > "$PERF_ARTIFACT_DIR/transition-<n>-path.xml"
rg 'btn.onboarding.path.' "$PERF_ARTIFACT_DIR/transition-<n>-path.xml"
```

Return to intro before the next force-stop and assert the intro control again.
This makes every measured transition a fresh-process run while preserving the
same package data and APK.

For startup, reset gfxinfo while the old process exists, force-stop it, clear
logcat, launch the resolved activity, and stop after `startup.interactive`:

```bash
adb -s "$PERF_SERIAL" shell dumpsys gfxinfo "$PERF_PACKAGE" reset
adb -s "$PERF_SERIAL" shell am force-stop "$PERF_PACKAGE"
adb -s "$PERF_SERIAL" logcat -c
PERF_ACTIVITY="$(adb -s "$PERF_SERIAL" shell cmd package resolve-activity \
  --brief "$PERF_PACKAGE" | tr -d '\r')"
adb -s "$PERF_SERIAL" shell am start -W -n "$PERF_ACTIVITY" \
  > "$PERF_ARTIFACT_DIR/startup-<n>-am-start.txt"
adb -s "$PERF_SERIAL" shell dumpsys gfxinfo "$PERF_PACKAGE" framestats \
  > "$PERF_ARTIFACT_DIR/startup-<n>-framestats.txt"
adb -s "$PERF_SERIAL" logcat -d -v epoch \
  > "$PERF_ARTIFACT_DIR/startup-<n>-logcat.txt"
adb -s "$PERF_SERIAL" shell dumpsys meminfo "$PERF_PACKAGE" \
  > "$PERF_ARTIFACT_DIR/startup-<n>-meminfo.txt"
adb -s "$PERF_SERIAL" exec-out screencap -p \
  > "$PERF_ARTIFACT_DIR/startup-<n>-screen.png"
adb -s "$PERF_SERIAL" exec-out uiautomator dump /dev/tty \
  > "$PERF_ARTIFACT_DIR/startup-<n>-ui.xml"
rg 'screen.recording' "$PERF_ARTIFACT_DIR/startup-<n>-ui.xml"
```

Treat a missing, empty or unparsable UI dump as missing route evidence. Do not
silently continue after a failed pull or claim the visible route from a
navigation marker alone. Retry the dump while the run is still active; if that
is impossible, repeat a small route-only campaign and label it separately from
the timing campaign. Some continuously updating screens can keep
`uiautomator` from reaching its idle state. In that case, preserve the exact
`could not get idle state` error, capture a native screenshot, and combine it
with a successful hierarchy from the same durable state plus per-run route
markers. A screenshot is visual evidence, not a substitute for a resource-ID
assertion, so report each evidence type and limitation separately.

Do not add `-S` to `am start` after a separate `am force-stop`: on current
Android emulator images, `-S` can include the package-stop wait in `TotalTime`
and produces a non-comparable number. Keep application TTI based on the
`startup.root_mounted` → `startup.interactive` marker pair.

As a secondary killed-process boundary, calculate
`ActivityTaskManager: START u0` → `startup.interactive` from logcat wall-clock
timestamps. Keep it separate from both application TTI and `am start -W`:
`am start -W` stops at Android's displayed boundary, which can precede the
app's interactive marker.

Capture one representative Perfetto trace per flow using the focused command
from the Android Performance skill (`sched freq idle am wm gfx view
binder_driver hal dalvik`, scoped with `--app`). Use Simpleperf only after the
package preflight proves profileable. A broad trace or missing symbols cannot
prove an app-owned hotspot.

For CPU attribution, start recording immediately before the isolated flow and
pull the result before generating both inclusive and self-time reports:

```bash
adb -s "$PERF_SERIAL" shell simpleperf record \
  -e cpu-clock -f 4000 --call-graph fp -p "$(adb -s "$PERF_SERIAL" \
  shell pidof "$PERF_PACKAGE")" --duration 15 \
  -o /data/local/tmp/noctalia-perf.data
adb -s "$PERF_SERIAL" pull /data/local/tmp/noctalia-perf.data \
  "$PERF_ARTIFACT_DIR/simpleperf.data"
simpleperf report -i "$PERF_ARTIFACT_DIR/simpleperf.data" --children \
  > "$PERF_ARTIFACT_DIR/simpleperf-children.txt"
simpleperf report -i "$PERF_ARTIFACT_DIR/simpleperf.data" \
  > "$PERF_ARTIFACT_DIR/simpleperf-self.txt"
```

High-frequency sampling can distort wall-clock and frame metrics. Do not use
the profiled run itself for TTI, P95 or jank acceptance.

## Startup entry-point regression

After onboarding is complete, test cold external and normal launches on the
same APK. Derive the final screen from the UI hierarchy:

```bash
adb -s "$PERF_SERIAL" shell am force-stop "$PERF_PACKAGE"
adb -s "$PERF_SERIAL" shell am start -W -a android.intent.action.VIEW \
  -d 'https://dream.noctalia.app/settings' "$PERF_PACKAGE"
adb -s "$PERF_SERIAL" exec-out uiautomator dump /dev/tty | \
  rg 'screen.settings'

adb -s "$PERF_SERIAL" shell am force-stop "$PERF_PACKAGE"
adb -s "$PERF_SERIAL" shell am start -W -a android.intent.action.VIEW \
  -d 'noctalia://journal?source=performance' "$PERF_PACKAGE"
adb -s "$PERF_SERIAL" exec-out uiautomator dump /dev/tty | \
  rg 'screen.journal'

adb -s "$PERF_SERIAL" shell am force-stop "$PERF_PACKAGE"
adb -s "$PERF_SERIAL" shell am start -W -n "$PERF_ACTIVITY"
adb -s "$PERF_SERIAL" exec-out uiautomator dump /dev/tty | \
  rg 'screen.recording'
```

Also exercise one genuine Expo notification response in both cold and warm
process states. `cmd notification post` does not reproduce the app payload or
Expo response callback and cannot close that gate.

Use the app's reminder settings to schedule the next notification, then prove
that AlarmManager owns an Expo request before waiting for it:

```bash
adb -s "$PERF_SERIAL" shell dumpsys alarm | \
  rg -C 4 'expo.modules.notifications.NOTIFICATION_EVENT'
```

For the warm case, keep the app process alive in the background. For the cold
case, press Home and use `am kill` while the package is backgrounded; do not
use `force-stop`, which places the package in a stopped state and invalidates
the alarm-response test. Confirm that the PID is absent, wait for the app-owned
notification, and derive its tap coordinates from the System UI hierarchy:

```bash
adb -s "$PERF_SERIAL" shell input keyevent 3
adb -s "$PERF_SERIAL" shell am kill "$PERF_PACKAGE"
adb -s "$PERF_SERIAL" shell pidof "$PERF_PACKAGE"
adb -s "$PERF_SERIAL" shell cmd statusbar expand-notifications
adb -s "$PERF_SERIAL" exec-out uiautomator dump /dev/tty | \
  rg 'Noctalia|Dream Journal Reminder|expandableNotificationRow'
```

The notification receiver can briefly recreate a background PID while posting.
Kill that receiver process once more while the notification remains visible,
then tap it. A passing cold response has all of these properties:

- PID absent immediately before the tap and a new PID afterward;
- final UI hierarchy contains `screen.recording`;
- the notification is auto-cancelled;
- exactly one `startup.navigation_replace ... reason=notification` and no
  second notification navigation marker;
- no target crash, ANR, Fabric, Reanimated or orphan-worklet signature.

## Memory loop

Record stabilized Release meminfo on intro, perform 10 intro ↔ path cycles,
return to intro, wait for idle, then record meminfo again. Compare TOTAL PSS,
native heap, Java heap, graphics, Views and Activities. Take HPROF/heapprofd
only for monotonic, reproducible growth; a single high PSS sample is not a leak.
Record each cycle as well as the final stabilized sample. A bounded
`am send-trim-memory <package> RUNNING_LOW` request can be recorded before the
final sample, but it does not replace the idle period and must be reported as
part of the conditions.

## Gates and report

- 0 `synchronouslyUpdateUIProps failed` and 0
  `RetryableMountingLayerException` across five cold starts;
- Release TTI at least 30% faster than its Release baseline;
- comparable janky-frame count at least 50% lower for both flows;
- physical 60 Hz transition P95 ≤32 ms and jank ≤5%;
- median `am start -W` regression ≤10%;
- stabilized PSS delta after 10 cycles ≤10%, without monotonic native growth;
- no crash, ANR, route, persistence, notification, deep-link or TalkBack
  regression.

The report must list build/device metadata, run count, median/P90/P95/P99,
janky frames, deadline misses, TTI markers, CPU by thread, stabilized memory,
artifact paths and environmental caveats. Keep debug/emulator, Release/emulator
and Release/physical conclusions separate.
