# Repository Guide

Noctalia contains the Dreamer and Lucid Expo apps, a separate Meditation package,
a Supabase backend and a generated multilingual site. This is the shared guide for
all agents; read [Meditation's local guide](apps/meditation/AGENTS.md) for that app.
Specialized procedures live in linked guides, not provider-specific instruction copies.

## Shared instructions for every agent

Start with the [task index](doc_web_interne/docs/README.md), then the relevant code,
local instructions and installed skill/API topic. Find files with `rg --files`
before guessing paths. [package.json](package.json) owns commands;
`mise exec -- npm run scripts:list` and [scripts/README.md](scripts/README.md)
explain their prerequisites and effects. Use [repository operations](doc_web_interne/docs/repository-operations.md)
for runtime, validation, native QA and publication procedures.

## Instruction Priority and Progress

- Latest explicit user scope and current product contracts govern, subject to higher
  priority instructions and tool permissions. Historical choices, reports and tests
  are context, not permanent restrictions. Skills guide execution without adding authority.
- Reuse existing authorization and decisions. Complete authorized reversible local work
  autonomously; ask only for a material missing decision or an action outside scope.
  Finish concrete preparation first and continue independent work while blocked.
- Delegated choices allow reasonable agent selections; identify those honestly rather
  than claiming user review. Missing, blocked or stale evidence never counts as passed.

## Autonomy for Approved Work Packages

An implementation/fix request authorizes its scoped changes, validation and applicable
commit/PR/push steps; an audit/proposal request authorizes the proposal only. Explicit
local-only, no-push and review-before-merge boundaries prevail. A merge that deploys
production also needs publication intent. Use four proportionate stages: frame objective,
acceptance criteria and boundaries once; prepare; implement and validate; verify each
requested delivery result. Optional targets do not become blockers without a new risk
or explicit requirement. Native builds, full suites and review follow the affected risk.

Production deploys, Store submissions, EAS builds, destructive database actions,
new providers, extra spending and access changes require their own authorization.
Requested native work includes necessary local builds, isolated native generation and
compatible installation on an owned disposable QA target. It does not authorize
replacing a personal app, resetting unowned data or increasing a budget.

## Project Rules

- Start with `git status --short`; preserve unrelated WIP and personal app data. Use the
  existing checkout, isolating conflicts with a worktree. Reuse compatible dependencies
  and patterns; check compatibility before expensive builds and typecheck changed tests
  before a push. Regenerate a stale native project (for example after an Expo
  SDK upgrade) in the checkout that uses it, including the primary one.
- Preserve secrets and private formative feedback. Never commit `.env`,
  `CLAUDE.local.md`, `settings.local.json`, credentials or temporary logs. Every
  `EXPO_PUBLIC_*` value is client-visible. Do not send private project content to free
  third-party inference endpoints or unauthorized providers. Durable redacted evidence
  is allowed; [repository layout](doc_web_interne/docs/repository-layout.md) defines locations.
- On a personal or Play-installed base app (`com.tanuki75.noctalia`), identify install
  source/version/signature and preserve data; never uninstall or clear it to force an
  install. A destructive reinstall needs separate authorization and a preservation plan.
  Owned disposable QA uses its existing profile. Do not claim base/Play equivalence.
- Keep mandatory platform/security checks, hooks and local validation coverage intact.
  Never use `git push --no-verify` or change `core.hooksPath`. A delivery-control change
  needs separately justified scope. Distinguish patch bugs from baseline/environment,
  Watchman, device and network failures; fix genuine bugs rather than hiding failures.
- On macOS, start Expo/Metro through canonical scripts with required outside-sandbox
  approval for AppKit/React Native DevTools. Do not disable its standalone shell by
  patching Expo or React Native middleware.

## Structure and Sources of Truth

Use the [repository layout](doc_web_interne/docs/repository-layout.md) for app roots,
source assets, generated output, private QA and preserved history. Edit `docs-src/`
and canonical `data/` inputs, rebuild ignored `docs/`, and never commit generated site
output. Keep reusable procedures in current guides and dated results in their existing
evidence locations; age alone is not removal proof.

Project artifacts belong in the canonical ignored `outputs/` directory. Keep
native tooling outputs (for example `tools/e2e/.e2e/`) canonical for their runs;
reference them instead of copying complete media for handoffs.

## Subproject routing

- Dreamer uses `app/`. Lucid shares the root package and uses only `routes/lucid/`
  (`routes/lucid/lucid/`); Dreamer's ritual opens Lucid. Follow its
  [specification and sleep/wellbeing safeguards](specs/noctalia-lucid-trainer.md).
- Meditation lives in `apps/meditation/`, with its own package/lockfile and
  [local instructions](apps/meditation/AGENTS.md); run its commands there.
- Resolve the requested product, app-specific profile and owned data before device
  work. Do not reuse Dreamer's allowlist for the other apps. Missing device access
  does not block authorized local work. TI-429/Maestro is retired; current native
  procedures are in [repository operations](doc_web_interne/docs/repository-operations.md#native-journeys-and-inspection).

## Essential Commands

Install the versions in `mise.toml` with `mise install`, then use `mise exec --`
unless already activated. Run `npm ci` at root and separately in Meditation.
Use existing package scripts and [runtime prerequisites](doc_web_interne/docs/repository-operations.md#runtime-and-prerequisites);
`script/build_and_run.sh` is the canonical desktop/runtime entry point. Optional
machine settings and skills are private resources, not distributed requirements.
Backend requests use `lib/http.ts`; URL resolution lives in `lib/config.ts`.

## Expo agent CLI

Use the pinned `@expo/agent-cli` in [tools/expo-agent](tools/expo-agent/README.md)
for Expo diagnosis, SDK-compatible installs, package skills and development plans.
After `mise exec -- npm ci --prefix tools/expo-agent`, start from the selected app
root with `node tools/expo-agent/run.cjs status --json`, then
`node tools/expo-agent/run.cjs dev --ios --local --plan --json` (or `--android`).
Meditation uses `node ../../tools/expo-agent/run.cjs` from `apps/meditation`.
Read `skills:list` and the relevant installed package's skill before package work.
After dependency changes run `skills:sync --agent codex`; SDK 58 packages provide
only the skills they actually ship. Use `expo-overview` when available.

Run setup as documented with `--project --agent codex --no-plugins --no-agents-md`:
AGENTS stays the shared authority; do not generate CLAUDE.md or install global
plugins. Translate CLI/skill suggestions to this pinned runner. Existing guarded
profile launchers, type/lint scripts, TesterArmy, device ownership/consent and
`verify:pr`/`verify:release` remain mandatory for their existing scope. A status
exit 0 or a CLI smoke is not functional/release proof. Inspect plans first; actual
runs require an owned isolated target and the correct Dreamer/Lucid/Meditation
profile. EAS, deployments and Store submission keep their separate authorization.

## Styling and Motion

Uniwind is canonical. Edit shared colours in `constants/noctaliaPalette.ts`, derive
journal/design themes from it, and regenerate tokens with `npm run uniwind:types`
after palette or `global.css` changes; do not hand-edit its generated colour block.
`champagne` is a fill, never text: use `text-champagne-on`. Migrate a component fully;
props such as gradient/icon colours stay on `useTheme()`. Use existing motion primitives;
tabs never slide. [Styling procedure](doc_web_interne/docs/repository-operations.md#styling-and-motion)
links the migration and token checks. Unchecked release-device motion remains unqualified.

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
`@e2e-dev/web` for browsers, `@e2e-dev/mobile` for native; API/CLI uses its real interface.
New journeys are written with `npx e2e run --watch` from `tools/e2e` (e2e 0.22.0).
Watch reruns when a test file, a source file next to the tests, or the config is saved.
It is an authoring loop, not part of `verify:pr` or CI.
Read the installed skill/topic, reuse guarded runners/fixtures and keep provider budgets.
`verify:pr` runs the tagged smoke journeys on a Dreamer app diff and the named
parcours for the zones that diff touches (`npm run test:e2e:smoke`,
`npm run test:e2e:parcours`), locally, without GitHub Actions, and without a
model unless `OPENAI_API_KEY` is set: the decision model then judges the
parcours the zones leave out ([details](doc_web_interne/docs/repository-operations.md)).
A docs-only diff, or a diff with no web app zone, skips both. A native-only
diff skips the web gate. If a zone is touched and Node 24.22.1, the e2e
install, or Chromium is missing, the check is unavailable and `verify:pr`
stays incomplete. Before an app release,
`npm run test:bugbash:prerelease` explores the mock app; each confirmed bug
becomes a failing `bugbash` test, which `verify:release` runs and the PR gate
does not.
Before a mobile Store submission, run `npm run release:simulators` on the Mac mini for the
candidate commit, with `--suites all` when the build configuration or the server changed (owner
decision 2026-10-30): the physical phone covers only the short list in
[simulator tests](doc_web_interne/docs/tests-simulateurs.md).
Native qualification identifies an installed Release, uses one worker per owned device
and starts with `app.open()`. Use one goal per `agent.act()` and exact assertions for
critical outcomes; exact steps need no model. A compatible pinned upgrade may be piloted
and adopted within scope after relevant checks pass. Keep relevant Playwright/API coverage
until its replacement passes. [Tools and native procedures](doc_web_interne/docs/repository-operations.md#native-journeys-and-inspection)
cover locks, commands, inspection and release gates; inspection alone proves no journey.

## Delivery and QA Continuity

Keep one canonical report/receipt: owner, scope/authorization, revision/build/install
source, relevant backend/OTA identity, environment/fixtures, assertions, result, useful
failure log/media, exact rerun command, limits and next action. Mark unknown identity fields.
Local checks, mock behavior, native/device QA, merge, deployment and Store state are distinct.
A screenshot alone does not prove unobserved behavior. Private artifacts stay outside Git;
tracked summaries are redacted. Reuse unchanged immutable outputs without duplicate full
copies or rehashes; recheck changed/transferred/suspect inputs and required release checks.

Before device journeys check the approved existing account, preserved data, quota/entitlement,
payment mode and entry points. Do not create replacement accounts or reset data to bypass
an environment blocker. Record stage/error and changed conditions before retrying failed
builds/submissions/deployments; compare SQL, migration history and schema before drift repair.
Follow [candidate continuity](doc_web_interne/docs/repository-operations.md#candidate-and-qa-continuity),
[EAS counter synchronization](doc_web_interne/docs/mobile-build-version-sync.md) and
[TalkBack's pilot/restoration protocol](doc_web_interne/docs/qualification-talkback.md).

For shell-created task checkouts, use `npm run workspace` from the primary
repository under `~/Projects`; follow [local workspace maintenance](scripts/README.md#maintenance-rules)
for creation, reuse and release. Keep compact evidence in the canonical artifact directory.

Disk space is limited on the owner's Mac. Before producing large local artifacts,
check available space and the existing task output. Reuse verified unchanged image
archives rather than generating another ZIP partition of the same files. A handoff
keeps a compact receipt and references the canonical media; preserve useful failure
evidence and unique source originals. Before proposing removal of a local archive
claimed to be on Drive, verify its exact remote identity and size, and compare
checksums when available. Do not download another full copy just to check it.
List the exact cleanup candidates for approval; never automatically remove original
assets or the only retained evidence, and never empty Trash without authorization.

## Livraison

1. Avant chaque push, drafts inclus, lancer `npm run verify:pr` sur le commit à pousser ; échec ou preuve `incomplete` : ne pas pousser.
2. La PR indique le commit vérifié, le résultat et les limites. Traiter la revue dans ses commentaires ; chaque nouveau head envoyé est vérifié. Ouvrir les PR prêtes pour revue afin que les agents les prennent en charge ; réserver le draft à une demande explicite ou à une préparation encore non vérifiable. Les blocages de fusion restent explicites dans les contrôles et les remarques, sans attente générique de revue humaine.
3. Sur demande explicite de thanh, fusion possible quand les commentaires sont réglés et rien ne bloque ; aucune intervention du CTO imposée.
4. Rien ne part en production sans le go de thanh.

Le [guide de validation](doc_web_interne/docs/validation-proportionnee.md#prouver-avant-de-pousser)
détaille fetch, merge-base, worktree isolé, preuve, nouvelle tête et intégration de master.

## Notes dreamer

[Local validation and CI](doc_web_interne/docs/repository-operations.md#local-validation-and-ci)
explains conditional checks and the release targets. CircleCI is only an optional manual/API
installation benchmark (`run_e2e_benchmark=true`), with no application validation; webhooks
run nothing. EAS workflows use `workflow_dispatch` only. Local coverage remains mandatory;
missing specialized prerequisites need a valid owner-machine proof, never a skip or CI link.
See [the current CI guide](doc_web_interne/docs/circleci-migration.md).

## Publishing to production

Production is manual; a push/merge must not deploy. Publish only an authorized fetched
`origin/master` SHA from a clean checkout with passed `verify:release` proof, or
`verify:release:site` for the site alone. Only `web:deploy:prod` (Vercel) and
`docs:deploy:prod` (Cloudflare) publish production: never raw CLIs. Their guards run again
before upload, with no override; app publishing requires the app target. Check production
health/touched routes and record SHA/deployment. Only thanh decides a rollback of a
previously guarded deployment, recording SHA/reason.

### Vercel (noctalia.vercel.app and dream.noctalia.app)

Follow the [Vercel procedure](doc_web_interne/docs/repository-operations.md#vercel-noctaliavercelapp-and-dreamnoctaliaapp)
for the pinned CLI, identity/environment safeguards, cleanup and signal limitations.

### Cloudflare Pages (https://noctalia.app)

Follow the [Pages procedure](doc_web_interne/docs/repository-operations.md#cloudflare-pages-httpsnoctaliaapp).
Automatic production and preview Git deployments must be disabled in its dashboard;
a tracked configuration file does not change that dashboard setting.

## Code and Test Conventions

Use strict TypeScript, 2-space indentation, typed focused functions, function components,
PascalCase components and `useX` hooks. Reuse components/themes/services/i18n, keep hook
dependencies correct and memoize for a clear/measured issue. Justified React Native
isolation tests use `@testing-library/react-native`, deterministic `*.test.ts[x]` files,
and awaited async interactions/promises in `act`; increased timeouts do not repair races.
Copy tests protect meaning such as optionality/saved state. Add `testID` for stable targeting.

## Operating Principles

Be concise, candid and evidence-based; link authoritative current sources. Keep work focused,
finish the authorized outcome, report blockers and uncertainty, and use a visualization only
when it materially helps. Do not turn optional suggestions into delivery blockers.

## Official References

[Official Expo, React Native and TesterArmy references](doc_web_interne/docs/repository-operations.md#official-references).
