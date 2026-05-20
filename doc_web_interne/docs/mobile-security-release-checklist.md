# Mobile Security Release Checklist

Last updated: 2026-05-16

Use this before each Android internal testing upload, production AAB, TestFlight build, or EAS Update.

## Local Gates

- [ ] `npm run security:audit:mobile`
- [ ] `npm run security:audit:mobile:strict` when strict mode is enabled for the release branch.
- [ ] `npm run lint`
- [ ] `npm run typecheck:app`
- [ ] `npm test -- --runInBand --watch=false --no-watchman`
- [ ] `npm audit --omit=dev --audit-level=high`
- [ ] `npx expo install --check`
- [ ] `npx expo-doctor`
- [ ] `npm run android:gates:strict` for Android releases.

## Config and Secrets

- [ ] No production/release EAS profile enables `EXPO_PUBLIC_MOCK_MODE=true`.
- [ ] `EXPO_PUBLIC_*` values are public-safe and documented.
- [ ] No service-role key, private API key, webhook secret, signing key, or provider secret appears in app config, JS bundle, `.env.local`, or EAS inline public env.
- [ ] Supabase anon/publishable keys are backed by verified RLS and function authorization.
- [ ] RevenueCat SDK keys match the intended environment.
- [ ] Play Integrity project number matches the Google Cloud project and Play package.
- [ ] Supabase function secrets are verified outside the repo.

## Storage and Privacy

- [ ] Supabase session persistence uses SecureStore on native.
- [ ] AsyncStorage/SQLite/file storage contains no auth tokens, refresh tokens, service credentials, or unreviewed sensitive user content.
- [ ] Dream text, transcripts, AI analysis, and account identifiers are not logged in production.
- [ ] Logout/account switch clears or isolates user-owned local data.
- [ ] iOS Keychain persistence after reinstall is acceptable for the stored values.
- [ ] Android backup behavior is disabled or excludes sensitive stores.

## Auth, Guest, and Payment

- [ ] Supabase RLS blocks cross-user reads/writes.
- [ ] Edge Functions reject missing/expired/foreign tokens.
- [ ] Guest AI/chat/image flows require valid backend guest sessions.
- [ ] Guest quota cannot be bypassed by editing local storage.
- [ ] RevenueCat webhook authorization fails closed.
- [ ] Purchases, restore, account switch, and entitlement sync are verified from a Play-installed or TestFlight build.

## Network and Deep Links

- [ ] Non-local API calls use HTTPS.
- [ ] Authorization/apikey headers are not attached to non-local HTTP URLs.
- [ ] App Links/Universal Links are verified with real `assetlinks.json` and `apple-app-site-association`.
- [ ] Malformed deep links do not expose protected screens or bypass returning-guest restrictions.
- [ ] OAuth redirects only accept expected schemes/domains.

## Release Artifact

- [ ] AndroidManifest.xml permissions match the expected minimal set.
- [ ] Info.plist usage descriptions and associated domains are correct.
- [ ] The bundled artifact contains no unexpected token-like strings.
- [ ] EAS channel and runtimeVersion match the intended release.
- [ ] EAS Update is sent with the intended environment.
- [ ] A rollback path exists for EAS Update and store release.

