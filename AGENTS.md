# Repository Guide

## Project Scope and Sources of Truth

Noctalia is an Expo/React Native dream-journal app with a Supabase backend and a generated multilingual marketing site.

- `app/`: Expo Router screens and route layouts.
- `components/`, `hooks/`, `context/`: reusable UI, hooks, and providers.
- `lib/`, `services/`, `constants/`: shared utilities, integrations, and configuration.
- `supabase/functions/`, `supabase/migrations/`: Edge Functions and database changes.
- `docs-src/`: editable source for the static marketing site.
- `docs/`: ignored generated site output. Never edit or commit it; rebuild it from `docs-src/`.
- `data/`: shared app and site content used by generators.
- `scripts/`: build, validation, release, and maintenance tooling.
- `maestro/`: Android E2E flows.
- `tests/`, colocated `__tests__/`: route, integration, unit, and performance tests.
- `doc_web_interne/docs/`: internal runbooks, QA evidence, and planning documents.

For site work, follow `docs-src/README.md`. Cloudflare Pages builds `docs/` from tracked sources on `master`; verify the current branch and deployment intent before publishing.

## Working Rules for Agents

1. Start with `git status --short` and preserve all unrelated or pre-existing changes.
2. Read the nearest relevant implementation, tests, and local guide before changing code.
3. Prefer the smallest cohesive change that reuses existing patterns and dependencies.
4. Treat `package.json` as the command source of truth; do not invent parallel wrappers.
5. Do not run `expo prebuild`, EAS builds, store submissions, production deploys, or destructive database commands unless explicitly requested.
6. Do not commit secrets or temporary logs. Every `EXPO_PUBLIC_*` value is visible to clients.
7. Separate failures caused by the patch from known baseline, environment, Watchman, emulator, or network failures.
8. When Codex starts Expo or Metro on macOS, run the canonical package script with the required outside-sandbox approval so React Native DevTools can register with AppKit. Do not patch Expo or React Native middleware to disable the standalone DevTools shell.

## Install and Run

- Reproducible install: `npm ci`
- Update local dependencies: `npm install`
- Default development server: `npm run start`
- Runtime modes: `npm run start:mock`, `npm run start:real`, `npm run start:teststore`, `npm run start:playstore`
- Supabase-backed development: `npm run start:supabase`
- Native Android/iOS builds: `npm run android`, `npm run ios`
- Web development: `npm run web`
- Expo diagnostics: `npx expo-doctor`
- Install Expo-compatible packages: `npx expo install <package>`

Backend URL resolution uses `EXPO_PUBLIC_API_URL`, then `app.json` `expo.extra.apiUrl`; see `lib/config.ts`. Network requests should use `lib/http.ts` and its timeout/auth conventions.

## Codex App Run Actions

`.codex/environments/environment.toml` delegates to `script/build_and_run.sh`:

- `Run`: Expo dev server.
- `Run Android`: Expo dev server with Android opening.
- `Run Web`: Expo web development.
- `Expo Doctor`: Expo diagnostics.

The script keeps Metro in the foreground so the action terminal owns logs and interruption. Additional supported modes are documented by `./script/build_and_run.sh --help`.

## Validation

Use the narrowest relevant checks first, then broaden only when risk or the request justifies it.

### App and services

- Related tests: `npm run test:related -- <files>`
- Specific test files: `npm run test:file -- <test-files>`
- Changed-file tests: `npm run test:changed`
- App typecheck: `npm run typecheck:app`
- Test typecheck: `npm run typecheck:tests`
- Scoped lint: `npx expo lint <touched-paths>`
- Full lint: `npm run lint`
- Full Jest suite: `npm test`

Jest has separate Node and Expo projects (`npm run test:node`, `npm run test:expo`). Performance tests use Vitest (`npm run test:perf`). If Watchman is unavailable or sandboxed, rerun focused Jest checks with `--watchman=false`.

### Site and content

1. Edit `docs-src/` or generator inputs, never generated HTML in `docs/`.
2. Run `npm run docs:build`.
3. Run `npm run docs:check`.
4. Use `npm run docs:release-check` only for release-ready site work.

The landing experience layer (canvas sky, Lenis/GSAP, adaptive tiers) lives in
`docs-src/experience/` and is bundled by `npm run docs:build:experience`, which
`docs:build` runs automatically; see `docs-src/README.md`.

Commit the source inputs and any tracked manifest updates, not `docs/`. Use `npm run docs:dev` for live editing. Deployment commands require explicit publication intent.

### Backend and Android

- Database contract: `npm run db:contract:check` or `npm run db:contract:check:local`
- Android release readiness: `npm run android:gates`
- Android E2E: choose the smallest matching `test:e2e:*` script from `package.json`; `test:e2e:android:all` is not the default validation path.
- Mobile security audit: `npm run security:audit:mobile`

## Code and Test Conventions

- TypeScript strict mode, 2-space indentation, focused typed functions.
- Function components and hooks; components use PascalCase and hooks use the `useX` prefix.
- Reuse established components, theme constants, service boundaries, and i18n patterns before adding abstractions.
- Keep hook dependency arrays correct; memoize only when it solves a measured or clear rerender problem.
- Use `@testing-library/react-native` for UI behavior.
- Name tests `*.test.ts` or `*.test.tsx`, colocated or under `__tests__/`.
- Keep tests deterministic and behavior-focused. Add `testID` only where automation or stable UI targeting needs it.
- For UI changes, validate the affected mobile surface and capture screenshots or recordings when useful for review.

## Official References

- Expo: https://docs.expo.dev/llms-full.txt
- React Native: https://reactnative.dev/docs/getting-started
