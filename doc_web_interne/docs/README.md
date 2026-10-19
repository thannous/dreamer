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

Lucid shares the root package, but its screens live only under its own Expo
Router root, `routes/lucid/` (`routes/lucid/lucid/`). Dreamer's `app/` does not
bundle them; its lucid ritual opens the Lucid app. See [the Lucid specification](../../specs/noctalia-lucid-trainer.md)
and `app.config.ts`. Meditation has its own package, lockfile and
[local instructions](../../apps/meditation/AGENTS.md) under `apps/meditation/`.

## Current operational guides

| Work | Start here | Command or prerequisite |
| --- | --- | --- |
| Write or rewrite site articles, symbols and guides | [Editorial charter](charte-editoriale.md) | Voice, sourcing, typography and SEO guardrails; then `docs:build` and `docs:check`. |
| Generate symbol illustrations, add an Atlas entry or maintain its motion | [Living illustrations guideline](symbol-atlas-guidelines.md) | Approved Tiger/six-symbol direction, shared configuration, source archive and desktop/mobile evidence. |
| Choose checks and evolve contracts/tools | [Proportional validation](validation-proportionnee.md) | Current functional expectations, compatible measured upgrades, minimal evidence; the `pre-push` hook takes seconds (forbidden files, secrets, proof display); `npm run verify:pr` proves the commit on an isolated copy before every push, and the PR records the verified commit and the `verify:pr` result; `npm run verify:release` before a publish. |
| Web and native user journeys | [E2E guide](../../e2e/README.md) | `test:e2e:web`, `test:testerarmy:mobile -- <product> <android\|ios>`; the guide distinguishes simulated services and native requirements. |
| Real iPhone Sandbox billing and reuse | [iOS Sandbox preparation and retrospective](revenuecat-qa-workflow.md#ios-physique--réutiliser-la-préparation-sandbox) | Reuse the validated tester, signed driver and private profile; separate physical Apple confirmation from exact e2e continuation. |
| Live iPhone UI edits and local IPA delivery | [iPhone, Fast Refresh and Tailscale](ios-local-tailscale-ota.md) | Native Debug + `start:mock -- --dev-client --lan --port 8086` for live edits; `ios:local:build` for Release IPA validation. |
| TesterArmy Release qualification | [Current native retrospective qualification](qa/native-retro-qualification-20261006.md) | Exact passed-ID union, immutable reports/build receipts, owner decisions and retained physical/Store/video limits. |
| Historical native qualification | [Initial native qualification, 2026-10-06](qa/native-testerarmy-qualification-20261006.md) | Preserved earlier source/build proofs; not a substitute for the current candidate. |
| Real local backend, recovery and isolation | [Backend qualification](e2e-backend-qualification.md) | `test:e2e:backend`; needs Chromium and a Docker-compatible runtime. |
| Mobile version preparation, build and submission | [Mobile release guide](MOBILE_VERSIONING.md) | `release:plan`, `release:prepare`, `release:check`, `release:build`; build/submission require their existing authorization. |
| EAS build counter mirrors | [Version synchronization](mobile-build-version-sync.md) | `release:versions:sync` writes local mirrors; `release:versions:check` verifies them. |
| Play candidate qualification | [Android release checklist](android-release-checklist.md) | Read the candidate's actual Play/build metadata; old store snapshots are historical evidence. |
| Physical Android/iOS performance | [Release measurements and journal return](qa/native-performance-20261018.md) | SDK 58, synthetic journal, cold/warm startup, FrameTimeline/Instruments, memory and retained-position regression proof. |
| Local Android build prerequisites | [Android tooling](../../scripts/README.md#local-android-prerequisites) | Java 17, Android SDK, local dependencies; requested native QA includes necessary isolated generation. `android:release:local -- --help` explains prebuild and install options. |
| Android iteration and Metro build cost | [Measured mobile CI optimizations](qa/mobile-ci-android-metro-2026-10-18.md) | Separate iteration APKs, unchanged clean Release defaults, identical Windows/Linux cases and measured cache gains. |
| Android performance measurement | [Performance protocol](../../scripts/android/README-performance.md) | Pilot first, use the device lock and identify the installed binary. |
| TalkBack qualification | [Motorola protocol](qualification-talkback.md) | Pilot the measurement method and restore device settings. |
| Delivery rule | [Common delivery rule](regle-commune-livraison.md) | This repository's own copy of the four-line common rule; dreamer specifics are in AGENTS.md, "Notes dreamer". |
| Test login | [Shared test login](test-login.md) | Guard (production refused, allowlisted test projects only), env names, premium mechanism and owner steps. Seed, API login and Playwright storageState for the persistent `e2e` branch (a TesterArmy native sign-in journey will be written once the branch exists); owner dashboard steps. |
| Local validation and manual benchmark | [CircleCI guide](circleci-migration.md) | `verify-local.config.mjs` owns all validation. CircleCI runs only the E2E/Chromium installation benchmark: manual/API trigger plus `run_e2e_benchmark=true`. Local rerun: `npm run test:testerarmy:benchmark`. |

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
