# Quick Wins Checklist

Actionable improvements that can be implemented in < 1 hour each.

## ⚡ Performance (30 min each)

- [ ] **Install FlashList**
  ```bash
  npx expo install @shopify/flash-list
  ```
  Replace `FlatList` in `journal.tsx` with `FlashList`

- [ ] **Enable React Compiler**
  ```bash
  npx expo install babel-plugin-react-compiler
  ```
  Add to `babel.config.js`:
  ```js
  plugins: [['babel-plugin-react-compiler', { target: '19' }]]
  ```

## 🔧 Code Quality (15 min each)

- [ ] **Fix any types** in `journal.tsx` line 155
  Import `ViewToken` from react-native

- [ ] **Remove dead code** in `useDreamJournal.ts`
  Delete `guestLimitReached = false` and update types

- [ ] **Extract inline handlers** in `recording.tsx`
  Move `onClose={() => {...}}` to `useCallback`

## ♿ Accessibility (20 min each)

- [ ] **Add accessibilityState** to MicButton
  ```tsx
  accessibilityState={{ disabled, busy: isRecording }}
  ```

- [ ] **Add accessibilityHint** to key buttons
  Recording, Save Dream, Navigate Journal

## 📁 Organization (1 hour)

- [ ] **Create constants file**
  `constants/appConfig.ts` with magic numbers

## 🧪 Verification Commands

```bash
# Type check
npx tsc --noEmit

# Lint
npm run lint

# React Compiler health
npx react-compiler-healthcheck@latest

# Test on low-end device
npx expo start --dev-client
```

## Priority Order

1. Enable React Compiler (biggest impact)
2. Install FlashList
3. Fix accessibility states
4. Remove dead code
5. Create constants file
