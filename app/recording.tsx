import { AnalysisProgress } from '@/components/analysis/AnalysisProgress';
import { MockNavigationRail } from '@/components/dev/MockNavigationRail';
import { SubjectProposition } from '@/components/journal/SubjectProposition';
import { NoctaliaBottomNav } from '@/components/navigation/NoctaliaBottomNav';
import { AtmosphereBackground } from '@/components/recording/AtmosphereBackground';
import { OfflineModelDownloadSheet } from '@/components/recording/OfflineModelDownloadSheet';
import {
  RecordingOnboardingTour,
  type RecordingOnboardingTarget,
} from '@/components/recording/RecordingOnboardingTour';
import {
  RecordingOnboardingSpotlightOverlay,
  type RecordingSpotlightRect,
} from '@/components/recording/RecordingOnboardingSpotlightOverlay';
import { RecordingFooter } from '@/components/recording/RecordingFooter';
import { RecordingActivationInsightCard } from '@/components/recording/RecordingActivationInsightCard';
import {
  AnalyzePromptSheet,
  FirstDreamSheet,
  GuestLimitSheet,
  MicPermissionRationaleSheet,
  QuotaLimitSheet,
  ReferenceImageSheet,
} from '@/components/recording/RecordingSheets';
import { RecordingInputModeSelect } from '@/components/recording/RecordingInputModeSelect';
import { RecordingTextInput } from '@/components/recording/RecordingTextInput';
import { RememberedDreamProfileChips } from '@/components/recording/RememberedDreamProfileChips';
import { UnforgettableDreamPromptCard } from '@/components/recording/UnforgettableDreamPromptCard';
import { RECORDING } from '@/constants/appConfig';
import { DESKTOP_BREAKPOINT, TAB_BAR_HEIGHT } from '@/constants/layout';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useAuth } from '@/context/AuthContext';
import { useDreams } from '@/context/DreamsContext';
import { useLanguage } from '@/context/LanguageContext';
import { useTheme } from '@/context/ThemeContext';
import { AnalysisStep, useAnalysisProgress } from '@/hooks/useAnalysisProgress';
import { useQuota } from '@/hooks/useQuota';
import { useRecordingSession } from '@/hooks/useRecordingSession';
import { useTranslation } from '@/hooks/useTranslation';
import { blurActiveElement } from '@/lib/accessibility';
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
import { buildPaywallHref } from '@/lib/paywallRoute';
import {
  getRecordingActivationPromptState,
  type RecordingCaptureIntent,
  resolveRememberedCaptureSource,
  type RememberedCaptureSource,
} from '@/lib/recordingActivation';
import {
  getLiveRecordingActivationInsight,
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
  getRecordingOnboardingCompleted,
  getRememberedDreamPromptDismissed,
  saveRecordingInputModePreference,
  saveRecordingOnboardingCompleted,
  saveRememberedDreamPromptDismissed,
} from '@/services/storageService';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  AppState,
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

type VoiceFallbackReason =
  | 'permission_denied'
  | 'stt_unavailable'
  | 'language_pack_missing'
  | 'no_speech'
  | 'start_failed'
  | null;

type CaptureIntent = RecordingCaptureIntent;
type ActivationInsightSurface = AnalyticsEventMap['recording_activation_insight_shown']['surface'];
type ActivationInsightCaptureContext =
  AnalyticsEventMap['recording_activation_insight_shown']['capture_context'];

const getDreamActivationInsightCaptureContext = (
  dream: DreamAnalysis | null
): ActivationInsightCaptureContext =>
  dream?.memory?.origin === 'remembered' ? 'remembered' : 'fresh';

const getActivationInsightSignalIds = (insight: RecordingActivationInsight) =>
  insight.signalIds.length > 0 ? insight.signalIds.join(',') : 'none';

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
  const { addDream, updateDream, dreams, analyzeDream } = useDreams();
  const { colors, mode } = useTheme();
  const { language } = useLanguage();
  const { t } = useTranslation();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { width: viewportWidth } = useWindowDimensions();
  const referenceImagesEnabled = isReferenceImagesEnabled();
  const recordingParams = useLocalSearchParams<{ intent?: string; source?: string }>();

  const [transcript, setTranscript] = useState('');
  const [draftDream, setDraftDream] = useState<DreamAnalysis | null>(null);
  const [firstDreamPrompt, setFirstDreamPrompt] = useState<DreamAnalysis | null>(null);
  const [analyzePromptDream, setAnalyzePromptDream] = useState<DreamAnalysis | null>(null);
  const [pendingAnalysisDream, setPendingAnalysisDream] = useState<DreamAnalysis | null>(null);
  const [isPersisting, setIsPersisting] = useState(false);
  const [isPreparingRecording, setIsPreparingRecording] = useState(false);
  const [showGuestLimitSheet, setShowGuestLimitSheet] = useState(false);
  const [pendingGuestLimitDream, setPendingGuestLimitDream] = useState<DreamAnalysis | null>(null);
  const recordingTransitionRef = useRef(false);
  const baseTranscriptRef = useRef('');
  const [lengthWarning, setLengthWarning] = useState('');
  const analysisProgress = useAnalysisProgress();
  const hasAutoStoppedRecordingRef = useRef(false);
  const { canAnalyzeNow, tier, usage, quotaStatus } = useQuota();
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
  const [recordingOnboardingStage, setRecordingOnboardingStage] =
    useState<'preference' | 'tour'>('preference');
  const [recordingOnboardingStep, setRecordingOnboardingStep] = useState(0);
  const [recordingOnboardingDismissed, setRecordingOnboardingDismissed] = useState(false);
  const [recordingOnboardingLoaded, setRecordingOnboardingLoaded] = useState(false);
  const [rememberedDreamPromptDismissed, setRememberedDreamPromptDismissed] = useState(false);
  const [rememberedDreamPromptLoaded, setRememberedDreamPromptLoaded] = useState(false);
  const [captureIntent, setCaptureIntent] = useState<CaptureIntent>('fresh');
  const [rememberedCaptureSource, setRememberedCaptureSource] =
    useState<RememberedCaptureSource>('journal');
  const [rememberedKind, setRememberedKind] = useState<RememberedDreamKind | undefined>();
  const [rememberedApproximatePeriod, setRememberedApproximatePeriod] =
    useState<DreamApproximatePeriod | undefined>();
  const [rememberedStrongestFragment, setRememberedStrongestFragment] =
    useState<DreamStrongestFragment | undefined>();
  const [inputMode, setInputMode] = useState<RecordingInputModePreference>('text');
  const [inputModePreferenceLoaded, setInputModePreferenceLoaded] = useState(false);
  const recordingOnboardingViewportRef = useRef<View | null>(null);
  const [recordingOnboardingTargetRect, setRecordingOnboardingTargetRect] =
    useState<RecordingSpotlightRect | null>(null);
  const [recordingOnboardingPanelRect, setRecordingOnboardingPanelRect] =
    useState<RecordingSpotlightRect | null>(null);
  const [recordingOnboardingMeasureKey, setRecordingOnboardingMeasureKey] = useState(0);
  const [recordingOnboardingViewport, setRecordingOnboardingViewport] = useState({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });

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
    saveRecordingInputModePreference(preference).catch((error) => {
      if (__DEV__) {
        console.warn('[Recording] Failed to save input mode preference', error);
      }
    });
  }, []);

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

    getRecordingInputModePreference()
      .then((preference) => {
        if (isActive) {
          setInputMode(preference ?? 'text');
          setInputModePreferenceLoaded(true);
        }
      })
      .catch((error) => {
        if (isActive) {
          setInputModePreferenceLoaded(true);
        }
        if (__DEV__) {
          console.warn('[Recording] Failed to load input mode preference', error);
        }
      });

    getRecordingOnboardingCompleted()
      .then((completed) => {
        if (isActive) {
          setRecordingOnboardingDismissed(completed);
          setRecordingOnboardingLoaded(true);
        }
      })
      .catch((error) => {
        if (isActive) {
          setRecordingOnboardingLoaded(true);
        }
        if (__DEV__) {
          console.warn('[Recording] Failed to load onboarding preference', error);
        }
      });

    getRememberedDreamPromptDismissed()
      .then((dismissed) => {
        if (isActive) {
          setRememberedDreamPromptDismissed(dismissed);
          setRememberedDreamPromptLoaded(true);
        }
      })
      .catch((error) => {
        if (isActive) {
          setRememberedDreamPromptLoaded(true);
        }
        if (__DEV__) {
          console.warn('[Recording] Failed to load remembered dream prompt preference', error);
        }
      });

    return () => {
      isActive = false;
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
  const isSaveDisabled = !trimmedTranscript || interactionDisabled;
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
      setTranscript(clamped);
      baseTranscriptRef.current = clamped;
      setLengthWarning(truncated ? lengthLimitMessage() : '');
    },
    [clampTranscript, lengthLimitMessage]
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
          setVoiceFallbackReason('stt_unavailable');
          setInputMode('text');
          persistInputModePreference('text');
          return;
        }
        if (result.error === 'language_pack_missing') {
          setVoiceFallbackReason('language_pack_missing');
          setInputMode('text');
          persistInputModePreference('text');
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
        setVoiceFallbackReason('no_speech');
        setInputMode('text');
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
        setVoiceFallbackReason(response.error);
        setInputMode('text');
        persistInputModePreference('text');
        return;
      }
      setVoiceFallbackReason('start_failed');
      setInputMode('text');
      persistInputModePreference('text');
      Alert.alert(t('common.error_title'), t('recording.alert.start_failed'));
    } finally {
      setIsPreparingRecording(false);
    }
  }, [language, persistInputModePreference, startSessionRecording, t, transcript]);

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
    const dream = analyzePromptDream ?? pendingAnalysisDream;
    if (dream) {
      navigateToJournalDetail(dream.id);
    } else {
      router.push('/(tabs)/journal');
    }
    // Cleanup
    setPendingAnalysisDream(null);
    analysisProgress.reset();
  }, [analyzePromptDream, pendingAnalysisDream, analysisProgress, navigateToJournalDetail]);

  const runAnalysis = useCallback(async (dream: DreamAnalysis) => {
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
      resetComposer();
      await new Promise((resolve) => setTimeout(resolve, 300));
      navigateAfterSave(analyzedDream, preCount, { skipFirstDreamSheet: true });
    } catch (error) {
      if (error instanceof QuotaError) {
        const mode = error.code === QuotaErrorCode.LOGIN_REQUIRED && tier === 'guest' ? 'login' : 'limit';
        showQuotaSheet({ mode });
        analysisProgress.reset();
        return;
      }
      const classified = classifyError(error as Error, t);
      analysisProgress.setError(classified);
    } finally {
      setIsPersisting(false);
    }
  }, [
    analysisProgress,
    analyzeDream,
    dreams.length,
    language,
    navigateAfterSave,
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
    const dream = firstDreamPrompt ?? analyzePromptDream ?? pendingAnalysisDream;
    if (!dream) {
      return;
    }
    if (!canAnalyzeNow) {
      // "canAnalyzeNow" is a local/optimistic gate; if we can't show a quota sheet (e.g., paid tier),
      // fall through and let the server-side quota enforcement decide.
      const mode = !user && quotaStatus?.isUpgraded ? 'login' : 'limit';
      const shown = showQuotaSheet({ mode });
      if (shown) return;
    }

    if (firstDreamPrompt) {
      setFirstDreamPrompt(null);
    }
    if (analyzePromptDream) {
      setAnalyzePromptDream(null);
    }

    const shouldOfferReference = !pendingAnalysisDream
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
    pendingAnalysisDream,
    quotaStatus?.isUpgraded,
    referenceImagesEnabled,
    runAnalysis,
    showQuotaSheet,
    user,
  ]);

  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const gradientColors = noctalia.screen.gradient;
  const bottomNavOffset = viewportWidth >= DESKTOP_BREAKPOINT
    ? Math.max(insets.bottom, 24)
    : TAB_BAR_HEIGHT + Math.max(insets.bottom, 14);
  const fixedFooterBottomOffset = bottomNavOffset + 16;
  const mainContentStyle = useMemo(
    () => [
      styles.mainContent,
      {
        paddingTop: 24 + insets.top,
        paddingBottom: fixedFooterBottomOffset + 92,
      },
    ],
    [fixedFooterBottomOffset, insets.top]
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
    () => 100 + insets.bottom,
    [insets.bottom]
  );

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
  const dismissRememberedDreamPrompt = useCallback(() => {
    setRememberedDreamPromptDismissed(true);
    saveRememberedDreamPromptDismissed(true).catch((error) => {
      if (__DEV__) {
        console.warn('[Recording] Failed to save remembered dream prompt preference', error);
      }
    });
  }, []);
  const handleRememberedDreamStart = useCallback(async () => {
    if (isRecordingRef.current) {
      recordingTransitionRef.current = true;
      try {
        await stopRecording({ silent: true });
      } finally {
        recordingTransitionRef.current = false;
      }
    }

    setCaptureIntent('remembered');
    setRememberedCaptureSource('onboarding');
    setRememberedKind(undefined);
    setRememberedApproximatePeriod(undefined);
    setRememberedStrongestFragment(undefined);
    dismissRememberedDreamPrompt();
    setVoiceFallbackReason(null);
    setInputMode('text');
    persistInputModePreference('text');
    focusTranscriptEnd(baseTranscriptRef.current || transcript);
  }, [
    dismissRememberedDreamPrompt,
    focusTranscriptEnd,
    isRecordingRef,
    persistInputModePreference,
    stopRecording,
    transcript,
  ]);
  const handleRememberedDreamTonight = useCallback(() => {
    setCaptureIntent('fresh');
    setRememberedCaptureSource('journal');
    dismissRememberedDreamPrompt();
  }, [dismissRememberedDreamPrompt]);
  const handleRememberedDreamDismiss = useCallback(() => {
    dismissRememberedDreamPrompt();
  }, [dismissRememberedDreamPrompt]);

  useFocusEffect(
    useCallback(() => {
      if (recordingParams.intent !== 'remembered' || trimmedTranscript || draftDream) {
        return;
      }

      setCaptureIntent('remembered');
      setRememberedCaptureSource(resolveRememberedCaptureSource(recordingParams.source));
      setRememberedKind(undefined);
      setRememberedApproximatePeriod(undefined);
      setRememberedStrongestFragment(undefined);
      setRememberedDreamPromptDismissed(true);
      setVoiceFallbackReason(null);
      setInputMode('text');
      persistInputModePreference('text');
      focusTranscriptEnd(baseTranscriptRef.current || transcript);
    }, [
      draftDream,
      focusTranscriptEnd,
      persistInputModePreference,
      recordingParams.intent,
      recordingParams.source,
      transcript,
      trimmedTranscript,
    ])
  );

  const analyzePromptTranscript = analyzePromptDream?.transcript?.trim();
  const voiceStatus = useMemo(() => {
    if (isRecording) {
      return {
        title: t('recording.status.recording.title'),
        detail: t('recording.status.recording.detail'),
        tone: 'active' as const,
      };
    }

    if (isPreparingRecording) {
      return {
        title: t('recording.status.preparing.title'),
        detail: t('recording.status.preparing.detail'),
        tone: 'neutral' as const,
      };
    }

    if (interactionDisabled) {
      return {
        title: t('recording.status.busy.title'),
        detail: t('recording.status.busy.detail'),
        tone: 'neutral' as const,
      };
    }

    return {
      title: t(
        recordingPermissionState === 'granted'
          ? 'recording.status.ready.title'
          : 'recording.status.permission_prompt.title'
      ),
      detail: t(
        recordingPermissionState === 'granted'
          ? 'recording.status.ready.detail'
          : 'recording.status.permission_prompt.detail'
      ),
      tone: 'neutral' as const,
    };
  }, [interactionDisabled, isPreparingRecording, isRecording, recordingPermissionState, t]);
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
  const voiceControlDetail = useMemo(() => {
    if (isRecording) {
      return t('recording.mode.voice_pause_detail');
    }
    if (isPreparingRecording) {
      return voiceStatus.detail;
    }
    if (trimmedTranscript) {
      return t('recording.mode.voice_resume_detail');
    }
    return t('recording.mode.voice_cta_detail');
  }, [isPreparingRecording, isRecording, t, trimmedTranscript, voiceStatus.detail]);
  const voiceControlHint = isRecording
    ? t('recording.mic.pause_hint')
    : trimmedTranscript
      ? t('recording.mic.resume_hint')
      : t('recording.mic.start_hint');
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

  const isInitialRecordingState = dreams.length === 0
    && !trimmedTranscript
    && !draftDream
    && !firstDreamPrompt
    && !analyzePromptDream
    && !pendingAnalysisDream
    && !isAnalyzing;
  const {
    showRememberedDreamPrompt,
    showRecordingOnboardingTour,
  } = getRecordingActivationPromptState({
    recordingOnboardingLoaded,
    inputModePreferenceLoaded,
    isInitialRecordingState,
    recordingOnboardingDismissed,
    rememberedDreamPromptLoaded,
    rememberedDreamPromptDismissed,
    captureIntent,
  });
  const draftActivationInsight = useMemo(() => {
    if (
      interactionDisabled
      || showRecordingOnboardingTour
      || showRememberedDreamPrompt
    ) {
      return null;
    }

    return getLiveRecordingActivationInsight({
      transcript: trimmedTranscript,
      captureIntent,
      rememberedKind,
      approximatePeriod: rememberedApproximatePeriod,
      strongestFragment: rememberedStrongestFragment,
      maxSignals: 3,
    });
  }, [
    captureIntent,
    interactionDisabled,
    rememberedApproximatePeriod,
    rememberedKind,
    rememberedStrongestFragment,
    showRecordingOnboardingTour,
    showRememberedDreamPrompt,
    trimmedTranscript,
  ]);
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
      tone: insight.tone,
      primary_signal_id: insight.signalIds[0] ?? 'none',
      signal_ids: getActivationInsightSignalIds(insight),
      signal_count: insight.signalIds.length,
      transcript_length_bucket: getTranscriptLengthBucketFromLength(insight.charCount),
      language,
    });
  }, [language]);

  useEffect(() => {
    trackActivationInsightShown('draft', draftActivationInsight, captureIntent);
  }, [captureIntent, draftActivationInsight, trackActivationInsightShown]);

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
  const recordingOnboardingTargets = useMemo<RecordingOnboardingTarget[]>(
    () => (inputMode === 'voice' ? ['voice', 'text'] : ['text', 'voice']),
    [inputMode]
  );
  const recordingOnboardingTarget =
    recordingOnboardingTargets[recordingOnboardingStep] ?? recordingOnboardingTargets[0];

  useEffect(() => {
    if (!showRecordingOnboardingTour) {
      setRecordingOnboardingTargetRect(null);
      setRecordingOnboardingPanelRect(null);
      return;
    }

    setRecordingOnboardingTargetRect(null);
    setRecordingOnboardingPanelRect(null);

    const frame = requestAnimationFrame(() => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });

      requestAnimationFrame(() => {
        setRecordingOnboardingMeasureKey((current) => current + 1);
      });
    });

    return () => cancelAnimationFrame(frame);
  }, [recordingOnboardingStage, recordingOnboardingTarget, showRecordingOnboardingTour]);

  const handleRecordingOnboardingViewportLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;

    requestAnimationFrame(() => {
      recordingOnboardingViewportRef.current?.measureInWindow((x, y) => {
        setRecordingOnboardingViewport((current) =>
          current.x === x && current.y === y && current.width === width && current.height === height
            ? current
            : { x, y, width, height }
        );
      });
    });
  }, []);

  const handleRecordingOnboardingPanelLayout = useCallback((rect: RecordingSpotlightRect) => {
    setRecordingOnboardingPanelRect(rect);
  }, []);

  const handleRecordingOnboardingTargetLayout = useCallback((rect: RecordingSpotlightRect) => {
    setRecordingOnboardingTargetRect(rect);
  }, []);

  const completeRecordingOnboarding = useCallback(() => {
    setRecordingOnboardingDismissed(true);
    saveRecordingOnboardingCompleted(true).catch((error) => {
      if (__DEV__) {
        console.warn('[Recording] Failed to save onboarding preference', error);
      }
    });
  }, []);

  const handleRecordingOnboardingNext = useCallback(() => {
    if (recordingOnboardingStep >= recordingOnboardingTargets.length - 1) {
      completeRecordingOnboarding();
      return;
    }

    setRecordingOnboardingStep((current) =>
      Math.min(current + 1, recordingOnboardingTargets.length - 1)
    );
  }, [completeRecordingOnboarding, recordingOnboardingStep, recordingOnboardingTargets.length]);

  const handleRecordingOnboardingSkip = useCallback(() => {
    completeRecordingOnboarding();
  }, [completeRecordingOnboarding]);

  const handleRecordingOnboardingPreference = useCallback(
    async (preference: RecordingInputModePreference) => {
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
      setRecordingOnboardingStep(0);
      setRecordingOnboardingStage('tour');

      if (preference === 'text') {
        focusTranscriptEnd(baseTranscriptRef.current || transcript);
      }
    },
    [
      focusTranscriptEnd,
      isRecordingRef,
      persistInputModePreference,
      stopRecording,
      transcript,
    ]
  );

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
        ref={recordingOnboardingViewportRef}
        style={styles.gradient}
        onLayout={handleRecordingOnboardingViewportLayout}
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
                {showRecordingOnboardingTour ? (
                  recordingOnboardingStage === 'preference' ? (
                    <RecordingOnboardingTour
                      variant="preference"
                      value={inputMode}
                      onSelectPreference={handleRecordingOnboardingPreference}
                      onSkip={handleRecordingOnboardingSkip}
                      onSpotlightLayout={handleRecordingOnboardingPanelLayout}
                      spotlightMeasureKey={recordingOnboardingMeasureKey}
                    />
                  ) : (
                    <RecordingOnboardingTour
                      variant="step"
                      target={recordingOnboardingTarget}
                      index={recordingOnboardingStep}
                      total={recordingOnboardingTargets.length}
                      onNext={handleRecordingOnboardingNext}
                      onSkip={handleRecordingOnboardingSkip}
                      onSpotlightLayout={handleRecordingOnboardingPanelLayout}
                      spotlightMeasureKey={recordingOnboardingMeasureKey}
                    />
                  )
                ) : null}

                {showRememberedDreamPrompt ? (
                  <UnforgettableDreamPromptCard
                    disabled={interactionDisabled || isPreparingRecording}
                    onStartRememberedDream={handleRememberedDreamStart}
                    onStartFreshTonight={handleRememberedDreamTonight}
                    onDismiss={handleRememberedDreamDismiss}
                  />
                ) : null}

                <RecordingInputModeSelect
                  value={inputMode}
                  disabled={interactionDisabled || isPreparingRecording}
                  onChange={handleInputModePreferenceChange}
                />

                {captureIntent === 'remembered' ? (
                  <RememberedDreamProfileChips
                    rememberedKind={rememberedKind}
                    approximatePeriod={rememberedApproximatePeriod}
                    strongestFragment={rememberedStrongestFragment}
                    disabled={interactionDisabled || isPreparingRecording}
                    onRememberedKindChange={setRememberedKind}
                    onApproximatePeriodChange={setRememberedApproximatePeriod}
                    onStrongestFragmentChange={setRememberedStrongestFragment}
                  />
                ) : null}

                {draftActivationInsight ? (
                  <RecordingActivationInsightCard
                    context="draft"
                    insight={draftActivationInsight}
                  />
                ) : null}

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
                  fallbackNotice={textFallbackNotice}
                  switchToVoiceLabel={voiceControlLabel}
                  voiceCtaDetail={voiceControlDetail}
                  voiceStatus={voiceControlStatus}
                  voiceAccessibilityHint={voiceControlHint}
                  recordingDurationLabel={recordingDurationLabel}
                  spotlightTarget={
                    showRecordingOnboardingTour && recordingOnboardingStage === 'tour'
                      ? recordingOnboardingTarget
                      : undefined
                  }
                  onSpotlightLayout={handleRecordingOnboardingTargetLayout}
                  spotlightMeasureKey={recordingOnboardingMeasureKey}
                  placeholder={
                    captureIntent === 'remembered'
                      ? t('recording.remembered.placeholder')
                      : t('recording.placeholder')
                  }
                  autoFocus={false}
                  onSwitchToVoice={switchToVoiceMode}
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
          <View pointerEvents="box-none" style={fixedFooterStyle}>
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
        {showRecordingOnboardingTour ? (
          <RecordingOnboardingSpotlightOverlay
            width={recordingOnboardingViewport.width}
            height={recordingOnboardingViewport.height}
            originX={recordingOnboardingViewport.x}
            originY={recordingOnboardingViewport.y}
            targetRect={
              recordingOnboardingStage === 'preference'
                ? recordingOnboardingPanelRect
                : recordingOnboardingTargetRect
            }
            panelRect={recordingOnboardingStage === 'preference' ? null : recordingOnboardingPanelRect}
          />
        ) : null}
        <NoctaliaBottomNav
          activeKey="addDream"
          addDreamIcon={inputMode === 'voice' ? 'mic' : 'pencil'}
        />
      </View>

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
        onLink={onQuotaLimitLink}
        mode={quotaSheetMode}
        tier={tier}
        usageLimit={usageLimit}
        message={quotaSheetMessage}
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
