# TesterArmy public API migration — 2026-10-21

Audit baseline: `dfc458a11a0173a6db5148e4fa28499c3e4284df`.
The verified remote is `git@github.com:thannous/dreamer.git`. Initial master
`ca3c4c93b581968aaec5bb76c21a7582887d1fc3` (#529) was integrated; the follow-up
below also integrates `2b4a7d3ea1921b83d55847120508b66eb590feb6` (#531).
That latter base is explicitly frozen for delivery; the final remote check still
points to it. No reset or concurrent-work overwrite. The primary checkout,
production task and production credentials are untouched. The PR preserves both
owner changesets' product contracts and new journeys. Unit, component,
integration, security and performance checks remain in place.

## Before / after inventory

| Surface | Audit snapshot / current master | This PR |
| --- | --- | --- |
| Dreamer historical web coverage | Snapshot: 68 Playwright cases in 14 files plus TesterArmy parity cases. #529 retired duplicate runners and supplied the current free-reflection flow. | 21 families / 119 cases (the initial 114 plus five new #531 cases) use public `app`, `screen`, `browser` and `e2e.expect`, including billing, capture, journal, illustrations, reflection, guides, symbols, settings, backgrounds, onboarding, responsive layout and a11y. No Page/matcher bridge in their test bodies. |
| Consent and stable Dreamer journeys | Public TesterArmy tests, including the six-second animation observation under audit. | Preserved; consent retains both named providers, no permission on refusal, later reading, two dialogs, durable permission and original story. The animation waits for its whole observation before checking nonzero/full settled letters and zero replay. |
| Real local backend | Eight cases, moved into TesterArmy in #529 with Page/context compatibility fixtures. | Six public-API cases: RLS/other-user/anonymous isolation, Free/Plus server quota and sign-out, legacy/current themes and RPC, private Apple-token lifecycle. Two context/offline cases remain explicit compatibility exceptions in the same TesterArmy runner; their bodies are identical to #529. |
| Shared test-branch sessions | #529 moved two cases/setup into the guarded TesterArmy branch runner. | Preserved. Environment block: no approved allowlisted branch/accounts. The production HTTP/WebSocket guards and private saved-session handling remain. No remote seed or production access. |
| Lucid, Meditation, site | TesterArmy, including #529's latest journeys. | Preserved; the focused Lucid and Meditation validations below are new. Other unchanged #529 results remain historical; no new site/native/persona execution is claimed. |
| Outside `tools/e2e`: Lucid visual journey | `tests/e2e/lucid-visual-journey.mjs`, a manually invoked in-app browser journey. | Retired only after the four `PR237` equivalents in `lucid.web.e2e.ts` passed on `70c197ca6`. Password and hands-phase assertions retained explicitly; onboarding/time contrast, narrow tabs, programs/WBTB, account validation, morning→Journal→Atlas and both labs' persistence remain. Canonical command: `E2E_WEB_LOCALE=fr-FR npm run test:testerarmy:lucid -- run --grep PR237`. |
| Native / physical / Store | Existing guarded TesterArmy suites, one owner per identified device. | No binary/device/data touched; no native, physical, Release, Store or OTA qualification from these web runs. |
| SEO browser check / CDP profiling | Specialized browser SEO and performance measurements. | Retained as specialized tooling, not misrepresented as product E2E or device qualification. |

The 21 public families are: backgrounds (5), billing (13), capture-chat (2),
capture-editor (2), desktop-shell (1), dream-continuous-reading (3), dream-guides
(3), explorer-repertoire (3), home-editorial (3), journal-margin (6), journeys
(18), native-large-text-polish (1), onboarding-features (21), plus-channels (12),
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

## Historical evidence before the #531 integration

Previously delivered code candidate: `67b2df43b18efb23171d5778e96ef37f0de04ef1`.
This section describes the earlier #529 base; the following section records the
new #531 build and P2 follow-up. The final documentation commit and its exact
`verify:pr` proof are identified in the draft PR. No application source changed
relative to integrated master `ca3c4c93b581968aaec5bb76c21a7582887d1fc3`.

Build/target: app 3.7.0, Expo 58.0.14 development web bundles on macOS arm64,
Node 24.19.0/npm 11.17.0, Deno 2.7.14, Supabase CLI 2.121.0,
Chromium 156.0.8078.4, SDK pins listed above. Dreamer uses real local UI with
mock auth/storage/AI/billing and synthetic data. Backend uses real disposable
local Auth/Postgres/PostgREST and Deno API; only Apple exchange/revocation are
synthetic. External AI/payments/OAuth are blocked. Lucid uses fictional local
notes; Meditation uses local audio/state. There is no native build or real Store
qualification here. Every run below has clean, stable source-start/source-end
and immutable `end.json`; red runs remain red.

| Scope | Revision | Result | Private receipt under `tools/e2e/.e2e/` |
| --- | --- | --- | --- |
| Full Dreamer EN, feature ON, cold cache | `0edbb15a0820cc7524544098d7f8f0bf7f27342d` | 103 PASS, 3 FAIL, 27 deliberate other-context/OFF skips; exit 1 | `dreamer-web/1792578944175-33686-bc8832d9-d8ec-4250-871e-5be70b2e2815` |
| Search focus, strengthened consent, empty Trends journal, each ×3 | `5355dfb124d601568865561139ca235460ac5e82` | These 9 attempts PASS; the same run's other 6 Trends attempts FAIL on uppercase rendered text | `dreamer-web/1792579716100-45049-5af39eca-3246-4346-aa09-49f67c928a7a` |
| Both repaired populated Trends cases, each ×3 | `165d48c6378f58a6ab51027d8e50a6a54dcdfc7c` | 6/6 PASS, exit 0 | `dreamer-web/1792580087599-7718-8abb4865-decc-44c6-bdf8-97243eafdb98` |
| All FR public journeys, feature ON | `70c197ca63c6d3c123001857f56b19ed37f4071c` | 25/25 PASS, exit 0 | `dreamer-web/1792580329323-11964-de42b59f-5440-4ab8-9d3c-e5972b898509` |
| German Trends, feature ON, 320 px | `a1d911651bac570d5aff7b7998b142c7920f5622` | 1/1 PASS, exit 0 | `dreamer-web/1792580471300-15797-faf1a6c2-0600-4835-b33d-3836aefd380a` |
| EN feature OFF, cold cache | `a1d911651bac570d5aff7b7998b142c7920f5622` | 1/1 PASS, exit 0; receipt retains cache setting `0` | `dreamer-web/1792580505015-16632-35af7715-a5b4-4922-9ab4-fa701d5bc2b6` |
| Default local backend, all public + compatibility cases | `165d48c6378f58a6ab51027d8e50a6a54dcdfc7c` | 8/8 PASS, outer exit 0, owned stack destroyed | `backend-web/1792580089591-7965-39419ac1-ba6d-4f9b-8ad4-ada91d4034fd` |
| Four Lucid equivalents of the old manual visual journey | `70c197ca63c6d3c123001857f56b19ed37f4071c` | 4/4 PASS, exit 0, before retiring old entry | `lucid-web/1792580329982-12050-65841e80-c336-4965-947e-038013ae3d4f` |
| Meditation onboarding/favourites/audio | `a1d911651bac570d5aff7b7998b142c7920f5622` | First two PASS; audio FAIL because SDK rounded the pointer outside the track | `meditation-web/1792580470724-15711-c8432ab3-2d1e-4c8c-b89c-9fccbbbc8a55` |
| Repaired public audio seek/restart/completion, ×3 | `67b2df43b18efb23171d5778e96ef37f0de04ef1` | 3/3 PASS, exit 0; same near-end click one whole pixel inside the actual control | `meditation-web/1792580611996-18475-3ae5d87b-ab1d-4ab0-b091-762ff88afb6e` |

The reports' passed IDs cover all **133 deterministic Dreamer cases of that earlier base**
across their four contexts (106 EN/ON, 25 FR/ON, 1 DE/ON, 1 EN/OFF), including the
114 cases in the 21 ported families. One old consent title is superseded by its
strengthened rerun and is counted only once. This is combined evidence after
focused repairs, **not one freshly green full campaign**. Changed bodies were
rerun; unchanged test/fixture/app inputs retain their immutable results. No
unchanged five-minute onboarding observation was rerun merely for a docs edit.
Excluded cases in focused reports are not counted as passes. No unresolved
Dreamer mock-web failure remained in that earlier evidence set. It does not
qualify the later #531 application build by itself.

Exact commands (prefix `E2E_WEB_PORT=8126 E2E_WORKERS=2` for Dreamer;
`E2E_WEB_PORT=8127 E2E_WORKERS=2` for Lucid;
`E2E_WEB_PORT=8128 E2E_WORKERS=1` for Meditation):

```sh
# Full EN/ON run; preserved red result, followed by focused repairs below.
E2E_WEB_LOCALE=en-US E2E_KEEP_METRO_CACHE=0 EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED=true npm run test:testerarmy -- run
# Search, consent and empty Trends: 3/3 each; populated Trends red in this same run.
E2E_WEB_LOCALE=en-US EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED=true npm run test:testerarmy -- run --grep 'a search typed|declining AI|30 nights read|each door opens|an empty journal offers' --repeat-each 3
# Corrected populated Trends: 6/6.
E2E_WEB_LOCALE=en-US EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED=true npm run test:testerarmy -- run --grep '30 nights read|each door opens' --repeat-each 3
E2E_WEB_LOCALE=fr-FR EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED=true npm run test:testerarmy -- run --tag public-api --tag locale-fr-FR --tag-mode all
E2E_WEB_LOCALE=de-DE EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED=true npm run test:testerarmy -- run --tag public-api --tag locale-de-DE --tag-mode all
E2E_WEB_LOCALE=en-US E2E_KEEP_METRO_CACHE=0 EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED=false npm run test:testerarmy -- run --grep 'feature sheets stay disabled when switched off'
npm run test:e2e:backend # fixed canonical local web origin 8085
E2E_WEB_LOCALE=fr-FR npm run test:testerarmy:lucid -- run --grep PR237
E2E_WEB_LOCALE=en-US npm run test:testerarmy:meditation -- run
E2E_WEB_LOCALE=en-US npm run test:testerarmy:meditation -- run --grep 'resumes audio' --repeat-each 3
```

Types, focused lint with zero warnings, backend/process guards (31), TesterArmy
guards (49) and the applicable root checks passed. `verify:pr` on `5355dfb124d6`
ran 16 checks, reused 0, with 3 out of scope; its proof key is
`2ac4938e2a38e51ab673c1b64209f383dcca3afa`. The final head is independently checked
before push. Independent final-diff and focused delta reviews found no remaining
P1/P2 after correcting viewport clipping, image selection, screenshot paths,
semantic text, focus, consent and documentation discrepancies.

Development failures are retained privately and not counted as passes. The
French run `dreamer-web/1792580164271-8663-1c35958e-5c71-4dc6-8ce0-6fc3549508b2`
on `165d48c63` passed 24/25; a scene remounted between image readiness and pixel
read. Reading both atomically preserves the same 80×60 sampling/coefficients and
>.55/<.5 thresholds; the final 25/25 rerun above covers all backgrounds. Earlier
screenshot paths, glyph spacing, image selection and viewport-helper failures
remain in their private receipts. The preparatory French 25/25 on uncommitted
inputs is not used as final evidence. An integrated backend attempt on 18125
refused CONFIG_LOAD_FAILED before tests because #529 pins origin 8085; its owned
stack was destroyed. The canonical default run above passed without weakening
the origin guard.

The optional shared branch was checked before connection: `E2E_SUPABASE_URL`
is unset, `allowedProjectRefs` is empty; guard result: “test-login refused:
E2E_SUPABASE_URL is not set. Nothing was sent.” Its two cases remain preserved,
unexecuted and blocked on an owned approved target/accounts. No override, remote
seed or production credential change was attempted. The API compatibility limits
above also remain explicit: two backend context/offline bodies and the branch
WebSocket/private-session boundary have no public Browser equivalent in the
versions inspected; preserved coverage is preferable to replacing their invariant.

Private outputs stay in ignored `tools/e2e/.e2e/`: source identities/hashes,
command/env, report, traces/screenshots, qualification and `end.json`. Credentials,
private logs and generated images are not committed. No production, real
Apple/payment, physical-device, native Release, Store or OTA qualification is
claimed. The optional ChatGPT Pro/persona campaign and unaffected site/native
suites were not rerun for this test-tooling PR.

## Follow-up P2: Save clipping and #531 integration

Review of delivered `faa7960611d1b8b3267865b99b6bf70e0548d51c` found one
remaining viewport-only assertion in Capture's short-window case. It now uses
`expectInViewport` (public `IntersectionObserver`, ancestor clipping included)
after scrolling, keeping the prior x/y rectangle bounds. The same case now
constructs the precise counterexample in both 320×640 and 640×390: the real Save
button has a positive rectangle entirely within the window, yet an overflow
ancestor clips all its pixels. The helper must report false. A hidden anchor
restores the same button to its exact former parent position in `finally`; the
fixture is removed, the button scrolled into view and its intersection required
again. No application or personal data is modified.

The first fixture under the application passed the portrait counterexample but
failed its landscape precondition because a transformed ancestor moved its fixed
rectangle above the window. Receipt
`dreamer-web/1792581528473-37097-2811fcaa-33dd-48b0-a371-84bfe782f2db`
therefore remains red (3 PASS, 3 FAIL) on `b149b721e`. The corrected fixture is
positioned under `document.body`, independent of application transforms, with
the restoration anchor retained. Its two journeys each pass three repetitions.

During this follow-up, master advanced to #531. Its five new Plus cases, renamed
Home paths, account/subscription entry distinction, dated quota copy, per-dream
excerpt, chat limit, Trends and free recap contracts were preserved. Conflicts
in billing/journeys/Plus were resolved into public TesterArmy APIs; the public
family inventory is now **21 families / 119 cases**, and the deterministic
Dreamer collection **138 cases**. No application delta exists against #531.
The base was frozen at `2b4a7d3ea1921b83d55847120508b66eb590feb6`, also returned
by that delivery's read-only remote check. Later remote movement is recorded below.

| New-base execution | Tested revision | Result | Private receipt |
| --- | --- | --- | --- |
| Billing (13), journeys (18), Plus channels (12), Trends EN (3), core (16) | `b149b721e20638e0964bdfea00b570ed9d57b607` | 62/62 PASS, exit 0 | `dreamer-web/1792581528473-37100-d4c1dabd-1af3-4671-b2b6-cfe621798bc6` |
| Capture incl. clipping counterexample, both cases ×3 | `d4fc6fe582ed7a3d1b4e5b9f8bee319f14c66b24` | 6/6 PASS, exit 0 | `dreamer-web/1792581951064-51938-ccd65d36-bc0e-44f4-8103-a3a3a98a91ce` |
| FR public journeys, feature ON | `d4fc6fe58` | 25/25 PASS, exit 0 | `dreamer-web/1792581951064-51939-f8747f4a-427e-464f-8dcd-bc4026fce01b` |
| German Trends, feature ON | `d4fc6fe58` | 1/1 PASS, exit 0 | `dreamer-web/1792582012383-53134-520ee6d1-aa72-48b4-a531-047173f61c46` |
| EN feature OFF, cache retained | `d4fc6fe58` | 1/1 PASS, exit 0 | `dreamer-web/1792582143775-66098-06683d98-78d2-4576-9b71-a780e17daab2` |
| Real local backend | `d4fc6fe58` | 8/8 PASS, outer exit 0, owned stack destroyed | `backend-web/1792582057998-58793-e1ffddc5-2853-4713-8b96-34ab22ebf427` |

Every successful new-base receipt above has clean, stable start/end sources.
These executions cover **91 of the 138 current Dreamer IDs**; the other 47 were
not rerun on #531. Their earlier results retain their exact revisions above.
This is focused revalidation after integration, not a new complete release or
persona campaign. Native/Store/physical-device limits and the two backend API
compatibility cases / two blocked branch sessions are unchanged.

Commands: Capture used the Dreamer EN/ON prefix on port 8126 with
`--grep 'capture gives the story room|capture keeps long and fragmentary' --repeat-each 3`.
The 62-case selection on port 8127 is recorded verbatim in its `evidence.json`;
it covers all five listed files' EN cases. FR/DE use the same locale/tag commands
above, ports 8127/8126 respectively. The successful OFF command uses
`E2E_KEEP_METRO_CACHE=1`, the same OFF grep and port 8126, after backend completion.
`npm run test:e2e:backend` used its canonical 8085 origin.

The attempted OFF cold-cache diagnostic
`dreamer-web/1792582065176-59967-f5bbc575-717e-4312-a399-1b27c1337430`
failed before tests with APP_UNREACHABLE / Metro ENOTEMPTY while clearing the
shared cache during another local compilation. Exit 3, zero executed tests, no
qualification. No manual cache deletion, process termination or SDK patch was
used. The later OFF pass retained the cache and waited until the backend ended.
The earlier cold-cache `0` evidence remains historical; the recorded rerun flag
still preserves `0` exactly.

Types and focused zero-warning lint pass. Integrated `verify:pr` on `b149b721e`
passed (10 run, 6 reused, 3 out of scope), proof tree
`760522ae2c2ffce0814fa73dd434d022b7285bdb`. The final delivery head is verified
again before push and recorded in PR #530. Independent delta review confirms
Save clipping/restoration and parity of the merged owner assertions, with no
remaining P1/P2. All outputs stay private and ignored as before.

## Persistent QA identity support (2026-10-21 follow-up)

The owner requested an existing, constant QA identity preserved between runs.
Inspection found no local branch credentials/sessions, an empty committed allowlist
and no Noctalia branch in read-only Supabase metadata. Only production project
metadata was read; no production users/data or credentials were inspected. A hosted
QA target is not provisioned or qualified. The prepared plan and cost/domain/access
decisions are in [test-login.md](../../doc_web_interne/docs/test-login.md).

Normal branch runs now verify health, exact pinned Auth UUID/email, effective
free/Plus tiers and own-row access. A QA-only RLS table provides exclusive
cross-machine account leases; run UUIDs and registered request UUIDs restrict
fixture writes/cleanup. Cleanup failure retains the lease and private recovery
manifest and fails the run. No TTL lock stealing, account-wide delete, password
rotation, quota reset or global sign-out occurs. Existing seeding now preserves
existing identities/passwords/data/tiers, creating only missing dedicated QA users
during explicitly approved initialization. No admin credential is used by normal
runs, no new admin key was issued, and QA-only SQL is outside production migrations.

Both branch TesterArmy cases keep their session checks and additionally require
their server-backed per-run journal fixture. They remain **blocked by missing hosted
QA target**, not passed via mocks. The 8 existing disposable backend journeys,
including deletion, retain their isolated ephemeral accounts. `test:qa:local` adds
a native integration contract after those cases: two cycles with the same users,
preserved prior data, lock contention, RLS and cleanup. It destroys its owned
stack afterwards and cannot prove a hosted identity remains available.

Validation on clean code revision **`c3e04d89fbb1c00dfabdf30017d9a1f7d9c7a83f`**:

| Command / target | Observed result | Evidence / limits |
| --- | --- | --- |
| `npm run test:qa:local`, canonical 8085 browser origin | **8/8 backend cases PASS**, then **two reusable-account cycles PASS**, outer exit 0 and exact owned stack destroyed | `backend-web/1792585862895-11732-4f322738-17a9-413c-a91a-e3602cbe8216` plus ignored `test-results/persistent-qa-local.json` identifying this revision and CLI 2.121.0 |
| Supabase Auth/Postgres/PostgREST native integration | Same existing UUIDs across cycles, pre-existing sentinel retained, contender refused, cross-account lease RLS, exact fixture/session cleanup; installed supabase-js recovers exported session and verifies server user | Real loopback services; synthetic dedicated data only. No mock in the reuse contract. The eight browser cases retain their existing synthetic Apple exchange boundary. |
| Guard/seed/auth, QA recovery and backend runner tests | **62/62 PASS**, including nine persistent-QA tests | `/tmp/dreamer-qa-contract-tests-final.log`; delayed claim/fixture commits, busy account, failed cleanup, wrong identity, session expiry and production/unconfigured refusal |
| Focused lint / TesterArmy types | PASS, zero lint warnings | Changed JS/CJS/TS scripts and branch cases; app/tests types and aggregated checks are also recorded in the exact final `verify:pr` proof in PR #530 |
| `npm run test:qa:check` without hosted configuration | Expected refusal, exit 1, before network | `/tmp/dreamer-persistent-qa-hosted-refusal.log`; **not** a hosted health pass |

The first native contract attempt on `6485fc046` passed its eight browser cases
but the qualifier failed before account creation: the pinned CLI uses one prepared
statement even for `db query --file`, rejecting a multi-statement DDL file.
Diagnostic Apple-only runs on `9ed63a884`, `8656aa4d7`, `558b1d5c2` preserved that
red outcome and isolated `cannot insert multiple commands into a prepared
statement`. The reviewed QA SQL is now applied in a single
[PostgreSQL DO block](https://www.postgresql.org/docs/17/sql-do.html), only on the
identified owned stack. A two-cycle pilot on `b14f30058` passed; the final full
command above includes actual persisted-client recovery as well. No raw SQL/HTTP
error body or credential was logged. The red runs and their exact teardown logs
remain private, not silently qualified.

Independent review caught an additional recovery race: an errored transport can
commit a lease/fixture after an immediate empty cleanup read. The fix retains the
uncertain account's lease/session and recovery manifest, fails the run, and does
not infer rollback. Two targeted delayed-commit regressions cover it; final delta
review found no remaining P1/P2.

The integrated application base remains **`2b4a7d3ea1921b83d55847120508b66eb590feb6`**.
Read-only remote inspection later returned **`c6c1c51e4d0d47b336df21bea004a5486da5b42b`**,
one commit ahead, changing `services/subscriptionServiceReal.ts` and two test
files. Per the owner's freeze instruction it was not automatically integrated;
no fresh application qualification is claimed for that newer base. No application,
production migration or dependency delta was added by this QA follow-up.

No Docker, production, native device, Store or permanent hosted availability is
claimed. Actual persistent QA branch/accounts remain pending organization,
branch-cost approval, domain/target and secure provisioning. The normal runner
needs no admin key; ephemeral signup/deletion fixtures remain unchanged.
