# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Noctalia is an AI-powered dream journal app: users record dreams by voice or text, a Supabase Edge Function backend (Gemini AI) produces interpretations, imagery, and categorization, and dreams are explored through a journal, statistics, chat, a symbol dictionary, and lucid-dreaming rituals. The app supports guest mode with quotas, Supabase auth (including Google Sign-In), RevenueCat subscriptions, and five languages (en, fr, es, de, it). The repo also contains a generated multilingual marketing site.

**Tech stack:** Expo SDK 57 (Expo Router), React Native 0.86, React 19, TypeScript strict, Supabase (auth, Postgres, Deno Edge Functions), RevenueCat, Jest (unit), Vitest (perf only), Maestro (Android E2E). Requires Node >= 22.23.1.

`package.json` is the command source of truth — do not invent parallel wrappers. `AGENTS.md` is the companion repository guide and is kept current.

## Commands

### Running the App
```bash
npm ci                    # Reproducible install
npm run start             # Dev server (via scripts/expo-safe-runner.js)
npm run start:mock        # Mock mode (.env.mock profile) — no network/backend needed
npm run start:real        # Real services (.env.real profile)
npm run start:supabase    # Supabase-backed local development
npm run start:teststore   # Test-store subscription profile
npm run android           # Native Android build+run
npm run ios               # Native iOS build+run
npm run web               # Web development
```

### Code Quality
```bash
npm run lint              # Full ESLint (expo lint over app, components, hooks, lib, context, constants, services, tests, supabase/functions, scripts)
npx expo lint <paths>     # Scoped lint for touched paths
npm run typecheck:app     # TypeScript for app code
npm run typecheck:tests   # TypeScript for test files (tsconfig.test.json)
```

### Unit Tests (Jest — runs once, not watch mode)
```bash
npm test                                  # Full suite (both projects)
npm run test:file -- path/to/x.test.tsx   # Run specific test file(s)
npm run test:related -- <source-files>    # Tests related to given source files
npm run test:changed                      # Tests for changed files
npm run test:node                         # Node project only (scripts/**/*.test.js)
npm run test:expo                         # Expo project only (app code tests)
npm run test:perf                         # Performance tests (Vitest, *.perf.test.ts)
```

Prefer the narrowest check first (`test:related`/`test:file`), then broaden. If Watchman fails in a sandbox, add `--watchman=false` (jest.config.js already defaults to `watchman: false`).

Jest is a two-project setup (`jest.config.node.js` for plain-JS script tests, `jest.config.expo.js` with the jest-expo preset for everything else). The Expo project maps `react-native`, `reanimated`, `expo-*` etc. to stubs in `tests/` and loads `jest.setup.ts`. Supabase function tests (`supabase/functions/**/*.test.ts`) are Deno tests and are excluded from Jest.

### E2E Tests (Maestro, Android)
```bash
npm run test:e2e                # core suite
npm run test:e2e:smoke          # smoke suite
npm run test:e2e:mock           # mock-mode suite
```
All flows live in `maestro/*.yml`, orchestrated by `scripts/run-maestro-android.js`. Many targeted `test:e2e:*` scripts exist (quotas, guest limits, subscriptions, onboarding, recording) — pick the smallest matching one; `test:e2e:android:all` is not the default validation path. Requires Maestro CLI and an emulator/device.

### Marketing Site
```bash
npm run docs:dev            # Live editing
npm run docs:build          # Build site (includes docs:build:experience bundle)
npm run docs:check          # Validate output
npm run docs:release-check  # Only for release-ready site work
```
Edit `docs-src/` and generator inputs in `data/` — **never edit `docs/`**, it is generated output. Cloudflare Pages builds from tracked sources on `master`. See `docs-src/README.md` for the site workflow.

### Backend, Release & Audits
```bash
npm run db:contract:check         # Validate DB contract (:local variant for local stack)
npm run android:gates             # Android release readiness (report-only)
npm run security:audit:mobile     # Mobile security audit
npm run build:web                 # Web export + PWA service worker
npm run build:apk:mock            # Local APK, mock mode
npm run build:apk:prod            # Local production APK
```

Do not run `expo prebuild`, EAS builds, store submissions, production deploys, or destructive database commands unless explicitly requested.

## Architecture

### Mock/Real Service Switch
Core services have three files: a conditional export (e.g. `services/geminiService.ts`), a real implementation (`geminiServiceReal.ts`), and a mock (`services/mocks/geminiServiceMock.ts`). The conditional export picks the implementation at bundle time from `EXPO_PUBLIC_MOCK_MODE` (via `isMockModeEnabled()` in `lib/env.ts`). This pattern applies to `geminiService`, `storageService`, `notificationService`, and `subscriptionService`. Always import the conditional module, never the `*Real`/`*Mock` file directly. Mock data lives in `mock-data/`.

### Environment Variables
`EXPO_PUBLIC_*` values are injected at bundle time only when accessed statically — dynamic `process.env[key]` access breaks in production. All access goes through `lib/env.ts`: to add a variable, extend the `ExpoPublicEnvKey` union and the switch in `getExpoPublicEnvValue()`. Every `EXPO_PUBLIC_*` value is visible to clients — never put secrets there. Runtime profiles (`.env.mock`, `.env.real`, `.env.teststore`, `.env.playstore`, `.env.supabase`) are applied by `scripts/expo-safe-runner.js` via the `start:*` scripts.

### Backend (Supabase Edge Functions)
The backend is Deno Edge Functions in `supabase/functions/`:
- **`api`** — main router (`api/index.ts` maps `METHOD /path` to handlers in `api/routes/`): dream analysis (`/analyzeDream`, `/analyzeDreamFull`, `/categorizeDream`), images (`/generateImage`, async `/image-jobs` + `/image-jobs/status`), `/chat`, `/transcribe`, guest sessions (`/guest/session`), quotas (`/quota/status`, `/auth/mark-upgrade`), subscription sync (`/subscription/*`), and product analytics (`/analytics/*`). Shared logic (auth headers, quota enforcement, Play Integrity, prompts, schemas) is in `api/lib/`.
- **`image-job-worker`** — background image generation jobs.
- **`revenuecat-webhook`** — RevenueCat entitlement events.

Database migrations are in `supabase/migrations/`; `supabase/db-contract.manifest.json` is validated by `npm run db:contract:check`.

The client resolves the API base URL via `lib/config.ts` (`EXPO_PUBLIC_API_URL` → `app.json` `extra.apiUrl` → `http://localhost:3000`). All client HTTP goes through `lib/http.ts` (timeouts, auth headers, exponential-backoff retry) and errors are classified by `lib/errors.ts` (user message + `canRetry`). A circuit breaker lives in `lib/circuitBreaker.ts`.

### Routing & Provider Stack
Expo Router file-based routing in `app/`: tabs in `app/(tabs)/` (index/home, journal, statistics, settings, add-dream) plus stack screens for recording, `journal/[id]`, dream-chat, dream-categories, dream-guide(s), onboarding, paywall, auth, ritual, sleep-sounds, symbol-dictionary, and symbol-detail. New screens need a `Stack.Screen` entry in `app/_layout.tsx`.

Provider nesting in `app/_layout.tsx` (outermost first): `LanguageProvider` → `ThemeProvider` → `AuthProvider` → `OnboardingProvider` → `SubscriptionProvider` → navigation/keyboard providers → `DreamsProvider`. Consume via hooks: `useDreams()`, `useAuth()`, `useSubscription()`, `useTranslation()`, `useTheme()`.

### Dream Data Flow
1. Recording screen captures voice (`expo-audio` + `expo-speech-recognition`, with text fallback) — see `useRecordingSession`.
2. Transcript goes through `analyzeDreamWithImageResilient()` (`services/geminiService.ts`), which falls back to analysis-only if image generation fails (`imageGenerationFailed: true`); images may also complete asynchronously via image jobs (`PendingImageJob`).
3. `useAnalysisProgress` tracks multi-step progress for the `AnalysisProgress` component.
4. The dream is saved through `DreamsContext`/`useDreamJournal` to local storage (AsyncStorage via `storageService.ts`), and synced to Supabase through `services/supabaseDreamService.ts` with an offline mutation queue (`useOfflineSyncQueue`, sync states in `lib/types.ts`: `DreamSyncState`, `SyncMutationStatus`).

Core types are in `lib/types.ts` (`DreamAnalysis`, `ChatMessage`, `DreamType`, `DreamTheme`, `AppLanguage`, notification/ritual/preference types).

### Monetization & Quotas
- **Guest mode:** server-issued guest sessions with device fingerprinting (`lib/guestSession.ts`, `lib/deviceFingerprint.ts`) and limits (`lib/guestLimits.ts`); quota tiers in `lib/quotaTier.ts`, checked via `useQuota` and `services/quotaService.ts`. The backend enforces quotas in `api/lib/analysisQuota.ts`.
- **Subscriptions:** RevenueCat SDK config in `lib/revenuecat.ts`, client service in `services/subscriptionService*.ts`, state in `SubscriptionContext` with `useSubscription*` hooks, server reconciliation via `services/subscriptionSyncService.ts` + `/subscription/*` routes + the webhook. Paywall screens/variants: `app/paywall.tsx`, `lib/paywallVariants.ts`. A subscription QA lab and extensive `subscription:qa:*` scripts exist for release verification.

### Internationalization & Theming
i18n in `lib/i18n.ts` + `lib/i18n/` with `useTranslation()`; language preference in `LanguageContext` (`AppLanguage = en|fr|es|de|it`). Marketing-site locales are separate, under `docs-src/locales/`. Theming via `ThemeContext` (light/dark/auto) with constants in `constants/theme.ts` and `ThemedView`/`ThemedText` components.

### Path Alias
`@/*` maps to the project root (e.g. `import { useDreams } from '@/context/DreamsContext'`).

## Conventions

- Start from `git status --short`; preserve unrelated or pre-existing changes. Separate failures caused by your patch from known baseline/environment/Watchman/emulator failures.
- Prefer the smallest cohesive change that reuses existing patterns: established components, theme constants, service boundaries, and i18n patterns before new abstractions.
- Function components and hooks only; PascalCase components, `useX` hooks; 2-space indentation.
- Tests are named `*.test.ts(x)`, colocated or under `__tests__/`; UI behavior via `@testing-library/react-native`; add `testID` only where automation needs stable targeting (see `lib/testIDs.ts`).
- Do not commit secrets, temporary logs, or generated `docs/` output.
