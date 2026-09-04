# Dreamer VNext TI-429 device harness

Executable matrix for TI-429. This file is a contract, not device proof.
Unexecuted automated rows stay **blocked**. Human rows stay **manual**.

## Runtimes

- `release-native`: installed base Release binary `com.tanuki75.noctalia` / scheme `noctalia`, current Motorola/device when authorized elsewhere and under the inter-app device lock (Dreamer/Lucid/Meditation : un seul proprietaire a la fois). Each proof records `binary_source` (local build vs Play) plus version/signature. That is local device proof, not Store, Play install-source or purchase proof. (Anterieur au 2026-09-04 : side-by-side `com.tanuki75.noctalia.qa` / `noctalia-qa` retire.)
- `mock-native`: mock fixtures. Failed analysis, quota and Plus/guest switching live here. They do not prove the installed Release binary.
- `manual`: TalkBack, contrast, large text, reduce motion, localization, mobile and tablet formats.
- `web`: applicable web format. Outside `:local`.

`npm run test:e2e:release:ti429:local` runs **only** the `release-ti429` suite. Every other automated row keeps the command written in the matrix.
Device commands run with no flag against the base package: defaults stay `com.tanuki75.noctalia` / `noctalia`.
Release YAML uses Maestro JS fallbacks (`${APP_ID || "com.tanuki75.noctalia"}`, `${DEEP_LINK_SCHEME || "noctalia"}://...`) so EAS can still execute `release-smoke.yml` without `-e`. The runner injects `APP_ID` / `DEEP_LINK_SCHEME` for the target package (historique : l'injection specifique QA est anterieure).

## Base binary (side-by-side QA : anterieur)

Build-only réellement supporté sur la base, jamais de second package QA :

```bash
npm run android:release:local -- --profile production-apk --abi arm64-v8a
```

Installation compatible bloquée : le script refuse l'install du package de base sur physique et la signature du build local debug est incompatible avec la base Play v57 prouvée ; ne jamais désinstaller ni effacer les données pour forcer. Accord piste interne pour une voie d'installation compatible demandé, pas obtenu. Do not run purchase or Test Store flows against a local binary. Auth-credential evidence stays separately blocked when credentials are missing.

Historique anterieur (ne plus utiliser) : side-by-side `com.tanuki75.noctalia.qa` / `noctalia-qa` avec `--side-by-side-qa`.

Exécutables après prérequis (binaire base compatible installé, verrou détenu, `--device <serial>`) :

```bash
npm run test:e2e:release:ti429:validate
npm run test:e2e:release:local -- --device <serial>
npm run test:e2e:release:ti429:local -- --device <serial>
node ./scripts/run-maestro-android.js --suite release --retries 0 --no-start-metro --device <serial> --flow maestro/release-auth-offline-sync.yml
node ./scripts/run-maestro-android.js --suite release --retries 0 --no-start-metro --device <serial> --flow maestro/release-notification-permission.yml
```

Gated (restent bloquées malgré le retrait du flag, ne pas exécuter sans déblocage explicite) :

```bash
npm run test:e2e:release:analysis:local -- --device <serial>
npm run test:e2e:release:voice-analysis:local -- --device <serial>
```

`analysis-success` reste `blocked` sans commande ; les rows voice-live TI-428 restent manuelles ou bloquées.

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
| Short fragment | release-native | automated | matrix command / `maestro/release-short-fragments.yml` |
| Long story >600 with sentinels | release-native | automated | `release-ti429` / `maestro/release-long-fragment.yml` |
| 10k paste | manual | manual | human paste |
| Offline local | release-native | automated | matrix command / `maestro/release-offline-local.yml` |
| Auth offline + sync | release-native | automated | matrix command / `maestro/release-auth-offline-sync.yml` |
| Analysis success | release-native | blocked | `maestro/release-analysis.yml`, sans commande (bloque, voir invité réel) |
| Analysis failed | mock-native | automated | `maestro/journal-dream-cta-labels.yml` |
| Analysis interrupted | release-native | automated | `release-ti429` / `maestro/release-analysis-interrupt.yml` |
| Analysis quota | mock-native | automated | `npm run test:e2e:quotas` |
| Independent image CTA after save | release-native | automated | `release-ti429` / `maestro/release-image-independent.yml` |
| Journal list / Trends / weekly-recap / recording links | release-native | automated | `release-ti429` / `maestro/release-journal-trends-deeplinks.yml` |
| analysis-ready `${DEEP_LINK_SCHEME || "noctalia"}://journal/{id}` | release-native | blocked | no flow: no stable fixture id; needs a real device id. Base scheme is local device proof only (anterieur : QA scheme) |
| Guest / free / Plus without purchase | mock-native | automated | `npm run test:e2e:subscription-qa` |
| Notifications | release-native | automated | matrix command / `maestro/release-notification-permission.yml` |
| TalkBack, contrast, large text, reduce motion | manual | manual | human device checks |
| Localization | manual | manual | FR/EN screenshots, unproven |
| Mobile / tablet / web formats | manual or web | manual | separate screenshots, unproven |

## Evidence

`npm run test:e2e:release:ti429:record` writes `maestro-results/android/ti429/<stamp>/{automated,manual,blocked}` plus `doc_web_interne/docs/android-ti429-evidence.local.json`. Le receipt initialise seulement un plan non exécuté : il ne contient ni `binary_source`, ni version, ni signature. Chaque preuve appareil collectée ensuite doit être accompagnée d'un relevé d'identité/signature (binaire local vs Play, version, signature) ; un sideload n'est jamais présumé integrity-valide par son package name.

A planned `blocked` row means the check has not been executed. It is not a pass, a fail, or Store/Linear proof.
