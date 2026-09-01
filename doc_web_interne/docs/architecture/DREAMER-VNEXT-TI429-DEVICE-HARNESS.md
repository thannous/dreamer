# Dreamer VNext TI-429 device harness

Executable matrix for TI-429. This file is a contract, not device proof.
Unexecuted automated rows stay **blocked**. Human rows stay **manual**.

## Runtimes

- `release-native`: installed Release binary, current Motorola/device when authorized elsewhere.
- `mock-native`: mock fixtures. Failed analysis, quota and Plus/guest switching live here. They do not prove the installed Release binary.
- `manual`: TalkBack, contrast, large text, reduce motion, localization, mobile and tablet formats.
- `web`: applicable web format. Outside `:local`.

`npm run test:e2e:release:ti429:local` runs **only** the `release-ti429` suite. Every other automated row keeps the command written in the matrix.

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
| analysis-ready `noctalia://journal/{id}` | release-native | blocked | no flow: no stable fixture id; needs a real device id |
| Guest / free / Plus without purchase | mock-native | automated | `npm run test:e2e:subscription-qa` |
| Notifications | release-native | automated | matrix command / `maestro/release-notification-permission.yml` |
| TalkBack, contrast, large text, reduce motion | manual | manual | human device checks |
| Localization | manual | manual | FR/EN screenshots, unproven |
| Mobile / tablet / web formats | manual or web | manual | separate screenshots, unproven |

## Evidence

`npm run test:e2e:release:ti429:record` writes `maestro-results/android/ti429/<stamp>/{automated,manual,blocked}` plus `doc_web_interne/docs/android-ti429-evidence.local.json`.

A planned `blocked` row means the check has not been executed. It is not a pass, a fail, or Store/Linear proof.
