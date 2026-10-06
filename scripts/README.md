# Project scripts

Run `npm run scripts:list` for the current command catalog. Add `-- --json`
when another tool needs structured output. The [task index](../doc_web_interne/docs/README.md)
connects these commands to implementation paths and current runbooks.

## Command families

| Family | Primary commands | Side effects and prerequisites |
| --- | --- | --- |
| Development | `start`, `start:*`, `web`, `android`, `ios` | Runtime only. Environment profiles are loaded in memory and never copied to `.env.local`. |
| Quality | `lint`, `lint:scripts`, `typecheck:*`, `test:*` | Read-only except normal test caches and artifacts. |
| Site | `docs:build`, `docs:check`, `docs:release-check`, `docs:deploy:*` | `docs:build` regenerates ignored local output. Cloudflare rebuilds the same output from sources; deploy commands publish externally and require explicit intent. |
| Content | `content:*`, `validate-seo`, `generate-sitemap` | Manifest commands without `:check` and sitemap generation write generated files. |
| SEO | `seo:gsc:export`, `seo:backlinks:check` | GSC export writes a dated external-data report; backlink check fetches the tracked public referring pages but never rewrites the CSV. |
| Web E2E | `test:e2e:web`, `test:e2e:web:report` | Playwright and Chromium; simulated services. See [the E2E guide](../e2e/README.md). |
| Backend E2E | `test:e2e:backend`, `start:backend-e2e` | Disposable local backend and browser artifacts; requires a Docker-compatible runtime. See [backend qualification](../doc_web_interne/docs/e2e-backend-qualification.md). |
| Android E2E | Other `test:e2e:*` commands | Maestro, emulator/device and matching binary/runtime profile; each flow has its own data and payment safeguards. |
| Mobile release | `release:*` | `prepare` writes manifests; `versions:sync` writes local mirrors; `build` starts a remote EAS build and requires explicit authorization. See [the release guide](../doc_web_interne/docs/MOBILE_VERSIONING.md). |
| Android release | `android:gates:*`, `android:release:local`, `build:apk:*` | May require ADB, a physical device, EAS credentials, or local build tooling. |
| Subscriptions | `subscription:qa:*` | Some commands update local QA evidence; see the RevenueCat runbook before use. |
| Backend/security | `db:contract:*`, `security:audit:*` | Database checks require an explicit local or remote connection. |

## Local Android prerequisites

Use the Node/Deno versions from `mise.toml` and install dependencies in the actual
checkout. A local Android Release build also requires **JDK 17** and an Android
SDK. `JAVA_HOME` takes precedence over Java on PATH; the runner verifies that
executable before version synchronization, device access, prebuild or Gradle.
A missing, incompatible or unverifiable Java stops immediately with instructions
for setting `JAVA_HOME`. The runner does not install or switch JDKs automatically.

On macOS, select an already-installed JDK 17 with
`export JAVA_HOME="$(/usr/libexec/java_home -v 17)"`, then verify
`"$JAVA_HOME/bin/java" -version`. On other hosts, set `JAVA_HOME` to the installed
JDK 17 directory. `ANDROID_HOME` or `ANDROID_SDK_ROOT` locates the SDK; the shared
`android-tooling.js` resolver also checks standard host SDK locations for ADB.
Use `ADB_BIN` for an explicit executable and `MAESTRO_BIN` for a Maestro runner.
Check `gh --version` before CLI-based PR operations, or use the connected GitHub
capability. Keep absolute tool paths in local configuration.

Inspect the canonical runner with:

```sh
mise exec -- npm run android:release:local -- --help
```

Requested native implementation/QA includes its necessary local build, compatible
installation on an owned disposable QA target and isolated Expo native generation.
Check SDK/profile inputs first; reuse a compatible existing `android/` through
`--reuse-native-project`, otherwise generate explicitly with `--no-install` in
the isolated worktree and retain its input identity. Do not ask again for that
same local scope or regenerate another task's checkout. Never run a build merely
to repair tool discovery. Personal data, destructive installs, new providers/budgets,
EAS and Store/publication remain separate boundaries. Distribution builds use
`release:build`; local debug-signed APKs do not qualify a Play update.

## Maintenance rules

- Reusable build and check entrypoints stay in `scripts/` and are wired from
  `package.json`.
- Shared, testable helpers stay in `scripts/lib/`.
- `docs-src/` and shared `data/` are the editable site sources. No active tool
  may patch generated `docs/` HTML directly.
- `docs/` and `docs-src/static/version.txt` are build artifacts ignored by Git.
  Never force-add them; validate them locally with `docs:build` and `docs:check`.
- One-time migrations belong in `scripts/archive/` and must not have an npm
  command.
- New recurring generators use `build-*`, `generate-*`, `check-*`, or
  `audit-*`; avoid permanent `fix-*` commands.
- Active scripts must pass `npm run lint:scripts` with zero warnings.
- Use the Node version in `.nvmrc`. Cloudflare previews use the locally pinned
  Wrangler package; APK wrappers invoke the exact `eas-cli@21.0.0` version via
  `npx`, as recommended by Expo Doctor.
- Destructive or publishing commands need an explicit target and must never
  masquerade as a successful no-op help command.
