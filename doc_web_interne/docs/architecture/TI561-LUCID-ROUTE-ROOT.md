# TI-561 — Lucid route root boundary

Candidate based on `3cf6` on 2026-09-09. Source implementation and local Android JavaScript export proof; no native build, install, device startup timing, store delivery or production claim.

## Decision and compatibility

Journal keeps `app/` and the existing root layout. Lucid selects the installed Expo Router plugin's `root: './routes/lucid'`. Explicit adapters retain every existing `app/lucid/**` screen under its `/lucid` URL, along with password recovery, both auth callbacks and the web HTML document. The Lucid entry redirects `/` to `/lucid`. Screen implementations remain shared; this is route-context separation, not a package migration or a second implementation of product screens.

The custom root option is supported by the installed plugin and [Expo Router's reference](https://docs.expo.dev/versions/latest/sdk/router/), but Expo [discourages custom route directories](https://docs.expo.dev/router/reference/src-directory/). We accept this bounded tradeoff to avoid moving Journal routes or duplicating the Lucid screen tree. Router upgrades must requalify context resolution, deep links and alternating product exports. No `EXPO_ROUTER_APP_ROOT` override, patched Router dependency or CI configuration is introduced.

Lucid retains font loading, native/custom splash and Android paint gates, reduced-motion behavior, language/theme/auth providers, shared subscription compatibility, keyboard and system bars, and deferred Google initialization. The existing LanguageProvider owns preference loading; startup waits at most 750 ms for it and 1500 ms for translations, as before. It mounts no Journal DreamsProvider, Journal onboarding provider, release-note host, Journal analytics or Journal bootstrap actions. The nested existing Lucid layout owns its onboarding guard. Auth callbacks now accept a typed destination prop whose default remains `/recording`; Lucid adapters explicitly choose `/lucid`. Password recovery already selects destinations by variant.

Notification targets use the existing Lucid allowlist and bounded response tracker. Navigation waits for auth/root readiness, preserves trusted Lucid links and auth parameters, recognizes protected onboarding and completed callback redirects, and consumes a notification after the winning route or its onboarding guard is observed. Parameter-only replacement has an explicit engaged state so it can commit without a pathname change. Journal notification targets are rejected. This is not new interapp authentication or scoped-token rollout.

## Verification

- App and test TypeScript checks pass.
- 24 focused tests in four suites pass: product config, pure launch URLs, real root composition and actual shared callback/adapters. Includes guest/signed-in composition, slow preference read fallback, rejected Journal notifications, duplicate delivery, deferred intent while auth loads, protected onboarding, and same-path auth parameters committing startup.
- Focused lint: zero errors; four existing-style `react-hooks/set-state-in-effect` warnings in the new root's explicit bootstrap/navigation state transitions. No lint suppression added.
- `git diff --check` passes.
- Filtered public config confirms Lucid Android/iOS `com.tanuki75.noctalia.lucid`, scheme `noctalia-lucid`, and the dedicated Router root. No identity or version change.

Production Android JS export command (no Hermes bytecode):

```sh
EXPO_NO_DOTENV=1 CI=1 NOCTALIA_APP_VARIANT=<noctalia|lucid> EXPO_PUBLIC_APP_VARIANT=<noctalia|lucid-trainer> \
  node node_modules/expo/bin/cli export --platform android --no-bytecode --source-maps --max-workers 2 --output-dir <isolated-output>
```

Dependency lock parity was checked before symlinking the already-installed root dependencies. The first exploratory Journal export exposed a shared-dependency transform cache referencing an older inventory archive. Those results are excluded. The accepted sequence starts with `--clear` on Journal, then Lucid and Journal again **without another cache clear**. All three exit 0, contain no prior archive paths, and the repeated Journal bundle is byte-identical.

| Candidate export | Entry JS bytes | Source-map entries | Existing `app/` source routes | Root `app/_layout.tsx` |
| --- | ---: | ---: | ---: | --- |
| Journal first | 11,277,927 | 3,475 | 55 | Present |
| Lucid | 7,472,893 | 2,800 | 31 | Absent |
| Journal repeat | 11,277,927 | 3,475 | 55 | Present |

Journal SHA256: `eeef56a4ed3f9c8a0632694d61a68919244a529fe6ba3b0ea655d9bdeff78ad9`.
Lucid SHA256: `39e0059a2f763a9849c9045925cab21f52b93c7094988f64009d5704c1716fda`.

The Lucid source graph contains its route adapters plus only Lucid and shared auth screen implementations from `app/`. It excludes Journal screens and the shared root. **It still contains DreamsContext, useDreamJournal and journalSyncEngine transitively**: shared EmailAuthCard imports optional Journal actions, and shared language/theme/auth code retains storage facades. These modules being bundled does not prove their effects execute; this change does not claim complete service or native-module isolation. The earlier inventory's identical Journal/Lucid graph is superseded by this measured route boundary, not by an assertion of full autonomy.

Local uncommitted export evidence: `/private/tmp/ti561-clean-journal-first`, `/private/tmp/ti561-clean-lucid-final`, `/private/tmp/ti561-clean-journal-repeat`; summaries `/private/tmp/ti561-route-export-results.json`; test/type/lint logs `/private/tmp/ti561-root-*.log`. Generated exports are not repository inputs or durable CI proof. Byte counts are minified uncompressed JavaScript, not APK size, Hermes startup time or download bytes. Physical native deep links and startup remain a separate qualification gate.
