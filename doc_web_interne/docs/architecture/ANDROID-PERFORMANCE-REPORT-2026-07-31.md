# Android performance report — startup and onboarding

Capture date: 2026-07-31; physical closure: 2026-08-01
Goal status: closure criteria met locally — implementation, exact-APK physical
60 Hz campaigns, Perfetto attribution, memory, routing, genuine Expo
notification, reduced-motion and TalkBack runtime checks are complete.
Scope: local Android performance only. No commit, push, EAS, OTA, Play or
deployment was performed.

## Executive result

The optimized implementation materially reduces the user-visible startup and
removes the measured Fabric/Reanimated failure:

- application startup TTI: approximately 3.6 s imposed by the old splash
  sequence → 634.6 ms median on the latest exact APK (-82.4%);
- full launcher command → interactive route: 1,078 ms median on that campaign;
- startup janky frames: 69 → 4 median (-94.2%);
- startup frame P95: 150 ms → 32 ms median (-78.7%);
- `synchronouslyUpdateUIProps failed`: 90 → 0 median, with 0/5 failures on the
  final five-start campaign;
- onboarding intro → path: 26.7 ms median press-to-render on the latest exact
  APK, with all five per-run gfx P95 values ≤32 ms; the emulator jank ratio is
  not accepted as physical proof because each run contains only 4–5 frames;
- physical onboarding intro → path: 23.3 ms median press-to-render, 16 ms
  median gfx P95 and one janky frame across 32 frames (3.13% aggregate), with
  the janky-frame count reduced 80% from the same-device pre-fix campaign;
- physical cold start: 631.8 ms median application TTI, 804 ms median
  `am start -W`, 1.08% median jank and 31 ms median gfx P95 across five `COLD`
  launches, all without a targeted runtime error;
- memory on the latest exact APK after 10 intro ↔ path cycles and stabilization:
  +1.49% TOTAL PSS and +2.14% native-heap PSS, below the 10% gate and not
  monotonically increasing;
- physical memory after ten cycles and stabilization: +2.17% TOTAL PSS and
  +0.41% native-heap PSS, with decreases inside the sample sequence;
- a non-debuggable, shell-profileable Release diagnostic captured startup and
  onboarding CPU by thread with zero lost Simpleperf samples;
- cold HTTPS and custom-scheme entry points now open `screen.settings` and
  `screen.journal` respectively, while a normal cold start still opens
  `screen.recording`.
- genuine app-scheduled Expo notifications open `screen.recording` in warm and
  killed-process states; the latest cold response reached interactive in
  408.7 ms from `startup.root_mounted`, with one notification navigation and no
  target error;
- denied notification permission is now exposed as a translated accessible
  alert, and a focused Release Maestro flow passes deny → allow → deny refresh.
- the exact final APK also passed a killed-process physical notification
  response: an app-owned Expo alarm posted the notification, the PID was
  absent immediately before the shade tap, one notification navigation reached
  the Capture screen, and the notification auto-cancelled.

The physical-device gate is claimed on a Motorola Edge 60 Fusion at 60 Hz. The
TalkBack service-bound focus/announcement order was verified structurally and
through runtime markers; no claim is made that a human auditor listened to the
spoken wording.

## Goal and acceptance contract

The active Codex goal requires:

1. five Release cold starts with no orphan worklet, synchronous prop update
   failure or `RetryableMountingLayerException`;
2. at least 30% faster application TTI and at least 50% fewer startup and
   transition janky frames under comparable conditions;
3. on a physical 60 Hz Android device, transition P95 ≤32 ms, jank ≤5% and
   feedback on the following frame;
4. TOTAL PSS delta ≤10% after ten stabilized cycles, without monotonic native
   growth;
5. no crash, ANR, route, persistence, notification, deep-link or TalkBack
   regression;
6. reproducible instrumentation, traces, tests and a local-only report.

No threshold may be weakened from emulator/debug evidence alone.

## Builds and environment

| Item | Baseline | Frame/memory campaign |
| --- | --- | --- |
| Git source | `d2d989031b5c4135fe432f3495b9c059ab51c092` | same HEAD plus the uncommitted, scoped performance diff |
| APK | historical local Release, SHA-256 prefix `7f3af578` | local Release, SHA-256 `4cbaad95fc629a4ad2061d819a98c46c21c4fa71a143135ec610170d9b88c101` |
| Package | `com.tanuki75.noctalia` | `com.tanuki75.noctalia` 3.0.2 (47) |
| Runtime | Android 16 / API 36 | Android 16 / API 36 |
| Device | Pixel 8 AVD profile, `sdk_gphone64_arm64` | same AVD, 1080×2400, 60 Hz |
| Animation scales | 1× for the standard startup comparison | 1× |
| Build mode | local Release | local Release, non-debuggable, tracing flag enabled |

Three additional Release diagnostics were built incrementally from the
already-generated Android project, without another `expo prebuild`:

- CPU capture APK: SHA-256
  `3f3c92d54b0df5645a81891deac328601ff695d8b932bbe51e966f90f79c7e19`;
- routing-proof APK: 122,404,419 bytes, SHA-256
  `60474e6772b0ccbed49bfe41686069aaea6ae627d125965f64c9b06f3c00e240`;
- latest notification-deduplication APK: SHA-256
  `8c82039a52b1362a2b790225d3035a9d83e23cc7c675e83be53aff1b10de6c0c`.

All diagnostics are production Release bundles with `android:debuggable=false` and
`<profileable android:enabled="true" android:shell="true"/>`. The installed
latest APK reports `com.tanuki75.noctalia` 3.0.2 (47); `run-as` rejects it as
"package not debuggable". Profileability is conditional and fails closed for
normal builds.

The latest canonical build completed 784 Gradle tasks in 7m03s. Repository
`HEAD` advanced concurrently through unrelated SEO-only commits while the
worktree app diff remained unchanged; the APK SHA-256 above is therefore the
authoritative binary identity for the notification campaign.

The same latest APK was then exercised for five killed-process starts. Its
archived installed binary is 122,413,567 bytes and re-hashes to
`8c82039a52b1362a2b790225d3035a9d83e23cc7c675e83be53aff1b10de6c0c`.
The capture used `emulator-5554`, Android 16/API 36, 1080×2400 at 60.000004 Hz,
animation scales 1×/1×/1× and five `LaunchState: COLD` runs. The capture source
HEAD was `a307aea9c167486a02c2d4b9688801bd8787b5ba`; later unrelated SEO commits
do not change the archived binary identity.

The AVD showed significant host scheduling and memory-pressure variance late
in the session. For that reason, the report separates stable application
markers from `ActivityTaskManager TotalTime`, and retains the earlier
representative untraced optimized campaign as supporting evidence.

## Measurement protocol

- Five killed-process starts per campaign: `am force-stop`, gfxinfo reset,
  logcat clear, `am start -W`, then capture after `startup.interactive`.
- The app data was cleared once before a first-run campaign, not between the
  five measured process starts.
- System animation scales remained at 1× for the standard comparison.
- `am start -S` diagnostics are explicitly excluded because the flag added a
  second package-stop wait to `TotalTime` on this AVD.
- Onboarding feedback is
  `onboarding.continue_pressed` → `onboarding.step_rendered`.
- Frame percentiles are the median of each run's gfxinfo percentile. Counts
  are medians across five runs.
- Cross-run P90/P95/P99 values use linear interpolation with
  `h = (n - 1) × p` (R-7). With five runs, these upper quantiles describe this
  sample and are not stable population estimates.

## Startup results

| Metric, five-run median | Baseline Release | Optimized core, representative | Final route gate, exact APK |
| --- | ---: | ---: | ---: |
| Application TTI | ≈3600 ms old UI lower bound | not in the untraced campaign | 648 ms |
| `am start -W` TotalTime | 1275 ms | 361 ms | 1219 ms |
| Frames rendered | 76 | 52 | 45 |
| Janky frames | 69 | 3 | 8 |
| Janky-frame rate | 89.74% | 5.77% | 17.78% |
| Frame P50 | 93 ms | 16 ms | 19 ms |
| Frame P90 | 150 ms | 17 ms | 44 ms |
| Frame P95 | 150 ms | 18 ms | 48 ms |
| Frame P99 | 300 ms | 65 ms | 81 ms |
| Synchronous UI-prop failures | 90 | 6 | 0 |
| Completely clean starts | 0/5 | 2/5 | 5/5 |

The frame-campaign application-marker values were 640.0, 646.9, 648.2, 656.2
and 805.3 ms. Relative to the old 2.8 s minimum plus 0.8 s outro, the median
is 82.0% faster; the fifth value records the remaining host-scheduling
variance on the AVD.

The conservative five-run startup comparison is still substantial:
40.8% fewer rendered frames, 88.4% fewer janky frames and a 68.0% lower P95.
`am start -W` improves 4.4%, so it has no >10% regression.

### Latest exact-APK five-start revalidation

This later campaign closes the binary-drift gap: it uses the latest
notification-deduplication APK itself, not the earlier route-gate APK.

Application TTI is `startup.root_mounted` → `startup.interactive`. Full launch
to interactive is the logcat wall-clock difference from
`ActivityTaskManager: START u0` to `startup.interactive`.

| Run | App TTI | Launch → interactive | `am start -W` | Frames | Janky | Gfx P50 / P90 / P95 / P99 | Deadline misses |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 639.6 ms | 1,274 ms | 703 ms | 99 | 5 (5.05%) | 18 / 28 / 40 / 150 ms | 5 |
| 2 | 634.6 ms | 1,078 ms | 493 ms | 112 | 4 (3.57%) | 18 / 25 / 31 / 36 ms | 4 |
| 3 | 634.2 ms | 1,017 ms | 423 ms | 110 | 4 (3.64%) | 23 / 30 / 32 / 38 ms | 4 |
| 4 | 633.6 ms | 1,033 ms | 447 ms | 112 | 2 (1.79%) | 18 / 22 / 26 / 38 ms | 2 |
| 5 | 652.5 ms | 1,291 ms | 747 ms | 107 | 6 (5.61%) | 23 / 29 / 38 / 73 ms | 6 |

| Cross-run scalar | Median | P90 | P95 | P99 |
| --- | ---: | ---: | ---: | ---: |
| Application TTI | 634.6 ms | 647.3 ms | 649.9 ms | 652.0 ms |
| Launch → interactive | 1,078 ms | 1,284.2 ms | 1,287.6 ms | 1,290.3 ms |
| `am start -W` | 493 ms | 729.4 ms | 738.2 ms | 745.2 ms |
| Janky-frame rate | 3.64% | 5.39% | 5.50% | 5.59% |
| Frames rendered | 110 | 112 | 112 | 112 |
| Deadline misses | 4 | 5.6 | 5.8 | 6.0 |

The median-of-run gfxinfo percentiles are P50 18 ms, P90 28 ms, P95 32 ms
and P99 38 ms. Relative to the historical Release campaign, janky-frame count
falls 94.2%, P95 falls 78.7%, and `am start -W` falls 61.3%. Relative to the
original debug/emulator P95 of 89 ms, the current 32 ms median is 64.0% lower.
The 3.6 s old custom-splash lower bound to current 634.6 ms app TTI is an 82.4%
reduction.

Every run contains exactly one `startup.navigation_replace ... reason=default`,
one `startup.interactive`, and one `startup.custom_splash_outro_started`.
Across all five complete logcats there are zero targeted
`synchronouslyUpdateUIProps failed`, `RetryableMountingLayerException`, orphan
worklet, Reanimated/Fabric failure, `FATAL EXCEPTION`, or app ANR signatures.
Benign `libworklets.so` loading lines are excluded from the error definition.

The per-run UI-hierarchy pulls failed, so these exact five timing files do not
by themselves prove the final route visibly contained `screen.recording`.
That gap was recaptured separately on 2026-08-01 with the same installed APK:
the durable post-`SKIP` hierarchy contains `screen.recording`, five subsequent
killed-process launches each emit one `reason=default` route and one interactive
marker, and a native run-5 screenshot visibly shows the Capture screen. During
those cold route-only launches, `uiautomator dump` reported `could not get idle
state`; the report therefore keeps the successful hierarchy, cold markers and
screenshot as separate complementary evidence rather than claiming five cold
hierarchies. `startup.interactive` is emitted only by
`handleSplashFinished`; its one-per-run count is therefore the runtime
completion-callback count. Deterministic tests also invoke the animation
completion twice and assert that the public callback runs once.

## Profileable CPU attribution

The startup capture used Simpleperf `cpu-clock` at 4 kHz with call graphs for
15 seconds. It produced 19,975 samples, 1,236 truncated stacks and zero lost
samples. Across 4,993.75 ms of sampled CPU events, the leading threads were:

| Thread | Share | Sampled CPU |
| --- | ---: | ---: |
| Main `com.tanuki75.noctalia` | 26.89% | 1,342.75 ms |
| Hermes JS `mqt_v_js` | 26.71% | 1,333.75 ms |
| `HeapTaskDaemon` | 9.51% | 475.00 ms |
| `RenderThread` | 9.03% | 450.75 ms |
| `pool-5-thread-1` | 7.00% | 349.50 ms |
| `DefaultDispatch` | 5.99% | 299.00 ms |
| profile installer pool | 3.47% | 173.50 ms |

`MainApplication.onCreate` and `MainActivity.onCreate` account for 3.58% and
3.13% inclusive respectively. Hermes and R8 prevent reliable TypeScript-level
symbol attribution, so this trace does not justify naming an app-owned
function as the dominant hotspot.

The onboarding transition capture produced 874 samples and zero lost samples.
Of 218.5 ms sampled CPU, the main thread used 67.39% (147.25 ms) and Hermes JS
30.21% (66.0 ms); Worklets frame functions were approximately 5.5 ms inclusive
and were not dominant. Its instrumented press-to-render marker was 58.1 ms and
persistence finished 100.7 ms after press.

These captures are attribution evidence only. The 4 kHz profiler materially
distorted wall-clock and gfx timing: profiled cold `am start -W` reached
3,793 ms and the four-frame transition reported a 77 ms P95. Neither value is
used for a user-facing timing gate.

## Onboarding transition

| Metric, five-run median | Baseline | Optimized representative | Frame campaign |
| --- | ---: | ---: | ---: |
| Press → path rendered | not instrumented | 20.0 ms | 33.0 ms |
| Frames rendered | 4 | 3 | 3 |
| Janky frames | 3 | 2 | 3 |
| Frame P50 | 18 ms | 17 ms | 27 ms |
| Frame P90 / P95 / P99 | 36 / 36 / 36 ms | 17 / 17 / 17 ms | 29 / 29 / 29 ms |
| Reanimated/Fabric errors | not isolated | 0 | 0 |

The representative optimized P95 improves 52.8%. The frame-campaign feedback
samples were 30.5, 31.7, 33.0, 33.3 and 76.5 ms. Only three frames are emitted
per transition, so gfxinfo labels all three janky on this AVD even when their
P95 is 29–30 ms. That percentage is statistically unsuitable for closing the
≤5% physical gate.

### Latest exact-APK five-transition revalidation

The latest APK was reinstalled with data preservation and exercised through
five independent `force-stop` → onboarding intro → `Start` → path runs. Each
run captured and successfully asserted both the intro and path native
hierarchies.

| Run | Press → rendered | Press → focus | Persistence finished | Frames | Janky | Gfx P50 / P90 / P95 / P99 | Deadline misses |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 30.1 ms | 30.6 ms | 34.6 ms | 5 | 3 (60%) | 18 / 32 / 32 / 32 ms | 3 |
| 2 | 22.0 ms | 23.7 ms | 17.5 ms | 4 | 2 (50%) | 17 / 18 / 18 / 18 ms | 2 |
| 3 | 22.0 ms | 22.1 ms | 12.8 ms | 4 | 2 (50%) | 17 / 17 / 17 / 17 ms | 2 |
| 4 | 26.7 ms | 26.9 ms | 15.0 ms | 4 | 2 (50%) | 22 / 22 / 22 / 22 ms | 2 |
| 5 | 37.9 ms | 38.0 ms | 26.6 ms | 4 | 3 (75%) | 19 / 32 / 32 / 32 ms | 3 |

| Cross-run scalar | Median | P90 | P95 | P99 |
| --- | ---: | ---: | ---: | ---: |
| Press → rendered | 26.7 ms | 34.8 ms | 36.3 ms | 37.6 ms |
| Press → accessibility focus | 26.9 ms | 35.0 ms | 36.5 ms | 37.7 ms |
| Press → persistence finished | 17.5 ms | 31.4 ms | 33.0 ms | 34.3 ms |
| Janky-frame rate | 50% | 69% | 72% | 74.4% |
| Per-run gfx P95 | 22 ms | 32 ms | 32 ms | 32 ms |
| Deadline misses | 2 | 3 | 3 | 3 |

The UI is optimistic in all five runs and persistence can finish either before
or after the rendered marker without blocking it. The per-run gfx P95 meets
32 ms in all five emulator runs. The jank percentage cannot close the ≤5% gate:
with only four or five rendered frames, each janky frame changes the ratio by
20–25 percentage points. Zero targeted Fabric/Reanimated/worklet, crash or app
ANR signature was found.

## Memory

Frame/memory campaign Release, after idle:

| Sample | TOTAL PSS | TOTAL RSS |
| --- | ---: | ---: |
| Before 10 intro ↔ path cycles | 239,029 KB | 310,564 KB |
| After 10 cycles + 5 s idle | 255,683 KB | 327,852 KB |
| Delta | +16,654 KB (+6.97%) | +17,288 KB (+5.57%) |

A second ten-cycle sequence sampled TOTAL PSS after every cycle:
251,274; 251,187; 251,434; 251,179; 251,448; 251,759; 251,887;
252,441; 252,649; 252,592 KB. The sequence stays within a 1.5 MB band and
finishes 0.52% above its first sample; no reproducible monotonic leak signal
justified HPROF or heapprofd capture.

The same ten-cycle check was repeated on the latest exact APK. TOTAL PSS moved
from 235,830 KB to 239,342 KB after idle, a `RUNNING_LOW` trim request and final
stabilization: +3,512 KB (+1.49%). Native-heap PSS moved from 116,933 KB to
119,437 KB: +2,504 KB (+2.14%). Native PSS decreased at cycles 4, 8 and 9 and
again after stabilization, so the sequence is not monotonic. The final native
hierarchy is back on onboarding intro, with ten path-render markers and no
targeted error signature.

## Physical 60 Hz closure — exact final APK

### Device, binary and controls

| Item | Value |
| --- | --- |
| Device | Motorola Edge 60 Fusion, physical Wi-Fi ADB target |
| OS / ABI | Android 16, API 36, `arm64-v8a` |
| Display | 1220×2712, 450 dpi, 60.000004 Hz |
| Package | `com.tanuki75.noctalia` 3.0.2 (47) |
| APK | 122,417,167 bytes, SHA-256 `6e6c8a66d151617c2bb3d413ce9f6402d1a2a0b215a6c05069210071dca63fb0` |
| Build properties | production Release, non-debuggable, shell-profileable |
| Source | `de37a89d8b5f2687efbf99722ee083306ec8b2f3` plus the preserved local performance diff |
| Thermal | status 0 in every measured run |
| Standard animations | window 1×, transition 1×, animator value unset; restored after reduced-motion test |

The installed package APK was pulled back from the phone and re-hashed to the
same SHA-256. The canonical local build completed 784 Gradle tasks in 5m44s.
The immediately preceding same-device binary, used as the transition baseline,
had SHA-256
`8c82039a52b1362a2b790225d3035a9d83e23cc7c675e83be53aff1b10de6c0c`.

### Five physical cold starts

Each run was a killed-process `LaunchState: COLD` launch. The intro and hidden
path/back state were asserted in the native hierarchy. Each logcat contained
exactly one `startup.interactive` marker and zero targeted crash, ANR,
Fabric, Reanimated or orphan-worklet signature.

| Run | App TTI | `am start -W` | Frames | Janky | Gfx P50 / P90 / P95 / P99 | Deadline misses | TOTAL PSS |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 631.8 ms | 1,007 ms | 91 | 1 (1.10%) | 9 / 19 / 31 / 53 ms | 1 | 310,204 KB |
| 2 | 631.7 ms | 817 ms | 93 | 1 (1.08%) | 9 / 19 / 29 / 38 ms | 1 | 304,472 KB |
| 3 | 648.1 ms | 804 ms | 93 | 1 (1.08%) | 9 / 26 / 34 / 44 ms | 1 | 304,730 KB |
| 4 | 629.6 ms | 773 ms | 91 | 1 (1.10%) | 9 / 28 / 31 / 42 ms | 1 | 305,272 KB |
| 5 | 648.1 ms | 789 ms | 93 | 1 (1.08%) | 9 / 20 / 28 / 40 ms | 1 | 305,167 KB |

| Cross-run scalar | Median | P90 | P95 | P99 |
| --- | ---: | ---: | ---: | ---: |
| Application TTI | 631.8 ms | 648.1 ms | 648.1 ms | 648.1 ms |
| `am start -W` | 804 ms | 931 ms | 969 ms | 999.4 ms |
| Janky-frame rate | 1.08% | 1.10% | 1.10% | 1.10% |
| TOTAL PSS | 305,167 KB | 308,231 KB | 309,218 KB | 310,007 KB |

The median-of-run gfx percentiles are P50 9 ms, P90 20 ms, P95 31 ms and
P99 42 ms. Against the immediately preceding physical build, application TTI
improves 2.2%, `am start -W` improves 10.9% and P95 improves 3.1%, with no
startup regression from the onboarding-only fix. Against the historical old
splash sequence, application TTI is approximately 82.4% lower; the historical
69 median janky frames fall to one.

### Five physical intro → path transitions

Both intro and path native hierarchies were asserted on every fresh-process
run, as was the return to intro. Each transition emitted exactly one rendered
and one accessibility-focus marker, with zero targeted runtime error.

| Run | Press → rendered | Press → focus | Persistence | Frames | Janky | Gfx P50 / P90 / P95 / P99 | Deadline misses |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 23.3 ms | 23.5 ms | 16.3 ms | 6 | 1 (16.67%) | 5 / 16 / 16 / 16 ms | 1 |
| 2 | 22.6 ms | 22.9 ms | 40.9 ms | 6 | 0 | 5 / 15 / 15 / 15 ms | 0 |
| 3 | 23.3 ms | 23.5 ms | 41.0 ms | 8 | 0 | 5 / 16 / 16 / 16 ms | 0 |
| 4 | 22.7 ms | 23.0 ms | 41.1 ms | 6 | 0 | 5 / 15 / 15 / 15 ms | 0 |
| 5 | 23.3 ms | 23.6 ms | 46.0 ms | 6 | 0 | 5 / 16 / 16 / 16 ms | 0 |

The five-run median is 23.3 ms press→render, 23.5 ms press→focus and 41.0 ms
for non-blocking persistence. The median per-run gfx P95 is 16 ms. Four runs
have no jank or deadline miss; the aggregate is one janky frame across 32
rendered frames (3.125%). The same-device pre-fix campaign had five janky
frames across 50 frames, so the count falls 80%; median press→render improves
29.5→23.3 ms (-21.0%) and median P95 improves 22→16 ms (-27.3%).

### Physical Perfetto attribution

The focused final trace contains one instrumented partial deadline miss:

- actual frame: 17.371 ms, `Late Present`, partial `App Deadline Missed`;
- main-thread `Choreographer#doFrame`: 13.478 ms;
- animation 9.654 ms, traversal 3.773 ms and draw 3.603 ms;
- the next two frames are on time at 4.513 and 4.213 ms.

The pre-fix trace contained a 30.172 ms full deadline miss, a 26.470 ms main
`doFrame` and a 22.741 ms `MountItemDispatcher::mountViews` subtree. The exact
final trace therefore reduces actual-frame time 42.4%, main `doFrame` 49.1%,
eliminates the full Fabric remount subtree and reduces severity from full to
partial. The untraced five-run aggregate remains the acceptance authority,
because tracing itself perturbs frame timing.

### Physical memory, accessibility and reduced motion

Stabilized TOTAL PSS moved from 284,652 KB to 290,819 KB after ten intro ↔
path cycles, five seconds idle, a recorded `RUNNING_LOW` trim and another
three seconds idle: +6,167 KB (+2.17%). Native-heap PSS moved from 129,244 KB
to 129,772 KB: +528 KB (+0.41%). The ten intermediate TOTAL/native samples
were 289,576/129,084; 289,808/129,176; 289,852/129,188;
289,890/129,196; 290,170/129,444; 290,761/129,636;
290,790/129,644; 290,860/129,676; 290,786/129,560; and
291,033/129,768 KB. Both series contain decreases, so there is no monotonic
growth signal.

TalkBack was genuinely bound. A single tap focused the CTA and a TalkBack
double tap activated it; the path hierarchy became visible, intro descendants
were hidden and the back control was present. `onboarding.step_rendered` was
followed by `onboarding.accessibility_focus` 0.4 ms later. TalkBack's initial
service/accessibility/touch-exploration settings were restored exactly after
the run. This proves focus-tree and runtime announcement order, but not the
subjective quality of spoken audio.

With all animation scales temporarily set to zero, intro→path still produced
the correct hierarchy and ordered render/focus markers with zero targeted
error. The run had six frames, one janky frame and 17 ms gfx P95. The original
1×/1×/unset scale state was restored.

### Physical routes and genuine notification

- after durable onboarding skip, the native hierarchy contained
  `screen.recording`;
- cold HTTPS `https://dream.noctalia.app/settings` opened `screen.settings` in
  839 ms by `am start -W`;
- cold `noctalia://journal?source=performance` opened `screen.journal` in
  840 ms;
- a subsequent normal cold launch took 826 ms and the native screenshot
  visibly shows the Capture screen. `uiautomator` repeatedly reported
  `ERROR: could not get idle state` on that continuously updating screen, so
  the screenshot, earlier durable `screen.recording` hierarchy and cold route
  markers remain separate evidence layers.

For the notification response, the UI set a weekday reminder after granting
Android notification permission. AlarmManager exposed the exact Noctalia
`RTC_WAKEUP` with tag
`expo.modules.notifications.NOTIFICATION_EVENT`; Android posted `Dream Journal
Reminder` at the end of its non-exact delivery window. After the receiver PID
was killed again, the PID was absent immediately before the System UI shade
tap and became `18294` afterward. The final screenshot visibly shows Capture,
the notification auto-cancelled, and logcat contains exactly one
`startup.notification_navigation_coalesced`, one
`startup.navigation_replace ... reason=notification` and one
`startup.interactive`. Root-mounted→interactive was 631.8 ms. There was no
targeted error. The reminder, time, permission, timezone and automatic-timezone
states were restored to their exact initial values after the test.

## Implemented solution

### Splash and worklet lifecycle

- Android now renders a branded static splash with no Reanimated subtree;
  reduced-motion and failsafe paths are also static.
- iOS keeps the animated treatment but cancels phase, float, particles and
  container work before unmount, with a once-only completion callback.
- Minimum display time is 600 ms, outro 250 ms, and particles are reduced to
  12 instead of the old 2.8 s + 0.8 s / 30-particle sequence.

### Startup critical path

- Only auth, onboarding state and notification routing remain blocking.
- Guest-session initialization, quota migrations, Google Sign-In setup,
  analytics and subscription work move behind the committed route and idle
  boundary.
- Deferred imports and lazy static-string module loads break the
  auth/mock/quota/guest/http startup import cycle while remaining Jest-safe.
- Route, native-splash, language, outro and interactive markers can be enabled
  without recording user data.

### Transient route isolation

- Expo Router must keep `(tabs)` as the root anchor for existing navigation
  semantics.
- `StartupRouteProvider` keeps that transient tab route on a static placeholder
  until a real `(tabs)` destination is committed.
- The guarded startup transition is disabled behind the custom splash, while
  later navigation retains normal platform animations.
- This prevents home-card Moti worklets from targeting Fabric views after the
  startup redirect detaches them. It is the change that moved the final gate
  from intermittent six-tag failures to 5/5 clean starts.

### Onboarding response and durability

- `GO_TO_STEP` and `SELECT_PATH` update React state optimistically, then write
  through a serialized persistence lock.
- Failed persistence rolls back only the still-current optimistic mutation;
  stale completions cannot overwrite newer choices.
- `COMPLETE` and `SKIP` remain durable before navigation.
- Rapid duplicate step/completion presses are ignored.
- Background assets are preloaded, Android image fade is zero, the privacy
  sheet mounts on demand, and analytics work is deferred.
- On Android, intro and path content remain mounted in absolute layers with a
  reserved maximum height; opacity, pointer-event and accessibility-tree state
  select the visible layer without a Fabric remount or layout shift.
- The back control and both CTA label/icon groups are also preloaded and swap
  visibility instead of mounting during the transition.
- Accessibility focus is deferred to the next animation frame and applied once
  per step; hidden descendants use `no-hide-descendants` semantics.

### Startup entry-point correctness

- Startup waits for `Linking.getInitialURL()` before choosing the default
  destination.
- Only the trusted `noctalia:` scheme and HTTPS host `dream.noctalia.app` can
  produce an explicit startup route; unsupported or hostile URLs fall back to
  the normal destination.
- Incomplete onboarding still takes priority over an external route.
- A cold HTTPS `/settings` launch ended on `screen.settings`; a cold
  `noctalia://journal?source=performance` launch ended on `screen.journal`.
- A subsequent normal cold launch ended on `screen.recording` in 679 ms by
  `am start -W`, proving that external-route handling did not replace the
  standard destination.
- Completing/skipping onboarding remained durable across force-stop and
  restart.

### Notification response and permission status

- The settings notification card renders the existing translated permission
  warning as a polite accessibility alert only after loading has completed and
  native permission is denied.
- A bounded response tracker claims an Expo notification identifier before the
  async persistence write. The cold-start lookup and live listener therefore
  cannot persist the same native response twice; failed writes release the
  identifier for a valid retry.
- A synchronous navigation claim coalesces the React startup-effect race that
  previously emitted `navigation_replace` followed by `navigation_reused` for
  one tap. The latest cold run emits
  `startup.notification_navigation_coalesced` and exactly one
  `startup.navigation_replace ... reason=notification`.
- The latest cold proof used the app's own `scheduleNotificationAsync` alarm,
  exposed by AlarmManager as
  `expo.modules.notifications.NOTIFICATION_EVENT`; it was not created with
  `cmd notification post`. The PID was absent before the shade tap, changed to
  `15758` afterward, the final hierarchy contained `screen.recording`, and the
  notification auto-cancelled.

## Validation

- Exact final local profileable Release build: passed, 784 tasks in 5m44s;
  installed/pulled SHA-256 matched
  `6e6c8a66d151617c2bb3d413ce9f6402d1a2a0b215a6c05069210071dca63fb0`.
- Final focused onboarding Jest validation: 11/11 tests passed;
  `typecheck:app`, `typecheck:tests`, scoped Expo lint and scoped diff check
  passed.
- Physical startup: 5/5 `COLD`, median TTI 631.8 ms, median gfx P95 31 ms,
  median jank 1.08%, zero targeted errors.
- Physical onboarding: 5/5 intro/path/return hierarchies passed, 23.3 ms median
  press→render, 16 ms median gfx P95, 3.125% aggregate jank, one aggregate
  deadline miss and zero targeted errors.
- Physical memory: +2.17% stabilized TOTAL PSS, +0.41% native heap, no
  monotonic growth.
- Physical TalkBack, reduced motion, HTTPS/custom/normal routes and genuine
  killed-process Expo notification response: passed with the limitations stated
  in the physical closure section.
- Latest local profileable Release build: passed, 784 tasks in 7m03s.
- Five final route-gate cold-start logcats: 0/5 errors, no orphan worklet
  signature.
- Five starts on the latest exact APK: all `COLD`, one default navigation and
  one interactive marker per run, 0/5 targeted Fabric/Reanimated/worklet,
  crash or ANR signatures; median app TTI 634.6 ms, `am start -W` 493 ms,
  jank 3.64% and gfx P95 32 ms. The timing campaign's hierarchy files are
  missing, but the same exact APK now has a separate durable
  `screen.recording` hierarchy, five cold default-route/interactive marker
  pairs and a native Capture-screen screenshot.
- Latest exact-APK onboarding: 5/5 fresh processes successfully asserted the
  intro and path hierarchies; median press→render 26.7 ms, median per-run gfx P95 22 ms, all
  per-run gfx P95 values ≤32 ms, and zero targeted runtime errors. Its 4–5-frame
  emulator jank percentage is explicitly not used to close the physical gate.
- Latest exact-APK memory: +1.49% stabilized TOTAL PSS and +2.14%
  native-heap PSS after ten cycles, without monotonic native growth.
- Maestro `release-smoke.yml`: passed onboarding → recording → journal search
  → recording on `com.tanuki75.noctalia` 3.0.2 (47).
- Focused Release notification-permission Maestro flow: passed in one attempt,
  including denied warning, allowed refresh, deterministic re-denial and final
  permission restoration.
- The combined `release-permissions.yml` notification and denied-microphone
  phases pass, but that broader flow still stops later on its separate offline
  voice-outcome assertion. It is not counted as a full combined-flow pass.
- Related Jest: 87 suites, 820/820 tests passed. A narrower notification/settings
  run passed 12/12. Coverage includes splash
  lifecycle/callback, ordered persistence, rollback, duplicate taps, route
  reuse/gating, trusted initial-URL parsing, notification response deduplication,
  permission status, build-mode fail-closed behavior, accessibility focus and
  the deferred mock-auth dependencies.
- `typecheck:app` and `typecheck:tests`: passed.
- Scoped Expo lint: 0 errors, 4 existing `set-state-in-effect` warnings.
- Vitest performance suite: 6 files, 6/6 tests passed.
- Scoped `git diff --check` on the onboarding implementation, test IDs, focused
  route test and this report: passed. The whole-worktree check currently stops
  on pre-existing/concurrent CRLF whitespace in `lib/locale.ts`; that unrelated
  file was deliberately left untouched.
- Latest native entry-point checks: HTTPS settings, custom-scheme journal and
  normal launcher all passed on the same profileable APK; no targeted crash,
  Fabric or Reanimated error was observed.
- Genuine Expo notification checks: warm and cold response passed. The latest
  deduplicated cold run had one navigation, 408.7 ms root→interactive, no
  active notification after tap and no targeted crash/ANR/Fabric/Reanimated
  signature.

## Artifacts

- Complete physical closure root:
  `/private/tmp/noctalia-android-perf-physical.22brxf/`
- Exact final physical cold starts and onboarding transitions:
  `closure-physical-cold/` and `closure-physical-onboarding/` under that root.
- Final physical Perfetto trace:
  `closure-transition-perfetto/noctalia-closure-transition.pftrace`, SHA-256
  `b1e2bfe9f09699e105d32d540325f338b27ae6486c363b66841e82c2396e65a9`.
- Physical memory, TalkBack, reduced-motion, entry-point and notification
  evidence: `closure-memory/`, `closure-talkback/`,
  `closure-reduced-motion/`, `closure-entrypoints/` and
  `closure-notification/` under the same root.
- Exact final APK:
  `/Users/tanuki/Documents/dreamer/dist/android/production-apk-profileable-release.apk`.
- Historical Release baseline:
  `/private/tmp/noctalia-android-perf-before-release.oyZk1N/`
- Optimized core measurements and initial after traces:
  `/private/tmp/noctalia-android-perf-after.aPpu7r/`
- Five-run route-gated frame/memory APK, campaigns and traces:
  `/private/tmp/noctalia-android-perf-final-navigation/`
- Final APK:
  `/private/tmp/noctalia-android-perf-final-navigation/noctalia-final-source-release.apk`
- Final Perfetto startup trace:
  `/private/tmp/noctalia-android-perf-final-navigation/noctalia-final-source-startup-20260731.pftrace`
- Final Perfetto transition trace:
  `/private/tmp/noctalia-android-perf-final-navigation/noctalia-final-source-transition-20260731.pftrace`
- Profileable build, CPU reports, session restart and native entry-point proof:
  `/private/tmp/noctalia-android-perf-profileable.LP8n0x/`
- Initial genuine warm/cold notification proof in that directory:
  `notification-shade-warm.xml`, `notification-response-warm.xml`,
  `notification-shade-cold.xml` and `notification-response-cold.xml`.
- Startup Simpleperf data and reports:
  `/private/tmp/noctalia-android-perf-profileable.LP8n0x/startup-perf.data`,
  `simpleperf-self.txt`, `simpleperf-children.txt`, `simpleperf.csv` and
  `simpleperf-threads.csv`
- Transition Simpleperf data and reports:
  `/private/tmp/noctalia-android-perf-profileable.LP8n0x/transition/`
- Routing-proof profileable APK:
  `/private/tmp/noctalia-android-perf-profileable.LP8n0x/noctalia-profileable-deeplink-fix-v2.apk`
- Native UI evidence:
  `deep-link-fixed-v2.xml`, `custom-link-fixed-v2.xml` and
  `launcher-regression-v2.xml` in the same profileable artifact directory.
- Latest notification-deduplication build and cold native proof:
  `/private/tmp/noctalia-android-perf-notification-dedupe.n3W4hU/`
- Key notification artifacts: `noctalia-profileable-notification-dedupe.apk`,
  `cold-notification-summary.txt`, `notification-shade-cold-dedupe.xml`,
  `notification-response-cold-dedupe.xml`,
  `notification-response-cold-dedupe.png` and
  `notification-cold-dedupe.log`.
- Latest exact-APK five-cold-start campaign and calculated summary:
  originally captured under
  `/private/tmp/noctalia-android-perf-current-five-cold.FEfgfM/`. macOS removed
  those earlier raw temporary files before the final audit; the per-run table,
  distributions, binary identity and error audit above are the surviving
  compact record.
- Latest exact-APK onboarding, ten-cycle memory and durable-route recapture:
  `/private/tmp/noctalia-android-perf-current-five-cold.FEfgfM/current-exact-onboarding-20260801/`
  and its `summary.md`. The surviving route evidence includes five cold logcats
  and `route-proof/five-cold-recording/run-5-screen.png`. The intro/path,
  ten-cycle memory and post-`SKIP` hierarchy files were successfully inspected
  before the same temporary-storage cleanup and are preserved as measured
  tables in the summary and this report, not as currently available raw files.
- The exact final installable APK also exists in the generated local Android
  output at
  `/Users/tanuki/Documents/dreamer/android/app/build/outputs/apk/release/app-release.apk`:
  122,417,167 bytes, SHA-256
  `6e6c8a66d151617c2bb3d413ce9f6402d1a2a0b215a6c05069210071dca63fb0`,
  package 3.0.2 (47), non-debuggable and shell-profileable. This generated
  output is ignored and mutable; re-hash it immediately before installation.

These `/private/tmp` artifacts are local and may be removed by the operating
system. At the final 2026-08-01 audit, the older campaign directories had
already been purged. The runbook preserves the reproduction procedure and this
report preserves the verified measurements, limitations and binary hashes.

## Closure verdict

All quantitative gates are met locally on the physical 60 Hz build: startup
and transition improvement, transition P95, aggregate jank, startup
`am start -W`, stabilized memory and zero targeted runtime errors. Routing,
persistence, reduced motion, service-bound TalkBack order and genuine Expo
notification response also pass. The only explicit evidence limitation is
that TalkBack speech was not subjectively listened to by a human; the bound
service, accessibility tree, activation semantics and render→focus order were
verified. No release or publication action is implied by this verdict.
