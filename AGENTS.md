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
  allowlist for Lucid or Meditation; resolve an app-specific profile and the shared
  lock's current owner/protocol before device work. Missing device access does not block local work.
- Do not send private project content to free third-party inference endpoints.
  Use an authorized supported model; role preferences do not override this boundary.

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
6. Use relevant skills; spawn subagents only for genuinely independent work and synthesize their findings
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

## Agent Coordination

- Use the native delegation tools and the role rules below; no orchestration plugin is required.
- Grok/Astra/Muse remain preferred roles. Check the actual dispatch
  tool for model/effort support. If a preference is unavailable, the parent may execute the
  authorized work or select a capable supported agent without another approval request;
  disclose the fallback and preserve role permissions and review independence. This project
  policy overrides a skill's blanket ban on substitution. If the user explicitly requires an
  exact model for the current task, block only that assignment. Never create separate app
  tasks without an explicit user request or bypass tool restrictions with inference CLIs/APIs.
- Use bounded ownership, final-tree verification evidence and fresh independent review
  for substantial implementation. The parent retains architecture and acceptance;
  product corrections may be handled by the parent or an assigned implementer. Device work
  remains with an independent QA owner under the shared device rules.
- Review acceptance does not authorize delivery, EAS/store/production
  or database actions. API cost estimates do not establish Codex quota savings.
- Cost receipts are optional: show them when requested or when observed usage and applicable
  prices make them useful. Missing telemetry never blocks work or requires a placeholder receipt.

## Multi-Agent Implementation

- The parent Codex agent is the orchestrator, reviewer, and architecture decision owner: it
  inventories WIP, decomposes work, defines exclusive file scopes and dependencies, decides
  architecture trade-offs/interfaces/state/navigation, reviews diffs and evidence, assigns
  conflict resolution and reviews the result, and decides acceptance. The parent may write
  product code, tests and documentation, integrate fixes and run local checks; it does not
  operate a device. Parent-authored substantial changes still require independent review.
- Delegate bounded independent work when it improves execution alongside useful parent work.
  Do not force delegation for routine or sequential tasks. Delivery agents may perform Git or Linear
  mutations only when the corresponding user authorization already exists and the parent has
  accepted the review; this composition does not authorize commit, push, deploy, publication, or
  destructive actions.
- The preferred model assignments are `grok-oauth/grok-4.6` for implementing the architecture the
  parent decided, complex logic, and researching/proposing options; Grok may not independently
  decide an architecture change. Use `gpt-6-astra` at `medium` reasoning for UI/UX design and
  implementation within assigned scopes. Use
  `opencode-free-responses/muse-spark-1.3-contributor-free` for translations/i18n, tests,
  documentation, and delivery, plus an independent QA agent (not the
  code author) for Motorola builds/tests. Preserve the existing Grok reasoning levels: `high` for
  bounded work and `xhigh` for cross-cutting state, navigation, architecture, concurrency, or
  other complex changes; never use a lower level for implementation work.
- Verify the actual model before dispatch. A configured model name does not prove availability.
  Apply the supported fallback policy above when a preferred assignment is unavailable. Do
  not restart an agent solely because it is slow; request a checkpoint and resume it when
  its approach remains sound. Preserve the user's selected parent model and effort.
- Dispatch Muse according to task complexity. For every code-implementation or research task,
  including tests it writes, use `xhigh`; for documentation, translations, and delivery, choose
  an effort suited to the task complexity from the levels actually supported. Verify support
  before dispatch, and do not interrupt or recreate in-progress Muse tasks solely to change effort.
- Keep worktrees persistent and file scopes exclusive. Never let implementation agents write the
  same file concurrently; sequence dependent work explicitly and preserve all unrelated or
  pre-existing changes.
- Only one agent may own the device at a time, protected by a shared lock across Dreamer, Lucid,
  and Meditation.
- For substantial implementation, use a fresh read-only reviewer distinct from the authors
  against the final change set and verification evidence. Grok is preferred, but a capable
  supported reviewer may clear this gate. If no independent reviewer is available, continue
  implementation and verification while reporting acceptance as pending; never self-certify
  an independent review or claim unavailable device validation passed.
- The preferred team composition is parent Codex; Grok Core; Astra UI/UX (`gpt-6-astra`, `medium`);
  Muse translations/i18n/tests/docs; Grok QA (a separate independent instance); and Muse Delivery
  (activated after gates). User validation has been obtained; do not treat this as a pending
  proposal or request validation again.
- For the Dreamer VNext goal, Motorola validations run only against the base app
  `com.tanuki75.noctalia` / scheme `noctalia`, never a `.qa` app; distinguish local-build vs Play
  install source and verify signature/version before any install; never uninstall or clear app
  data to force an install. An older goal text mentioning a QA device does not override this
  user decision.

## Project Rules

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

Start narrow and broaden according to risk:

- Tests: `npm run test:related -- <files>`, `npm run test:file -- <test-files>`, `npm run test:changed`, then `npm test` when justified.
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
