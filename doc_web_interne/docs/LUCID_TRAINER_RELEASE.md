# Noctalia Lucid Trainer — release runbook

This runbook turns the local Lucid Trainer implementation into an auditable release candidate. It does not authorize `expo prebuild`, EAS builds, signing, Supabase migration deployment, DNS changes, RevenueCat changes, store submission, or publication. Each external mutation needs explicit authorization.

## 1. Candidate identity and prerequisites

Freeze and record the candidate before validation:

```powershell
git status --short
git rev-parse HEAD
node --version
npm --version
```

Required local state:

- dependencies installed from the lockfile;
- no unrelated candidate changes hidden or discarded;
- `.env.lucid` or `.env.lucid.mock` present locally and excluded from version control;
- no secret copied into screenshots, logs, documentation, or tracked files;
- both variant selectors resolve to `lucid`: `NOCTALIA_APP_VARIANT` for Expo/native configuration and `EXPO_PUBLIC_APP_VARIANT` for the runtime shell.

Inspect resolved configuration without generating native projects:

```powershell
$env:NOCTALIA_APP_VARIANT='lucid'
$env:EXPO_PUBLIC_APP_VARIANT='lucid'
npx expo config --type public
```

Confirm the resolved name, slug, scheme, bundle/package identifiers, universal-link host, disabled microphone permission, bundled cue sounds, `withLucidNoctaliaQueries`, and absence of the inherited EAS project/update URL. Also confirm that `withDisableNotificationsBootActions` is absent from the Lucid plugin list. `expo config` is configuration evidence only: plugin, sound, URL-query, and boot-receiver changes require a fresh native rebuild before they can exist in an installed binary. It is not signing, runtime-shell, or device proof. A mismatch between the two variant selectors is a release blocker.

## 2. Deterministic local gate

Run narrow tests first, then broaden. The file list may be extended when the candidate changes.

```powershell
npm run test:file -- lib/lucid/__tests__/appVariant.test.ts lib/lucid/__tests__/content.test.ts lib/lucid/__tests__/model.test.ts lib/lucid/__tests__/domain.test.ts lib/lucid/__tests__/progress.test.ts lib/lucid/__tests__/reminders.test.ts lib/lucid/__tests__/audio.test.ts lib/lucid/__tests__/analytics.test.ts lib/lucid/__tests__/deepLinks.test.ts lib/lucid/__tests__/routes.test.ts lib/__tests__/productAnalytics.test.ts lib/__tests__/productAnalyticsGuestSession.test.ts services/__tests__/lucidTrainerSecureStorage.test.ts services/__tests__/lucidTrainerStorage.test.ts services/__tests__/lucidTrainerSync.test.ts services/__tests__/lucidTrainerNotifications.test.ts tests/app-routes/lucidColdRouteNavigation.test.tsx tests/app-routes/lucidAccount.test.tsx context/__tests__/LucidTrainerContext.test.tsx --watchman=false
npm run typecheck:app
npm run typecheck:tests
npx expo lint app/lucid components/lucid context/LucidTrainerContext.tsx lib/lucid services/lucidTrainerSecureStorage.ts services/lucidTrainerStorage.ts services/lucidTrainerSync.ts services/lucidTrainerNotifications.ts services/lucidTrainerCloudData.ts services/lucidTrainerExport.ts
npx expo-doctor
npm run security:audit:mobile
npm run android:gates
```

Then run the full repository suites if the candidate is intended for release:

```powershell
npm test -- --watchman=false
npm run lint
```

Record command, exit code, date, operating system, Node/npm versions, and candidate SHA. A local pass is candidate evidence; it is not Android, iOS, store, account, or production evidence.

## 3. Expo development-runtime UI validation

Start with the canonical profile and Expo Go/development runtime:

```powershell
npm run start:lucid:mock
```

Capture screenshots or a short recording for each tested device/profile. Verify:

- first launch and all onboarding steps in FR, EN, ES, DE, and IT;
- manual fallback after notification denial;
- MILD, SSILD, and WBTB seven-session progression;
- optional audio preview, low-volume control, timer, stop, and sleep-first messages;
- morning entry, no-recall entry, trends, weekly review, export, and local deletion;
- offline relaunch with previously saved state;
- Settings: system/light/dark, system text scaling, reduce motion, language, weekly frequency, reminder count, bedtime, wake time, and device time zone;
- keyboard dismissal and no blocked actions on small screens;
- large screens/tablets without uncontrolled stretching;
- TalkBack or VoiceOver focus order, names, states, progress, errors, and 44-point touch targets;
- Noctalia lucid ritual bridge opens `/lucid` without modifying the journal;
- optional handoff sends only the consented categorical payload and opens the public `https://dream.noctalia.app/` home fallback, with the same bounded query, if Noctalia is unavailable;
- a native cold start with both variant selectors actually lands in the Lucid shell rather than Noctalia.

Development-runtime results must be labelled by platform and environment. Expo Go on Android is not a signed Android candidate; an Android emulator is not a physical-device result; Windows cannot provide iOS-device evidence.

## 4. Notification, time, and resilience matrix

Exercise each case independently and preserve the scheduled-notification inspection where possible:

| Case | Expected result |
| --- | --- |
| Permission not requested | Core training works; no surprise prompt |
| Permission denied | No scheduled Trainer reminders; in-app flows remain available |
| Permission later granted | Only owned `lucid-trainer` reminders are reconciled |
| Bed/wake edit | Reality checks, bedtime preparation, morning review, and active WBTB plan are rebuilt |
| Time-zone change | Zone/offset mismatch triggers replacement on foreground |
| Daylight-saving change | Foreground reconciliation uses the current offset |
| Android reboot | Rebuilt Lucid binary should retain/restore scheduled notifications through Expo Notifications boot support; record manifest and physical-device evidence before claiming success |
| Offline | Local saves succeed; sync remains pending and retryable |
| Remote conflict | Local data remains available and exportable; merge follows entity rules |
| Native night cue | Eligible future-time cues use one-off `DATE` triggers and bundled pre-attenuated sounds; expired cues are cancelled and never replayed |
| OS kills JavaScript | Already-scheduled native cues do not depend on a JS timer, but delivery timing/reliability still needs rebuilt-artifact and device evidence |
| SecureStore temporarily locked | Ciphertext stays intact; loading surfaces a retryable error rather than overwriting with defaults |
| Tampered/corrupt local value | AES-256-GCM/AAD validation rejects it and recovery removes only the affected scoped key |
| Legacy native plaintext | A valid value is migrated to AES-GCM only after schema validation; invalid plaintext is removed, not encrypted |
| Full deletion while signed in | Cloud RPC runs even if the sync toggle is off and must create reset fence/tombstones before local snapshot, queue, reminders, and night cues are removed |
| Cloud deletion offline/fails | No success confirmation and no local erasure; preserve the export and retry after connectivity |

Use a physical device for reboot, suspension, alarm, Doze/background, speaker volume, interruption, and partner-safe audio tests. A `DATE` trigger is an absolute scheduling request, not proof of exact alarm delivery. Record model, OS version, build type, app version, time zone, battery policy, scheduled identifier, expected time, observed time, and result.

## 5. Android candidate gates

Only after explicit authorization for native build/signing:

- produce a non-debuggable candidate with the Lucid application ID;
- confirm manifest permissions and absence of microphone/storage permissions not required by Trainer;
- confirm `RECEIVE_BOOT_COMPLETED`, the Noctalia custom-scheme `<queries>` entry, all cue sound resources, and the absence of the boot-action disabling plugin in the generated Lucid binary;
- verify HTTPS App Link association for `lucid.noctalia.app` on the installed candidate;
- test fresh install, upgrade path if one exists, reboot restoration of a scheduled reminder and night cue, notification denial/re-enable, native cue delivery after JS suspension, expiry without replay, cancellation, audio interruption, offline restart, encrypted legacy migration, export/share, cloud-first delete, stale-device reset rejection, account switch, purchase, and restore;
- run the smallest applicable Maestro smoke flow on the installed artifact;
- preserve APK/AAB checksum, signing fingerprint, build logs, install source, and device evidence.

Do not call an emulator installation “physical-device proof” or an unsigned/debug artifact a store candidate.

### 5.1 EAS build and Play submission path

`eas.json` carries two companion profiles that set both variant selectors
(`NOCTALIA_APP_VARIANT=lucid`, `EXPO_PUBLIC_APP_VARIANT=lucid`) and the shared
backend URL: `lucid-preview` (internal APK for device gates) and
`lucid-production` (store AAB, remote credentials, auto-incremented
versionCode). The companion starts its own version line (`1.0.0`, versionCode
`1`) in `app.config.ts`; EAS owns build numbers afterwards.

Because `app.config.ts` removes the inherited `extra.eas.projectId`, the
companion is a **separate EAS project** (`@tanuki75/noctalia-lucid-trainer`).
Before the first build, once and interactively:

1. `NOCTALIA_APP_VARIANT=lucid EXPO_PUBLIC_APP_VARIANT=lucid npx eas-cli@latest init`
   → creates/links the companion project. Record its project ID here (do not
   write it into `app.json`, which stays Noctalia's).
2. Create the EAS environment variables of that project (`preview` and
   `production` environments), never in tracked files:
   `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`,
   `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` (the companion's own public key, see §7),
   and optionally `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` +
   `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` (both or neither).
3. Generate the Android keystore for `com.tanuki75.noctalia.lucid`
   (`eas credentials -p android`, or accept the prompt of the first
   interactive `eas build`). Never reuse Noctalia's keystore.
4. Create the Play Console application for `com.tanuki75.noctalia.lucid`,
   link it to Google Cloud project `359653779023` (Play Integrity), grant the
   existing service account access to it, and complete Data Safety, privacy
   policy, listing assets and content rating.
5. **Upload the first AAB manually** in Play Console (Internal testing).
   Google Play requires the first upload of a new application through the
   console; `eas submit` works from the second build on.

Then, per candidate:

```powershell
$env:NOCTALIA_APP_VARIANT='lucid'; $env:EXPO_PUBLIC_APP_VARIANT='lucid'
npx eas-cli@latest build -p android --profile lucid-production
npx eas-cli@latest submit -p android --profile internal --latest
```

The variant environment must also be set on the shell that runs `eas`,
so that the CLI resolves the companion `app.config.ts` identity locally.

## 6. iOS candidate gates

Validate independently after explicit authorization and access to Apple signing:

- resolved bundle ID and associated domains;
- Simulator layout, navigation, appearance, large text, reduce motion, and VoiceOver smoke;
- physical-device notification timing, audio session/interruption, background/suspension behavior, universal links, export/share, deletion, purchase, and restore;
- App Privacy answers against actual analytics and data flows.

Windows-local typecheck/export/Android results are not iOS proof. Record Xcode version, iOS version, device, signing identity class, build number, and evidence location.

## 7. External service readiness

These are explicit release dependencies, not assumptions:

- deploy and verify the Lucid Trainer Supabase migration with rollback/recovery reviewed;
- verify row-level security and shared-account isolation with two distinct test users;
- register the companion as another application in the same RevenueCat project, attach its products to the exact shared entitlement, and supply only its own public SDK keys through the build environment;
- verify purchase, restore, expiry, account switch, offline entitlement cache, and unknown-entitlement denial;
- register companion-specific Google OAuth clients for
  `com.tanuki75.noctalia.lucid`, configure the Android/web and iOS client IDs,
  before enabling Google sign-in in a signed candidate; the source config now
  omits the provider entirely when either client ID is absent and rejects a
  partial configuration. Email authentication remains the local account path
  until this external configuration is proven;
- before enabling Google on iOS, implement and prove an equivalent login option
  meeting Apple App Review Guideline 4.8 (normally Sign in with Apple), or retain
  company-owned email authentication only;
- publish and verify Apple App Site Association and Android Digital Asset Links for `lucid.noctalia.app`;
- confirm Noctalia custom-scheme query allowance and the real HTTPS fallback to `https://dream.noctalia.app/` rather than a native-only `/recording` path;
- verify `delete_lucid_trainer_data` creates revisioned tombstones plus a durable reset fence, and that a stale offline queue cannot recreate deleted data;
- obtain privacy/legal review for data categories, retention, deletion, export, analytics consent, scientific language, and support copy;
- review all five localized science/help surfaces and store copy for the same boundaries: wellness training only, no medical or individual-success claim, no REM/sleep-stage detection, self-reported and confounded personal trends, limited long-term/frequent-interruption evidence, optional WBTB/audio, and sleep-first stop guidance;
- prepare unique store metadata demonstrating Trainer's standalone day/night/morning/weekly loop.

Never put service-role keys, store credentials, signing material, or RevenueCat private keys in `EXPO_PUBLIC_*` variables or tracked files.

## 8. Release decision record

The candidate is ready for a release decision only when the evidence table is complete:

| Gate | Evidence required | Status |
| --- | --- | --- |
| Local deterministic checks | SHA, commands, exit codes | Pending per candidate |
| Expo UI | Device/profile screenshots and checklist | Pending per candidate |
| Android signed candidate | Artifact hash plus emulator and physical-device report | External gate |
| iOS signed candidate | Simulator and physical-device report | External gate |
| Supabase | Applied migration and two-user isolation evidence | External gate |
| Cloud deletion | RPC tombstones/reset fence plus stale-device rejection | External gate |
| RevenueCat/store billing | Purchase/restore/account/expiry evidence | External gate |
| Google account login | Companion OAuth clients, redirect scheme, Android and iOS sign-in evidence | External gate |
| Links | Verified AASA/assetlinks and installed-app fallback | External gate |
| Privacy/science/legal | Named approval and reviewed version | External gate |
| Store submission | Submission identifier and review state | Requires separate authorization |

For every failed gate, record whether it is a product regression, baseline repository issue, environment limitation, missing credential/account, or external configuration blocker. Do not replace missing evidence with an assertion.

## 9. Rollback and recovery

- Keep the default Noctalia variant unchanged; remove the Lucid variant from distribution without altering Noctalia journal data.
- Disable faulty reminders or night cues through the candidate configuration/UI; never delete user history as a rollback shortcut.
- Preserve local export before destructive support operations.
- For a sync incident, stop replay, retain the queue and local snapshot, export diagnostic metadata without free text, and resolve server state before retrying.
- Full cloud deletion is intentionally not a rollback mechanism: tombstones and the reset generation prevent stale replay. Restore only from a user-held export through a separately reviewed import path if one exists.
- For an entitlement incident, fail closed for premium access while retaining all recorded local data and free core training.
- Store rollback, database rollback, and DNS/association rollback require their own authorized runbooks and provider access.
