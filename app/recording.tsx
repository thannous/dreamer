import { AnalysisProgress } from '@/components/analysis/AnalysisProgress';
import { AtmosphereBackground } from '@/components/recording/AtmosphereBackground';
import { RecordingFooter } from '@/components/recording/RecordingFooter';
import { RecordingTextInput } from '@/components/recording/RecordingTextInput';
import { RecordingVoiceInput } from '@/components/recording/RecordingVoiceInput';
import { StandardBottomSheet } from '@/components/ui/StandardBottomSheet';
import { RECORDING } from '@/constants/appConfig';
import { GradientColors } from '@/constants/gradients';
import { ThemeLayout } from '@/constants/journalTheme';
import { QUOTAS } from '@/constants/limits';
import { Fonts } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useDreams } from '@/context/DreamsContext';
import { useLanguage } from '@/context/LanguageContext';
import { useTheme } from '@/context/ThemeContext';
import { AnalysisStep, useAnalysisProgress } from '@/hooks/useAnalysisProgress';
import { useQuota } from '@/hooks/useQuota';
import { useTranslation } from '@/hooks/useTranslation';
import { blurActiveElement } from '@/lib/accessibility';
import { buildDraftDream as buildDraftDreamPure } from '@/lib/dreamUtils';
import { isGuestDreamLimitReached } from '@/lib/guestLimits';
import { getTranscriptionLocale } from '@/lib/locale';
import { classifyError, QuotaError, QuotaErrorCode } from '@/lib/errors';
import { handleRecorderReleaseError, RECORDING_OPTIONS } from '@/lib/recording';
import { TID } from '@/lib/testIDs';
import type { DreamAnalysis } from '@/lib/types';
import { categorizeDream } from '@/services/geminiService';
import { getGuestRecordedDreamCount } from '@/services/quota/GuestDreamCounter';
import { startNativeSpeechSession, type NativeSpeechSession } from '@/services/nativeSpeechRecognition';
import { transcribeAudio } from '@/services/speechToText';
import {
	  AudioModule,
	  setAudioModeAsync,
	  useAudioRecorder,
	} from 'expo-audio';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

const normalizeTranscriptText = (text: string) => text.replace(/\s+/g, ' ').trim();
const normalizeForComparison = (text: string) =>
  normalizeTranscriptText(text)
    // Ignore lightweight punctuation so edits that only tweak commas/periods
    // don't cause duplicate concatenation when the recognizer replays the transcript.
    .replace(/[.,!?;:…]/g, '')
    .toLowerCase();

export default function RecordingScreen() {
  const { addDream, dreams, analyzeDream } = useDreams();
  const { colors, mode } = useTheme();
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
    () =>
      t('recording.alert.length_limit', { limit: RECORDING.MAX_TRANSCRIPT_CHARS }) ||
      `Limite ${RECORDING.MAX_TRANSCRIPT_CHARS} caractères atteinte`,
    [t]
  );
  const clampTranscript = useCallback((text: string) => {
    if (text.length <= RECORDING.MAX_TRANSCRIPT_CHARS) {
      return { text, truncated: false };
    }
    return { text: text.slice(0, RECORDING.MAX_TRANSCRIPT_CHARS), truncated: true };
  }, []);
  const combineTranscript = useCallback(
    (base: string, addition: string) => {
      const trimmedAddition = addition.trim();
      if (!trimmedAddition) {
        return clampTranscript(base);
      }
      const trimmedBase = base.trim();

      const hasNearPrefixMatch = (source: string, candidate: string) => {
        // Allow a small divergence near the end (e.g., STT rewrites the last word or adds one more)
        const sourceTokens = source.split(' ');
        const candidateTokens = candidate.split(' ');
        if (sourceTokens.length < 3) return false;

        let matchCount = 0;
        const limit = Math.min(sourceTokens.length, candidateTokens.length);
        for (; matchCount < limit; matchCount += 1) {
          if (sourceTokens[matchCount] !== candidateTokens[matchCount]) break;
        }

        const remainingSource = sourceTokens.length - matchCount;
        const minPrefixMatches = Math.max(3, sourceTokens.length - 2);

        // We accept if most of the prefix matches (all but the last 1-2 tokens) and candidate is at least as long.
        return matchCount >= minPrefixMatches && remainingSource <= 2 && candidateTokens.length >= sourceTokens.length;
      };

      if (trimmedBase) {
        const normalizedBase = normalizeForComparison(trimmedBase);
        const normalizedAddition = normalizeForComparison(trimmedAddition);

        // If STT re-sends text we already have, keep the existing transcript to avoid duplicates.
        if (normalizedBase.includes(normalizedAddition)) {
          return clampTranscript(trimmedBase);
        }

        // When the recognizer returns the whole transcript plus new words, keep the expanded text once.
        if (normalizedAddition.startsWith(normalizedBase) || hasNearPrefixMatch(normalizedBase, normalizedAddition)) {
          return clampTranscript(trimmedAddition);
        }

        // If only the last line is being incrementally extended or lightly corrected, replace that line instead of stacking.
        const baseLines = trimmedBase.split('\n');
        const lastLine = baseLines[baseLines.length - 1]?.trim() ?? '';
        if (lastLine) {
          const normalizedLastLine = normalizeForComparison(lastLine);
          if (normalizedAddition.startsWith(normalizedLastLine) || hasNearPrefixMatch(normalizedLastLine, normalizedAddition)) {
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

  const transcriptionLocale = useMemo(() => getTranscriptionLocale(language), [language]);

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

  const buildDraftDream = useCallback(
    (transcriptText?: string): DreamAnalysis =>
      buildDraftDreamPure(transcriptText ?? trimmedTranscript, {
        defaultTitle: t('recording.draft.default_title'),
        initialUserMessagePrefix: t('dream_chat.draft_prefix'),
      }),
    [trimmedTranscript, t]
  );

  const resetComposer = useCallback(() => {
    setTranscript('');
    setDraftDream(null);
    analysisProgress.reset();
    setLengthWarning('');
    baseTranscriptRef.current = '';
  }, [analysisProgress]);

  const handleClearTranscript = useCallback(() => {
    setTranscript('');
    setLengthWarning('');
    baseTranscriptRef.current = '';
  }, []);

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

      // Always fallback to Google STT if native returned nothing and we have audio.
      // The previous "no speech" check was blocking fallback for languages where
      // native STT doesn't work well (e.g., Spanish on devices without the language pack).
      const shouldFallbackToGoogle = !transcriptText && (uri || recordedUri);

      if (shouldFallbackToGoogle) {
        try {
          const fallbackUri = uri ?? recordedUri;
          if (__DEV__) {
            console.log('[Recording] fallback to Google STT', {
              locale: transcriptionLocale,
              nativeError,
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

    if (!user) {
      const used = await getGuestRecordedDreamCount(dreams.length);
      if (isGuestDreamLimitReached(used)) {
        const draft =
          draftDream && draftDream.transcript === latestTranscript
            ? draftDream
            : buildDraftDream(latestTranscript);
        setPendingGuestLimitDream(draft);
        setShowGuestLimitSheet(true);
        return;
      }
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
      if (error instanceof QuotaError && error.code === QuotaErrorCode.GUEST_LIMIT_REACHED) {
        const draft =
          draftDream && draftDream.transcript === latestTranscript
            ? draftDream
            : buildDraftDream(latestTranscript);
        setPendingGuestLimitDream(draft);
        setShowGuestLimitSheet(true);
        return;
      }
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
    language,
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
    language,
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
                {inputMode === 'voice' ? (
                  <RecordingVoiceInput
                    isRecording={isRecording}
                    isPreparing={isPreparingRecording}
                    transcript={transcript}
                    instructionText={t('recording.instructions')}
                    disabled={interactionDisabled}
                    onToggleRecording={toggleRecording}
                    onSwitchToText={switchToTextMode}
                  />
                ) : (
                  <RecordingTextInput
                    ref={textInputRef}
                    value={transcript}
                    onChange={handleTranscriptChange}
                    disabled={interactionDisabled}
                    lengthWarning={lengthWarning}
                    instructionText={t('recording.instructions.text') || "Ou transcris ici les murmures de ton subconscient..."}
                    onSwitchToVoice={switchToVoiceMode}
                    onClear={handleClearTranscript}
                  />
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

              <RecordingFooter
                onSave={handleSaveDream}
                onGoToJournal={handleGoToJournal}
                isSaveDisabled={isSaveDisabled}
                saveButtonLabel={t('recording.button.save_dream')}
                journalLinkLabel={t('recording.nav_button')}
                saveButtonAccessibilityLabel={t('recording.button.save_dream_accessibility', { defaultValue: t('recording.button.save_dream') })}
                journalLinkAccessibilityLabel={t('recording.nav_button.accessibility')}
              />

            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
      {/* First Dream Sheet */}
      <StandardBottomSheet
        visible={Boolean(firstDreamPrompt)}
        onClose={handleFirstDreamDismiss}
        title={t('guest.first_dream.sheet.title')}
        subtitle={t('guest.first_dream.sheet.subtitle')}
        titleTestID={TID.Text.FirstDreamSheetTitle}
        actions={{
          primaryLabel: t('guest.first_dream.sheet.analyze'),
          onPrimary: handleFirstDreamAnalyze,
          primaryDisabled: isPersisting,
          primaryTestID: TID.Button.FirstDreamAnalyze,
          secondaryLabel: t('guest.first_dream.sheet.journal'),
          onSecondary: handleFirstDreamJournal,
          secondaryDisabled: isPersisting,
          secondaryTestID: TID.Button.FirstDreamJournal,
          linkLabel: t('guest.first_dream.sheet.dismiss'),
          onLink: handleFirstDreamDismiss,
          linkTestID: TID.Button.FirstDreamDismiss,
        }}
      />

      {/* Analyze Prompt Sheet */}
      <StandardBottomSheet
        visible={Boolean(analyzePromptDream)}
        onClose={handleAnalyzePromptDismiss}
        title={t('recording.analyze_prompt.sheet.title')}
        titleTestID={TID.Text.AnalyzePromptTitle}
        actions={{
          primaryLabel: t('recording.analyze_prompt.sheet.analyze'),
          onPrimary: handleFirstDreamAnalyze,
          primaryDisabled: isPersisting,
          primaryTestID: TID.Button.AnalyzePromptAnalyze,
          secondaryLabel: t('recording.analyze_prompt.sheet.journal'),
          onSecondary: handleAnalyzePromptJournal,
          secondaryDisabled: isPersisting,
          secondaryTestID: TID.Button.AnalyzePromptJournal,
          linkLabel: t('recording.analyze_prompt.sheet.dismiss'),
          onLink: handleAnalyzePromptDismiss,
        }}
      >
        {analyzePromptTranscript ? (
          <View style={styles.sheetTranscriptContainer}>
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
      </StandardBottomSheet>

      {/* Guest Limit Sheet */}
      <StandardBottomSheet
        visible={showGuestLimitSheet}
        onClose={() => {
          setShowGuestLimitSheet(false);
          setPendingGuestLimitDream(null);
        }}
        title={t('recording.guest_limit_sheet.title')}
        subtitle={t('recording.guest_limit_sheet.message')}
        actions={{
          primaryLabel: t('recording.guest_limit_sheet.cta'),
          onPrimary: () => {
            setShowGuestLimitSheet(false);
            router.push('/(tabs)/settings');
          },
          primaryTestID: TID.Button.GuestLimitCta,
        }}
      />

      {/* Quota Limit Sheet */}
      <StandardBottomSheet
        visible={showQuotaLimitSheet}
        onClose={handleQuotaLimitDismiss}
        title={tier === 'guest'
          ? t('recording.analysis_limit.title_guest')
          : t('recording.analysis_limit.title_free')}
        subtitle={tier === 'guest'
          ? t('recording.analysis_limit.message_guest', {
            limit: usage?.analysis.limit ?? QUOTAS.guest.analysis ?? 0,
          })
          : t('recording.analysis_limit.message_free', {
            limit: usage?.analysis.limit ?? QUOTAS.free.analysis ?? 0,
          })}
        testID={TID.Sheet.QuotaLimit}
        titleTestID={TID.Text.QuotaLimitTitle}
        actions={{
          primaryLabel: tier === 'guest'
            ? t('recording.analysis_limit.cta_guest')
            : t('recording.analysis_limit.cta_free'),
          onPrimary: handleQuotaLimitPrimary,
          primaryTestID: tier === 'guest' ? TID.Button.QuotaLimitCtaGuest : TID.Button.QuotaLimitCtaFree,
          secondaryLabel: t('recording.analysis_limit.journal'),
          onSecondary: handleQuotaLimitJournal,
          secondaryTestID: TID.Button.QuotaLimitJournal,
          linkLabel: t('recording.analysis_limit.dismiss'),
          onLink: handleQuotaLimitDismiss,
        }}
      >
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
      </StandardBottomSheet>
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
  // Sheet custom content styles (used in StandardBottomSheet children)
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
});
