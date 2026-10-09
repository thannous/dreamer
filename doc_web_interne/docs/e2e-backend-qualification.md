# Backend E2E qualification

Owner: this E2E work package. Scope: the journal app, real local Supabase Auth,
Postgres and PostgREST. No production writes, AI calls or payments.

## Run

Use Node from `mise.toml`, locked dependencies, Chromium (`npx playwright install
chromium`) and a working Docker-compatible runtime:

```sh
mise exec -- npm run test:e2e:backend
```

The runner creates a randomly named disposable project, replays every tracked
migration, binds its Docker network to loopback, uses ports 56321/56322 and starts
Expo web on 8085. It never resets an existing project. Cleanup removes only that
run's containers and database volumes. Unique accounts are created per test and
deleted on completion, including failure. The Plus account is provisioned through
the existing service-role subscription RPC, without a purchase or billing bypass
in the app. Client-editable metadata cannot grant Plus.

The service-role key stays in a private temporary JSON file. Expo receives only
the local URL and public anon key. Startup output containing privileged keys is
captured, and browser requests allow only the app, local Auth and local Data API.
AI functions, analytics, OAuth providers and billing are blocked.

For a CLI running in a separate local Linux VM, prepare its config with
`npm run test:e2e:backend -- --prepare-only`, copy the prepared Supabase directory
into that VM, and start the CLI there. Capture `supabase status --output json` to
a private file, then run:

```sh
mise exec -- npm run test:e2e:backend -- --status-file /absolute/private/status.json
```

This mode accepts only `http://127.0.0.1:56321`, never starts or stops the supplied
stack, and is intended for a locally owned stack with loopback port forwarding.
`E2E_SUPABASE_CLI` can select a local CLI executable. The default uses the locked
npm CLI on Linux and its co-located Go engine on macOS. The macOS launcher failed
OS signature validation on this machine; the shipped Go engine has a valid
signature and completed the suite without changing OS security settings.
`E2E_DOCKER_CLI` and `DOCKER_HOST` can select a local Docker-compatible runtime.
No hosted test branch is required.

## Assertions and artifacts

Five journeys cover:

1. Save via UI, verify the remote row, sign in through the UI from an empty
   browser context, edit, restart the other client, then delete and restart again.
2. A second account has an empty journal and cannot read, update or delete the
   owner's dream through the real API. Anonymous access is also denied. Changing
   `user_metadata.tier` does not upgrade the account.
3. Free shows the server's limited allowance and signs out without leaking dreams.
4. Server-provisioned Plus shows unlimited analysis without a purchase and signs out.
5. An offline save stays local, synchronizes exactly once after reconnection, and
   remains readable after restart.

Artifacts are ignored: `test-results/e2e-backend-results.json` includes the tested
source SHA, dirty-state marker, fixtures, rerun command and individual assertions;
`test-results/e2e-backend-junit/results.xml` records pass/fail; the HTML report and
per-test videos show the actual UI. Auth network traces are deliberately disabled
to avoid recording passwords/JWTs. All stories and identities are synthetic.

A manually triggered CircleCI pipeline runs this suite in a Docker-capable machine
alongside existing checks, on app or database contract changes; pushes and PRs do
not trigger it, so run it locally when the change requires it. Mock web journeys remain a separate fast
suite. Native microphone, permissions, SQLite persistence and real RevenueCat
Test Store behavior are separate qualifications; a web pass does not prove them.

## Findings during preparation

Fresh replay exposed a missing `private` schema before guest-analysis import and
missing service-role privileges on the recovered dreams baseline. The historical
migration files now include those prerequisites for fresh databases. Already
applied production migration timestamps are not changed or reconciled.

The master web run after PR 229 failed with a FlashList grid measurement accessing
a removed item while filtering favorites. The desktop web grid now discards stale
layouts when item membership changes. Its native list identity stays unchanged.

Five backend journeys passed on a fresh Postgres 17 stack; all 23 mock web
journeys passed after the grid fix. The final committed revision and remote CI
result are recorded in the PR and machine-readable reports.

## Native checks without a payment

The disposable Pixel 9 / API 37 emulator ran the existing debug binary
`com.tanuki75.noctalia`, version 3.4.5 (68), APK SHA-256
`f513a34fbf5ee97e4f18ee9ea18ce55f8dbcbbe979aadaa390f3cd2f1dffd32c`.
Its native source revision is unknown; Metro served the current JavaScript.
This evidence qualifies that debug configuration, not a store release or iOS.
The physical device, existing user accounts and their data were untouched.

Three flows passed with zero automatic retries:

- `test:e2e:permissions`: denied microphone offers text entry; granting it removes
  the rationale; a text draft remains editable; notification warnings follow
  grant/revocation. The flow restores permissions and airplane mode on completion.
  It does not assert speech recognition or transcription.
- `test:e2e:storage`: a guest saves a synthetic dream in real native storage while
  airplane mode is enabled, kills the process, reopens the saved transcript, then
  restores connectivity and reads it again. Metro remained reachable over ADB;
  autonomous offline startup of an embedded release bundle is still unqualified.
- `test:e2e:subscription-teststore`: the actual RevenueCat SDK initializes in Test
  Store mode, loads two configured packages and completes the read-only SDK probe.
  No purchase, restore or payment action is invoked. Native receipt lifecycle,
  cancellation, renewal and restore are not qualified by this probe.

The Test Store QA lab requires both the explicit QA flag and a `test_` key for
the current platform in real mode. Ordinary real-mode accounts cannot see it,
which the backend E2E login asserts. Mock mode keeps its existing lab.

Prepare an appropriate private real-mode profile, use the existing compatible
debug binary, and start Metro through the canonical script:

```sh
mise exec -- npm run start -- --profile /absolute/private/native.env --dev-client --port 8081
# In another terminal, with Maestro/Java available and a disposable emulator:
DEV_CLIENT_URL='exp+noctalia://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8081' \
  mise exec -- npm run test:e2e:permissions -- --device <emulator> --env-file /absolute/private/native.env
DEV_CLIENT_URL='exp+noctalia://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8081' \
  mise exec -- npm run test:e2e:storage -- --device <emulator> --env-file /absolute/private/native.env
```

For the SDK probe, use a separate real-mode profile with a RevenueCat Test Store
key and `EXPO_PUBLIC_SUBSCRIPTION_QA_LAB=true`, start its Metro on port 8086, and run:

```sh
DEV_CLIENT_URL='exp+noctalia://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8086' \
  mise exec -- npm run test:e2e:subscription-teststore -- --device <emulator> \
    --env-file /absolute/private/teststore.env --metro-port 8086 --retries 0 --no-restart-metro
```

Private ignored evidence is under `maestro-results/android/`: each successful flow
has `commands.json`, screenshots and logs, plus a compact `*-evidence.json`
manifest with revision, binary, fixtures, rerun command and limitations.
`test:e2e:resilience` remains the distinct standalone release gate and requires
its existing release preflight. No native build, reinstall or store submission
was performed in this work package.
