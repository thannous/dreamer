# Dreamer VNext TI-429 device harness

Executable matrix for TI-429. This file is a contract, not device proof.
Unexecuted automated rows stay **blocked**. Human rows stay **manual**.

## Runtimes

- `release-native`: installed Release binary, current Motorola/device when authorized elsewhere. Physical QA proof uses the side-by-side package `com.tanuki75.noctalia.qa` and scheme `noctalia-qa`. That is local device proof, not Store, Play or production install-source proof.
- `mock-native`: mock fixtures. Failed analysis, quota and Plus/guest switching live here. They do not prove the installed Release binary.
- `manual`: TalkBack, contrast, large text, reduce motion, localization, mobile and tablet formats.
- `web`: applicable web format. Outside `:local`.

`npm run test:e2e:release:ti429:local` runs **only** the `release-ti429` suite. Every other automated row keeps the command written in the matrix.
Append `--side-by-side-qa` for the Motorola QA package. Production defaults stay `com.tanuki75.noctalia` / `noctalia` unless that flag is present.
Release YAML uses Maestro JS fallbacks (`${APP_ID || "com.tanuki75.noctalia"}`, `${DEEP_LINK_SCHEME || "noctalia"}://...`) so EAS can still execute `release-smoke.yml` without `-e`. The runner keeps injecting `APP_ID` / `DEEP_LINK_SCHEME` for QA.

## Side-by-side QA binary

Expected sibling build/install, never against Play:

```bash
npm run android:release:local -- --profile production-apk --device <serial> --side-by-side-qa --install
```

Never uninstall or overwrite the Play app. Do not run purchase or Test Store flows against the QA package. Auth-credential evidence stays separately blocked when credentials are missing.

Physical QA Maestro commands:

```bash
npm run test:e2e:release:ti429:validate
npm run test:e2e:release:local -- --device <serial> --side-by-side-qa
npm run test:e2e:release:analysis:local -- --device <serial> --side-by-side-qa
npm run test:e2e:release:voice-analysis:local -- --device <serial> --side-by-side-qa
npm run test:e2e:release:ti429:local -- --device <serial> --side-by-side-qa
node ./scripts/run-maestro-android.js --suite release --retries 0 --no-start-metro --device <serial> --side-by-side-qa --flow maestro/release-auth-offline-sync.yml
node ./scripts/run-maestro-android.js --suite release --retries 0 --no-start-metro --device <serial> --side-by-side-qa --flow maestro/release-notification-permission.yml
```

## Commands that never launch Maestro

```bash
npm run test:e2e:release:ti429:plan
npm run test:e2e:release:ti429:validate
npm run test:e2e:release:ti429:record
```

## Coverage

Machine-readable source: [`maestro/dreamer-vnext-ti429-matrix.json`](../../../maestro/dreamer-vnext-ti429-matrix.json).

| Criterion | Runtime | Mode | Source / command |
| --- | --- | --- | --- |
| Write <-> Tell | release-native | automated | `release-ti429` / `maestro/release-write-tell.yml` |
| Kill / relaunch draft | release-native | automated | `release-ti429` / `maestro/release-draft-kill-relaunch.yml` |
| Short fragment | release-native | automated | matrix command / `maestro/release-lifecycle.yml` |
| Long story >600 with sentinels | release-native | automated | `release-ti429` / `maestro/release-long-fragment.yml` |
| 10k paste | manual | manual | human paste |
| Offline local | release-native | automated | matrix command / `maestro/release-offline-local.yml` |
| Auth offline + sync | release-native | automated | matrix command / `maestro/release-auth-offline-sync.yml` |
| Analysis success | release-native | automated | `npm run test:e2e:release:analysis:local` |
| Analysis failed | mock-native | automated | `maestro/journal-dream-cta-labels.yml` |
| Analysis interrupted | release-native | automated | `release-ti429` / `maestro/release-analysis-interrupt.yml` |
| Analysis quota | mock-native | automated | `npm run test:e2e:quotas` |
| Independent image CTA after save | release-native | automated | `release-ti429` / `maestro/release-image-independent.yml` |
| Journal list / Trends / weekly-recap / recording links | release-native | automated | `release-ti429` / `maestro/release-journal-trends-deeplinks.yml` |
| analysis-ready `${DEEP_LINK_SCHEME || "noctalia"}://journal/{id}` | release-native | blocked | no flow: no stable fixture id; needs a real device id. QA scheme is local device proof only |
| Guest / free / Plus without purchase | mock-native | automated | `npm run test:e2e:subscription-qa` |
| Notifications | release-native | automated | matrix command / `maestro/release-notification-permission.yml` |
| TalkBack, contrast, large text, reduce motion | manual | manual | human device checks |
| Localization | manual | manual | FR/EN screenshots, unproven |
| Mobile / tablet / web formats | manual or web | manual | separate screenshots, unproven |

## Evidence

`npm run test:e2e:release:ti429:record` writes `maestro-results/android/ti429/<stamp>/{automated,manual,blocked}` plus `doc_web_interne/docs/android-ti429-evidence.local.json`.

A planned `blocked` row means the check has not been executed. It is not a pass, a fail, or Store/Linear proof.
