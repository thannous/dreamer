# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a React Native Expo app for dream journaling and analysis. Users can record dreams via voice, which are analyzed via a backend API (using Gemini AI), and view them in a journal with generated imagery and interpretations.

**Key Features:**
- Voice recording with real-time waveform visualization
- AI-powered dream analysis (title, interpretation, themes, categorization)
- AI-generated dream imagery
- Conversational AI chat for follow-up questions
- Comprehensive statistics and analytics with charts
- Daily reminder notifications
- Multi-language localization
- Light/dark theme support
- Resilient error handling with automatic retries
- Graceful degradation (dreams saved even if image generation fails)

**Tech Stack:**
- React Native (0.81.5) with new architecture enabled
- Expo SDK 54 with file-based routing (Expo Router v6)
- React 19 with compiler optimizations
- Supabase for authentication and backend integration
- AsyncStorage for local persistence

## Development Commands

### Starting the App
```bash
# Start development server
npm start
# or
expo start

# Start with Supabase local development (if using local backend)
npm run start:supabase

# Run on specific platforms
npm run android    # Android emulator
npm run ios        # iOS simulator
npm run web        # Web browser
```

### Code Quality
```bash
npm run lint       # Run ESLint using expo lint
```

### Mock Mode (Development/Testing)

The app includes a comprehensive mock mode for development and testing without real network calls or backend dependencies.

**Starting in Mock Mode:**
```bash
npm run start:mock    # Copies .env.mock to .env.local and starts app
```

**Returning to Real Mode:**
```bash
npm run start:real    # Removes .env.local and starts app with real services
```

**What Mock Mode Provides:**
- **No Network Calls**: All API requests are simulated locally with realistic delays
- **Pre-loaded Data**: 8 predefined realistic dreams with images, interpretations, and chat histories
- **In-Memory Storage**: Changes persist during the app session but reset on restart
- **Mock Notifications**: Notification scheduling is simulated via console logs
- **Placeholder Images**: Uses picsum.photos for dream imagery
- **Full Functionality**: All app features work exactly as in production
- **Console Logging**: All service calls are logged for debugging

**Mock Timings (simulates real API behavior):**
- Dream analysis: 1-3 seconds
- Image generation: 2-4 seconds
- Combined analysis: 3-5 seconds
- Chat responses: 1-2 seconds
- Text-to-speech: 2-3 seconds

**Mock Data Location:**
- `mock-data/predefinedDreams.ts` - 8 curated realistic dreams
- `mock-data/generators.ts` - Random dream/chat generators
- `mock-data/assets.ts` - Placeholder image URLs

**Mock Services:**
- `services/mocks/geminiServiceMock.ts` - Mocked API calls
- `services/mocks/storageServiceMock.ts` - In-memory storage
- `services/mocks/notificationServiceMock.ts` - Notification logging

**Use Cases:**
- Develop UI/UX without backend dependency
- Test app flows without API quota limits
- Demo the app without internet connection
- Rapid iteration without network latency
- Onboard new developers quickly

**Windows Users:**
If the npm scripts don't work on Windows, manually create/delete `.env.local`:
```bash
# To enable mock mode
copy .env.mock .env.local
npm start

# To disable mock mode
del .env.local
npm start
```

### Project Reset
```bash
npm run reset-project  # Moves starter code to app-example/ and creates blank app/
```

## Architecture

### Routing Structure
- Uses **Expo Router** with file-based routing
- Root layout: `app/_layout.tsx` wraps the app with `ErrorBoundary`, `DreamsProvider` context, and `ThemeProvider`
- Tab navigation: `app/(tabs)/_layout.tsx` defines bottom tabs (Home, Journal, Statistics, Settings)
- Stack screens: recording screen, individual dream detail screen, dream chat, dream categories, and modal
- Error boundary catches and displays runtime errors gracefully

### State Management
- **Context API**: `DreamsContext` (context/DreamsContext.tsx) provides global access to dream journal state
- **Custom Hook**: `useDreamJournal` (hooks/useDreamJournal.ts) manages dream CRUD operations with AsyncStorage persistence
- All dream data is persisted locally using `storageService.ts`

### Backend Integration
The app expects a backend API with the following endpoints (configured via `EXPO_PUBLIC_API_URL` or `app.json` extra.apiUrl):
- `POST /analyzeDream` - Analyzes dream transcript, returns title, interpretation, theme, etc.
- `POST /analyzeDreamFull` - **Combined endpoint** that analyzes dream and generates image in one request (preferred)
- `POST /generateImage` - Generates dream imagery from prompt (fallback for separate image generation)
- `POST /chat` - Conversational AI for dream interpretation follow-ups
- `POST /tts` - Text-to-speech for dream interpretations

Backend integration is centralized in `services/geminiService.ts`.

**Key Features:**
- **Resilient Analysis**: `analyzeDreamWithImageResilient()` automatically falls back to analysis-only if image generation fails
- **Automatic Retry**: HTTP client (`lib/http.ts`) includes exponential backoff retry logic for network/timeout/server errors
- **Error Classification**: `lib/errors.ts` provides user-friendly error messages and retry recommendations

### Data Flow
1. User records dream in `/recording` screen (with real-time waveform visualization)
2. Transcript sent to backend via `analyzeDreamWithImageResilient()` with progress tracking
3. Analysis includes title, interpretation, theme, dream type, and image (if successful)
4. If image generation fails, dream is saved with `imageGenerationFailed: true` flag
5. New dream object saved via `addDream()` from DreamsContext
6. User redirected to dream detail screen at `/journal/[id]`
7. Failed images can be retried later using the `ImageRetry` component

**Progress Tracking:**
- `useAnalysisProgress` hook tracks analysis steps (analyzing, generating image, finalizing)
- `AnalysisProgress` component displays progress bar and user-friendly messages

### Storage
- Uses `@react-native-async-storage/async-storage` (with in-memory fallback)
- All storage operations in `services/storageService.ts`
- Keys: dreams, recording transcript, notification settings

### Type System
Core types in `lib/types.ts`:
- **`DreamAnalysis`**: Main dream object with:
  - `id` (timestamp), `transcript`, `title`, `interpretation`, `shareableQuote`
  - `imageUrl` (full resolution), `thumbnailUrl` (optional, optimized for lists)
  - `chatHistory` (array of ChatMessage)
  - `theme` (visual theme), `dreamType` (categorization)
  - `isFavorite` (boolean), `imageGenerationFailed` (boolean)
- **`ChatMessage`**: User/model conversation for follow-up questions
- **`NotificationSettings`**: Notification preferences with weekday/weekend times
- **`ClassifiedError`** (`lib/errors.ts`): Error with type, user message, and retry capability

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

### Statistics & Analytics
New statistics screen (`app/(tabs)/statistics.tsx`) displays comprehensive dream analytics:
- **Overview**: Total dreams, favorites, weekly/monthly counts
- **Streaks**: Current and longest dream journaling streaks
- **Time Analysis**: Dreams by day of week (bar chart), dreams over time (line chart)
- **Content Analysis**: Dream type distribution (pie chart), top themes
- **Engagement**: Chat activity, most discussed dreams

Uses `useDreamStatistics` hook (`hooks/useDreamStatistics.ts`) for data processing and `react-native-gifted-charts` for visualizations.

### Error Handling & Resilience
- **Error Classification** (`lib/errors.ts`): Categorizes errors (network, timeout, rate limit, server, client) with user-friendly messages
- **HTTP Retry Logic** (`lib/http.ts`): Automatic exponential backoff for transient failures
- **Progress Tracking** (`hooks/useAnalysisProgress.ts`): Tracks multi-step operations with animated progress
- **Graceful Degradation**: Dreams can be saved without images if generation fails

### Notifications
- **Service**: `services/notificationService.ts` handles daily dream journaling reminders
- **Settings**: Users can configure separate weekday/weekend reminder times
- **Integration**: Configured in root layout via `configureNotificationHandler()`

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

**Preferred approach for dream analysis:**
```typescript
import { analyzeDreamWithImageResilient } from '@/services/geminiService';

// Automatically handles image generation fallback
const result = await analyzeDreamWithImageResilient(transcript);
// result.imageUrl will be string or null
// result.imageGenerationFailed indicates if image failed
```

### Tracking Progress
```typescript
import { useAnalysisProgress, AnalysisStep } from '@/hooks/useAnalysisProgress';

const progress = useAnalysisProgress();

// Set current step
progress.setStep(AnalysisStep.ANALYZING);
progress.setStep(AnalysisStep.GENERATING_IMAGE);

// Handle errors
progress.setError(classifiedError);

// Display progress
<AnalysisProgress {...progress} onRetry={handleRetry} />
```

### Error Handling
```typescript
import { classifyError, getUserErrorMessage } from '@/lib/errors';

try {
  await someApiCall();
} catch (error) {
  const classified = classifyError(error as Error);
  Alert.alert('Error', classified.userMessage);

  if (classified.canRetry) {
    // Offer retry option
  }
}
```

## Key Dependencies

### UI & Visualization
- `react-native-gifted-charts` (v1.4.64) - Bar, line, and pie charts for statistics
- `react-native-svg` (v15.12.1) - Required for chart rendering
- `expo-linear-gradient` - Gradient backgrounds and visual effects
- `@expo-google-fonts/space-grotesk` & `@expo-google-fonts/lora` - Typography

### Audio & Media
- `expo-audio` - Voice recording with waveform metering
- `expo-speech` - Text-to-speech for dream interpretations
- `expo-image` - Optimized image loading with thumbnails

### Backend & Storage
- `@supabase/supabase-js` - Authentication and backend integration
- `@react-native-async-storage/async-storage` - Local data persistence

### Notifications & Scheduling
- `expo-notifications` - Daily dream journaling reminders

### Navigation
- `expo-router` (v6) - File-based routing with type safety
- `@react-navigation/native` - Navigation primitives

## Key Components & Hooks

### Hooks
- `useDreams` - Access and modify dream journal data
- `useDreamStatistics` - Calculate comprehensive dream analytics
- `useAnalysisProgress` - Track multi-step analysis progress
- `useColorScheme` - Light/dark theme detection

### Components
- `AnalysisProgress` (`components/analysis/`) - Progress bar with error handling
- `ImageRetry` (`components/journal/`) - Retry failed image generation
- `MicButton` (`components/recording/`) - Recording button with haptic feedback
- `Waveform` (`components/recording/`) - Real-time audio visualization
- `ErrorBoundary` - App-wide error catching

## Testing Notes
- No test suite currently configured
- Linting available via `npm run lint` (ESLint with expo config)
