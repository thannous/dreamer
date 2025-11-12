# Mock Mode - Quick Start Guide

This guide will help you get started with mock mode in 2 minutes.

## What is Mock Mode?

Mock mode lets you develop and test the dream journal app **without any backend API or internet connection**. All services (API calls, storage, notifications) are simulated locally with realistic behavior and data.

## Quick Start

### 1. Start the App in Mock Mode

```bash
npm run start:mock
```

This will:
- Copy `.env.mock` to `.env.local`
- Start Expo with `EXPO_PUBLIC_MOCK_MODE=true`
- Load mock implementations of all services

### 2. What You'll See

When the app launches in mock mode:
- **Journal screen** starts empty (like a brand new guest) until you choose a mock profile
- **Console logs** will show `[MOCK]` prefixed messages for all service calls
- All features work exactly as in production

### Quick Auth Profiles

Open **Settings → Account** and use the *Quick sign-in (mock mode)* card to jump into common scenarios:

- **New user** – fresh account with empty storage so you can test onboarding flows.
- **Existing user** – automatically loads the predefined dreams for “returning user” journeys.
- **Premium user** – same as new, but with unlimited quotas to test paywalled features.

Switching profiles resets the in-memory storage so each scenario starts clean.

### 3. Try These Features

**Record a New Dream:**
1. Go to Home tab
2. Tap "Record Dream"
3. Speak or type a dream (mock mode works with any input)
4. Watch the simulated analysis progress (2-5 seconds)
5. See your new dream added to the journal

**Chat with AI:**
1. Open any dream from the journal
2. Scroll to the chat section
3. Ask questions about the dream
4. Get simulated AI responses (1-2 seconds)

**View Statistics:**
1. Go to Statistics tab
2. See charts and analytics based on your dreams
3. All calculations work on mock data

### 4. Return to Real Mode

When you're ready to use the real backend:

```bash
npm run start:real
```

This removes `.env.local` and restarts with real services.

## What Gets Mocked?

| Service | Mock Behavior |
|---------|---------------|
| **API Calls** | Simulated with 1-5s delays, realistic data |
| **Storage** | In-memory (resets on app restart) |
| **Notifications** | Console logs only |
| **Images** | Placeholder images from picsum.photos |

## Console Output Examples

When using mock mode, you'll see helpful logs:

```
[MOCK STORAGE] Pre-loading predefined dreams...
[MOCK STORAGE] Loaded 8 predefined dreams
[GEMINI SERVICE] Using MOCK implementation
[MOCK] analyzeDreamWithImageResilient called
[MOCK] analyzeDreamWithImageResilient returning with image
[MOCK STORAGE] saveDreams called with 9 dreams
```

## Customizing Mock Data

### Add More Predefined Dreams
Edit `mock-data/predefinedDreams.ts` and add to the `PREDEFINED_DREAMS` array.

### Change Mock Timings
Edit the delay values in `services/mocks/geminiServiceMock.ts`:
```typescript
await delay(1000 + Math.random() * 2000); // 1-3 seconds
```

### Use Different Images
Edit `mock-data/assets.ts` to change the image URLs.

## Troubleshooting

**"Services still using real API"**
- Check that `.env.local` exists with `EXPO_PUBLIC_MOCK_MODE=true`
- Restart the Expo dev server (clear cache: Shift+R in terminal)

**"No dreams showing up"**
- This is expected for guests; pick **Existing user** in Settings → Account to load the sample dreams
- Check console for `[MOCK STORAGE] Pre-loading predefined dreams...`
- Make sure you're looking at the Journal tab

**"Windows: npm script not working"**
- Manually create `.env.local`:
  ```bash
  copy .env.mock .env.local
  npm start
  ```

## Benefits of Mock Mode

✅ **No Backend Required** - Develop UI/UX independently
✅ **Fast Iteration** - No network latency
✅ **No API Quotas** - Test unlimited times
✅ **Offline Development** - Work anywhere
✅ **Consistent Data** - Same test data every time
✅ **Easy Demos** - Show app features reliably
✅ **Quick Onboarding** - New developers start immediately

## Next Steps

- Read `mock-data/README.md` for details on mock data structure
- See `CLAUDE.md` for complete mock mode documentation
- Explore the mock service implementations in `services/mocks/`

Happy coding! 🚀
