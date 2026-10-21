# TesterArmy public API migration — 2026-10-21

Audit baseline: `dfc458a11a0173a6db5148e4fa28499c3e4284df`.
Remote `git@github.com:thannous/dreamer.git` fetched and current master
`ca3c4c93b581968aaec5bb76c21a7582887d1fc3` (#529) integrated without resetting
other work. The primary checkout, production task and production credentials are
untouched. This PR builds on #529's runner unification and preserves its current
product contracts, campaign, new journeys and retirement of duplicate runners.
Unit, component, integration, security and performance checks remain in place.

## Before / after inventory

| Surface | Audit snapshot / current master | This PR |
| --- | --- | --- |
| Dreamer historical web coverage | Snapshot: 68 Playwright cases in 14 files plus TesterArmy parity cases. #529 retired duplicate runners and supplied the current free-reflection flow. | 21 families / 114 cases use public `app`, `screen`, `browser` and `e2e.expect`, including billing, capture, journal, illustrations, reflection, guides, symbols, settings, backgrounds, onboarding, responsive layout and a11y. No Page/matcher bridge in their test bodies. |
| Consent and stable Dreamer journeys | Public TesterArmy tests, including the six-second animation observation under audit. | Preserved; consent retains both named providers, no permission on refusal, later reading, two dialogs, durable permission and original story. The animation waits for its whole observation before checking nonzero/full settled letters and zero replay. |
| Real local backend | Eight cases, moved into TesterArmy in #529 with Page/context compatibility fixtures. | Six public-API cases: RLS/other-user/anonymous isolation, Free/Plus server quota and sign-out, legacy/current themes and RPC, private Apple-token lifecycle. Two context/offline cases remain explicit compatibility exceptions in the same TesterArmy runner; their bodies are identical to #529. |
| Shared test-branch sessions | #529 moved two cases/setup into the guarded TesterArmy branch runner. | Preserved. Environment block: no approved allowlisted branch/accounts. The production HTTP/WebSocket guards and private saved-session handling remain. No remote seed or production access. |
| Lucid, Meditation, site | TesterArmy, including #529's latest journeys. | Preserved; no duplicate runner or new provider. Their existing #529 proof is history, not a new execution claimed here. |
| Outside `tools/e2e`: Lucid visual journey | `tests/e2e/lucid-visual-journey.mjs`, a manually invoked in-app browser journey. | Retired only after the four `PR237` equivalents in `lucid.web.e2e.ts` passed on `70c197ca6`. Password and hands-phase assertions retained explicitly; onboarding/time contrast, narrow tabs, programs/WBTB, account validation, morning→Journal→Atlas and both labs' persistence remain. Canonical command: `E2E_WEB_LOCALE=fr-FR npm run test:testerarmy:lucid -- run --grep PR237`. |
| Native / physical / Store | Existing guarded TesterArmy suites, one owner per identified device. | No binary/device/data touched; no native, physical, Release, Store or OTA qualification from these web runs. |
| SEO browser check / CDP profiling | Specialized browser SEO and performance measurements. | Retained as specialized tooling, not misrepresented as product E2E or device qualification. |

The 21 public families are: backgrounds (5), billing (13), capture-chat (2),
capture-editor (2), desktop-shell (1), dream-continuous-reading (3), dream-guides
(3), explorer-repertoire (3), home-editorial (3), journal-margin (6), journeys
(18), native-large-text-polish (1), onboarding-features (21), plus-channels (7),
readiness (3), reflection-context (4), review-accessibility (3), settings (3),
symbol-dictionary (6), trends-editorial (4), visual-overflow (3).

The current free-reflection case follows #529's supported visible route: open the
saved dream, complete an angle, then open the recap's Plus offer and decline back
to reflection. Every SPA history change and document arrival is recorded through
public browser evaluation; no intermediate `/dream-chat/` route is allowed.
An earlier attempted port of the old entry failed 3/3 on `bf754384a`; it was
reverted before #529 supplied the current route. It is no longer a blocker.
The newer onboarding cross/Escape/chapter contracts are preserved.

The repository-wide inventory also checked `e2e/`, `tests/e2e/`, native suites,
and browser scripts. `e2e/` now contains the current guide and retained image
fixture; #529 already retired its old suites/configs. The last Meditation Page
access (audio seek at the slider's right edge) uses the public locator's same
positioned click, preserving real audio, restart, history and streak assertions.
`scripts/check-image-seo-browser.js` and
`scripts/perf/measure-web-fluidity.mjs` remain specialized SEO/CDP measurements;
they are not parallel product journey runners. Unit/component/integration tests
are retained. No old product journey is silently excluded from the inventory.

## Public API limits and version evidence

Read the installed `e2e@0.21.2` skill and migration topic and the official
[coding-agents guide](https://e2e.tester.army/docs/coding-agents),
[Playwright migration](https://e2e.tester.army/docs/migrate/playwright) and
[web reference](https://e2e.tester.army/docs/reference/web).
Registry checks on 2026-10-21 found latest stable `e2e@0.21.2`,
`@e2e-dev/web@0.15.2`, `@e2e-dev/mobile@0.12.3`, exactly the installed pins.
The official web nightly `0.15.3-nightly-20261021080401` was downloaded with
`npm pack --ignore-scripts` and inspected without installation/execution. Its
Browser type adds only `unrouteAll`; it still lacks `newContext`, `setOffline`
and `routeWebSocket`, and requires its matching core nightly. No blind upgrade.

The two backend exceptions preserve simultaneous isolated contexts and true
browser offline/reconnect, server exactly-once rows, edits/deletion and restart
proof. Route aborts or a reload would not replace those invariants. Only these
cases use the compatibility context fixture; all eight execute under TesterArmy.
The test-branch exception also retains the WebSocket production guard and private
session setup. Therefore all current E2E entrypoints use TesterArmy, while a claim
that every case uses only the public Browser API would still be false.

Date-only clock uses are ported through public `addInitScript`/`evaluate` with a
per-attempt Date shim, preserving fixed versus elapsed time and native timers.
The two timer-observation tests wait the complete real 10/5/3/8-second intervals;
no accelerated private clock is used. Geometry uses IntersectionObserver,
including ancestor clipping and the pinned matcher's floating-point tolerance.
DOM text assertions preserve engraved glyph joining; image assertions select the
last global match, not `:last-of-type`. Pixel contrast retains the same sampled
copy, masks, crop, luminance thresholds and owner exceptions; screenshots are
resolved inside the owned evidence directory from the SDK's relative path.

## Audit fixes and commands

`testerarmy-tooling` runs for relevant changed E2E TS/runner/config/package files
on PRs and for releases. Types and synthetic guards start no browser/device/model;
unrelated PRs retain their existing reuse. A regression check verifies selection
of newly added E2E files. `rerunEnvironment` preserves explicit
`E2E_KEEP_METRO_CACHE=0`; the six-second observer is polled to completion.
Documentation describes local validation, optional benchmark-only hosted CI and
transitive AI packages / explicitly requested persona runs.

- `npm run test:e2e:web`: current Dreamer TesterArmy journeys.
- `npm run test:e2e:backend` or `npm run test:testerarmy:backend`: all eight local
  backend cases under TesterArmy; no legacy Playwright runner or legacy flag.
- `npm run test:e2e:branch`: guarded shared-branch journeys, requiring approved
  target/accounts before any connection.
- `npm run test:testerarmy:all`: existing #529 opt-in campaign, including its saved
  ChatGPT Pro persona stage; unchanged. Exact scenarios invoke no model.

## Final evidence

Integrated execution on `0edbb15a0820cc7524544098d7f8f0bf7f27342d`:
- Backend: `E2E_WEB_PORT=8085 npm run test:e2e:backend`, 8/8 PASS,
  `backend-web/1792579087077-37163-592beb9f-c291-4544-9ec4-c594f5070b6b`;
  outer exit 0 and the owned stack destroyed.
- Full Dreamer EN/feature ON/cold cache: 103 PASS, 3 FAIL, 27 intentional
  other-context/OFF skips, exit 1. Run
  `dreamer-web/1792578944175-33686-bc8832d9-d8ec-4250-871e-5be70b2e2815`.
  The failures were the search's pending wheel/focus and two ambiguous Trends tabs.
  Current code waits for the actual wheel motion to settle, preserving real
  per-character typing, return-to-top focus and user-scroll dismissal. Trends
  explicitly requires a visible tab with the original role. No assertion is removed.
  Other tested files/fixtures/app inputs are unchanged by these focused repairs;
  their immutable results remain useful evidence without rerunning five minutes
  of unchanged onboarding observations.

Final changed-case and locale results are appended after the focused reruns.

Development failures are retained privately, not counted as passes: source
`8b6831b89` had six failures (relative screenshot paths, semantic glyph spacing,
role ambiguity and focus) in `dreamer-web/1792578203430-29139-c709671e-bf7f-4d13-8f50-0e40bface433`.
Earlier image selection and viewport-helper failures were corrected with an
independent review. The preliminary French 25/25 run at
`1792578553834-30695-02061caa-0a5a-4275-939c-61ba981e5dd1` had uncommitted inputs
and is preparatory evidence only. An integrated backend attempt on 18125 refused
CONFIG_LOAD_FAILED before tests because #529 pins origin 8085; its owned stack was
destroyed. Retry used the verified-free canonical 8085 origin without changing
that guard. Source-clean final runs and their exact revisions are listed above.

Private outputs stay in ignored `tools/e2e/.e2e/`: source-start/source-end, hashes,
command/env, SDK report, traces/screenshots, qualification and `end.json`. No
credentials, private logs or generated images are committed. Backend Auth,
Postgres and PostgREST are real local services; only Apple exchange/revocation is
synthetic. External AI/payments/OAuth are blocked. Web mock runs use real local
UI with mock app services. No production, real Apple/payment, native or Store
qualification is claimed. Persona and physical-device campaigns were not rerun
for this test-tooling PR; the two branch sessions remain blocked as stated.
