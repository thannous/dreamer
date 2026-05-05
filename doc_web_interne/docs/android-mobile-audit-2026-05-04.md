# Android Mobile Audit - Noctalia - 2026-05-04

## Scope

Audit of the current Expo/React Native Android app for:

- key screens and UX flows: recording/home, journal, dream detail, AI analysis, paywall, settings
- remaining warnings and technical readiness
- Google / Play Integrity / Play Internal Testing readiness
- product, onboarding, signup, paywall, pricing, analytics, data-fetching, offline, and E2E priorities

Skills applied: `expo:building-native-ui`, `design-taste-frontend`, `analytics-tracking`, `expo:native-data-fetching`, `expo:expo-dev-client`, `expo:expo-deployment`, `onboarding-cro`, `signup-flow-cro`, `paywall-upgrade-cro`, `pricing-strategy`, `imagegen-frontend-mobile`.

Official references checked:

- Expo deployment: https://docs.expo.dev/deploy/build-project/
- Google Play App Signing: https://support.google.com/googleplay/android-developer/answer/9842756
- Google Play App integrity page: https://support.google.com/googleplay/android-developer/answer/13857328
- Play Integrity API: https://developer.android.com/google/play/integrity
- Google Play internal testing: https://support.google.com/googleplay/android-developer/answer/9845334

## Verification Snapshot

Commands run:

| Check | Result | Notes |
| --- | --- | --- |
| `npx expo install --check` | Pass | Dependencies are aligned with Expo SDK expectations. |
| `npx expo-doctor` | Pass | 18/18 checks passed. The old `npx expo doctor` entrypoint is no longer supported by the local CLI. Latest sandboxed run hit npm cache `EPERM` in `~/.npm`, then the same command passed outside the sandbox. |
| `npm run typecheck:app` | Pass | `tsc --noEmit` completed without output/errors. |
| `npm run lint` | Pass | 0 errors, 0 warnings after documenting intentional require bridges and removing the unused Supabase function import. |
| `npm test -- --runInBand --watch=false --no-watchman` | Pass | 95 suites, 1060 tests passed after recording UX, first-use guide, journal scan, detail action, first-value backup prompt, Android gate preflight, analytics debug-provider updates, and Android E2E mock-fill stabilization. Existing console noise/open-handle note remains; no test failed. Initial run without `--no-watchman` failed due sandbox permission on Watchman state, not test failure. |
| `npm run android:gates:strict` | Pass with manual gates | Local config, adb/device, and Maestro checks pass: 7 pass, 0 fail, 0 blocked, 4 manual. Maestro CLI is available at `/opt/homebrew/opt/maestro/bin/maestro` but not PATH-linked because the Homebrew cask name is already taken. Manual gates remain: Google Cloud project number, Supabase Play Integrity secrets, Play App Signing SHA-1, Play-installed RevenueCat purchase/restore. |
| Android E2E / Maestro | Pass for local smoke, fallback, and mock suite | `npm run test:e2e:smoke -- --no-restart-metro --metro-timeout-ms 180000` passed. `npm run test:e2e -- --flow maestro/recording-text-fallback.yml --metro-timeout-ms 180000` passed after Metro restart and one retry; final warm rerun with the scroll-aware flow passed the rationale -> text-only save path. The mock suite now passes locally: `JAVA_TOOL_OPTIONS=-Duser.home=/private/tmp/dreamer-maestro-home HOME=/private/tmp/dreamer-maestro-home MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED=true npm run test:e2e -- --suite mock --no-restart-metro --metro-timeout-ms 180000` -> 7/7 flows passed in 1 attempt each. |
| Play Internal Testing install | Not verified | Requires signed AAB uploaded to Play and tester install from Play. |

## Android E2E Operating Strategy

Use layered Maestro runs to keep debug cycles fast:

1. While fixing a flow, run only the broken flow with no retry:
   - `npm run test:e2e -- --flow maestro/mock-existing-user.yml --no-restart-metro --retries 0`
2. After a shared subflow change such as `maestro/subflows/open-mock-app.yml`, run canaries:
   - `npm run test:e2e:canary:fast`
   - Canary suite: `mock-existing-user`, `journal-badges-filters`, `subscription-mock-paywall`.
3. Before marking the related area OK, run the affected suite:
   - `npm run test:e2e:mock -- --no-restart-metro`
4. Keep `npm run test:e2e:android:all` for CI, nightly, or release safety runs, not every patch.

Speed rules:

- Use `--no-restart-metro` when Metro is already warm.
- Use `--retries 0` during debug, then allow the default retry on the final suite run.
- Use `--parallel auto --device emulator-5554,emulator-5556` when multiple emulators are connected.
- Prefer test IDs, direct mock profile hooks, and route/deep-link helpers over generic waits and scroll hunting.

## Local Implementation Status - Quick Wins

Updated after implementation pass on 2026-05-04:

| Quick win | Local status | Remaining gate |
| --- | --- | --- |
| Play Integrity env visible in EAS profiles | Done in `eas.json` for `preview`, `release`, `production`, `production-apk`, plus `.env.teststore`. | Confirm `359653779023` in Google Cloud and verify from a Play-installed build. |
| Clean one real lint issue | Done: removed unused `GEMINI_FLASH_MODEL` import from `supabase/functions/api/routes/chat.ts`. | None locally. |
| Document lint warning policy | Done: ESLint now allows intentional require bridges in tests and controlled runtime module bridges; lint is 0 warnings. | Keep future warnings intentional. |
| Product analytics facade and first five events | Done: `lib/analytics.ts` tracks `recording_started`, `recording_saved`, `analysis_started`, `analysis_completed`, `paywall_viewed`; unit tests added. | Choose and wire a native analytics provider later. |
| Recording permission pre-prompt | Done: Android voice recording shows a rationale sheet with a text fallback before requesting microphone permission. | Real permission-denied and speech-unavailable device paths still need validation beyond the mock text-fallback flow. |
| Contextual paywall trigger | Done: `/paywall` accepts trigger params from analysis limit, analysis CTA, exploration limit, settings, quota settings, and returning device state. | Native provider/paywall analytics validation after provider selection. |
| Android release checklist | Done: `doc_web_interne/docs/android-release-checklist.md` added and linked from production docs. | Complete Play Console, Supabase secrets, AAB upload, and internal testing gates. |
| Android release gate preflight | Done: `scripts/check-android-release-gates.js` plus `npm run android:gates` and `npm run android:gates:strict` make local, blocked, and manual Android release gates reproducible. | Complete manual Play/Supabase/RevenueCat checks. |

## Local Implementation Status - Medium Chantiers

| Chantier | Local status | Remaining gate |
| --- | --- | --- |
| First-use onboarding | Mostly done locally: empty journals now show a first-use guide on the recording screen, framing first value, optional voice/text capture, privacy/mic expectations, and backup after value. First dream capture still routes to analysis without visiting Settings, and analyzed guest dreams show a backup/signup prompt framed as protecting the journal after value is delivered. | Android visual QA remains, plus a product decision if an explicit language-picker step should be added before capture. |
| Recording UX hardening | Done locally: recording now exposes an inline voice status for ready/preparing/recording/busy states, shows recording duration, routes permission/STT/language/no-speech/start failures into text fallback, and offers retry voice from text mode. Test IDs were added for the voice status, fallback notice, and mic rationale actions. `maestro/recording-text-fallback.yml` is registered and now passes locally for the rationale -> text-only save path. | Android visual QA plus real permission-denied and speech-unavailable device execution remain. |
| Journal scan redesign | Done locally: phone journal now keeps quick scan filters compact (`favorites`, `analyzed`, `explored`) and moves theme/type/date into a dedicated advanced-filter bottom sheet. Dream cards also render state badge labels alongside icons so analyzed/explored/sync states are readable while scanning. Unit/i18n coverage was updated. | Android visual QA and a real small-screen pass remain. |
| Dream detail restructuring | Done locally: the detail screen now separates dream memory, AI reading, transcript, and actions with explicit zone headers, keeps a compact primary action card above the reading area, and adapts the next action for unanalyzed, failed, pending, ready-to-explore, and continuing-exploration states. Dedicated test IDs and i18n coverage were updated. | Android visual QA remains. |
| Paywall variants | Done locally: `lib/paywallVariants.ts` maps analysis limit, analysis CTA, exploration limit, image generation, settings, quota settings, restore, returning device, and direct browsing to distinct copy/benefit/CTA keys. `/paywall` renders the trigger chip, contextual headline, benefits, CTA, restore, and a clear `Continue free` escape hatch. | Android visual QA and purchase/restore validation from Play Internal Testing. |
| Native analytics provider | Done locally for a safe debug provider: `lib/analytics.ts` now auto-configures an injectable debug sink when `EXPO_PUBLIC_ANALYTICS_DEBUG=true`, redacts unknown/non-primitive properties, and is initialized at app startup. | Choose and integrate the production analytics vendor later; verify debug logs on an Android device once `adb`/device access exists. |

## Current App Map

### Navigation / first session

- Root navigation redirects initial launch and foreground return to `/recording`.
- Returning guests who previously created an account are redirected to Settings/Auth.
- Native tabs are enabled on Android via `expo-router/unstable-native-tabs`.
- There is no separate first-run onboarding route. First user value is still direct recording, now supported by an inline first-use guide on empty journals.

Product read:

- Strong for "capture a dream quickly".
- Weak for explaining value, permissions, privacy, quota, and AI result expectation before first action.

### Recording / home

Strengths:

- Voice and text entry are both present.
- Transcript is clamped to a configured max length.
- Partial transcript merge and auto-stop on length limit exist.
- Recording stops on blur/unmount.
- Offline model prompt handling exists for Android speech recognition.
- Analysis progress and quota/paywall sheets exist.

Risks:

- First-run value education is mostly absent.
- Audio flow still depends on native speech availability and model state; the UX should make fallback states more obvious.
- Recording is treated as the home screen, but navigation labels still call another tab "Home"; this can feel conceptually split.

Priority:

- Keep the Android-first first-use flow anchored in recording with one "record or type" success path.
- Add permission rationale before microphone permission and a visible text fallback if speech is unavailable.

### Journal

Strengths:

- Uses `FlashList`.
- Search, filters, analyzed/favorite/explored states, date filters, image preloading, scroll-idle optimizations are implemented.
- Empty state exists.
- Floating add button keeps capture accessible.

Risks:

- Filter density can be high for small Android screens.
- No obvious onboarding of what an analyzed vs explored dream means.
- Large visual atmosphere/card system may reduce scanning speed in a journal that should become a repeated-use tool.

Priority:

- Compact Android journal mode: search + segmented filter row + bottom sheet for advanced filters.
- Add lightweight badges and microcopy for "saved", "analyzed", "explored", "sync pending".

### Dream detail / AI analysis

Strengths:

- Edit title/theme/type/transcript is supported.
- Image retry/replacement, reference image flow, sharing, conflict/sync actions, exploration chat links exist.
- Re-analysis and quota sheets exist.
- Floating explore button is conditioned by scroll state.

Risks:

- The screen carries many modes, sheets, and actions; cognitive load is high.
- AI analysis should be structured as "interpretation / patterns / next reflection / explore" rather than a long content page.
- Error and sync states exist technically, but should be more product-visible.

Priority:

- Redesign detail into three stable zones: dream memory, AI reading, actions.
- Make sync/error and quota state readable without modal hunting.

### Paywall

Strengths:

- Loads RevenueCat packages.
- Monthly/annual selection and annual discount are supported.
- Restore, success toast, error sheet, auth-required state, and device-upgraded state exist.
- Purchase is blocked until identified user if required.

Risks:

- Paywall is plan-led, not moment-led. It does not always explain the specific thing the user was trying to unlock.
- Hard-coded `activeTierKey = 'plus'` suggests only one tier is fully expressed in copy.
- The paywall should come after value: first analysis, exploration limit, or saved journal habit.

Priority:

- Add context-aware paywall variants: analysis limit, exploration/chat limit, image generation, returning device.
- Add "continue free" affordance and cooldown/frequency control for non-limit prompts.

### Settings / signup

Strengths:

- Email auth card, Google sign-in support, language, theme, notifications, quota, subscription are grouped.
- Returning guest block is handled.
- App version is available.

Risks:

- Signup lives in Settings, which is a low-intent location for first-run conversion.
- Google Sign-In depends on correct Android OAuth SHA-1 and Play App Signing certificate setup.
- Email verification flow needs measurement and friction checks.

Priority:

- Introduce auth as a progressive save/backup step after first value, not a cold requirement.
- Add social auth prominence and clear "save your dream history" framing.

## Android / Deployment Readiness

Current positives:

- `app.json` sets Android package `com.tanuki75.noctalia`.
- Android permissions are scoped to audio recording and audio settings.
- App Links are configured for `https://dream.noctalia.app`.
- `expo-dev-client` is installed and EAS has a `development` profile with `developmentClient: true`.
- `production` EAS profile builds Android AAB with remote credentials and autoIncrement.
- `submit.internal.android.track = internal` exists.
- Existing docs correctly state that Play Billing, Play Integrity, and Play App Signing SHA behavior must be tested from Play Internal Testing, not sideloaded builds.

Remaining config gaps / warnings:

- `EXPO_PUBLIC_PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER=359653779023` is now visible in the local EAS profiles (`preview`, `release`, `production`, `production-apk`) and `.env.teststore`; it still needs Google Cloud project-number confirmation and Play-installed validation.
- Supabase function secrets must be verified outside the repo: `PLAY_INTEGRITY_SERVICE_ACCOUNT_JSON_BASE64`, `PLAY_INTEGRITY_PACKAGE_NAME=com.tanuki75.noctalia`, `GUEST_SESSION_SECRET`.
- Google Sign-In production needs the Play App Signing SHA-1 added to the Android OAuth client after the first Play upload.
- `production-apk` includes Google Web Client ID and the Play Integrity project number; production still needs Expo Dashboard/EAS env confirmation if the team prefers dashboard-managed variables over profile `env`.
- Expo Doctor is clean, so these are release-environment gates, not local package-health failures.

Recommended Android gate sequence:

1. Add/confirm EAS env values for production/preview:
   - `EXPO_PUBLIC_PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER`
   - `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`
   - `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`
   - `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`
   - `EXPO_PUBLIC_API_URL`
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
   - `EXPO_PUBLIC_SUPABASE_FUNCTION_JWT` if Edge Functions require legacy anon JWT
2. Confirm Supabase function secrets:
   - `PLAY_INTEGRITY_SERVICE_ACCOUNT_JSON_BASE64`
   - `PLAY_INTEGRITY_PACKAGE_NAME`
   - `GUEST_SESSION_SECRET`
3. Build signed AAB: `npx eas-cli@latest build -p android --profile production`.
4. Upload to Play Internal Testing.
5. Copy Play App Signing SHA-1 from Play Console App Integrity and add to Google Cloud Android OAuth client.
6. Install only from Play Internal Testing and test:
   - guest session bootstrap
   - Google Sign-In
   - RevenueCat offering load
   - purchase / restore
   - quota limit to paywall
   - App Links open dream routes

## Analytics / Measurement Gap

Current state:

- Vercel Analytics and Speed Insights are mounted in root layout, useful mostly for web.
- `lib/analytics.ts` now provides a native-safe product analytics façade with provider injection, debug logging via `EXPO_PUBLIC_ANALYTICS_DEBUG=true`, and no-op behavior in mock mode.
- The first mobile events are wired for recording, analysis, and paywall view. Remaining signup, purchase, offline, and error events are still part of the measurement backlog.

Tracking plan:

| Event | Properties | Decision it supports |
| --- | --- | --- |
| `onboarding_step_completed` | `step_name`, `step_index`, `is_returning_guest` | Which first-run steps create activation/dropoff. |
| `recording_started` | `input_mode`, `language`, `speech_available`, `offline_model_state` | Whether voice-first works on Android. |
| `recording_saved` | `input_mode`, `duration_bucket`, `transcript_length_bucket` | Activation and habit formation. |
| `analysis_started` | `source`, `tier`, `guest_status` | AI demand and quota pressure. |
| `analysis_completed` | `duration_ms_bucket`, `generated_image`, `tier` | AI value delivery reliability. |
| `analysis_failed` | `error_type`, `status`, `guest_session_state` | API/AI hardening priorities. |
| `paywall_viewed` | `trigger`, `tier`, `usage_count`, `offering_id` | Paywall timing and context performance. |
| `paywall_cta_tapped` | `package_interval`, `price`, `trigger` | Package and copy performance. |
| `purchase_completed` | `package_interval`, `product_id`, `trigger` | Revenue conversion. |
| `signup_started` | `method`, `trigger` | Signup entry points. |
| `signup_completed` | `method`, `trigger` | Account conversion. |
| `guest_session_degraded` | `reason_code`, `platform` | Play Integrity/env reliability. |
| `offline_sync_queued` | `operation`, `queue_size` | Offline robustness and sync health. |

Implementation note:

- Add a small `lib/analytics.ts` facade first. It can no-op in development or mock mode, and later forward to a native analytics provider. Avoid scattering vendor calls through screens.
- **Local repo update: done for provider injection and debug sink.** Production vendor selection remains a product/ops decision.

## Prioritized Backlog

### Quick Wins - 0.5 to 2 days

1. Make Play Integrity env visible in EAS profiles. **Local repo update: done for `preview`, `release`, `production`, `production-apk`; Play-installed verification still external.**
   - Add/confirm `EXPO_PUBLIC_PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER` for Android preview and production.
   - Acceptance: no `Missing EXPO_PUBLIC_PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER` on Play-installed Android build.

2. Clean one real lint issue.
   - Remove unused `GEMINI_FLASH_MODEL` import from `supabase/functions/api/routes/chat.ts`.
   - Acceptance: lint warning count decreases and stays 0 errors.

3. Document lint warning policy.
   - Either allow `require()` in tests through ESLint overrides or migrate highest-value test files to dynamic imports.
   - Acceptance: warnings are intentional, not noise.

4. Add product analytics facade and first five events.
   - `recording_started`, `recording_saved`, `analysis_started`, `analysis_completed`, `paywall_viewed`.
   - Acceptance: events are unit-tested and no-op safely without provider config.

5. Improve recording permission pre-prompt.
   - Before microphone request, explain "record now, edit before analysis, text fallback available".
   - Acceptance: Android user can choose text fallback if mic/speech is unavailable.

6. Add contextual paywall trigger property.
   - Pass `trigger` into `/paywall` route or shared paywall state.
   - Acceptance: paywall can distinguish limit, settings, restore, analysis CTA.

7. Add Android release checklist to README or internal doc index. **Local repo update: `doc_web_interne/docs/android-release-checklist.md`.**
   - Acceptance: build -> internal test -> SHA -> OAuth -> Play Integrity steps are one command/checklist away.

### Medium Chantiers - 3 to 10 days

1. First-use onboarding.
   - **Local repo update: mostly done for inline first-use guide, voice/text path, first-dream analysis prompt, and post-value backup/signup prompt after a guest receives an analyzed dream.**
   - Flow: language/benefit -> privacy/mic rationale -> first dream capture -> AI result -> save/backup signup.
   - Acceptance: new user can reach first analyzed dream without visiting Settings.

2. Recording UX hardening.
   - **Local repo update: done for inline voice status, recording duration, text fallback notices, retry voice, and a text-fallback Maestro flow.**
   - Make speech availability, offline model state, text fallback, retry, and recording duration states explicit.
   - Acceptance: Maestro mock flow covers permission denied, speech unavailable, text-only save.

3. Journal scan redesign.
   - **Local repo update: done for compact phone quick filters, an advanced theme/type/date bottom sheet, readable analyzed/explored quick filters, and visible card state badge labels.**
   - Compact search, segmented quick filters, advanced filter bottom sheet, clearer state badges.
   - Acceptance: one-handed Android journal scan works on small viewport without crowded filter rows.

4. Dream detail restructuring.
   - **Local repo update: done for explicit memory / AI reading / transcript / actions separation and primary action clarity across unanalyzed, failed, pending, ready-to-explore, and continuing states.**
   - Separate memory, interpretation, generated image, and explore actions.
   - Acceptance: primary action is obvious for unanalysed, analysed, failed, and sync-pending dreams.

5. Paywall variants.
   - Limit reached, exploration/chat, image generation, settings subscription, returning device.
   - Acceptance: each variant has tailored headline, benefits, packages, restore, and continue-free logic.

6. Native analytics provider.
   - **Local repo update: done for provider injection, startup configuration, and redacted debug event sink via `EXPO_PUBLIC_ANALYTICS_DEBUG=true`.**
   - Choose provider and wire production native mobile events through `lib/analytics.ts`.
   - Acceptance: debug build can verify events on Android device without leaking PII.

7. Android E2E reliability. **Local update: Android smoke, recording text-fallback, and mock suite now pass on the local Pixel_8_API_36 emulator; gate preflight reports 0 blocked local gates. A `canary` suite and `:fast` scripts were added for layered debug runs.**
   - Run only broken flows during debug, run canaries after shared subflow changes, then run the affected suite before marking the area OK.
   - Acceptance: `npm run test:e2e:smoke`, `npm run test:e2e:canary:fast`, and `npm run test:e2e:mock` are available; current local mock suite passed 7/7.

### Gros Chantiers - 2 to 6 weeks

1. Play Store Internal Testing readiness.
   - Signed AAB, Play App Signing, SHA-1 OAuth, Play Integrity API, RevenueCat Google Play products, Data safety, internal testers.
   - Acceptance: a Play-installed internal tester can record, analyze, sign in, purchase, restore, and pass App Links.

2. Robust API / AI / offline system.
   - Durable local queue for AI operations, retry/backoff UI, sync conflict surfacing, degraded guest mode messaging.
   - Acceptance: airplane mode save works; reconnect sync is visible; failed AI can retry without duplicate dreams.

3. Onboarding and monetization experimentation.
   - Build activation funnel and paywall experiments around first analysis and exploration limit.
   - Acceptance: activation, paywall CTR, purchase completion, and churn signals are measurable by cohort.

4. Store ASO and screenshot system.
   - Produce Play screenshots for recording, journal, AI analysis, paywall, privacy/offline reliability.
   - Acceptance: screenshots reflect real UI states and store copy matches actual features.

5. Design system consolidation.
   - Keep Noctalia palette and typography, reduce repeated glass/card patterns, define Android motion and spacing rules.
   - Acceptance: screens feel coherent but task-focused, with fewer repeated decorative cards.

## Product Priorities

Highest leverage sequence:

1. Make Android release env reliable: Play Integrity + Google OAuth SHA + RevenueCat.
2. Prove activation: first dream saved and first analysis completed.
3. Put signup after value, framed as backup/sync.
4. Trigger paywall from real usage limits, not generic plan browsing.
5. Measure the funnel before redesigning every screen.
6. Polish store readiness once the Play-installed flow is proven.

## Prompt-To-Artifact Checklist

Current evidence inspected on 2026-05-05:

| Requirement from objective / audit prompt | Concrete artifact or command evidence | Coverage | Remaining |
| --- | --- | --- | --- |
| Execute the Android mobile audit backlog in `doc_web_interne/docs/android-mobile-audit-2026-05-04.md` | This document now contains scope, screen map, prioritized backlog, implementation status, verification snapshot, release gates, and completion audit. | Covered as an audit artifact. | Keep updating after device/Play gates. |
| Start with quick wins | Quick-win status maps to `eas.json`, `.env.teststore`, `eslint.config.js`, `supabase/functions/api/routes/chat.ts`, `lib/analytics.ts`, `app/recording.tsx`, `lib/paywallRoute.ts`, `doc_web_interne/docs/android-release-checklist.md`, and `scripts/check-android-release-gates.js`. | Local quick wins implemented and verified. | Play-installed Play Integrity confirmation remains external. |
| Verify with Expo dependency checks | `npx expo install --check` reports `Dependencies are up to date`; `npx expo-doctor` reports `18/18 checks passed`. | Covered. | None locally. |
| Verify TypeScript | `npm run typecheck:app` passes with `tsc --noEmit`. | Covered. | None locally. |
| Verify lint | `npm run lint` passes with 0 errors and 0 warnings. | Covered. | Keep future require bridges intentional. |
| Verify unit/integration tests | `npm test -- --runInBand --watch=false --no-watchman` passes: 95 suites, 1060 tests. | Covered for local automated tests. | Existing Jest console noise/open-handle note remains non-failing. |
| Verify diff hygiene | `git diff --check` passes. | Covered. | None locally. |
| Track Play Console gates | `doc_web_interne/docs/android-release-checklist.md`, `doc_web_interne/docs/PRODUCTION_PREP.md`, and this audit list Play Integrity, Play App Signing SHA-1, Google OAuth, internal testers, Data safety, and AAB upload gates. | Tracking covered. | Requires Play Console access and signed Play-installed build. |
| Track device gates | `npm run android:gates:strict` reports 7 pass, 0 fail, 0 blocked, 4 manual; adb/device and Maestro are locally available. | Tracking covered. | Keep local tooling healthy for the broader mock/core pass. |
| Track external service gates | Checklist and gate report call out Supabase Play Integrity secrets and RevenueCat Play purchase/restore validation. | Tracking covered. | Requires Supabase secret verification and Play Internal Testing purchase/restore run. |
| Add Android smoke/E2E coverage where possible | `maestro/recording-text-fallback.yml` exists, is registered in `scripts/run-maestro-android.js`, and passes locally; Android smoke also passes locally. `npm run test:e2e -- --suite mock --no-restart-metro --metro-timeout-ms 180000` passes locally with 7/7 mock flows. | Covered for smoke, rationale -> text-only save path, existing-user journal, quotas, filters, detail CTAs, metadata edit, rituals, and mock paywall purchase state. | Real permission-denied/speech-unavailable paths, Play-installed validation, and full `all` suite remain release/CI gates. |
| Play Store Internal Testing preparation | `eas.json` internal submit track is configured and release checklist documents the sequence. | Local prep covered. | Upload AAB, install from Play, validate auth, purchase, restore, and Play Integrity. |
| ASO and screenshots | Large chantier defines a screenshot system for recording, journal, AI analysis, paywall, privacy/offline reliability. | Planned and tracked. | Requires final Android UI states and store assets. |
| Imagegen mobile direction | Generated concept mockups were produced using the current Noctalia palette and typography: `/Users/tanuki/.codex/generated_images/019df4a2-3181-7671-b78c-c534df1a1807/ig_0aed500bd2b842690169f8ff6b65108191bf6a7ba460e8507c.png`. | Covered as visual direction. | Real in-app screenshot QA remains device-gated. |

## Completion Audit - Current State

Status: not complete enough to close the goal, because required Play/external-service gates, Play-installed purchase/auth validation, Android visual QA, and a few product decisions remain outside local verification.

| Objective deliverable | Evidence | Remaining |
| --- | --- | --- |
| Execute quick wins | Local implementation status marks all quick wins done; lint/typecheck/Jest are green. | Play-installed Play Integrity confirmation is external. |
| Execute medium local backlog | Recording UX, journal scan, dream detail, and paywall variants are done locally; first-use onboarding is mostly done locally with one product decision left. | Android visual QA and optional explicit language-picker decision. |
| Verify with Expo/TypeScript/lint/test | `npx expo install --check`, `npx expo-doctor`, `npm run typecheck:app`, `npm run lint`, `npm test -- --runInBand --watch=false --no-watchman`, and `git diff --check` pass. | Jest still reports existing console noise/open-handle note. |
| Track Play/device/external-service gates | Play Integrity, Google OAuth SHA-1, Supabase secrets, RevenueCat purchase/restore, Play Internal Testing, Android E2E, ASO screenshots, and device visual QA are documented. `npm run android:gates:strict` reports 7 pass, 0 fail, 0 blocked, 4 manual. | Requires Play Console, signed Play-installed build, Supabase secret verification, RevenueCat Play validation, and store assets. |
| Android E2E execution | Android smoke passes locally. Recording text-fallback Maestro flow is added to the suites and passes locally for the Android mic rationale -> text-only save path. The mock suite passes locally with 7/7 flows in 1 attempt each, and `test:e2e:canary(:fast)` plus `test:e2e:mock:fast` support layered debug runs. | Real permission-denied/speech-unavailable paths, Play-installed validation, and full `all` suite remain release/CI gates. |
