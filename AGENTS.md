# Repository Guide

Noctalia is an Expo/React Native dream-journal app with a Supabase backend and a generated multilingual marketing site.

Start with the [repository task index](doc_web_interne/docs/README.md) for feature
entry points and current guides. Run `mise exec -- npm run scripts:list` for the
command catalog; [scripts/README.md](scripts/README.md) explains prerequisites and effects.
Changes are proven locally under the [common delivery rule](#livraison--règle-commune-v2):
`npm run verify:pr` before merge, `npm run verify:release` before a publish, and the PR
records that proof; review happens in PR comments. Remote CI (`.circleci/config.yml`,
`.circleci/continue.yml`) runs only for a manual or API trigger (GitHub App
`pipeline.event.name=api`, legacy OAuth `pipeline.trigger.type=api`) or when
`force_full_validation` is true. Webhook pushes run nothing. Find filenames with
`rg --files` before reading guessed paths; scoped search examples are in the task index.

## Structure and Sources of Truth

- `app/`: Expo Router screens and layouts.
- `components/`, `hooks/`, `context/`: reusable UI and state logic.
- `lib/`, `services/`, `constants/`: shared utilities, integrations, and configuration.
- `supabase/functions/`, `supabase/migrations/`: Edge Functions and database changes.
- `docs-src/`: editable marketing-site source. Follow `docs-src/README.md`.
- `docs/`: ignored generated output; never edit or commit it. Rebuild it from `docs-src/`.
- `data/`, `scripts/`, `maestro/`: generator inputs, tooling, and Android E2E flows.
- `tests/` and colocated `__tests__/`: route, integration, unit, and performance tests.
- `doc_web_interne/docs/`: internal runbooks, QA evidence, and plans.

Production for the Vercel app and for https://noctalia.app is manual. A push to `master` is not a publish. See [Publishing to production](#publishing-to-production).

## Subproject routing

- Lucid uses the root package, not `apps/lucid/`. Its screens live only under its
  own Expo Router root, `routes/lucid/` (`routes/lucid/lucid/`); Dreamer's `app/`
  no longer contains them, and its lucid ritual opens the Lucid app. Read
  `specs/noctalia-lucid-trainer.md` for its scope and sleep/wellbeing safeguards.
- Meditation is a separate package at `apps/meditation/`; read its local guide
  and run its commands there. Its theme and service paths replace journal-specific paths.
- Device scope follows the current requested product and work package. The TI-429
  VNext base-package decision applies to that historical harness, not all future QA.
  Resolve an app-specific profile and owned data before device work; do not reuse
  Dreamer's allowlist for Lucid or Meditation. Missing access does not block local work.
- Do not send private project content to free third-party inference endpoints.
  Use an authorized supported model.

For requested Higgsfield media, check the host's installed skills and media workflow
policy first. These ignored machine resources may be supplied under
`.agents/skills/WORKFLOW-POLICY.md` and
`.agents/skills/higgsfield-video-explainer/SKILL.md`; they are not shipped by this
checkout. Follow the installed policy, or continue local preparation and report the
missing resource before submitting media. The video-explainer skill requires the
live catalog for preset discovery or validation; custom-style preparation does not
depend on it. Verify the selected model's live contract before submission.

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
  `SPRING`). Run the `animate-expo` skill before writing any animation and apply its frequency
  gate — most things should not animate. Tabs never slide.
- Missing release-device evidence does not block authorized local motion work. Report
  motion quality as unqualified until the relevant release-device checks are complete.
- After editing `global.css`, run `npm run uniwind:types`.

## Operating Principles

1. Use the Visualize skill only when a visual materially improves the explanation; concise prose or a Markdown table is sufficient otherwise
2. Be concise, direct, and candid. Challenge weak assumptions and distinguish verified facts from uncertainty
3. Ground research in authoritative, current sources and link important evidence
4. Preserve the original goal and constraints; finish authorized work end to end and verify the actual result before claiming completion
5. Ask questions only when a decision is materially ambiguous, risky, or requires approval
6. Use relevant skills
7. Keep changes focused and simple. Avoid unrelated edits, unnecessary abstractions, and low-signal tests
8. Test observable behavior, review substantial changes, and validate user-facing work in the real interface when applicable
9. Preserve unrelated work and never take destructive, production, or external actions beyond what the user authorized
10. Report meaningful blockers, outcomes, and evidence without noisy progress

## Instruction Priority and Progress

- Follow the user's latest explicit task instructions over conflicting defaults in this
  guide, project configuration, skills, and their references, subject to system/developer
  instructions and actual tool permissions. Skills guide execution; they do not add authority.
- Reuse authorization and decisions already supplied in the conversation. Do not ask again
  solely because a skill prescribes a confirmation, selection, questionnaire, or separate turn.
- When the user delegates choices or requests no-question execution, make reasonable decisions
  within that scope and continue. Identify agent-selected drafts honestly; never claim the
  user reviewed or approved an asset when they only delegated its selection.
- Complete independent authorized work when a capability or decision blocks one step. Report
  the exact remaining blocker without treating missing evidence as a passed check.
- Finish preparation and reversible checks before requesting any still-missing authorization
  for a concrete external action. Existing release, secret, WIP and device safeguards apply.

## Autonomy for Approved Work Packages

A direct request to implement or fix something authorizes work within that scope.
A request to prepare or audit a proposal authorizes the proposal only. An explicit
instruction to implement an identified proposal authorizes its implementation and
applicable delivery steps: scoped fixes, appropriate validation, correction of related
failures, commits, PR creation and push, then `npm run verify:pr` on the final PR head;
the merge follows the [delivery rule](#livraison--règle-commune-v2). Reuse that
authorization. Explicit local-only, no-push, review-before-merge, and publication
boundaries take precedence; a production-triggering merge requires publication intent.

Keep execution to four gates, with detail proportional to the work:

1. Frame the objective, blocking acceptance criteria, and authorization boundaries once.
   Distinguish required thresholds from working performance targets and optional improvements;
   do not turn the latter into closure blockers without an explicit requirement or new risk.
2. Prepare the repository, environment, and validation method needed for that objective.
3. Implement and validate according to the risk table below, reusing still-valid evidence.
   Independent review, native builds, and full suites depend on risk and applicable release
   requirements; they are not mandatory for every change.
4. Deliver within the approved scope, run `npm run verify:pr` on the final PR head before
   merge, and verify the actual result at each requested delivery stage. Local checks, merge,
   deployment, device installation, and public availability remain distinct evidence.

Ask only for a material unresolved product decision or an action outside the approved scope,
including an unauthorized expense, destructive operation, or publication. Production deploys,
store submissions and EAS builds must be explicitly included in the authorization;
a merge that triggers production deployment also requires publication intent. Requested
native implementation or QA includes the necessary local build, isolated native generation
and compatible installation on its owned disposable QA target. It does not authorize
overwriting a personal app, resetting unowned data, adding a provider or raising a budget.
Continue independent authorized work while a decision is pending. These rules do not override
tool approvals, data preservation, device safeguards, or higher-priority instructions.

Avoid preventable rework: verify dependency compatibility before expensive builds, typecheck
new or changed tests before the first push, and pilot a measurement method on one sample before
scaling it. For device checks, identify the installed binary and supported entry points;
do not assume an older Play build accepts current deep links. On a personal or shared app,
preserve data and check signature compatibility; a destructive reinstall requires its own
authorization and a concrete preservation plan. Disposable QA app state uses its existing
profile, without a redundant personal-data backup workflow. Batch independent
checks and small corrections, and keep one concise evidence record for the work package.

## Delivery and QA Continuity

1. Identify each mobile release candidate in the existing evidence record: source SHA,
   platform, binary version/build and install source, OTA update/runtime/channel if applicable,
   and relevant backend revision or migration state. Mark unknown fields explicitly. Decide
   whether delivery needs a native build, OTA, or backend deployment; only qualify changes
   actually present in the tested environment.
   For Noctalia build counters, use `npm run release:versions:sync` and verify with
   `npm run release:versions:check`; see [version synchronization](doc_web_interne/docs/mobile-build-version-sync.md).
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

Sprint deliverables and success criteria: [four process improvements](doc_web_interne/docs/process-sprint-2026-09-28.md).

## Project Rules

- For the Dreamer VNext goal, Motorola validations run only against the base app
  `com.tanuki75.noctalia` / scheme `noctalia`, never a `.qa` app; distinguish local-build vs Play
  install source and verify signature/version before any install; never uninstall or clear app
  data to force an install. An older goal text mentioning a QA device does not override this
  user decision.
  This restriction belongs to TI-429's base-app measurement scope. Other requested native
  QA may use a separate owned app/profile through its canonical runner when data ownership
  and signing are established; it must not claim base/Play equivalence or bypass TI-429 guards.
- Start with `git status --short`; preserve all unrelated and pre-existing changes.
- Read applicable local instructions and the implementation or tests needed to understand
  the requested change. Consult specialized references when the affected behavior requires
  them. Reuse established patterns and dependencies.
- Treat `package.json` as the command source of truth; do not invent parallel wrappers.
- Requested native implementation or QA authorizes a necessary local `expo prebuild`
  in its isolated worktree, including generation required by `expo run:android`/`run:ios`.
  Check SDK compatibility and the app-specific profile first, reuse compatible existing
  projects, prefer explicit `--no-install` generation, and record resulting native inputs.
  Do not regenerate the primary checkout or another task's project. No separate confirmation
  is needed for this same local scope; unrelated platforms, personal data, EAS/Store and
  publication retain their boundaries. `script/build_and_run.sh` start modes do not prebuild.
- Never run EAS builds, store submissions, production deploys, or destructive database
  commands without explicit authorization.
- Never commit secrets or temporary logs. Every `EXPO_PUBLIC_*` value is client-visible.
- Distinguish patch failures from baseline, environment, Watchman, emulator, and network failures.
- On macOS, start Expo or Metro through the canonical package script with required outside-sandbox approval so React Native DevTools can register with AppKit. Do not patch Expo or React Native middleware to disable the standalone DevTools shell.

## Essential Commands

`mise.toml` pins Node and Deno to the CI versions. Run `mise install`, then use
`mise exec -- <command>` unless your shell already activates the project tools.
Install root dependencies from the repository root. Meditation uses a separate
lockfile and additionally requires `mise exec -- npm ci` in `apps/meditation`.

- Install: `npm ci` (reproducible), `npm install` (update), `npx expo install <package>` (Expo-compatible package).
- Run: `npm run start`, `npm run web`, `npm run android`, `npm run ios`.
- Runtime modes: `npm run start:mock`, `npm run start:real`, `npm run start:teststore`, `npm run start:playstore`, `npm run start:supabase`.
- Expo Go: run `NOCTALIA_DISABLE_RC_WEB_STUB=1 npm run start -- --go` so Metro bundles RevenueCat's real web SDK (Expo Go runs
  react-native-purchases in browser mode). Local Expo Go only; EAS builds ignore it (`EAS_BUILD`). No npm script: `package.json` scripts feed the runtime fingerprint.
- Diagnose: `npx expo-doctor`.
- Mobile release: follow [MOBILE_VERSIONING.md](doc_web_interne/docs/MOBILE_VERSIONING.md); use `release:build` for its local checks and pinned EAS CLI.
- Local Android Release: Java 17 and Android SDK are required. The runner checks Java before build preparation; see [tooling prerequisites](scripts/README.md#local-android-prerequisites).

Backend URL resolution uses `EXPO_PUBLIC_API_URL`, then `app.json` `expo.extra.apiUrl`; see `lib/config.ts`. Use `lib/http.ts` for network requests and its timeout/auth conventions.

The canonical desktop/runtime entry point is `script/build_and_run.sh`, which keeps
Metro in the foreground. An optional local `.codex/environments/environment.toml`
can delegate desktop Run actions to it; this checkout does not ship that file.
Use the package scripts when it is absent. See `./script/build_and_run.sh --help`
for supported modes.

## Livraison : règle commune v2

> Push rapide ; contrôles locaux proportionnés avant fusion ; publication vérifiée pour la cible livrée ; CI distante à la demande et sans attente obligatoire.

Règle canonique, identique pour shapier, skillcodex, clawdeals, bodylab et dreamer :
[Règle commune de livraison, v2](https://github.com/thannous/shapier/blob/main/docs/regle-commune-livraison.md).
Le moteur `scripts/verify-local.mjs` (et ses tests `scripts/test-verify-local.mjs`) est identique
dans les cinq dépôts : ne jamais le modifier ici seul. Les contrôles de ce dépôt sont dans
`verify-local.config.mjs`.

| Moment | Commande | Effet |
| --- | --- | --- |
| Push | hook `.githooks/pre-push` (automatique) | quelques secondes : fichiers interdits, secrets, taille ; affiche la preuve de l'arbre poussé (absente : non bloquant) |
| Avant fusion | `npm run verify:pr` | contrôles de la PR sur une copie isolée du commit (le travail en cours n'est ni vérifié ni touché) ; preuve liée à l'arbre, contrôles déjà réussis sur les mêmes entrées réutilisés |
| Description de PR | `node scripts/verify-local.mjs proof-block` | imprime la section `## Local proof` à coller |
| Avant publication | `npm run verify:release` | sur le commit `master` livré : contrôles de la PR réutilisés, validation complète locale (portefeuille complet de `.circleci/continue.yml`), site et app web reconstruits pour ce commit |

- Push libre et brouillons permis ; ne jamais contourner ni désactiver le hook (`--no-verify`, `core.hooksPath`).
- Fusion : PR hors brouillon ; le `Commit SHA` de `## Local proof` est la tête de la PR ; aucun fil ouvert ; pas de conflit ; relecture du CTO sans point bloquant. Le CTO fusionne en squash ; un relecteur ne pousse jamais sur la branche de l'auteur. Une PR qui modifie `verify-local.config.mjs`, le moteur ou `.githooks/` demande en plus la relecture du propriétaire ; `## Local proof` le signale (« Delivery checks changed »).
- `--external` ne vaut que pour un contrôle spécialisé que la machine ne peut pas lancer, avec une preuve qui cite le SHA vérifié ou son arbre ; le moteur refuse sinon.
- Base avancée : fusionner la base dans la branche, relancer `verify:pr` (seuls les contrôles dont les entrées ont changé tournent), mettre `## Local proof` à jour.
- Publication : `verify:release` sur le commit livré de `master` (un squash d'une branche à jour réutilise les contrôles identiques ; le build et l'identité sont refaits), puis vérifier la production et noter le SHA.
- Contrôles spécialisés : Edge Functions sous Deno (`edge-functions`, quand `supabase/functions`, `supabase/lib`, `supabase/migrations` ou `deno.lock` changent ; toujours en publication) ; base et navigateur (`e2e-backend` : Supabase local sous Docker et Chromium, en publication) ; navigateur (`testerarmy-*` : campagnes TesterArmy site, Dreamer en quatre passes, Lucid et Meditation, en publication). Meditation (`meditation`, quand `apps/meditation` ou ses fichiers partagés changent) demande `npm ci` dans `apps/meditation` du checkout principal. Quand la machine ne peut pas les lancer (pas de Deno, de Docker ou de TesterArmy), la preuve vient d'un pipeline CircleCI manuel (`force_full_validation: true`) ou de la machine du propriétaire : `--external <contrôle>="<preuve> sur <SHA>"`. Les vérifications sur appareil et les builds EAS restent hors de ces commandes (voir Delivery and QA Continuity).
- CI distante : à la demande seulement ; elle ne conditionne ni la fusion ni la publication. Aucun aperçu automatique.

## Validation

- Prefer real E2E journeys for functional outcomes, with exact assertions and a repeatable
  artifact. Use a focused isolation control when it detects a concrete failure that the
  journey cannot safely or reliably exercise; avoid tests mirroring implementation details.
- State that failure and the E2E gap before expanding isolated coverage. Reproduce before
  fixing when practical; test-writing chronology is not a separate permission or closure gate.

For an isolation-test exception, record the failure modes and the gap in existing E2E
coverage in the work package. Keep
only tests that detect a concrete failure the E2E assertions would miss. Avoid
implementation-shape checks, cosmetic copy assertions, and duplicate happy paths.

An E2E artifact must identify the tested revision/build, environment, fixtures or
preconditions, exact rerun command, assertions and pass/fail result, with a trace,
recording, screenshots or machine-readable report as appropriate. A screenshot alone
is not proof of unobserved behavior. Redact secrets and private user content.

Choose validation by the behavior and risk changed, not by the number of files or a fixed checklist.

| Change | Default validation |
| --- | --- |
| Documentation or copy with no layout/behavior impact | Read the diff, check affected links and `git diff --check`; no app tests/builds. |
| Small visual adjustment | Focused lint and inspection of the affected screen, including relevant contrast/text scaling; no full suite by default. |
| Functional behavior | The affected E2E journey with a repeatable evidence artifact, plus relevant lint/types. Use existing isolation tests only for documented gaps. |
| Storage, accounts, sync, payments, shared runtime or build configuration | E2E failure/recovery journeys with evidence artifacts; isolation tests for documented gaps and native checks where the risk requires them. |

- Pick one appropriate focused test entry point; the commands below are alternatives, not a sequence to run in full.
- Apply the E2E-first policy above when adding coverage; isolation controls require a concrete failure model, not a mandatory implementation order.
- Once checks pass, rerun only when changed code, dependencies/configuration, a failure or an unresolved risk invalidates that evidence. A documentation-only follow-up does not invalidate code tests.
- Push freely, drafts included: the pre-push hook takes a few seconds and runs no suite. The checks run once, before merge, with `npm run verify:pr` (see [Livraison](#livraison--règle-commune-v2)). Agents never use `git push --no-verify` nor change `core.hooksPath`: fix a blocked push or report it as a blocker.
- `npm run verify:pr` checks the committed head in an isolated copy (`git worktree`, `node_modules` linked from the main checkout), so uncommitted work is neither checked nor disturbed. It runs `typecheck:app`, `typecheck:tests`, `lint`, `lint:scripts`, the root Jest tests related to the diff (`test:changed`), the static database contracts and the engine tests. It adds `docs:build` and `docs:check` when site inputs changed (`docs-src/`, `data/`, `scripts/`, package files), the CI contract tests when `.circleci/` changed, Meditation (`apps/meditation`, shared release files) and the Edge Functions under Deno (`supabase/functions`, `supabase/lib`, `supabase/migrations`, `deno.lock`) when theirs changed. A check that already passed on the same inputs is reused (typecheck and lint ignore Markdown and `doc_web_interne/`, `marketing/`, `specs/`). Native device checks and store builds stay outside it.
- It compares against the local `origin/master`: fetch it first. `test:changed` uses the same merge-base; `JEST_CHANGED_SINCE=HEAD` is only an explicit working-tree delta, never proof of a committed PR.
- Paste `node scripts/verify-local.mjs proof-block` into the PR template's **Local proof**, then say what remains unchecked (native, device). Review happens in PR comments; answer them with new commits, then rerun `npm run verify:pr` on the new head before merge.
- If `origin/master` moved since the proof, merge it into the branch, rerun `npm run verify:pr` (only the checks whose inputs changed run again) and update the Local proof. Batch a coherent work package before pushing; coordinate ownership of a branch receiving concurrent edits.
- Remote CI runs when `pipeline.event.name` is `api` (GitHub App), when `pipeline.trigger.type` is `api` (legacy GitHub OAuth manual or API trigger), or when `force_full_validation` is true. Automatic webhook pushes run nothing, and neither a merge nor a publish waits for it. Release branches, tags and a validated mobile release commit, which used to get CircleCI's full portfolio, now require `npm run verify:release` on the exact SHA (or a manual CircleCI pipeline with `force_full_validation: true`, cited with `--external`); see [the CircleCI guide](doc_web_interne/docs/circleci-migration.md).
- Keep the hook, `verify-local.config.mjs`, the classifier and the CircleCI jobs intact. Do not bypass or weaken them, or alter CI filtering, as part of a feature without a separate justified scope. `scripts/verify-local.mjs` and its tests are shared by five repositories: never change them here alone.
- Minor follow-up fixes need a focused delta review when relevant, not a new full review/test cycle. Reuse evidence for unchanged code and identify the revision it covers.
- Missing native evidence stays unqualified; do not replace it with repeated unit tests or claim a mock proves persistence or production behavior.
- For TalkBack qualification, follow [the short Motorola protocol](doc_web_interne/docs/qualification-talkback.md): validate focus/gesture/audio measurement with a short pilot before a full journey, distinguish keyboard/ADB evidence from physical gestures, and restore/re-read device settings even after failure. For a requested fix, continue from the reproduced defect to correction and the authorized retest.

See [the proportional validation guide](doc_web_interne/docs/validation-proportionnee.md) for examples. Available commands, selected according to the risk above:

- Tests: `npm run test:related -- <files>`, `npm run test:file -- <test-files>`, `npm run test:changed`, or `npm test` when broader coverage is justified.
- Types and lint: `npm run typecheck:app`, `npm run typecheck:tests`, `npx expo lint <touched-paths>`, `npm run lint`.
- Jest projects: `npm run test:node`, `npm run test:expo`; performance: `npm run test:perf`. If Watchman is blocked, rerun focused Jest checks with `--watchman=false`.
- Site: edit sources only, then run `npm run docs:build` and `npm run docs:check`; reserve `npm run docs:release-check` for release-ready work. `docs:build` includes the `docs-src/experience/` bundle. Use `npm run docs:dev` for live editing.
- Backend: `npm run db:contract:check` or `npm run db:contract:check:local`.
- Android: `npm run android:gates`, `npm run security:audit:mobile`, and the smallest applicable `test:e2e:*` script; `test:e2e:android:all` is not the default.

Commit source inputs and tracked manifests, never generated `docs/`. Deployment commands always require explicit publication intent.

## Publishing to production

Production publishes are manual. They happen only when the founder or the CTO decides to publish. A Git push or merge to `master` must not deploy production by itself.

Publish one `master` SHA. From a clean checkout where `HEAD` is the fetched `origin/master`, run `npm run verify:release` and publish only when it ends `passed`. It reuses every check the PR proof passed on identical inputs (a squash of an up-to-date branch has the same tree), rebuilds the site (`docs:build`, `docs:check`) and the web app (`build:web`) for this commit, and runs the full local validation; `node scripts/verify-local.mjs status` shows the proof of `HEAD`. A check this machine cannot run (Deno, Docker, TesterArmy) leaves the proof `incomplete`: run it in a manual CircleCI pipeline with `force_full_validation: true` and rerun with `--external <check>="<pipeline> on <SHA>"`. `npm run docs:deploy:prod` then runs `docs:release-check` before the upload. After the publish, check production (health, touched pages) and record the SHA and the deployment.

### Vercel (noctalia.vercel.app and dream.noctalia.app)

Project `thanhs-projects-9baa3976/noctalia`. `vercel.json` sets `git.deploymentEnabled` to `false`, so no branch, including `master`, creates a Git deployment. Preview deployments from Git stop as well. `ignoreCommand` does not start a deployment. It only skips or continues a build that Vercel has already started, and Git pushes no longer start one. No GitHub Action and no CircleCI job runs the Vercel CLI. CircleCI does not run on webhook pushes, and its jobs do not publish.

From a clean checkout of the approved SHA (`git rev-parse HEAD` equals that SHA), with `VERCEL_TOKEN` set. Do not commit the token.

```sh
vercel link --yes --scope thanhs-projects-9baa3976 --project noctalia
vercel deploy --prod --yes --token "$VERCEL_TOKEN" --scope thanhs-projects-9baa3976
```

To promote an existing deployment instead of building again:

```sh
vercel promote <deployment-url-or-id> --token "$VERCEL_TOKEN" --scope thanhs-projects-9baa3976
```

### Cloudflare Pages (https://noctalia.app)

Project `noctalia`. There is no `wrangler.toml` and no `pages_build_output_dir`. CircleCI and GitHub Actions do not run `wrangler pages deploy`. `docs-src/config/cloudflare-pages.json` records the build settings. A Git push does not apply that file. Production auto-deploy is the Cloudflare Pages Git integration, which is a dashboard setting. Turn it off before treating `master` as publish-on-decision:

1. Open Workers & Pages and select the Pages project `noctalia`.
2. Open Build, then edit Branch control, and turn off Enable automatic production branch deployments. The same control is labeled Settings, Builds and deployments, production branch, in older dashboard copy.
3. Set Preview branch to None as well: under the delivery rule, previews are on demand only (`npm run docs:deploy:preview`), never one per pushed branch. Preview deployments do not update `noctalia.app`.

Until step 2 is saved, a push to `master` still publishes the site.

After that, from a clean checkout of the approved SHA, set `CLOUDFLARE_API_TOKEN` (Pages edit) and `CLOUDFLARE_ACCOUNT_ID`. Do not commit either value.

```sh
npm run docs:deploy:prod
```

That runs `docs:release-check`, stages allowlisted runtime files, and uploads them with Wrangler. The command it runs is `npx wrangler pages deploy <staging> --project-name noctalia --branch master --commit-hash <HEAD>`. `--branch master` is the production branch, so the upload updates `noctalia.app`. Flags are the ones documented for `wrangler pages deploy`: `--project-name`, `--branch`, `--commit-hash`.

The direct upload of the generated output, without the allowlist, is:

```sh
npx wrangler pages deploy docs --project-name noctalia --branch master --commit-hash <sha>
```

Prefer `npm run docs:deploy:prod`. It refuses internal files that a raw `docs/` upload would include. Cloudflare documents that a Git-connected Pages project can take these Wrangler uploads after automatic deployments are disabled. The project stays Git-connected. It does not become a Direct Upload-only project.

## Code and Test Conventions

- Use strict TypeScript, 2-space indentation, focused typed functions, function components, PascalCase components, and `useX` hooks.
- Reuse components, theme constants, service boundaries, and i18n patterns. Keep hook dependencies correct; memoize only for a clear or measured rerender issue.
- For justified React Native isolation tests, use `@testing-library/react-native`. Name tests `*.test.ts` or `*.test.tsx`, colocated or under `__tests__/`; keep them deterministic and behavior-focused.
- In React tests, await asynchronous interactions inside `act` (or the library's async event helpers) and resolve test-controlled promises inside awaited `act` before asserting committed UI state. Do not repair timing races by inflating timeouts. Copy-contract tests should preserve meaning such as optionality and saved state rather than require obsolete cosmetic wording.
- Add `testID` only for stable automation or UI targeting. Validate affected mobile surfaces and capture screenshots or recordings when useful.

## Official References

- Expo: https://docs.expo.dev/llms-full.txt
- React Native: https://reactnative.dev/docs/getting-started

## E2E framework preference (owner decisions, 2026-10-05 and 2026-10-06)

Use TesterArmy `e2e` for new and affected E2E journeys across every project,
subproject and worktree. Reference: https://docs.expo.dev/guides/using-e2e/.
Read the official `e2e` skill and the relevant topic from the project's installed
version before writing or running tests. Use `@e2e-dev/mobile` for native apps and
`@e2e-dev/web` for browser apps. API/CLI-only projects need an appropriate real
interface journey; do not invent a mobile or browser target when none exists.
Reuse project runners, device ownership checks, fixtures and environment guards.
Native qualification uses an identified installed Release build, one worker per
device, and `app.open()` at each test start. Follow existing build/prebuild rules.
Use one goal per `agent.act()` and exact assertions for critical outcomes; exact
steps need no model. Preserve reports, failures, screenshots/traces, build/source
identity and the exact rerun command. A stale/missing replay is not a passed check.
TesterArmy remains the default. Existing coverage protects current functional contracts;
historical counterexamples inform work but do not freeze obsolete UI or block adoption
automatically. Preserve the old result and explain any revised expectation or retired
criterion against the current product contract. Keep the existing CI jobs and local checks
until an explicit reviewed pipeline change; retain still-relevant Playwright/Maestro/API assertions until their
replacement passes. A compatible framework upgrade within the requested work may be
piloted on a representative journey, pinned and adopted after its checks pass without
another generic permission request. Keep model
calls within existing authorized providers and budgets, and never export private
test content, credentials or feedback without authorization.

Read `tools/e2e/README.md`. `npm run test:testerarmy` runs Dreamer web;
`test:testerarmy:lucid`, `test:testerarmy:meditation`, and `test:testerarmy:site`
select the other web products. For a native installed Release build use
`E2E_DEVICE=<emulator-serial> npm run test:testerarmy:mobile -- <product> android`
or an explicitly named iOS Simulator with `<product> ios`. Product is dreamer,
lucid or meditation. Run setup/browser installation once through package scripts.
Existing `test:e2e:*` scripts remain compatibility/coverage gates.


For native inspection/exploration, use the official `agent-device` skill with
`npm run agent-device:inspect -- <product> <android|ios>` or
`npm run agent-device:mcp -- <product> <android|ios>`, and explicit `E2E_DEVICE`.
Read `tools/e2e/README.md`. These reuse the test runner's installed-build checks
and exclusive device lock; direct CLI/MCP must not bypass ownership. Inspection
captures UI evidence without resets and does not qualify a user journey. New
regression tests remain TesterArmy tests; do not introduce a separate `.ad` gate.
