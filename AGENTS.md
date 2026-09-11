# Repository Guide

Noctalia is an Expo/React Native dream-journal app with a Supabase backend and a generated multilingual marketing site.

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

Cloudflare Pages builds `docs/` from tracked sources on `master`; verify the branch and deployment intent before publishing.

## Subproject routing

- Lucid uses the root package and `app/lucid/`, not `apps/lucid/`. Read
  `specs/noctalia-lucid-trainer.md` for its scope and sleep/wellbeing safeguards.
- Meditation is a separate package at `apps/meditation/`; read its local guide
  and run its commands there. Its theme and service paths replace journal-specific paths.
- The Dreamer device scope targets Dreamer VNext only. Do not widen its package
  allowlist for Lucid or Meditation; resolve an app-specific profile before device work.
  Missing device access does not block local work.
- Do not send private project content to free third-party inference endpoints.
  Use an authorized supported model.

## Higgsfield video-explainer catalog scope

For this project, the live preset catalog is required to discover or validate a
Higgsfield video-explainer preset. When the brief supplies a custom style, continue
preparation without making the preset catalog a prerequisite. Before submitting
a generation, verify the selected model's live contract and required inputs.
Never invent a preset identifier. If a capability is unavailable, stop only the
step that depends on it and continue independent authorized preparation. This
project rule overrides an unconditional catalog requirement in the vendor skill;
it does not change publication, spending, or confidentiality requirements.

## Styling and Motion

- Styling is **Uniwind** (Tailwind v4 bindings for React Native). The canonical CSS tokens live in
  `global.css`; keep the TS mirrors below synchronized. `metro.config.js` wraps
  the config with `withUniwindConfig` as the
  outermost wrapper. See `specs/uniwind-migration-guide.md` and `specs/adr-001-nativewind-vs-uniwind.md`.
- Colour vocabulary: `ink` (grounds and surfaces), `ivory` (text), `champagne` (accent).
  **`champagne` is never a text colour** — accented copy uses `text-champagne-on`, which is
  WCAG AA on both grounds.
- `global.css` and `constants/journalTheme.ts` / `constants/noctaliaDesign.ts` are kept in
  step by hand: screens still on `StyleSheet` read the TS constants, migrated screens read the
  CSS variables. Change a colour in one, change it in the other.
- Uniwind and `StyleSheet` coexist; migration is incremental. Migrate a component fully or not
  at all — a component half in `className` is where contrast and spacing regressions hide.
- Colour values passed as *props* (LinearGradient `colors`, icon `color=`, chart colours) stay
  on `useTheme()`. That is expected, not debt.
- Motion primitives are in `components/motion/` (`PressableScale`, `Reveal`, `DURATION`, `EASE`,
  `SPRING`). Run the `animate-expo` skill before writing any animation and apply its frequency
  gate — most things should not animate. Tabs never slide.
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

When the user approves an implementation work package, proceed through the fixes needed
for its objective, appropriate validation, correction of related failures, commits, PR
creation, push, and merge after required CI passes. Do not request approval again for
these steps. Explicit local-only, no-push, review-before-merge, or other narrower limits
take precedence. Approval of a proposal or audit alone does not authorize implementation.

Keep execution to four gates, with detail proportional to the work:

1. Frame the objective, blocking acceptance criteria, and authorization boundaries once.
   Distinguish required thresholds from working performance targets and optional improvements;
   do not turn the latter into closure blockers without an explicit requirement or new risk.
2. Prepare the repository, environment, and validation method needed for that objective.
3. Implement and validate according to the risk table below, reusing still-valid evidence.
   Independent review, native builds, and full suites depend on risk and applicable release
   requirements; they are not mandatory for every change.
4. Deliver within the approved scope, verify required CI on the final PR head before merge,
   and verify the actual result at each requested delivery stage. Local checks, merge,
   deployment, device installation, and public availability remain distinct evidence.

Ask only for a material unresolved product decision or an action outside the approved scope,
including an unauthorized expense, destructive operation, or publication. Production deploys,
store submissions, EAS builds, and device reinstallations must be explicitly included in the
authorization; a merge that triggers production deployment also requires publication intent.
Continue independent authorized work while a decision is pending. These rules do not override
tool approvals, data preservation, device safeguards, or higher-priority instructions.

Avoid preventable rework: verify dependency compatibility before expensive builds, typecheck
new or changed tests before the first push, and pilot a measurement method on one sample before
scaling it. For device checks, verify the installed binary's version and supported entry points;
do not assume an older Play build accepts current deep links. Before an explicitly authorized
reinstallation, establish and verify the data backup and restoration method. Batch independent
checks and small corrections, and keep one concise evidence record for the work package.

## Project Rules

- For the Dreamer VNext goal, Motorola validations run only against the base app
  `com.tanuki75.noctalia` / scheme `noctalia`, never a `.qa` app; distinguish local-build vs Play
  install source and verify signature/version before any install; never uninstall or clear app
  data to force an install. An older goal text mentioning a QA device does not override this
  user decision.
- Start with `git status --short`; preserve all unrelated and pre-existing changes.
- Read the nearest implementation, tests, and local guide before editing. Reuse established patterns and dependencies.
- Treat `package.json` as the command source of truth; do not invent parallel wrappers.
- Never run `expo prebuild`, EAS builds, store submissions, production deploys, or destructive database commands without explicit authorization.
- Never commit secrets or temporary logs. Every `EXPO_PUBLIC_*` value is client-visible.
- Distinguish patch failures from baseline, environment, Watchman, emulator, and network failures.
- On macOS, start Expo or Metro through the canonical package script with required outside-sandbox approval so React Native DevTools can register with AppKit. Do not patch Expo or React Native middleware to disable the standalone DevTools shell.

## Essential Commands

- Install: `npm ci` (reproducible), `npm install` (update), `npx expo install <package>` (Expo-compatible package).
- Run: `npm run start`, `npm run web`, `npm run android`, `npm run ios`.
- Runtime modes: `npm run start:mock`, `npm run start:real`, `npm run start:teststore`, `npm run start:playstore`, `npm run start:supabase`.
- Diagnose: `npx expo-doctor`.

Backend URL resolution uses `EXPO_PUBLIC_API_URL`, then `app.json` `expo.extra.apiUrl`; see `lib/config.ts`. Use `lib/http.ts` for network requests and its timeout/auth conventions.

`.codex/environments/environment.toml` delegates the `Run`, `Run Android`, `Run Web`, and `Expo Doctor` actions to `script/build_and_run.sh`. It keeps Metro in the foreground; see `./script/build_and_run.sh --help` for other modes.

## Validation

Choose validation by the behavior and risk changed, not by the number of files or a fixed checklist.

| Change | Default validation |
| --- | --- |
| Documentation or copy with no layout/behavior impact | Read the diff, check affected links and `git diff --check`; no app tests/builds. |
| Small visual adjustment | Focused lint and inspection of the affected screen, including relevant contrast/text scaling; no full suite by default. |
| Functional behavior | Existing focused behavior tests, relevant lint/types, and the affected UI journey when applicable. |
| Storage, accounts, sync, payments, shared runtime or build configuration | Broader affected suites and failure cases; native checks where the risk requires them. |

- Pick one appropriate focused test entry point; the commands below are alternatives, not a sequence to run in full.
- Add tests only for meaningful behavior or regression risks not already covered. Do not add tests that merely mirror implementation or assert cosmetic wording.
- Once checks pass, rerun only when changed code, dependencies/configuration, a failure or an unresolved risk invalidates that evidence. A documentation-only follow-up does not invalidate code tests.
- Consolidate local corrections and evidence before pushing when practical. Do not push each small documentation correction separately merely to trigger another CI run.
- Keep required CI checks intact and verify them on the final PR head. Do not bypass checks or alter CI filtering as part of a feature without a separate justified scope.
- Minor follow-up fixes need a focused delta review when relevant, not a new full review/test cycle. Reuse evidence for unchanged code and identify the revision it covers.
- Missing native evidence stays unqualified; do not replace it with repeated unit tests or claim a mock proves persistence or production behavior.

See [the proportional validation guide](doc_web_interne/docs/validation-proportionnee.md) for examples. Available commands, selected according to the risk above:

- Tests: `npm run test:related -- <files>`, `npm run test:file -- <test-files>`, `npm run test:changed`, or `npm test` when broader coverage is justified.
- Types and lint: `npm run typecheck:app`, `npm run typecheck:tests`, `npx expo lint <touched-paths>`, `npm run lint`.
- Jest projects: `npm run test:node`, `npm run test:expo`; performance: `npm run test:perf`. If Watchman is blocked, rerun focused Jest checks with `--watchman=false`.
- Site: edit sources only, then run `npm run docs:build` and `npm run docs:check`; reserve `npm run docs:release-check` for release-ready work. `docs:build` includes the `docs-src/experience/` bundle. Use `npm run docs:dev` for live editing.
- Backend: `npm run db:contract:check` or `npm run db:contract:check:local`.
- Android: `npm run android:gates`, `npm run security:audit:mobile`, and the smallest applicable `test:e2e:*` script; `test:e2e:android:all` is not the default.

Commit source inputs and tracked manifests, never generated `docs/`. Deployment commands always require explicit publication intent.

## Code and Test Conventions

- Use strict TypeScript, 2-space indentation, focused typed functions, function components, PascalCase components, and `useX` hooks.
- Reuse components, theme constants, service boundaries, and i18n patterns. Keep hook dependencies correct; memoize only for a clear or measured rerender issue.
- Use `@testing-library/react-native`. Name tests `*.test.ts` or `*.test.tsx`, colocated or under `__tests__/`; keep them deterministic and behavior-focused.
- Add `testID` only for stable automation or UI targeting. Validate affected mobile surfaces and capture screenshots or recordings when useful.

## Official References

- Expo: https://docs.expo.dev/llms-full.txt
- React Native: https://reactnative.dev/docs/getting-started
