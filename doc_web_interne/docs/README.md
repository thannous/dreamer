# Repository task index

Start here to locate the implementation and current operational guide for a task.
[AGENTS.md](../../AGENTS.md) defines the repository rules; [package.json](../../package.json)
is the command source of truth. Run `mise exec -- npm run scripts:list` for the current
catalog, or add `-- --json` for structured output. Read [the script guide](../../scripts/README.md)
for prerequisites and side effects.

## Implementation entry points

| Task | Screen or entry point | Logic and supporting guide |
| --- | --- | --- |
| Capture and save | [recording.tsx](../../app/recording.tsx) | `components/recording/`, `hooks/useDreamSaving.ts`, `hooks/useRecordingDraftPersistence.ts` |
| Journal, filters and storage | [journal.tsx](<../../app/(tabs)/journal.tsx>) | `hooks/useDreamJournal.ts`, `hooks/useDreamPersistence.ts`, `hooks/useRemoteJournalList.ts`, `services/storageService.ts` |
| Dream detail and reading | [dream detail](<../../app/journal/[id].tsx>) | `components/journal/`, `components/analysis/`; [appearance guide](../../components/journal/README.md) |
| Reflection and chat | [dream chat](<../../app/dream-chat/[id].tsx>) | `components/chat/MessagesList.tsx`, `context/ChatContext.tsx` |
| Settings and account controls | [settings.tsx](../../app/settings.tsx) | `components/settings/QuickSettingsProvider.tsx`, `context/QuickSettingsContext.tsx` |
| Quotas and subscription | [useQuota.ts](../../hooks/useQuota.ts) | `services/quota/`, `hooks/useSubscription.ts`, `components/subscription/`; [billing QA](revenuecat-qa-workflow.md) |
| Mock fixtures and service modes | [mock fixture guide](../../mock-data/README.md) | `services/mocks/storageServiceMock.ts`, `mock-data/`, `scripts/expo-safe-runner.js`; use `start:mock` |
| Backend contracts and jobs | [architecture index](architecture/README.md) | `supabase/functions/`, `supabase/migrations/`; [backend E2E](e2e-backend-qualification.md) |
| Theme and motion | [brand token contract](architecture/NOCTALIA-BRAND-TOKEN-CONTRACT.md) | `constants/noctaliaPalette.ts`, `components/motion/`; follow AGENTS styling and motion rules |
| Marketing pages and symbols | [site source guide](../../docs-src/README.md) | `docs-src/`, `data/`, `scripts/lib/`; [site tooling package](../../apps/site/README.md). `docs/` is generated output. |

Lucid shares the root package: implementations are in `app/lucid/`, while the
standalone companion uses `routes/lucid/` as its Expo Router root. Those routes
re-export the implementations. See [the Lucid specification](../../specs/noctalia-lucid-trainer.md)
and `app.config.ts`. Meditation has its own package, lockfile and
[local instructions](../../apps/meditation/AGENTS.md) under `apps/meditation/`.

## Current operational guides

| Work | Start here | Command or prerequisite |
| --- | --- | --- |
| Write or rewrite site articles, symbols and guides | [Editorial charter](charte-editoriale.md) | Voice, sourcing, typography and SEO guardrails; then `docs:build` and `docs:check`. |
| Choose checks and evolve contracts/tools | [Proportional validation](validation-proportionnee.md) | Current functional expectations, compatible measured upgrades, minimal evidence; every push runs the `pre-push` hook (`verify:fast`) on a clean committed worktree and the PR records that local proof. |
| Web and native user journeys | [E2E guide](../../e2e/README.md) | `test:e2e:web`, `test:e2e:journeys`; the guide distinguishes simulated services and native requirements. |
| TesterArmy Release qualification | [Current native retrospective qualification](qa/native-retro-qualification-20261006.md) | Exact passed-ID union, immutable reports/build receipts, owner decisions and retained physical/Store/video limits. |
| Historical native qualification | [Initial native qualification, 2026-10-06](qa/native-testerarmy-qualification-20261006.md) | Preserved earlier source/build proofs; not a substitute for the current candidate. |
| Real local backend, recovery and isolation | [Backend qualification](e2e-backend-qualification.md) | `test:e2e:backend`; needs Chromium and a Docker-compatible runtime. |
| Mobile version preparation, build and submission | [Mobile release guide](MOBILE_VERSIONING.md) | `release:plan`, `release:prepare`, `release:check`, `release:build`; build/submission require their existing authorization. |
| EAS build counter mirrors | [Version synchronization](mobile-build-version-sync.md) | `release:versions:sync` writes local mirrors; `release:versions:check` verifies them. |
| Play candidate qualification | [Android release checklist](android-release-checklist.md) | Read the candidate's actual Play/build metadata; old store snapshots are historical evidence. |
| Local Android build prerequisites | [Android tooling](../../scripts/README.md#local-android-prerequisites) | Java 17, Android SDK, local dependencies; requested native QA includes necessary isolated generation. `android:release:local -- --help` explains prebuild and install options. |
| Android performance measurement | [Performance protocol](../../scripts/android/README-performance.md) | Pilot first, use the device lock and identify the installed binary. |
| TalkBack qualification | [Motorola protocol](qualification-talkback.md) | Pilot the measurement method and restore device settings. |
| CI routing and jobs | [CircleCI guide](circleci-migration.md) | Manual trigger only (web app or API, `force_full_validation`); `.circleci/config.yml`, `.circleci/continue.yml`, `.circleci/scripts/classify-changes.sh`; full local validation for releases. |

## Find files before reading them

Use the task table before searching the whole repository. Discover candidate files
with `rg --files` or `rg -l`, then read the relevant section. Verify a file exists
before guessing a renamed component. Keep generated output and dependencies out
of source searches.

```sh
# Locate chat and settings implementations without guessing their filenames.
rg --files components/chat components/settings
# Find active release guidance and runners.
rg -l 'release:build|runtimeVersion' scripts/mobile-release.js doc_web_interne/docs/MOBILE_VERSIONING.md app.config.ts
# OTA is a whole word; an unbounded substring also matches quota.
rg -l -i '\bOTA\b|EAS Update|tailscale' scripts doc_web_interne/docs --glob '*.md' --glob '*.js' --glob '*.cjs' --glob '!**/qa/**' --glob '!**/archive/**'
```

The last example looks for operational guidance. Include `qa/` and dated reports
when investigating a previous qualification. Reusable instructions belong in the
guides above; dated evidence belongs under `qa/` or its existing work-package
location. Archive scripts remain under `scripts/archive/`. A historical pass,
version, account or store snapshot must be refreshed before a current-state claim.

## Optional machine resources

The canonical runtime entry point is `script/build_and_run.sh`. A local
`.codex/environments/environment.toml` can wire desktop Run actions to it; that file
is optional and is not distributed by this checkout. Use package scripts when it
is absent, with the macOS approval required by AGENTS for Metro/Expo.

Agent skills under `.agents/skills/` are ignored machine resources. Higgsfield hosts
may provide `WORKFLOW-POLICY.md` and `higgsfield-video-explainer/SKILL.md` there.
Check the host's available skills and read the installed policy before a media
submission. If the required policy or skill is absent, prepare the brief or assets
locally and report that specific missing resource before submitting. Do not invent
an absent policy, copy private material to an unsupported endpoint or treat another
host's skill installation as proof that this checkout has it.
