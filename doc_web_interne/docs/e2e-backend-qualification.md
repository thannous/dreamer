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
`E2E_SUPABASE_CLI` can select a local CLI executable; the default is the locked
npm Supabase CLI. No hosted test branch is required.

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

CircleCI runs this suite in a Docker-capable machine alongside existing checks,
on app or database contract changes. Mock web journeys remain a separate fast
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

Local pilot: five backend journeys passed on a fresh Postgres 17 stack; all 23 mock
web journeys passed after the grid fix. The final committed revision and remote
CI result are recorded in the PR and machine-readable reports; native/store
qualification remains open until its own build and device evidence is available.
