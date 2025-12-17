# Comprehensive Code Review - Dreamer React Native App

**Review Date:** November 2024  
**React Native Version:** 0.82 | **React Version:** 19.2 | **Framework:** Expo SDK 53

---

## Analysis Summary

### Overall Codebase Health: **Good** (B+)

The codebase demonstrates solid React Native/Expo practices with well-structured TypeScript, proper use of contexts, and good separation of concerns. Key improvement areas:

1. **Performance**: FlatList → FlashList, enable React Compiler
2. **Code Organization**: Split large components (recording.tsx at 1332 lines)
3. **React 19 Adoption**: Use `use()` API for conditional context consumption
4. **Accessibility**: Add missing labels on interactive elements

---

## Critical & High Priority Issues

### Issue 1: FlatList Performance
**Severity:** High | **Category:** Performance  
**Location:** `app/(tabs)/journal.tsx` lines 392-435

**Problem:** Using FlatList instead of FlashList (5-10x slower).

**Fix:**
```tsx
import { FlashList } from '@shopify/flash-list';

<FlashList
  data={filteredDreams}
  renderItem={renderDreamItem}
  estimatedItemSize={140}
  keyExtractor={keyExtractor}
/>
```
Install: `npx expo install @shopify/flash-list`

---

### Issue 2: Monolithic Recording Component
**Severity:** High | **Category:** Code Smell  
**Location:** `app/recording.tsx` (1332 lines)

**Problem:** Single component handles recording, transcription, saving, analysis, and UI.

**Fix:** Extract into focused hooks and components:
- `hooks/useRecordingSession.ts` - Audio/speech logic
- `hooks/useDreamSaving.ts` - Persistence logic
- `components/recording/RecordingBottomSheets.tsx` - Modal UI

---

### Issue 3: Missing React 19 use() API
**Severity:** High | **Category:** Best Practice  
**Location:** All context consumers

**Problem:** Using `useContext` everywhere instead of React 19's conditional `use()`.

**Fix:**
```tsx
import { use } from 'react';
const auth = use(AuthContext);
if (!auth?.user) return <GuestView />;
const theme = use(ThemeContext); // Only called if authenticated
```

---

## Medium Priority Issues

### Issue 4: any Types in Viewability Handler
**Location:** `app/(tabs)/journal.tsx` line 155

```tsx
// Before
const onViewableItemsChanged = useRef(({ viewableItems }: any) => { ... })

// After
import type { ViewToken } from 'react-native';
const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => { ... })
```

### Issue 5: Inline Functions in JSX
**Location:** `app/recording.tsx` line 1084

```tsx
// Before
<BottomSheet onClose={() => { setShowGuestLimitSheet(false); }} />

// After
const handleClose = useCallback(() => setShowGuestLimitSheet(false), []);
<BottomSheet onClose={handleClose} />
```

### Issue 6: Hardcoded Error Messages
**Location:** `lib/errors.ts`

Error messages bypass i18n. Accept optional translation function:
```tsx
export function classifyError(error: Error, t?: (key: string) => string): ClassifiedError
```

### Issue 7: Missing Accessibility States
**Location:** `components/recording/MicButton.tsx`

```tsx
<Pressable
  accessibilityState={{ disabled, busy: isRecording }}
  accessibilityHint={isRecording ? t('recording.mic.stop_hint') : t('recording.mic.start_hint')}
/>
```

---

## Low Priority Issues

| Issue | Location | Fix |
|-------|----------|-----|
| Dead code `guestLimitReached = false` | `useDreamJournal.ts:618` | Remove unused variable |
| Magic numbers (2800, 140, 5) | Multiple files | Create `constants/appConfig.ts` |
| Single root ErrorBoundary | `app/_layout.tsx` | Add per-screen boundaries |
| Redundant memoization | `DreamsContext.tsx` | Simplify with React Compiler |

---

## Recommendations

### 1. Enable React Compiler (Highest Impact)
```bash
npx expo install babel-plugin-react-compiler
```
```js
// babel.config.js
plugins: [['babel-plugin-react-compiler', { target: '19' }]]
```

### 2. Performance Checklist
- [ ] Replace FlatList → FlashList
- [ ] Enable React Compiler
- [ ] Add `estimatedItemSize` to lists
- [ ] Test on low-end Android devices

### 3. Architecture Improvements
- [ ] Split recording.tsx into 3-4 smaller files
- [ ] Create constants file for magic numbers
- [ ] Add screen-level error boundaries
- [ ] Document removed guestLimitReached or implement properly

### 4. Testing Strategy
- [ ] Add unit tests for hooks (useRecordingSession, useDreamSaving)
- [ ] Add integration tests with Maestro for recording flow
- [ ] Performance regression tests with Reassure

---

## Files Requiring Immediate Attention

1. `app/recording.tsx` - Needs refactoring (too large)
2. `app/(tabs)/journal.tsx` - Migrate to FlashList
3. `lib/errors.ts` - Add i18n support
4. `babel.config.js` - Enable React Compiler
