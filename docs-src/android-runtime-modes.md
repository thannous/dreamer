# Android Runtime Modes

Use this as the quick reference for Android purchase/auth testing. Keep generated `docs/` output untouched.

## Release Readiness

Android is not considered production-store ready until the production constants in
`doc_web_interne/docs/PRODUCTION_CONSTANTS.md` are complete, a signed AAB has
been produced with `eas build --platform android --profile production`, and the
same artifact has been installed and tested from Google Play Internal Testing.

Local emulator success is useful for regressions, but it does not validate Google
Play Billing, Play Integrity, Play App Signing SHA behavior, or Play Console
compliance.

## Mode Matrix

| Mode | Purpose | Expected client keys | Expected warnings |
| --- | --- | --- | --- |
| Mock local | UI, quota, auth, and subscription flows without real backends or stores. | `EXPO_PUBLIC_MOCK_MODE=true`. Mock RevenueCat keys are acceptable because `services/subscriptionService.ts` selects the mock service. | Play Integrity may log `Missing EXPO_PUBLIC_PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER`; ignore it only in mock/local runs. |
| RevenueCat Test Store | Validate real RevenueCat wiring, offerings, paywall, entitlement mapping, and webhook/user linking without Google Play billing. | `EXPO_PUBLIC_MOCK_MODE=false`; `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` should be the RevenueCat Test Store Android key, usually `test_...`. Include normal Supabase/API keys if auth, quota, or webhook checks are in scope. | Do not treat this as a Play billing test. A `Missing RevenueCat API key` error means the Android key was not bundled. A `No env android key found, fallback to extra` warning means the build is not receiving the env key and may fall back to `app.json` extras. |
| Google Play / Internal Testing | End-to-end Android billing using Google Play products and Play-signed artifacts before production release. | `EXPO_PUBLIC_MOCK_MODE=false`; `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` must be the non-test Android public SDK key for the Google Play app. Also provide `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_API_URL`, and Google OAuth keys. | Install from the Play Internal Testing track with a licensed tester account. Sideloaded builds are not equivalent for Play Billing, Play Integrity, or Play App Signing SHA behavior. |

## Common Android Keys

- RevenueCat: `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` is required for real Android purchases. `EXPO_PUBLIC_REVENUECAT_WEB_KEY` only affects web fallback behavior.
- Google Sign-In: `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` is required by native Google Sign-In configuration; keep `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` available for environment parity and Supabase provider configuration.
- Backend/auth: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, and `EXPO_PUBLIC_API_URL` are required for real Supabase/API flows.
- Play Integrity client: `EXPO_PUBLIC_PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER` must be the Google Cloud project number, not the project ID.
- Play Integrity server: Supabase functions need `PLAY_INTEGRITY_SERVICE_ACCOUNT_JSON_BASE64`, `PLAY_INTEGRITY_PACKAGE_NAME=com.tanuki75.noctalia`, and `GUEST_SESSION_SECRET`.

## Play Integrity Notes

Play Integrity is Android-only in the current guest-session flow. Missing or invalid configuration degrades guest session bootstrap and can produce warnings such as `Play Integrity provider not ready`, `Play Integrity request failed`, or API reasons like `package_mismatch`, `nonce_mismatch`, `app_unrecognized`, and `device_not_integrity`.

For Internal Testing, confirm the app is installed from Google Play, the package name is `com.tanuki75.noctalia`, the Play Integrity API is enabled for the same Google Cloud project, and the server service account can call the decode endpoint.

## Google Sign-In SHA Notes

Android Google Sign-In depends on the SHA-1 fingerprints registered on the Android OAuth client in Google Cloud Console. Add every signing certificate used by the mode:

- Development/dev-client builds: EAS Android keystore SHA-1 from `eas credentials`.
- Google Play/Internal Testing and production: Play Console > Release > Setup > App Integrity > App signing SHA-1.

Keep the Android OAuth client package name as `com.tanuki75.noctalia`. In Supabase Google provider settings, keep the Web Client ID configured with its client secret, add the Android Client ID to Authorized Client IDs, and keep nonce handling aligned with the native `signInWithIdToken` flow.
