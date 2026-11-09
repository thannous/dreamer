# Repository Guide

Noctalia contains the Dreamer and Lucid Expo apps, a separate Meditation package,
a Supabase backend and a generated multilingual site. This is the shared guide for
all agents: it holds the authority, safety and delivery rules and links the guides
that hold the procedures. It stays the only instruction file; do not add
provider-specific copies such as `CLAUDE.md`. Meditation adds its own
[local guide](apps/meditation/AGENTS.md).

## Start here

- Run `git status --short`, then read the [task index](doc_web_interne/docs/README.md),
  the relevant code, local instructions and installed skill/API topic. Find files with
  `rg --files` before guessing paths.
- [package.json](package.json) owns commands; `mise exec -- npm run scripts:list` and
  [scripts/README.md](scripts/README.md) explain their prerequisites and effects.
- [Repository operations](doc_web_interne/docs/repository-operations.md) holds runtime,
  validation, native QA and publication procedures;
  [repository layout](doc_web_interne/docs/repository-layout.md) maps sources, generated
  output, private QA and preserved history.

A procedure, a skill or a historical result guides execution; it grants no authorization.

## Authority and Autonomy

- Latest explicit user scope and current product contracts govern, subject to higher
  priority instructions and tool permissions. Historical choices, reports and tests
  are context, not permanent restrictions.
- An implementation/fix request authorizes its scoped changes, validation and applicable
  commit/PR/push steps; an audit/proposal request authorizes the proposal only. Explicit
  local-only, no-push and review-before-merge boundaries prevail.
- Reuse existing authorization and decisions. Complete authorized reversible local work
  autonomously; ask only for a material missing decision or an action outside scope.
  Finish concrete preparation first and continue independent work while blocked.
- Work in four proportionate stages: frame objective, acceptance criteria and boundaries
  once; prepare; implement and validate; verify each requested delivery result. Optional
  targets and suggestions do not become blockers without a new risk or explicit
  requirement. Native builds, full suites and review follow the affected risk.
- Delegated choices allow reasonable agent selections; identify those honestly rather
  than claiming user review. Missing, blocked or stale evidence never counts as passed.
- Production deploys, Store submissions, EAS builds, destructive database actions,
  new providers, extra spending and access changes require their own authorization.
  A merge that deploys production also needs publication intent.
- Requested native work includes necessary local builds, isolated native generation and
  compatible installation on an owned disposable QA target. It does not authorize
  replacing a personal app, resetting unowned data or increasing a budget.

## Project Rules

- **Work in progress.** Preserve unrelated WIP and personal app data. Use the existing
  checkout, isolating conflicts with a worktree; for a shell-created task checkout use
  `npm run workspace` from the primary repository under `~/Projects`
  ([maintenance rules](scripts/README.md#maintenance-rules)). Reuse compatible
  dependencies and patterns; check compatibility before expensive builds. Regenerate a
  stale native project (for example after an Expo SDK upgrade) in the checkout that
  uses it, including the primary one.
- **Secrets and privacy.** Never commit `.env`, `.env*.local`, `CLAUDE.local.md`,
  `settings.local.json`, credentials, auth sessions or temporary logs. Every
  `EXPO_PUBLIC_*` value is client-visible, so tracked profiles such as `.env.mock` hold
  only values that are safe to expose. Preserve private formative feedback. Do not send
  private project content to free third-party inference endpoints or unauthorized
  providers. Durable redacted evidence is allowed in the locations the repository
  layout defines.
- **Personal and Play-installed app.** On a personal or Play-installed base app
  (`com.tanuki75.noctalia`), identify install source/version/signature and preserve
  data; never uninstall or clear it to force an install. A destructive reinstall needs
  separate authorization and a preservation plan. Owned disposable QA uses its existing
  profile. Do not claim base/Play equivalence.
- **Devices and accounts.** Resolve the requested product, app-specific profile and
  owned data before device work; do not reuse Dreamer's allowlist for Lucid or
  Meditation. Before a device journey check the approved existing account, preserved
  data, quota/entitlement, payment mode and entry points. Do not create replacement
  accounts or reset data to bypass an environment blocker. Missing device access does
  not block authorized local work.
- **Checks and hooks.** Keep mandatory platform/security checks, hooks and local
  validation coverage intact. Never use `git push --no-verify` or change
  `core.hooksPath`. A delivery-control change needs separately justified scope.
  Distinguish patch bugs from baseline/environment, Watchman, device and network
  failures; fix genuine bugs rather than hiding failures.
- **Retries and drift.** Record stage/error and changed conditions before retrying
  failed builds/submissions/deployments; compare SQL, migration history and schema
  before drift repair.
- **Metro on macOS.** Start Expo/Metro through canonical scripts with required
  outside-sandbox approval for AppKit/React Native DevTools. Do not disable its
  standalone shell by patching Expo or React Native middleware.

## Structure and Sources of Truth

- Dreamer uses `app/`. Lucid shares the root package and uses only `routes/lucid/`
  (`routes/lucid/lucid/`); Dreamer's ritual opens Lucid. Follow its
  [specification and sleep/wellbeing safeguards](specs/noctalia-lucid-trainer.md).
- Meditation lives in `apps/meditation/`, with its own package/lockfile and local guide;
  run its commands there.
- Backend code and migrations live in `supabase/`. App requests use `lib/http.ts`; URL
  resolution lives in `lib/config.ts`.
- Site: edit `docs-src/` and canonical `data/` inputs, rebuild ignored `docs/`, and
  never commit generated site output.
- Local task artifacts belong in the canonical ignored `outputs/` directory; nothing
  under `outputs/`, `screenshots/` or another local-output folder is tracked. Keep
  native tooling outputs (for example `tools/e2e/.e2e/`) canonical for their runs;
  reference them instead of copying complete media for handoffs.
- Keep reusable procedures in current guides and dated results in their existing
  evidence locations; age alone is not removal proof.

## Setup and Commands

Install the Node and Deno versions pinned in `mise.toml` with `mise install`, then use
`mise exec --` unless they are already active. Run `npm ci` at the root (it also
installs the pre-push hook) and separately in `apps/meditation`; `tools/e2e`
(`npm run test:testerarmy:setup`) and `tools/expo-agent` keep their own lockfiles.
In a fresh clone or cloud container, `script/setup_agent_session.sh` does the root
and e2e installs and the browsers in one step (`--link` where the pinned Node is
installed but is not the default, `--meditation` for that app).
Use existing package scripts and the
[runtime prerequisites](doc_web_interne/docs/repository-operations.md#runtime-and-prerequisites),
which also cover the local development backend and the Expo Go
`NOCTALIA_DISABLE_RC_WEB_STUB=1` switch. `script/build_and_run.sh` is the canonical
desktop/runtime entry point. Optional machine settings and skills are private
resources, not distributed requirements.

## Expo agent CLI

Use the pinned `@expo/agent-cli` in [tools/expo-agent](tools/expo-agent/README.md)
for Expo diagnosis, SDK-compatible installs, package skills and development plans; its
README holds the install, setup and per-app commands (Lucid profile, Meditation root).
Start from the selected app root with `node tools/expo-agent/run.cjs status --json`,
then `node tools/expo-agent/run.cjs dev --ios --local --plan --json` (or `--android`).
Read `skills:list` and the relevant installed package's skill before package work, and
run `skills:sync --agent codex` after dependency changes. Use `expo-overview` when
available.

Setup always uses `--project --agent codex --no-plugins --no-agents-md`: no generated
AGENTS block, no `CLAUDE.md`, no global plugins. Translate CLI/skill suggestions to
this pinned runner; guarded profile launchers, type/lint scripts, TesterArmy, device
ownership/consent and `verify:pr`/`verify:release` keep their existing scope. A status
exit 0 or a CLI smoke is not functional/release proof. Inspect plans first; actual
runs require an owned isolated target and the correct Dreamer/Lucid/Meditation profile.

## Styling and Motion

Uniwind is canonical. Edit shared colours in `constants/noctaliaPalette.ts`, derive
journal/design themes from it, and regenerate tokens with `npm run uniwind:types`
after palette or `global.css` changes; do not hand-edit its generated colour block.
`champagne` is a fill, never text: use `text-champagne-on`. Migrate a component fully
or not at all; props such as gradient/icon colours stay on `useTheme()`. Use the
existing motion primitives in `components/motion/`; tabs never slide. The
[styling procedure](doc_web_interne/docs/repository-operations.md#styling-and-motion)
links the migration guide and token checks. Unchecked release-device motion remains
unqualified.

## Code and Test Conventions

Use strict TypeScript, 2-space indentation, typed focused functions, function components,
PascalCase components and `useX` hooks. Reuse components/themes/services/i18n, keep hook
dependencies correct and memoize for a clear/measured issue. Justified React Native
isolation tests use Jest with `@testing-library/react-native`, deterministic
`*.test.ts[x]` files, and awaited async interactions/promises in `act`; increased
timeouts do not repair races. Copy tests protect meaning such as optionality/saved
state. Add `testID` for stable targeting.

## Validation

Choose checks by changed behavior and risk, using
[proportional validation](doc_web_interne/docs/validation-proportionnee.md):

| Change | Required scope |
| --- | --- |
| Docs/copy without layout or behavior impact | Read diff, check affected links and `git diff --check`; no app suites/builds. |
| Small visual change | Focused lint and affected-screen inspection, including relevant contrast/text scaling. |
| Functional behavior | Affected real E2E journey and artifact, relevant lint/types and concrete regression checks. |
| Storage, accounts, sync, purchases, shared runtime/build configuration | Relevant failure/recovery journeys and isolated/native checks for the actual risk. |

Use isolation tests only for a named failure the journey cannot safely/reliably cover;
record that gap. Avoid implementation-shape tests, cosmetic copy assertions and duplicate
happy paths. Reproduce before fixing when practical; test/code chronology is not a gate.
Update obsolete expectations to intentional current behavior with a reason and meaningful
counterexample, preserving still-relevant coverage and honest historical results.

After passing checks, rerun only when changed inputs, failure, risk or an applicable
release check invalidates them. Documentation-only updates do not invalidate code proof.
A substantial change gets one independent final-diff review; corrections get focused delta
review unless scope/risk changes. Prefer existing runners over parallel wrappers/collectors.

## E2E framework preference (owner decisions, 2026-10-05 and 2026-10-06)

TesterArmy `e2e` is the default for new/affected journeys across all apps/worktrees:
`@e2e-dev/web` for browsers, `@e2e-dev/mobile` for native; API/CLI uses its real
interface. Maestro and the TI-429 harness (2026-10-14) and the Playwright test runners
(2026-10-21) are retired: do not revive them from historical documents. Playwright's
browser APIs and matchers remain available through the TesterArmy web engine.

- **Authoring.** Write new journeys with `npx e2e run --watch` from `tools/e2e`, at the
  version its lockfile pins. Watch reruns when a test file, a source file next to the
  tests, or the config is saved; it is an authoring loop, not part of `verify:pr` or
  CI. Read the installed skill/topic, reuse guarded runners/fixtures and keep provider
  budgets. Use one goal per `agent.act()` and exact assertions for critical outcomes;
  exact steps need no model.
- **PR gate.** `verify:pr` runs, locally and without GitHub Actions, the tagged smoke
  journeys on a Dreamer app diff and the named parcours for the zones that diff
  touches (`npm run test:e2e:smoke`, `npm run test:e2e:parcours`). No model is called
  unless `OPENAI_API_KEY` is set: the decision model then judges the parcours the zones
  leave out. A docs-only or native-only diff launches neither. If a zone is touched
  and the pinned Node, the e2e install or Chromium is missing, `verify:pr` stays
  incomplete ([details](doc_web_interne/docs/repository-operations.md#local-validation-and-ci)).
- **App release.** `npm run test:bugbash:prerelease` explores the mock app; each
  confirmed bug becomes a failing `bugbash` test, which `verify:release` runs and the
  PR gate does not.
- **Mobile Store submission.** Run `npm run release:simulators` on the Mac mini for the
  candidate commit, with `--suites all` when the build configuration or the server
  changed (owner decision 2026-10-30): the physical phone covers only the short list
  in [simulator tests](doc_web_interne/docs/tests-simulateurs.md).
- **Native qualification** identifies an installed Release, uses one worker per owned
  device and starts with `app.open()`; inspection alone proves no journey.
  [Native procedures](doc_web_interne/docs/repository-operations.md#native-journeys-and-inspection)
  cover locks, commands, inspection and release gates.
- **Upgrades.** A compatible pinned upgrade may be piloted and adopted within scope
  after relevant checks pass.

## Evidence and QA Continuity

Keep one canonical report/receipt: owner, scope/authorization, revision/build/install
source, relevant backend/OTA identity, environment/fixtures, assertions, result, useful
failure log/media, exact rerun command, limits and next action. Mark unknown identity fields.
Local checks, mock behavior, native/device QA, merge, deployment and Store state are distinct.
A screenshot alone does not prove unobserved behavior. Private artifacts stay outside Git;
tracked summaries are redacted. Reuse unchanged immutable outputs without duplicate full
copies or rehashes; recheck changed/transferred/suspect inputs and required release checks.
Follow [candidate continuity](doc_web_interne/docs/repository-operations.md#candidate-and-qa-continuity),
[EAS counter synchronization](doc_web_interne/docs/mobile-build-version-sync.md) and
[TalkBack's pilot/restoration protocol](doc_web_interne/docs/qualification-talkback.md).

Disk space is limited on the owner's Mac. Before producing large local artifacts,
check available space and the existing task output. Reuse verified unchanged image
archives rather than generating another ZIP partition of the same files; preserve
useful failure evidence and unique source originals. Before proposing removal of a
local archive claimed to be on Drive, verify its exact remote identity and size, and
compare checksums when available, without downloading another full copy. List the
exact cleanup candidates for approval; never automatically remove original assets or
the only retained evidence, and never empty Trash without authorization.

## Livraison

1. Avant chaque push, drafts inclus, lancer `npm run verify:pr` sur le commit à pousser ; échec ou preuve `incomplete` : ne pas pousser.
2. La PR indique le commit vérifié, le résultat et les limites. Traiter la revue dans ses commentaires ; chaque nouveau head envoyé est vérifié. Ouvrir les PR prêtes pour revue afin que les agents les prennent en charge ; réserver le draft à une demande explicite ou à une préparation encore non vérifiable. Les blocages de fusion restent explicites dans les contrôles et les remarques, sans attente générique de revue humaine.
3. Sur demande explicite de thanh, fusion possible quand les commentaires sont réglés et rien ne bloque ; aucune intervention du CTO imposée.
4. Rien ne part en production sans le go de thanh.

Le [guide de validation](doc_web_interne/docs/validation-proportionnee.md#prouver-avant-de-pousser)
détaille fetch, merge-base, worktree isolé, preuve, nouvelle tête et intégration de master.

## Notes dreamer

[Local validation and CI](doc_web_interne/docs/repository-operations.md#local-validation-and-ci)
explains conditional checks and the release targets. The pre-push hook only checks
forbidden files, secrets and file size and prints the proof; it does not replace
`verify:pr`. After a push from a machine where `gh` is authenticated,
`npm run verify:pr:status` posts the proof as the commit status `verify-local/pr`,
so the PR shows it without trusting its description. CircleCI is only an optional manual/API installation benchmark
(`run_e2e_benchmark=true`), with no application validation; webhooks run nothing. EAS
workflows use `workflow_dispatch` only. Local coverage remains mandatory; missing
specialized prerequisites need a valid owner-machine proof, never a skip or CI link.
See [the current CI guide](doc_web_interne/docs/circleci-migration.md).

## Publishing to production

Production is manual; a push/merge must not deploy. Publish only an authorized fetched
`origin/master` SHA from a clean checkout with passed `verify:release` proof for the app,
or `verify:release:site` for the site (each target needs its own run; both on one SHA
cover both). Only `web:deploy:prod` (Vercel) and `docs:deploy:prod` (Cloudflare) publish
production: never raw CLIs. Their guards run again before upload, with no override. Check
production health/touched routes and record SHA/deployment. Only thanh decides a rollback
of a previously guarded deployment, recording SHA/reason.

Procedures: [Vercel](doc_web_interne/docs/repository-operations.md#vercel-noctaliavercelapp-and-dreamnoctaliaapp)
(noctalia.vercel.app and dream.noctalia.app; pinned CLI, identity/environment
safeguards, cleanup and signal limits) and
[Cloudflare Pages](doc_web_interne/docs/repository-operations.md#cloudflare-pages-httpsnoctaliaapp)
(noctalia.app). Automatic production and preview Git deployments must be disabled in
the Pages dashboard; a tracked configuration file does not change that setting.

## Operating Principles

Be concise, candid and evidence-based; link authoritative current sources, including the
[official Expo, React Native and TesterArmy references](doc_web_interne/docs/repository-operations.md#official-references).
Keep work focused, finish the authorized outcome, report blockers and uncertainty, and
use a visualization only when it materially helps.
