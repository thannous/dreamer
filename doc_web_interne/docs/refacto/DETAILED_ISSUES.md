# Detailed Issue Analysis & Fixes

## Performance Issues

### P1: FlashList Migration

**Files affected:** `app/(tabs)/journal.tsx`

```tsx
// BEFORE (lines 392-434)
<FlatList
  testID={TID.List.Dreams}
  ref={flatListRef}
  data={filteredDreams}
  extraData={visibleItemIds}
  keyExtractor={keyExtractor}
  renderItem={renderDreamItem}
  getItemLayout={getItemLayout}
  removeClippedSubviews
  maxToRenderPerBatch={10}
  windowSize={21}
/>

// AFTER
import { FlashList } from '@shopify/flash-list';

<FlashList
  testID={TID.List.Dreams}
  ref={flatListRef}
  data={filteredDreams}
  extraData={visibleItemIds}
  keyExtractor={keyExtractor}
  renderItem={renderDreamItem}
  estimatedItemSize={140}
  showsVerticalScrollIndicator={false}
/>
```

**Why:** FlashList recycles views natively, providing 5-10x better performance.

---

### P2: React Compiler Setup

**File:** `babel.config.js`

```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      ['babel-plugin-react-compiler', { target: '19' }],
    ],
  };
};
```

Run health check: `npx react-compiler-healthcheck@latest`

---

## TypeScript Issues

### T1: any Type in Viewability Handler

**File:** `app/(tabs)/journal.tsx` line 155

```tsx
// BEFORE
const onViewableItemsChanged = useRef(({ viewableItems, changed }: any) => {
  viewableItems.forEach((item: any) => {
    if (item.item?.id) {
      newVisibleIds.add(item.item.id);
    }
  });
}).current;

// AFTER
import type { ViewToken } from 'react-native';

interface ViewabilityInfo {
  viewableItems: ViewToken[];
  changed: ViewToken[];
}

const onViewableItemsChanged = useRef(({ viewableItems }: ViewabilityInfo) => {
  viewableItems.forEach((item) => {
    const dream = item.item as DreamAnalysis | undefined;
    if (dream?.id) {
      newVisibleIds.add(dream.id);
    }
  });
}).current;
```

---

### T2: Non-null Assertion

**File:** `hooks/useDreamJournal.ts` line 284

```tsx
// BEFORE
const saved = await createDreamInSupabase(dream, user!.id);

// AFTER
if (!user?.id) {
  throw new Error('User must be authenticated to sync dreams');
}
const saved = await createDreamInSupabase(dream, user.id);
```

---

## Architecture Issues

### A1: Recording Screen Refactoring

**Current:** 1332 lines in single file

**Proposed structure:**
```
app/
  recording.tsx                 # Orchestrator (~150 lines)
  
components/recording/
  RecordingView.tsx            # Main recording UI
  RecordingBottomSheets.tsx    # All bottom sheets
  TranscriptDisplay.tsx        # Live transcript
  InputModeToggle.tsx          # Voice/text toggle
  
hooks/
  useRecordingSession.ts       # Audio/speech logic
  useDreamSaving.ts            # Persistence
  useTranscriptManagement.ts   # Transcript state
```

**Example extraction - useRecordingSession.ts:**
```tsx
import { useCallback, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useAudioRecorder, setAudioModeAsync, AudioModule } from 'expo-audio';
import { startNativeSpeechSession, type NativeSpeechSession } from '@/services/nativeSpeechRecognition';

const RECORDING_OPTIONS = { /* ... */ };

export function useRecordingSession(transcriptionLocale: string) {
  const [isRecording, setIsRecording] = useState(false);
  const audioRecorder = useAudioRecorder(RECORDING_OPTIONS);
  const nativeSessionRef = useRef<NativeSpeechSession | null>(null);
  const isRecordingRef = useRef(false);

  const startRecording = useCallback(async (
    onPartial: (text: string) => void
  ) => {
    const { granted } = await AudioModule.requestRecordingPermissionsAsync();
    if (!granted) return { success: false, error: 'permission_denied' };

    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    
    nativeSessionRef.current = await startNativeSpeechSession(transcriptionLocale, {
      onPartial,
    });

    if (!nativeSessionRef.current && Platform.OS !== 'web') {
      await audioRecorder.prepareToRecordAsync(RECORDING_OPTIONS);
      audioRecorder.record();
    }

    setIsRecording(true);
    isRecordingRef.current = true;
    return { success: true };
  }, [audioRecorder, transcriptionLocale]);

  const stopRecording = useCallback(async () => {
    setIsRecording(false);
    isRecordingRef.current = false;

    const nativeResult = await nativeSessionRef.current?.stop();
    nativeSessionRef.current = null;

    if (audioRecorder.isRecording) {
      await audioRecorder.stop();
    }

    await setAudioModeAsync({ allowsRecording: false });

    return {
      transcript: nativeResult?.transcript ?? '',
      recordedUri: nativeResult?.recordedUri ?? audioRecorder.uri,
    };
  }, [audioRecorder]);

  return {
    isRecording,
    startRecording,
    stopRecording,
    audioRecorderUri: audioRecorder.uri,
  };
}
```

---

## Accessibility Issues

### ACC1: MicButton Enhancement

**File:** `components/recording/MicButton.tsx`

```tsx
// BEFORE
<Pressable
  onPress={onPress}
  accessibilityRole="button"
  accessibilityLabel={accessibilityLabel ?? (isRecording ? t('recording.mic.stop') : t('recording.mic.start'))}
>

// AFTER
<Pressable
  onPress={onPress}
  disabled={disabled}
  accessibilityRole="button"
  accessibilityLabel={accessibilityLabel ?? (isRecording ? t('recording.mic.stop') : t('recording.mic.start'))}
  accessibilityState={{
    disabled: disabled ?? false,
    busy: isRecording,
  }}
  accessibilityHint={
    isRecording 
      ? t('recording.mic.stop_hint', { defaultValue: 'Double tap to stop recording' })
      : t('recording.mic.start_hint', { defaultValue: 'Double tap to start voice recording' })
  }
>
  {/* Icon should be hidden from accessibility */}
  <Ionicons
    name={isRecording ? 'stop' : 'mic'}
    size={104}
    color={colors.textPrimary}
    importantForAccessibility="no-hide-descendants"
  />
</Pressable>
```

---

## i18n Issues

### I18N1: Error Messages

**File:** `lib/errors.ts`

```tsx
// Create a translation-aware version
export function classifyErrorWithTranslation(
  error: Error, 
  t: (key: string, params?: Record<string, unknown>) => string
): ClassifiedError {
  const message = error.message.toLowerCase();

  if (message.includes('network') || message.includes('fetch failed')) {
    return {
      type: ErrorType.NETWORK,
      message: error.message,
      originalError: error,
      userMessage: t('error.network'),
      canRetry: true,
    };
  }

  if (message.includes('timeout') || message.includes('aborted')) {
    return {
      type: ErrorType.TIMEOUT,
      message: error.message,
      originalError: error,
      userMessage: t('error.timeout'),
      canRetry: true,
    };
  }

  // ... etc
}

// Add to i18n translations
// lib/i18n.ts
const translations = {
  en: {
    error: {
      network: 'No internet connection. Please check your network and try again.',
      timeout: 'Request timed out. Please try again.',
      server: 'Server error. Please try again in a few moments.',
      rate_limit: 'Too many requests. Please wait a moment.',
      unknown: 'An unexpected error occurred: {{message}}',
    },
  },
  fr: {
    error: {
      network: 'Pas de connexion internet. Vérifiez votre réseau.',
      timeout: 'Délai dépassé. Veuillez réessayer.',
      // ...
    },
  },
};
```

---

## Constants Consolidation

**Create:** `constants/appConfig.ts`

```tsx
export const SPLASH_ANIMATION = {
  OUTRO_DELAY_MS: 2800,
  FADE_DURATION_MS: 300,
} as const;

export const RECORDING = {
  MAX_TRANSCRIPT_CHARS: 600,
  END_TIMEOUT_MS: 4000,
} as const;

export const JOURNAL_LIST = {
  ESTIMATED_ITEM_HEIGHT: 140,
  INITIAL_VISIBLE_COUNT: 5,
  PRELOAD_BUFFER: 2,
  DESKTOP_INITIAL_COUNT: 12,
} as const;

export const QUOTA_LIMITS = {
  GUEST_ANALYSIS: 2,
  FREE_ANALYSIS: 5,
  GUEST_EXPLORATION: 2,
  FREE_EXPLORATION: 5,
  MESSAGE_PER_DREAM: 20,
} as const;

export const TIMEOUTS = {
  HTTP_DEFAULT_MS: 30000,
  IMAGE_GENERATION_MS: 60000,
  RETRY_DELAY_MS: 2000,
} as const;
```

---

## Dead Code Removal

### D1: guestLimitReached

**File:** `hooks/useDreamJournal.ts` line 618

```tsx
// REMOVE THIS
const guestLimitReached = false;

// UPDATE return statement
return {
  dreams,
  loaded,
  // guestLimitReached, // REMOVE
  addDream,
  updateDream,
  deleteDream,
  toggleFavorite,
  analyzeDream,
};
```

**Also update:** `context/DreamsContext.tsx` type definition
