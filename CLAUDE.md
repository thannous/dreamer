# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a React Native Expo app for dream journaling and analysis. Users can record dreams, which are analyzed via a backend API (using Gemini AI), and view them in a journal with generated imagery and interpretations. The app supports multi-language localization and uses file-based routing with Expo Router.

## Development Commands

### Starting the App
```bash
# Start development server
npm start
# or
expo start

# Run on specific platforms
npm run android    # Android emulator
npm run ios        # iOS simulator
npm run web        # Web browser
```

### Code Quality
```bash
npm run lint       # Run ESLint using expo lint
```

### Project Reset
```bash
npm run reset-project  # Moves starter code to app-example/ and creates blank app/
```

## Architecture

### Routing Structure
- Uses **Expo Router** with file-based routing
- Root layout: `app/_layout.tsx` wraps the app with `DreamsProvider` context and `ThemeProvider`
- Tab navigation: `app/(tabs)/_layout.tsx` defines bottom tabs (Home, Journal, Settings)
- Stack screens: recording screen, individual dream detail screen, and modal

### State Management
- **Context API**: `DreamsContext` (context/DreamsContext.tsx) provides global access to dream journal state
- **Custom Hook**: `useDreamJournal` (hooks/useDreamJournal.ts) manages dream CRUD operations with AsyncStorage persistence
- All dream data is persisted locally using `storageService.ts`

### Backend Integration
The app expects a backend API with the following endpoints (configured via `EXPO_PUBLIC_API_URL` or `app.json` extra.apiUrl):
- `POST /analyzeDream` - Analyzes dream transcript, returns title, interpretation, theme, etc.
- `POST /generateImage` - Generates dream imagery from prompt
- `POST /chat` - Conversational AI for dream interpretation follow-ups
- `POST /tts` - Text-to-speech for dream interpretations

Backend integration is centralized in `services/geminiService.ts`.

### Data Flow
1. User records dream in `/recording` screen
2. Transcript sent to backend via `analyzeDream()`
3. Analysis result includes title, interpretation, theme, and image prompt
4. `generateImageForDream()` fetches generated image
5. New dream object saved via `addDream()` from DreamsContext
6. User redirected to dream detail screen at `/journal/[id]`

### Storage
- Uses `@react-native-async-storage/async-storage` (with in-memory fallback)
- All storage operations in `services/storageService.ts`
- Keys: dreams, recording transcript, notification settings

### Type System
- Core types in `lib/types.ts`:
  - `DreamAnalysis`: Main dream object with id (timestamp), transcript, analysis results, chat history
  - `ChatMessage`: User/model conversation for follow-up questions
  - `NotificationSettings`: Notification preferences

### Path Aliases
- `@/*` maps to project root (configured in tsconfig.json)
- Use for imports: `import { useDreams } from '@/context/DreamsContext'`

## Key Implementation Details

### Expo Features Enabled
- `newArchEnabled: true` - Uses React Native new architecture
- `typedRoutes: true` - Type-safe routing with Expo Router
- `reactCompiler: true` - React 19 compiler optimizations
- Edge-to-edge Android UI with predictive back gesture disabled

### Theme System
- Light/dark mode support via `useColorScheme` hook
- Color constants in `constants/theme.ts`
- Themed components: `ThemedView`, `ThemedText` (components/)

### Internationalization
- i18n setup in `lib/i18n.ts`
- `useTranslation` hook provides `t()` function for translations
- Language detection based on device locale

### API Configuration
Backend URL resolution priority:
1. `process.env.EXPO_PUBLIC_API_URL`
2. `app.json` extra.apiUrl
3. Default: `http://localhost:3000`

## Common Patterns

### Adding a New Screen
1. Create file in `app/` directory (e.g., `app/new-screen.tsx`)
2. Add Stack.Screen entry in `app/_layout.tsx`
3. Navigate using `router.push('/new-screen')` from expo-router

### Working with Dreams
```typescript
import { useDreams } from '@/context/DreamsContext';

const { dreams, addDream, updateDream, deleteDream, toggleFavorite } = useDreams();
```

### Making API Calls
All backend communication goes through `services/geminiService.ts`. Use the exported functions rather than direct fetch calls.

## Testing Notes
- No test suite currently configured
- Linting available via `npm run lint` (ESLint with expo config)
