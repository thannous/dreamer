import { RecordingDurationLabel } from '@/components/recording/RecordingDurationLabel';
import { MockNavigationRail } from '@/components/dev/MockNavigationRail';
import { NoctaliaBottomNav } from '@/components/navigation/NoctaliaBottomNav';
import { NoctaliaScreenHeader } from '@/components/NoctaliaScreenHeader';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AtmosphereBackground } from '@/components/recording/AtmosphereBackground';
import { OfflineModelDownloadSheet } from '@/components/recording/OfflineModelDownloadSheet';
import { RecordingFooter } from '@/components/recording/RecordingFooter';
import { MicPermissionRationaleSheet } from '@/components/recording/RecordingSheets';
import { RecordingInputModeSelect } from '@/components/recording/RecordingInputModeSelect';
import { CaptureDraftEditor } from '@/components/recording/CaptureDraftEditor';
import { parseCaptureEditableDraft, serializeCaptureEditableDraft, updateCaptureDraftSection, type CaptureEditableDraft } from '@/lib/captureEditableDraft';
import { CaptureReviewPanel } from '@/components/recording/CaptureReviewPanel';
import { buildCaptureNarrative, decodeCaptureDraft, encodeCaptureReview, type CaptureReview } from '@/lib/captureReviewDraft';
import { RecordingConversation } from '@/components/recording/RecordingConversation';
import { useCaptureConversation } from '@/hooks/useCaptureConversation';
import { RecordingTextInput } from '@/components/recording/RecordingTextInput';
import { RecordingDraftProgress } from '@/components/recording/RecordingDraftProgress';
import { RecordingDraftHydrationNotice } from '@/components/recording/RecordingDraftHydrationNotice';
import { RememberedDreamProfileChips } from '@/components/recording/RememberedDreamProfileChips';
import { Toast } from '@/components/Toast';
import { StandardBottomSheet } from '@/components/ui/StandardBottomSheet';
import { DESKTOP_BREAKPOINT } from '@/constants/layout';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useAuth } from '@/context/AuthContext';
import { getSavedAnalysisAction } from '@/lib/savedAnalysisAccess';
import { useQuota } from '@/hooks/useQuota';
import { buildAnalysisPaywallHref } from '@/lib/paywallRoute';
import { useDreamsData, useDreamsActions } from '@/context/DreamsContext';
import { useLanguage } from '@/context/LanguageContext';
import { useOnboarding } from '@/context/OnboardingContext';
import { useQuickSettings } from '@/context/QuickSettingsContext';
import { useTheme } from '@/context/ThemeContext';
import { useRecordingDraftPersistence } from '@/hooks/useRecordingDraftPersistence';
import { useRecordingSession } from '@/hooks/useRecordingSession';
import { useTranslation } from '@/hooks/useTranslation';
import { blurActiveElement } from '@/lib/accessibility';
import {
  getRecordingDurationBucket,
  getTranscriptLengthBucket,
  trackProductEvent,
  trackDreamSaveMilestone,
} from '@/lib/analytics';
import {
  buildDraftDream as buildDraftDreamPure,
  buildRememberedDream,
} from '@/lib/dreamUtils';
import { isMockModeEnabled } from '@/lib/env';
import { DreamPersistenceError } from '@/lib/dreamStorageRead';
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
import { insertDictation, type DictationInsertion, type TranscriptSelection } from '@/lib/dictationInsertion';
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
  shouldRestartHandsFreeSpeech,
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
  BackHandler,
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

export default function RecordingScreen() {
  const { dreams } = useDreamsData();
  const {
    addDream,
    applyDreamCategorization,
  } = useDreamsActions();
  const { user } = useAuth();
  const { tier, quotaStatus, loading: quotaLoading, error: quotaError } = useQuota();
  const latestAccessRef = useRef({ user, tier, quotaStatus, quotaLoading, quotaError });
  useEffect(() => {
    latestAccessRef.current = { user, tier, quotaStatus, quotaLoading, quotaError };
  }, [user, tier, quotaStatus, quotaLoading, quotaError]);
  const { colors, mode } = useTheme();
  const { language } = useLanguage();
  const { t } = useTranslation();
  const openQuickSettings = useQuickSettings();
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
  const [editableCapture, setEditableCapture] = useState<CaptureEditableDraft | null>(null);
  const [captureReviewState, setCaptureReview] = useState<CaptureReview | null>(null);
  const captureReview = useMemo(() => captureReviewState && captureReviewState.text === captureReviewState.source
    ? { ...captureReviewState, text: buildCaptureNarrative(captureReviewState.source) }
    : captureReviewState, [captureReviewState]);
  const [reviewExitStep, setReviewExitStep] = useState<'options' | 'confirm' | null>(null);
  const [isLeavingReview, setIsLeavingReview] = useState(false);
  const leavingReviewRef = useRef(false);
  const [isFormatting, setIsFormatting] = useState(false);
  const formatRequestRef = useRef<AbortController | null>(null);
  const formatSourceRef = useRef<string | null>(null);
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [answerBase, setAnswerBase] = useState<string | null>(null);
  const answerInsertionRef = useRef<(DictationInsertion & { storyBase: string }) | null>(null);
  const [draftDream, setDraftDream] = useState<DreamAnalysis | null>(null);
  const saveInFlightRef = useRef(false);
  const [isPersisting, setIsPersisting] = useState(false);
  const [isRestartingCapture, setIsRestartingCapture] = useState(false);
  const [captureRestartCount, setCaptureRestartCount] = useState(0);
  const restartingCaptureRef = useRef(false);
  const discardDictationRef = useRef(false);
  const [isPreparingRecording, setIsPreparingRecording] = useState(false);
  const recordingTransitionRef = useRef(false);
  const baseTranscriptRef = useRef('');
  const transcriptSelectionRef = useRef<TranscriptSelection | undefined>(undefined);
  const [transcriptSelection, setTranscriptSelection] = useState<TranscriptSelection | undefined>();
  const dictationInsertionRef = useRef<DictationInsertion | null>(null);
  const dictationIntentRef = useRef<'idle' | 'listening' | 'paused'>('idle');
  const [dictationIntent, setDictationIntent] = useState<'idle' | 'listening' | 'paused'>('idle');
  const [isHandsFreeRestarting, setIsHandsFreeRestarting] = useState(false);
  const handsFreeRestartGenerationRef = useRef(0);
  const handsFreeRestartInFlightRef = useRef(false);
  const consecutiveEmptyHandsFreeRestartsRef = useRef(0);
  const handleRestoreDraft = useCallback((savedValue: string) => {
    const { transcript: savedTranscript, review } = decodeCaptureDraft(savedValue);
    setCaptureReview(review);
    setTranscript(savedTranscript);
    answerInsertionRef.current = null;
    setAnswerBase(null);
    setCurrentAnswer('');
    baseTranscriptRef.current = savedTranscript;
    dictationInsertionRef.current = null;
    transcriptSelectionRef.current = undefined;
    setTranscriptSelection(undefined);
  }, []);
  const persistedDraftValue = useMemo(
    () => captureReview ? encodeCaptureReview(captureReview) : transcript,
    [captureReview, transcript]
  );
  const { noteInput, persistBeforeExit, clearAfterSuccessfulSave, lastPersistedValue, isHydrated, hydrationStatus, retryHydration } = useRecordingDraftPersistence({
    transcript: persistedDraftValue,
    onRestore: handleRestoreDraft,
  });
  const conversation = useCaptureConversation({ language, t, scope: onboardingScope });
  const { ask: askCaptureQuestion, reset: resetConversation, cancel: cancelConversation, invalidateSource: invalidateCaptureSource } = conversation;
  useEffect(() => {
    // Preparing a review cannot outlive its screen or account scope.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsFormatting(false);
    return () => {
      formatRequestRef.current?.abort();
      formatRequestRef.current = null;
      formatSourceRef.current = null;
    };
  }, [onboardingScope]);
  // Freeze the question when an answer begins. Persist the pair as editable text
  // so draft restoration and analysis retain context without another AI request.
  const getAnswerInsertion = useCallback(() => {
    if (answerInsertionRef.current) return answerInsertionRef.current;
    const storyBase = baseTranscriptRef.current;
    const question = storyBase.trim()
      ? conversation.question ?? t('dream_recall.question.what_else')
      : null;
    const base = question
      ? `${storyBase}\n\n${t('recording.conversation.question_label')} ${question}\n${t('recording.conversation.answer_label')} `
      : storyBase;
    const insertion = { base, storyBase, selection: { start: base.length, end: base.length } };
    answerInsertionRef.current = insertion;
    setAnswerBase(storyBase);
    return insertion;
  }, [conversation.question, t]);
  const captureMicrophoneMutedRef = useRef(false);
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
  const interactionDisabled = isPersisting || isFormatting || isLeavingReview || isRestartingCapture || !isHydrated;
  const isCompactLandscape = viewportWidth > viewportHeight && viewportHeight < 600;
  const hasSaveableContent = useMemo(() => isTranscriptSaveable(captureReview?.text ??
    (editableCapture ?? parseCaptureEditableDraft(transcript)).sections.map(section => section.text).join('\n')),
    [captureReview, editableCapture, transcript]);
  const isSaveDisabled = !hasSaveableContent || interactionDisabled;
  const textInputRef = useRef<TextInput | null>(null);
  const scrollViewRef = useRef<React.ElementRef<typeof ScrollView> | null>(null);
  const lastInputSourceRef = useRef<RecordingInputModePreference>('text');
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
      if (!isHydrated || noteInput(text) !== true) return;
      lastInputSourceRef.current = 'text';
      if (!captureStartedTrackedRef.current && text.trim().length > 0) {
        captureStartedTrackedRef.current = true;
        void trackProductEvent('dream_capture_started', {
          input_mode: 'text',
          capture_context: captureIntent,
        });
      }
      answerInsertionRef.current = null;
      setAnswerBase(null);
      setCurrentAnswer('');
      setTranscript(text);
      baseTranscriptRef.current = text;
      dictationInsertionRef.current = null;
      transcriptSelectionRef.current = undefined;
      setTranscriptSelection(undefined);
    },
    [captureIntent, isHydrated, noteInput]
  );

  const applyDictationTranscript = useCallback((speech: string): boolean => {
    if (!isHydrated || discardDictationRef.current || restartingCaptureRef.current || formatSourceRef.current !== null || !speech.trim()) return false;
    const base = baseTranscriptRef.current;
    const insertion = dictationInsertionRef.current ?? {
      base,
      selection: transcriptSelectionRef.current ?? { start: base.length, end: base.length },
    };
    const result = insertDictation(insertion, speech);
    if (noteInput(result.text) !== true) return false;
    dictationInsertionRef.current = insertion;
    baseTranscriptRef.current = result.text;
    transcriptSelectionRef.current = result.selection;
    setTranscriptSelection(result.selection);
    setTranscript(result.text);
    if (answerInsertionRef.current) {
      setCurrentAnswer(result.text.slice(answerInsertionRef.current.base.length).trimStart());
    }
    return true;
  }, [isHydrated, noteInput]);

  const stopRecordingFromNativeEndRef = useRef<(() => void) | null>(null);

  const recordingSession = useRecordingSession({
    transcriptionLocale,
    t,
    onNativeEnd: () => {
      stopRecordingFromNativeEndRef.current?.();
    },
    onPartialTranscript: (text) => {
      if (applyDictationTranscript(text)) {
        consecutiveEmptyHandsFreeRestartsRef.current = 0;
      }
    },
  });

  const {
    isRecording,
    isSpeechListening,
    isRecordingRef,
    recordingPermissionState,
    startRecording: startSessionRecording,
    stopRecording: stopSessionRecording,
    forceStopRecording,
  } = recordingSession;

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
      dictationIntentRef.current = 'idle';
      handsFreeRestartGenerationRef.current += 1;
      handsFreeRestartInFlightRef.current = false;
      baseTranscriptRef.current = '';
      dictationInsertionRef.current = null;
      transcriptSelectionRef.current = undefined;
      void forceStopRecording('unmount');
      blurActiveElement();
    };
  }, [forceStopRecording]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        dictationIntentRef.current = 'idle';
        handsFreeRestartGenerationRef.current += 1;
        handsFreeRestartInFlightRef.current = false;
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
    setCaptureReview(null);
    setReviewExitStep(null);
    setEditableCapture(null);
    formatSourceRef.current = null;
    resetConversation();
    captureMicrophoneMutedRef.current = false;
    answerInsertionRef.current = null;
    setAnswerBase(null);
    setCurrentAnswer('');
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
    dictationInsertionRef.current = null;
    transcriptSelectionRef.current = undefined;
    setTranscriptSelection(undefined);
    captureStartedTrackedRef.current = false;
  }, [resetConversation]);

  const navigateToSavedDream = useCallback((
    dream: DreamAnalysis,
    options?: { saved?: boolean; recall?: boolean }
  ) => {
    const access = latestAccessRef.current;
    if (options?.saved && !options.recall && access.user && getSavedAnalysisAction({
      tier: access.tier, loading: access.quotaLoading, error: access.quotaError, status: access.quotaStatus,
    }) === 'upgrade') {
      void transitionOnboarding({ type: 'CLEAR_PENDING_INTENT' }).catch((error) => {
        log.warn('Failed to clear the completed capture intent', error);
      });
      router.replace(buildAnalysisPaywallHref(dream, access.user.id, { afterSave: true }));
      return;
    }
    // Unknown/offline access must not block durable capture or cause a later redirect.
    router.replace(buildJournalDetailHref(dream, options));
  }, [transitionOnboarding]);

  useEffect(() => {
    const pending = onboardingState.pendingRecordingIntent;
    if (
      saveInFlightRef.current
      || !pending?.savedDreamId
      || pending.phase === 'capture'
      || restoredPendingIntentRef.current === pending.entryId
    ) {
      return;
    }

    const savedDream = dreams.find((dream) => dream.id === pending.savedDreamId);
    if (!savedDream) return;
    restoredPendingIntentRef.current = pending.entryId;
    navigateToSavedDream(
      savedDream,
      pending.phase === 'analysis_confirmation' ? { saved: true } : undefined
    );
  }, [dreams, navigateToSavedDream, onboardingState.pendingRecordingIntent]);

  const handleVoiceCaptureFailure = useCallback((failure: VoiceCaptureFailure) => {
    setVoiceFallbackReason(failure);
    if (inputMode !== 'voice') {
      return;
    }

    const outcome = preserveVoiceModeAfterFailure(failure);
    setInputMode(outcome.inputMode);
    persistInputModePreference(outcome.preferenceToPersist);
  }, [inputMode, persistInputModePreference]);

  const setDictationIntentState = useCallback((next: 'idle' | 'listening' | 'paused') => {
    dictationIntentRef.current = next;
    setDictationIntent(next);
  }, []);

  const cancelHandsFreeRestart = useCallback(() => {
    handsFreeRestartGenerationRef.current += 1;
    handsFreeRestartInFlightRef.current = false;
    setIsHandsFreeRestarting(false);
  }, []);

  const speechPlatform = (
    Platform.OS === 'android' ? 'android' : Platform.OS === 'ios' ? 'ios' : 'web'
  ) as 'android' | 'ios' | 'web';

  const applyStoppedTranscript = applyDictationTranscript;

  const stopRecording = useCallback(async (options?: {
    silent?: boolean;
    reason?: 'pause' | 'stop' | 'background';
  }) => {
    const silent = options?.silent ?? false;
    const reason = options?.reason ?? 'stop';
    cancelHandsFreeRestart();
    setDictationIntentState(reason === 'pause' ? 'paused' : 'idle');
    try {
      setIsPreparingRecording(false);
      const result = await stopSessionRecording();
      const transcriptText = result.transcript?.trim() ?? '';

      if (applyStoppedTranscript(transcriptText)) {
        consecutiveEmptyHandsFreeRestartsRef.current = 0;
        return;
      }

      recordingStartedAtRef.current = null;
      if (silent || reason === 'pause' || reason === 'background') {
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
    } catch (err) {
      log.error('Failed to stop recording:', err);
      Alert.alert(t('common.error_title'), t('recording.alert.stop_failed'));
    } finally {
      hasAutoStoppedRecordingRef.current = false;
      if (inputMode === 'voice' && reason === 'pause') void askCaptureQuestion(baseTranscriptRef.current);
    }
  }, [
    askCaptureQuestion,
    inputMode,
    applyStoppedTranscript,
    cancelHandsFreeRestart,
    handleVoiceCaptureFailure,
    setDictationIntentState,
    stopSessionRecording,
    t,
  ]);

  const handleClearTranscript = useCallback(async () => {
    if (!isHydrated || isPersisting || restartingCaptureRef.current) return;
    restartingCaptureRef.current = true;
    discardDictationRef.current = true;
    setIsRestartingCapture(true);
    try {
      await stopRecording({ silent: true, reason: 'stop' });
      if (noteInput('') !== true) return;
      resetComposer();
      setInputMode('text');
      persistInputModePreference('text');
      setCaptureRestartCount(count => count + 1);
      Keyboard.dismiss();
    } finally {
      restartingCaptureRef.current = false;
      setIsRestartingCapture(false);
    }
  }, [isHydrated, isPersisting, noteInput, persistInputModePreference, resetComposer, stopRecording]);

  const handleRestartCapture = useCallback(() => {
    if (!isHydrated || isPersisting || restartingCaptureRef.current) return;
    Alert.alert(
      t('recording.conversation.restart_title'),
      t('recording.conversation.restart_message'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('recording.conversation.restart'), style: 'destructive',
          onPress: handleClearTranscript,
        },
      ]
    );
  }, [handleClearTranscript, isHydrated, isPersisting, t]);

  const startRecording = useCallback(async (options?: { preserveDraft?: boolean }) => {
    if (!isHydrated || restartingCaptureRef.current) return false;
    discardDictationRef.current = false;
    captureMicrophoneMutedRef.current = false;
    const previousIntent = dictationIntentRef.current;
    try {
      setIsPreparingRecording(true);
      setVoiceFallbackReason(null);
      if (!options?.preserveDraft) {
        baseTranscriptRef.current = transcript || baseTranscriptRef.current;
        consecutiveEmptyHandsFreeRestartsRef.current = 0;
      }

      let sourceTranscript = baseTranscriptRef.current || transcript;
      if (inputMode === 'voice') {
        const answerInsertion = getAnswerInsertion();
        // An unanswered question is only persisted once words are entered.
        if (sourceTranscript === answerInsertion.storyBase) sourceTranscript = answerInsertion.base;
        transcriptSelectionRef.current = { start: sourceTranscript.length, end: sourceTranscript.length };
      }
      dictationInsertionRef.current = {
        base: sourceTranscript,
        selection: transcriptSelectionRef.current ?? {
          start: sourceTranscript.length,
          end: sourceTranscript.length,
        },
      };
      const response = await startSessionRecording(sourceTranscript);
      if (response.success) {
        setDictationIntentState('listening');
        lastInputSourceRef.current = 'voice';
        if (!captureStartedTrackedRef.current) {
          captureStartedTrackedRef.current = true;
          void trackProductEvent('dream_capture_started', {
            input_mode: 'voice',
            capture_context: captureIntent,
          });
        }
        if (!recordingStartedAtRef.current) {
          recordingStartedAtRef.current = Date.now();
        }
        void trackProductEvent('recording_started', {
          input_mode: 'voice',
          language,
          speech_available: true,
          offline_model_state: 'unknown',
        });
        return true;
      }
      recordingStartedAtRef.current = null;
      setDictationIntentState(previousIntent === 'paused' ? 'paused' : 'idle');
      if (response.error === 'offline_model_not_ready') {
        return false;
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
        return false;
      }
      handleVoiceCaptureFailure('start_failed');
      Alert.alert(t('common.error_title'), t('recording.alert.start_failed'));
      return false;
    } finally {
      setIsPreparingRecording(false);
    }
  }, [captureIntent, getAnswerInsertion, handleVoiceCaptureFailure, inputMode, isHydrated, language, setDictationIntentState, startSessionRecording, t, transcript]);

  const handleUnexpectedNativeEnd = useCallback(async () => {
    if (inputMode === 'voice') {
      if (dictationIntentRef.current !== 'listening') return;
      captureMicrophoneMutedRef.current = true;
      await stopRecording({ silent: true, reason: 'stop' });
      return;
    }
    const canRestart = shouldRestartHandsFreeSpeech({
      platform: speechPlatform,
      dictationIntent: dictationIntentRef.current,
      stopRequested: false,
      restartInFlight: handsFreeRestartInFlightRef.current,
      consecutiveEmptyRestarts: consecutiveEmptyHandsFreeRestartsRef.current,
    });
    if (!canRestart) {
      if (handsFreeRestartInFlightRef.current || dictationIntentRef.current !== 'listening') {
        return;
      }
      await stopRecording({ silent: true, reason: 'pause' });
      return;
    }

    const generation = ++handsFreeRestartGenerationRef.current;
    handsFreeRestartInFlightRef.current = true;
    setIsHandsFreeRestarting(true);
    try {
      setIsPreparingRecording(false);
      const result = await stopSessionRecording();
      if (generation !== handsFreeRestartGenerationRef.current) {
        return;
      }
      const applied = applyStoppedTranscript(result.transcript ?? '');
      if (dictationIntentRef.current !== 'listening') {
        return;
      }
      if (applied) {
        consecutiveEmptyHandsFreeRestartsRef.current = 0;
      } else {
        consecutiveEmptyHandsFreeRestartsRef.current += 1;
      }
      if (
        !shouldRestartHandsFreeSpeech({
          platform: speechPlatform,
          dictationIntent: dictationIntentRef.current,
          stopRequested: false,
          restartInFlight: false,
          consecutiveEmptyRestarts: consecutiveEmptyHandsFreeRestartsRef.current,
        })
      ) {
        setDictationIntentState('paused');
        return;
      }
      const started = await startRecording({ preserveDraft: true });
      if (generation !== handsFreeRestartGenerationRef.current) {
        return;
      }
      if (!started) {
        setDictationIntentState('paused');
      }
    } catch (error) {
      log.warn('Hands-free speech restart failed', error);
      if (generation === handsFreeRestartGenerationRef.current) {
        setDictationIntentState('paused');
      }
    } finally {
      if (generation === handsFreeRestartGenerationRef.current) {
        handsFreeRestartInFlightRef.current = false;
        setIsHandsFreeRestarting(false);
      }
    }
  }, [
    inputMode,
    applyStoppedTranscript,
    setDictationIntentState,
    speechPlatform,
    startRecording,
    stopRecording,
    stopSessionRecording,
  ]);

  useEffect(() => {
    stopRecordingFromNativeEndRef.current = () => {
      void handleUnexpectedNativeEnd();
    };
    return () => {
      stopRecordingFromNativeEndRef.current = null;
    };
  }, [handleUnexpectedNativeEnd]);

  const toggleRecording = useCallback(async () => {
    if (!isHydrated || recordingTransitionRef.current) {
      return;
    }
    recordingTransitionRef.current = true;
    try {
      if (
        isRecordingRef.current
        || dictationIntentRef.current === 'listening'
        || handsFreeRestartInFlightRef.current
      ) {
        await stopRecording({ silent: true, reason: 'pause' });
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
  }, [isHydrated, isRecordingRef, recordingPermissionState, startRecording, stopRecording]);

  useEffect(() => {
    const keepAlive = isRecording || dictationIntent === 'listening' || isHandsFreeRestarting;
    if (!keepAlive) {
      return;
    }

    hasAutoStoppedRecordingRef.current = false;

    const subscription = AppState.addEventListener('change', (state) => {
      if (
        (state === 'background' || state === 'inactive') &&
        !hasAutoStoppedRecordingRef.current
      ) {
        hasAutoStoppedRecordingRef.current = true;
        void stopRecording({ silent: true, reason: 'background' });
      }
    });

    return () => {
      subscription.remove();
    };
  }, [dictationIntent, isHandsFreeRestarting, isRecording, stopRecording]);

  const handleSaveDream = useCallback(async (completeWithHelp = false) => {
    if (!isHydrated || isPersisting || saveInFlightRef.current || formatRequestRef.current) return;
    saveInFlightRef.current = true;
    setIsPersisting(true);
    try {
      if (isRecordingRef.current || dictationIntentRef.current === 'listening') {
        await stopRecording({ silent: true, reason: 'stop' });
      }

      const latestSource = captureReview ? captureReview.text : baseTranscriptRef.current || transcript;
      if (!isTranscriptSaveable(latestSource)) {
        Alert.alert(t('recording.alert.empty.title'), t('recording.alert.empty.message'));
        return;
      }
      const latestTranscript = latestSource.trim();

      // Persist first. Optional AI categorization must never delay durable capture.
      const dreamToSave = draftDream && draftDream.transcript === latestTranscript
        ? draftDream
        : buildDraftDream(latestTranscript);

      // Keep the same capture identity if durable persistence fails and the user retries.
      const capturedDream = captureReview
        ? { ...dreamToSave, captureOriginalTranscript: captureReview.source }
        : dreamToSave;
      setDraftDream(capturedDream);
      const isNewDream = !dreams.some((dream) => dream.id === capturedDream.id);
      const isFirstDream = dreams.length === 0;
      const savedDream = await addDream(capturedDream);
      if (isNewDream) {
        void trackDreamSaveMilestone(isFirstDream);
      }
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
      restoredPendingIntentRef.current = onboardingState.pendingRecordingIntent?.entryId ?? null;
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
      navigateToSavedDream(savedDream, { saved: true, recall: completeWithHelp });
    } catch (error) {
      const message = error instanceof DreamPersistenceError
        ? t(
            error.operation === 'read'
              ? error.target === 'device'
                ? 'journal.persistence.read_device'
                : 'journal.persistence.read_cache'
              : error.target === 'device'
                ? 'journal.persistence.write_device'
                : 'journal.persistence.write_cache'
          )
        : error instanceof Error
          ? error.message
          : 'Unexpected error occurred. Please try again.';
      Alert.alert(t('common.error_title'), message);
    } finally {
      saveInFlightRef.current = false;
      setIsPersisting(false);
    }
  }, [
    addDream,
    applyDreamCategorization,
    buildDraftDream,
    captureIntent,
    captureReview,
    clearAfterSuccessfulSave,
    draftDream,
    dreams,
    isHydrated,
    isPersisting,
    isRecordingRef,
    language,
    navigateToSavedDream,
    onboardingState.pendingRecordingIntent,
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
  const openReviewExit = useCallback(() => {
    if (!captureReview || interactionDisabled || leavingReviewRef.current) return;
    Keyboard.dismiss();
    setReviewExitStep('options');
  }, [captureReview, interactionDisabled]);

  const dismissReviewExit = useCallback(() => {
    if (leavingReviewRef.current) return;
    setReviewExitStep(step => step === 'confirm' ? 'options' : null);
  }, []);

  const leaveReview = useCallback(async (discard: boolean) => {
    if (!captureReview || !isHydrated || isPersisting || leavingReviewRef.current) return;
    leavingReviewRef.current = true;
    setIsLeavingReview(true);
    try {
      const saved = await persistBeforeExit(discard ? '' : encodeCaptureReview(captureReview));
      if (!saved) {
        Alert.alert(t('common.error_title'), t('recording.review.exit_error'));
        return;
      }
      if (discard) resetComposer();
      setReviewExitStep(null);
      router.replace('/(tabs)');
    } finally {
      leavingReviewRef.current = false;
      setIsLeavingReview(false);
    }
  }, [captureReview, isHydrated, isPersisting, persistBeforeExit, resetComposer, t]);

  const fixedFooterBottomOffset = keyboardVisible
    ? insets.bottom
    : isDesktopWeb || editableCapture
      ? insets.bottom
      : Math.max(bottomNavHeight, insets.bottom);
  // Keep the scroll viewport above Save and navigation at every text size.
  // Content padding alone still lets the draft status paint behind the button.
  const separateFooterViewport = !keyboardVisible;
  // In short landscape windows, keep Save in the scroll document so its
  // reserved area cannot squeeze the editor out of the viewport.
  const inlineFooter = isCompactLandscape;
  const scrollBottomReservation = separateFooterViewport
    ? fixedFooterBottomOffset + (inlineFooter ? 0 : footerHeight)
    : 0;
  const mainContentStyle = useMemo(
    () => [
      styles.mainContent,
      (inlineFooter || inputMode === 'voice' || !!editableCapture) && styles.inlineFooterContent,
      isCompactLandscape && styles.mainContentCompact,
      {
        paddingTop: 16,
        paddingBottom: inlineFooter
          ? 16 + (keyboardVisible ? insets.bottom : 0)
          : separateFooterViewport ? 16 : fixedFooterBottomOffset + footerHeight,
      },
    ],
    [
      fixedFooterBottomOffset,
      editableCapture,
      footerHeight,
      isCompactLandscape,
      separateFooterViewport,
      inlineFooter,
      inputMode,
      keyboardVisible,
      insets.bottom,
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
    // The voice reply sits above the full story: scrolling to the document end
    // would hide the focused answer when the keyboard opens.
    if (!keyboardVisible || footerHeight === 0 || inputMode === 'voice') {
      return;
    }

    const frame = requestAnimationFrame(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    });

    return () => cancelAnimationFrame(frame);
  }, [footerHeight, inputMode, keyboardVisible]);

  const focusTranscriptEnd = useCallback((value: string) => {
    const len = value.length;
    transcriptSelectionRef.current = { start: len, end: len };
    setTranscriptSelection({ start: len, end: len });
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

  const isVoiceListening = isSpeechListening;
  const recordingDurationLabel = isVoiceListening
    ? <RecordingDurationLabel startedAtRef={recordingStartedAtRef} />
    : undefined;
  const voiceControlStatus = isPreparingRecording && !isVoiceListening
    ? 'preparing'
    : isVoiceListening
      ? 'recording'
      : 'idle';
  const voiceControlLabel = useMemo(() => {
    if (isVoiceListening) {
      return t('recording.mic.pause');
    }
    if (isPreparingRecording) {
      return t('recording.status.preparing.title');
    }
    if (voiceFallbackReason) {
      return t('recording.status.retry_voice');
    }
    if (dictationIntent === 'paused' || trimmedTranscript) {
      return t('recording.mic.resume');
    }
    return t('recording.mode.switch_to_voice');
  }, [dictationIntent, isPreparingRecording, isVoiceListening, t, trimmedTranscript, voiceFallbackReason]);
  const showRecordingVoiceHint = hydrationStatus === 'ready'
    && recordingVoiceHintLoadedScope === onboardingScope
    && !recordingVoiceHintDismissed
    && captureIntent === 'fresh'
    && inputMode === 'voice'
    && !isPreparingRecording
    && !isVoiceListening;
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
    answerInsertionRef.current = null;
    setAnswerBase(null);
    setCurrentAnswer('');
    if (isRecordingRef.current || dictationIntentRef.current === 'listening') {
      recordingTransitionRef.current = true;
      try {
        await stopRecording({ silent: true, reason: 'stop' });
      } finally {
        recordingTransitionRef.current = false;
      }
    }
    setVoiceFallbackReason(null);
    setInputMode('text');
    persistInputModePreference('text');
    focusTranscriptEnd(baseTranscriptRef.current || transcript);
  }, [focusTranscriptEnd, isRecordingRef, persistInputModePreference, stopRecording, transcript]);

  const closeCaptureEditor = useCallback(() => {
    Keyboard.dismiss();
    setEditableCapture(null);
  }, []);

  const isAdjustingCapture = editableCapture !== null;
  useFocusEffect(useCallback(() => {
    if (!isAdjustingCapture && !captureReview) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (formatRequestRef.current || leavingReviewRef.current || isPersisting) return true;
      if (keyboardVisible) {
        Keyboard.dismiss();
        return true;
      }
      if (captureReview) {
        if (reviewExitStep) dismissReviewExit();
        else openReviewExit();
        return true;
      }
      closeCaptureEditor();
      return true;
    });
    return () => subscription.remove();
  }, [isAdjustingCapture, captureReview, closeCaptureEditor, dismissReviewExit, isPersisting, keyboardVisible, openReviewExit, reviewExitStep]));

  const openCaptureEditor = useCallback(async () => {
    if (!isHydrated || interactionDisabled || recordingTransitionRef.current) return;
    recordingTransitionRef.current = true;
    captureMicrophoneMutedRef.current = true;
    cancelConversation();
    try {
      if (isRecordingRef.current || dictationIntentRef.current === 'listening') {
        await stopRecording({ silent: true, reason: 'stop' });
      }
      // Stop first so the editor includes the final words of the current answer.
      answerInsertionRef.current = null;
      dictationInsertionRef.current = null;
      setAnswerBase(null);
      setCurrentAnswer('');
      setEditableCapture(parseCaptureEditableDraft(baseTranscriptRef.current || transcript));
      Keyboard.dismiss();
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
    } finally {
      recordingTransitionRef.current = false;
    }
  }, [cancelConversation, interactionDisabled, isHydrated, isRecordingRef, stopRecording, transcript]);

  const handleCaptureSectionChange = useCallback((index: number, text: string) => {
    if (!editableCapture || interactionDisabled) return;
    const draft = updateCaptureDraftSection(editableCapture, index, text);
    const source = serializeCaptureEditableDraft(draft);
    if (!noteInput(source)) return;
    if (source !== baseTranscriptRef.current) invalidateCaptureSource(baseTranscriptRef.current);
    setEditableCapture(draft);
    baseTranscriptRef.current = source;
    setTranscript(source);
  }, [invalidateCaptureSource, editableCapture, interactionDisabled, noteInput]);

  const handleInputModePreferenceChange = useCallback(
    async (preference: RecordingInputModePreference) => {
      if (!isHydrated || preference === inputMode) {
        return;
      }

      answerInsertionRef.current = null;
      setAnswerBase(null);
      setCurrentAnswer('');
      setVoiceFallbackReason(null);

      if (preference === 'text' && (isRecordingRef.current || dictationIntentRef.current === 'listening')) {
        recordingTransitionRef.current = true;
        try {
          await stopRecording({ silent: true, reason: 'stop' });
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
      isHydrated,
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
    if (!isHydrated) return;
    completeRecordingVoiceHint();
    setVoiceFallbackReason(null);
    await toggleRecording();
  }, [completeRecordingVoiceHint, isHydrated, toggleRecording]);

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
    if (!isHydrated) return;
    hasSeenMicRationaleRef.current = true;
    setShowMicRationaleSheet(false);
    recordingTransitionRef.current = true;
    try {
      await startRecording();
    } finally {
      recordingTransitionRef.current = false;
    }
  }, [isHydrated, startRecording]);

  const handleMicRationaleUseText = useCallback(async () => {
    hasSeenMicRationaleRef.current = true;
    setShowMicRationaleSheet(false);
    await switchToTextMode();
  }, [switchToTextMode]);

  useEffect(() => {
    if (!conversation.needsDecision && !editableCapture && !captureReview && !isFormatting && inputMode === 'voice' && isHydrated && !isRecordingRef.current && !answerInsertionRef.current && !captureMicrophoneMutedRef.current) {
      void askCaptureQuestion(baseTranscriptRef.current);
    }
  }, [askCaptureQuestion, conversation.needsDecision, captureReview, editableCapture, isFormatting, inputMode, isHydrated, isRecordingRef]);

  const handleConversationAnswerChange = useCallback((text: string) => {
    if (!isHydrated) return;
    const insertion = getAnswerInsertion();
    const result = text.trim()
      ? insertDictation(insertion, text)
      : { text: insertion.storyBase, selection: { start: insertion.storyBase.length, end: insertion.storyBase.length } };
    if (noteInput(result.text) !== true) return;
    answerInsertionRef.current = insertion;
    setAnswerBase(insertion.storyBase);
    setCurrentAnswer(text);
    dictationInsertionRef.current = null;
    baseTranscriptRef.current = result.text;
    setTranscript(result.text);
    transcriptSelectionRef.current = result.selection;
  }, [getAnswerInsertion, isHydrated, noteInput]);

  const handleValidateCapture = useCallback(async () => {
    if (!isHydrated || isPersisting || formatRequestRef.current) return;
    const controller = new AbortController();
    formatRequestRef.current = controller;
    setIsFormatting(true);
    cancelConversation();
    captureMicrophoneMutedRef.current = true;
    try {
      if (isRecordingRef.current || dictationIntentRef.current === 'listening') {
        await stopRecording({ silent: true, reason: 'stop' });
      }
      if (controller.signal.aborted) return;
      const source = baseTranscriptRef.current || transcript;
      if (!isTranscriptSaveable(source)) return;
      formatSourceRef.current = source;
      // Keep narrator words in the review and questions in the original exchanges.
      const text = buildCaptureNarrative(source);
      if (controller.signal.aborted || formatRequestRef.current !== controller) return;
      const review = { source, text };
      if (!noteInput(encodeCaptureReview(review))) return;
      setCaptureReview(review);
      setEditableCapture(null);
      Keyboard.dismiss();
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
    } catch {
      if (!controller.signal.aborted) {
        Alert.alert(t('common.error_title'), t('recording.review.error'), [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('recording.review.save_original'), onPress: () => { void handleSaveDream(); } },
        ]);
      }
    } finally {
      if (formatRequestRef.current === controller) {
        formatRequestRef.current = null;
        formatSourceRef.current = null;
        setIsFormatting(false);
      }
    }
  }, [cancelConversation, handleSaveDream, isHydrated, isPersisting, isRecordingRef, noteInput, stopRecording, t, transcript]);

  const saveButtonLabel = isFormatting ? t('recording.review.preparing')
    : captureReview ? t('recording.button.save_dream')
    : inputMode === 'voice' || editableCapture ? t('recording.review.validate')
    : captureIntent === 'remembered' ? t('recording.remembered.save_button') : t('recording.button.save_dream');
  const saveFooter = (
    <RecordingFooter
      onSave={() => { void ((inputMode === 'voice' || editableCapture) && !captureReview ? handleValidateCapture() : handleSaveDream()); }}
      isSaveDisabled={isSaveDisabled}
      saveButtonLabel={saveButtonLabel}
      saveButtonAccessibilityLabel={saveButtonLabel}
    />
  );

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
        {inputMode === 'text' && !editableCapture ? <AtmosphereBackground /> : null}
        {isDesktopWeb ? (
          <Pressable
            onPress={captureReview ? openReviewExit : closeRecording}
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
          style={[styles.keyboardView, { paddingTop: isDesktopWeb ? insets.top : 0 }]}
        >
          <ScrollView
            ref={scrollViewRef}
            style={[
              styles.scrollView,
              separateFooterViewport && { marginBottom: scrollBottomReservation },
            ]}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            testID={TID.Screen.Recording}
            accessibilityState={{ busy: hydrationStatus === 'loading' }}
          >
            {!isDesktopWeb ? (
              <NoctaliaScreenHeader
                titleKey="nav.capture_dream"
                actions={[{
                  icon: 'gear',
                  onPress: openQuickSettings,
                  accessibilityLabel: t('nav.settings'),
                }]}
              />
            ) : null}
            <MockNavigationRail />
            <View style={mainContentStyle}>
              <View style={[styles.bodySection, isCompactLandscape && styles.bodySectionCompact]}>
                {!editableCapture ? <RecordingInputModeSelect
                  value={inputMode}
                  disabled={interactionDisabled || isPreparingRecording || !!captureReview}
                  onChange={handleInputModePreferenceChange}
                /> : null}

                <RecordingDraftHydrationNotice
                  hydrationStatus={hydrationStatus}
                  onRetry={retryHydration}
                  messages={{
                    loading: String(t('recording.draft_restore.loading')),
                    error: String(t('recording.draft_restore.error')),
                    retry: String(t('recording.draft_restore.retry')),
                  }}
                />

                {editableCapture ? <CaptureDraftEditor draft={editableCapture} disabled={interactionDisabled}
                  onChange={handleCaptureSectionChange} onClose={closeCaptureEditor} /> : captureReview ? <CaptureReviewPanel
                  text={captureReview.text} source={captureReview.source} disabled={interactionDisabled} onExit={openReviewExit}
                  onChange={(text) => {
                    if (leavingReviewRef.current) return;
                    const review = { ...captureReview, text };
                    if (noteInput(encodeCaptureReview(review))) setCaptureReview(review);
                  }}
                /> : inputMode === 'voice' ? (
                  <RecordingConversation
                    key={captureRestartCount}
                    onRestart={handleRestartCapture}
                    transcript={transcript}
                    answer={currentAnswer}
                    storyTranscript={conversation.done ? buildCaptureNarrative(answerBase ?? transcript) : answerBase ?? transcript}
                    question={conversation.question}
                    loading={conversation.loading}
                    unavailable={conversation.unavailable}
                    done={conversation.done}
                    needsDecision={conversation.needsDecision}
                    onContinueQuestions={async () => {
                      const done = await askCaptureQuestion(baseTranscriptRef.current);
                      if (done) await handleValidateCapture();
                    }}
                    onFinish={() => { void handleValidateCapture(); }}
                    disabled={interactionDisabled}
                    voiceSupported={isVoiceSupported}
                    voiceStatus={voiceControlStatus}
                    onVoice={handleVoiceCapturePress}
                    onMute={() => {
                      captureMicrophoneMutedRef.current = true;
                      return stopRecording({ silent: true, reason: 'stop' });
                    }}
                    onReview={openCaptureEditor}
                    onAnswerChange={handleConversationAnswerChange}
                    onAnswerSubmit={async () => {
                      captureMicrophoneMutedRef.current = true;
                      if (isRecordingRef.current || dictationIntentRef.current === 'listening') {
                        await stopRecording({ silent: true, reason: 'stop' });
                      }
                      answerInsertionRef.current = null;
                      setAnswerBase(null);
                      setCurrentAnswer('');
                      captureMicrophoneMutedRef.current = false;
                      const done = await askCaptureQuestion(baseTranscriptRef.current);
                      if (done) await handleValidateCapture();
                      Keyboard.dismiss();
                    }}
                  />
                ) : <RecordingTextInput
                  compact={isCompactLandscape}
                  layout="textFirst"
                  ref={textInputRef}
                  value={transcript}
                  onChange={handleTranscriptChange}
                  selection={transcriptSelection}
                  onSelectionChange={({ nativeEvent: { selection } }) => {
                    transcriptSelectionRef.current = selection;
                    setTranscriptSelection(selection);
                  }}
                  disabled={interactionDisabled}
                  lengthWarning={lengthWarning}
                  instructionText={
                    captureIntent === 'remembered'
                      ? t('recording.remembered.active_instruction')
                      : t('recording.write.instruction')
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
                  onEditTranscript={switchToTextMode}
                  onOpenDetails={
                    captureIntent === 'remembered'
                      ? () => setShowRememberedDetailsSheet(true)
                      : undefined
                  }
                  onClear={handleClearTranscript}
                />}

                {hydrationStatus === 'ready' && !editableCapture ? (
                  <RecordingDraftProgress
                    compact={inputMode === 'voice'}
                    value={captureReview?.text ?? transcript}
                    persisted={transcript.length > 0 && lastPersistedValue === persistedDraftValue}
                  />
                ) : null}

              </View>

              {inlineFooter ? saveFooter : null}
            </View>
          </ScrollView>
          {!inlineFooter ? (
            <View pointerEvents="box-none" style={fixedFooterStyle} onLayout={handleFooterLayout}>
              {saveFooter}
            </View>
          ) : null}
        </KeyboardAvoidingView>
        {!keyboardVisible && !isDesktopWeb && !editableCapture ? (
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
        visible={reviewExitStep !== null}
        onClose={dismissReviewExit}
        title={t(reviewExitStep === 'confirm' ? 'recording.review.discard_title' : 'recording.review.exit_title')}
        subtitle={reviewExitStep === 'confirm' ? t('recording.review.discard_message') : undefined}
        bodyScrollEnabled={false}
        dismissBehavior={isLeavingReview ? 'none' : 'pan'}
        testID="capture-review-exit-sheet"
        actions={reviewExitStep === 'confirm' ? {
          primaryLabel: t('recording.review.discard_confirm'),
          primaryVariant: 'danger',
          onPrimary: () => { void leaveReview(true); },
          primaryLoading: isLeavingReview,
          primaryTestID: 'capture-review-discard-confirm',
          secondaryLabel: t('common.cancel'),
          onSecondary: dismissReviewExit,
          secondaryDisabled: isLeavingReview,
          secondaryTestID: 'capture-review-discard-cancel',
        } : {
          primaryLabel: t('recording.review.keep_later'),
          onPrimary: () => { void leaveReview(false); },
          primaryLoading: isLeavingReview,
          primaryTestID: 'capture-review-keep',
          secondaryLabel: t('recording.review.discard'),
          onSecondary: () => { if (!leavingReviewRef.current) setReviewExitStep('confirm'); },
          secondaryDisabled: isLeavingReview,
          secondaryTestID: 'capture-review-discard',
          linkLabel: t('recording.review.continue'),
          onLink: dismissReviewExit,
          linkTestID: 'capture-review-continue',
        }}
      />

      <StandardBottomSheet
        visible={captureIntent === 'remembered' && showRememberedDetailsSheet}
        bodyScrollEnabled={false}
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
  inlineFooterContent: {
    // Let the document grow with the editor and Save instead of shrinking it
    // to the small landscape viewport.
    flex: 0,
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
