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
| `tools/e2e/tests/dreamer*.web.e2e.ts` | TesterArmy, exact regressions plus optional personas; historical Playwright bodies use a transitional Page bridge | Preserved; full six-second seal observation now completes before assertions. Consent journey added with public APIs. |
| `e2e/web/*.spec.ts` (14 files, 68 collected cases) | Playwright; all families except consent already represented under TesterArmy | Consent ported. Originals retained for comparison; no assertion removed. The Page bridge remains an explicit API migration limit. |
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
