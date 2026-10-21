# TesterArmy migration — 2026-10-21

Baseline: `dfc458a11a0173a6db5148e4fa28499c3e4284df`. Scope: E2E journeys;
unit, component, integration, security and performance checks remain in place.
No production, merge, remote test-account creation or paid provider action.

Read the installed `e2e@0.21.2` skill and `docs/migrate/playwright.mdx`, plus
[official coding agents](https://e2e.tester.army/docs/coding-agents) and
[Playwright migration](https://e2e.tester.army/docs/migrate/playwright).
The public Browser interface of `@e2e-dev/web@0.15.2` has no `newContext`,
`setOffline` or `routeWebSocket`. Raw Page is documented for executors rather
than test bodies; do not call the existing parity bridge a full public-API migration.

## Before / after inventory

| Existing surface | Before | This change / retained coverage |
| --- | --- | --- |
| `tools/e2e/tests/dreamer*.web.e2e.ts` | TesterArmy, exact regressions plus optional personas; historical Playwright bodies use a transitional Page bridge | Preserved; full six-second seal observation now completes before assertions. Consent journey added with public APIs. Free-reflection port blocked by its missing UI entry; original retained. |
| `e2e/web/*.spec.ts` (14 files, 68 collected cases) | Playwright; all families except consent already represented under TesterArmy | Consent ported. Title audit: 63 exact mappings (including consent), four existing onboarding replacements follow the owner’s newer story contract, and one blocked free-reflection case. Originals retained; no assertion removed. The Page bridge remains an explicit API migration limit. |
| `e2e/backend/journal.spec.ts` | 5 real-local-service journeys | Public TesterArmy ports for owner isolation and Free/Plus server allowance (3 cases). Fresh simultaneous contexts and true browser offline/reconnect remain Playwright exceptions, not replaced by reload or route aborts. |
| `e2e/backend/themes.spec.ts` | 2 real PostgREST/RPC compatibility journeys, one with UI | Both ported with unchanged server assertions and current/legacy theme request shapes. |
| `e2e/backend/apple-token-privacy.spec.ts` | 1 Auth/Postgres/API lifecycle with synthetic Apple exchange/revocation | Ported to TesterArmy plus Node fetch; private-token checks, failed revocation, deletion cascade and advisor diagnostic retained. No real Apple account. |
| `e2e/branch/session.spec.ts`, `auth.setup.ts` | 2 shared-session journeys plus guarded setup | Blocked: test branch allowlist empty and no approved account target. Original session persistence and HTTP/WebSocket production guards retained. Do not inject session JSON through recorded browser calls or weaken guards. |
| `tools/e2e/tests/lucid.web.e2e.ts`, `meditation.web.e2e.ts`, `site.web.e2e.ts` | TesterArmy | Unchanged. |
| `tools/e2e/tests/*.mobile.e2e.ts` | TesterArmy Release emulator/Simulator journeys | Unchanged; no device/build qualification claimed by this migration. |
| `*.iphone-sandbox.e2e.ts`, `*.iphone-dogfood.e2e.ts`, native performance configs | Guarded, opt-in TesterArmy physical/dev-client or measurement suites | Preserved; no physical device owned or touched for this task. |
| Retired Maestro history / manual RevenueCat, real voice and permission checks | Historical or manual, explicitly limited | Not silently restored, deleted or called automated coverage. See NATIVE-MATRIX.md and e2e/README.md. |
| `scripts/check-image-seo-browser.js`, `scripts/perf/measure-web-fluidity.mjs` | Browser SEO checks / CDP performance measurement, not E2E regression suites | Retained as specialized tooling; CDP CPU tracing is not a TesterArmy public Browser API. |

No old coverage is deleted. After all six ports passed three times,
`test:e2e:backend` now runs those six in TesterArmy plus the two explicit Playwright
SDK exceptions, sequentially against the same guarded stack. `test:testerarmy:backend`
selects only the six public-API journeys; `test:e2e:backend -- --legacy-playwright`
retains the entire original suite. Select one runner explicitly for targeted flags.
The backend candidate cannot be called a complete replacement while its two SDK
exceptions and branch-account qualification remain open.

## Corrections and static gate

`testerarmy-tooling` now participates in PR validation only when E2E tests,
runner, config or package inputs change; releases still run it. It invokes types
and synthetic guards without starting Metro, a browser, native target or model.
A newly broken test is checked even though root tsc/lint exclude its directory.
The root application checks keep their existing input reuse.

`rerunEnvironment` retains explicit `E2E_KEEP_METRO_CACHE=0`, distinct from unset
(the default warm transform cache). The seal observer polls its completion flag
and retains nonzero settled letters, all letters visible, and zero animation
replays throughout the complete observation. README reflects local validation,
optional benchmark-only CircleCI and transitive AI dependencies / opt-in personas.

## Evidence

Initial checks on `6e8c11b946a27209879492b31972602821ca03d8`:
- `npm run verify:pr`: PASS, 16 executed / 3 out of scope, including root types/lint,
  synthetic backend guards, site, config contracts and TesterArmy tooling.
- `npm run test:testerarmy:guards`: 49/49 PASS; focused lint and TesterArmy types PASS.
- Dreamer cold-cache run, two selected cases repeated three times: animation 3/3 PASS;
  consent 0/3 on historical `/\S{20}/` (requires a single 20-letter word). Actual
  mock interpretation was present. The port now waits for the interpretation itself,
  then checks at least 20 non-whitespace characters; decline, later consent, two
  dialogs, persisted permission and zero forbidden service requests remain unchanged.
  Original failure preserved in run `1792575802834-66484-9427ca3a-d7f7-4688-bec8-1740e225619b`.
  Its `rerunEnvironment` correctly records explicit cold cache `0`.
- Backend first attempt: APP_ALREADY_RUNNING at `8085/status`, no case executed;
  owned stack destroyed. No foreign process stopped and no reuse enabled. Retry uses
  an explicit isolated web port, recorded in the rerun command and evidence.

Final execution and revision are recorded below after validation. A collection,
typecheck, blocked run, skip or API check is never a passed UI/native/Store journey.


## Final execution, coverage exceptions and reruns

Code candidate: `9c25bda5fc2bbaf57a15bf4c4d95f2b07490d43f` (subsequent
commits document proof or remove an unsuccessful, newly attempted port; no old
coverage was removed). App version 3.7.0 / Expo 58.0.14; development web bundles
from this checkout, no native binary, OTA, Store build or physical qualification.
Node 24.19.0, Deno 2.7.14, Supabase CLI 2.121.0, pinned TesterArmy/engine versions
from package-lock. Headless Chromium through Playwright 1.64.0; macOS arm64.
All retained outputs below are private, ignored by Git under `tools/e2e/.e2e/`.
Each has source-start/source-end, exact command/env, SDK report, traces, hashes,
qualification and final `end.json`; successful receipts have stable clean inputs,
zero model use, no skips/failures and exit 0. Backend API assertions are server
proof; their initial `/status` open is readiness, not an additional UI journey.

| Command actually run | Revision | Result and canonical output suffix |
| --- | --- | --- |
| `E2E_WEB_PORT=18125 npm run test:testerarmy:backend -- --repeat-each 3` | `a83190e01` | 18/18 (six cases ×3), `backend-web/1792576101195-31399-fbac5503-af75-4cf2-80f0-1b56650888f4` |
| `npm run test:e2e:backend` | `9c25bda5f` | Six TesterArmy + two original Playwright exceptions passed, outer exit 0. SDK: `backend-web/1792576278786-34670-90ae02b9-fca4-48ad-9731-ccf8cd074a84`; legacy: `test-results/e2e-backend-results.json`. Stack destroyed. |
| `E2E_WEB_PORT=8126 E2E_WORKERS=1 E2E_KEEP_METRO_CACHE=0 EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED=false npm run test:testerarmy -- run --grep 'declining AI' --repeat-each 3` | `a83190e01` | 3/3, `dreamer-web/1792576087881-30723-a32201ee-fc2d-46b3-96e4-30e5cf01d255` |
| Same cold-cache environment, `--grep 'declining AI\|plus account watches its dream painted'` | `9c25bda5f` | 2/2, `dreamer-web/1792576279695-34757-7a66e6fd-0c99-4b7e-b79c-8a99d2b4159b`; animation also passed ×3 in the initial mixed red run documented above. |
| `npm run verify:pr` | `9c25bda5f` | PASS: 12 executed, 4 reused, 3 out of scope. Types, lint/script lint, related Jest, DB/static contracts, site, config, tooling. Final PR head gets its own proof before push. |

Backend invocations used disposable native loopback services, unique synthetic
accounts and server-owned Plus entitlements; external AI/payments/OAuth were blocked.
Apple token exchange/revocation alone was synthetic. The optional security advisor
diagnostic is retained in its output; it is not an assertion that all advisors pass.
No real account/session/credential or production target was used. The first backend
attempt at port 8085 refused APP_ALREADY_RUNNING, executed zero cases and destroyed
its stack; no process reuse or foreign process termination bypassed that refusal.

Additional counterexample: an attempted public-API port of the free-reflection case
(`e2e/web/journeys.spec.ts:294`) on `bf754384a` failed 3/3 with LOCATOR_NOT_FOUND at
`component.dreamDetail.actionCard`. The current completed-reading detail does not
expose that entry (source and captured UI agree). Its exact output remains
`dreamer-web/1792576445907-45523-ebf79dcd-129d-4796-83a5-746859a5a727`.
The unsuccessful new port was reverted; the original Playwright case remains intact.
Decide its current supported entry/contract before migrating it; do not revive an
old UI or call a deep link equivalent to the original visible-control journey.

The four unmatched onboarding titles are intentional existing contract updates in
`dreamer-onboarding-features.web.e2e.ts`: the cross asks before leaving the stories,
Escape keeps them open, and chapter completion leaves through the door (owner
change recorded 2026-10-10). This migration preserves them rather than restoring
outdated close/focus/return expectations from the old suite.

Outstanding: two browser-context/offline SDK exceptions remain active in the
backend aggregate; the free-reflection entry needs a supported current journey;
two branch-session journeys await an allowlisted test backend/accounts; historical
Page bridge bodies still need a public-API conversion before claiming full API
migration. `test:e2e:web` remains the retained legacy entry; use `test:testerarmy`
for current Dreamer journeys. No legacy coverage or unit/component/integration
suite is deleted. Native/physical and full four-context release campaigns were not
rerun for this test-tooling change and are not qualified here.

Independent read-only final-diff review of `9c25bda5f`: no P1/P2 retained.
The reviewer confirmed the rejected free-reflection port, active backend exceptions,
secret isolation and runner cleanup. No native/Store qualification inferred.
