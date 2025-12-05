import { AnalysisProgress } from '@/components/analysis/AnalysisProgress';
import { AtmosphereBackground } from '@/components/recording/AtmosphereBackground';
import { MicButton } from '@/components/recording/MicButton';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { TypewriterText } from '@/components/ui/TypewriterText';
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
import { blurActiveElement } from '@/lib/accessibility';
import { classifyError, QuotaError } from '@/lib/errors';
import { MotiView } from '@/lib/moti';
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
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
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
  type ViewStyle,
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

const normalizeTranscriptText = (text: string) => text.replace(/\s+/g, ' ').trim();
const normalizeForComparison = (text: string) =>
  normalizeTranscriptText(text)
    // Ignore lightweight punctuation so edits that only tweak commas/periods
    // don't cause duplicate concatenation when the recognizer replays the transcript.
    .replace(/[.,!?;:…]/g, '')
    .toLowerCase();

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
  const { language } = useLanguage();
  const { t } = useTranslation();

  const [transcript, setTranscript] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [draftDream, setDraftDream] = useState<DreamAnalysis | null>(null);
  const [firstDreamPrompt, setFirstDreamPrompt] = useState<DreamAnalysis | null>(null);
  const [analyzePromptDream, setAnalyzePromptDream] = useState<DreamAnalysis | null>(null);
  const [pendingAnalysisDream, setPendingAnalysisDream] = useState<DreamAnalysis | null>(null);
  const [isPersisting, setIsPersisting] = useState(false);
  const [isPreparingRecording, setIsPreparingRecording] = useState(false);
  const [showGuestLimitSheet, setShowGuestLimitSheet] = useState(false);
  const [pendingGuestLimitDream, setPendingGuestLimitDream] = useState<DreamAnalysis | null>(null);
  const audioRecorder = useAudioRecorder(RECORDING_OPTIONS);
  const skipRecorderRef = useRef(false);
  const recorderReleasedRef = useRef(false);
  const nativeSessionRef = useRef<NativeSpeechSession | null>(null);
  const isRecordingRef = useRef(false);
  const recordingTransitionRef = useRef(false);
  const baseTranscriptRef = useRef('');
  const [lengthWarning, setLengthWarning] = useState('');
  const analysisProgress = useAnalysisProgress();
  const hasAutoStoppedRecordingRef = useRef(false);
  const { user } = useAuth();
  const { canAnalyzeNow, tier, usage } = useQuota();
  const [showQuotaLimitSheet, setShowQuotaLimitSheet] = useState(false);
  const trimmedTranscript = useMemo(() => transcript.trim(), [transcript]);
  const isAnalyzing = analysisProgress.step !== AnalysisStep.IDLE && analysisProgress.step !== AnalysisStep.COMPLETE;
  const interactionDisabled = isPersisting || isAnalyzing;
  const isSaveDisabled = !trimmedTranscript || interactionDisabled;
  const textInputRef = useRef<TextInput | null>(null);
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
      const trimmedAddition = addition.trim();
      if (!trimmedAddition) {
        return clampTranscript(base);
      }
      const trimmedBase = base.trim();

      if (trimmedBase) {
        const normalizedBase = normalizeForComparison(trimmedBase);
        const normalizedAddition = normalizeForComparison(trimmedAddition);

        // If STT re-sends text we already have, keep the existing transcript to avoid duplicates.
        if (normalizedBase.includes(normalizedAddition)) {
          return clampTranscript(trimmedBase);
        }

        // When the recognizer returns the whole transcript plus new words, keep the expanded text once.
        if (normalizedAddition.startsWith(normalizedBase)) {
          return clampTranscript(trimmedAddition);
        }

        // If only the last line is being incrementally extended, replace that line instead of stacking.
        const baseLines = trimmedBase.split('\n');
        const lastLine = baseLines[baseLines.length - 1]?.trim() ?? '';
        if (lastLine) {
          const normalizedLastLine = normalizeForComparison(lastLine);
          if (normalizedAddition.startsWith(normalizedLastLine)) {
            baseLines[baseLines.length - 1] = trimmedAddition;
            return clampTranscript(baseLines.join('\n'));
          }
        }
      }

      const combined = trimmedBase ? `${trimmedBase}\n${trimmedAddition}` : trimmedAddition;
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
      setLengthWarning(truncated ? lengthLimitMessage() : '');
    },
    [clampTranscript, lengthLimitMessage]
  );

  const handleRecorderError = useCallback(
    (context: string, error: unknown) => {
      const released = handleRecorderReleaseError(context, error);
      if (released) {
        recorderReleasedRef.current = true;
        isRecordingRef.current = false;
      }
      return released;
    },
    []
  );

  const getRecorderIsRecording = useCallback(() => {
    if (recorderReleasedRef.current) {
      return false;
    }
    return isRecordingRef.current;
  }, []);

  const forceStopRecording = useCallback(
    async (reason: 'blur' | 'unmount') => {
      const hasNativeSession = Boolean(nativeSessionRef.current);
      const recorderIsRecording = getRecorderIsRecording();
      const shouldStopRecorder = !skipRecorderRef.current && recorderIsRecording;

      if (!hasNativeSession && !shouldStopRecorder && !isRecordingRef.current) {
        return;
      }

      setIsRecording(false);
      setIsPreparingRecording(false);
      isRecordingRef.current = false;

      const nativeSession = nativeSessionRef.current;
      nativeSessionRef.current = null;

      try {
        nativeSession?.abort();
      } catch (error) {
        if (__DEV__) {
          console.warn(`[Recording] failed to abort native session during ${reason}`, error);
        }
      }

      if (shouldStopRecorder) {
        try {
          await audioRecorder.stop();
        } catch (error) {
          if (!handleRecorderError(`forceStopRecording:${reason}`, error) && __DEV__) {
            console.warn('[Recording] failed to stop audio recorder during cleanup', error);
          }
        }
      }

      try {
        await setAudioModeAsync({ allowsRecording: false });
      } catch (error) {
        if (__DEV__) {
          console.warn(`[Recording] failed to reset audio mode during ${reason}`, error);
        }
      } finally {
        skipRecorderRef.current = false;
        hasAutoStoppedRecordingRef.current = false;
      }
    },
    [audioRecorder, getRecorderIsRecording, handleRecorderError]
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
      baseTranscriptRef.current = '';
      void forceStopRecording('unmount');
      blurActiveElement();
    };
  }, [forceStopRecording]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        void forceStopRecording('blur');
        blurActiveElement();
      };
    }, [forceStopRecording])
  );

  const deriveDraftTitle = useCallback((transcriptText?: string) => {
    const source = (transcriptText ?? trimmedTranscript).trim();
    if (!source) {
      return t('recording.draft.default_title');
    }
    const firstLine = source.split('\n')[0]?.trim() ?? '';
    if (!firstLine) {
      return t('recording.draft.default_title');
    }
    return firstLine.length > 64 ? `${firstLine.slice(0, 64)}…` : firstLine;
  }, [trimmedTranscript, t]);

  const buildDraftDream = useCallback((transcriptText?: string): DreamAnalysis => {
    const normalizedTranscript = (transcriptText ?? trimmedTranscript).trim();
    const title = deriveDraftTitle(normalizedTranscript);
    return {
      id: Date.now(),
      transcript: normalizedTranscript,
      title,
      interpretation: '',
      shareableQuote: '',
      theme: undefined,
      dreamType: 'Symbolic Dream',
      imageUrl: '',
      thumbnailUrl: undefined,
      chatHistory: normalizedTranscript
        ? [{ role: 'user', text: `Here is my dream: ${normalizedTranscript}` }]
        : [],
      isFavorite: false,
      imageGenerationFailed: false,
      isAnalyzed: false,
      analysisStatus: 'none',
    };
  }, [deriveDraftTitle, trimmedTranscript]);

  const resetComposer = useCallback(() => {
    setTranscript('');
    setDraftDream(null);
    analysisProgress.reset();
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

  const stopRecording = useCallback(async () => {
    let nativeSession: NativeSpeechSession | null = null;
    let nativeResultPromise: Promise<{ transcript: string; error?: string; recordedUri?: string | null; hasRecording?: boolean }> | null = null;
    let nativeError: string | undefined;
    try {
      setIsRecording(false);
      setIsPreparingRecording(false);
      isRecordingRef.current = false;
      nativeSession = nativeSessionRef.current;
      nativeSessionRef.current = null;
      const usedRecorder = !skipRecorderRef.current;

      nativeResultPromise = nativeSession?.stop() ?? null;
      if (usedRecorder && !recorderReleasedRef.current) {
        try {
          await audioRecorder.stop();
        } catch (error) {
          if (!handleRecorderError('stopRecording', error)) {
            throw error;
          }
        }
      }
      const uri =
        usedRecorder && !recorderReleasedRef.current ? audioRecorder.uri ?? undefined : undefined;

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
      if (handleRecorderError('stopRecording', err)) {
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
  }, [audioRecorder, transcriptionLocale, t, combineTranscript, lengthLimitMessage, handleRecorderError]);

  const startRecording = useCallback(async () => {
    try {
      // Optimistic UI: show recording state while we spin up permissions/audio mode
      setIsRecording(true);
      setIsPreparingRecording(true);
      // Leave isRecordingRef false until audio is actually rolling

      if (Platform.OS === 'web') {
        const hasSecureContext = typeof window !== 'undefined' ? window.isSecureContext : false;
        if (!hasSecureContext) {
          Alert.alert(
            t('recording.alert.permission_required.title'),
            'Le micro est bloqué car la page n’est pas servie en HTTPS (ou localhost). Ouvre la page en HTTPS ou via localhost pour activer la dictée.'
          );
          setIsRecording(false);
          setIsPreparingRecording(false);
          isRecordingRef.current = false;
          return;
        }
      }

      const { granted } = await AudioModule.requestRecordingPermissionsAsync();
      if (!granted) {
        Alert.alert(
          t('recording.alert.permission_required.title'),
          t('recording.alert.permission_required.message')
        );
        setIsRecording(false);
        setIsPreparingRecording(false);
        isRecordingRef.current = false;
        return;
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      recorderReleasedRef.current = false;
      nativeSessionRef.current?.abort();
      baseTranscriptRef.current = transcript;
      nativeSessionRef.current = await startNativeSpeechSession(transcriptionLocale, {
        onPartial: (text) => {
          const { text: combined, truncated } = combineTranscript(baseTranscriptRef.current, text);
          setTranscript(combined);
          baseTranscriptRef.current = combined;
          setLengthWarning(truncated ? lengthLimitMessage() : '');
          if (truncated) {
            void stopRecording();
          }
        },
      });
      // Only skip the backup recorder when the native session can persist audio itself.
      const canPersistAudio = nativeSessionRef.current?.hasRecording === true;
      // On web we keep the recorder running to preserve a fallback audio file in case
      // the SpeechRecognition API returns an empty transcript.
      skipRecorderRef.current = Platform.OS !== 'web' && Boolean(nativeSessionRef.current) && canPersistAudio;
      if (!nativeSessionRef.current && __DEV__ && Platform.OS === 'web') {
        console.warn('[Recording] web: native session missing; check browser SpeechRecognition support/https');
      }
      if (__DEV__) {
        console.log('[Recording] native session', {
          hasSession: Boolean(nativeSessionRef.current),
          locale: transcriptionLocale,
          canPersistAudio,
        });
      }

      hasAutoStoppedRecordingRef.current = false;
      if (!skipRecorderRef.current) {
        await audioRecorder.prepareToRecordAsync(RECORDING_OPTIONS);
        audioRecorder.record();
      } else if (__DEV__) {
        console.log('[Recording] skipping audioRecorder because native session active');
      }

      isRecordingRef.current = true;
      setIsPreparingRecording(false);
    } catch (err) {
      nativeSessionRef.current?.abort();
      nativeSessionRef.current = null;
      skipRecorderRef.current = false;
      isRecordingRef.current = false;
      handleRecorderError('startRecording', err);
      if (__DEV__) {
        console.error('Failed to start recording:', err);
      }
      setIsRecording(false);
      setIsPreparingRecording(false);
      Alert.alert(t('common.error_title'), t('recording.alert.start_failed'));
    }
  }, [audioRecorder, t, transcriptionLocale, transcript, combineTranscript, lengthLimitMessage, stopRecording, handleRecorderError]);

  const toggleRecording = useCallback(async () => {
    if (recordingTransitionRef.current) {
      return;
    }
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

  useEffect(() => {
    hasAutoStoppedRecordingRef.current = false;

    const subscription = AppState.addEventListener('change', (state) => {
      try {
        const recorderIsRecording = getRecorderIsRecording();
        if ((state === 'background' || state === 'inactive') && recorderIsRecording && !hasAutoStoppedRecordingRef.current) {
          hasAutoStoppedRecordingRef.current = true;
          void stopRecording();
        }
      } catch (error) {
        handleRecorderError('appStateChange', error);
      }
    });

    return () => {
      subscription.remove();
      try {
        if (getRecorderIsRecording() && !hasAutoStoppedRecordingRef.current) {
          hasAutoStoppedRecordingRef.current = true;
          void stopRecording();
        }
      } catch (error) {
        if (!handleRecorderError('appStateCleanup', error)) {
          throw error;
        }
      }
    };
  }, [getRecorderIsRecording, handleRecorderError, stopRecording]);

  const handleSaveDream = useCallback(async () => {
    const hasActiveRecording =
      isRecordingRef.current || Boolean(nativeSessionRef.current) || getRecorderIsRecording();
    if (hasActiveRecording) {
      await stopRecording();
    }

    const latestTranscript = (baseTranscriptRef.current || transcript).trim();

    if (!latestTranscript) {
      Alert.alert(t('recording.alert.empty.title'), t('recording.alert.empty.message'));
      return;
    }

    if (!user && dreams.length >= GUEST_DREAM_LIMIT - 1) {
      const draft =
        draftDream && draftDream.transcript === latestTranscript
          ? draftDream
          : buildDraftDream(latestTranscript);
      setPendingGuestLimitDream(draft);
      setShowGuestLimitSheet(true);
      return;
    }

    setIsPersisting(true);
    try {
      const preCount = dreams.length;

      // Prepare the dream object
      let dreamToSave = draftDream && draftDream.transcript === latestTranscript
        ? draftDream
        : buildDraftDream(latestTranscript);

      // Attempt quick categorization if we have a transcript
      if (latestTranscript) {
        try {
          const metadata = await categorizeDream(latestTranscript, language);
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
    addDream,
    buildDraftDream,
    dreams.length,
    draftDream,
    getRecorderIsRecording,
    navigateAfterSave,
    resetComposer,
    stopRecording,
    t,
    transcript,
    user,
  ]);


  const handleGoToJournal = useCallback(() => {
    blurActiveElement();
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
    blurActiveElement();
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
    blurActiveElement();
    router.push('/(tabs)/journal');
  }, [analyzePromptDream]);

  // Show quota limit sheet (reusable for both guard and catch paths)
  const showQuotaSheet = useCallback(() => {
    // Close existing sheets to avoid overlay
    if (firstDreamPrompt) setFirstDreamPrompt(null);
    if (analyzePromptDream) setAnalyzePromptDream(null);

    // Don't show upsell for premium (edge case: network error)
    if (tier === 'premium') return false;

    setShowQuotaLimitSheet(true);
    return true;
  }, [tier, firstDreamPrompt, analyzePromptDream]);

  const handleQuotaLimitDismiss = useCallback(() => {
    setShowQuotaLimitSheet(false);
    // Clean up analysis state if needed
    if (pendingAnalysisDream) {
      setPendingAnalysisDream(null);
      analysisProgress.reset();
    }
  }, [pendingAnalysisDream, analysisProgress]);

  const handleQuotaLimitPrimary = useCallback(() => {
    setShowQuotaLimitSheet(false);
    // Both guests and free users go to paywall for upgrade
    router.push('/paywall');
  }, []);

  const handleQuotaLimitJournal = useCallback(() => {
    setShowQuotaLimitSheet(false);
    const dream = analyzePromptDream ?? pendingAnalysisDream;
    if (dream) {
      router.push(`/journal/${dream.id}`);
    } else {
      router.push('/(tabs)/journal');
    }
    // Cleanup
    setPendingAnalysisDream(null);
    analysisProgress.reset();
  }, [analyzePromptDream, pendingAnalysisDream, analysisProgress]);

  const handleFirstDreamAnalyze = useCallback(async () => {
    const dream = firstDreamPrompt ?? analyzePromptDream ?? pendingAnalysisDream;
    if (!dream) {
      return;
    }
    if (!canAnalyzeNow) {
      showQuotaSheet();
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

      const analyzedDream = await analyzeDream(dream.id, dream.transcript, { lang: language });

      analysisProgress.setStep(AnalysisStep.COMPLETE);
      setPendingAnalysisDream(null);
      resetComposer();
      await new Promise((resolve) => setTimeout(resolve, 300));
      navigateAfterSave(analyzedDream, preCount, { skipFirstDreamSheet: true });
    } catch (error) {
      if (error instanceof QuotaError) {
        // Reuse the same sheet for consistent UX
        if (!showQuotaSheet()) {
          // Fallback for premium (should not happen)
          Alert.alert(t('common.error'), error.userMessage);
        }
        analysisProgress.reset();
        return;
      }
      const classified = classifyError(error as Error);
      analysisProgress.setError(classified);
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
    showQuotaSheet,
    t,
  ]);

  const gradientColors = mode === 'dark'
    ? GradientColors.surreal
    : ([colors.backgroundSecondary, colors.backgroundDark] as readonly [string, string]);

  const [inputMode, setInputMode] = useState<'voice' | 'text'>('voice');
  const focusTranscriptEnd = useCallback((value: string) => {
    const len = value.length;
    requestAnimationFrame(() => {
      const input = textInputRef.current;
      if (!input) return;
      input.focus();
      // React Native
      input.setNativeProps?.({ selection: { start: len, end: len } });
      // Web fallback
      (input as unknown as { setSelectionRange?: (start: number, end: number) => void })
        ?.setSelectionRange?.(len, len);
    });
  }, []);
  const instructionStyle = useMemo(
    () => [styles.instructionText, { color: colors.textSecondary }],
    [colors.textSecondary]
  );
  const analyzePromptTranscript = analyzePromptDream?.transcript?.trim();

  const switchToTextMode = useCallback(async () => {
    const hasActiveRecording =
      isRecordingRef.current || getRecorderIsRecording() || Boolean(nativeSessionRef.current);
    if (hasActiveRecording) {
      recordingTransitionRef.current = true;
      try {
        await stopRecording();
      } finally {
        recordingTransitionRef.current = false;
      }
    }
    setInputMode('text');
  }, [getRecorderIsRecording, stopRecording]);

  const switchToVoiceMode = useCallback(async () => {
    setInputMode('voice');
    if (isRecordingRef.current || getRecorderIsRecording()) {
      return;
    }
    recordingTransitionRef.current = true;
    try {
      await startRecording();
    } finally {
      recordingTransitionRef.current = false;
    }
  }, [getRecorderIsRecording, startRecording]);

  useEffect(() => {
    if (inputMode === 'text') {
      focusTranscriptEnd(baseTranscriptRef.current || transcript);
    }
  }, [focusTranscriptEnd, inputMode, transcript]);

  // ... (existing code)

  return (
    <>
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <AtmosphereBackground />
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
              <View style={styles.bodySection}>
                <View style={styles.recordingSection}>
                  {inputMode === 'voice' ? (
                    <TypewriterText
                      style={instructionStyle}
                      text={t('recording.instructions')}
                    />
                  ) : (
                    <Text style={instructionStyle}>
                      {(t('recording.instructions.text') || "Ou transcris ici les murmures de ton subconscient...")}
                    </Text>
                  )}
                </View>

                {inputMode === 'voice' ? (
                  <View style={styles.micContainer}>
                    <View style={styles.micButtonWrapper}>
                      <MicButton
                        isRecording={isRecording}
                        isPreparing={isPreparingRecording}
                        onPress={toggleRecording}
                        disabled={interactionDisabled}
                        testID={TID.Button.RecordToggle}
                      />
                    </View>

                    <View style={styles.preparingSlot}>
                      {isPreparingRecording ? (
                        <MotiView
                          from={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ type: 'timing', duration: 250 }}
                        >
                          <Text style={[styles.preparingText, { color: colors.textSecondary }]}>
                            {t('recording.status.preparing') || 'Initialisation du micro...'}
                          </Text>
                        </MotiView>
                      ) : null}
                    </View>

                    {/* Live Transcript Display */}
                    {transcript ? (
                      <MotiView
                        from={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ type: 'timing', duration: 500 }}
                        style={styles.liveTranscriptContainer}
                      >
                        <Text style={[styles.liveTranscriptText, { color: colors.textPrimary }]}>
                          {transcript}
                        </Text>
                      </MotiView>
                    ) : null}

                    <Pressable
                      onPress={switchToTextMode}
                      style={styles.modeSwitchButton}
                      testID="button-switch-to-text"
                    >
                      <Text style={[styles.modeSwitchText, { color: colors.textSecondary }]}>
                        {(transcript ? "Modifier mon rêve" : (t('recording.mode.switch_to_text') || "Écrire mon rêve")) + " ✎"}
                      </Text>
                    </Pressable>
                  </View>
                ) : (
                  <View style={styles.textInputSection}>
                    <View style={shadows.md}>
                      <TextInput
                        value={transcript}
                        onChangeText={handleTranscriptChange}
                        ref={textInputRef}
                        style={[
                          styles.textInput,
                          {
                            backgroundColor: colors.backgroundSecondary,
                            color: colors.textPrimary,
                          },
                        ]}
                        multiline
                        editable={!interactionDisabled}
                        testID={TID.Input.DreamTranscript}
                        accessibilityLabel={t('recording.placeholder.accessibility')}
                        autoFocus
                      />
                    </View>
                    {lengthWarning ? (
                      <Text style={[styles.lengthWarning, { color: colors.accent }]}>
                        {lengthWarning}
                      </Text>
                    ) : null}

                    <Pressable
                      onPress={switchToVoiceMode}
                      style={[styles.modeSwitchButton, styles.modeSwitchVoiceButton]}
                      testID="button-switch-to-voice"
                    >
                      <Ionicons name="mic-outline" size={16} color={colors.textSecondary} style={{ marginRight: 6 }} />
                      <Text style={[styles.modeSwitchText, { color: colors.textSecondary }]}>
                        {t('recording.mode.switch_to_voice') || "Dicter mon rêve"}
                      </Text>
                    </Pressable>
                  </View>
                )}

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
              </View>

              {/* Actions */}
              <View style={styles.footerActions}>
                <View style={styles.actionButtons}>
                  <MotiView
                    animate={{ opacity: isSaveDisabled ? 0.65 : 1 }}
                    transition={{ type: 'timing', duration: 300 }}
                  >
                    <Pressable
                      onPress={handleSaveDream}
                      disabled={isSaveDisabled}
                      style={[
                        styles.submitButton,
                        shadows.lg,
                        { backgroundColor: isSaveDisabled ? colors.textSecondary : colors.accent },
                        isSaveDisabled && styles.submitButtonDisabled,
                      ]}
                      testID={TID.Button.SaveDream}
                      accessibilityRole="button"
                      accessibilityLabel={t('recording.button.save_dream_accessibility', { defaultValue: t('recording.button.save_dream') })}
                    >
                      <Text
                        style={[
                          styles.submitButtonText,
                          {
                            color: isSaveDisabled ? colors.textPrimary : colors.textOnAccentSurface,
                            opacity: isSaveDisabled ? 0.9 : 1,
                          },
                        ]}
                      >
                        {t('recording.button.save_dream')}
                      </Text>
                    </Pressable>
                  </MotiView>
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
        {analyzePromptTranscript ? (
          <View
            style={styles.sheetTranscriptContainer}
          >
            <ScrollView
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
              style={styles.sheetTranscriptScroll}
            >
              <Text style={[styles.sheetTranscriptText, { color: colors.textPrimary }]}>
                {analyzePromptTranscript}
              </Text>
            </ScrollView>
          </View>
        ) : null}
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
              router.push('/paywall');
            }}
            testID={TID.Button.GuestLimitCta}
          >
            <Text style={[styles.sheetPrimaryButtonText, { color: colors.textOnAccentSurface }]}>
              {t('recording.guest_limit_sheet.cta')}
            </Text>
          </Pressable>
        </View>
      </BottomSheet>
      <BottomSheet
        visible={showQuotaLimitSheet}
        onClose={handleQuotaLimitDismiss}
        backdropColor={mode === 'dark' ? 'rgba(2, 0, 12, 0.75)' : 'rgba(0, 0, 0, 0.25)'}
        style={[
          styles.firstDreamSheet,
          {
            backgroundColor: colors.backgroundCard,
            paddingBottom: insets.bottom + ThemeLayout.spacing.md,
          },
          shadows.xl,
        ]}
        testID={TID.Sheet.QuotaLimit}
      >
        <View style={[styles.sheetHandle, { backgroundColor: colors.divider }]} />
        <Text
          style={[styles.sheetTitle, { color: colors.textPrimary }]}
          testID={TID.Text.QuotaLimitTitle}
        >
          {tier === 'guest'
            ? t('recording.analysis_limit.title_guest')
            : t('recording.analysis_limit.title_free')}
        </Text>
        <Text style={[styles.sheetSubtitle, { color: colors.textSecondary }]}>
          {tier === 'guest'
            ? t('recording.analysis_limit.message_guest', { limit: usage?.analysis.limit ?? 2 })
            : t('recording.analysis_limit.message_free', { limit: usage?.analysis.limit ?? 5 })}
        </Text>

        {/* Features list for free users only */}
        {tier === 'free' && (
          <View style={styles.quotaFeaturesList}>
            <Text style={[styles.quotaFeature, { color: colors.textPrimary }]}>
              ✓ {t('recording.analysis_limit.feature_analyses')}
            </Text>
            <Text style={[styles.quotaFeature, { color: colors.textPrimary }]}>
              ✓ {t('recording.analysis_limit.feature_explorations')}
            </Text>
            <Text style={[styles.quotaFeature, { color: colors.textPrimary }]}>
              ✓ {t('recording.analysis_limit.feature_priority')}
            </Text>
          </View>
        )}

        <View style={styles.sheetButtons}>
          <Pressable
            style={[styles.sheetPrimaryButton, { backgroundColor: colors.accent }]}
            onPress={handleQuotaLimitPrimary}
            testID={tier === 'guest' ? TID.Button.QuotaLimitCtaGuest : TID.Button.QuotaLimitCtaFree}
          >
            <Text style={[styles.sheetPrimaryButtonText, { color: colors.textOnAccentSurface }]}>
              {tier === 'guest'
                ? t('recording.analysis_limit.cta_guest')
                : t('recording.analysis_limit.cta_free')}
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.sheetSecondaryButton,
              { borderColor: colors.divider, backgroundColor: colors.backgroundSecondary },
            ]}
            onPress={handleQuotaLimitJournal}
            testID={TID.Button.QuotaLimitJournal}
          >
            <Text style={[styles.sheetSecondaryButtonText, { color: colors.textPrimary }]}>
              {t('recording.analysis_limit.journal')}
            </Text>
          </Pressable>
        </View>
        <Pressable onPress={handleQuotaLimitDismiss} style={styles.sheetLinkButton}>
          <Text style={[styles.sheetLinkText, { color: colors.textSecondary }]}>
            {t('recording.analysis_limit.dismiss')}
          </Text>
        </Pressable>
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
    justifyContent: 'flex-start',
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 24,
    position: 'relative',
  },
  bodySection: {
    flex: 1,
    justifyContent: 'center',
    gap: 24,
  },
  recordingSection: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -8,
  },
  micContainer: {
    alignItems: 'center',
    gap: 16
  },
  preparingSlot: {
    minHeight: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  preparingText: {
    fontSize: 14,
    fontFamily: Fonts.spaceGrotesk.medium,
    textAlign: 'center',
  },
  liveTranscriptContainer: {
    marginBottom: 10,
    paddingHorizontal: 8,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveTranscriptText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    fontFamily: Fonts.lora.regular,
  },
  waveformSlot: {
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  instructionText: {
    fontSize: 24,
    lineHeight: 34,
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
    ...(Platform.OS === 'web'
      ? { boxShadow: 'none' }
      : { shadowOpacity: 0, elevation: 0 }),
  } as ViewStyle,
  actionButtons: {
    gap: 12,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontFamily: Fonts.spaceGrotesk.bold,
    letterSpacing: 0.5,
  },
  footerActions: {
    marginTop: 'auto',
    width: '100%',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 8,
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
  sheetTranscriptContainer: {
    width: '100%',
    borderRadius: ThemeLayout.borderRadius.lg,
    borderWidth: 0,
    paddingVertical: ThemeLayout.spacing.sm,
    paddingHorizontal: ThemeLayout.spacing.md,
    maxHeight: 180,
    marginTop: ThemeLayout.spacing.sm,
  },
  sheetTranscriptScroll: {
    maxHeight: 164,
  },
  sheetTranscriptText: {
    fontFamily: Fonts.lora.regular,
    fontSize: 15,
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
  quotaFeaturesList: {
    marginTop: ThemeLayout.spacing.sm,
    marginBottom: ThemeLayout.spacing.md,
    gap: 8,
    alignItems: 'flex-start',
    width: '100%',
    paddingHorizontal: ThemeLayout.spacing.md,
  },
  quotaFeature: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 14,
  },
  micButtonWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    width: 240,
    height: 240,
  },
  modeSwitchButton: {
    paddingVertical: 6,
    paddingHorizontal: 0,
    alignSelf: 'center',
    marginTop: 8,
  },
  modeSwitchText: {
    fontSize: 15,
    fontFamily: Fonts.spaceGrotesk.medium,
  },
  modeSwitchVoiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
