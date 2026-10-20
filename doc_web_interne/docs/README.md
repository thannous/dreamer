# Repository task index

Start here to locate the implementation and current operational guide for a task.
[AGENTS.md](../../AGENTS.md) defines the repository rules; [package.json](../../package.json)
is the command source of truth. Run `mise exec -- npm run scripts:list` for the current
catalog, or add `-- --json` for structured output. Read [the script guide](../../scripts/README.md)
for prerequisites and side effects. [Repository layout](repository-layout.md) maps
source assets, generated files, private QA and historical evidence;
[repository operations](repository-operations.md) holds detailed runtime and publication procedures.

## Implementation entry points

| Task | Screen or entry point | Logic and supporting guide |
| --- | --- | --- |
| Capture and save | [recording.tsx](../../app/recording.tsx) | `components/recording/`, `hooks/useCaptureConversation.ts`, `hooks/useRecordingDraftPersistence.ts`, `context/DreamsContext.tsx` |
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
| Suivi des 240 symboles dans les six langues et passation images/animations | [Tableau Excel, CSV et handoff](suivi-symboles/README.md) | Exports du registre Atlas ; distinguer intégration, QA actuelle, historique et publication. |
| Repository sources, local configuration and QA artifacts | [Repository layout and hygiene](repository-layout.md) | `node scripts/check-repository-hygiene.cjs` checks tracked paths and exact historical exceptions; it is not a secret scanner. |
| Runtime, native preparation and guarded production publication | [Repository operations](repository-operations.md) | Detailed procedures and specialist links; AGENTS retains authority and approval boundaries. |
| Write or rewrite site articles, symbols and guides | [Editorial charter](charte-editoriale.md) | Voice, sourcing, typography and SEO guardrails; then `docs:build` and `docs:check`. |
| Generate symbol illustrations, add an Atlas entry or maintain its motion | [Living illustrations guideline](symbol-atlas-guidelines.md) | Approved Tiger/six-symbol direction, shared configuration, source archive and desktop/mobile evidence. |
| Choose checks and evolve contracts/tools | [Proportional validation](validation-proportionnee.md) | Current functional expectations, compatible measured upgrades, minimal evidence; the `pre-push` hook takes seconds (forbidden files, secrets, proof display); `npm run verify:pr` proves the commit on an isolated copy before every push, and the PR records the verified commit and the `verify:pr` result; `npm run verify:release` before a publish. |
| Web and native user journeys | [E2E guide](../../e2e/README.md) | `test:e2e:web`, `test:testerarmy:mobile -- <product> <android\|ios>`; the guide distinguishes simulated services and native requirements. |
| Real iPhone Sandbox billing and reuse | [iOS Sandbox preparation and retrospective](revenuecat-qa-workflow.md#ios-physique--réutiliser-la-préparation-sandbox) | Reuse the validated tester, signed driver and private profile; separate physical Apple confirmation from exact e2e continuation. |
| Live iPhone UI edits and local IPA delivery | [iPhone, Fast Refresh and Tailscale](ios-local-tailscale-ota.md) | Native Debug + `start:mock -- --dev-client --lan --port 8086` for live edits; `ios:local:build` for Release IPA validation. |
| TesterArmy Release qualification | [Current native retrospective qualification](qa/native-retro-qualification-20261006.md) | Exact passed-ID union, immutable reports/build receipts, owner decisions and retained physical/Store/video limits. |
| Historical native qualification | [Initial native qualification, 2026-10-06](qa/native-testerarmy-qualification-20261006.md) | Preserved earlier source/build proofs; not a substitute for the current candidate. |
| Real local backend, recovery and isolation | [Backend qualification](e2e-backend-qualification.md) | `test:e2e:backend -- --qualify-ti528` runs the browser and TI528 cases on the native Supabase runtime (no Docker) on supported hosts; Chromium required. |
| Mobile version preparation, build and submission | [Mobile release guide](MOBILE_VERSIONING.md) | `release:plan`, `release:prepare`, `release:check`, `release:build`; build/submission require their existing authorization. |
| EAS build counter mirrors | [Version synchronization](mobile-build-version-sync.md) | `release:versions:sync` writes local mirrors; `release:versions:check` verifies them. |
| Play candidate qualification | [Android release checklist](android-release-checklist.md) | Read the candidate's actual Play/build metadata; old store snapshots are historical evidence. |
| Physical Android/iOS performance | [Release measurements and journal return](qa/native-performance-20261018.md) | SDK 58, synthetic journal, cold/warm startup, FrameTimeline/Instruments, memory and retained-position regression proof. |
| Journal scroll, media warm-up and large histories | [Journal performance, 2026-10-20](qa/journal-performance-20261020.md) | Release before/after on two Android emulator renderers, 200/5 000 owned entries, exact reading/return assertions and explicit FPS limits. |
| Data ready and reading access | [Readiness performance](qa/readiness-performance-20261019.md) | Save/reading/image markers, presentation waits removed, controlled before/after and explicit native qualification limits. |
| iOS scroll fluidity | [Simulator preparation](qa/ios-framerate-20261019.md) | UI-runtime reading scroll, owned Release fixture, frame-measurement protocol and Xcode component prerequisite. |
| Navigation and scroll render cost | [Dreamer fluidity before/after](qa/fluidite-dreamer-20261019.md) | Route-change and scroll-gesture re-renders, UI-thread header scroll, React Compiler coverage; `node scripts/perf/measure-web-fluidity.mjs` compares two exported web builds (no native FPS claim). |
| Local Android build prerequisites | [Android tooling](../../scripts/README.md#local-android-prerequisites) | Java 17, Android SDK, local dependencies; requested native QA includes necessary isolated generation. `android:release:local -- --help` explains prebuild and install options. |
| Android iteration and Metro build cost | [Measured mobile CI optimizations](qa/mobile-ci-android-metro-2026-10-18.md) | Separate iteration APKs, unchanged clean Release defaults, identical Windows/Linux cases and measured cache gains. |
| Android performance measurement | [Performance protocol](../../scripts/android/README-performance.md) | Pilot first, use the device lock and identify the installed binary. |
| TalkBack qualification | [Motorola protocol](qualification-talkback.md) | Pilot the measurement method and restore device settings. |
| Delivery rule | [Common delivery rule](regle-commune-livraison.md) | Four-line common rule; [local checks and current CI](repository-operations.md#local-validation-and-ci) explain repository-specific execution. |
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

Local settings and installed skills are private machine resources, described in
[repository layout](repository-layout.md#local-configuration-and-secrets).
Use the [runtime procedure](repository-operations.md#runtime-and-prerequisites)
and, for requested Higgsfield work, the [media procedure](repository-operations.md#requested-media).
A missing required resource is reported before submission; it does not block
independent local preparation.
