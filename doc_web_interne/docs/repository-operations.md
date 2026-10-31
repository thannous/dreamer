# Repository operations

[AGENTS.md](../../AGENTS.md) defines authority, safety and delivery rules. Read only
this guide's relevant procedure and its linked specialist guide. Commands and
current implementations remain in [package.json](../../package.json),
[the script catalog](../../scripts/README.md) and [the task index](README.md).
A procedure or historical result grants no additional authorization.

## Runtime and prerequisites

`mise.toml` pins the project Node and Deno versions. Run `mise install`, then use
`mise exec -- <command>` unless your shell already activates the project tools.
Install root dependencies from the repository root. Meditation uses a separate
lockfile and additionally requires `mise exec -- npm ci` in `apps/meditation`.

- Install: `npm ci` (reproducible), `npm install` (update), `npx expo install <package>` (Expo-compatible package).
- Run: `npm run start`, `npm run web`, `npm run android`, `npm run ios`.
- Runtime modes: `npm run start:mock`, `npm run start:real`, `npm run start:teststore`, `npm run start:playstore`, `npm run start:supabase`.
- Expo Go: run `NOCTALIA_DISABLE_RC_WEB_STUB=1 npm run start -- --go` so Metro bundles RevenueCat's real web SDK (Expo Go runs
  react-native-purchases in browser mode). Local Expo Go only; EAS builds ignore it (`EAS_BUILD`). No npm script: `package.json` scripts feed the runtime fingerprint.
- Diagnose: `npx expo-doctor`.
- Mobile release: follow [MOBILE_VERSIONING.md](MOBILE_VERSIONING.md); use `release:build` for its local checks and pinned EAS CLI.
- Local Android Release: Java 17 and Android SDK are required. The runner checks Java before build preparation; see [tooling prerequisites](../../scripts/README.md#local-android-prerequisites).

Backend URL resolution uses `EXPO_PUBLIC_API_URL`, then `app.json` `expo.extra.apiUrl`; see
`lib/config.ts`. Use `lib/http.ts` for network requests and its timeout/auth conventions.

### Local development backend

Production stays production: for daily work on a phone, the Simulator or the web, run a
persistent local backend instead (macOS 14+ on Apple silicon or Linux glibc 2.35+, no Docker):

```sh
mise exec -- node tools/dev-local/dev-local.mjs            # Ctrl-C stops and keeps the data
mise exec -- node scripts/expo-safe-runner.js --profile outputs/dev-local/expo.env start --dev-client --lan --port 8081
mise exec -- node tools/dev-local/check.mjs                # guest and signed-in proof through the real API
```

It starts the native Supabase runtime on the tracked migrations (copies with production URLs
neutralised and scheduled jobs disabled), creates `dev-free@noctalia.test` and
`dev-plus@noctalia.test` (Plus through `apply_subscription_state_update`; passwords printed at
start and kept in `outputs/dev-local/secrets.json`), and serves Auth, Data API, Storage and the
real `api`/`capture-recall` routes and job workers on this machine's private LAN address,
port 31300 only (`--host` picks another private address, such as the Tailscale one, and `--port`
the port). The private `dream-images` bucket is created at start. Data lives in ignored
`outputs/dev-local/`; `--reset` destroys it.

- **AI** answers are fixed and built from each route's JSON schema
  (`tools/dev-local/deterministic-ai.ts`): nothing is sent to a provider or billed. Streamed
  Gemini replies are not simulated. Real-provider quality stays with the manual
  `reflection:eval:*` evaluations.
- **Guests** keep the real session flow with local verifiers, only in this never-deployed server:
  App Attest in its development environment for this team's builds (physical iPhone Debug
  builds; the Simulator has no App Attest), any Play Integrity token on Android, and
  Cloudflare's always-pass Turnstile test keys on the web. The server refuses to start unless its
  backend is an identified native stack on loopback and its public origin a private HTTP address.
- The app keeps a separate guest session, App Attest key and refusal pause per plain-HTTP API
  (`backendStorageKey` in `lib/guestSession.ts`), so switching between production and the local
  backend carries neither server's state to the other. Production key names are unchanged.
- Development builds send the signed-in session token over plain HTTP to a private-network
  address as well as loopback (`lib/http.ts`), so a phone can use the local accounts; a release
  build keeps cleartext tokens to loopback only.
- Store sync (`subscription/refresh`, `subscription/sync`) reports the stored entitlement without
  calling RevenueCat, so the Plus account stays Plus.
- Not available: Google/Apple sign-in, purchases, e-mail delivery.
- Opening a personal install against it with a local account can move that install's guest
  journal into the local account: prefer an owned QA install, the Simulator or the web.
- No npm script: `package.json` scripts feed the runtime fingerprint.

The canonical desktop/runtime entry point is `script/build_and_run.sh`, which keeps
Metro in the foreground. An optional local `.codex/environments/environment.toml`
can delegate desktop Run actions to it; this checkout does not ship that file.
Use the package scripts when it is absent. See `./script/build_and_run.sh --help`
for supported modes.

## Local validation and CI

[Proportional validation](validation-proportionnee.md) owns risk-based checks,
E2E/isolation exceptions, evidence reuse, independent review, the isolated
`verify:pr` flow, PR updates and the merge procedure. The
[local validation and CircleCI guide](circleci-migration.md) lists current
coverage and release targets; [verify-local.config.mjs](../../verify-local.config.mjs)
is the executable source of truth.

`verify:pr` also runs two local web gates when the diff touches the app, with no
GitHub Actions minutes and, by default, no model call. `parcours-touches` maps changed paths
(`app/`, `components/`, `services/`, and the other roots in `tools/e2e/zones.mjs`)
to e2e tags and test files, then runs `e2e run --changed-since origin/master`.
`smoke-journeys` runs the seven tagged smoke journeys (capture, save, journal,
payment, sign-in) on every Dreamer app diff. A docs-only or non-app diff skips
both. A native-only diff exits 0. If a zone is touched and Node 24.22.1,
`tools/e2e/node_modules`, or Chromium is missing, the probe fails and the proof
is incomplete, not passed. Rerun: `npm run test:e2e:parcours`
and `npm run test:e2e:smoke`.

Optional decision model: with an OpenAI key in `OPENAI_API_KEY`,
`parcours-touches` also asks the TesterArmy decision filter (OpenAI's
Decisions API, `gpt-6-luna`, named in `tools/e2e/zones.mjs`) about every
Dreamer and Lucid parcours the zones leave out, on any Dreamer app diff, named
zone or not. The model sees the committed diff and the journey files; a file
only the working tree changes reaches it by name alone. A
parcours runs unless the model rates it under 20% likely affected; the zones
stay the floor, smoke and bug-bash tests keep their own checks, and a parcours
the model cannot judge runs. A lockfile or e2e config change makes it keep
every parcours. If the model cannot answer at all (no route, rejected key),
the zones decide alone and the run's filter note says so. The first verdict for
a commit is kept under `.git/verify-cache/e2e-decision/`, so `e2e list` and
`e2e run` select the same tests and a rerun asks nothing. The proof records
whether the model was on, so a pass without the key is not reused once it is
set. Without the key the gate is unchanged.

Before an app release, run `npm run test:bugbash:prerelease` on Dreamer web in
mock mode (the script refuses a production Supabase ref). Each confirmed bug
becomes a failing test under `tools/e2e/tests/bugbash/`, tagged `bugbash`.
`verify:release` runs those tests (`bugbash-repros` / `npm run test:bugbash:repros`).
The PR gate excludes the tag. An empty repro directory passes.

`verify:pr` runs engine tests, application/test types, lint and script lint,
related Jest and static database contracts, each only when the PR changes a file
it reads: their scopes in the configuration are checked against the two tsc
programs, the lint import graph, the Jest projects and the files the database
tests open, and a PR changing the configuration or the engine runs those
guards. Changed inputs add site build/check, CI/benchmark contracts, mobile
version pins, Meditation and Deno Edge checks. `npm run verify:pr -- --plan`
prints what each check would do (run, reused, out of scope, cannot run here) and
a time from this clone's earlier runs, without running anything.
`npm run verify:pr:status` (`verify:pr -- --post-status`, opt-in) then posts the
result as the GitHub commit status `verify-local/pr` (success or failure, with a
short description) through `gh api` on github.com, for the verified SHA only.
It refuses to start on a dirty checkout or when the verified commit is not HEAD.
It posts nothing (exit 3 after a pass) if the checkout changed or moved during
the run, or if github.com does not know the commit yet: push it, then run again
(the passed checks are reused). Success needs exit 0 and a passed proof; a run
that throws posts nothing. The default `verify:pr` posts nothing.
`verify:release` runs the complete release set afresh on the delivered SHA and
rebuilds the site and app web output. `verify:release:site` excludes only the app
target (web app build, backend browser qualification and Dreamer/Lucid/Meditation
campaigns); it qualifies a site-only publish. Device QA and EAS builds remain separate.

Fetch `origin/master` before proving a commit. The engine tests the committed
head in an isolated worktree linked to the main checkout's dependencies;
uncommitted WIP is preserved and is not qualified. `test:changed` uses the same
merge-base; `JEST_CHANGED_SINCE=HEAD` describes only a working-tree delta. Input
reuse, the exact conditional selections and their exclusions are defined in the
configuration; documentation-only changes do not invalidate code evidence.

Heavy install/check steps use `/tmp/fleet-verify-heavy.lock` through `flock`.
Another run waits; without `flock` (for example macOS), the run reports that the
steps have no machine lock. A signal-terminated check fails. This repository's
`scripts/verify-local.mjs` pins and verifies its own `ENGINE_SHA256`; port an engine
fix to the other copies when applicable, but there is no cross-repository check.
Keep hook and local validation coverage intact. Delivery-control changes require
a separately justified scope.

Run specialized checks locally where `verify:pr` runs. Missing prerequisites leave
the proof `incomplete`, which blocks pushing. If that machine cannot run a check,
run it on an equipped owner machine and supply
`--external <check>="owner-machine: <host> <note> on <SHA>"`. No HTTPS/CI evidence URL
is accepted (`externalSources: []`). Native/device evidence cannot be replaced by
mock or unit-test repetition.

CircleCI runs only an optional E2E/Chromium installation benchmark, requiring both
`run_e2e_benchmark=true` and a manual/API trigger (`pipeline.event.name=api` or
legacy `pipeline.trigger.type=api`). Webhook pushes run nothing. It runs no app
validation; merges and publication do not wait for it. Former validation jobs are
frozen local test fixtures, not a remotely executed pipeline.

EAS workflows in `.eas/workflows/` run only through `workflow_dispatch`, never PRs
or tags automatically. The `android-release-smoke` and
`android-release-qualification` workflows require `release_tag` and the matching
ref: `eas workflow:run <file> --ref vX.Y.Z -F release_tag=vX.Y.Z`. Without `--ref`,
EAS sends the local folder. `scripts/check-android-release-ref.js` rejects a missing
tag, a mismatch with `app.json`, or another ref supplied by EAS. EAS execution still
requires its scope-specific authorization.

For the guarded persistent test branch, use [test-login.md](test-login.md).
`test:env:check` makes no request; seed/login scripts must first pass
`scripts/test-supabase-guard.mjs`, refusing production, unidentified/unallowlisted
refs and non-test email identities. The allowlist is currently empty, so these
commands refuse all remote targets. Credentials belong only in ignored
`.env.test.local`, never `EXPO_PUBLIC_*`; sessions are ignored under `.auth/`.
The branch's retired Maestro journey never ran and does not qualify native login.

## Focused check entry points

Choose one appropriate entry point; these are alternatives, not a sequence:

| Surface | Commands and guide |
| --- | --- |
| Jest | `test:related -- <files>`, `test:file -- <tests>`, `test:changed`, or `npm test` for justified broader coverage; `test:node` and `test:expo` select projects. Use `--watchman=false` when Watchman is blocked. |
| Types, lint, performance | `typecheck:app`, `typecheck:tests`, `npx expo lint <paths>`, `lint`; `test:perf` owns performance tests. |
| Site | Edit source, then `docs:build` and `docs:check`; the build includes `docs-src/experience/`. Use `docs:dev` and the [single-page loop](../../docs-src/README.md#iterate-quickly-on-one-generated-page); `docs:release-check` is for release-ready work. |
| Backend | `db:contract:check` or `db:contract:check:local`; [owned native stack qualification](e2e-backend-qualification.md) runs on the native Supabase runtime (no Docker); `test:e2e:backend -- --qualify-ti528` adds the TI528 cases to the release gate's browser journeys. |
| Android | `android:gates`, `security:audit:mobile`, and the smallest affected TesterArmy selection (`test:testerarmy:mobile -- <product> android --grep ...`). |

## Styling and Motion

- Styling is **Uniwind** (Tailwind v4 bindings for React Native). Canonical colours live in
  `constants/noctaliaPalette.ts`; `global.css` contains generated colour tokens. `metro.config.js` wraps
  the config with `withUniwindConfig` as the
  outermost wrapper. See `specs/uniwind-migration-guide.md` and `specs/adr-001-nativewind-vs-uniwind.md`.
- Colour vocabulary: `ink` (grounds and surfaces), `ivory` (text), `champagne` (accent).
  **`champagne` is never a text colour** — accented copy uses `text-champagne-on`, which is
  WCAG AA on both grounds.
- `constants/journalTheme.ts` / `constants/noctaliaDesign.ts` derive from the common palette.
  Edit colour values there only via `constants/noctaliaPalette.ts`, then run
  `npm run uniwind:types` (includes CSS generation). Do not hand-edit the generated
  colour block in `global.css`; `npm run theme:check` and `npm run brand:check` verify parity.
- Uniwind and `StyleSheet` coexist; migration is incremental. Migrate a component fully or not
  at all — a component half in `className` is where contrast and spacing regressions hide.
- Colour values passed as *props* (LinearGradient `colors`, icon `color=`, chart colours) stay
  on `useTheme()`. That is expected, not debt.
- Motion primitives are in `components/motion/` (`PressableScale`, `Reveal`, `DURATION`, `EASE`,
  `SPRING`). Most things should not animate. Tabs never slide.
- Missing release-device evidence does not block authorized local motion work. Report
  motion quality as unqualified until the relevant release-device checks are complete.
- After editing `global.css`, run `npm run uniwind:types`.

## Candidate and QA continuity

1. Identify each mobile release candidate in the existing evidence record: source SHA,
   platform, binary version/build and install source, OTA update/runtime/channel if applicable,
   and relevant backend revision or migration state. Mark unknown fields explicitly. Decide
   whether delivery needs a native build, OTA, or backend deployment; only qualify changes
   actually present in the tested environment.
   For Noctalia build counters, use `npm run release:versions:sync` and verify with
   `npm run release:versions:check`; see [version synchronization](mobile-build-version-sync.md).
   Keep EAS as the counter source; never change a Store or EAS counter to match stale local files.
2. Before an affected device journey, check the approved existing account, preserved local
   data, quota/entitlement state, test-payment mode when applicable, and supported UI entry
   points. Use stable automation targets and existing device coordination. An environment
   blocker is not an app failure; do not create another account or reset data to bypass it.
3. Before retrying a failed build, submission, or backend deployment, record its stage,
   exact error, and changed condition that justifies the retry. Reuse canonical preflights
   and check existing submissions. For migration drift, compare tracked SQL, applied history,
   and actual schema before proposing a repair; never reconcile history blindly.
4. Keep one compact handoff per work package: integration owner, scope and existing
   authorizations, candidate identity, valid evidence, unresolved blocker, and next action.
   Reuse decisions and unchanged evidence. Keep private QA artifacts out of Git; tracked
   summaries must be redacted. These records do not grant additional action permissions.

Keep evidence proportional: one canonical report and receipt with the useful failure
log/media and exact rerun command. Reference that immutable output rather than copying
and fully rehashing it at each review or status update. Recheck when bytes are transferred,
inputs change, corruption is suspected or an applicable release check requires it. Current
runner identity/artifact checks remain in use; duplicate ad hoc collectors are unnecessary.


## Native journeys and inspection

Before device work, select the app-specific profile and owned data; Dreamer's
allowlist is not Lucid's or Meditation's. Identify the installed binary and its
supported entry points rather than assuming an older Play build supports current
deep links. Check SDK/dependency compatibility before costly builds and pilot a
measurement method on one sample before scaling it. Necessary requested native
work uses isolated generation, preferably explicit `prebuild --no-install`, and
compatible existing projects. Do not regenerate another task's native project;
a stale primary project (for example after an Expo SDK upgrade) may be regenerated. `script/build_and_run.sh` start modes do not prebuild.

TI-429's physical Motorola VNext/Maestro base-app harness was retired with Maestro
on 2026-10-14. Its base-app-only rule ended; owned emulator/Simulator TesterArmy
QA does not establish personal/base/Play equivalence. Personal or Play-installed
`com.tanuki75.noctalia` still requires source/version/signature checks and preserved
data; never uninstall or clear it to force an installation.

Read `tools/e2e/README.md`. `npm run test:testerarmy` runs Dreamer web;
`test:testerarmy:lucid`, `test:testerarmy:meditation`, and `test:testerarmy:site`
select the other web products. A native `run` without `E2E_DEVICE` reserves a
disposable Simlock device, installs the identified Release and releases the lease
after the runner finishes; see the [Simlock procedure](../../tools/e2e/README.md#automatic-simlock-reservation).
For an explicitly selected native installed Release build use
`E2E_DEVICE=<emulator-serial> npm run test:testerarmy:mobile -- <product> android`
or an explicitly named iOS Simulator with `<product> ios`. Product is dreamer,
lucid or meditation. Run setup/browser installation once through package scripts.
Maestro was retired on 2026-10-14 (owner decision): the Android release evidence is a
local TesterArmy run of a `production-apk` Release build on an emulator, which
`npm run android:gates:strict` requires for the candidate versionCode, commit and APK.
The gate derives stability and cleanliness from the run's `source-start.json` and
`source-end.json` (same release commit, empty working trees, equal file maps);
`end.json` is not in the run manifest, so it is only an extra condition.
Owner decision 2026-10-17 (thanh): the Android real voice check is an optional
manual test and does not block the release gate; `android:gates:strict` lists it
as `manual`, which passes. Real voice and
RevenueCat Test Store purchases follow the manual checklists of
`doc_web_interne/docs/android-expo57-qa-runbook.md` and `doc_web_interne/docs/revenuecat-qa-workflow.md`.


For native inspection/exploration, use the official `agent-device` skill with
`npm run agent-device:inspect -- <product> <android|ios>` or
`npm run agent-device:mcp -- <product> <android|ios>`, and explicit `E2E_DEVICE`.
Read `tools/e2e/README.md`. These reuse the test runner's installed-build checks
and exclusive device lock; direct CLI/MCP must not bypass ownership. Inspection
captures UI evidence without resets and does not qualify a user journey. New
regression tests remain TesterArmy tests; do not introduce a separate `.ad` gate.

## Requested media

For requested Higgsfield work, check the host's installed skills and policy first.
Ignored machine resources may provide `.agents/skills/WORKFLOW-POLICY.md` and
`.agents/skills/higgsfield-video-explainer/SKILL.md`; they are not distributed by
this checkout. Follow the installed policy, or prepare locally and report a missing
required resource before submission. Preset discovery/validation requires the live
catalog; custom-style preparation does not. Verify the selected model's live
contract before submitting. Use only authorized providers and budgets.

## Publishing to production

Production publishes are manual. They happen only with thanh's go. A Git push or merge to `master`
must not deploy production by itself.

Publish one `master` SHA. From a clean checkout where `HEAD` is the fetched `origin/master`, run
`npm run verify:release` and publish only when it ends `passed`. It reruns every check on this
commit, reusing nothing, rebuilds the site (`docs:build`, `docs:check`) and the web app
(`build:web`) for this commit, and runs the full local validation; `node scripts/verify-local.mjs
status` shows the proof of `HEAD`. When only the site ships, `npm run verify:release:site` is
enough: the same run without the checks of the `app` target (`build:web`, `e2e-backend` on the
native Supabase runtime, the TesterArmy Dreamer, Lucid and Meditation campaigns). A check this
machine cannot run (Deno, native Supabase runtime, TesterArmy) leaves the proof `incomplete`: run it on a machine
that can and rerun with `--external <check>="owner-machine: <host> <note> on <SHA>"`. `npm run
docs:deploy:prod` (site) and `npm run web:deploy:prod` (Vercel web app) then refuse unless `HEAD` is
`origin/master` after `git fetch`, the checkout is clean, and a passed `release` proof exists for
this `master` SHA (`scripts/check-site-publish-proof.mjs`, through the engine's
`checkReleaseProof`); `web:deploy:prod` also requires that proof to cover the `app` target, which
only `npm run verify:release` does. There is no override flag or variable. Only then does the site
publish run `docs:release-check` before the upload. After the publish, check production (health,
touched pages) and record the SHA and the deployment.

### Vercel (noctalia.vercel.app and dream.noctalia.app)

Project `thanhs-projects-9baa3976/noctalia`. `vercel.json` sets `git.deploymentEnabled` to `false`,
so no branch, including `master`, creates a Git deployment. Preview deployments from Git stop as
well. `ignoreCommand` does not start a deployment. It only skips or continues a build that Vercel
has already started, and Git pushes no longer start one. No GitHub Action and no CircleCI job runs
the Vercel CLI. CircleCI does not run on webhook pushes, and its jobs do not publish.

The only production publish of this project is the npm script below. From a clean checkout where
`HEAD` is the fetched `origin/master`, run `npm run verify:release` on that SHA until it ends
`passed`, then set `VERCEL_TOKEN` (do not commit it) and run:

```sh
npm run web:deploy:prod
```

`scripts/web-deploy.js` runs the same publish guard as `docs:deploy:prod`
(`scripts/check-site-publish-proof.mjs`: `HEAD` is `origin/master` after `git fetch`, clean
checkout, passed `release` proof of `HEAD` that covers the `app` target; no override flag or
variable). It then extracts a clean copy of that `HEAD` (`git archive`) into a temp dir and, in that
copy only: `vercel link` for `thanhs-projects-9baa3976/noctalia` (the resulting
`.vercel/project.json` must carry the pinned `projectId` and `orgId`, else it refuses), `vercel pull
--environment=production`, `vercel build --prod`, the guard again right before the deploy (it must
accept the same `HEAD`), then `vercel deploy --prebuilt --prod` labelled with `--meta
gitCommitSha=<HEAD>`. Only `.vercel/output` is uploaded, which stays under the Hobby CLI upload
limit; untracked or ignored files (`dist/`, `.env*`, caches) cannot ship.

Every Vercel call names `--scope` and `--project` and gets an allowlisted environment only (`PATH`,
`HOME`, `TMPDIR`, proxy and CA variables when set, the Windows essentials on Windows), so no local
`EXPO_PUBLIC_*`, `NOCTALIA_*`, `NODE_ENV` or `VERCEL_PROJECT_ID` can reach the production bundle or
pick the project.

`vercel build`, which runs `npm install` and the project build command, gets that allowlist without
`VERCEL_TOKEN` and with `HOME` set to an empty dir in the temp copy (npm keeps its cache through
`npm_config_cache`), and no `--project`/`--scope`: it builds from the checked local link and the
pulled settings. The script reads `VERCEL_TOKEN` once at start, removes it from its own
`process.env` (so the guard's `git` calls and `vercel build` do not inherit it) and passes it only
into the environment of `link`, `pull` and `deploy`.

This is not isolation: dependency install scripts and the build command run as the same user, so
they can still read the environment this process and its `npm run` parent were started with
(`/proc/<pid>/environ` on Linux) and find the real `HOME` (`os.userInfo()`) with any `vercel login`
auth file in it. Only a separate user or a container isolates the token from them.

The pulled env file stays in the temp copy (created with mode 0700), its values and the token are
redacted from the printed CLI output, and the temp dir is removed on success, on failure and on
SIGINT, SIGTERM, SIGHUP (terminal closed, SSH dropped) or SIGQUIT, with exit 128 + the signal number
(130, 143, 129, 131) and a message naming the signal.

Each Vercel step runs in its own process group and session; on a signal the whole group gets
SIGTERM, then SIGKILL if the group (not only the CLI) is still there after 5 seconds, and the script
waits until the group is gone before cleaning up and exiting. Once a handler has started, no further
step starts, even if the running one exits 0 just after the signal.

A signal during `deploy` may come after the upload finished: check the Vercel dashboard. Windows has
no SIGQUIT. On Windows (no process groups) it uses `taskkill /T /F` on the step's tree, untested. If
the script itself is killed with SIGKILL, which cannot be handled, the step's group is not stopped
and the temp copy stays until the next run sweeps it.

At start the script removes stale `noctalia-vercel-*` dirs under the system temp dir left by a
killed run: only real directories owned by the user whose recorded owner pid is no longer alive, or
without an owner pid and older than 6 hours.

The Vercel CLI is the exact devDependency `vercel@62.2.0` (`package.json` and `package-lock.json`,
installed by `npm ci`), never run through `npx` or `node_modules/.bin`: the script runs `node` on
the package's own entry (`bin.vercel`, `dist/vc.js`) after checking, before the guard and with
nothing run on a refusal, that `node_modules/vercel` and that entry are real files of this checkout
(realpath inside `<repo>/node_modules/vercel`, no symlink or `npm link`, so a checkout whose
`node_modules` or `node_modules/vercel` is a link, like the `verify:pr` scratch worktree, is
refused: deploy from the main checkout after `npm ci`), that `package.json` there is `vercel`
`62.2.0`, that `package-lock.json` pins its version and integrity, that npm's install record
`node_modules/.package-lock.json` matches the lock for `vercel` and its whole resolved dependency
closure (hoisted `@vercel/*` and the rest, and nested entries), and that a sha256 over every file of
the package (except its nested `node_modules`) equals the value committed in the script.

A version bump updates the version, integrity and file hash together (follow-up: npm marks 62.2.0
deprecated for its `vc upgrade` bug, which this script never runs). Every Vercel call gets
`VERCEL_CLI_USE_NATIVE_BINARY=0`, so `dist/vc.js` does not hand over to the optional native binary
(the default on macOS), which the hash does not cover.

Same-user limit: `node_modules` is not tracked, so code running as the same user can still change it
between the check and the run, or change a dependency the hash does not cover. The stale-copy sweep
runs before this check, so a refused run still removes old copies. It reads `VERCEL_TOKEN` from the
environment, never from argv.

Never call the Vercel CLI for a production deploy by hand: it skips the guard.

A rollback that promotes an earlier deployment (Vercel dashboard or `vercel promote`) is a
production change outside this guard: only thanh decides it, for a deployment that was itself
published through `npm run web:deploy:prod`, and the SHA and reason are recorded.

### Cloudflare Pages (https://noctalia.app)

Project `noctalia`. There is no `wrangler.toml` and no `pages_build_output_dir`. CircleCI and GitHub
Actions do not run `wrangler pages deploy`. `docs-src/config/cloudflare-pages.json` records the
build settings. A Git push does not apply that file. Production auto-deploy is the Cloudflare Pages
Git integration, which is a dashboard setting. Turn it off before treating `master` as
publish-on-decision:

1. Open Workers & Pages and select the Pages project `noctalia`.
2. Open Build, then edit Branch control, and turn off Enable automatic production branch deployments. The same control is labeled Settings, Builds and deployments, production branch, in older dashboard copy.
3. Set Preview branch to None as well: under the delivery rule, previews are on demand only (`npm run docs:deploy:preview`), never one per pushed branch. Preview deployments do not update `noctalia.app`.

Until step 2 is saved, a push to `master` still publishes the site.

After that, from a clean checkout where `HEAD` is the fetched `origin/master`, run `npm run
verify:release:site` (or `npm run verify:release`) on that SHA until it ends `passed`, then set
`CLOUDFLARE_API_TOKEN` (Pages edit) and `CLOUDFLARE_ACCOUNT_ID`. Do not commit either value.

```sh
npm run docs:deploy:prod
```

That first runs the publish guard (`HEAD` is `origin/master` after a fetch, clean checkout, passed
`release` proof of `HEAD`; no override), then `docs:release-check`, stages allowlisted runtime
files, runs the guard again right before the upload (it must accept the same `HEAD`, which labels
the upload), and uploads them with Wrangler. The command it runs is `npx wrangler pages deploy
<staging> --project-name noctalia --branch master --commit-hash <HEAD>`. `--branch master` is the
production branch, so the upload updates `noctalia.app`. Flags are the ones documented for `wrangler
pages deploy`: `--project-name`, `--branch`, `--commit-hash`.

Do not upload with a raw `npx wrangler pages deploy ... --branch master`: it skips the publish guard
and the allowlist, which refuses internal files that a raw `docs/` upload would include. `npm run
docs:deploy:prod` is the only production publish of `noctalia.app`. Cloudflare documents that a
Git-connected Pages project can take these Wrangler uploads after automatic deployments are
disabled. The project stays Git-connected. It does not become a Direct Upload-only project.

## Official references

- [Expo documentation](https://docs.expo.dev/llms-full.txt)
- [React Native documentation](https://reactnative.dev/docs/getting-started)
- [TesterArmy with Expo](https://docs.expo.dev/guides/using-e2e/)
