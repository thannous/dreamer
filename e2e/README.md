# Principal user journeys

New and affected journeys use [TesterArmy](../tools/e2e/README.md) by default.
This guide describes the retained Playwright interfaces and their actual
coverage. Historical expectations may be revised against the current product
contract with a recorded reason; they do not impose an automatic adoption gate.
Keep required CI and still-relevant assertions until their reviewed replacements pass.

Playwright exercises the Expo web app in Chromium with the existing mock service
adapters; screens, routing, state and user interactions are real. No production
account, password, paid subscription or AI request is needed. Native journeys run
through TesterArmy on an installed Release build; Maestro was retired on 2026-10-14.

## Choose a suite

| Suite | Command | Services and proof boundary |
| --- | --- | --- |
| Mock web journeys | `test:e2e:web` | Real UI and routing with simulated storage, AI and billing; session continuity and error recovery. |
| Real local backend | `test:e2e:backend` | Disposable Supabase Auth/Postgres/PostgREST; save/reload, account isolation, server quotas and offline sync. See [backend qualification](../doc_web_interne/docs/e2e-backend-qualification.md). |
| Native journeys | `test:testerarmy:mobile -- <dreamer\|lucid\|meditation> <android\|ios>` | TesterArmy on an identified installed Release build, one owned emulator or Simulator. Invariants and limits in the [native matrix](../tools/e2e/NATIVE-MATRIX.md). |
| Native storage and permissions | none (retired 2026-10-14) | The Maestro permission and offline-storage flows were removed with Maestro and have no TesterArmy counterpart yet; their last results stay in [native checks without a payment](../doc_web_interne/docs/e2e-backend-qualification.md#native-checks-without-a-payment). |
| RevenueCat Test Store | manual checklist | Purchase, restore and account switch follow [the Test Store checklist](../doc_web_interne/docs/revenuecat-qa-workflow.md#2-revenuecat-test-store--checklist-manuelle); mock billing is covered by the web journeys below. |

The profile table below applies to the simulated web journeys. Backend and
native qualification have their own fixtures and prerequisites; a mock pass cannot
substitute for them. The [task index](../doc_web_interne/docs/README.md) links the
implementation and release guides.

## Profiles and coverage

| Profile | Preconditions | Observable outcomes |
| --- | --- | --- |
| Guest | Fresh browser context | Onboarding, empty-save prevention, draft survives input-mode changes, first saved story and simulated analysis |
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
Server readiness waits for the first compiled JavaScript bundle. CI uses one
worker to keep its smaller runner deterministic; local runs use two. Every web
journey blocks external services and substitutes a local image fixture for the
mock image CDN. Service workers are disabled so they cannot bypass these routes.

Artifacts (ignored by Git): `test-results/e2e-web-report/` (HTML),
`test-results/e2e-web-junit/results.xml` (JUnit), and `test-results/e2e-web/`
(traces for every test; failure screenshots/video). The HTML report records the
source revision, dirty state, environment and fixture profiles. Open any trace with
`mise exec -- npx playwright show-trace <trace.zip>`.

A manually triggered CircleCI pipeline runs these journeys through their TesterArmy
counterparts (`tools/e2e/README.md`); this Playwright suite remains for local runs.
Existing quality, native and backend gates remain in place.

## Billing without real payments

Billing journeys run in TesterArmy, in `tools/e2e/tests/dreamer-billing.web.e2e.ts`
(the former `web/billing.spec.ts` was retired on 2026-10-19 after its eight journeys
were covered there under the same titles): monthly/annual purchase, cancelled
checkout and retry, purchase error and recovery, restoration with/without a receipt,
cancelled renewal followed by expiry, and receipt ownership across account switches,
plus delayed server activation and the return to the offer after signing in.
Expired access cannot be restored as active; journal content remains available.

Run only these cases with:
`npm run test:testerarmy -- run --grep 'mock|restore|receipt|cancelled renewal'`.
The browser blocks every request outside the local app and fails if the app attempts
to contact a recognized billing or Supabase host. The suite also asserts the mock
service mode before interacting with the paywall. No card, store account, real
receipt, production account or paid transaction is used.

For manual testing, start `start:mock`, select a mock account, open Settings, and
expand **Subscription · QA**. Choose the next mock purchase result (success,
cancelled, error), then open the normal Plus offer and use its purchase button.
Cancellation/error affect one attempt only; the following attempt succeeds.
**Restore available** seeds a previous receipt while keeping local access free;
the normal **Restore purchases** action activates it. **Cancelled** means renewal
is cancelled but access remains active; **Expired** returns to free limits.
These controls are mounted only in mock mode, and receipts are in memory and scoped
to the mock account. Reopening the app starts a new simulation.

## Native

The Maestro Android journeys (guest capture, free journal, Plus sign-out, mock
checkout recovery) were retired on 2026-10-14. Their mock scenarios are covered by
the TesterArmy Dreamer web journeys (`dreamer-journeys`, `dreamer-billing`,
`dreamer-plus-channels`). Native journeys run on an identified installed Release
build through TesterArmy:

```sh
E2E_DEVICE=<emulator-serial> mise exec -- npm run test:testerarmy:mobile -- dreamer android
```

Build, install, profile and evidence rules are in the
[TesterArmy guide](../tools/e2e/README.md) and the
[native matrix](../tools/e2e/NATIVE-MATRIX.md). Build/install authorization and
native-directory requirements remain those in `AGENTS.md`.

## What this proves

These are UI journeys against simulated services. A successful run does not prove
real Supabase authentication/RLS, cross-device sync, dream durability after a
process restart, microphone behavior, AI quality or store billing. The mock dream
store is in memory; revisiting a screen tests session continuity only.

The implemented [local backend suite](../doc_web_interne/docs/e2e-backend-qualification.md)
qualifies login, save/reload, account isolation and recovery against real local
services with `test:e2e:backend`. Its report records revision, fixtures, assertions
and rerun command. Payment coverage in the mock journeys remains simulated; real
purchases are never a prerequisite. Test Store purchase, restore and account
switch are a separate manual checklist.

Seven obsolete Maestro web flows were replaced by `web/journeys.spec.ts`: recording
save, journal search, dream delete, transcript edit, favorite toggle/filter and
reflection chat. The replacements assert the saved story, absence after deletion,
actual filter results and assistant reply. Other native, failure/recovery, security
and backend tests are retained; this is not a blanket removal of isolation tests.

## Default framework for new journeys

Use [TesterArmy E2E](../tools/e2e/README.md) for new and affected journeys across
Dreamer, Lucid, Meditation and the marketing site. Existing suites above retain
coverage during migration; no CI gate is replaced by a narrower smoke suite.
