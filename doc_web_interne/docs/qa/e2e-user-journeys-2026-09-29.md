# Principal user journeys — 2026-09-29

## Current qualification: CI failure and recovery

CircleCI job 2030 at `126db012` exposed six web failures. The cold Expo bundle
was not ready when timed journeys started; image CDN requests prolonged page load;
a filtered FlashList recycled an absent item and crashed the desktop journal;
reflection messages were below the viewport after its large header.

The server readiness probe now waits for compiled JavaScript, navigation waits for
DOM readiness, CI runs one worker, and all journeys use offline service routes with
a deterministic image fixture. Billing/backend requests remain forbidden. The
journal's three row renderers skip absent recycled items. Reflection tests use
the existing **Jump to latest** control and retain message/reply revisit assertions.
No retries or assertion timeouts were increased.

**23/23 web journeys passed in 1.7 minutes in CI mode**, from a fresh managed
server; app/test types and focused lint passed (four existing journal hook/ref
warnings, zero errors). Artifacts are in the standard ignored HTML/JUnit/trace
locations below. The candidate is the working tree based on `126db012`; its
follow-up commit records these executable changes.

The API 37 emulator recovered after a boot without its faulty snapshot. It had no
installed Noctalia package; the existing local debug APK was installed into this
empty disposable emulator and its version re-read as 3.4.5 (68). APK hash and
native source identity remain those recorded below. Metro serves the candidate
JavaScript. No physical device, real account or real payment was used.

**Native billing recovery passed, one attempt, zero retries.** The flow confirms
mock service mode and each selected outcome, checks that cancellation/error retain
free access, dismisses the error, reopens the offer without a stale error, retries,
then checks persistent Plus access, unlimited quota and removal of the upgrade CTA.
Controls are centered to keep the development LogBox banner outside tap targets;
success is checked through persistent access rather than a short-lived toast.

Tested native content: `0c8cd1c7` plus the final billing YAML changes, recorded by
the follow-up commit. Sorted-path/NUL/file SHA-256:
`3b18d783793a91c8ee137bf35de80fe605229759bf5000b924524350550bf66c`.
The exact 16-path list and rerun command are in ignored
`maestro-results/android/journeys/billing-recovery-evidence.json`;
`billing-recovery-final-run.log` identifies the successful run. Command results,
error/success screenshots and hierarchies are under the flow's emulator directory.
The native APK's precise source revision is unknown; its verified version/hash
identify the reused binary. This qualifies current JavaScript on that local build,
not a store release. The original three native journey results below keep their
original revision identity.

After starting the mock server and setting the Maestro/Java paths as below, rerun:

```sh
DEV_CLIENT_URL='exp+noctalia://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8084' \
mise exec -- npm run test:e2e:journeys -- \
  --flow maestro/journeys/billing-recovery.yml \
  --device emulator-5554 --metro-port 8084 --no-start-metro
```

Local `test:prepush` at `0c8cd1c7`: app/test types and 155 suites / 2,051 assertions
passed, one existing skipped suite/test. The final PR head and its remote checks
remain separately observable in [PR #229](https://github.com/thannous/dreamer/pull/229).

## Follow-up: zero real payments

The requested billing extension adds eight browser journeys. **23/23 web tests
passed in 49.9 seconds, zero retries**, from a fresh managed mock server. The eight
billing cases block external browser requests and assert mock service mode before
using the real paywall UI. No real account, payment or production change was made.

Coverage: monthly/annual purchase, checkout cancellation/retry, network-error
recovery, restore with/without a simulated receipt, cancelled renewal versus
expiry, expired receipt restoration, account ownership and retained journal data.
The QA controls are accessible only in mock Settings. The tests revealed and fixed
mock status events being ignored on web, explicit expired state being overwritten
on refresh, and dismissed purchase errors reappearing when reopening the paywall.

Tested content: working tree based on `eb593b3b`. SHA-256 of the sorted paths below,
each followed by a NUL and its file bytes:
`b4f907d183de3ea5b66a17533456c9b8be7bdecb6c7e0d0ea00cbe211be86a67`.
Paths: `app/paywall.tsx`, `app/settings.tsx`,
`components/subscription/SubscriptionQALab.tsx`, `e2e/web/billing.spec.ts`,
`hooks/useSubscriptionCustomerInfoListener.ts`, `hooks/useSubscriptionInternal.ts`,
`services/mocks/subscriptionServiceMock.ts`. The follow-up commit records this content.

App/test TypeScript passed. Focused lint: zero errors, three existing React hook
warnings on unchanged effect/ref lines. Rerun:
`mise exec -- npm run test:e2e:web`; billing-only command and interactive controls
are in [the guide](../../../e2e/README.md#billing-without-real-payments).
HTML/JUnit/traces remain in the same ignored artifact locations described below.

Earlier native attempt (superseded by the qualification above): the API 37 emulator
aborted with exit 134 after loading its snapshot, before a Noctalia session could
be established. No installation, device reset or native build was performed in
this follow-up. The three successful native journeys below remain evidence for
their original revision, not for the new billing scenarios. Remote CI qualification
also remains separate; the previous pipeline was still in checkout when inspected.

Final affected-test gate at `bd5557c1`: 155 suites / 2,051 assertions passed;
one existing suite/test remains skipped. The settings-host isolation fixture now
stubs the QA child; no new isolation test was added. CircleCI then exposed an
existing workflow-order assumption in `fallback-jest.test.sh`: keep
`noctalia-quality` first and append the independent E2E job. The unchanged CI
fallback check passed locally after that configuration-only correction.

## Original journey qualification

Owner: Codex, branch `codex/principal-user-journeys`. Implementation base:
`15c2e62da9205838b5682536c5cd643ef74d9445`; final executable changes: `42aa18aa`.
The web report was generated against the identical working-tree content immediately
before the configuration commit (metadata: `4597db6c`, dirty). Android flow content
matches `4597db6c`; the later change only configures the managed web server.

## Result

| Check | Observed result |
| --- | --- |
| Playwright 1.58.2 / Chromium | 15/15 passed, 35.9 seconds, two workers, zero retries; fresh managed Expo server |
| Maestro 2.10.0 / Android emulator | 3/3 passed, one attempt each; guest, free and Plus |
| App and test TypeScript | Passed |
| Focused Expo lint | Passed for application fix, Playwright tests/config and Maestro runner |
| Pre-push affected tests at `4597db6c` | 4 suites / 113 tests passed, including physical-device guards; app/test types passed |
| CircleCI configuration | YAML parsed; new web job retains JUnit, HTML and traces; remote execution is a separate qualification |
| Diff | `git diff --check` passed |

The suite caught a web onboarding crash: React Native Web does not implement
`StatusBar.pushStackEntry`. The native status-bar effect now skips web. No other
application behavior was changed.

Seven obsolete Maestro web files were removed only after their Playwright
replacements passed. The [coverage guide](../../../e2e/README.md) maps behaviors,
fixtures, retained tests and limits. The prior unit-test audit remains historical.

## Candidate and environment

- macOS host; Node 24.19.0; Expo 57.0.23 / React Native 0.86.3.
- Android: disposable Pixel 9 API 37 emulator, local debug installation of
  `com.tanuki75.noctalia`, version 3.4.5 (68), Java 17. No physical device was reset.
- APK SHA-256: `f513a34fbf5ee97e4f18ee9ea18ce55f8dbcbbe979aadaa390f3cd2f1dffd32c`.
  Native source comes from the base checkout; Metro serves this branch's JavaScript.
  No OTA or backend deployment occurred. Store builds are not qualified by this run.
- `.env.mock`, `EXPO_PUBLIC_MOCK_PERSISTENCE=true`: persisted onboarding/preferences,
  in-memory dreams, simulated Auth/AI/subscriptions. Fresh browser context per test;
  cleared emulator app per native flow. English UI. Only synthetic journal content.
- Profiles: guest, new free, existing exhausted free, Plus. No real test accounts
  were created. Supabase SQL access remained unavailable after reconnecting
  (`non-empty string link_id` connector error); production was not modified.

## Repeat and inspect

Web: `mise exec -- npm run test:e2e:web`. Start with port 8084 free; the configuration
starts and stops its own mock server. The local development reuse flag is unnecessary.
Inspect `test-results/e2e-web-report/index.html`, JUnit in
`test-results/e2e-web-junit/results.xml`, and per-test `trace.zip` files in
`test-results/e2e-web/`. These artifacts remain ignored by Git.

Android server:
`EXPO_PUBLIC_MOCK_PERSISTENCE=true mise exec -- npm run start:mock -- --port 8084`.
Exact test command used (Maestro installed temporarily on this host):

```sh
MAESTRO_BIN=/tmp/noctalia-maestro-2.10.0/maestro/bin/maestro \
MAESTRO_CLI_NO_ANALYTICS=1 \
JAVA_HOME=/Users/timax/.local/share/mise/installs/java/temurin-17.0.20+101 \
DEV_CLIENT_URL='exp+noctalia://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8084' \
mise exec -- npm run test:e2e:journeys -- \
  --device emulator-5554 --metro-port 8084 --no-start-metro
```

Native artifacts: `maestro-results/android/journeys/`, including final-run.log,
per-flow command results, hierarchy snapshots and screenshots. Earlier failing
iterations remain in separate numbered run directories; final-run.log identifies
the successful three-flow run. Emulator clear-state is rejected on physical devices.

The report proves UI behavior with mock services. Real login/RLS, cross-device sync,
restart durability, microphone/audio and RevenueCat billing remain unqualified.
Production accounts and payment fixtures are not prerequisites for these CI tests.
The next real-service qualification should use a dedicated backend and guarded
store sandbox flows when access is available.
