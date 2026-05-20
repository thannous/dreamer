# Mobile Security Audit - Noctalia Expo App

Last updated: 2026-05-16

## Scope

This audit covers the Expo/React Native mobile app and the mobile-facing Supabase/RevenueCat paths:

- Expo app config, EAS build profiles, EAS Update boundaries, and public client configuration.
- Local storage for sessions, guest state, dreams, transcripts, quotas, and cached user data.
- Supabase auth, Edge Functions, RLS assumptions, guest sessions, Play Integrity, and RevenueCat webhooks.
- Android/iOS permissions, deep links/App Links, release profiles, and production logging.
- Dependency and release-artifact checks that must run before app-store submission.

The baseline is OWASP MASVS, with emphasis on `MASVS-STORAGE`, `MASVS-AUTH`, `MASVS-NETWORK`, `MASVS-PLATFORM`, `MASVS-CODE`, `MASVS-RESILIENCE`, and `MASVS-PRIVACY`.

## Quick Start

Run the local audit:

```bash
npm run security:audit:mobile
```

Run the CI/blocking variant:

```bash
npm run security:audit:mobile:strict
```

Run the broader release checks around it:

```bash
npm run lint
npm run typecheck:app
npm test -- --runInBand --watch=false --no-watchman
npm audit --omit=dev --audit-level=high
npx expo install --check
npx expo-doctor
npm run android:gates:strict
```

Use `npm run security:audit:mobile -- --json` when another tool needs machine-readable output.

## Current Security Model

### Public Client Configuration

All values exposed through `EXPO_PUBLIC_*` or `expo.extra` are readable from the client bundle. They must be treated as public values even when they look like API keys.

Expected public client values include:

- Supabase URL and anon/publishable key.
- RevenueCat public SDK keys.
- Google OAuth client IDs.
- Play Integrity cloud project number.
- API base URL.

High-risk values include anything named like `secret`, `token`, `jwt`, `private`, or `service_role`. If such a value is intentionally public, the server-side policy must be documented and verified. The current audit script flags token-like `expo.extra` values so reviewers do not accidentally treat them as secret.

### Storage

Native Supabase sessions should stay in `expo-secure-store`. AsyncStorage and SQLite/KV storage may be acceptable for non-sensitive flags and cached state, but every use must be reviewed against dream text, transcripts, account identifiers, quota state, and auth/session material.

Sensitive storage review questions:

- Is the value a token, refresh token, guest token, or credential?
- Does it contain dream content, transcript text, generated analysis, or personal metadata?
- Can it survive logout, uninstall, backup/restore, or account switching?
- Is the server the source of truth, or can a local tamper bypass quota/payment/auth?

### Network and Backend

The mobile app must use HTTPS for non-local API calls and must not attach Supabase auth headers to non-local cleartext HTTP. Backend checks must confirm:

- Supabase RLS policies enforce per-user access.
- Edge Functions validate authenticated, guest, anon, and service-role paths separately.
- Guest AI/chat/image actions require backend-issued guest sessions.
- RevenueCat webhooks require explicit authorization.
- Response bodies and backend internals are not surfaced through generic user-visible errors.

### Platform and Release

Android release expectations:

- `android.allowBackup=false`.
- Minimal permissions: microphone and audio settings only when justified.
- App Links use HTTPS and `autoVerify`.
- Release profiles do not enable mock mode.
- Production Play Integrity and RevenueCat flows are verified from Play-installed builds.

iOS release expectations:

- Microphone and speech usage descriptions are present.
- Associated Domains match `dream.noctalia.app`.
- Keychain/SecureStore behavior is understood during uninstall/reinstall.
- Universal links are tested with real associated-domain files.

## Audit Phases

### Phase 1 - Local Static Audit

Run:

```bash
npm run security:audit:mobile
npm run lint
npm run typecheck:app
npm audit --omit=dev --audit-level=high
npx expo install --check
```

Review:

- Warnings from `security:audit:mobile`.
- All `expo.extra` and `EXPO_PUBLIC_*` values.
- AsyncStorage imports and local persistence.
- Unconditional `console.*` calls in app code.
- Dependency advisories and Expo package alignment.

### Phase 2 - Backend Policy Audit

Review Supabase migrations and functions:

- RLS enabled on user-owned tables.
- No direct client access to service-role operations.
- Guest routes reject missing, expired, replayed, or mismatched guest tokens.
- RevenueCat webhook auth fails closed.
- Quotas are server-authoritative for costly actions.

Suggested abuse tests:

- Call dream APIs with no token.
- Call with another user's token.
- Call guest routes without Play Integrity-backed guest session.
- Replay old guest/session requests.
- Attempt quota bypass by editing local storage.

### Phase 3 - Device Dynamic Audit

Run on Android emulator and a physical Play-installed build:

- Inspect app logs during auth, recording, analysis, chat, paywall, restore, logout.
- Verify no dream text, tokens, raw webhook payloads, or user identifiers leak into production logs.
- Inspect local app storage after recording, analysis, logout, account switch, and uninstall/reinstall.
- Test deep links and App Links with malformed paths and returning-guest restrictions.
- Capture network traffic where legally and technically permitted; confirm HTTPS-only non-local API calls.

Run on iOS simulator/device before TestFlight:

- Verify speech/microphone prompts and denial flows.
- Test Universal Links and OAuth redirects.
- Inspect Keychain persistence expectations after reinstall.

### Phase 4 - Release Artifact Audit

For every store candidate:

- Generate the actual APK/AAB/IPA/TestFlight build.
- Inspect AndroidManifest.xml/Info.plist permissions and URL schemes.
- Search bundled JS/native strings for unexpected credentials or debug endpoints.
- Confirm EAS channel, runtimeVersion, app version, and update branch.
- Confirm mock mode is off and production API/RevenueCat/Supabase values are selected.

## Finding Severity

Use this scale in reports:

- `P0`: exploitable secret, auth bypass, cross-user data access, payment bypass, or public service-role material.
- `P1`: sensitive local storage exposure, weak backend policy, production debug leak, insecure transport, unverified webhook auth.
- `P2`: release hardening gap, broad permission, incomplete deep-link validation, dependency advisory with plausible exploit path.
- `P3`: documentation, observability, missing manual evidence, or low-risk configuration drift.

## Deliverables

Each complete audit should produce:

- A report with finding ID, severity, evidence, affected files/routes, exploit story, and fix owner.
- A release checklist update if the issue can recur.
- Tests or an automated check for every fix that can be verified locally.
- Manual evidence for Play Console, EAS dashboard, Supabase secrets, and device-only checks.

