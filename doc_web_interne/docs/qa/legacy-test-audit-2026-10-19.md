# Legacy code and test audit — 2026-10-19

Delivery follow-up: the local snapshots below are now organized into the
[repository hygiene implementation](repository-hygiene-2026-10-19.md). Their
original dates, source identities and evidence boundaries remain historical;
final committed-head validation uses the existing verification proof store.

## Expanded repository cleanup — final local candidate

Source remains `967fe81f0a6012d5142483ae3ff17e19eba7133f` with the reviewable,
uncommitted patch in the audit worktree. The owner's follow-up expanded the scope
beyond runtime code and tests. **38 additional tracked paths were removed, for
110 deleted paths in total**. This is a repository cleanup, not a general disk,
production, account or personal-device cleanup. The primary checkout's existing
work was preserved.

| Additional removal | Proof of obsolescence / retained replacement |
| --- | --- |
| 16 scripts and their retired-group README (17 paths) | No package, automation, current guide, filename reader or primary-WIP consumer. Thirteen explicitly retired output-migration scripts plus three old standalone tools edited generated HTML or extracted its metadata. Current source templates/renderer and the complete source content manifest own those tasks. The legacy slug map/fallback/checker remain. SEO archive tools still scanned by release gates or cited as provenance were retained. |
| 7 images | Six unregistered Meditation ritual-card variants have no static, dynamic build, filename or WIP consumer; active world journey/trainer/thumbnail art remains. `splash-icon.back.png` is byte-identical to the retained registered icon. All 181 checked asset/manifest references resolve. Raw editable originals, distinct uncertain variants, fonts and audio remain. |
| 11 diagnostics and staging files | Generated Metro logs, a historical unauthorized response, unused manual speech samples, two generated blog snapshots and three abandoned symbol-route comparison files have no current reader. The live symbol route already contains the staged search optimizations. `sample.flac` is actually a failed-download XML error; `sample.b64` exactly encodes the WAV. The original WAV is preserved privately under the primary checkout's ignored `test-results/legacy-test-audit-20261019/preserved-input/` with mode 0600 in a 0700 directory. Primary originals and unique QA screenshots remain intact. Exact ignore rules prevent reintroducing these diagnostics. |
| 3 obsolete scratch guides | Empty `bolt.md`, an undated completed Google-auth checklist duplicated by retained setup guides, and the manual generated-HTML language workflow superseded by the source generator. Current backend/mock/image guides were corrected and shortened; dated evidence remains. |

The additional removed files contain 1,405,446 tracked bytes. This is not a disk
space reclamation measurement; primary copies and Git history remain.

Two direct root dependencies were removed: `react-native-gifted-charts` and
`expo-intent-launcher`, plus the now-orphaned `gifted-charts-core` lock entry.
Neither live source, primary WIP, plugins, configuration nor another dependency
consumes them. Current trends use SVG; Android settings use `Linking`. Every
retained lockfile record is unchanged. A **clean `npm ci` in the audit worktree
passed**, including all versioned patches, and all three packages are physically
absent from that installation. The primary dependency installation was left
intact. Expo compatibility and app/test types pass; native module resolution
passes for Android (49 modules) and Apple (54). Resolution is not a native build
or device qualification.

Meditation additionally dropped an unread progress-only context/provider/hook,
unused theme/type/media-URL exports and a mock observer with no reader. Stored
library state, persistence, playback and visible controls remain. The global
`sessionOfTheDay` selector had only six self-tests and no caller; Home uses the
world-aware recommendation. Those six obsolete cases were removed while the
active world/date/goal/intention/access counterexamples remain.

### Real failure fixed during verification

The first two browser attempts stopped before launching the SDK with
`spawnSync git ENOBUFS`: the expanded text diff exceeded Node's default capture
buffer. The runner now hashes the complete Git output as a stream, preserving
the former UTF-8 `trim()` SHA-256 exactly, without retaining a raw diff or silently
truncating identity. Git/spawn/signal failures still refuse qualification.
A real Git fixture over 2 MiB reproduces the old failure and proves that a tail
change beyond the old limit changes the hash. The actual 1,131,566-byte worktree
diff also matches the legacy full-output calculation. This isolated regression
covers the wrapper stage that UI assertions cannot reach. Independent review
found no issues.

### Verification for the expanded delta

| Check | Result / current evidence boundary |
| --- | --- |
| Root app/test types and Expo dependency compatibility | Passed on the fresh installation without the removed packages. |
| Existing trends + journal-card suites | **2 suites / 19 tests passed**; exact rerun uses `statisticsScreen.test.tsx`, the existing suite filename. An earlier mistyped path failed selection and is not an app failure or a pass. |
| Meditation full suite | **63 suites / 552 tests passed**, types and lint passed; six dead-selector cases retired, all other current cases retained. |
| Runner guards | **45 passed**, including the new real large-diff regression; focused runner ESLint passed. |
| Script and asset checks | Catalog of 190 commands, strict script lint, content-manifest freshness, 181 asset references and 30 documentation targets passed. |
| Reference proof | 1,894 tracked JS/TS files, 11,788 literal references and all 110 deleted candidates checked before the final runner delta: zero residual references. A focused AST follow-up checks all 25 imports in the three changed runner files against the same deleted set: zero. |
| Independent review / diff | Scripts, dependencies, assets, diagnostics, Meditation and runner fix reviewed with no remaining findings; `git diff --check` passed. |

All six affected browser journeys were then rerun with exit 0, zero skips/retries,
stable source/output snapshots, `applicationQualified: true` and zero secondary
errors. Assertions and trace pages are retained under `tools/e2e/.e2e/`:

- Dreamer (5): `dreamer-web/1792395551928-15210-4b0bb83b-d1a8-4dd7-bf29-8eb39d322d73/`.
- Meditation (1): `meditation-web/1792395551200-15065-d13ec47e-54ab-401e-a145-95e76691d87f/`.

The earlier full root Jest result (516 suites / 5,944 cases), Edge (261), backend
native qualification (7 browser journeys, 56 SQL contracts and 6 TI528 cases),
Lucid journeys and performance results below are **reused evidence**, not fresh
runs of this expanded delta. Their application/backend inputs were unchanged;
the affected package absence, Meditation changes and wrapper behavior were
validated by the checks above. npm reported its existing install-script approval
warnings; no blanket approval policy was enabled.

Current receipt: `test-results/legacy-test-audit-20261019/receipt-expanded-cleanup-20261019.json`.
It references the removal proofs, failed preflight attempts and successful reruns.
No functional local blocker remains. Changes remain local and uncommitted;
`verify:pr` is still required on a committed head before a push. No production
operation, new native build, personal app install, Store operation or device-data
reset occurred. Historical snapshots below keep their original source boundaries.


## Earlier qualification snapshot before the expanded cleanup

Current receipt: `test-results/legacy-test-audit-20261019/receipt-updated-20261019.json`.
The earlier `receipt.json` remains unchanged as historical evidence.

Current base: `967fe81f0a6012d5142483ae3ff17e19eba7133f`, matching fetched
`origin/master`. Both the primary checkout and the isolated audit checkout were
fast-forwarded by 73 commits. All 13 pre-existing modified tracked files and the
untracked work in the primary checkout were preserved; eight overlapping files
were merged against upstream without conflict. A private before/after receipt is
retained at `/private/tmp/noctalia-sync-20261019-8j9x2tq0/manifest.json`.
No commit, push, merge, production deployment, EAS/Store action or personal-device
change was performed. This is a reviewable local patch.

The cleanup was reapplied and re-audited on the new source. The final candidate
removes **51 unreachable runtime modules, 19 obsolete-only suites and two obsolete
diagnostics (72 paths)**. `ScreenErrorBoundary` was restored because the new
upstream `app/_layout.tsx` now imports its fallback. The original 73-path receipt
below is historical and must not be used as the current deletion manifest. The
fresh AST proof parses 1,911 remaining tracked JS/TS files and checks 11,872
literal references with all 72 deleted paths retained as resolution candidates:
zero references remain. Computed paths and filename readers were reviewed
separately; an import graph alone is not runtime proof.

Root, Meditation and TesterArmy dependencies were reinstalled reproducibly from
the updated upstream lockfiles; all direct installed versions match those locks.
Expo is now 58.0.14; both Expo compatibility checks pass. Optional registry
candidates beyond the incoming lockfiles were assessed, not silently upgraded to
new major versions. The updated Expo/React Native declarations exposed two real
style-type incompatibilities: Footer now uses `satisfies ViewStyle`, and the
existing versioned Expo patch derives `TextStyle.transitionDuration` from the
inherited `RN.ViewStyle` contract. Both changes preserve emitted JavaScript;
Markdown's existing `StyleSheet.flatten` implementation is unchanged. Canonical
app/test types, 16 affected tests, focused lint and independent review passed.
`patch-package` applied the complete patch to a clean Expo fixture and reproduced
the installed declaration byte-for-byte.

The personal `e2e` skill was updated from its verified source
`tester-army/e2e/skills/e2e@ef977f4856da009cac26d78d2e9bb14e5991ee41`, using
`safe-skills.mjs --plan` then `--apply --replace`. Its original bytes are backed
up, and eight guard tests passed. `retro` matched its verified upstream. Twelve
other personal skills had no proven source and were preserved; system/plugin
caches were preserved. Receipt:
`/Users/timax/.codex/tools/retro-guards/receipts/1792393316729-e2e.json`.

### Fresh verification on the updated candidate

| Check | Result |
| --- | --- |
| Root full Jest | **516 suites / 5,944 cases passed**; six opt-in DB cases skipped in this ordinary invocation, then all six executed and passed separately below. |
| Meditation full Jest | **63 suites / 558 cases passed**; package types and Expo compatibility passed. |
| Full Edge command | **261 tests passed**, including the previously undiscovered image worker. |
| TesterArmy tooling | Types and **44 guard tests passed**. |
| Performance | **3 suites / 5 cases passed**, original thresholds retained. |
| App/test types | Passed with the corrected Expo declaration and Footer inference; final primary-checkout app typecheck also passed with all preserved WIP. |
| Lint | Root passed with 121 warnings and zero errors; script lint passed with zero warnings. |
| Adapter safety | **35 cases passed**, including malformed/hosted targets, dynamic local status, qualification failure propagation and owned-stack cleanup. |
| Browser journeys with mock services | **8 passed**, zero retries/skips; fresh Dreamer (5), Meditation (1) and Lucid (2) results below. |
| Independent review | Native adapter and final style declaration correction: no findings. |

The upstream CI file now only benchmarks dependency installation; its deleted
validation pipeline was not resurrected. Image-worker discovery remains enforced
in the current local verification and Edge coverage commands. No check, target
guard, trigger or protection was weakened.

### Real Supabase qualification without Docker

The existing managed-stack runner now supports `--qualify-ti528`: it runs the
six existing TI528 cases after the browser journeys, against that invocation's
strictly validated disposable stack. Legacy fixed-port status remains supported.
Database credentials pass through a private environment variable, not argv; the
managed stack must have valid stack identity, loopback API/database URLs and
distinct allocated ports. Negative tests retain hosted-target rejection.

Executed with Supabase CLI **2.121.0**, native runtime, one Chromium worker,
synthetic local accounts, current migration fixtures, two external URLs
neutralized in fixture copies, four schedules disabled and zero active cron jobs:

```sh
EXPO_NO_METRO_LAZY=1 \
E2E_SUPABASE_HOME=/Users/timax/Projects/noctalia/test-results/backend-e2e-cli-home \
mise exec -- npm run test:e2e:backend -- --runtime native --qualify-ti528
```

**Seven browser journeys passed with zero retries**, covering durable
save/edit/delete across a fresh browser, account/anonymous isolation, server Free
and Plus quota, offline recovery, and compatibility between precise and legacy
themes. Then **56 live database contracts passed** and **all four TI528 suites /
six cases passed with zero skips** (journal, admission, jobs and leases).
Canonical browser artifacts: `test-results/e2e-backend-results.json`,
`test-results/e2e-backend-report/` and per-test artifacts under
`test-results/e2e-backend/`. Full integration log:
`/private/tmp/noctalia-backend-native-updated-20261019.log`.

The command exited 0 and destroyed only its owned stack
`e526ffeb8138d52f3639778815323631979a11d198a188bb788400d3f504ec32`.
A fresh `stack list` returned no registered stacks. This invocation's private
`status.json` and `expo.env` were deleted after cleanup. This closes the six-case
local-database blocker recorded in the initial snapshot below. It does not
qualify native mobile storage/audio, a Store purchase, production or Docker/native
parity. Native Supabase remains an experimental upstream runtime.

### App compiler artifact boundary

An extra check of the preserved primary checkout reproduced a real configuration
problem: the broad app include glob also loaded three dated E2E/config copies
under `outputs/revenuecat-*`, outside their isolated SDK package. The app config
now excludes `outputs/**` from root discovery. A before/after compiler-program
comparison proves exactly those three archive copies were removed (699 to 696
entrypoints; 2,961 to 2,958 loaded files), with zero other source files removed
or added. The test project retains all 436 entrypoints; the active E2E project
retains all 39, including the three tracked counterparts. Archives were neither
changed nor deleted; imported live code remains typechecked, even under an
excluded discovery directory. Strictness and all compiler options are unchanged.
Final primary app, audit app and active E2E typechecks passed; independent review
had no findings. Proof: `test-results/legacy-test-audit-20261019/tsconfig-outputs-boundary-updated-20261019.json`.
The earlier runtime-suite and browser results are reused for this final
compiler-discovery-only delta; it changes no emitted application code.

### Remaining delivery boundary

No failing local check is currently known. `verify:pr` has not been run because
it verifies a committed head; the patch remains uncommitted and must pass it
before any later push. Both the real-backend and the eight selected mock-service browser journeys were
rerun on the updated source and dependencies. The earlier browser artifacts below
remain historical. Every fresh mock-service run has stable source/output
snapshots, zero secondary errors, exit 0 and `applicationQualified: true`:

| Product | Current immutable directory under `tools/e2e/.e2e/` |
| --- | --- |
| Dreamer — 5 passed | `dreamer-web/1792394210697-77327-841f64b7-9a8e-4ae5-b0e9-5bbaa5d7119f/` |
| Meditation — 1 passed | `meditation-web/1792394210064-77144-752034c0-8ee4-4111-beb3-807f469e11cf/` |
| Lucid — 2 passed | `lucid-web/1792394210534-77245-9ea0a230-de11-46e0-b439-834e4ad916cf/` |

Each directory retains exact assertions, trace pages, SDK versions, source
snapshots and the qualification receipt. The source was intentionally dirty;
these are local browser results, not a clean-commit or native-mobile proof.

## Initial audit snapshot before the requested update

The following evidence belongs to `e04a1d976a69d43d9d4b28fbed47a4fe534964dc`.
Its counts, original CI wiring and six pending DB cases describe that earlier
snapshot. Current counts and the resolved DB qualification are stated above.


## Scope and identity

Base: `e04a1d976a69d43d9d4b28fbed47a4fe534964dc`. Local, uncommitted changes are in
`/Users/timax/.codex/worktrees/legacy-test-audit/noctalia`; the original checkout's
journal, translation and local-setting WIP was preserved. No commit, push, merge,
deployment, store operation or personal-device change was performed.

The local receipt is `test-results/legacy-test-audit-20261019/receipt.json`; its
patch digest excludes this report. The receipt lists all 73 deleted paths.
Three subagents audited UI/hooks, core services/domain code, and Meditation;
the integration agent audited the runners, references and final evidence.
Independent review covered the final cleanup and the subsequent tooling fixes.
No actionable finding remains from that review.

The initial tracked inventory contains 715 files matching test/spec/e2e filename
patterns, including 45 backend and 65 Meditation suites. This is an inventory,
not a claim of manually reading every test body. Candidate bodies, their callers,
current replacements and companion tests were inspected. Final reference analysis
parsed 1,878 remaining JavaScript/TypeScript files, including static/dynamic literal
imports, reexports, require/require.resolve and Jest mock declarations: zero imports
or mocks remain pointing to deleted files. Graph candidates were additionally checked
for Expo routes, platform twins, dynamic registration and filename readers.

## Removed code: proof and current behavior

52 unreachable runtime modules, 19 obsolete-only test files and two obsolete
diagnostics were removed. No route, current storage/sync implementation or migration
was removed. A component looking old or a test failing was never sufficient proof.

| Removed group | Why obsolete; current implementation / preserved coverage |
| --- | --- |
| Expo template `external-link`, `hello-wave`, `parallax-scroll-view`, `themed-text`, `themed-view`, `ui/collapsible`, `use-theme-color` | No current route/component/config consumer; the orphan template chain only references itself. Current app themes and navigation remain. |
| `LoadingState`, `ScreenErrorBoundary`, `DreamSignatureHero`, `FloatingCloudRow`, `DreamPulseCard`, `SectionHeading`, `TypewriterText` | No production incoming reference after resolving the orphan chain. Home uses `TodayHero`, personal reading and current route components; live Home checks retained. |
| `AtlasDreamRow`, `SearchBar`, `SubjectProposition`, `TimelineIndicator` | Unused former journal/detail variants. Current journal cards, search, detail and trends routes retained and exercised. |
| `AtmosphereBackground`, `RecordingActivationInsightCard`, `RecordingOnboardingSpotlightOverlay`, `RecordingOnboardingTour`, `UnforgettableDreamPromptCard` | No current capture caller. Current saving is owned by `app/recording.tsx` and `useDreamsActions`, with conversation/draft hooks retained. |
| `ReminderOptInCard`, `StatsLockedSection`, `StatsRhythmChart`, `SubscriptionCard`, `UpgradeModal` | No active route/component consumer. Current reminder hook, trends and paywall flows remain; current subscription/storage failure suites retained. |
| `settingsModifiers` generic/native/web family | The entire platform family has no caller; deleting one platform alone was explicitly avoided. |
| `hooks/index`, `useDreamSaving`, `useDreamStatistics`, `useJournalAnimations` | No current imports, including the former barrel. Capture saves directly; statistics uses `buildDreamTrends`. Six UI/hook suites cover only the retired modules. Ten stale mocks in retained route/card suites were removed, without removing their assertions. |
| `constants/animations`, `dreamIcons`, `gradients`; `lib/atmosphereMotion`, `dreamPulse`, `recordingActivationInsight`, `referenceSubject` | No surviving runtime/script consumer, including transitive retired-UI consumers. The active remembered-dream label remains translated and tested. |
| `lib/dreamProfile`, `dreamStatsInsight`, `pieLabelUtils`, `onboardingCompletion` | Their former callers are retired; current trends/onboarding domain and route assertions remain. Old statistics-copy suites were pruned only after shared type/theme/emotion label checks were preserved on active getters. |
| `lib/lucid/analytics` | No production caller; actual context/routes call `trackProductEvent`. Consent, closed-enum and private-payload rejection checks now exercise the real product-analytics queue. Three focused cases preserve this boundary, which a browser journey cannot safely exhaust with malformed private payloads. |
| Root `lib/revenuecatSubscriber` duplicate | No runtime consumer. Its five entitlement edge-case tests now import the canonical `supabase/lib/revenuecatSubscriber`; billing coverage was retained. Server runtime code was unchanged. |
| Meditation `ProgressiveSilence`, `SilenceContext`, old `OnboardingScreen`, `content/ambiences` | All routes/configs/platform variants were included in its 176-module reachability check. Silence was an unreachable provider/component pair; current playback controls deliberately remain available. `worldSounds` still requires the bundled ambient assets, which were retained. |
| Meditation dead selectors/constants | Removed unused global `upcomingSessions`, `recommendedSessionForWorld` wrapper, `totalCycles`, `freeSessions`, `sessionsUpTo`, `catalogueSessionIds` and silence timing. All seven meaningful recommendation call assertions now target `homeRecommendationForWorld`; Home uses world-specific selectors. |
| `.tmp-memo-ref.tsx`, `scripts/test-mock-mode.js`, unused Jest `hoisted`/`stubGlobal` shims | The first is an unreferenced scratch type probe. The old mock diagnostic only lists files and describes `.env.local` activation superseded by in-process profile loading with Expo dotenv disabled. Current profile-isolation tests remain. The Jest compatibility methods have no call sites; historical comments are not consumers. |

`constants/subscription.ts` was specifically retained: a QA script reads it by filename.
Live factories, feature-flag branches, compatible old stored-data handling, platform
entries, audio assets, native dependencies and security/failure tests were retained.
The consumed `@jest/globals` typing compatibility declaration was also retained;
this audit does not claim to have converted its historical `any` typings.

## Real defects fixed instead of suppressing failures

1. **Performance configuration could not load.** With installed Expo 58.0.13 and
   Vite 8, `expo/tsconfig.base` resolves through the JavaScript package export and
   fails. `expo/tsconfig.base.json` selects the explicit JSON export. TypeScript
   parses both spellings to identical compiler options; no error suppression or
   compiler strictness change was introduced.
2. **Journal performance fixture required Metro assets in Node.** Once config
   loading worked, the random mock generator imported a bundled WebP gallery.
   The test now generates a deterministic, typed 8,000-dream corpus directly.
   Exact 4,000 search matches and five combined matches replace a vacuous array
   check. Eight runs, two warmups, the 80 ms ceiling and 6x ratio remain unchanged.
3. **Two macOS guard fixtures mishandled path aliases.** Installer expectations
   used `/var` while Node resolved `/private/var`; virtual link metadata was lost
   after canonical traversal. Fixture roots/map identity now normalize parent
   directories. Production guard code was not changed. Relative/absolute target
   equality, target-byte mutation, foreign-link refusal and cycle refusal remain;
   canonical-root equality was added. A direct probe with real synthetic links
   also passed those refusal cases.
4. **Image worker tests were silently undiscovered.** Eleven existing ownership,
   privacy, retry/idempotence and refund-error cases lived outside `api/` and
   `revenuecat-webhook/`. Existing local and CircleCI Deno test commands now include
   `image-job-worker`; Edge coverage includes all three directories. A regression
   test, red before the change, requires every tracked Edge test to be discoverable
   by local, CI and coverage commands. No classifier, trigger, filtering rule, engine implementation or SDK pin
   changed; no required check was weakened or removed.

The deleted test suites were green in their focused pre-removal baselines. UI
baseline: 14 selected suites / 321 cases; core baseline: 11 / 80 plus a separate
old-copy/label selection of 5 / 30; Meditation baseline: all 65 / 571. These
selections overlap and are not summed. An early whole-Jest run overlapped file
removal and failed on four ENOENT paths; it is not baseline evidence. The whole
suite was rerun after cleanup stabilized and passed.

## Verification

| Check | Result and evidence boundary |
| --- | --- |
| Root full Jest | 511 suites, 5,891 tests passed; 4 opt-in DB suites / 6 cases skipped. JSON and log retained locally. |
| Current UI selection | 12 retained suites / 327 cases passed, including capture/drafts, Home, journal/detail, trends and reminders. |
| Current core selection | 12 suites / 189 cases passed, including billing, privacy, storage and sync. |
| Meditation full suite | 63 suites / 558 tests passed; package types and lint also passed. |
| Full corrected Edge command | 45 files / 261 tests passed, including 11 worker and 3 webhook tests. No remote backend behavior claimed. |
| Discovery/config regression | 7 cases passed; omission was reproduced before wiring correction. |
| Performance | 3 suites / 5 cases passed under the original thresholds. Host JavaScript measurements do not qualify device frame performance. |
| TesterArmy guards | 38 passed, zero skipped; original failure and repaired-run logs retained. |
| Verification-engine contracts | 153 passed; native Linux process qualification remains separate. |
| CI contracts | Change classifier passed; 12 Python cases, 6 fallback cases / 360 trigger combinations, and 9 Node preparation/installer cases passed. |
| Types | App, test and TesterArmy typechecks passed; app/tests rechecked after the config repair. |
| Lint and generated contracts | Root lint passed with 120 warnings and no errors; script lint passed with zero warnings. Meditation lint, 204 root brand comparisons, 45 Meditation comparisons, regenerated Uniwind artifacts, theme parity and 296 import-boundary sources passed. |
| Diff/review | `git diff --check` passed. Independent cleanup and tooling-delta reviews had no remaining findings. |

The full-Jest result is reused for unchanged cleanup/runtime code. The later
runner-discovery delta was separately checked by the final configuration suite,
complete Edge execution, CI contracts and script lint; it was not silently counted
as part of the earlier full-Jest run.

Runtime: Node 24.19.0, Deno 2.7.14, Jest 30.5.2, TypeScript 6.0.3, Expo 58.0.13,
Vitest 4.1.8. TesterArmy: e2e 0.21.2 / web 0.15.2 / mobile 0.12.3 /
agent-device 0.21.28 (mobile engines were not executed).

## Executed browser journeys

All eight exact-assertion journeys passed with zero retries, source and outputs
stable during each run, no secondary evidence errors, mock services, isolated
browser storage and retained trace pages. The local candidate is intentionally
dirty; no clean-commit, native, store, physical-device or production equivalence
is claimed.

| Product | Passed assertions | Immutable local evidence under `tools/e2e/.e2e/` |
| --- | --- | --- |
| Dreamer | Guest exact story and inline analysis; free save/rename/find; 30-night trends with missing Intl fallback; trend doors/period filters; settings preserve draft/language/theme | `dreamer-web/1792371592397-54657-6aca9bc7-c7c6-4576-868c-f1c97e7f3132/` |
| Meditation | Onboarding persistence, tabs, editorial path, history and world settings | `meditation-web/1792371597278-55816-2189a24d-2518-43fc-9c9f-165b177fe914/` |
| Lucid | Required intention/experience; Night and Settings from Today and direct links | `lucid-web/1792371678456-58862-3c880bba-2313-40b7-bd32-34c56f143f3a/` |

Dreamer/Meditation ran before only the final webhook addition to the coverage
command and the broader discovery assertion; their application inputs were not
changed afterward. Lucid ran after that delta. Each directory retains
`report.json`, `qualification.json`, `source-start.json`, `source-end.json`,
`end.json`, evidence manifest, screenshots and per-test `trace.md`.

## Rerun commands

From the isolated worktree, use installed dependencies pinned by its lockfiles:

```sh
mise exec -- npm run test:fast -- --runInBand
mise exec -- npm run typecheck:app
mise exec -- npm run typecheck:tests
mise exec -- npm run lint
mise exec -- npm run lint:scripts
mise exec -- npm run test:perf
mise exec -- npm run test:testerarmy:typecheck
mise exec -- npm run test:testerarmy:guards
mise exec -- npm run test:verify-local
mise exec -- npm run test:file -- scripts/verify-local-config.test.js
(cd apps/meditation && mise exec -- npm test -- --runInBand --watchman=false --silent)
(cd apps/meditation && mise exec -- npm run typecheck && mise exec -- npm run lint)
(cd supabase/functions && mise exec -- deno test --frozen --allow-env --allow-net=deno.land --allow-read=../migrations api revenuecat-webhook image-job-worker)
E2E_WORKERS=2 mise exec -- npm run test:testerarmy -- run --grep 'guest saves the exact|free user saves, renames|30 nights read honestly|each door opens the journal|Quick Settings changes language'
mise exec -- npm run test:testerarmy:meditation
mise exec -- npm run test:testerarmy:lucid -- run --grep 'Lucid requires intention|Lucid opens Night'
```

## Remaining preconditions and limits

No failing local audit check remains. Four TI528 suites intentionally keep six
DB-only cases pending without `TI528_LOCAL_STATUS`: journal (1), admission (1),
jobs (2), leases (2). They remain meaningful coverage. Their owned disposable
Supabase stack requires API `127.0.0.1:55321`, PostgreSQL
`127.0.0.1:55322/postgres`, current migrations, Auth/Storage and a private status
file containing API_URL, DB_URL, ANON_KEY and SERVICE_ROLE_KEY. That status is
absent here. Once the existing stack/status is prepared, the guarded command is:

```sh
TI528_LOCAL_STATUS=/private/tmp/ti528-local-status.json mise exec -- npm run db:qualify:local
```

The runner refuses an absent status or another target before qualification.
No skipped case is counted as passed. No database was reset, no substitute test
account was created and no live schema/access change was made. No native build,
installed Release, microphone/audio behavior or Store billing was qualified.
`verify:pr` was not run: it verifies a committed head, and this task delivered a
local reviewable patch without committing or pushing. It remains required before
any later push. Historical audits and old results remain dated, not rewritten as
fresh evidence.
