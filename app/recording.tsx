import { AnalysisProgress } from '@/components/analysis/AnalysisProgress';
import { MockNavigationRail } from '@/components/dev/MockNavigationRail';
import { SubjectProposition } from '@/components/journal/SubjectProposition';
import { NoctaliaBottomNav } from '@/components/navigation/NoctaliaBottomNav';
import { AtmosphereBackground } from '@/components/recording/AtmosphereBackground';
import { OfflineModelDownloadSheet } from '@/components/recording/OfflineModelDownloadSheet';
import { RecordingOnboardingTour } from '@/components/recording/RecordingOnboardingTour';
import { RecordingFooter } from '@/components/recording/RecordingFooter';
import {
  AnalyzePromptSheet,
  FirstDreamSheet,
  GuestLimitSheet,
  MicPermissionRationaleSheet,
  PostSaveOfferSheet,
  QuotaLimitSheet,
  ReferenceImageSheet,
  type AnalysisOfferPrimaryAction,
  type AnalysisOfferQuotaState,
} from '@/components/recording/RecordingSheets';
import { RecordingInputModeSelect } from '@/components/recording/RecordingInputModeSelect';
import { RecordingTextInput } from '@/components/recording/RecordingTextInput';
import { RememberedDreamProfileChips } from '@/components/recording/RememberedDreamProfileChips';
import { Toast } from '@/components/Toast';
import { StandardBottomSheet } from '@/components/ui/StandardBottomSheet';
import { RECORDING } from '@/constants/appConfig';
import { DESKTOP_BREAKPOINT } from '@/constants/layout';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useAuth } from '@/context/AuthContext';
import { useDreams } from '@/context/DreamsContext';
import { useLanguage } from '@/context/LanguageContext';
import { useOnboarding } from '@/context/OnboardingContext';
import { useTheme } from '@/context/ThemeContext';
import { AnalysisStep, useAnalysisProgress } from '@/hooks/useAnalysisProgress';
import { useQuota } from '@/hooks/useQuota';
import { useRecordingSession } from '@/hooks/useRecordingSession';
import { useTranslation } from '@/hooks/useTranslation';
import { blurActiveElement } from '@/lib/accessibility';
import { signOut } from '@/lib/auth';
import { buildFirstValueProperties } from '@/lib/activationAnalytics';
import { isResumableAnalysisRequest } from '@/lib/analysisRequest';
import {
  getRecordingDurationBucket,
  getTranscriptLengthBucket,
  getTranscriptLengthBucketFromLength,
  trackProductEvent,
  type AnalyticsEventMap,
} from '@/lib/analytics';
import {
  buildDraftDream as buildDraftDreamPure,
  buildRememberedDream,
} from '@/lib/dreamUtils';
import { isMockModeEnabled, isReferenceImagesEnabled } from '@/lib/env';
import { classifyError, QuotaError, QuotaErrorCode, type ClassifiedError } from '@/lib/errors';
import { isGuestDreamLimitReached } from '@/lib/guestLimits';
import { getTranscriptionLocale } from '@/lib/locale';
import { createScopedLogger } from '@/lib/logger';
import {
  parseRecordingRouteParams,
  resolvePendingAnalysisRestart,
  resolveRecordingEntryIntent,
  type RecordingRouteParams,
} from '@/lib/onboardingState';
import { buildPaywallHref } from '@/lib/paywallRoute';
import {
  type RecordingCaptureIntent,
  resolveRememberedCaptureSource,
  type RememberedCaptureSource,
} from '@/lib/recordingActivation';
import {
  preserveVoiceModeAfterFailure,
  type VoiceFallbackReason,
} from '@/lib/recordingVoiceMode';
import { getRecordingDraftProgress } from '@/lib/recordingDraftProgress';
import {
  getRecordingActivationInsight,
  type RecordingActivationInsight,
} from '@/lib/recordingActivationInsight';
import { combineTranscript as combineTranscriptPure } from '@/lib/transcriptMerge';
import { TID } from '@/lib/testIDs';
import type {
  DreamAnalysis,
  DreamApproximatePeriod,
  DreamStrongestFragment,
  RecordingInputModePreference,
  ReferenceImage,
  RememberedDreamKind,
} from '@/lib/types';
import { categorizeDream, generateImageWithReference } from '@/services/geminiService';
import {
  registerOfflineModelPromptHandler,
  type OfflineModelPromptHandler,
} from '@/services/nativeSpeechRecognition';
import { getGuestRecordedDreamCount } from '@/services/quota/GuestDreamCounter';
import {
  getRecordingInputModePreference,
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
  type LayoutChangeEvent,
  Platform,
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
type ActivationInsightSurface = AnalyticsEventMap['recording_activation_insight_shown']['surface'];
type ActivationInsightCaptureContext =
  AnalyticsEventMap['recording_activation_insight_shown']['capture_context'];

const getDreamActivationInsightCaptureContext = (
  dream: DreamAnalysis | null
): ActivationInsightCaptureContext =>
  dream?.memory?.origin === 'remembered' ? 'remembered' : 'fresh';

const getSavedDreamActivationInsight = (dream: DreamAnalysis | null) => {
  if (!dream) {
    return null;
  }

  const memory = dream.memory;

  return getRecordingActivationInsight({
    transcript: dream.transcript,
    captureIntent: getDreamActivationInsightCaptureContext(dream),
    rememberedKind: memory?.rememberedKind,
    approximatePeriod: memory?.approximatePeriod,
    strongestFragment: memory?.strongestFragment,
  });
};

const formatRecordingDuration = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

export default function RecordingScreen() {
  const { addDream, updateDream, dreams, analyzeDream, reloadDreams } = useDreams();
  const { colors, mode } = useTheme();
  const { language } = useLanguage();
  const { t } = useTranslation();
  const { user } = useAuth();
  const {
    state: onboardingState,
    scope: onboardingScope,
    transition: transitionOnboarding,
  } = useOnboarding();
  const insets = useSafeAreaInsets();
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();
  const referenceImagesEnabled = isReferenceImagesEnabled();
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
  const [firstDreamPrompt, setFirstDreamPrompt] = useState<DreamAnalysis | null>(null);
  const [analyzePromptDream, setAnalyzePromptDream] = useState<DreamAnalysis | null>(null);
  const [pendingAnalysisDream, setPendingAnalysisDream] = useState<DreamAnalysis | null>(null);
  const [onboardingOfferDream, setOnboardingOfferDream] = useState<DreamAnalysis | null>(null);
  const [onboardingOfferKind, setOnboardingOfferKind] = useState<'analysis' | 'memory'>('analysis');
  const [analysisOfferError, setAnalysisOfferError] = useState(false);
  const [isPersisting, setIsPersisting] = useState(false);
  const [isPreparingRecording, setIsPreparingRecording] = useState(false);
  const [showGuestLimitSheet, setShowGuestLimitSheet] = useState(false);
  const [pendingGuestLimitDream, setPendingGuestLimitDream] = useState<DreamAnalysis | null>(null);
  const recordingTransitionRef = useRef(false);
  const baseTranscriptRef = useRef('');
  const [lengthWarning, setLengthWarning] = useState('');
  const analysisProgress = useAnalysisProgress();
  const hasAutoStoppedRecordingRef = useRef(false);
  const {
    canAnalyzeNow,
    tier,
    usage,
    quotaStatus,
    loading: quotaLoading,
    error: quotaError,
  } = useQuota();
  const [showQuotaLimitSheet, setShowQuotaLimitSheet] = useState(false);
  const [quotaSheetMode, setQuotaSheetMode] = useState<'limit' | 'error' | 'login'>('limit');
  const [quotaSheetMessage, setQuotaSheetMessage] = useState('');
  const [showMicRationaleSheet, setShowMicRationaleSheet] = useState(false);
  const [showOfflineModelSheet, setShowOfflineModelSheet] = useState(false);
  const [offlineModelLocale, setOfflineModelLocale] = useState('');
  const offlineModelPromptResolveRef = useRef<(() => void) | null>(null);
  const offlineModelPromptPromiseRef = useRef<Promise<void> | null>(null);
  const offlineModelSheetVisibleRef = useRef(false);
  const hasSeenMicRationaleRef = useRef(false);
  const recordingStartedAtRef = useRef<number | null>(null);
  const activationInsightTrackedSurfacesRef = useRef<Set<ActivationInsightSurface>>(new Set());
  const [recordingDurationSeconds, setRecordingDurationSeconds] = useState(0);
  const [voiceFallbackReason, setVoiceFallbackReason] = useState<VoiceFallbackReason>(null);
  const [isVoiceFallbackToastVisible, setIsVoiceFallbackToastVisible] = useState(false);
  const [recordingGuideVisible, setRecordingGuideVisible] = useState(false);
  const [recordingGuideStep, setRecordingGuideStep] = useState<0 | 1>(0);
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
  const analysisLaunchRef = useRef(false);
  const restoredPendingIntentRef = useRef<string | null>(null);
  const analysisOfferTrackedRef = useRef<Set<number>>(new Set());
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

  // Subject detection for reference image generation
  const [showSubjectProposition, setShowSubjectProposition] = useState(false);
  const [detectedSubjectType, setDetectedSubjectType] = useState<'person' | 'animal' | null>(null);
  const [showReferencePickerSheet, setShowReferencePickerSheet] = useState(false);
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([]);
  const [pendingSubjectDream, setPendingSubjectDream] = useState<DreamAnalysis | null>(null);
  const [pendingSubjectMetadata, setPendingSubjectMetadata] = useState<{
    title: string;
    theme?: string;
    dreamType?: string;
    hasPerson?: boolean | null;
    hasAnimal?: boolean | null;
    imagePrompt?: string;
  } | null>(null);

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
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
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
  const isAnalyzing = analysisProgress.step !== AnalysisStep.IDLE && analysisProgress.step !== AnalysisStep.COMPLETE;
  const interactionDisabled = isPersisting || isAnalyzing;
  const draftProgress = getRecordingDraftProgress(trimmedTranscript);
  const hasSaveableContent = draftProgress.state === 'ready' || draftProgress.state === 'full';
  const isSaveDisabled = !hasSaveableContent || interactionDisabled;
  const textInputRef = useRef<TextInput | null>(null);
  const scrollViewRef = useRef<React.ElementRef<typeof ScrollView> | null>(null);
  const lastInputSourceRef = useRef<RecordingInputModePreference>('text');
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
      return combineTranscriptPure({
        base,
        addition,
        maxChars: RECORDING.MAX_TRANSCRIPT_CHARS,
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

  const handleTranscriptChange = useCallback(
    (text: string) => {
      lastInputSourceRef.current = 'text';
      const { text: clamped, truncated } = clampTranscript(text);
      if (!captureStartedTrackedRef.current && clamped.trim().length > 0) {
        captureStartedTrackedRef.current = true;
        void trackProductEvent('dream_capture_started', {
          input_mode: 'text',
          capture_context: captureIntent,
        });
      }
      setTranscript(clamped);
      baseTranscriptRef.current = clamped;
      setLengthWarning(truncated ? lengthLimitMessage() : '');
    },
    [captureIntent, clampTranscript, lengthLimitMessage]
  );

  const stopRecordingFromPartialRef = useRef<(() => void) | null>(null);

  const recordingSession = useRecordingSession({
    transcriptionLocale,
    t,
    onPartialTranscript: (text) => {
      const { text: combined, truncated } = combineTranscript(baseTranscriptRef.current, text);
      setTranscript(combined);
      baseTranscriptRef.current = combined;
      setLengthWarning(truncated ? lengthLimitMessage() : '');
      if (truncated) {
        stopRecordingFromPartialRef.current?.();
      }
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
    analysisProgress.reset();
    setLengthWarning('');
    setVoiceFallbackReason(null);
    setCaptureIntent('fresh');
    setRememberedCaptureSource('journal');
    setRememberedKind(undefined);
    setRememberedApproximatePeriod(undefined);
    setRememberedStrongestFragment(undefined);
    baseTranscriptRef.current = '';
    captureStartedTrackedRef.current = false;
    activationInsightTrackedSurfacesRef.current.clear();
  }, [analysisProgress]);

  const handleClearTranscript = useCallback(() => {
    setTranscript('');
    setLengthWarning('');
    setVoiceFallbackReason(null);
    baseTranscriptRef.current = '';
    activationInsightTrackedSurfacesRef.current.clear();
  }, []);

  const navigateToJournalDetail = useCallback((dreamId: string | number) => {
    router.replace('/(tabs)/journal');
    requestAnimationFrame(() => {
      router.push(`/journal/${dreamId}`);
    });
  }, []);

  const navigateAfterSave = useCallback(
    (savedDream: DreamAnalysis, previousDreamCount: number, options?: { skipFirstDreamSheet?: boolean }) => {
      if (options?.skipFirstDreamSheet) {
        navigateToJournalDetail(savedDream.id);
        return;
      }

      if (previousDreamCount === 0) {
        setFirstDreamPrompt(savedDream);
        return;
      }

      setAnalyzePromptDream(savedDream);
    },
    [navigateToJournalDetail]
  );

  useEffect(() => {
    const pending = onboardingState.pendingRecordingIntent;
    if (
      !pending?.savedDreamId
      || pending.phase === 'capture'
      || restoredPendingIntentRef.current === pending.entryId
      || analysisLaunchRef.current
    ) {
      return;
    }

    const savedDream = dreams.find((dream) => dream.id === pending.savedDreamId);
    if (!savedDream) return;
    restoredPendingIntentRef.current = pending.entryId;
    const restartAction = resolvePendingAnalysisRestart(pending, savedDream);

    if (restartAction === 'view_result') {
      navigateToJournalDetail(savedDream.id);
      // The persisted result is already durable. Clear the request after
      // navigation so startup cannot loop back to recording.
      void transitionOnboarding({ type: 'CLEAR_PENDING_INTENT' }).catch(() => undefined);
      return;
    }

    // Restore the persisted external workflow once its saved dream is available.
    // A pending/failed request is never relaunched automatically: the retry CTA
    // reuses its persisted analysisRequestId and the server quota claim is
    // idempotent.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOnboardingOfferKind(
      pending.postSave === 'journal_first' ? 'memory' : 'analysis'
    );
    setOnboardingOfferDream(savedDream);
    setAnalysisOfferError(restartAction === 'offer_retry');
  }, [dreams, navigateToJournalDetail, onboardingState.pendingRecordingIntent, transitionOnboarding]);

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
        const onboardingPostSave = activePostSaveRef.current;
        if (onboardingPostSave) {
          activePostSaveRef.current = null;
          setOnboardingOfferKind(
            onboardingPostSave === 'confirm_analysis' ? 'analysis' : 'memory'
          );
          setOnboardingOfferDream(savedDream);
          setAnalysisOfferError(false);
          const pendingEvent = onboardingPostSave === 'confirm_analysis'
            ? {
                type: 'SET_PENDING_PHASE' as const,
                phase: 'analysis_confirmation' as const,
                savedDreamId: savedDream.id,
              }
            : { type: 'CLEAR_PENDING_INTENT' as const };
          try {
            await transitionOnboarding(pendingEvent);
          } catch (error) {
            if (onboardingPostSave === 'confirm_analysis') {
              setAnalysisOfferError(true);
            }
            if (__DEV__) {
              console.warn('[Recording] Failed to persist post-save onboarding phase', error);
            }
          }
          return;
        }
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
  }, [
    user,
    pendingGuestLimitDream,
    addDream,
    dreams.length,
    navigateAfterSave,
    resetComposer,
    t,
    transitionOnboarding,
  ]);

  // Show quota limit sheet (reusable for both guard and catch paths)
  const showQuotaSheet = useCallback((options?: { mode?: 'limit' | 'error' | 'login'; message?: string }) => {
    const modeToUse = options?.mode ?? 'limit';
    const message = options?.message ?? '';

    // Close existing sheets to avoid overlay
    if (firstDreamPrompt) setFirstDreamPrompt(null);
    if (analyzePromptDream) setAnalyzePromptDream(null);

    // Don't show upsell for paid tiers (edge case: network error)
    if (modeToUse === 'limit' && tier === 'plus') return false;

    setQuotaSheetMode(modeToUse);
    setQuotaSheetMessage(message);
    setShowQuotaLimitSheet(true);
    return true;
  }, [tier, firstDreamPrompt, analyzePromptDream]);

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
          baseTranscriptRef.current = transcriptText;
          setTranscript(transcriptText);
        } else {
          // Final is significantly different - combine with base
          const { text: combined, truncated } = combineTranscript(baseTranscriptRef.current, transcriptText);
          baseTranscriptRef.current = combined;
          setLengthWarning(truncated ? lengthLimitMessage() : '');
          setTranscript((prev) => (prev.trim() === combined.trim() ? prev : combined));
        }
      } else {
        recordingStartedAtRef.current = null;
        if (silent) {
          return;
        }
        if (result.error === 'rate_limited') {
          showQuotaSheet({ mode: 'error', message: t('error.rate_limit') });
          return;
        }
        if (result.error === 'stt_unavailable') {
          const outcome = preserveVoiceModeAfterFailure('stt_unavailable');
          setVoiceFallbackReason(outcome.fallbackReason);
          setInputMode(outcome.inputMode);
          persistInputModePreference(outcome.preferenceToPersist);
          return;
        }
        if (result.error === 'language_pack_missing') {
          const outcome = preserveVoiceModeAfterFailure('language_pack_missing');
          setVoiceFallbackReason(outcome.fallbackReason);
          setInputMode(outcome.inputMode);
          persistInputModePreference(outcome.preferenceToPersist);
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
        const outcome = preserveVoiceModeAfterFailure('no_speech');
        setVoiceFallbackReason(outcome.fallbackReason);
        setInputMode(outcome.inputMode);
        persistInputModePreference(outcome.preferenceToPersist);
      }
    } catch (err) {
      log.error('Failed to stop recording:', err);
      showQuotaSheet({ mode: 'error', message: t('recording.alert.stop_failed') });
    } finally {
      hasAutoStoppedRecordingRef.current = false;
    }
  }, [
    t,
    combineTranscript,
    lengthLimitMessage,
    normalizeForComparison,
    persistInputModePreference,
    showQuotaSheet,
    stopSessionRecording,
  ]);

  useEffect(() => {
    stopRecordingFromPartialRef.current = () => {
      void stopRecording({ silent: true });
    };
    return () => {
      stopRecordingFromPartialRef.current = null;
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
        setInputMode('voice');
        persistInputModePreference('voice');
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
        const outcome = preserveVoiceModeAfterFailure(response.error);
        setVoiceFallbackReason(outcome.fallbackReason);
        setInputMode(outcome.inputMode);
        persistInputModePreference(outcome.preferenceToPersist);
        return;
      }
      const outcome = preserveVoiceModeAfterFailure('start_failed');
      setVoiceFallbackReason(outcome.fallbackReason);
      setInputMode(outcome.inputMode);
      persistInputModePreference(outcome.preferenceToPersist);
      Alert.alert(t('common.error_title'), t('recording.alert.start_failed'));
    } finally {
      setIsPreparingRecording(false);
    }
  }, [captureIntent, language, persistInputModePreference, startSessionRecording, t, transcript]);

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
      let categorizationResult: Awaited<ReturnType<typeof categorizeDream>> | null = null;

      if (latestTranscript) {
        try {
          categorizationResult = await categorizeDream(latestTranscript, language);
          const preserveRememberedDreamType = dreamToSave.memory?.origin === 'remembered';
          dreamToSave = {
            ...dreamToSave,
            title: categorizationResult.title,
            theme: categorizationResult.theme,
            dreamType: preserveRememberedDreamType ? dreamToSave.dreamType : categorizationResult.dreamType,
            hasPerson: categorizationResult.hasPerson,
            hasAnimal: categorizationResult.hasAnimal,
          };

        } catch (err) {
          // Silently fail and proceed with default/derived values
          log.warn('Quick categorization failed:', err);
        }
      }

      const savedDream = await addDream(dreamToSave);
      setDraftDream(savedDream);
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
      if (onboardingPostSave) {
        const offerKind = onboardingPostSave === 'confirm_analysis' ? 'analysis' : 'memory';
        activePostSaveRef.current = null;
        setOnboardingOfferKind(offerKind);
        setOnboardingOfferDream(savedDream);
        setAnalysisOfferError(false);
        try {
          const pendingEvent = onboardingPostSave === 'confirm_analysis'
            ? {
                type: 'SET_PENDING_PHASE' as const,
                phase: 'analysis_confirmation' as const,
                savedDreamId: savedDream.id,
              }
            : { type: 'CLEAR_PENDING_INTENT' as const };
          await transitionOnboarding(pendingEvent);
        } catch (error) {
          if (onboardingPostSave === 'confirm_analysis') {
            setAnalysisOfferError(true);
          }
          if (__DEV__) {
            console.warn('[Recording] Failed to persist post-save onboarding phase', error);
          }
        }
        return;
      }
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
    captureIntent,
    dreams.length,
    draftDream,
    isRecordingRef,
    language,
    navigateAfterSave,
    resetComposer,
    stopRecording,
    t,
    transitionOnboarding,
    transcript,
    user,
  ]);


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
    navigateToJournalDetail(firstDreamPrompt.id);
  }, [firstDreamPrompt, navigateToJournalDetail]);

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

  const handleQuotaLimitDismiss = useCallback(() => {
    setShowQuotaLimitSheet(false);
    setQuotaSheetMode('limit');
    setQuotaSheetMessage('');
    // Clean up analysis state if needed
    if (pendingAnalysisDream) {
      setPendingAnalysisDream(null);
      analysisProgress.reset();
    }
  }, [pendingAnalysisDream, analysisProgress]);

  const handleMockQuotaReset = useCallback(async () => {
    if (!isMockMode || isPersisting) return;

    setIsPersisting(true);
    try {
      await signOut();
      await reloadDreams();
      handleQuotaLimitDismiss();
    } catch (error) {
      if (__DEV__) {
        console.warn('[Recording] Failed to reset mock quota state', error);
      }
      Alert.alert(t('common.error_title'), t('settings.account.alert.signout_failed.title'));
    } finally {
      setIsPersisting(false);
    }
  }, [handleQuotaLimitDismiss, isPersisting, reloadDreams, t]);

  const handleQuotaLimitPrimary = useCallback(() => {
    setShowQuotaLimitSheet(false);
    if (quotaSheetMode === 'login') {
      router.push('/(tabs)/settings?section=account');
      return;
    }
    if (tier === 'guest') {
      router.push('/(tabs)/settings');
      return;
    }
    router.push(buildPaywallHref('analysis_limit'));
  }, [quotaSheetMode, tier]);

  const handleQuotaLimitJournal = useCallback(() => {
    setShowQuotaLimitSheet(false);
    const dream = onboardingOfferDream ?? analyzePromptDream ?? pendingAnalysisDream;
    if (dream) {
      if (onboardingOfferDream) {
        setOnboardingOfferDream(null);
        setAnalysisOfferError(false);
        restoredPendingIntentRef.current = onboardingState.pendingRecordingIntent?.entryId ?? null;
        void transitionOnboarding({ type: 'CLEAR_PENDING_INTENT' }).catch(() => undefined);
      }
      navigateToJournalDetail(dream.id);
    } else {
      router.push('/(tabs)/journal');
    }
    // Cleanup
    setPendingAnalysisDream(null);
    analysisProgress.reset();
  }, [
    analyzePromptDream,
    pendingAnalysisDream,
    onboardingOfferDream,
    onboardingState.pendingRecordingIntent?.entryId,
    analysisProgress,
    navigateToJournalDetail,
    transitionOnboarding,
  ]);

  const runAnalysis = useCallback(async (dream: DreamAnalysis): Promise<boolean> => {
    setPendingAnalysisDream(dream);

    setIsPersisting(true);
    const preCount = dreams.length;
    try {
      analysisProgress.reset();
      analysisProgress.setStep(AnalysisStep.ANALYZING);
      requestAnimationFrame(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      });

      const analyzedDream = await analyzeDream(dream.id, dream.transcript, {
        replaceExistingImage: true,
        lang: language,
        analyticsSource: 'recording_flow',
        onProgress: (step) => {
          // Update progress as each phase completes
          analysisProgress.setStep(step);
        },
      });

      analysisProgress.setStep(AnalysisStep.COMPLETE);
      setPendingAnalysisDream(null);
      setOnboardingOfferDream(null);
      setAnalysisOfferError(false);
      resetComposer();
      await new Promise((resolve) => setTimeout(resolve, 300));
      navigateAfterSave(analyzedDream, preCount, { skipFirstDreamSheet: true });
      return true;
    } catch (error) {
      if (error instanceof QuotaError) {
        void trackProductEvent('analysis_failed', { stage: 'request', reason: 'quota' });
        const mode = error.code === QuotaErrorCode.LOGIN_REQUIRED && tier === 'guest' ? 'login' : 'limit';
        showQuotaSheet({ mode });
        analysisProgress.reset();
        return false;
      }
      void trackProductEvent('analysis_failed', { stage: 'request', reason: 'unknown' });
      const classified = classifyError(error as Error, t);
      analysisProgress.setError(classified);
      setPendingAnalysisDream(null);
      if (onboardingOfferDream) {
        setAnalysisOfferError(true);
        analysisProgress.reset();
      }
      return false;
    } finally {
      setIsPersisting(false);
      analysisLaunchRef.current = false;
    }
  }, [
    analysisProgress,
    analyzeDream,
    dreams.length,
    language,
    navigateAfterSave,
    onboardingOfferDream,
    resetComposer,
    showQuotaSheet,
    t,
    tier,
  ]);

  // Subject proposition handlers
  const handleSubjectAccept = useCallback(() => {
    setShowSubjectProposition(false);
    setShowReferencePickerSheet(true);
  }, []);

  const handleSubjectDismiss = useCallback(() => {
    setShowSubjectProposition(false);
    setDetectedSubjectType(null);
    const dream = pendingSubjectDream;
    const metadata = pendingSubjectMetadata;
    setPendingSubjectDream(null);
    setPendingSubjectMetadata(null);
    if (!dream) {
      return;
    }
    const dreamToAnalyze = metadata ? {
      ...dream,
      ...metadata,
      hasPerson: metadata.hasPerson,
      hasAnimal: metadata.hasAnimal,
    } as DreamAnalysis : dream;
    void runAnalysis(dreamToAnalyze);
  }, [pendingSubjectDream, pendingSubjectMetadata, runAnalysis]);

  const handleReferenceImagesSelected = useCallback((images: ReferenceImage[]) => {
    setReferenceImages(images);
  }, []);

  const handleReferencePickerClose = useCallback(() => {
    setShowReferencePickerSheet(false);
    setReferenceImages([]);
    setDetectedSubjectType(null);
    const dream = pendingSubjectDream;
    const metadata = pendingSubjectMetadata;
    setPendingSubjectDream(null);
    setPendingSubjectMetadata(null);
    if (!dream) {
      return;
    }
    const dreamToAnalyze = metadata ? {
      ...dream,
      ...metadata,
      hasPerson: metadata.hasPerson,
      hasAnimal: metadata.hasAnimal,
    } as DreamAnalysis : dream;
    void runAnalysis(dreamToAnalyze);
  }, [pendingSubjectDream, pendingSubjectMetadata, runAnalysis]);

  const handleGenerateWithReference = useCallback(async () => {
    if (!referenceImagesEnabled || !pendingSubjectDream || !pendingSubjectMetadata || referenceImages.length === 0) {
      return;
    }

    setShowReferencePickerSheet(false);
    setIsPersisting(true);

    try {
      analysisProgress.reset();
      analysisProgress.setStep(AnalysisStep.GENERATING_IMAGE);

      // Generate image with reference
      const imageUrl = await generateImageWithReference({
        transcript: pendingSubjectDream.transcript,
        prompt: pendingSubjectMetadata.imagePrompt ?? pendingSubjectDream.transcript,
        referenceImages,
        previousImageUrl: pendingSubjectDream.imageUrl || undefined,
        lang: language,
      });

      // Update dream with image and metadata
      const updatedDream: DreamAnalysis = {
        ...pendingSubjectDream,
        ...pendingSubjectMetadata,
        imageUrl,
        imageSource: 'ai',
        hasPerson: pendingSubjectMetadata.hasPerson,
        hasAnimal: pendingSubjectMetadata.hasAnimal,
      } as DreamAnalysis;

      await updateDream(updatedDream);

      analysisProgress.setStep(AnalysisStep.COMPLETE);
      setDraftDream(updatedDream);

      // Cleanup
      setPendingSubjectDream(null);
      setPendingSubjectMetadata(null);
      setReferenceImages([]);
      setDetectedSubjectType(null);
      resetComposer();

      await new Promise((resolve) => setTimeout(resolve, 300));
      navigateToJournalDetail(updatedDream.id);
    } catch (error) {
      log.error('Generate with reference failed:', error);
      const classified = error && typeof error === 'object' && 'userMessage' in error && 'canRetry' in error
        ? (error as ClassifiedError)
        : classifyError(error instanceof Error ? error : new Error('Unknown error'), t);
      analysisProgress.setError(classified);
    } finally {
      setIsPersisting(false);
    }
  }, [
    analysisProgress,
    language,
    navigateToJournalDetail,
    pendingSubjectDream,
    pendingSubjectMetadata,
    referenceImages,
    referenceImagesEnabled,
    resetComposer,
    t,
    updateDream,
  ]);

  const handleFirstDreamAnalyze = useCallback(async () => {
    const dream = onboardingOfferDream ?? firstDreamPrompt ?? analyzePromptDream ?? pendingAnalysisDream;
    if (!dream) {
      return;
    }
    if (analysisLaunchRef.current) return;
    const isPersistedRetry = isResumableAnalysisRequest(dream);
    if (!canAnalyzeNow && !isPersistedRetry) {
      // "canAnalyzeNow" is a local/optimistic gate; if we can't show a quota sheet (e.g., paid tier),
      // fall through and let the server-side quota enforcement decide.
      const mode = !user && quotaStatus?.isUpgraded ? 'login' : 'limit';
      const shown = showQuotaSheet({ mode });
      if (shown) return;
    }

    if (onboardingOfferDream) {
      analysisLaunchRef.current = true;
      setIsPersisting(true);
      setAnalysisOfferError(false);
      void trackProductEvent('first_dream_next_action_selected', {
        action: onboardingOfferKind === 'memory' ? 'analyze_memory' : 'launch_analysis',
      });
      try {
        await transitionOnboarding({
          type: 'SET_PENDING_PHASE',
          phase: 'analysis_requested',
          savedDreamId: dream.id,
        });
      } catch {
        analysisLaunchRef.current = false;
        setIsPersisting(false);
        setAnalysisOfferError(true);
        void trackProductEvent('analysis_failed', { stage: 'offer', reason: 'unknown' });
        return;
      }
    }

    if (firstDreamPrompt) {
      setFirstDreamPrompt(null);
    }
    if (analyzePromptDream) {
      setAnalyzePromptDream(null);
    }

    const shouldOfferReference = !onboardingOfferDream
      && !pendingAnalysisDream
      && referenceImagesEnabled
      && Boolean(user)
      && dream.hasPerson === true;

    if (shouldOfferReference) {
      setPendingSubjectDream(dream);
      setPendingSubjectMetadata({
        title: dream.title,
        theme: dream.theme,
        dreamType: dream.dreamType,
        hasPerson: dream.hasPerson,
        hasAnimal: dream.hasAnimal,
      });
      setDetectedSubjectType('person');
      setShowSubjectProposition(true);
      return;
    }

    await runAnalysis(dream);
  }, [
    analyzePromptDream,
    canAnalyzeNow,
    firstDreamPrompt,
    onboardingOfferDream,
    onboardingOfferKind,
    pendingAnalysisDream,
    quotaStatus?.isUpgraded,
    referenceImagesEnabled,
    runAnalysis,
    showQuotaSheet,
    transitionOnboarding,
    user,
  ]);

  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const gradientColors = noctalia.screen.gradient;
  const fixedFooterBottomOffset = keyboardVisible
    ? insets.bottom
    : viewportWidth < DESKTOP_BREAKPOINT
      ? Math.max(bottomNavHeight, insets.bottom)
      : insets.bottom;
  const mainContentStyle = useMemo(
    () => [
      styles.mainContent,
      {
        paddingTop: 16 + insets.top,
        paddingBottom: fixedFooterBottomOffset + (hasSaveableContent ? footerHeight : 0),
      },
    ],
    [fixedFooterBottomOffset, footerHeight, hasSaveableContent, insets.top]
  );
  const fixedFooterStyle = useMemo(
    () => [
      styles.fixedFooter,
      {
        bottom: fixedFooterBottomOffset,
      },
    ],
    [fixedFooterBottomOffset]
  );
  const subjectPropositionMarginBottom = useMemo(
    () => fixedFooterBottomOffset + (hasSaveableContent ? footerHeight : 0),
    [fixedFooterBottomOffset, footerHeight, hasSaveableContent]
  );
  const handleFooterLayout = useCallback((event: LayoutChangeEvent) => {
    const nextHeight = Math.ceil(event.nativeEvent.layout.height);
    setFooterHeight((current) => current === nextHeight ? current : nextHeight);
  }, []);
  const handleBottomNavMeasure = useCallback((event: LayoutChangeEvent) => {
    const nextHeight = Math.ceil(viewportHeight - event.nativeEvent.layout.y);
    setBottomNavHeight((current) => current === nextHeight ? current : nextHeight);
  }, [viewportHeight]);

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
    if (parsedRecordingParams.replayGuide) {
      // Route params are external navigation state and are consumed exactly once.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRecordingGuideStep(0);
      setRecordingGuideVisible(true);
      router.setParams({ replayGuide: undefined });
    }

    if (!resolvedRecordingEntryIntent) return;
    const routeEntryKey = resolvedRecordingEntryIntent.entryId;
    if (appliedRouteEntriesRef.current.has(routeEntryKey) || trimmedTranscript || draftDream) return;

    appliedRouteEntriesRef.current.add(routeEntryKey);
    activePostSaveRef.current = resolvedRecordingEntryIntent.postSave;
    if (resolvedRecordingEntryIntent.intent) {
      setCaptureIntent(resolvedRecordingEntryIntent.intent);
    }
    setRememberedCaptureSource(resolveRememberedCaptureSource(resolvedRecordingEntryIntent.source));
    setRememberedKind(undefined);
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
        postSave: undefined,
        next: undefined,
        mode: undefined,
        replayGuide: undefined,
      });
    }
  }, [
    draftDream,
    onboardingState.pendingRecordingIntent,
    parsedRecordingParams.entryId,
    parsedRecordingParams.mode,
    parsedRecordingParams.replayGuide,
    resolvedRecordingEntryIntent,
    trimmedTranscript,
  ]);

  const analyzePromptTranscript = analyzePromptDream?.transcript?.trim();
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
  const textFallbackNotice = useMemo(() => {
    if (!voiceFallbackReason) {
      return '';
    }

    const fallbackKeyByReason: Record<Exclude<VoiceFallbackReason, null>, string> = {
      permission_denied: 'recording.status.fallback.permission_denied',
      stt_unavailable: 'recording.status.fallback.stt_unavailable',
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
  const firstDreamActivationInsight = useMemo(
    () => getSavedDreamActivationInsight(firstDreamPrompt),
    [firstDreamPrompt]
  );
  const firstDreamIsRemembered = firstDreamPrompt?.memory?.origin === 'remembered';
  const analyzePromptActivationInsight = useMemo(
    () => getSavedDreamActivationInsight(analyzePromptDream),
    [analyzePromptDream]
  );
  const analyzePromptIsRemembered = analyzePromptDream?.memory?.origin === 'remembered';

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

  const switchToVoiceMode = useCallback(async () => {
    setVoiceFallbackReason(null);
    if (inputMode !== 'voice') {
      setInputMode('voice');
      persistInputModePreference('voice');
    }
    await toggleRecording();
  }, [inputMode, persistInputModePreference, toggleRecording]);

  const onboardingOfferActivationInsight = useMemo(
    () => getSavedDreamActivationInsight(onboardingOfferDream),
    [onboardingOfferDream]
  );
  const trackActivationInsightShown = useCallback((
    surface: ActivationInsightSurface,
    insight: RecordingActivationInsight | null | undefined,
    captureContext: ActivationInsightCaptureContext,
  ) => {
    if (!insight || activationInsightTrackedSurfacesRef.current.has(surface)) {
      return;
    }

    activationInsightTrackedSurfacesRef.current.add(surface);
    void trackProductEvent('recording_activation_insight_shown', {
      surface,
      capture_context: captureContext,
      transcript_length_bucket: getTranscriptLengthBucketFromLength(insight.charCount),
      language,
    });
  }, [language]);

  useEffect(() => {
    trackActivationInsightShown(
      'first_dream_sheet',
      firstDreamActivationInsight,
      getDreamActivationInsightCaptureContext(firstDreamPrompt)
    );
  }, [firstDreamActivationInsight, firstDreamPrompt, trackActivationInsightShown]);

  useEffect(() => {
    trackActivationInsightShown(
      'analyze_prompt_sheet',
      analyzePromptActivationInsight,
      getDreamActivationInsightCaptureContext(analyzePromptDream)
    );
  }, [analyzePromptActivationInsight, analyzePromptDream, trackActivationInsightShown]);
  useEffect(() => {
    if (!onboardingOfferDream || !onboardingOfferActivationInsight) return;
    trackActivationInsightShown(
      'first_dream_sheet',
      onboardingOfferActivationInsight,
      getDreamActivationInsightCaptureContext(onboardingOfferDream)
    );
    if (onboardingOfferKind === 'memory') {
      void trackProductEvent(
        'first_value_viewed',
        buildFirstValueProperties(onboardingState, 'recording_insight')
      );
    }
  }, [
    onboardingOfferActivationInsight,
    onboardingOfferDream,
    onboardingOfferKind,
    onboardingState,
    trackActivationInsightShown,
  ]);

  const handleRecordingGuideNext = useCallback(() => {
    if (recordingGuideStep === 1) {
      setRecordingGuideVisible(false);
      return;
    }
    setRecordingGuideStep(1);
  }, [recordingGuideStep]);

  const handleRecordingGuideDismiss = useCallback(() => {
    setRecordingGuideVisible(false);
  }, []);

  const analysisOfferQuotaState = useMemo<AnalysisOfferQuotaState>(() => {
    if (tier === 'plus') return 'unlimited';
    if (quotaLoading || quotaError || !usage) return 'unknown';
    const remaining = usage.analysis.remaining;
    if (remaining === null) return 'unlimited';
    if (remaining <= 0 || !canAnalyzeNow) return 'exhausted';
    return 'known';
  }, [canAnalyzeNow, quotaError, quotaLoading, tier, usage]);
  const analysisOfferPrimaryAction = useMemo<AnalysisOfferPrimaryAction>(() => {
    if (analysisOfferError) return 'retry';
    if (analysisOfferQuotaState === 'exhausted') {
      return tier === 'guest' ? 'login' : 'upgrade';
    }
    return 'launch';
  }, [analysisOfferError, analysisOfferQuotaState, tier]);

  useEffect(() => {
    if (
      !onboardingOfferDream
      || onboardingOfferKind !== 'analysis'
      || analysisOfferTrackedRef.current.has(onboardingOfferDream.id)
    ) {
      return;
    }
    analysisOfferTrackedRef.current.add(onboardingOfferDream.id);
    void trackProductEvent('analysis_offer_viewed', { quota_state: analysisOfferQuotaState });
  }, [analysisOfferQuotaState, onboardingOfferDream, onboardingOfferKind]);

  const clearOnboardingOffer = useCallback(async () => {
    setOnboardingOfferDream(null);
    setAnalysisOfferError(false);
    restoredPendingIntentRef.current = onboardingState.pendingRecordingIntent?.entryId ?? null;
    await transitionOnboarding({ type: 'CLEAR_PENDING_INTENT' }).catch(() => undefined);
  }, [onboardingState.pendingRecordingIntent?.entryId, transitionOnboarding]);

  const handleOnboardingOfferDismiss = useCallback(async () => {
    if (!onboardingOfferDream) return;
    void trackProductEvent('first_dream_next_action_selected', { action: 'later' });
    await clearOnboardingOffer();
  }, [clearOnboardingOffer, onboardingOfferDream]);

  const handleOnboardingOfferJournal = useCallback(async () => {
    const dream = onboardingOfferDream;
    if (!dream) return;
    void trackProductEvent('first_dream_next_action_selected', { action: 'view_dream' });
    await clearOnboardingOffer();
    blurActiveElement();
    navigateToJournalDetail(dream.id);
  }, [clearOnboardingOffer, navigateToJournalDetail, onboardingOfferDream]);

  const handleOnboardingOfferPrimary = useCallback(async () => {
    if (!onboardingOfferDream) return;
    if (analysisOfferPrimaryAction === 'login') {
      router.push('/(tabs)/settings?section=account');
      return;
    }
    if (analysisOfferPrimaryAction === 'upgrade') {
      router.push(buildPaywallHref('analysis_limit'));
      return;
    }
    await handleFirstDreamAnalyze();
  }, [analysisOfferPrimaryAction, handleFirstDreamAnalyze, onboardingOfferDream]);

  const previousInputModeRef = useRef(inputMode);
  useEffect(() => {
    const previousInputMode = previousInputModeRef.current;
    previousInputModeRef.current = inputMode;

    if (inputMode === 'text' && previousInputMode !== 'text' && !isMockMode) {
      focusTranscriptEnd(baseTranscriptRef.current || transcript);
    }
  }, [focusTranscriptEnd, inputMode, transcript]);

  const handleGuestLimitDismiss = useCallback(() => {
    setShowGuestLimitSheet(false);
    setPendingGuestLimitDream(null);
  }, []);

  const handleGuestLimitCta = useCallback(() => {
    setShowGuestLimitSheet(false);
    router.push('/(tabs)/settings');
  }, []);

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

  const analysisRetryHandler = pendingAnalysisDream
    ? handleFirstDreamAnalyze
    : pendingSubjectDream
      ? handleGenerateWithReference
      : undefined;

  return (
    <>
      <View
        style={styles.gradient}
        accessibilityElementsHidden={recordingGuideVisible || Boolean(onboardingOfferDream)}
        importantForAccessibility={
          recordingGuideVisible || onboardingOfferDream ? 'no-hide-descendants' : 'auto'
        }
      >
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <AtmosphereBackground />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView
            ref={scrollViewRef}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            testID={TID.Screen.Recording}
          >
            <MockNavigationRail />
            <View style={mainContentStyle}>
              <View style={styles.bodySection}>
                <RecordingInputModeSelect
                  value={inputMode}
                  disabled={interactionDisabled || isPreparingRecording}
                  onChange={handleInputModePreferenceChange}
                />

                <RecordingTextInput
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
                  voiceStatus={voiceControlStatus}
                  recordingDurationLabel={recordingDurationLabel}
                  placeholder={
                    captureIntent === 'remembered'
                      ? t('recording.remembered.placeholder')
                      : t('recording.placeholder')
                  }
                  autoFocus={false}
                  onSwitchToVoice={switchToVoiceMode}
                  onOpenDetails={
                    captureIntent === 'remembered'
                      ? () => setShowRememberedDetailsSheet(true)
                      : undefined
                  }
                  onClear={handleClearTranscript}
                />

                {analysisProgress.step !== AnalysisStep.IDLE && analysisProgress.step !== AnalysisStep.COMPLETE ? (
                  <AnalysisProgress
                    step={analysisProgress.step}
                    progress={analysisProgress.progress}
                    message={analysisProgress.message}
                    error={analysisProgress.error}
                    onRetry={analysisRetryHandler}
                  />
                ) : null}
              </View>

            </View>
          </ScrollView>
          {hasSaveableContent ? (
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
          ) : null}
        </KeyboardAvoidingView>
        {!keyboardVisible && viewportWidth < DESKTOP_BREAKPOINT ? (
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

      <RecordingOnboardingTour
        visible={recordingGuideVisible}
        step={recordingGuideStep}
        inputMode={inputMode}
        onNext={handleRecordingGuideNext}
        onDismiss={handleRecordingGuideDismiss}
      />

      <PostSaveOfferSheet
        visible={Boolean(onboardingOfferDream) && !showQuotaLimitSheet}
        kind={onboardingOfferKind}
        quotaState={analysisOfferQuotaState}
        remaining={usage?.analysis.remaining}
        primaryAction={analysisOfferPrimaryAction}
        isPersisting={isPersisting}
        activationInsight={onboardingOfferActivationInsight}
        onDismiss={() => void handleOnboardingOfferDismiss()}
        onPrimary={() => void handleOnboardingOfferPrimary()}
        onJournal={() => void handleOnboardingOfferJournal()}
      />

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

      <RecordingOverlays
        firstDreamVisible={Boolean(firstDreamPrompt)}
        firstDreamActivationInsight={firstDreamActivationInsight}
        firstDreamIsRemembered={firstDreamIsRemembered}
        onFirstDreamDismiss={handleFirstDreamDismiss}
        onFirstDreamAnalyze={handleFirstDreamAnalyze}
        onFirstDreamJournal={handleFirstDreamJournal}
        analyzePromptVisible={Boolean(analyzePromptDream)}
        analyzePromptActivationInsight={analyzePromptActivationInsight}
        analyzePromptIsRemembered={analyzePromptIsRemembered}
        onAnalyzePromptDismiss={handleAnalyzePromptDismiss}
        onAnalyzePromptAnalyze={handleFirstDreamAnalyze}
        onAnalyzePromptJournal={handleAnalyzePromptJournal}
        analyzePromptTranscript={analyzePromptTranscript}
        guestLimitVisible={showGuestLimitSheet}
        onGuestLimitClose={handleGuestLimitDismiss}
        onGuestLimitCta={handleGuestLimitCta}
        micRationaleVisible={showMicRationaleSheet}
        onMicRationaleClose={handleMicRationaleClose}
        onMicRationaleAllow={handleMicRationaleAllow}
        onMicRationaleUseText={handleMicRationaleUseText}
        quotaLimitVisible={showQuotaLimitSheet}
        onQuotaLimitClose={handleQuotaLimitDismiss}
        onQuotaLimitPrimary={quotaSheetMode === 'error' ? handleQuotaLimitDismiss : handleQuotaLimitPrimary}
        onQuotaLimitSecondary={quotaSheetMode === 'limit' ? handleQuotaLimitJournal : undefined}
        onQuotaLimitReset={isMockMode && quotaSheetMode === 'limit' ? handleMockQuotaReset : undefined}
        onQuotaLimitLink={quotaSheetMode === 'limit' ? handleQuotaLimitDismiss : undefined}
        quotaSheetMode={quotaSheetMode}
        tier={tier}
        usageLimit={usage?.analysis.limit}
        quotaSheetMessage={quotaSheetMessage}
        isPersisting={isPersisting}
        referenceImagesEnabled={referenceImagesEnabled}
        showSubjectProposition={showSubjectProposition}
        detectedSubjectType={detectedSubjectType}
        onSubjectAccept={handleSubjectAccept}
        onSubjectDismiss={handleSubjectDismiss}
        subjectPropositionMarginBottom={subjectPropositionMarginBottom}
        showReferencePickerSheet={showReferencePickerSheet}
        referenceImages={referenceImages}
        onReferencePickerClose={handleReferencePickerClose}
        onGenerateWithReference={handleGenerateWithReference}
        onReferenceImagesSelected={handleReferenceImagesSelected}
        showOfflineModelSheet={showOfflineModelSheet}
        onOfflineModelSheetClose={handleOfflineModelSheetClose}
        offlineModelLocale={offlineModelLocale}
        onOfflineModelDownloadComplete={handleOfflineModelDownloadComplete}
      />
    </>
  );
}

function RecordingOverlays({
  firstDreamVisible,
  firstDreamActivationInsight,
  firstDreamIsRemembered,
  onFirstDreamDismiss,
  onFirstDreamAnalyze,
  onFirstDreamJournal,
  analyzePromptVisible,
  analyzePromptActivationInsight,
  analyzePromptIsRemembered,
  onAnalyzePromptDismiss,
  onAnalyzePromptAnalyze,
  onAnalyzePromptJournal,
  analyzePromptTranscript,
  guestLimitVisible,
  onGuestLimitClose,
  onGuestLimitCta,
  micRationaleVisible,
  onMicRationaleClose,
  onMicRationaleAllow,
  onMicRationaleUseText,
  quotaLimitVisible,
  onQuotaLimitClose,
  onQuotaLimitPrimary,
  onQuotaLimitSecondary,
  onQuotaLimitReset,
  onQuotaLimitLink,
  quotaSheetMode,
  tier,
  usageLimit,
  quotaSheetMessage,
  isPersisting,
  referenceImagesEnabled,
  showSubjectProposition,
  detectedSubjectType,
  onSubjectAccept,
  onSubjectDismiss,
  subjectPropositionMarginBottom,
  showReferencePickerSheet,
  referenceImages,
  onReferencePickerClose,
  onGenerateWithReference,
  onReferenceImagesSelected,
  showOfflineModelSheet,
  onOfflineModelSheetClose,
  offlineModelLocale,
  onOfflineModelDownloadComplete,
}: {
  firstDreamVisible: boolean;
  firstDreamActivationInsight?: ReturnType<typeof getSavedDreamActivationInsight>;
  firstDreamIsRemembered: boolean;
  onFirstDreamDismiss: () => void;
  onFirstDreamAnalyze: () => void;
  onFirstDreamJournal: () => void;
  analyzePromptVisible: boolean;
  analyzePromptActivationInsight?: ReturnType<typeof getSavedDreamActivationInsight>;
  analyzePromptIsRemembered: boolean;
  onAnalyzePromptDismiss: () => void;
  onAnalyzePromptAnalyze: () => void;
  onAnalyzePromptJournal: () => void;
  analyzePromptTranscript?: string | null;
  guestLimitVisible: boolean;
  onGuestLimitClose: () => void;
  onGuestLimitCta: () => void;
  micRationaleVisible: boolean;
  onMicRationaleClose: () => void;
  onMicRationaleAllow: () => void;
  onMicRationaleUseText: () => void;
  quotaLimitVisible: boolean;
  onQuotaLimitClose: () => void;
  onQuotaLimitPrimary: () => void;
  onQuotaLimitSecondary?: () => void;
  onQuotaLimitReset?: () => void;
  onQuotaLimitLink?: () => void;
  quotaSheetMode: 'limit' | 'error' | 'login';
  tier: 'guest' | 'free' | 'plus';
  usageLimit?: number | null;
  quotaSheetMessage: string;
  isPersisting: boolean;
  referenceImagesEnabled: boolean;
  showSubjectProposition: boolean;
  detectedSubjectType: 'person' | 'animal' | null;
  onSubjectAccept: () => void;
  onSubjectDismiss: () => void;
  subjectPropositionMarginBottom: number;
  showReferencePickerSheet: boolean;
  referenceImages: ReferenceImage[];
  onReferencePickerClose: () => void;
  onGenerateWithReference: () => void;
  onReferenceImagesSelected: (images: ReferenceImage[]) => void;
  showOfflineModelSheet: boolean;
  onOfflineModelSheetClose: () => void;
  offlineModelLocale: string;
  onOfflineModelDownloadComplete: (_success: boolean) => void;
}) {
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);

  return (
    <>
      <FirstDreamSheet
        visible={firstDreamVisible}
        activationInsight={firstDreamActivationInsight}
        isRememberedDream={firstDreamIsRemembered}
        onDismiss={onFirstDreamDismiss}
        onAnalyze={onFirstDreamAnalyze}
        onJournal={onFirstDreamJournal}
        isPersisting={isPersisting}
      />

      <AnalyzePromptSheet
        visible={analyzePromptVisible}
        activationInsight={analyzePromptActivationInsight}
        isRememberedDream={analyzePromptIsRemembered}
        onDismiss={onAnalyzePromptDismiss}
        onAnalyze={onAnalyzePromptAnalyze}
        onJournal={onAnalyzePromptJournal}
        transcript={analyzePromptTranscript}
        isPersisting={isPersisting}
      />

      <GuestLimitSheet
        visible={guestLimitVisible}
        onClose={onGuestLimitClose}
        onCta={onGuestLimitCta}
      />

      <MicPermissionRationaleSheet
        visible={micRationaleVisible}
        onClose={onMicRationaleClose}
        onAllow={onMicRationaleAllow}
        onUseText={onMicRationaleUseText}
      />

      <QuotaLimitSheet
        visible={quotaLimitVisible}
        onClose={onQuotaLimitClose}
        onPrimary={onQuotaLimitPrimary}
        onSecondary={onQuotaLimitSecondary}
        onReset={onQuotaLimitReset}
        onLink={onQuotaLimitLink}
        mode={quotaSheetMode}
        tier={tier}
        usageLimit={usageLimit}
        message={quotaSheetMessage}
        resetDisabled={isPersisting}
      />

      {referenceImagesEnabled && showSubjectProposition && detectedSubjectType ? (
        <View style={styles.subjectPropositionOverlay}>
          <View style={[styles.subjectPropositionBackdrop, { backgroundColor: noctalia.surface.overlay }]} />
          <View style={[styles.subjectPropositionCard, { marginBottom: subjectPropositionMarginBottom }]}>
            <SubjectProposition
              subjectType={detectedSubjectType}
              onAccept={onSubjectAccept}
              onDismiss={onSubjectDismiss}
            />
          </View>
        </View>
      ) : null}

      <ReferenceImageSheet
        visible={referenceImagesEnabled && showReferencePickerSheet}
        subjectType={detectedSubjectType}
        referenceImages={referenceImages}
        isPersisting={isPersisting}
        onClose={onReferencePickerClose}
        onPrimary={onGenerateWithReference}
        onSecondary={onReferencePickerClose}
        onImagesSelected={onReferenceImagesSelected}
      />

      <OfflineModelDownloadSheet
        visible={showOfflineModelSheet}
        onClose={onOfflineModelSheetClose}
        locale={offlineModelLocale}
        onDownloadComplete={onOfflineModelDownloadComplete}
      />
    </>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
    position: 'relative',
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
    justifyContent: 'flex-start',
    gap: 24,
  },
  fixedFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    zIndex: 40,
  },
  subjectPropositionOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'flex-end',
    zIndex: 100,
  },
  subjectPropositionBackdrop: {
    ...StyleSheet.absoluteFill,
  },
  subjectPropositionCard: {
    paddingHorizontal: 16,
  },
});
