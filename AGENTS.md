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

## Operating Principles

1. When explaining something to the user, use the Visualize skill
2. Be concise, direct, and candid. Challenge weak assumptions and distinguish verified facts from uncertainty
3. Ground research in authoritative, current sources and link important evidence
4. Preserve the original goal and constraints; finish authorized work end to end and verify the actual result before claiming completion
5. Ask questions only when a decision is materially ambiguous, risky, or requires approval
6. Use relevant skills; spawn subagents only for genuinely independent work and synthesize their findings
7. Keep changes focused and simple. Avoid unrelated edits, unnecessary abstractions, and low-signal tests
8. Test observable behavior, review substantial changes, and validate user-facing work in the real interface when applicable
9. Preserve unrelated work and never take destructive, production, or external actions beyond what the user authorized
10. Report meaningful blockers, outcomes, and evidence without noisy progress

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
