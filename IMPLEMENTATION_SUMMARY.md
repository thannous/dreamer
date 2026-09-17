# Mock Mode - Implementation Summary

✅ **Status:** Fully implemented and tested

## What Was Built

### 🎯 Core Functionality
A complete mock/development mode that allows running the app without any backend API or network dependencies.

### 📁 Files Created (16 new files)

#### Mock Data Layer
```
mock-data/
├── predefinedDreams.ts    # 8 curated realistic dreams
├── generators.ts          # Random content generators
├── assets.ts              # Placeholder image management
└── README.md              # Mock data documentation
```

#### Mock Services Layer
```
services/mocks/
├── geminiServiceMock.ts        # API mocks (analysis, chat, TTS)
├── storageServiceMock.ts       # In-memory storage with pre-loading
└── notificationServiceMock.ts  # Console-based notification logging
```

#### Real Services (Renamed Originals)
```
services/
├── geminiServiceReal.ts        # Original Gemini API implementation
├── storageServiceReal.ts       # Original AsyncStorage implementation
└── notificationServiceReal.ts  # Original expo-notifications implementation
```

#### Service Adapters (Modified)
```
services/
├── geminiService.ts           # Conditional export: mock vs real
├── storageService.ts          # Conditional export: mock vs real
└── notificationService.ts     # Conditional export: mock vs real
```

#### Configuration & Documentation
```
.env.mock                      # Mock mode environment variables
MOCK_MODE_QUICKSTART.md        # Quick start guide (2-minute setup)
IMPLEMENTATION_SUMMARY.md      # This file
AGENTS.md                      # Current repository guidelines
package.json                   # Added start:mock and start:real scripts
scripts/test-mock-mode.js      # Verification script
```

## How It Works

### Architecture

```
┌─────────────────────────────────────────────────┐
│                  Application                     │
│  (components, screens, hooks, context)          │
└─────────────────┬───────────────────────────────┘
                  │
                  │ imports services from
                  │ @/services/[serviceName]
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│            Service Adapters                      │
│  geminiService.ts                                │
│  storageService.ts                               │
│  notificationService.ts                          │
│                                                   │
│  if (EXPO_PUBLIC_MOCK_MODE === 'true')          │
│    → import from ./mocks/...                     │
│  else                                            │
│    → import from ./...Real                       │
└──────────┬──────────────────────┬────────────────┘
           │                      │
   (mock)  │                      │  (real)
           ▼                      ▼
┌──────────────────┐    ┌──────────────────┐
│   Mock Services  │    │   Real Services  │
│                  │    │                  │
│ • Simulated API  │    │ • Actual API     │
│ • In-memory DB   │    │ • AsyncStorage   │
│ • Console logs   │    │ • Real notifs    │
└──────────────────┘    └──────────────────┘
```

### Switching Modes

**Activate Mock Mode:**
```bash
npm run start:mock
# → copies .env.mock to .env.local
# → starts Expo with EXPO_PUBLIC_MOCK_MODE=true
```

**Deactivate Mock Mode:**
```bash
npm run start:real
# → removes .env.local
# → starts Expo in normal mode
```

### Environment Variable Flow

```
1. npm run start:mock
   ↓
2. .env.mock copied to .env.local
   ↓
3. Expo CLI loads .env.local
   ↓
4. process.env.EXPO_PUBLIC_MOCK_MODE = 'true'
   ↓
5. Service adapters check this variable
   ↓
6. Mock services are imported and used
   ↓
7. Console shows: [MOCK] prefixed logs
```

## Features

### ✨ What Mock Mode Provides

| Feature | Mock Behavior | Real Behavior |
|---------|---------------|---------------|
| **Dream Analysis** | 1-3s simulated delay | Real Gemini API call |
| **Image Generation** | 2-4s, returns picsum.photos | Real image generation API |
| **Chat AI** | 1-2s contextual responses | Real Gemini chat |
| **Storage** | In-memory (session-only) | AsyncStorage (persistent) |
| **Notifications** | Console logs only | Real scheduled notifications |
| **Initial Data** | Empty journal (select “Existing user” to load 8 sample dreams) | Empty journal |

### 📊 Mock Data

**8 Predefined Dreams:**
1. The Infinite Library (Mystical, with chat history)
2. Ocean of Stars (Surreal, with chat history, favorited)
3. The Shadowy Pursuer (Noir, nightmare)
4. Garden in the Clouds (Calm, lucid dream)
5. The Forgotten Classroom (Surreal, recurring)
6. Meeting My Future Self (Mystical, prophetic, favorited)
7. The Singing Forest (Calm, symbolic)
8. The Broken Mirror (Noir, symbolic)

**Random Generators:**
- 10 dream title templates
- 10 interpretation templates
- 10 shareable quote templates
- 4 themes (surreal, mystical, calm, noir)
- 8 dream types (lucid, recurring, nightmare, etc.)

## Testing

### Manual Testing Checklist

Run the test script:
```bash
node scripts/test-mock-mode.js
```

Expected output:
```
✅ .env.mock file exists
✅ Mock mode is ACTIVE
✅ All mock data files exist
✅ All mock service files exist
✅ All real service files exist
🎉 All mock mode files are in place!
```

### Functional Testing

1. **Start in mock mode:** `npm run start:mock`
2. **Check console logs:** Look for `[MOCK]` and `[MOCK STORAGE]` prefixes
3. **Journal tab:** Should be empty until you pick **Existing user** from Settings → Account (then shows 8 sample dreams)
4. **Record new dream:** Should work with simulated 3-5s delay
5. **Chat with dream:** Should get contextual responses
6. **Statistics tab:** Should show charts based on mock data
7. **Settings → Notifications:** Should log to console instead of scheduling

### TypeScript Validation

```bash
npx tsc --noEmit 2>&1 | grep -E "(services/|mock-data/)"
```

Expected: No errors in services/ or mock-data/ (only unrelated errors allowed)

## Benefits

| Benefit | Description |
|---------|-------------|
| 🚀 **Fast Development** | No API setup or backend deployment needed |
| 💰 **Zero API Costs** | Test unlimited times without quota limits |
| 📴 **Offline Ready** | Develop anywhere, no internet required |
| 🔄 **Quick Iteration** | No network latency (1-5s simulated delays) |
| 🎯 **Predictable Testing** | Same data every time, reproducible scenarios |
| 👥 **Easy Onboarding** | New developers can start immediately |
| 🎭 **Perfect Demos** | Reliable data for presentations |

## Console Output Examples

When running in mock mode (after selecting the **Existing user** profile if you want sample data):

```
[GEMINI SERVICE] Using MOCK implementation
[STORAGE SERVICE] Using MOCK implementation
[NOTIFICATION SERVICE] Using MOCK implementation
[MOCK STORAGE] Pre-loading predefined dreams...
[MOCK STORAGE] Loaded 8 predefined dreams
[MOCK] analyzeDreamWithImageResilient called
[MOCK] analyzeDreamWithImageResilient returning with image
[MOCK STORAGE] saveDreams called with 9 dreams
[MOCK NOTIFICATIONS] Notification handler configured
```

## Troubleshooting

### Issue: "Services still using real API"
**Solution:**
1. Check `.env.local` exists: `cat .env.local`
2. Verify it contains: `EXPO_PUBLIC_MOCK_MODE=true`
3. Restart Expo dev server (Shift+R in terminal)
4. Clear cache if needed

### Issue: "No dreams showing up in Journal"
**Solution:**
1. Check console for: `[MOCK STORAGE] Pre-loading predefined dreams...`
2. Navigate to Journal tab (not Home tab)
3. Reload app (shake device → Reload)

### Issue: "npm scripts don't work on Windows"
**Solution:**
Use manual commands:
```bash
# Enable mock mode
copy .env.mock .env.local
npm start

# Disable mock mode
del .env.local
npm start
```

## Next Steps

### Customization Ideas

1. **Add more dreams:** Edit `mock-data/predefinedDreams.ts`
2. **Adjust timings:** Edit delays in `services/mocks/geminiServiceMock.ts`
3. **Different images:** Modify `mock-data/assets.ts`
4. **Error simulation:** Add conditional errors in mock services
5. **Loading states:** Adjust delay ranges to test UI

### Future Enhancements

- [ ] Mock mode with configurable error rates
- [ ] Settings screen toggle for mock mode (without restart)
- [ ] Export mock data as JSON for sharing
- [ ] Import custom mock data sets
- [ ] Mock analytics for testing edge cases

## Documentation

- **Quick Start:** See `MOCK_MODE_QUICKSTART.md`
- **Mock Data Details:** See `mock-data/README.md`
- **Full Documentation:** See `MOCK_MODE_QUICKSTART.md`

---

**Implementation Date:** 2025-01-08
**Status:** ✅ Complete and tested
**Maintainer:** See AGENTS.md for development guidelines
