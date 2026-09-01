import { MockNavigationRail } from '@/components/dev/MockNavigationRail';
import { NoctaliaBottomNav } from '@/components/navigation/NoctaliaBottomNav';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AtmosphereBackground } from '@/components/recording/AtmosphereBackground';
import { OfflineModelDownloadSheet } from '@/components/recording/OfflineModelDownloadSheet';
import { RecordingFooter } from '@/components/recording/RecordingFooter';
import { MicPermissionRationaleSheet } from '@/components/recording/RecordingSheets';
import { RecordingInputModeSelect } from '@/components/recording/RecordingInputModeSelect';
import { RecordingTextInput } from '@/components/recording/RecordingTextInput';
import { RecordingDraftProgress } from '@/components/recording/RecordingDraftProgress';
import { RememberedDreamProfileChips } from '@/components/recording/RememberedDreamProfileChips';
import { Toast } from '@/components/Toast';
import { StandardBottomSheet } from '@/components/ui/StandardBottomSheet';
import { DESKTOP_BREAKPOINT } from '@/constants/layout';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useDreams } from '@/context/DreamsContext';
import { useLanguage } from '@/context/LanguageContext';
import { useOnboarding } from '@/context/OnboardingContext';
import { useTheme } from '@/context/ThemeContext';
import { useRecordingDraftPersistence } from '@/hooks/useRecordingDraftPersistence';
import { useRecordingSession } from '@/hooks/useRecordingSession';
import { useTranslation } from '@/hooks/useTranslation';
import { blurActiveElement } from '@/lib/accessibility';
import {
  getRecordingDurationBucket,
  getTranscriptLengthBucket,
  trackProductEvent,
} from '@/lib/analytics';
import {
  buildDraftDream as buildDraftDreamPure,
  buildRememberedDream,
} from '@/lib/dreamUtils';
import { isMockModeEnabled } from '@/lib/env';
import { getTranscriptionLocale } from '@/lib/locale';
import { createScopedLogger } from '@/lib/logger';
import {
  parseRecordingRouteParams,
  resolveRecordingEntryIntent,
  type RecordingRouteParams,
} from '@/lib/onboardingState';
import {
  type RecordingCaptureIntent,
  resolveRememberedCaptureSource,
  type RememberedCaptureSource,
} from '@/lib/recordingActivation';
import {
  preserveVoiceModeAfterFailure,
  type VoiceCaptureFailure,
  type VoiceFallbackReason,
} from '@/lib/recordingVoiceMode';
import { canDictate } from '@/lib/speechCapability';
import { buildJournalDetailHref } from '@/lib/journalSavedConfirmation';
import { isTranscriptSaveable } from '@/lib/recordingDraftProgress';
import { combineTranscript as combineTranscriptPure } from '@/lib/transcriptMerge';
import { TID } from '@/lib/testIDs';
import type {
  DreamAnalysis,
  DreamApproximatePeriod,
  DreamStrongestFragment,
  RecordingInputModePreference,
  RememberedDreamKind,
} from '@/lib/types';
import { categorizeDream } from '@/services/geminiService';
import {
  registerOfflineModelPromptHandler,
  resolveDeviceSpeechCapability,
  type OfflineModelPromptHandler,
} from '@/services/nativeSpeechRecognition';
import {
  getRecordingInputModePreference,
  getRecordingVoiceHintCompleted,
  saveRecordingVoiceHintCompleted,
  saveRecordingInputModePreference,
} from '@/services/storageService';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  type LayoutChangeEvent,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const log = createScopedLogger('[Recording]');
const isMockMode = isMockModeEnabled();
const trackedOnboardingRecordingDestinations = new Set<string>();

type CaptureIntent = RecordingCaptureIntent;

const formatRecordingDuration = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

export default function RecordingScreen() {
  const {
    addDream,
    applyDreamCategorization,
    dreams,
  } = useDreams();
  const { colors, mode } = useTheme();
  const { language } = useLanguage();
  const { t } = useTranslation();
  const {
    state: onboardingState,
    scope: onboardingScope,
    transition: transitionOnboarding,
  } = useOnboarding();
  const insets = useSafeAreaInsets();
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();
  const recordingParams = useLocalSearchParams<RecordingRouteParams>();
  const parsedRecordingParams = useMemo(
    () => parseRecordingRouteParams(recordingParams),
    [recordingParams]
  );
  const resolvedRecordingEntryIntent = useMemo(
    () => resolveRecordingEntryIntent(
      parsedRecordingParams,
      onboardingState.pendingRecordingIntent
    ),
    [onboardingState.pendingRecordingIntent, parsedRecordingParams]
  );

  const [transcript, setTranscript] = useState('');
  const [draftDream, setDraftDream] = useState<DreamAnalysis | null>(null);
  const [isPersisting, setIsPersisting] = useState(false);
  const [isPreparingRecording, setIsPreparingRecording] = useState(false);
  const recordingTransitionRef = useRef(false);
  const baseTranscriptRef = useRef('');
  const handleRestoreDraft = useCallback((savedTranscript: string) => {
    setTranscript(savedTranscript);
    baseTranscriptRef.current = savedTranscript;
  }, []);
  const { noteInput, clearAfterSuccessfulSave, lastPersistedValue } = useRecordingDraftPersistence({
    transcript,
    onRestore: handleRestoreDraft,
  });
  const [lengthWarning, setLengthWarning] = useState('');
  const hasAutoStoppedRecordingRef = useRef(false);
  const [showMicRationaleSheet, setShowMicRationaleSheet] = useState(false);
  const [showOfflineModelSheet, setShowOfflineModelSheet] = useState(false);
  const [offlineModelLocale, setOfflineModelLocale] = useState('');
  const offlineModelPromptResolveRef = useRef<(() => void) | null>(null);
  const offlineModelPromptPromiseRef = useRef<Promise<void> | null>(null);
  const offlineModelSheetVisibleRef = useRef(false);
  const hasSeenMicRationaleRef = useRef(false);
  const recordingStartedAtRef = useRef<number | null>(null);
  const [recordingDurationSeconds, setRecordingDurationSeconds] = useState(0);
  const [voiceFallbackReason, setVoiceFallbackReason] = useState<VoiceFallbackReason>(null);
  const [isVoiceFallbackToastVisible, setIsVoiceFallbackToastVisible] = useState(false);
  const [recordingVoiceHintLoadedScope, setRecordingVoiceHintLoadedScope] =
    useState<string | null>(null);
  const [recordingVoiceHintDismissed, setRecordingVoiceHintDismissed] = useState(false);
  const recordingVoiceHintCompletedRef = useRef(false);
  const [captureIntent, setCaptureIntent] = useState<CaptureIntent>('fresh');
  const [rememberedCaptureSource, setRememberedCaptureSource] =
    useState<RememberedCaptureSource>('journal');
  const [rememberedKind, setRememberedKind] = useState<RememberedDreamKind | undefined>();
  const [rememberedApproximatePeriod, setRememberedApproximatePeriod] =
    useState<DreamApproximatePeriod | undefined>();
  const [rememberedStrongestFragment, setRememberedStrongestFragment] =
    useState<DreamStrongestFragment | undefined>();
  const [showRememberedDetailsSheet, setShowRememberedDetailsSheet] = useState(false);
  const [inputMode, setInputMode] = useState<RecordingInputModePreference>('text');
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [footerHeight, setFooterHeight] = useState(0);
  const [bottomNavHeight, setBottomNavHeight] = useState(0);
  const appliedRouteEntriesRef = useRef<Set<string>>(new Set());
  const activePostSaveRef = useRef<'confirm_analysis' | 'journal_first' | null>(null);
  const captureStartedTrackedRef = useRef(false);
  const restoredPendingIntentRef = useRef<string | null>(null);
  const initialRouteModeRef = useRef(parsedRecordingParams.mode);
  const preferenceScopeRef = useRef(onboardingScope);

  useEffect(() => {
    const isExplicitOnboardingDestination = resolvedRecordingEntryIntent?.source === 'onboarding';
    const isSkipDestination = onboardingState.completionReason === 'skip';
    if (!isExplicitOnboardingDestination && !isSkipDestination) return;
    if (
      resolvedRecordingEntryIntent
      && appliedRouteEntriesRef.current.has(resolvedRecordingEntryIntent.entryId)
    ) return;

    const path = isExplicitOnboardingDestination
      ? resolvedRecordingEntryIntent?.postSave === 'journal_first' ? 'memory' : 'analyze'
      : 'skip';
    const key = isExplicitOnboardingDestination
      ? `entry:${resolvedRecordingEntryIntent?.entryId ?? onboardingState.completedAt ?? path}`
      : `skip:${onboardingState.completedAt ?? 'session'}`;
    if (trackedOnboardingRecordingDestinations.has(key)) return;

    trackedOnboardingRecordingDestinations.add(key);
    void trackProductEvent('onboarding_destination_viewed', {
      destination: 'recording',
      path,
    });
  }, [
    onboardingState.completedAt,
    onboardingState.completionReason,
    resolvedRecordingEntryIntent,
  ]);

  const persistInputModePreference = useCallback((preference: RecordingInputModePreference) => {
    saveRecordingInputModePreference(preference, onboardingScope).catch((error) => {
      if (__DEV__) {
        console.warn('[Recording] Failed to save input mode preference', error);
      }
    });
  }, [onboardingScope]);

  const resolveOfflineModelPrompt = useCallback(() => {
    const resolve = offlineModelPromptResolveRef.current;
    offlineModelPromptResolveRef.current = null;
    offlineModelPromptPromiseRef.current = null;
    resolve?.();
  }, []);

  const waitForOfflineModelPromptClose = useCallback((): Promise<void> => {
    if (offlineModelPromptPromiseRef.current) {
      return offlineModelPromptPromiseRef.current;
    }

    offlineModelPromptPromiseRef.current = new Promise<void>((resolve) => {
      offlineModelPromptResolveRef.current = () => {
        resolve();
      };
    });

    return offlineModelPromptPromiseRef.current;
  }, []);

  useEffect(() => {
    let isActive = true;
    const scopeChanged = preferenceScopeRef.current !== onboardingScope;
    preferenceScopeRef.current = onboardingScope;
    if (scopeChanged || parsedRecordingParams.mode) {
      initialRouteModeRef.current = parsedRecordingParams.mode;
    }

    getRecordingInputModePreference(onboardingScope)
      .then((preference) => {
        if (isActive) {
          setInputMode(initialRouteModeRef.current ?? preference ?? 'text');
        }
      })
      .catch((error) => {
        if (__DEV__) {
          console.warn('[Recording] Failed to load input mode preference', error);
        }
      });

    return () => {
      isActive = false;
    };
  }, [onboardingScope, parsedRecordingParams.mode]);

  useEffect(() => {
    let isActive = true;
    recordingVoiceHintCompletedRef.current = false;

    getRecordingVoiceHintCompleted(onboardingScope)
      .then((completed) => {
        if (!isActive || recordingVoiceHintCompletedRef.current) {
          return;
        }
        recordingVoiceHintCompletedRef.current = completed;
        setRecordingVoiceHintDismissed(completed);
        setRecordingVoiceHintLoadedScope(onboardingScope);
      })
      .catch((error) => {
        if (__DEV__) {
          console.warn('[Recording] Failed to load voice hint preference', error);
        }
        if (isActive) {
          setRecordingVoiceHintLoadedScope(onboardingScope);
        }
      });

    return () => {
      isActive = false;
    };
  }, [onboardingScope]);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => {
      setKeyboardVisible(true);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const handleOfflineModelPromptShow = useCallback(
    async (locale: string) => {
      setOfflineModelLocale(locale);
      setShowOfflineModelSheet(true);
      await waitForOfflineModelPromptClose();
    },
    [waitForOfflineModelPromptClose]
  );

  const handleOfflineModelSheetClose = useCallback(() => {
    setShowOfflineModelSheet(false);
    setOfflineModelLocale('');
    resolveOfflineModelPrompt();
  }, [resolveOfflineModelPrompt]);

  const handleOfflineModelDownloadComplete = useCallback(
    (_success: boolean) => {
      handleOfflineModelSheetClose();
    },
    [handleOfflineModelSheetClose]
  );
  const trimmedTranscript = useMemo(() => transcript.trim(), [transcript]);
  const interactionDisabled = isPersisting;
  const isCompactLandscape = viewportWidth > viewportHeight && viewportHeight < 600;
  const hasSaveableContent = isTranscriptSaveable(transcript);
  const isSaveDisabled = !hasSaveableContent || interactionDisabled;
  const textInputRef = useRef<TextInput | null>(null);
  const scrollViewRef = useRef<React.ElementRef<typeof ScrollView> | null>(null);
  const lastInputSourceRef = useRef<RecordingInputModePreference>('text');
  const combineTranscript = useCallback(
    (base: string, addition: string) => {
      return combineTranscriptPure({
        base,
        addition,
        devLog: __DEV__,
      });
    },
    []
  );

  const normalizeForComparison = useCallback((text: string): string => {
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }, []);

  const transcriptionLocale = useMemo(() => getTranscriptionLocale(language), [language]);

  // Voice is blocked only when the device cannot capture speech at all. Every
  // Android version from minSdk 28 up degrades instead: to the network
  // recognizer when no local model can be proven, then to server transcription
  // when no RecognitionService exists.
  const [isVoiceSupported, setIsVoiceSupported] = useState(true);

  useEffect(() => {
    // Web resolves speech availability through the Web Speech API instead; the
    // capability ladder is a native concern.
    if (Platform.OS === 'web') {
      return;
    }

    let isMounted = true;

    resolveDeviceSpeechCapability(transcriptionLocale)
      .then((capability) => {
        if (!isMounted) {
          return;
        }

        const supported = canDictate(capability);
        setIsVoiceSupported(supported);

        if (!supported) {
          setVoiceFallbackReason('voice_unsupported');
          setInputMode('text');
        }
      })
      .catch(() => {
        // Probing must never block capture: assume voice works and let the
        // existing per-attempt fallbacks surface a real failure.
        if (isMounted) {
          setIsVoiceSupported(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [transcriptionLocale]);

  const handleTranscriptChange = useCallback(
    (text: string) => {
      lastInputSourceRef.current = 'text';
      if (!captureStartedTrackedRef.current && text.trim().length > 0) {
        captureStartedTrackedRef.current = true;
        void trackProductEvent('dream_capture_started', {
          input_mode: 'text',
          capture_context: captureIntent,
        });
      }
      noteInput(text);
      setTranscript(text);
      baseTranscriptRef.current = text;
    },
    [captureIntent, noteInput]
  );

  const stopRecordingFromNativeEndRef = useRef<(() => void) | null>(null);

  const recordingSession = useRecordingSession({
    transcriptionLocale,
    t,
    onNativeEnd: () => {
      stopRecordingFromNativeEndRef.current?.();
    },
    onPartialTranscript: (text) => {
      const { text: combined } = combineTranscript(baseTranscriptRef.current, text);
      noteInput(combined);
      setTranscript(combined);
      baseTranscriptRef.current = combined;
    },
  });

  const {
    isRecording,
    isRecordingRef,
    recordingPermissionState,
    startRecording: startSessionRecording,
    stopRecording: stopSessionRecording,
    forceStopRecording,
  } = recordingSession;

  useEffect(() => {
    if (!isRecording) {
      setRecordingDurationSeconds(0);
      return;
    }

    const updateDuration = () => {
      const startedAt = recordingStartedAtRef.current;
      setRecordingDurationSeconds(startedAt ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000)) : 0);
    };

    updateDuration();
    const interval = setInterval(updateDuration, 1000);
    return () => clearInterval(interval);
  }, [isRecording]);

  useEffect(() => {
    offlineModelSheetVisibleRef.current = showOfflineModelSheet;
  }, [showOfflineModelSheet]);

  // Register offline model prompt handler
  useEffect(() => {
    const handler: OfflineModelPromptHandler = {
      get isVisible() {
        return offlineModelSheetVisibleRef.current;
      },
      show: handleOfflineModelPromptShow,
    };
    return registerOfflineModelPromptHandler(handler);
  }, [handleOfflineModelPromptShow]);

  useEffect(() => {
    return () => {
      resolveOfflineModelPrompt();
    };
  }, [resolveOfflineModelPrompt]);

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
    (transcriptText?: string): DreamAnalysis => {
      const text = transcriptText ?? trimmedTranscript;

      if (captureIntent === 'remembered') {
        return buildRememberedDream(text, {
          defaultTitle: t('recording.remembered.default_title'),
          rememberedKind: rememberedKind ?? 'old',
          approximatePeriod: rememberedApproximatePeriod,
          strongestFragment: rememberedStrongestFragment,
          createdFrom: rememberedCaptureSource,
        });
      }

      return buildDraftDreamPure(text, {
        defaultTitle: t('recording.draft.default_title'),
      });
    },
    [
      captureIntent,
      rememberedApproximatePeriod,
      rememberedCaptureSource,
      rememberedKind,
      rememberedStrongestFragment,
      trimmedTranscript,
      t,
    ]
  );

  const resetComposer = useCallback(() => {
    setTranscript('');
    setDraftDream(null);
    setLengthWarning('');
    setVoiceFallbackReason(null);
    setCaptureIntent('fresh');
    setRememberedCaptureSource('journal');
    setRememberedKind(undefined);
    setRememberedApproximatePeriod(undefined);
    setRememberedStrongestFragment(undefined);
    baseTranscriptRef.current = '';
    captureStartedTrackedRef.current = false;
  }, []);

  const handleClearTranscript = useCallback(() => {
    noteInput('');
    setTranscript('');
    setLengthWarning('');
    setVoiceFallbackReason(null);
    baseTranscriptRef.current = '';
  }, [noteInput]);

  const navigateToJournalDetail = useCallback((
    dreamId: string | number,
    options?: { saved?: boolean }
  ) => {
    router.replace(buildJournalDetailHref(dreamId, options));
  }, []);

  useEffect(() => {
    const pending = onboardingState.pendingRecordingIntent;
    if (
      !pending?.savedDreamId
      || pending.phase === 'capture'
      || restoredPendingIntentRef.current === pending.entryId
    ) {
      return;
    }

    const savedDream = dreams.find((dream) => dream.id === pending.savedDreamId);
    if (!savedDream) return;
    restoredPendingIntentRef.current = pending.entryId;
    navigateToJournalDetail(savedDream.id);
  }, [dreams, navigateToJournalDetail, onboardingState.pendingRecordingIntent]);

  const handleVoiceCaptureFailure = useCallback((failure: VoiceCaptureFailure) => {
    setVoiceFallbackReason(failure);
    if (inputMode !== 'voice') {
      return;
    }

    const outcome = preserveVoiceModeAfterFailure(failure);
    setInputMode(outcome.inputMode);
    persistInputModePreference(outcome.preferenceToPersist);
  }, [inputMode, persistInputModePreference]);

  const stopRecording = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    try {
      setIsPreparingRecording(false);
      const result = await stopSessionRecording();
      const transcriptText = result.transcript?.trim() ?? '';

      if (transcriptText) {
        const normalizedBase = normalizeForComparison(baseTranscriptRef.current);
        const normalizedFinal = normalizeForComparison(transcriptText);

        log.debug('stopRecording', {
          baseLength: normalizedBase.length,
          finalLength: normalizedFinal.length,
          baseSample: normalizedBase.substring(0, 30) + '...',
          finalSample: normalizedFinal.substring(0, 30) + '...',
        });

        // Calculate similarity: if base and final are very similar (>90%), assume partials gave us the full text
        const baseLen = normalizedBase.length;
        const finalLen = normalizedFinal.length;
        const similarity = baseLen > 0 && finalLen > 0
          ? Math.min(baseLen, finalLen) / Math.max(baseLen, finalLen)
          : 0;

        // If final is essentially same as base with 90%+ similarity and starts similarly
        // it means partials already gave us the transcript
        if (similarity > 0.9 && normalizedFinal.startsWith(normalizedBase.substring(0, Math.min(20, normalizedBase.length)))) {
          log.debug('final very similar to base, using final (may have corrections)', {
            similarity: similarity.toFixed(2),
          });
          // Use final as-is (it might have corrections from the STT engine)
          noteInput(transcriptText);
          baseTranscriptRef.current = transcriptText;
          setTranscript(transcriptText);
        } else {
          // Final is significantly different - combine with base
          const { text: combined } = combineTranscript(baseTranscriptRef.current, transcriptText);
          noteInput(combined);
          baseTranscriptRef.current = combined;
          setTranscript((prev) => (prev.trim() === combined.trim() ? prev : combined));
        }
      } else {
        recordingStartedAtRef.current = null;
        if (silent) {
          return;
        }
        if (result.error === 'rate_limited') {
          Alert.alert(t('common.error_title'), t('error.rate_limit'));
          return;
        }
        if (result.error === 'stt_unavailable') {
          handleVoiceCaptureFailure('stt_unavailable');
          return;
        }
        if (result.error === 'language_pack_missing') {
          handleVoiceCaptureFailure('language_pack_missing');
          return;
        }
        if (result.error === 'no_recording') {
          Alert.alert(
            t('recording.alert.recording_invalid.title'),
            t('recording.alert.recording_invalid.message')
          );
          return;
        }
        if (result.error && result.error !== 'no_speech') {
          Alert.alert(t('recording.alert.transcription_failed.title'), result.error);
          return;
        }
        handleVoiceCaptureFailure('no_speech');
      }
    } catch (err) {
      log.error('Failed to stop recording:', err);
      Alert.alert(t('common.error_title'), t('recording.alert.stop_failed'));
    } finally {
      hasAutoStoppedRecordingRef.current = false;
    }
  }, [
    t,
    combineTranscript,
    normalizeForComparison,
    handleVoiceCaptureFailure,
    noteInput,
    stopSessionRecording,
  ]);

  useEffect(() => {
    stopRecordingFromNativeEndRef.current = () => {
      void stopRecording();
    };
    return () => {
      stopRecordingFromNativeEndRef.current = null;
    };
  }, [stopRecording]);

  const startRecording = useCallback(async () => {
    try {
      setIsPreparingRecording(true);
      setVoiceFallbackReason(null);
      baseTranscriptRef.current = transcript;

      const response = await startSessionRecording(transcript);
      if (response.success) {
        lastInputSourceRef.current = 'voice';
        if (!captureStartedTrackedRef.current) {
          captureStartedTrackedRef.current = true;
          void trackProductEvent('dream_capture_started', {
            input_mode: 'voice',
            capture_context: captureIntent,
          });
        }
        recordingStartedAtRef.current = Date.now();
        void trackProductEvent('recording_started', {
          input_mode: 'voice',
          language,
          speech_available: true,
          offline_model_state: 'unknown',
        });
        return;
      }
      recordingStartedAtRef.current = null;
      if (response.error === 'offline_model_not_ready') {
        return;
      }
      if (
        response.error === 'permission_denied' ||
        response.error === 'stt_unavailable' ||
        response.error === 'language_pack_missing'
      ) {
        handleVoiceCaptureFailure(response.error);
        if (response.error === 'stt_unavailable' && process.env.EXPO_OS === 'ios') {
          Alert.alert(
            t('recording.alert.stt_unavailable.title'),
            t('recording.alert.stt_unavailable.message')
          );
        }
        return;
      }
      handleVoiceCaptureFailure('start_failed');
      Alert.alert(t('common.error_title'), t('recording.alert.start_failed'));
    } finally {
      setIsPreparingRecording(false);
    }
  }, [captureIntent, handleVoiceCaptureFailure, language, startSessionRecording, t, transcript]);

  const toggleRecording = useCallback(async () => {
    if (recordingTransitionRef.current) {
      return;
    }
    recordingTransitionRef.current = true;
    try {
      if (isRecordingRef.current) {
        await stopRecording();
      } else {
        if (recordingPermissionState !== 'granted' && !hasSeenMicRationaleRef.current) {
          setShowMicRationaleSheet(true);
          return;
        }
        await startRecording();
      }
    } finally {
      recordingTransitionRef.current = false;
    }
  }, [isRecordingRef, recordingPermissionState, startRecording, stopRecording]);

  useEffect(() => {
    if (!isRecording) {
      return;
    }

    hasAutoStoppedRecordingRef.current = false;

    const subscription = AppState.addEventListener('change', (state) => {
      if (
        (state === 'background' || state === 'inactive') &&
        !hasAutoStoppedRecordingRef.current
      ) {
        hasAutoStoppedRecordingRef.current = true;
        void stopRecording({ silent: true });
      }
    });

    return () => {
      subscription.remove();
      if (!hasAutoStoppedRecordingRef.current) {
        hasAutoStoppedRecordingRef.current = true;
        void stopRecording({ silent: true });
      }
    };
  }, [isRecording, stopRecording]);

  const handleSaveDream = useCallback(async () => {
    if (isRecordingRef.current) {
      await stopRecording();
    }

    const latestSource = baseTranscriptRef.current || transcript;
    if (!isTranscriptSaveable(latestSource)) {
      Alert.alert(t('recording.alert.empty.title'), t('recording.alert.empty.message'));
      return;
    }
    const latestTranscript = latestSource.trim();

    setIsPersisting(true);
    try {
      // Persist first. Optional AI categorization must never delay durable capture.
      const dreamToSave = draftDream && draftDream.transcript === latestTranscript
        ? draftDream
        : buildDraftDream(latestTranscript);

      const savedDream = await addDream(dreamToSave);
      clearAfterSuccessfulSave();
      setDraftDream(savedDream);
      void categorizeDream(latestTranscript, language)
        .then((categorization) => applyDreamCategorization(savedDream.id, categorization))
        .catch((error) => {
          log.warn('Quick categorization failed:', error);
        });
      void trackProductEvent('recording_saved', {
        input_mode: lastInputSourceRef.current,
        capture_context: captureIntent,
        duration_bucket: getRecordingDurationBucket(
          recordingStartedAtRef.current ? Date.now() - recordingStartedAtRef.current : null
        ),
        transcript_length_bucket: getTranscriptLengthBucket(latestTranscript),
      });
      recordingStartedAtRef.current = null;

      resetComposer();
      const onboardingPostSave = activePostSaveRef.current;
      activePostSaveRef.current = null;
      if (onboardingPostSave) {
        const pendingEvent = onboardingPostSave === 'confirm_analysis'
          ? {
              type: 'SET_PENDING_PHASE' as const,
              phase: 'analysis_confirmation' as const,
              savedDreamId: savedDream.id,
            }
          : { type: 'CLEAR_PENDING_INTENT' as const };
        void transitionOnboarding(pendingEvent).catch((error) => {
          if (__DEV__) {
            console.warn('[Recording] Failed to persist post-save onboarding phase', error);
          }
        });
      }
      navigateToJournalDetail(savedDream.id, { saved: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected error occurred. Please try again.';
      Alert.alert(t('common.error_title'), message);
    } finally {
      setIsPersisting(false);
    }
  }, [
    addDream,
    applyDreamCategorization,
    buildDraftDream,
    captureIntent,
    clearAfterSuccessfulSave,
    draftDream,
    isRecordingRef,
    language,
    navigateToJournalDetail,
    resetComposer,
    stopRecording,
    t,
    transitionOnboarding,
    transcript,
  ]);


  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const gradientColors = noctalia.screen.gradient;
  const isDesktopWeb = Platform.OS === 'web' && viewportWidth >= DESKTOP_BREAKPOINT;
  const closeRecording = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)');
  }, []);
  const fixedFooterBottomOffset = keyboardVisible
    ? insets.bottom
    : isDesktopWeb
      ? insets.bottom
      : Math.max(bottomNavHeight, insets.bottom);
  const mainContentStyle = useMemo(
    () => [
      styles.mainContent,
      isCompactLandscape && styles.mainContentCompact,
      {
        paddingTop: 16 + insets.top,
        paddingBottom: fixedFooterBottomOffset + footerHeight,
      },
    ],
    [
      fixedFooterBottomOffset,
      footerHeight,
      insets.top,
      isCompactLandscape,
    ]
  );
  const fixedFooterStyle = useMemo(
    () => keyboardVisible
      ? styles.keyboardFooter
      : [
          styles.fixedFooter,
          {
            bottom: fixedFooterBottomOffset,
          },
        ],
    [fixedFooterBottomOffset, keyboardVisible]
  );
  const handleFooterLayout = useCallback((event: LayoutChangeEvent) => {
    const nextHeight = Math.ceil(event.nativeEvent.layout.height);
    setFooterHeight((current) => current === nextHeight ? current : nextHeight);
  }, []);
  const handleBottomNavMeasure = useCallback((event: LayoutChangeEvent) => {
    const nextHeight = Math.ceil(viewportHeight - event.nativeEvent.layout.y);
    setBottomNavHeight((current) => current === nextHeight ? current : nextHeight);
  }, [viewportHeight]);

  useEffect(() => {
    if (!keyboardVisible || footerHeight === 0) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    });

    return () => cancelAnimationFrame(frame);
  }, [footerHeight, keyboardVisible]);

  const focusTranscriptEnd = useCallback((value: string) => {
    const len = value.length;
    const focus = () => {
      const input = textInputRef.current;
      if (!input) return;
      input.focus();
      // React Native
      input.setNativeProps?.({ selection: { start: len, end: len } });
      // Web fallback
      (input as unknown as { setSelectionRange?: (start: number, end: number) => void })
        ?.setSelectionRange?.(len, len);
    };

    requestAnimationFrame(focus);
    setTimeout(focus, 80);
    setTimeout(focus, 240);
  }, []);

  useEffect(() => {
    if (!resolvedRecordingEntryIntent) return;
    const routeEntryKey = resolvedRecordingEntryIntent.entryId;
    if (appliedRouteEntriesRef.current.has(routeEntryKey) || trimmedTranscript || draftDream) return;

    appliedRouteEntriesRef.current.add(routeEntryKey);
    activePostSaveRef.current = resolvedRecordingEntryIntent.postSave;
    if (resolvedRecordingEntryIntent.source === 'lucid_trainer') {
      setCaptureIntent('remembered');
    } else if (resolvedRecordingEntryIntent.intent) {
      setCaptureIntent(resolvedRecordingEntryIntent.intent);
    }
    setRememberedCaptureSource(resolveRememberedCaptureSource(resolvedRecordingEntryIntent.source));
    setRememberedKind(
      resolvedRecordingEntryIntent.source === 'lucid_trainer'
        ? resolvedRecordingEntryIntent.lucidHandoffOutcome === 'lucid'
          ? 'lucid'
          : 'old'
        : undefined
    );
    setRememberedApproximatePeriod(undefined);
    setRememberedStrongestFragment(undefined);
    setVoiceFallbackReason(null);
    if (resolvedRecordingEntryIntent.mode) {
      initialRouteModeRef.current = resolvedRecordingEntryIntent.mode;
      setInputMode(resolvedRecordingEntryIntent.mode);
    }

    if (resolvedRecordingEntryIntent.origin === 'route') {
      const pendingEntry = onboardingState.pendingRecordingIntent;
      if (pendingEntry?.phase === 'capture' && pendingEntry.entryId !== routeEntryKey) {
        // Do not let clearing the explicit URL immediately apply a different
        // persisted entry in the same mounted composer. It remains resumable
        // after a remount because this set is intentionally session-local.
        appliedRouteEntriesRef.current.add(pendingEntry.entryId);
      }
    }

    if (
      resolvedRecordingEntryIntent.origin === 'route'
      || parsedRecordingParams.entryId
      || parsedRecordingParams.mode
    ) {
      router.setParams({
        entryId: undefined,
        intent: undefined,
        source: undefined,
        v: undefined,
        technique: undefined,
        outcome: undefined,
        lucidity: undefined,
        recall: undefined,
        postSave: undefined,
        next: undefined,
        mode: undefined,
      });
    }
  }, [
    draftDream,
    onboardingState.pendingRecordingIntent,
    onboardingScope,
    parsedRecordingParams.entryId,
    parsedRecordingParams.mode,
    resolvedRecordingEntryIntent,
    trimmedTranscript,
  ]);

  const recordingDurationLabel = isRecording
    ? t('recording.status.duration', { duration: formatRecordingDuration(recordingDurationSeconds) })
    : undefined;
  const voiceControlStatus = isPreparingRecording ? 'preparing' : isRecording ? 'recording' : 'idle';
  const voiceControlLabel = useMemo(() => {
    if (isRecording) {
      return t('recording.mic.pause');
    }
    if (isPreparingRecording) {
      return t('recording.status.preparing.title');
    }
    if (voiceFallbackReason) {
      return t('recording.status.retry_voice');
    }
    if (trimmedTranscript) {
      return t('recording.mic.resume');
    }
    return t('recording.mode.switch_to_voice');
  }, [isPreparingRecording, isRecording, t, trimmedTranscript, voiceFallbackReason]);
  const showRecordingVoiceHint = recordingVoiceHintLoadedScope === onboardingScope
    && !recordingVoiceHintDismissed
    && captureIntent === 'fresh'
    && inputMode === 'voice'
    && !isPreparingRecording
    && !isRecording;
  const textFallbackNotice = useMemo(() => {
    if (!voiceFallbackReason) {
      return '';
    }

    const fallbackKeyByReason: Record<Exclude<VoiceFallbackReason, null>, string> = {
      permission_denied: 'recording.status.fallback.permission_denied',
      stt_unavailable: 'recording.status.fallback.stt_unavailable',
      voice_unsupported: 'recording.status.fallback.voice_unsupported',
      language_pack_missing: 'recording.status.fallback.language_pack_missing',
      no_speech: 'recording.status.fallback.no_speech',
      start_failed: 'recording.status.fallback.start_failed',
    };

    return t(fallbackKeyByReason[voiceFallbackReason]);
  }, [t, voiceFallbackReason]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setIsVoiceFallbackToastVisible(Boolean(textFallbackNotice));
    }, 0);

    return () => clearTimeout(timeout);
  }, [textFallbackNotice]);

  const switchToTextMode = useCallback(async () => {
    if (isRecordingRef.current) {
      recordingTransitionRef.current = true;
      try {
        await stopRecording({ silent: true });
      } finally {
        recordingTransitionRef.current = false;
      }
    }
    setVoiceFallbackReason(null);
    setInputMode('text');
    persistInputModePreference('text');
    focusTranscriptEnd(baseTranscriptRef.current || transcript);
  }, [focusTranscriptEnd, isRecordingRef, persistInputModePreference, stopRecording, transcript]);

  const handleInputModePreferenceChange = useCallback(
    async (preference: RecordingInputModePreference) => {
      if (preference === inputMode) {
        return;
      }

      setVoiceFallbackReason(null);

      if (preference === 'text' && isRecordingRef.current) {
        recordingTransitionRef.current = true;
        try {
          await stopRecording({ silent: true });
        } finally {
          recordingTransitionRef.current = false;
        }
      }

      setInputMode(preference);
      persistInputModePreference(preference);

      if (preference === 'text') {
        focusTranscriptEnd(baseTranscriptRef.current || transcript);
      }
    },
    [
      focusTranscriptEnd,
      inputMode,
      isRecordingRef,
      persistInputModePreference,
      stopRecording,
      transcript,
    ]
  );

  const completeRecordingVoiceHint = useCallback(() => {
    if (recordingVoiceHintCompletedRef.current) {
      return;
    }

    recordingVoiceHintCompletedRef.current = true;
    setRecordingVoiceHintLoadedScope(onboardingScope);
    setRecordingVoiceHintDismissed(true);
    saveRecordingVoiceHintCompleted(true, onboardingScope).catch((error) => {
      if (__DEV__) {
        console.warn('[Recording] Failed to save voice hint preference', error);
      }
    });
  }, [onboardingScope]);

  const handleVoiceCapturePress = useCallback(async () => {
    completeRecordingVoiceHint();
    setVoiceFallbackReason(null);
    await toggleRecording();
  }, [completeRecordingVoiceHint, toggleRecording]);

  const previousInputModeRef = useRef(inputMode);
  useEffect(() => {
    const previousInputMode = previousInputModeRef.current;
    previousInputModeRef.current = inputMode;

    if (inputMode === 'text' && previousInputMode !== 'text' && !isMockMode) {
      focusTranscriptEnd(baseTranscriptRef.current || transcript);
    }
  }, [focusTranscriptEnd, inputMode, transcript]);

  const handleMicRationaleClose = useCallback(() => {
    hasSeenMicRationaleRef.current = true;
    setShowMicRationaleSheet(false);
  }, []);

  const handleMicRationaleAllow = useCallback(async () => {
    hasSeenMicRationaleRef.current = true;
    setShowMicRationaleSheet(false);
    recordingTransitionRef.current = true;
    try {
      await startRecording();
    } finally {
      recordingTransitionRef.current = false;
    }
  }, [startRecording]);

  const handleMicRationaleUseText = useCallback(async () => {
    hasSeenMicRationaleRef.current = true;
    setShowMicRationaleSheet(false);
    await switchToTextMode();
  }, [switchToTextMode]);

  return (
    <>
      <View
        style={styles.gradient}
      >
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <AtmosphereBackground />
        {isDesktopWeb ? (
          <Pressable
            onPress={closeRecording}
            style={[
              styles.desktopCloseButton,
              {
                top: Math.max(insets.top, 12),
                backgroundColor: noctalia.surface.raised,
                borderColor: noctalia.surface.border,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={t('nav.home')}
            testID={TID.Button.RecordingHome}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <IconSymbol name="chevron.left" size={22} color={noctalia.accent.text} />
          </Pressable>
        ) : null}
        <KeyboardAvoidingView
          behavior="height"
          style={styles.keyboardView}
        >
          <ScrollView
            ref={scrollViewRef}
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            testID={TID.Screen.Recording}
          >
            <MockNavigationRail />
            <View style={mainContentStyle}>
              <View style={[styles.bodySection, isCompactLandscape && styles.bodySectionCompact]}>
                <RecordingInputModeSelect
                  value={inputMode}
                  disabled={interactionDisabled || isPreparingRecording}
                  onChange={handleInputModePreferenceChange}
                />

                <RecordingTextInput
                  compact={isCompactLandscape}
                  layout={inputMode === 'voice' ? 'voiceFirst' : 'textFirst'}
                  ref={textInputRef}
                  value={transcript}
                  onChange={handleTranscriptChange}
                  disabled={interactionDisabled}
                  lengthWarning={lengthWarning}
                  instructionText={
                    captureIntent === 'remembered'
                      ? t('recording.remembered.active_instruction')
                      : inputMode === 'voice'
                      ? t('recording.instructions')
                      : t('recording.instructions.text') || "Ou transcris ici les murmures de ton subconscient..."
                  }
                  switchToVoiceLabel={voiceControlLabel}
                  voiceSupported={isVoiceSupported}
                  voiceStatus={voiceControlStatus}
                  recordingDurationLabel={recordingDurationLabel}
                  showVoiceHint={showRecordingVoiceHint}
                  onVoiceHintDismiss={completeRecordingVoiceHint}
                  placeholder={
                    captureIntent === 'remembered'
                      ? t('recording.remembered.placeholder')
                      : t('recording.placeholder')
                  }
                  autoFocus={false}
                  onSwitchToVoice={handleVoiceCapturePress}
                  onOpenDetails={
                    captureIntent === 'remembered'
                      ? () => setShowRememberedDetailsSheet(true)
                      : undefined
                  }
                  onClear={handleClearTranscript}
                />

                <RecordingDraftProgress
                  value={transcript}
                  persisted={transcript.length > 0 && lastPersistedValue === transcript}
                />

              </View>

            </View>
          </ScrollView>
          <View pointerEvents="box-none" style={fixedFooterStyle} onLayout={handleFooterLayout}>
            <RecordingFooter
              onSave={handleSaveDream}
              isSaveDisabled={isSaveDisabled}
              saveButtonLabel={
                captureIntent === 'remembered'
                  ? t('recording.remembered.save_button')
                  : t('recording.button.save_dream')
              }
              saveButtonAccessibilityLabel={
                captureIntent === 'remembered'
                  ? t('recording.remembered.save_button_accessibility')
                  : t('recording.button.save_dream_accessibility', { defaultValue: t('recording.button.save_dream') })
              }
            />
          </View>
        </KeyboardAvoidingView>
        {!keyboardVisible && !isDesktopWeb ? (
          <NoctaliaBottomNav
            activeKey="addDream"
            addDreamIcon={inputMode === 'voice' ? 'mic' : 'pencil'}
            onBarLayout={handleBottomNavMeasure}
          />
        ) : null}
        {textFallbackNotice && isVoiceFallbackToastVisible ? (
          <Toast
            compact
            message={textFallbackNotice}
            mode="error"
            onHide={() => setIsVoiceFallbackToastVisible(false)}
            style={styles.voiceFallbackToast}
            testID={TID.Text.RecordingFallbackNotice}
          />
        ) : null}
      </View>

      <StandardBottomSheet
        visible={captureIntent === 'remembered' && showRememberedDetailsSheet}
        onClose={() => setShowRememberedDetailsSheet(false)}
        title={t('recording.remembered_profile.accordion_title')}
        subtitle={t('recording.remembered_profile.title')}
        actions={{
          primaryLabel: t('common.done'),
          onPrimary: () => setShowRememberedDetailsSheet(false),
          primaryDisabled: interactionDisabled || isPreparingRecording,
          primaryTestID: TID.Button.RememberedDreamDetailsDone,
        }}
        style={styles.rememberedDetailsSheet}
        testID={TID.Sheet.RememberedDreamDetails}
      >
        <ScrollView
          style={styles.rememberedDetailsScroll}
          contentContainerStyle={styles.rememberedDetailsContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <RememberedDreamProfileChips
            presentation="form"
            rememberedKind={rememberedKind}
            approximatePeriod={rememberedApproximatePeriod}
            strongestFragment={rememberedStrongestFragment}
            disabled={interactionDisabled || isPreparingRecording}
            onRememberedKindChange={setRememberedKind}
            onApproximatePeriodChange={setRememberedApproximatePeriod}
            onStrongestFragmentChange={setRememberedStrongestFragment}
          />
        </ScrollView>
      </StandardBottomSheet>

      <MicPermissionRationaleSheet
        visible={showMicRationaleSheet}
        onClose={handleMicRationaleClose}
        onAllow={handleMicRationaleAllow}
        onUseText={handleMicRationaleUseText}
      />
      <OfflineModelDownloadSheet
        visible={showOfflineModelSheet}
        onClose={handleOfflineModelSheetClose}
        locale={offlineModelLocale}
        onDownloadComplete={handleOfflineModelDownloadComplete}
      />
    </>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
    position: 'relative',
  },
  desktopCloseButton: {
    position: 'absolute',
    left: 16,
    zIndex: 50,
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyboardView: {
    flex: 1,
  },
  voiceFallbackToast: {
    top: 16,
    left: 16,
    zIndex: 120,
  },
  rememberedDetailsSheet: {
    maxHeight: '92%',
  },
  rememberedDetailsScroll: {
    flexShrink: 1,
    maxHeight: 500,
  },
  rememberedDetailsContent: {
    paddingBottom: 8,
  },
  scrollContent: {
    flexGrow: 1,
  },
  scrollView: {
    flex: 1,
  },
  mainContent: {
    flex: 1,
    justifyContent: 'flex-start',
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 24,
    position: 'relative',
  },
  mainContentCompact: {
    paddingVertical: 8,
  },
  bodySection: {
    flex: 1,
    justifyContent: 'flex-start',
    gap: 24,
  },
  bodySectionCompact: {
    gap: 12,
  },
  fixedFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    zIndex: 40,
  },
  keyboardFooter: {
    flexShrink: 0,
    paddingHorizontal: 16,
    zIndex: 40,
  },
});
