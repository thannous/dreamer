# Noctalia (Dream App) Developer Guide

## 1. Project Overview
Noctalia is a React Native mobile application built with Expo that helps users record, analyze, and explore their dreams.

**Core Features:**
- **Dream Recording:** Voice-to-text transcription of dreams.
- **AI Analysis:** Uses Google Gemini to generate titles, interpretations, themes, and visual imagery for dreams.
- **Dream Exploration:** Interactive chat with an AI persona representing the dream.
- **Journaling:** Timeline view of past dreams with filtering and search.

## 2. Architecture & Tech Stack
- **Framework:** React Native (Expo SDK 52)
- **Routing:** Expo Router (File-based routing in `app/`)
- **Language:** TypeScript (Strict mode)
- **Backend:** Supabase (Auth, Database, Edge Functions)
- **AI Service:** Google Gemini (via Edge Functions or direct for dev)
- **State Management:** React Context (`context/`) + Local State
- **Testing:** Vitest (Unit), Maestro (E2E)
- **Styling:** Standard React Native stylesheets + Themed components

## 3. Quick Start (Mock Mode)
The project includes a robust **Mock Mode** that simulates all backend services (AI, Storage, Notifications) locally. This is the recommended way to develop features without incurring API costs or needing network connectivity.

**To start in Mock Mode:**
```bash
npm run start:mock
```
*Action:* Copies `.env.mock` to `.env.local` and starts the Expo server.
*Features:*
- Instant "Fake" AI analysis (1-3s delay).
- In-memory storage (resets on reload unless "Existing User" profile is selected).
- Console-logged notifications.

**To start in Real Mode:**
```bash
npm run start:real
```
*Requires:* Valid Supabase and Gemini API credentials in environment variables.

## 4. Project Structure
```
├── app/                 # Screens & Navigation (Expo Router)
│   ├── (tabs)/          # Main tab bar navigation
│   └── dream-chat/      # Dynamic routes for specific features
├── components/          # Reusable UI Components
│   ├── ui/              # Generic UI primitives
│   └── journal/         # Feature-specific components
├── context/             # Global State (Auth, Dreams, Theme)
├── hooks/               # Custom React Hooks
├── lib/                 # Core Logic & Utilities
│   ├── supabase.ts      # Backend client initialization
│   ├── types.ts         # Shared TypeScript interfaces (Dream, User)
│   └── config.ts        # Environment configuration
├── services/            # Service Layer (API, Storage)
│   ├── mocks/           # Mock implementations
│   └── [name].ts        # Service adapters (switch between mock/real)
├── mock-data/           # Static data for Mock Mode
├── maestro/             # E2E Test Flows (.yml)
└── supabase/            # Backend configuration & migrations
```

## 5. Key Workflows & Commands

### Development
- `npm run start:mock` - Start with mock services (Recommended).
- `npm run start:real` - Start with real backend services.
- `npm run android` / `npm run ios` - Run on native emulators.

### Testing
- `npm run test` - Run unit tests via Vitest.
- `npm run test:e2e` - Run standard E2E smoke test (Maestro).
- `npm run lint` - Check code quality.

### Building
- `npm run build:apk:mock` - Build a local Android APK using mock data.

## 6. Environment Variables
Configuration is handled via `.env` files.
- **`.env.mock`**: Pre-configured variables for mock mode.
- **`.env.local`**: Active local configuration (ignored by git).
- **Required for Real Mode:**
    - `EXPO_PUBLIC_SUPABASE_URL`
    - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
    - `EXPO_PUBLIC_API_URL` (Edge Function URL)

## 7. Development Conventions
- **Strict TypeScript:** No `any` types. Define interfaces in `lib/types.ts` if shared.
- **Component Structure:** Functional components with hooks. PascalCase filenames.
- **Service Pattern:** Use the Service Adapter pattern (in `services/`) to ensure logic works in both Mock and Real modes.
- **Testing:** Write unit tests for hooks/logic. Use `testID` props for UI components to facilitate Maestro E2E testing.

## 8. AI Agent Guidelines
*(Summarized from `AGENTS.md`)*
- **Mobile-First:** Prioritize mobile UX patterns.
- **Expo Standards:** Follow modern Expo/React Native patterns (hooks, functional components).
- **Don't Break Mock Mode:** Ensure new features have a mock implementation in `services/mocks/`.
- **Safety:** Never commit API keys or secrets.
