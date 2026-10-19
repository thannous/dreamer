# Backend E2E qualification

Owner: this E2E work package. Scope: the journal app, real local Supabase Auth,
Postgres and PostgREST. No production writes, AI calls or payments.

## Run

Use Node from `mise.toml`, locked dependencies and Chromium (`npx playwright install
chromium`). The runner owns a disposable stack on the pinned Supabase CLI 2.121.0
native runtime. There is no Docker or Podman runtime (founder decision, 2026-10-19):

```sh
mise exec -- npm run test:e2e:backend
mise exec -- npm run test:e2e:backend -- --qualify-ti528
```

`--runtime native` is still accepted; any other `--runtime` is refused before a
process starts. The second command runs all seven browser journeys, the database
contracts, then the four TI528 suites (six integration cases) sequentially on the
same owned stack.
The runner passes its own private status to TI528 and preserves stack cleanup on
success or failure; the rerun metadata includes the option.

The native runtime needs Linux amd64/arm64 with glibc 2.35+ (Ubuntu 22.04 or later)
or macOS 14+ on Apple silicon. Supabase does not support it on Windows or on Intel
Macs; on Windows, WSL2 with a glibc 2.35+ distribution is the Linux case.
`node scripts/check-native-supabase-runtime.cjs` answers whether this machine
qualifies; `verify:release` uses it as the `e2e-backend` probe, so an unsupported
machine leaves the check unavailable (proof incomplete), never passed. Postgres
`initdb` refuses root: a root run needs `SUPABASE_NATIVE_POSTGRES_USER`.
The CLI assigns separate ports in 20000 to 32767 to each disposable directory
(`supabase/config.toml` sets `[experimental] stack = true` and no fixed port);
the runner validates its stack ID, runtime, loopback API and database before any
privileged client is created. Each invocation destroys only its own stack, including
after failure, and removes its temporary directory. CLI artifacts are cached under
ignored `test-results/backend-e2e-cli-home`; `E2E_SUPABASE_HOME` can select another
owned local cache, without a second download. Several native stacks on one machine
share host resources, so run one at a time per machine. See the official
[runtime guide](https://supabase.com/docs/guides/local-development/docker-and-native-runtimes).

The runner creates a randomly named disposable project, replays local fixture
copies of every tracked migration and starts Expo web on 8085. Historical HTTP
URLs in those copies are replaced with an unavailable loopback endpoint, and
scheduled jobs are disabled in the same migration that creates them. Tracked
migrations are untouched. The runner also asserts zero active cron jobs
before the suite. These fixture changes prevent unattended production calls; the
seven browser journeys do not qualify scheduled reconciliation or AI workers.
It never resets an existing project. Unique accounts are created per test and
deleted on completion, including failure. The Plus account is provisioned through
the existing service-role subscription RPC, without a purchase or billing bypass
in the app. Client-editable metadata cannot grant Plus.

The service-role key stays in a private temporary JSON file. Expo receives only
the local URL and public anon key. Startup output containing privileged keys is
captured, and browser requests allow only the app, local Auth and local Data API.
AI functions, analytics, OAuth providers and billing are blocked.

Every run owns its stack. The former supplied-VM mode (`--prepare-only` and
`--status-file`, API pinned on 56321) ran the CLI's default container stack inside
a VM; it was removed with Docker, and both options are refused before any process
starts. On a machine the native runtime does not support, use another machine
where `node scripts/check-native-supabase-runtime.cjs` passes.

`E2E_SUPABASE_CLI` can select a local CLI executable; the default is the locked npm
CLI (the native pilot used its launcher on macOS without changing OS security settings).
The runner passes no `SUPABASE_*` variable to the CLI except
`SUPABASE_NATIVE_POSTGRES_USER`, which Supabase requires for root runs of the native
runtime. The report's rerun command repeats `E2E_SUPABASE_CLI` and that user when they are set.
No hosted test branch is required.

TI528 accepts the identified managed receipt only after the shared local-target
guard verifies the stack ID, runtime, credentials and distinct loopback API/database
ports. The legacy TI528 procedure still requires exactly API 55321 and PostgreSQL
55322; it does not turn arbitrary local ports into an accepted target. Its database
contract command receives the validated URL through `SUPABASE_DB_URL`, keeping
credentials out of npm command banners. See the [TI528 guide](architecture/NOCTALIA-TI528-LOCAL-QUALIFICATION.md)
for the six cases and historical fixed-port procedure.

## Assertions and artifacts

Seven browser journeys cover:

1. Save via UI, verify the remote row, sign in through the UI from an empty
   browser context, edit, restart the other client, then delete and restart again.
2. A second account has an empty journal and cannot read, update or delete the
   owner's dream through the real API. Anonymous access is also denied. Changing
   `user_metadata.tier` does not upgrade the account.
3. Free shows the server's limited allowance and signs out without leaking dreams.
4. Server-provisioned Plus shows unlimited analysis without a purchase and signs out.
5. An offline save stays local, synchronizes exactly once after reconnection, and
   remains readable after restart.
6. Older apps read the four legacy themes while current apps retain precise themes;
   an older app's theme edit replaces the precise value consistently.
7. Completed readings preserve a precise theme for current apps and its compatible
   legacy projection for older apps.

Artifacts are ignored: `test-results/e2e-backend-results.json` includes the tested
source SHA, dirty-state marker, fixtures, rerun command and individual assertions;
`test-results/e2e-backend-junit/results.xml` records pass/fail; the HTML report and
per-test videos show the actual UI. Auth network traces are deliberately disabled
to avoid recording passwords/JWTs. All stories and identities are synthetic.

The report also records the effective CLI version, backend runtime and migration
fixture adjustments. Focused isolation controls cover hosted/ambiguous target
rejection, non-loopback runtime exposure, neutralization of scheduled external
work and the optional qualifier's ownership, ordering and failure cleanup (`node --test scripts/lib/backend-e2e-local.test.cjs`). These are
negative safety cases that the UI journeys cannot exercise against production.

Run this suite locally when the change requires it; `verify:release` includes the
backend check. CircleCI now runs only the opt-in E2E/Chromium installation benchmark,
as described in the [CI guide](circleci-migration.md). Mock web journeys remain a
separate fast suite. Native microphone, permissions, SQLite persistence and real
RevenueCat Test Store behavior are separate qualifications; a web pass does not
prove them.

On 2026-10-19, source `967fe81f` with the local audit changes passed the combined
native command: seven browser journeys, 56 database contracts and all six TI528
cases, with exit 0. The private diagnostic log is
`/private/tmp/noctalia-backend-native-updated-20261019.log`. This qualifies the local
Supabase stack and browser scenarios, without extending the result to mobile,
Store purchases or production.

## Historical findings during initial preparation

Fresh replay exposed a missing `private` schema before guest-analysis import and
missing service-role privileges on the recovered dreams baseline. The historical
migration files now include those prerequisites for fresh databases. Already
applied production migration timestamps are not changed or reconciled.

The master web run after PR 229 failed with a FlashList grid measurement accessing
a removed item while filtering favorites. The desktop web grid now discards stale
layouts when item membership changes. Its native list identity stays unchanged.

The original five backend journeys passed on a fresh Postgres 17 stack; all 23 mock web
journeys passed after the grid fix. The final committed revision and remote CI
result are recorded in the PR and machine-readable reports.

## Native checks without a payment

The disposable Pixel 9 / API 37 emulator ran the existing debug binary
`com.tanuki75.noctalia`, version 3.4.5 (68), APK SHA-256
`f513a34fbf5ee97e4f18ee9ea18ce55f8dbcbbe979aadaa390f3cd2f1dffd32c`.
Its native source revision is unknown; Metro served the current JavaScript.
This evidence qualifies that debug configuration, not a store release or iOS.
The physical device, existing user accounts and their data were untouched.

Three flows (Maestro, retired 2026-10-14) passed with zero automatic retries:

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

These three flows, their npm scripts and `test:e2e:resilience` were removed with
Maestro on 2026-10-14; the results above remain historical evidence for that debug
binary. Native permission recovery and offline storage have no TesterArmy journey
yet. The read-only SDK probe is superseded by the manual
[RevenueCat Test Store checklist](revenuecat-qa-workflow.md#2-revenuecat-test-store--checklist-manuelle).
Native release journeys run through `test:testerarmy:mobile` (see the
[TesterArmy guide](../../tools/e2e/README.md)). No native build, reinstall or
store submission was performed in this work package.
