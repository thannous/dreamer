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

---
## Expo MCP / AI Agent Guide
### Project Overview
This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

### Documentation Resources
Use these Expo and React Native docs (AI-friendly) as primary references:
- https://docs.expo.dev/llms.txt
- https://docs.expo.dev/llms-full.txt
- https://docs.expo.dev/llms-eas.txt
- https://docs.expo.dev/llms-sdk.txt
- https://reactnative.dev/docs/getting-started

### Essential Expo & EAS Commands
```bash
npx expo start                  # Start dev server
npx expo start --clear          # Clear cache and start dev server
npx expo install <package>      # Install packages with compatible versions
npx expo install --check        # Check which installed packages need to be updated
npx expo install --fix          # Automatically update any invalid package versions
npx expo prebuild               # Generate native projects
npx expo run:ios                # Build and run on iOS device/simulator
npx expo run:android            # Build and run on Android device/emulator
npx expo doctor                 # Check project health and dependencies
```

### Development Principles for Agents
- Prefer TypeScript with strict types for all new code.
- Follow modern React patterns (function components + hooks, proper dependency arrays, memoization when needed).
- Reuse existing patterns in `app/`, `components/`, `hooks/`, and `lib/` before introducing new ones.
- Keep changes small, cohesive, and aligned with the current architecture and guidelines above.

### Using Expo MCP Tools
- Use `open_devtools` to launch React Native DevTools when debugging.
- Use `automation_take_screenshot` to capture UI for visual checks.
- Use `automation_tap_by_testid` and `automation_find_view_by_testid` when writing or validating automated flows.
- Prefer adding `testID` props on interactive components that need automation.

### AI Agent Workflow
1. Consult the relevant Expo docs (full, EAS, or SDK) before adding or modifying features.
2. Check this `AGENTS.md` and existing code to match project conventions.
3. When in doubt, ask for clarification rather than introducing new patterns or dependencies.
4. Avoid committing temporary debugging code or logs; keep the codebase clean.

# Agent Instructions

Always use context7 when I need code generation, setup or configuration steps, or
library/API documentation. This means you should automatically use the Context7 MCP
tools to resolve library id and get library docs without me having to explicitly ask.