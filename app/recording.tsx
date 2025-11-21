import { AnalysisProgress } from '@/components/analysis/AnalysisProgress';
import { MicButton } from '@/components/recording/MicButton';
import { Waveform } from '@/components/recording/Waveform';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { GradientColors } from '@/constants/gradients';
import { ThemeLayout } from '@/constants/journalTheme';
import { GUEST_DREAM_LIMIT } from '@/constants/limits';
import { Fonts } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useDreams } from '@/context/DreamsContext';
import { useLanguage } from '@/context/LanguageContext';
import { useTheme } from '@/context/ThemeContext';
import { AnalysisStep, useAnalysisProgress } from '@/hooks/useAnalysisProgress';
import { useQuota } from '@/hooks/useQuota';
import { useTranslation } from '@/hooks/useTranslation';
import { classifyError, QuotaError } from '@/lib/errors';
import { TID } from '@/lib/testIDs';
import type { DreamAnalysis } from '@/lib/types';
import { categorizeDream } from '@/services/geminiService';
import { startNativeSpeechSession, type NativeSpeechSession } from '@/services/nativeSpeechRecognition';
import { transcribeAudio } from '@/services/speechToText';
import {
  AudioModule,
  AudioQuality,
  IOSOutputFormat,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  type RecordingOptions,
} from 'expo-audio';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const MAX_TRANSCRIPT_CHARS = 600;

const RECORDING_OPTIONS: RecordingOptions = {
  ...RecordingPresets.HIGH_QUALITY,
  isMeteringEnabled: false,
  extension: '.caf',
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 64000,
  android: {
    ...RecordingPresets.HIGH_QUALITY.android,
    extension: '.amr',
    outputFormat: 'amrwb',
    audioEncoder: 'amr_wb',
    sampleRate: 16000,
  },
  ios: {
    ...RecordingPresets.HIGH_QUALITY.ios,
    extension: '.caf',
    outputFormat: IOSOutputFormat.LINEARPCM,
    audioQuality: AudioQuality.MEDIUM,
    sampleRate: 16000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: 'audio/webm',
    bitsPerSecond: 64000,
  },
};

const RECORDER_RELEASE_ERROR_SNIPPET = 'shared object that was already released';

const isRecorderReleasedError = (error: unknown): error is Error => {
  return (
    error instanceof Error &&
    typeof error.message === 'string' &&
    error.message.toLowerCase().includes(RECORDER_RELEASE_ERROR_SNIPPET)
  );
};

const handleRecorderReleaseError = (context: string, error: unknown): boolean => {
  if (isRecorderReleasedError(error)) {
    if (__DEV__) {
      console.warn(`[Recording] AudioRecorder already released during ${context}.`, error);
    }
    return true;
  }
  return false;
};

export default function RecordingScreen() {
  const { addDream, dreams, analyzeDream } = useDreams();
  const { colors, shadows, mode } = useTheme();
  const insets = useSafeAreaInsets();
  const [transcript, setTranscript] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [draftDream, setDraftDream] = useState<DreamAnalysis | null>(null);
  const [firstDreamPrompt, setFirstDreamPrompt] = useState<DreamAnalysis | null>(null);
  const [analyzePromptDream, setAnalyzePromptDream] = useState<DreamAnalysis | null>(null);
  const [pendingAnalysisDream, setPendingAnalysisDream] = useState<DreamAnalysis | null>(null);
  const [isPersisting, setIsPersisting] = useState(false);
  const [showGuestLimitSheet, setShowGuestLimitSheet] = useState(false);
  const [pendingGuestLimitDream, setPendingGuestLimitDream] = useState<DreamAnalysis | null>(null);
  const audioRecorder = useAudioRecorder(RECORDING_OPTIONS);
  const skipRecorderRef = useRef(false);
  const nativeSessionRef = useRef<NativeSpeechSession | null>(null);
  const baseTranscriptRef = useRef('');
  const [transcriptionSource, setTranscriptionSource] = useState<'idle' | 'native' | 'google' | 'manual'>('idle');
  const [lengthWarning, setLengthWarning] = useState('');
  const analysisProgress = useAnalysisProgress();
  const hasAutoStoppedRecordingRef = useRef(false);
  const { language } = useLanguage();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { canAnalyzeNow } = useQuota();
  const trimmedTranscript = useMemo(() => transcript.trim(), [transcript]);
  const isAnalyzing = analysisProgress.step !== AnalysisStep.IDLE && analysisProgress.step !== AnalysisStep.COMPLETE;
  const interactionDisabled = isPersisting || isAnalyzing;
  const lengthLimitMessage = useCallback(
    () => t('recording.alert.length_limit', { limit: MAX_TRANSCRIPT_CHARS }) || `Limite ${MAX_TRANSCRIPT_CHARS} caractères atteinte`,
    [t]
  );
  const clampTranscript = useCallback((text: string) => {
    if (text.length <= MAX_TRANSCRIPT_CHARS) {
      return { text, truncated: false };
    }
    return { text: text.slice(0, MAX_TRANSCRIPT_CHARS), truncated: true };
  }, []);
  const combineTranscript = useCallback(
    (base: string, addition: string) => {
      if (!addition.trim()) {
        return clampTranscript(base);
      }
      const combined = base ? `${base}\n${addition}` : addition;
      return clampTranscript(combined);
    },
    [clampTranscript]
  );

  const transcriptionLocale = useMemo(() => {
    switch (language) {
      case 'fr':
        return 'fr-FR';
      case 'es':
        return 'es-ES';
      default:
        return 'en-US';
    }
  }, [language]);

  const handleTranscriptChange = useCallback(
    (text: string) => {
      const { text: clamped, truncated } = clampTranscript(text);
      setTranscript(clamped);
      baseTranscriptRef.current = clamped;
      setTranscriptionSource('manual');
      setLengthWarning(truncated ? lengthLimitMessage() : '');
    },
    [clampTranscript, lengthLimitMessage]
  );

  // Request microphone permissions on mount
  useEffect(() => {
    (async () => {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      if (!status.granted) {
        Alert.alert(
          t('recording.alert.permission_required.title'),
          t('recording.alert.permission_required.message')
        );
      }
    })();
  }, [t]);

  useEffect(() => {
    return () => {
      nativeSessionRef.current?.abort();
      nativeSessionRef.current = null;
      baseTranscriptRef.current = '';
    };
  }, []);

  const deriveDraftTitle = useCallback(() => {
    if (!trimmedTranscript) {
      return t('recording.draft.default_title');
    }
    const firstLine = trimmedTranscript.split('\n')[0]?.trim() ?? '';
    if (!firstLine) {
      return t('recording.draft.default_title');
    }
    return firstLine.length > 64 ? `${firstLine.slice(0, 64)}…` : firstLine;
  }, [trimmedTranscript, t]);

  const buildDraftDream = useCallback((): DreamAnalysis => {
    const title = deriveDraftTitle();
    return {
      id: Date.now(),
      transcript: trimmedTranscript,
      title,
      interpretation: '',
      shareableQuote: '',
      theme: undefined,
      dreamType: 'Symbolic Dream',
      imageUrl: '',
      thumbnailUrl: undefined,
      chatHistory: trimmedTranscript
        ? [{ role: 'user', text: `Here is my dream: ${trimmedTranscript}` }]
        : [],
      isFavorite: false,
      imageGenerationFailed: false,
      isAnalyzed: false,
      analysisStatus: 'none',
    };
  }, [deriveDraftTitle, trimmedTranscript]);

  const ensureDraftSaved = useCallback(async () => {
    if (draftDream && draftDream.transcript === trimmedTranscript) {
      return draftDream;
    }
    const draft = buildDraftDream();
    const saved = await addDream(draft);
    setDraftDream(saved);
    return saved;
  }, [draftDream, trimmedTranscript, buildDraftDream, addDream]);

  const resetComposer = useCallback(() => {
    setTranscript('');
    setDraftDream(null);
    analysisProgress.reset();
    setTranscriptionSource('idle');
    setLengthWarning('');
    baseTranscriptRef.current = '';
  }, [analysisProgress]);

  const navigateAfterSave = useCallback(
    (savedDream: DreamAnalysis, previousDreamCount: number, options?: { skipFirstDreamSheet?: boolean }) => {
      if (options?.skipFirstDreamSheet) {
        router.replace(`/journal/${savedDream.id}`);
        return;
      }

      if (previousDreamCount === 0) {
        setFirstDreamPrompt(savedDream);
        return;
      }

      setAnalyzePromptDream(savedDream);
    },
    []
  );

  useEffect(() => {
    if (!user || !pendingGuestLimitDream) {
      return;
    }

    let cancelled = false;

    const persistPendingGuestDream = async () => {
      try {
        setIsPersisting(true);
        const preCount = dreams.length;
        const savedDream = await addDream(pendingGuestLimitDream);
        if (cancelled) {
          return;
        }
        resetComposer();
        setPendingGuestLimitDream(null);
        navigateAfterSave(savedDream, preCount, { skipFirstDreamSheet: true });
      } catch (error) {
        if (cancelled) {
          return;
        }
        const message =
          error instanceof Error ? error.message : 'Unexpected error occurred. Please try again.';
        Alert.alert(t('common.error_title'), message);
      } finally {
        if (!cancelled) {
          setIsPersisting(false);
        }
      }
    };

    void persistPendingGuestDream();

    return () => {
      cancelled = true;
    };
  }, [user, pendingGuestLimitDream, addDream, dreams.length, navigateAfterSave, resetComposer, t]);

  const startRecording = useCallback(async () => {
    try {
      const { granted } = await AudioModule.requestRecordingPermissionsAsync();
      if (!granted) {
        Alert.alert(
          t('recording.alert.permission_required.title'),
          t('recording.alert.permission_required.message')
        );
        return;
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      nativeSessionRef.current?.abort();
      baseTranscriptRef.current = transcript;
      nativeSessionRef.current = await startNativeSpeechSession(transcriptionLocale, {
        onPartial: (text) => {
          const { text: combined, truncated } = combineTranscript(baseTranscriptRef.current, text);
          setTranscript(combined);
          setLengthWarning(truncated ? lengthLimitMessage() : '');
          if (truncated) {
            void stopRecording();
          }
        },
      });
      skipRecorderRef.current = Boolean(nativeSessionRef.current);
      if (!nativeSessionRef.current && __DEV__ && Platform.OS === 'web') {
        console.warn('[Recording] web: native session missing; check browser SpeechRecognition support/https');
      }
      setTranscriptionSource(nativeSessionRef.current ? 'native' : 'manual');
      if (__DEV__) {
        console.log('[Recording] native session', {
          hasSession: Boolean(nativeSessionRef.current),
          locale: transcriptionLocale,
        });
      }

      hasAutoStoppedRecordingRef.current = false;
      if (!skipRecorderRef.current) {
        await audioRecorder.prepareToRecordAsync(RECORDING_OPTIONS);
        audioRecorder.record();
      } else if (__DEV__) {
        console.log('[Recording] skipping audioRecorder because native session active');
      }

      setIsRecording(true);
    } catch (err) {
      nativeSessionRef.current?.abort();
      nativeSessionRef.current = null;
      skipRecorderRef.current = false;
      if (__DEV__) {
        console.error('Failed to start recording:', err);
      }
      Alert.alert(t('common.error_title'), t('recording.alert.start_failed'));
    }
  }, [audioRecorder, t, transcriptionLocale, transcript, combineTranscript]);

  const stopRecording = useCallback(async () => {
    let nativeSession: NativeSpeechSession | null = null;
    let nativeResultPromise: Promise<{ transcript: string; error?: string; recordedUri?: string | null }> | null = null;
    let nativeError: string | undefined;
    try {
      setIsRecording(false);
      nativeSession = nativeSessionRef.current;
      nativeSessionRef.current = null;
      const usedRecorder = !skipRecorderRef.current;

      nativeResultPromise = nativeSession?.stop();
      if (usedRecorder) {
        await audioRecorder.stop();
      }
      const uri = usedRecorder ? audioRecorder.uri ?? undefined : undefined;

      let transcriptText = '';
      let recordedUri: string | undefined;
      if (nativeResultPromise) {
        try {
          const nativeResult = await nativeResultPromise;
          if (__DEV__) {
            console.log('[Recording] native result', nativeResult);
          }
          transcriptText = nativeResult.transcript?.trim() ?? '';
          recordedUri = nativeResult.recordedUri ?? undefined;
          if (!transcriptText && nativeResult.error && __DEV__) {
            console.warn('[Recording] Native STT returned empty result', nativeResult.error);
          }
          nativeError = nativeResult.error;
        } catch (error) {
          if (__DEV__) {
            console.warn('[Recording] Native STT failed', error);
          }
        }
      } else if (__DEV__) {
        console.log('[Recording] no native session, will rely on backup', { uriPresent: Boolean(uri) });
      }

      const shouldFallbackToGoogle =
        !transcriptText &&
        (uri || recordedUri) &&
        !(nativeError && nativeError.toLowerCase().includes('no speech'));

      if (shouldFallbackToGoogle) {
        try {
          const fallbackUri = uri ?? recordedUri;
          if (__DEV__) {
            console.log('[Recording] fallback to Google STT', {
              locale: transcriptionLocale,
              uriLength: fallbackUri?.length ?? 0,
            });
          }
          transcriptText = await transcribeAudio({
            uri: fallbackUri!,
            languageCode: transcriptionLocale,
          });
          setTranscriptionSource('google');
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Unknown transcription error';
          Alert.alert(t('recording.alert.transcription_failed.title'), msg);
        }
      } else if (!transcriptText && !uri) {
        Alert.alert(
          t('recording.alert.recording_invalid.title'),
          t('recording.alert.recording_invalid.message')
        );
        return;
      }

      if (transcriptText) {
        const { text: combined, truncated } = combineTranscript(baseTranscriptRef.current, transcriptText);
        baseTranscriptRef.current = combined;
        setLengthWarning(truncated ? lengthLimitMessage() : '');
        setTranscript((prev) => (prev.trim() === combined.trim() ? prev : combined));
      } else {
        Alert.alert(
          t('recording.alert.no_speech.title'),
          t('recording.alert.no_speech.message')
        );
      }
    } catch (err) {
      if (handleRecorderReleaseError('stopRecording', err)) {
        return;
      }
      nativeSession?.abort();
      if (__DEV__) {
        console.error('Failed to stop recording:', err);
      }
      Alert.alert(t('common.error_title'), t('recording.alert.stop_failed'));
    } finally {
      try {
        await setAudioModeAsync({ allowsRecording: false });
      } catch (err) {
        if (__DEV__) {
          console.warn('Failed to reset audio mode after recording:', err);
        }
      }
      hasAutoStoppedRecordingRef.current = false;
      skipRecorderRef.current = false;
    }
  }, [audioRecorder, transcriptionLocale, t, combineTranscript]);

  const toggleRecording = useCallback(async () => {
    if (isRecording) {
      await stopRecording();
    } else {
      await startRecording();
    }
  }, [isRecording, stopRecording, startRecording]);

  useEffect(() => {
    hasAutoStoppedRecordingRef.current = false;

    const subscription = AppState.addEventListener('change', (state) => {
      try {
        if ((state === 'background' || state === 'inactive') && audioRecorder.isRecording && !hasAutoStoppedRecordingRef.current) {
          hasAutoStoppedRecordingRef.current = true;
          void stopRecording();
        }
      } catch (error) {
        handleRecorderReleaseError('appStateChange', error);
      }
    });

    return () => {
      subscription.remove();
      try {
        if (audioRecorder.isRecording && !hasAutoStoppedRecordingRef.current) {
          hasAutoStoppedRecordingRef.current = true;
          void stopRecording();
        }
      } catch (error) {
        if (!handleRecorderReleaseError('appStateCleanup', error)) {
          throw error;
        }
      }
    };
  }, [audioRecorder, stopRecording]);

  const handleSaveDream = useCallback(async () => {
    if (!trimmedTranscript) {
      Alert.alert(t('recording.alert.empty.title'), t('recording.alert.empty.message'));
      return;
    }

    if (!user && dreams.length >= GUEST_DREAM_LIMIT - 1) {
      const draft =
        draftDream && draftDream.transcript === trimmedTranscript
          ? draftDream
          : buildDraftDream();
      setPendingGuestLimitDream(draft);
      setShowGuestLimitSheet(true);
      return;
    }

    setIsPersisting(true);
    try {
      const preCount = dreams.length;

      // Prepare the dream object
      let dreamToSave = draftDream && draftDream.transcript === trimmedTranscript
        ? draftDream
        : buildDraftDream();

      // Attempt quick categorization if we have a transcript
      if (trimmedTranscript) {
        try {
          const metadata = await categorizeDream(trimmedTranscript);
          dreamToSave = {
            ...dreamToSave,
            ...metadata,
          };
        } catch (err) {
          // Silently fail and proceed with default/derived values
          if (__DEV__) {
            console.warn('[Recording] Quick categorization failed:', err);
          }
        }
      }

      const savedDream = await addDream(dreamToSave);
      setDraftDream(savedDream);

      resetComposer();
      navigateAfterSave(savedDream, preCount);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected error occurred. Please try again.';
      Alert.alert(t('common.error_title'), message);
    } finally {
      setIsPersisting(false);
    }
  }, [
    trimmedTranscript,
    dreams.length,
    draftDream,
    buildDraftDream,
    ensureDraftSaved,
    navigateAfterSave,
    resetComposer,
    t,
    user,
  ]);


  const handleGoToJournal = useCallback(() => {
    router.push('/(tabs)/journal');
  }, []);

  const handleFirstDreamDismiss = useCallback(() => {
    if (!firstDreamPrompt) {
      return;
    }
    setFirstDreamPrompt(null);
    setPendingAnalysisDream(null);
  }, [firstDreamPrompt]);

  const handleFirstDreamJournal = useCallback(() => {
    if (!firstDreamPrompt) {
      return;
    }
    setFirstDreamPrompt(null);
    setPendingAnalysisDream(null);
    router.push('/(tabs)/journal');
  }, [firstDreamPrompt]);

  const handleAnalyzePromptDismiss = useCallback(() => {
    if (!analyzePromptDream) {
      return;
    }
    setAnalyzePromptDream(null);
    setPendingAnalysisDream(null);
  }, [analyzePromptDream]);

  const handleAnalyzePromptJournal = useCallback(() => {
    if (!analyzePromptDream) {
      return;
    }
    setAnalyzePromptDream(null);
    setPendingAnalysisDream(null);
    router.push('/(tabs)/journal');
  }, [analyzePromptDream]);

  const handleFirstDreamAnalyze = useCallback(async () => {
    const dream = firstDreamPrompt ?? analyzePromptDream ?? pendingAnalysisDream;
    if (!dream) {
      return;
    }
    if (!canAnalyzeNow) {
      const tier = user ? 'free' : 'guest';
      const limit = tier === 'guest' ? 2 : 5;
      const title = tier === 'guest'
        ? t('recording.alert.analysis_limit.title_guest')
        : t('recording.alert.analysis_limit.title_free');
      const message = tier === 'guest'
        ? t('recording.alert.analysis_limit.message_guest', { limit })
        : t('recording.alert.analysis_limit.message_free', { limit });

      Alert.alert(
        title,
        message,
        [
          {
            text: t('recording.alert.limit.cta'),
            onPress: () => router.push('/(tabs)/settings'),
          },
          { text: t('common.cancel'), style: 'cancel' },
        ]
      );
      return;
    }

    if (firstDreamPrompt) {
      setFirstDreamPrompt(null);
    }
    if (analyzePromptDream) {
      setAnalyzePromptDream(null);
    }
    setPendingAnalysisDream(dream);

    setIsPersisting(true);
    const preCount = dreams.length;
    try {
      analysisProgress.reset();
      analysisProgress.setStep(AnalysisStep.ANALYZING);

      const analyzedDream = await analyzeDream(dream.id, dream.transcript);

      analysisProgress.setStep(AnalysisStep.COMPLETE);
      setPendingAnalysisDream(null);
      resetComposer();
      await new Promise((resolve) => setTimeout(resolve, 300));
      navigateAfterSave(analyzedDream, preCount, { skipFirstDreamSheet: true });
    } catch (error) {
      if (error instanceof QuotaError) {
        const title = error.tier === 'guest'
          ? t('recording.alert.analysis_limit.title_guest')
          : t('recording.alert.analysis_limit.title_free');
        Alert.alert(
          title,
          error.userMessage,
          [
            {
              text: t('recording.alert.limit.cta'),
              onPress: () => router.push('/(tabs)/settings'),
            },
            { text: t('common.cancel'), style: 'cancel' },
          ]
        );
        analysisProgress.reset();
      } else {
        const classified = classifyError(error as Error);
        analysisProgress.setError(classified);
      }
    } finally {
      setIsPersisting(false);
    }
  }, [
    analysisProgress,
    analyzeDream,
    analyzePromptDream,
    canAnalyzeNow,
    dreams.length,
    firstDreamPrompt,
    pendingAnalysisDream,
    navigateAfterSave,
    resetComposer,
    t,
    user,
  ]);

  const gradientColors = mode === 'dark'
    ? GradientColors.surreal
    : ([colors.backgroundSecondary, colors.backgroundDark] as readonly [string, string]);

  return (
    <>
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            testID={TID.Screen.Recording}
          >
            {/* Main Content */}
            <View style={styles.mainContent}>
              <View style={styles.recordingSection}>
                <Text style={[styles.instructionText, { color: colors.textSecondary }]}>
                  {t('recording.instructions')}
                </Text>
                <Text style={[styles.serviceBadge, { color: colors.textSecondary }]}>
                  {transcriptionSource === 'native' && 'Source: Reconnaissance native (temps réel)'}
                  {transcriptionSource === 'google' && 'Source: Secours Google (après enregistrement)'}
                  {transcriptionSource === 'manual' && 'Source: Saisie manuelle'}
                  {transcriptionSource === 'idle' && 'Source: Aucune transcription en cours'}
                </Text>

                <MicButton
                  isRecording={isRecording}
                  onPress={toggleRecording}
                  disabled={interactionDisabled}
                  testID={TID.Button.RecordToggle}
                />

                <Waveform isActive={isRecording} />
              </View>

              {/* Text Input */}
              <View style={styles.textInputSection}>
                <TextInput
                  value={transcript}
                  onChangeText={handleTranscriptChange}
                  placeholder={t('recording.placeholder')}
                  placeholderTextColor={colors.textSecondary}
                  style={[
                    styles.textInput,
                    shadows.md,
                    {
                      backgroundColor: colors.backgroundSecondary,
                      color: colors.textPrimary,
                    },
                  ]}
                  multiline
                  editable={!interactionDisabled}
                  testID={TID.Input.DreamTranscript}
                  accessibilityLabel={t('recording.placeholder.accessibility')}
                />
                {lengthWarning ? (
                  <Text style={[styles.lengthWarning, { color: colors.accent }]}>
                    {lengthWarning}
                  </Text>
                ) : null}
                {/* Analysis Progress */}
                {analysisProgress.step !== AnalysisStep.IDLE && analysisProgress.step !== AnalysisStep.COMPLETE && (
                  <AnalysisProgress
                    step={analysisProgress.step}
                    progress={analysisProgress.progress}
                    message={analysisProgress.message}
                    error={analysisProgress.error}
                    onRetry={pendingAnalysisDream ? handleFirstDreamAnalyze : undefined}
                  />
                )}

                {/* Actions */}
                <View style={styles.actionButtons}>
                  <Pressable
                    onPress={handleSaveDream}
                    disabled={!trimmedTranscript || interactionDisabled}
                    style={[
                      styles.submitButton,
                      shadows.lg,
                      { backgroundColor: colors.accent },
                      (!trimmedTranscript || interactionDisabled) && [styles.submitButtonDisabled, { backgroundColor: colors.textSecondary }],
                    ]}
                    testID={TID.Button.SaveDream}
                    accessibilityRole="button"
                    accessibilityLabel={t('recording.button.save_dream_accessibility', { defaultValue: t('recording.button.save_dream') })}
                  >
                    <Text style={styles.submitButtonText}>
                      💾 {t('recording.button.save_dream')}
                    </Text>
                  </Pressable>
                </View>

                <Pressable
                  onPress={handleGoToJournal}
                  style={styles.journalLinkButton}
                  testID={TID.Button.NavigateJournal}
                  accessibilityRole="link"
                  accessibilityLabel={t('recording.nav_button.accessibility')}
                >
                  <Text style={[styles.journalLinkText, { color: colors.accent }]}>
                    {t('recording.nav_button')}
                  </Text>
                </Pressable>
              </View>

            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
      <BottomSheet
        visible={Boolean(firstDreamPrompt)}
        onClose={handleFirstDreamDismiss}
        backdropColor={mode === 'dark' ? 'rgba(2, 0, 12, 0.75)' : 'rgba(0, 0, 0, 0.25)'}
        style={[
          styles.firstDreamSheet,
          {
            backgroundColor: colors.backgroundCard,
            paddingBottom: insets.bottom + ThemeLayout.spacing.md,
          },
          shadows.xl,
        ]}
      >
        <View style={[styles.sheetHandle, { backgroundColor: colors.divider }]} />
        <Text style={[styles.sheetTitle, { color: colors.textPrimary }]} testID={TID.Text.FirstDreamSheetTitle}>
          {t('guest.first_dream.sheet.title')}
        </Text>
        <Text style={[styles.sheetSubtitle, { color: colors.textSecondary }]}>
          {t('guest.first_dream.sheet.subtitle')}
        </Text>
        <View style={styles.sheetButtons}>
          <Pressable
            style={[
              styles.sheetPrimaryButton,
              { backgroundColor: colors.accent },
              isPersisting && styles.sheetDisabledButton,
            ]}
            onPress={handleFirstDreamAnalyze}
            disabled={isPersisting}
            testID={TID.Button.FirstDreamAnalyze}
          >
            <Text style={[styles.sheetPrimaryButtonText, { color: colors.textOnAccentSurface }]}>
              {t('guest.first_dream.sheet.analyze')}
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.sheetSecondaryButton,
              { borderColor: colors.divider, backgroundColor: colors.backgroundSecondary },
              isPersisting && styles.sheetDisabledButton,
            ]}
            onPress={handleFirstDreamJournal}
            disabled={isPersisting}
            testID={TID.Button.FirstDreamJournal}
          >
            <Text style={[styles.sheetSecondaryButtonText, { color: colors.textPrimary }]}>
              {t('guest.first_dream.sheet.journal')}
            </Text>
          </Pressable>
        </View>
        <Pressable onPress={handleFirstDreamDismiss} style={styles.sheetLinkButton} testID={TID.Button.FirstDreamDismiss}>
          <Text style={[styles.sheetLinkText, { color: colors.textSecondary }]}>
            {t('guest.first_dream.sheet.dismiss')}
          </Text>
        </Pressable>
      </BottomSheet>
      <BottomSheet
        visible={Boolean(analyzePromptDream)}
        onClose={handleAnalyzePromptDismiss}
        backdropColor={mode === 'dark' ? 'rgba(2, 0, 12, 0.75)' : 'rgba(0, 0, 0, 0.25)'}
        style={[
          styles.firstDreamSheet,
          {
            backgroundColor: colors.backgroundCard,
            paddingBottom: insets.bottom + ThemeLayout.spacing.md,
          },
          shadows.xl,
        ]}
      >
        <View style={[styles.sheetHandle, { backgroundColor: colors.divider }]} />
        <Text
          style={[styles.sheetTitle, { color: colors.textPrimary }]}
          testID={TID.Text.AnalyzePromptTitle}
        >
          {t('recording.analyze_prompt.sheet.title')}
        </Text>
        <Text style={[styles.sheetSubtitle, { color: colors.textSecondary }]}>
          {t('recording.analyze_prompt.sheet.subtitle')}
        </Text>
        <View style={styles.sheetButtons}>
          <Pressable
            style={[
              styles.sheetPrimaryButton,
              { backgroundColor: colors.accent },
              isPersisting && styles.sheetDisabledButton,
            ]}
            onPress={handleFirstDreamAnalyze}
            disabled={isPersisting}
            testID={TID.Button.AnalyzePromptAnalyze}
          >
            <Text style={[styles.sheetPrimaryButtonText, { color: colors.textOnAccentSurface }]}>
              {t('recording.analyze_prompt.sheet.analyze')}
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.sheetSecondaryButton,
              { borderColor: colors.divider, backgroundColor: colors.backgroundSecondary },
              isPersisting && styles.sheetDisabledButton,
            ]}
            onPress={handleAnalyzePromptJournal}
            disabled={isPersisting}
            testID={TID.Button.AnalyzePromptJournal}
          >
            <Text style={[styles.sheetSecondaryButtonText, { color: colors.textPrimary }]}>
              {t('recording.analyze_prompt.sheet.journal')}
            </Text>
          </Pressable>
        </View>
        <Pressable onPress={handleAnalyzePromptDismiss} style={styles.sheetLinkButton}>
          <Text style={[styles.sheetLinkText, { color: colors.textSecondary }]}>
            {t('recording.analyze_prompt.sheet.dismiss')}
          </Text>
        </Pressable>
      </BottomSheet>
      <BottomSheet
        visible={showGuestLimitSheet}
        onClose={() => {
          setShowGuestLimitSheet(false);
          setPendingGuestLimitDream(null);
        }}
        backdropColor={mode === 'dark' ? 'rgba(2, 0, 12, 0.75)' : 'rgba(0, 0, 0, 0.25)'}
        style={[
          styles.firstDreamSheet,
          {
            backgroundColor: colors.backgroundCard,
            paddingBottom: insets.bottom + ThemeLayout.spacing.md,
          },
          shadows.xl,
        ]}
      >
        <View style={[styles.sheetHandle, { backgroundColor: colors.divider }]} />
        <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>
          {t('recording.guest_limit_sheet.title')}
        </Text>
        <Text style={[styles.sheetSubtitle, { color: colors.textSecondary }]}>
          {t('recording.guest_limit_sheet.message')}
        </Text>
        <View style={styles.sheetButtons}>
          <Pressable
            style={[
              styles.sheetPrimaryButton,
              { backgroundColor: colors.accent },
            ]}
            onPress={() => {
              setShowGuestLimitSheet(false);
              router.push('/(tabs)/settings');
            }}
            testID={TID.Button.GuestLimitCta}
          >
            <Text style={[styles.sheetPrimaryButtonText, { color: colors.textOnAccentSurface }]}>
              {t('recording.guest_limit_sheet.cta')}
            </Text>
          </Pressable>
        </View>
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  mainContent: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 16,
    position: 'relative',
  },
  recordingSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    gap: 32,
  },
  serviceBadge: {
    fontSize: 14,
    fontFamily: Fonts.spaceGrotesk.regular,
    textAlign: 'center',
    opacity: 0.9,
  },
  instructionText: {
    fontSize: 22,
    lineHeight: 32,
    fontFamily: Fonts.lora.regularItalic,
    // color: set dynamically in component
    textAlign: 'center',
  },
  timestampText: {
    fontSize: 16,
    fontFamily: Fonts.spaceGrotesk.regular,
    // color: set dynamically in component
    opacity: 0.8,
    textAlign: 'center',
  },
  textInputSection: {
    width: '100%',
    maxWidth: 512,
    alignSelf: 'center',
    gap: 16,
  },
  textInput: {
    minHeight: 160,
    maxHeight: 240,
    borderRadius: 16,
    // backgroundColor and color: set dynamically in component
    padding: 20,
    fontSize: 16,
    fontFamily: Fonts.lora.regularItalic,
    textAlignVertical: 'top',
    // shadow: applied via theme shadows.md
  },
  lengthWarning: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 12,
    textAlign: 'right',
  },
  submitButton: {
    // backgroundColor: set dynamically in component
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    // shadow: applied via theme shadows.lg
  },
  submitButtonDisabled: {
    // backgroundColor: set dynamically in component
    opacity: 0.5,
    shadowOpacity: 0,
    elevation: 0,
  },
  actionButtons: {
    gap: 12,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontFamily: Fonts.spaceGrotesk.bold,
    letterSpacing: 0.5,
  },
  journalLinkButton: {
    paddingVertical: 12,
    alignItems: 'center',
    alignSelf: 'center',
  },
  journalLinkText: {
    fontSize: 16,
    fontFamily: Fonts.spaceGrotesk.bold,
  },
  firstDreamSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: ThemeLayout.spacing.lg,
    gap: ThemeLayout.spacing.md,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 56,
    height: 5,
    borderRadius: ThemeLayout.borderRadius.full,
    opacity: 0.6,
    marginBottom: ThemeLayout.spacing.sm,
  },
  sheetTitle: {
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 22,
    textAlign: 'center',
  },
  sheetSubtitle: {
    fontFamily: Fonts.lora.regular,
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
  },
  sheetButtons: {
    width: '100%',
    gap: 12,
  },
  sheetPrimaryButton: {
    borderRadius: ThemeLayout.borderRadius.lg,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetPrimaryButtonText: {
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 16,
  },
  sheetSecondaryButton: {
    borderWidth: 1,
    borderRadius: ThemeLayout.borderRadius.lg,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetSecondaryButtonText: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 16,
  },
  sheetLinkButton: {
    paddingVertical: ThemeLayout.spacing.xs,
    alignItems: 'center',
  },
  sheetLinkText: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 14,
  },
  sheetDisabledButton: {
    opacity: 0.6,
  },
});
