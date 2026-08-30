# Lucid HealthKit sleepAnalysis prototype

Isolated retrospective prototype for TI-408. It can import past `HKCategoryTypeIdentifierSleepAnalysis` samples on a Lucid companion **dev build**. It does not write Health data, detect REM in real time, or drive night cues, WBTB, or safety policy.

## Build constraints

- Required: native Lucid companion config (`NOCTALIA_APP_VARIANT=lucid` and `EXPO_PUBLIC_APP_VARIANT=lucid`).
- Not supported: Expo Go, Android runtime HealthKit, or product integration into trainer sync/export/cloud.
- Prototype recommendation: **GO** for isolated local import experiments.
- Product integration recommendation: **NO-GO** until real-device/source rows below are validated.

## Device and source matrix

| Source | Expected prototype behavior | Evidence |
| --- | --- | --- |
| 7-day window completeness | Native query uses HealthKit unbounded limit (`<= 0` → `HKObjectQueryNoLimit`); no silent 512-sample cap | Unit-tested local contract; real-device volume INDÉTERMINÉ |
| Manual iPhone Health sleep | Import past inBed/asleep/awake samples with source name/bundle | INDÉTERMINÉ — no real-device run in this slice |
| Apple Watch sleep | Import watch samples including core/deep/REM categories when present; treat REM as a stored category, never a live detector | INDÉTERMINÉ — no Watch run in this slice |
| Third-party sleep app writing to Health | Keep third-party source identity; surface coarse/mixed/unknown granularity honestly | INDÉTERMINÉ — no third-party source run |
| No data / access not granted | Empty query after explicit connect is `ambiguous_empty`; iOS cannot distinguish denial from no samples | Contract covered by unit tests; real prompt INDÉTERMINÉ |
| iOS Simulator | `isHealthDataAvailable` may be false or empty; never claim denial | INDÉTERMINÉ on this machine |
| Android / non-iOS | Adapter returns `unavailable` and never prompts | Unit-tested |

## Honesty rules

- Overlaps, contradictions, coarse `inBed`/`asleepUnspecified`, absent data, and malformed intervals are surfaced, not repaired.
- `asleepREM` is a retrospective Health category label, not a guarantee that a night cue hit REM.
- Deleting the local snapshot removes only the imported copy. HealthKit source data stays in Apple Health.
