# Project scripts

Run `npm run scripts:list` for the current command catalog. Add `-- --json`
when another tool needs structured output.

## Command families

| Family | Primary commands | Side effects and prerequisites |
| --- | --- | --- |
| Development | `start`, `start:*`, `web`, `android`, `ios` | Runtime only. Environment profiles are loaded in memory and never copied to `.env.local`. |
| Quality | `lint`, `lint:scripts`, `typecheck:*`, `test:*` | Read-only except normal test caches and artifacts. |
| Site | `docs:build`, `docs:check`, `docs:release-check`, `docs:deploy:*` | `docs:build` regenerates committed output. Deploy commands publish externally and require explicit intent. |
| Content | `content:*`, `validate-seo`, `generate-sitemap` | Manifest commands without `:check` and sitemap generation write generated files. |
| Android E2E | `test:e2e:*` | Requires an emulator or device, Maestro, and the matching runtime profile. |
| Android release | `android:gates:*`, `android:release:local`, `build:apk:*` | May require ADB, a physical device, EAS credentials, or local build tooling. |
| Subscriptions | `subscription:qa:*` | Some commands update local QA evidence; see the RevenueCat runbook before use. |
| Backend/security | `db:contract:*`, `security:audit:*` | Database checks require an explicit local or remote connection. |

## Maintenance rules

- Reusable build and check entrypoints stay in `scripts/` and are wired from
  `package.json`.
- Shared, testable helpers stay in `scripts/lib/`.
- `docs-src/` and shared `data/` are the editable site sources. No active tool
  may patch generated `docs/` HTML directly.
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
