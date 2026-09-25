# Test signal audit — 2026-09-24

Base revision: `17312e7ec82e88228f13ea0dc16d6a5d13cd8185`. Test-file diff SHA-256: `6fbf15ee981c6dbed239583398e795b7121fefbec436d791e5090f6bca255560` (tracked `*.test.*` changes, sorted by path).

Integration note (2026-09-25): this checksum and the verification table record the original audit against `17312e7e`. The commit branch starts from `333ea2cd` after the later master updates; the original run results are not a claim of post-update E2E execution.

Four parallel workstreams inventoried 657 tracked test files (including two native Kotlin harnesses). Suite/case inventories were reviewed, candidate bodies inspected, and claimed overlap compared with actual E2E assertions. This is a source audit, not an E2E execution or proof that the retained portfolio is exhaustive.

Removed 33 whole test files and pruned 75 retained files. No product behavior changed; one stale benchmark comment was removed from `lib/dreamFilters.ts`. `AGENTS.md` now contains the requested E2E-first rules and repeatable artifact requirements. The Edge CI job no longer passes a deleted filename; all other job checks and change-classification rules remain.

## Decision criteria

- Remove literal token/copy/catalog mirrors, source-shape assertions, tests of copied test-local logic, and timing logs with no regression threshold.
- Remove simple happy paths only where an existing journey or stronger retained behavior case asserts the outcome.
- Retain failure injection, corruption, race, permission, quota, security, privacy, accessibility semantics and meaningful performance bounds that E2E does not cover.
- A mock E2E flow is not backend or native qualification. Static security guards without an executable equivalent remain.
- Keep non-empty locale checks: key parity alone does not detect blank translations, and E2E does not run every locale.

## Whole-file removals

| Removed test | Reason and existing evidence |
| --- | --- |
| `apps/meditation/tests/components/ImmersiveScene.test.tsx` | Counts mocked Canvas nodes after synthetic layout without verifying dimensions, actual drawing, or any user outcome. No E2E equivalence claimed. |
| `apps/meditation/tests/environment.test.tsx` | Only verifies Jest stubs, rendering mocks, and mock store reset; no production behavior. No E2E equivalence claimed. |
| `apps/meditation/tests/maestro-anchors.test.ts` | Greps source strings and flow filenames; actual Maestro execution fails for missing anchors or wrong app ids and source presence does not prove reachability. Evidence: `apps/meditation/maestro/`. |
| `apps/meditation/tests/services/audioService.test.ts` | Duplicate native release, cue release and session-release scenarios covered through both real and mock facade branches by audioServiceModes.test.ts, with timer/listener cleanup assertions. No E2E equivalence claimed. |
| `components/analysis/__tests__/AnalysisRevealOverlay.test.tsx` | Only checks title/icon presence on an unused decorative component; no production call sites. No E2E equivalence claimed. |
| `components/animations/__tests__/FloatingCloudRow.test.tsx` | Pins cosmetic tokens, mock-renderer structure or styling implementation rather than a user-visible failure; does not validate actual rendering. No E2E equivalence claimed. |
| `components/inspiration/__tests__/GradientText.test.tsx` | Pins cosmetic tokens, mock-renderer structure or styling implementation rather than a user-visible failure; does not validate actual rendering. No E2E equivalence claimed. |
| `components/motion/__tests__/motion.test.ts` | Pins chosen animation constants and repeats the stagger arithmetic; no actual motion or lifecycle is exercised. No E2E equivalence claimed. |
| `components/recording/__tests__/RecordingOnboardingTour.test.tsx` | Checks cosmetic wording and callbacks on retired capture tour with no production call sites; E2E checks that the retired UI stays absent. Evidence: `maestro/onboarding-persona-paths.yml`. |
| `components/recording/__tests__/UnforgettableDreamPromptCard.test.tsx` | Only checks mocked translated copy and callback forwarding on an unused legacy prompt with no production call sites; current remembered-dream journey remains in E2E. Evidence: `maestro/onboarding-persona-paths.yml`. |
| `constants/__tests__/noctaliaDesign.test.ts` | Pins cosmetic tokens, mock-renderer structure or styling implementation rather than a user-visible failure; does not validate actual rendering. No E2E equivalence claimed. |
| `context/__tests__/ChatContext.test.tsx` | Tests static values, provider plumbing, or mocked delegation; end-to-end use exercises the real consuming path. Evidence: `maestro/web-dream-explore-chat.yml`, `maestro/guest-chat-limit.yml`. |
| `lib/__tests__/dreamChatRetryTarget.test.ts` | Checks source spelling/placement or import text, not an observable failure; rendered behavior and retained domain tests remain. Evidence: `maestro/guest-chat-limit.yml`, `maestro/web-dream-explore-chat.yml`. |
| `lib/__tests__/i18nRecordingDraftRecovery.test.ts` | Copies every literal draft-recovery message into EXPECTED_COPY; behavior of failed reads and explicit retry remains in useRecordingDraftPersistence. No E2E equivalence claimed. |
| `lib/__tests__/journalDreamDetailOrder.test.ts` | Checks source spelling/placement or import text, not an observable failure; rendered behavior and retained domain tests remain. Evidence: `maestro/journal-dream-cta-labels.yml`, `maestro/dream-recall-assistant.yml`. |
| `lib/__tests__/reflectionPublicCopy.test.ts` | Pins cosmetic strings or duplicates the locale-wide key/placeholder parity guard; does not exercise product behavior. Its reflection state assertions duplicate retained dreamUsage/reflectionNavigation cases. Evidence: `maestro/journal-dream-cta-labels.yml`. |
| `lib/__tests__/releaseNotesI18n.test.ts` | Pins cosmetic strings or duplicates the locale-wide key/placeholder parity guard; does not exercise product behavior. No E2E equivalence claimed. |
| `lib/__tests__/testIDs.test.ts` | Tests static values, provider plumbing, or mocked delegation; end-to-end use exercises the real consuming path. Evidence: `maestro/dream-recall-assistant.yml`, `maestro/subscription-qa-lab.yml`. |
| `scripts/analysis-idempotency-migration.test.js` | Checks SQL spellings in one historical migration, not the final installed function. Real-database integration covers concurrent claims, replay counts, and denied client roles. Evidence: `scripts/ti528/jobs-local.test.ts`, `scripts/check-db-contract.js`. |
| `scripts/lib/educational-diagram-v2.test.js` | Repeats fixed catalog counts, template names, font strings and dimensions from the generator; does not establish that any diagram renders correctly. Generator already validates its definitions. Evidence: `scripts/lib/educational-diagram-v2.js`. |
| `scripts/quota-card-product-contract.test.js` | Reads TSX/French source strings and freezes vocabulary; does not execute quota UI. Existing E2E checks the visible analysis-only quota card. Evidence: `maestro/mock-existing-quotas.yml`. |
| `services/__tests__/mockAnalysisGenerators.test.ts` | Checks canned fixture title/determinism; E2E distinguishes saved mock dreams by their original text. Evidence: `maestro/web-recording-save-dream.yml`, `maestro/dream-recall-assistant.yml`. |
| `services/mocks/__tests__/geminiServiceMock.test.ts` | Checks canned AI response shapes, strings and mock console logging; real adapter failure paths remain covered. Evidence: `maestro/guest-quota-flow.yml`, `maestro/web-dream-explore-chat.yml`. |
| `services/mocks/subscriptionServiceMock.test.ts` | Checks mock purchase fixture state; Maestro drives free, monthly, annual, cancelled and expired profiles and purchase UI. Evidence: `maestro/subscription-qa-lab.yml`, `maestro/subscription-mock-paywall.yml`. |
| `tests/app-routes/authResetPassword.test.tsx` | Tests only that a one-line route renders a mocked child; real reset form state and error behavior remain in ResetPasswordScreen.test.tsx. No E2E equivalence claimed. |
| `tests/app-routes/journalReflectionCriteria.test.ts` | Searches source text for exact expressions without executing the claimed reflection/retry behavior. No E2E equivalence claimed. |
| `tests/app-routes/lucidNightProgressScenes.test.ts` | Repeats width/font-scale thresholds without rendering or checking usable layout. No E2E equivalence claimed. |
| `tests/app-routes/lucidTabsAnimation.test.tsx` | Asserts mocked navigator options and hook call placement; cannot reproduce native animation/render loops. Lucid smoke traverses the real navigator. Evidence: `maestro/lucid-smoke.yml`. |
| `tests/perf/dreamPulse.perf.test.ts` | Informational stopwatch only: asserts elapsed time is positive, so slower or incorrect implementations pass; no result or upper performance bound is asserted. No E2E equivalence claimed. |
| `tests/perf/filterByDateRange.perf.test.ts` | Informational stopwatch only: asserts elapsed time is positive, so slower or incorrect implementations pass; no result or upper performance bound is asserted. No E2E equivalence claimed. |
| `tests/perf/filterBySearch.perf.test.ts` | Informational stopwatch only: asserts elapsed time is positive, so slower or incorrect implementations pass; no result or upper performance bound is asserted. No E2E equivalence claimed. |
| `tests/perf/localeFormatting.perf.test.ts` | Informational stopwatch only: asserts elapsed time is positive, so slower or incorrect implementations pass; no result or upper performance bound is asserted. No E2E equivalence claimed. |
| `tests/perf/streakUtils.perf.test.ts` | Informational stopwatch only: asserts elapsed time is positive, so slower or incorrect implementations pass; no result or upper performance bound is asserted. No E2E equivalence claimed. |

## Mixed suites

Pruned cosmetic/mock/source checks and duplicated happy paths while retaining the other cases in these files:

- `apps/meditation/tests/a11y/DrawerModal.test.tsx`
- `apps/meditation/tests/components/Button.test.tsx`
- `apps/meditation/tests/components/SelectableCard.test.tsx`
- `apps/meditation/tests/context/LibraryContext.test.tsx`
- `apps/meditation/tests/context/OnboardingContext.test.tsx`
- `apps/meditation/tests/context/SilenceContext.test.tsx`
- `apps/meditation/tests/lib/breathing.test.ts`
- `apps/meditation/tests/lib/i18n.test.ts`
- `apps/meditation/tests/lib/paywallCopy.test.ts`
- `apps/meditation/tests/lib/quotaResetCopy.test.ts`
- `apps/meditation/tests/onboarding/BreathIntro.test.tsx`
- `apps/meditation/tests/worlds/BreathTrainer.test.tsx`
- `apps/meditation/tests/worlds/HomeJourney.test.tsx`
- `apps/meditation/tests/worlds/LayoutAccessCopy.test.tsx`
- `apps/meditation/tests/worlds/PaywallScreen.test.tsx`
- `apps/meditation/tests/worlds/SearchProfileWorldSurfaces.test.tsx`
- `apps/meditation/tests/worlds/WorldPurchaseScreen.test.tsx`
- `apps/meditation/tests/worlds/WorldScene.test.tsx`
- `apps/meditation/tests/worlds/worldRegistry.test.ts`
- `apps/meditation/tests/worlds/worldSounds.test.ts`
- `components/__tests__/EmbeddedCardPresentation.test.tsx`
- `components/__tests__/ScreenContainer.test.tsx`
- `components/analysis/__tests__/AnalysisProgress.test.tsx`
- `components/auth/__tests__/EmailAuthCard.test.tsx`
- `components/chat/__tests__/messagesList-rerender.perf.test.tsx`
- `components/journal/__tests__/DreamCard.test.tsx`
- `components/journal/__tests__/DreamShareImage.test.tsx`
- `components/lucid/__tests__/LucidUI.test.tsx`
- `components/motion/__tests__/PressableScale.test.tsx`
- `components/motion/__tests__/ProgressFill.test.tsx`
- `components/recording/__tests__/RecordingFooter.test.tsx`
- `components/recording/__tests__/RecordingInputModeSelect.test.tsx`
- `components/recording/__tests__/RecordingSheets.test.tsx`
- `components/releases/__tests__/WhatsNewModal.test.tsx`
- `components/reminders/__tests__/ReminderOptInCard.test.tsx`
- `components/settings/__tests__/SettingsFieldGroup.test.tsx`
- `components/settings/__tests__/useSettingsPreferences.test.tsx`
- `components/stats/__tests__/StatsEvolutionBars.test.tsx`
- `components/stats/__tests__/StatsRhythmChart.test.tsx`
- `components/ui/__tests__/DateTimePicker.web.test.tsx`
- `context/__tests__/AuthContext.test.tsx`
- `context/__tests__/DreamsContext.test.tsx`
- `context/__tests__/LanguageContext.test.tsx`
- `context/__tests__/ThemeContext.test.tsx`
- `hooks/__tests__/useAnalysisProgress.test.tsx`
- `hooks/__tests__/useDreamJournal.test.tsx`
- `hooks/__tests__/useDreamPersistence.test.tsx`
- `lib/__tests__/exploration360I18n.test.ts`
- `lib/__tests__/homeI18n.test.ts`
- `lib/__tests__/i18nDreamDetail.test.ts`
- `lib/__tests__/journalDreamRecallOffer.test.ts`
- `lib/__tests__/journalI18n.test.ts`
- `lib/__tests__/recordingI18n.test.ts`
- `lib/__tests__/sleepSounds.test.ts`
- `lib/__tests__/statsProfileI18n.test.ts`
- `lib/__tests__/trendsI18n.test.ts`
- `lib/chat/__tests__/streamingDisplay.test.ts`
- `scripts/interpretation-entitlement-migration.test.js`
- `scripts/lib/alternatives-table.test.js`
- `scripts/lib/content-hub-registry.test.js`
- `scripts/lib/docs-components.test.ts`
- `scripts/lib/image-seo-assets.test.js`
- `scripts/mobile-static-assets.test.js`
- `scripts/verify-subscription-qa-local.test.js`
- `services/__tests__/dreamGuideService.test.ts`
- `services/__tests__/journalDreamMapper.test.ts`
- `services/__tests__/journalQueueTransitions.test.ts`
- `services/quota/__tests__/GuestQuotaProvider.test.ts`
- `services/quota/__tests__/SupabaseQuotaProvider.test.ts`
- `supabase/functions/api/services/gemini.test.ts`
- `tests/app-routes/lucidProgramJourney.test.tsx`
- `tests/app-routes/onboardingScreen.test.tsx`
- `tests/app-routes/recordingScreen.test.tsx`
- `tests/app-routes/settingsScreen.test.tsx`
- `tests/app-routes/symbolDictionary.test.tsx`

## Verification

| Surface | Result |
| --- | --- |
| Root Jest | Node 24.19.0: 53 edited suites, 628 tests passed. |
| Vitest | Node 24.19.0: edited MessagesList suite, 2 tests passed. |
| Meditation | Node 24.19.0: all 20 edited suites, 192 tests passed. The previous seven missing-module failures are resolved. Previously blocked WorldScene lint also passes. |
| Types | Root `npm run typecheck:tests` and Meditation `npm run typecheck` passed. Meditation now explicitly loads its installed Jest and Node typings for existing release tests. |
| Backend | Deno 2.7.14: edited Gemini suite, 16 tests passed with `--frozen --allow-env`. |
| CI | YAML parsed; Edge command names 7 existing suites. `python3 .circleci/tests/shared-build-impact.test.py`: 11 tests passed during the initial audit. |
| Diff | `git diff --check` passed; deleted-test references checked. Classifier retains the historical deleted path so that deletion changes still route correctly. |

## Environment repair

`mise.toml` pins Node 24.19.0 and Deno 2.7.14 to match `.nvmrc` and CI.
Run `mise install` followed by `mise exec -- <command>` to use them without changing
the machine-wide Node default. Both runtimes were installed and verified locally.

Meditation's package-local `node_modules` was absent. Running `mise exec -- npm ci
--no-audit --no-fund` from `apps/meditation` restored its existing lockfile,
including `expo-status-bar` and `expo-video`. Package manifests and lockfiles were
not changed. Skia libraries for iOS/macOS/Android are present, and the local native
resolver and filesystem watcher modules load. No native build qualification is claimed.

The fresh Meditation install exposed omitted Node typings in its TypeScript
configuration. Adding `types: ["jest", "node"]` to `apps/meditation/tsconfig.json`
fixed the existing release-test type errors without adding dependencies or tests.

At audit time, no device E2E flows, native builds, deployment, commits or pushes were performed.
Release-readiness skill edits are handled in a separate commit; dogfood outputs remain local and ignored by Git.

## Repeat focused verification

The following selects modified, surviving root and Meditation Jest suites against the recorded base (including an uncommitted patch), then invokes the remaining checks through their own runners. No new tests are generated.

```sh
mise exec -- node - <<'JS'
const { execFileSync } = require('node:child_process');
const base = '17312e7ec82e88228f13ea0dc16d6a5d13cd8185';
const paths = execFileSync('git', ['diff', base, '--name-only', '--diff-filter=M'], { encoding: 'utf8' }).trim().split('\n');
const tests = paths.filter(p => /^(components|constants|context|hooks|lib|services|scripts|tests)\//.test(p) && /\.test\.[jt]sx?$/.test(p) && !p.includes('.perf.test.'));
if (!tests.length) throw new Error('No modified suites selected');
execFileSync('npm', ['run', 'test:file', '--', ...tests, '--watchman=false'], { stdio: 'inherit' });
const meditation = paths.filter(p => p.startsWith('apps/meditation/tests/') && /\.test\.tsx?$/.test(p)).map(p => p.replace('apps/meditation/', ''));
if (!meditation.length) throw new Error('No modified Meditation suites selected');
execFileSync('npm', ['test', '--', '--runTestsByPath', ...meditation, '--runInBand', '--watchman=false'], { cwd: 'apps/meditation', stdio: 'inherit' });
JS
mise exec -- npm run test:perf -- components/chat/__tests__/messagesList-rerender.perf.test.tsx
mise exec -- npm run typecheck:tests
mise -C apps/meditation exec -- npm run typecheck
mise -C supabase/functions exec -- deno test --frozen --allow-env api/services/gemini.test.ts
python3 .circleci/tests/shared-build-impact.test.py
git diff --check
```
