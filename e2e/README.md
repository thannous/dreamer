# Principal user journeys

Playwright exercises the Expo web app in Chromium. Maestro exercises the native
Android app on a disposable emulator. Both use the existing mock service adapters;
screens, routing, state and user interactions are real. No production account,
password, paid subscription or AI request is needed.

## Profiles and coverage

| Profile | Preconditions | Observable outcomes |
| --- | --- | --- |
| Guest | Fresh browser context / cleared emulator app | Onboarding, empty-save prevention, draft survives input-mode changes, first saved story and simulated analysis |
| Fresh free (`new`, web) | Empty journal; unused analysis allowance | Save and analyze a new story without a paywall |
| Free (`existing`) | Seeded journal; analysis allowance exhausted | Save and reopen exact story, edit title/text, search and empty-state recovery, favorite filtering, cancel/confirm deletion, decline Plus offer without losing story |
| Plus (`plus`) | Seeded journal and simulated entitlement | Unlimited allowance, new analysis without a paywall, reflection response and conversation on revisit, sign-out removes access to account journal |

The free fixture currently has five analyzed dreams against a three-analysis
allowance. It is deliberately used as an exhausted account, not as a fresh free
account. Tests start independently, use distinct stories, wait on UI state rather
than sleeps, and run without retries. Browser contexts isolate storage and cookies.

## Web

```sh
mise exec -- npm ci
mise exec -- npx playwright install chromium
mise exec -- npm run test:e2e:web
mise exec -- npm run test:e2e:web:report
```

Port 8084 must be free. Playwright starts the canonical mock server automatically.
It enables `EXPO_PUBLIC_MOCK_PERSISTENCE=true` so onboarding and preferences survive
profile switches; dream data still stays in memory. Each test has fresh browser storage.
For an already-running mock server only, set `E2E_REUSE_SERVER=1` locally. CI always
starts a fresh server. Use an actual local `node_modules` installation: linking a
different checkout's dependencies can break Metro dynamic-module resolution.

Artifacts (ignored by Git): `test-results/e2e-web-report/` (HTML),
`test-results/e2e-web-junit/results.xml` (JUnit), and `test-results/e2e-web/`
(traces for every test; failure screenshots/video). The HTML report records the
source revision, dirty state, environment and fixture profiles. Open any trace with
`mise exec -- npx playwright show-trace <trace.zip>`.

CircleCI's `noctalia-e2e-web` job runs these journeys and retains results and traces.
Existing quality, native and backend gates remain in place.

## Android

Requires Java 17, Android SDK, Maestro 2.10.0 and a disposable emulator with a
compatible local development build of `com.tanuki75.noctalia` already installed.
This suite clears emulator app data; the existing runner rejects that operation
on physical devices. Build/install authorization and native-directory requirements
remain those in `AGENTS.md`.

Start `EXPO_PUBLIC_MOCK_PERSISTENCE=true mise exec -- npm run start:mock -- --port 8084`, then:

```sh
DEV_CLIENT_URL='exp+noctalia://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8084' \
mise exec -- npm run test:e2e:journeys -- \
  --device emulator-5554 --metro-port 8084 --no-start-metro
```

The runner configures ADB reverse and records command logs, Maestro step results
and screenshots under `maestro-results/android/journeys/`. Set `MAESTRO_BIN` and
`JAVA_HOME` if not installed on PATH. Record the binary version/build, source
revision and exact command alongside each qualification result.

## What this proves

These are UI journeys against simulated services. A successful run does not prove
real Supabase authentication/RLS, cross-device sync, dream durability after a
process restart, microphone behavior, AI quality or store billing. The mock dream
store is in memory; revisiting a screen tests session continuity only.

Keep a small separate real-service smoke suite for login, save/reload and actual
entitlement retrieval when service access is available. Prefer a dedicated test
backend; if production test accounts are used, reserve them exclusively for that
suite and do not clear their data or force a paid tier in SQL. RevenueCat remains
the entitlement source of truth. Existing guarded Test Store/release flows cover
their specialized scope and are retained.

Seven obsolete Maestro web flows were replaced by `web/journeys.spec.ts`: recording
save, journal search, dream delete, transcript edit, favorite toggle/filter and
reflection chat. The replacements assert the saved story, absence after deletion,
actual filter results and assistant reply. Other native, failure/recovery, security
and backend tests are retained; this is not a blanket removal of isolation tests.
