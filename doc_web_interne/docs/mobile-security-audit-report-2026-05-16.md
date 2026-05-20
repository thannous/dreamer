# Mobile Security Audit Report - 2026-05-16

## Scope

Initial implementation and local run of the Noctalia Expo mobile security audit.

Covered locally:

- Expo app config and EAS profiles.
- Client-exposed config values.
- Native storage patterns.
- Supabase auth/network helper behavior.
- Guest Play Integrity bootstrap.
- Supabase migration/webhook presence checks.
- Production logging heuristics.
- Dependency and Expo package health commands.

Not covered locally:

- Generated native Android/iOS manifests.
- APK/AAB/IPA string inspection.
- Real device storage/log inspection.
- Play-installed RevenueCat purchase/restore.
- Play Integrity server verification with production Play install.
- EAS dashboard variable visibility and secret classification.

## Commands Run

| Command | Result | Notes |
| --- | --- | --- |
| `node --check scripts/check-mobile-security.js` | Pass | Script parses cleanly. |
| `npm run security:audit:mobile` | Pass with warnings | 0 fail, 5 warn, 4 manual, 15 pass. |
| `npm run security:audit:mobile:strict` | Pass with warnings | Strict mode exits 0 because there are no `fail` findings. |
| `npm run typecheck:app` | Pass | `tsc --noEmit` completed successfully. |
| `npx expo install --check` | Fail | Several Expo SDK 55 patch packages are behind expected versions. |
| `npm audit --omit=dev --audit-level=high` | Fail | 148 total advisories, including 17 high; many are transitive through Expo/React Native tooling. |

## Automated Audit Summary

`npm run security:audit:mobile` currently reports:

- `0` fail
- `5` warn
- `4` manual
- `15` pass

## Warnings

### SEC-WARN-001 - Token-like Expo extra value is public

Evidence:

- `app.json` exposes `expo.extra.supabaseFunctionJwt`.

Risk:

- Anything in `expo.extra` is readable from the app bundle. This value must be treated as a public anon credential, not as a secret.

Next action:

- Verify all Supabase Edge Functions and RLS policies remain safe when this value is known by a user.
- Prefer server-side mediation for any function that depends on privileged secrets.

### SEC-WARN-002 - Android audio settings permission needs justification

Evidence:

- `android.permission.MODIFY_AUDIO_SETTINGS` is declared alongside `android.permission.RECORD_AUDIO`.

Risk:

- The permission may be legitimate for speech/audio behavior, but it should remain intentional and tested on real Android devices.

Next action:

- Confirm whether speech recognition or routing still needs it.
- Remove it if real-device testing shows no functional requirement.

### SEC-WARN-003 - Production logging review required

Evidence:

- The audit found `387` unconditional `console.*` calls in app code.

Risk:

- Production logs can accidentally include dream text, transcript snippets, user IDs, entitlement payloads, tokens, or backend error internals.

Next action:

- Route production diagnostics through a redacting logger.
- Wrap debug-only logs in `__DEV__`.
- Prioritize auth, dream chat, recording, quota, RevenueCat, and notification paths.

### SEC-WARN-004 - `production-apk` uses inline env only

Evidence:

- Production/release profiles found: `release:production`, `production-apk:inline-only`, `production:production`.

Risk:

- Inline profile env is easy to drift from EAS dashboard environments.

Next action:

- Keep `production-apk` as an inspection/debug artifact only, or align it with EAS production environment handling.

### SEC-WARN-005 - AsyncStorage usage must stay non-sensitive

Evidence:

- AsyncStorage imports found in:
  - `services/quota/GuestAnalysisCounter.ts`
  - `services/quota/GuestDreamCounter.ts`
  - `services/quota/MockQuotaEventStore.ts`
  - `services/storageServiceReal.ts`

Risk:

- AsyncStorage is unencrypted. It should not hold auth tokens, private credentials, unreviewed dream content, transcripts, or security-authoritative quota state.

Next action:

- Review each stored key and classify it as non-sensitive, sensitive-but-accepted, or needs migration/encryption.
- Confirm costly guest quotas remain server-authoritative.

## Dependency Findings

### DEP-001 - Expo packages behind expected SDK 55 patch versions

`npx expo install --check` recommends updating:

- `expo`
- `expo-build-properties`
- `expo-crypto`
- `expo-dev-client`
- `expo-file-system`
- `expo-linear-gradient`
- `expo-localization`
- `expo-network`
- `expo-notifications`
- `expo-secure-store`
- `expo-sharing`
- `expo-speech`
- `expo-splash-screen`
- `expo-sqlite`
- `expo-system-ui`
- `expo-updates`
- `expo-web-browser`
- `eslint-config-expo`

Next action:

- Run `npx expo install --fix` in a dedicated dependency update pass, then rerun `npm run typecheck:app`, `npm test`, `npx expo install --check`, and `npm run security:audit:mobile`.

### DEP-002 - Production dependency audit has high advisories

`npm audit --omit=dev --audit-level=high` reports:

- `148` total advisories.
- `17` high severity advisories.
- Notable high advisory families include `@xmldom/xmldom`, `node-forge`, and `picomatch`.
- Several issues are transitive through Expo/React Native dependencies; some report `No fix available`.

Next action:

- First try the safe patch path in a dependency update branch: `npm audit fix`.
- For remaining no-fix advisories, document exploitability in the mobile release context and track upstream Expo/React Native updates.

## Manual Gates Remaining

- Inspect generated AndroidManifest.xml and Info.plist.
- Inspect built APK/AAB/IPA strings for unexpected credentials or debug endpoints.
- Validate Android App Links and iOS Universal Links against live association files.
- Verify Play Integrity and RevenueCat from a Play-installed internal testing build.
- Inspect device logs and local storage after recording, analysis, chat, logout, account switch, and reinstall.
- Confirm EAS dashboard variable visibility: public, sensitive, or secret.

## Recommended Next Pass

1. Patch Expo package drift with `npx expo install --fix`.
2. Review and reduce production logging in auth, chat, recording, quota, and subscription paths.
3. Classify all AsyncStorage keys and decide whether dream/transcript storage needs encryption or documented acceptance.
4. Review `supabaseFunctionJwt` usage against Edge Function authorization and RLS.
5. Run artifact and real-device checks before the next store candidate.

