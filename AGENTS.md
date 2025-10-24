# Repository Guidelines

## Project Structure & Module Organization
- `app/`: Expo Router screens (e.g., `app/(tabs)/index.tsx`, `app/modal.tsx`).
- `components/`: Reusable UI and feature components (PascalCase files).
- `hooks/`: Reusable React hooks (`useX.ts`/`useX.tsx`).
- `lib/`: Utilities and configuration (e.g., `lib/config.ts`, `lib/http.ts`).
- `context/`: React context providers (e.g., `DreamsContext.tsx`).
- `constants/`: Theme and app constants.
- `assets/images/`: App icons, splash, and images.

## Build, Test, and Development Commands
- Install deps: `npm install`
- Start (QR/dev menu): `npm run start`
- Web: `npm run web`
- Android emulator/device: `npm run android`
- iOS simulator: `npm run ios`
- Lint: `npm run lint` (ESLint via `eslint-config-expo`)
- Reset starter code: `npm run reset-project`
- API base URL (example):
  - macOS/Linux: `EXPO_PUBLIC_API_URL=http://localhost:3000 npm run web`
  - Windows PowerShell: `$Env:EXPO_PUBLIC_API_URL='http://localhost:3000'; npm run web`

## Coding Style & Naming Conventions
- Language: TypeScript (strict mode; see `tsconfig.json`).
- Components: Function components with hooks; PascalCase filenames (e.g., `MicButton.tsx`).
- Hooks: `use` prefix (e.g., `useDreamJournal.ts`).
- Indentation: 2 spaces; keep lines focused and typed.
- Linting: Follow Expo ESLint rules; fix with `npx eslint . --fix` when needed.

## Testing Guidelines
- No test runner is configured yet. If adding tests, prefer Jest + `@testing-library/react-native`.
- Name tests `*.test.ts`/`*.test.tsx` next to source or in `__tests__/`.
- Keep tests fast, deterministic, and focused on UI behavior and hooks.

## Commit & Pull Request Guidelines
- Commits: Imperative mood and scoped when helpful (e.g., `feat(recording): add waveform smoothing`).
- PRs: Include summary, screenshots or screen recordings for UI, steps to verify, and any config changes.
- Link related issues. Keep changes small and cohesive; run `npm run lint` before requesting review.

## Security & Configuration Tips
- Backend URL: Prefer `EXPO_PUBLIC_API_URL` or `app.json` `expo.extra.apiUrl` (see `lib/config.ts`).
- Never commit secrets; `EXPO_PUBLIC_*` values are exposed to the client.
- Network calls: Use `lib/http.ts` (`fetchJSON`) and respect timeouts.
