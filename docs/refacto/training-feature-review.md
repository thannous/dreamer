<analysis>
Recording/analysis flow is feature-rich but the critical path mixes audio capture, STT fallback, and AI analysis in ways that can produce incomplete results or silent failures. The recording screen is also very large and hard to evolve. Accessibility on the analysis progress UI is missing. Addressing the items below will make the recording feature more reliable and testable.
</analysis>
<issues>
<issue>
<severity>[High]</severity>
<category>[Architecture]</category>
<location>[hooks/useDreamJournal.ts:538-634]</location>
<description>Analysis resolves after the first promise via `Promise.race`, so the UI marks analysis complete while either the text or image generation is still running. Callers navigate immediately, receiving partially filled dreams and multiple Supabase writes.</description>
<current_code>
const textPromise = (async () =&gt; { ... })();
const imagePromise = (async () =&gt; { ... })();
await Promise.race([textPromise, imagePromise]);
return currentDreamState;
</current_code>
<recommended_fix>
Replace `Promise.race` with `Promise.allSettled` (or `Promise.all` if you want to fail fast on text errors) and only mark `analysisStatus` done once text is present. Batch the final write to avoid double updates:
```ts
const [textResult, imageResult] = await Promise.allSettled([textPromise(), imagePromise()]);

if (textResult.status !== 'fulfilled') {
  await updateDream({ ...currentDreamState, analysisStatus: 'failed' });
  throw textResult.reason;
}

const next: DreamAnalysis = {
  ...currentDreamState,
  ...textResult.value,
  ...(imageResult.status === 'fulfilled'
    ? { imageUrl: imageResult.value, imageGenerationFailed: false }
    : { imageGenerationFailed: true }),
  analysisStatus: 'done',
  analyzedAt: Date.now(),
  isAnalyzed: true,
};
await updateDream(next);
return next;
```
</recommended_fix>
<explanation>Racing returns before both operations finish, so the progress bar reports “complete” while analysis is still running and the caller receives stale data. Waiting for both promises and performing a single terminal write keeps UI state consistent and reduces unnecessary Supabase writes.</explanation>
</issue>
<issue>
<severity>[High]</severity>
<category>[Performance]</category>
<location>[app/recording.tsx:365-412]</location>
<description>`skipRecorderRef` disables the Expo Audio recorder whenever a native speech session exists, even on platforms where `expo-speech-recognition` cannot persist audio. When native STT returns an empty transcript and no `recordedUri`, the Google STT fallback never runs and the user loses the recording.</description>
<current_code>
nativeSessionRef.current = await startNativeSpeechSession(...);
// On web we keep the recorder running ...
skipRecorderRef.current = Platform.OS !== 'web' && Boolean(nativeSessionRef.current);
if (!skipRecorderRef.current) {
  await audioRecorder.prepareToRecordAsync(RECORDING_OPTIONS);
  audioRecorder.record();
}
</current_code>
<recommended_fix>
Expose whether the native session can persist audio and only skip the backup recorder when that flag is true:
```ts
// services/nativeSpeechRecognition.ts
export type NativeSpeechSession = {
  stop: () => Promise<{ transcript: string; error?: string; recordedUri?: string | null; hasRecording?: boolean }>;
  abort: () => void;
  hasRecording?: boolean;
};
// ... inside startNativeSpeechSession
const supportsRecording = speechModule.supportsRecording?.() ?? false;
speechModule.start({ ..., recordingOptions: supportsRecording ? { persist: true, ... } : undefined });
return { stop, abort, hasRecording: supportsRecording };

// app/recording.tsx
nativeSessionRef.current = await startNativeSpeechSession(...);
const canPersistAudio = nativeSessionRef.current?.hasRecording === true;
skipRecorderRef.current = Platform.OS !== 'web' && Boolean(nativeSessionRef.current) && canPersistAudio;
if (!skipRecorderRef.current) { await audioRecorder.prepareToRecordAsync(RECORDING_OPTIONS); audioRecorder.record(); }
```
</recommended_fix>
<explanation>Expo’s docs note only one recorder should run between prepare/stop, but skipping the recorder without a persisted URI removes the only fallback when native STT yields no text. Keeping the recorder running unless the native module guarantees a saved file preserves reliability across iOS/Android.</explanation>
</issue>
<issue>
<severity>[Medium]</severity>
<category>[Performance]</category>
<location>[app/recording.tsx:531-537]</location>
<description>`toggleRecording` bases the next action on `isRecording` state, which flips only after the async start/stop pipeline finishes. Rapid taps can enqueue multiple `startRecording` calls (Expo Audio allows only one recorder between prepare/stop), producing “shared object already released” errors and stuck audio modes.</description>
<current_code>
const toggleRecording = useCallback(async () => {
  if (isRecording) {
    await stopRecording();
  } else {
    await startRecording();
  }
}, [isRecording, stopRecording, startRecording]);
</current_code>
<recommended_fix>
Guard the transition with a ref so concurrent taps are ignored until the previous action settles:
```ts
const recordingTransitionRef = useRef(false);
const toggleRecording = useCallback(async () => {
  if (recordingTransitionRef.current) return;
  recordingTransitionRef.current = true;
  try {
    if (isRecordingRef.current) {
      await stopRecording();
    } else {
      await startRecording();
    }
  } finally {
    recordingTransitionRef.current = false;
  }
}, [startRecording, stopRecording]);
```
</recommended_fix>
<explanation>Expo Audio warns that only one recorder can exist between prepare/stop. Preventing overlapping calls avoids the “already released” errors seen in production and keeps `setAudioModeAsync` in a consistent state.</explanation>
</issue>
<issue>
<severity>[Medium]</severity>
<category>[Accessibility]</category>
<location>[components/analysis/AnalysisProgress.tsx:18-67]</location>
<description>The analysis progress UI renders only visual progress; there is no `accessibilityRole` or `accessibilityValue`, so screen readers cannot convey progress or errors to blind users.</description>
<current_code>
<View style={[styles.container, { backgroundColor: colors.backgroundSecondary }]}>
  {!showError && (
    <View style={styles.progressBarContainer}>
      <View style={[styles.progressBarBackground, { backgroundColor: colors.backgroundDark }]}>
        <Animated.View style={[styles.progressBarFill, { backgroundColor: colors.accent, width: `${progress}%` }]} />
      </View>
      <Text style={[styles.progressText, { color: colors.textPrimary }]}>{Math.round(progress)}%</Text>
    </View>
  )}
  ...
</View>
</current_code>
<recommended_fix>
Expose semantic progress and live updates:
```tsx
<View
  style={[styles.container, { backgroundColor: colors.backgroundSecondary }]}
  accessibilityRole="progressbar"
  accessibilityValue={{ min: 0, max: 100, now: Math.round(progress) }}
  accessibilityLiveRegion="polite"
  accessibilityLabel={showError ? t('analysis.step.error') : t('analysis.step.analyzing')}
>
  {/* existing bar */}
</View>
```
</recommended_fix>
<explanation>Providing a progress role and value lets TalkBack/VoiceOver announce analysis state changes, meeting basic WCAG expectations for status feedback.</explanation>
</issue>
<issue>
<severity>[Low]</severity>
<category>[Code Smell]</category>
<location>[app/recording.tsx (≈1400 lines)]</location>
<description>The recording screen mixes UI, permission prompts, STT orchestration, quota gating, navigation, and bottom sheets in a single 1400-line component, making it hard to test or swap implementations (e.g., different STT providers).</description>
<current_code>
// Single component handles: permission requests, native STT, Google fallback,
// quota checks, navigation, and all UI for sheets/buttons/progress.
</current_code>
<recommended_fix>
Extract responsibilities into focused hooks and components, e.g.:
```ts
// hooks/useRecordingController.ts
export function useRecordingController(...) { /* start/stop, fallback STT */ }
// hooks/useAnalysisFlow.ts
export function useAnalysisFlow(...) { /* quota + analyzeDream orchestration */ }
// components/RecordingComposer.tsx
// components/RecordingSheets.tsx
```
Then keep `app/recording.tsx` to layout/orchestration only. This also unlocks unit tests around the controller hooks.
</recommended_fix>
<explanation>Separation of concerns reduces regressions in the critical training flow, improves readability, and enables unit tests for recording/analysis without rendering the full screen.</explanation>
</issue>
</issues>
<recommendations>
- Collapse duplicate network writes during analysis by batching updates and using `Promise.allSettled` for text/image.
- Keep a guaranteed fallback audio file whenever native STT cannot persist recordings; rely on Expo Audio’s recorder unless `supportsRecording` is true.
- Add guarded state transitions for recording start/stop and cover them with Vitest integration tests around the new hooks.
- Bring accessibility to all status widgets (`AnalysisProgress`, bottom sheets) with roles/labels/values so the training flow is screen-reader friendly.
- Plan a refactor of `app/recording.tsx` into controller hooks + presentational components to lower churn and make quota/STT logic reusable.
</recommendations>
