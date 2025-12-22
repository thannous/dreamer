import { AnalysisProgress } from '@/components/analysis/AnalysisProgress';
import { ReferenceImagePicker } from '@/components/journal/ReferenceImagePicker';
import { SubjectProposition } from '@/components/journal/SubjectProposition';
import { AtmosphereBackground } from '@/components/recording/AtmosphereBackground';
import { OfflineModelDownloadSheet } from '@/components/recording/OfflineModelDownloadSheet';
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
import { useRecordingSession } from '@/hooks/useRecordingSession';
import { useTranslation } from '@/hooks/useTranslation';
import { blurActiveElement } from '@/lib/accessibility';
import { buildDraftDream as buildDraftDreamPure } from '@/lib/dreamUtils';
import { classifyError, QuotaError, QuotaErrorCode, type ClassifiedError } from '@/lib/errors';
import { isGuestDreamLimitReached } from '@/lib/guestLimits';
import { getTranscriptionLocale } from '@/lib/locale';
import { createScopedLogger } from '@/lib/logger';
import { combineTranscript as combineTranscriptPure } from '@/lib/transcriptMerge';
import { TID } from '@/lib/testIDs';
import type { DreamAnalysis, ReferenceImage } from '@/lib/types';
import { categorizeDream, generateImageWithReference } from '@/services/geminiService';
import {
  registerOfflineModelPromptHandler,
  type OfflineModelPromptHandler
} from '@/services/nativeSpeechRecognition';
import { getGuestRecordedDreamCount } from '@/services/quota/GuestDreamCounter';
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

const log = createScopedLogger('[Recording]');

export default function RecordingScreen() {
  const { addDream, updateDream, dreams, analyzeDream } = useDreams();
  const { colors, mode } = useTheme();
  const { language } = useLanguage();
  const { t } = useTranslation();
  const { user } = useAuth();

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
  const { canAnalyzeNow, tier, usage } = useQuota();
  const [showQuotaLimitSheet, setShowQuotaLimitSheet] = useState(false);
  const [quotaSheetMode, setQuotaSheetMode] = useState<'limit' | 'error'>('limit');
  const [quotaSheetMessage, setQuotaSheetMessage] = useState('');
  const [showOfflineModelSheet, setShowOfflineModelSheet] = useState(false);
  const [offlineModelLocale, setOfflineModelLocale] = useState('');
  const offlineModelPromptResolveRef = useRef<(() => void) | null>(null);
  const offlineModelPromptPromiseRef = useRef<Promise<void> | null>(null);

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
    startRecording: startSessionRecording,
    stopRecording: stopSessionRecording,
    forceStopRecording,
    requestPermissions,
  } = recordingSession;

  useEffect(() => {
    void requestPermissions();
  }, [requestPermissions]);

  // Register offline model prompt handler
  useEffect(() => {
    const handler: OfflineModelPromptHandler = {
      isVisible: showOfflineModelSheet,
      show: handleOfflineModelPromptShow,
    };
    registerOfflineModelPromptHandler(handler);
  }, [handleOfflineModelPromptShow, showOfflineModelSheet]);

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
    (transcriptText?: string): DreamAnalysis =>
      buildDraftDreamPure(transcriptText ?? trimmedTranscript, {
        defaultTitle: t('recording.draft.default_title'),
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

  // Show quota limit sheet (reusable for both guard and catch paths)
  const showQuotaSheet = useCallback((options?: { mode?: 'limit' | 'error'; message?: string }) => {
    const modeToUse = options?.mode ?? 'limit';
    const message = options?.message ?? '';

    // Close existing sheets to avoid overlay
    if (firstDreamPrompt) setFirstDreamPrompt(null);
    if (analyzePromptDream) setAnalyzePromptDream(null);

    // Don't show upsell for paid tiers (edge case: network error)
    if (modeToUse === 'limit' && (tier === 'plus' || tier === 'premium')) return false;

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
        if (silent) {
          return;
        }
        if (result.error === 'rate_limited') {
          showQuotaSheet({ mode: 'error', message: t('error.rate_limit') });
          return;
        }
        if (result.error === 'language_pack_missing') {
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
        showQuotaSheet({ mode: 'error', message: t('recording.alert.no_speech.message') });
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
      baseTranscriptRef.current = transcript;

      const response = await startSessionRecording(transcript);
      if (response.success) {
        return;
      }
      if (response.error === 'offline_model_not_ready') {
        return;
      }
      Alert.alert(t('common.error_title'), t('recording.alert.start_failed'));
    } finally {
      setIsPreparingRecording(false);
    }
  }, [startSessionRecording, t, transcript]);

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
  }, [isRecordingRef, startRecording, stopRecording]);

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
      let subjectDetected = false;
      let detectedType: 'person' | 'animal' | null = null;
      let categorizationResult: Awaited<ReturnType<typeof categorizeDream>> | null = null;

      if (latestTranscript) {
        try {
          categorizationResult = await categorizeDream(latestTranscript, language);
          dreamToSave = {
            ...dreamToSave,
            title: categorizationResult.title,
            theme: categorizationResult.theme,
            dreamType: categorizationResult.dreamType,
            hasPerson: categorizationResult.hasPerson,
            hasAnimal: categorizationResult.hasAnimal,
          };

          // Check if a subject was detected
          if (categorizationResult.hasPerson === true) {
            subjectDetected = true;
            detectedType = 'person';
          } else if (categorizationResult.hasAnimal === true) {
            subjectDetected = true;
            detectedType = 'animal';
          }
        } catch (err) {
          // Silently fail and proceed with default/derived values
          log.warn('Quick categorization failed:', err);
        }
      }

      const savedDream = await addDream(dreamToSave);
      setDraftDream(savedDream);

      // If subject detected, show proposition instead of navigating
      if (subjectDetected && detectedType && canAnalyzeNow && user) {
        setPendingSubjectDream(savedDream);
        setPendingSubjectMetadata(categorizationResult ? {
          title: categorizationResult.title,
          theme: categorizationResult.theme,
          dreamType: categorizationResult.dreamType,
          hasPerson: categorizationResult.hasPerson,
          hasAnimal: categorizationResult.hasAnimal,
        } : null);
        setDetectedSubjectType(detectedType);
        setShowSubjectProposition(true);
        resetComposer();
        return;
      }

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
		    canAnalyzeNow,
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

  // Subject proposition handlers
  const handleSubjectAccept = useCallback(() => {
    setShowSubjectProposition(false);
    setShowReferencePickerSheet(true);
  }, []);

  const handleSubjectDismiss = useCallback(() => {
    setShowSubjectProposition(false);
    setDetectedSubjectType(null);
    // Continue with normal analysis without reference images
    const dream = pendingSubjectDream;
    const metadata = pendingSubjectMetadata;
    if (dream && metadata) {
      setPendingSubjectDream(null);
      setPendingSubjectMetadata(null);
      // Proceed to normal analysis
      setAnalyzePromptDream({
        ...dream,
        ...metadata,
        hasPerson: metadata.hasPerson,
        hasAnimal: metadata.hasAnimal,
      } as DreamAnalysis);
    }
  }, [pendingSubjectDream, pendingSubjectMetadata]);

  const handleReferenceImagesSelected = useCallback((images: ReferenceImage[]) => {
    setReferenceImages(images);
  }, []);

  const handleReferencePickerClose = useCallback(() => {
    setShowReferencePickerSheet(false);
    setReferenceImages([]);
    setDetectedSubjectType(null);
    // Continue with normal analysis without reference images
    const dream = pendingSubjectDream;
    const metadata = pendingSubjectMetadata;
    if (dream && metadata) {
      setPendingSubjectDream(null);
      setPendingSubjectMetadata(null);
      setAnalyzePromptDream({
        ...dream,
        ...metadata,
        hasPerson: metadata.hasPerson,
        hasAnimal: metadata.hasAnimal,
      } as DreamAnalysis);
    }
  }, [pendingSubjectDream, pendingSubjectMetadata]);

  const handleGenerateWithReference = useCallback(async () => {
    if (!pendingSubjectDream || !pendingSubjectMetadata || referenceImages.length === 0) {
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
      router.push(`/journal/${updatedDream.id}`);
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
    pendingSubjectDream,
    pendingSubjectMetadata,
    referenceImages,
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
      const shown = showQuotaSheet();
      if (shown) return;
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
      requestAnimationFrame(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      });

      const analyzedDream = await analyzeDream(dream.id, dream.transcript, {
        replaceExistingImage: true,
        lang: language,
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
        // Reuse the same sheet for consistent UX
        showQuotaSheet({ mode: 'error', message: error.userMessage });
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
    if (isRecordingRef.current) {
      recordingTransitionRef.current = true;
      try {
        await stopRecording({ silent: true });
      } finally {
        recordingTransitionRef.current = false;
      }
    }
    setInputMode('text');
  }, [isRecordingRef, stopRecording]);

  const switchToVoiceMode = useCallback(async () => {
    setInputMode('voice');
    if (isRecordingRef.current) {
      return;
    }
    recordingTransitionRef.current = true;
    try {
      await startRecording();
    } finally {
      recordingTransitionRef.current = false;
    }
  }, [isRecordingRef, startRecording]);

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
            ref={scrollViewRef}
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
                    disabled={interactionDisabled || isPreparingRecording}
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
                    onRetry={
                      pendingAnalysisDream
                        ? handleFirstDreamAnalyze
                        : pendingSubjectDream
                          ? handleGenerateWithReference
                          : undefined
                    }
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
          primaryLoading: isPersisting,
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
          primaryLoading: isPersisting,
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
        title={
          quotaSheetMode === 'limit'
            ? tier === 'guest'
              ? t('recording.analysis_limit.title_guest')
              : t('recording.analysis_limit.title_free')
            : t('common.error_title')
        }
        subtitle={
          quotaSheetMode === 'limit'
            ? tier === 'guest'
              ? t('recording.analysis_limit.message_guest', {
                limit: usage?.analysis.limit ?? QUOTAS.guest.analysis ?? 0,
              })
              : t('recording.analysis_limit.message_free', {
                limit: usage?.analysis.limit ?? QUOTAS.free.analysis ?? 0,
              })
            : quotaSheetMessage
        }
        testID={TID.Sheet.QuotaLimit}
        titleTestID={TID.Text.QuotaLimitTitle}
        actions={{
          primaryLabel:
            quotaSheetMode === 'limit'
              ? tier === 'guest'
                ? t('recording.analysis_limit.cta_guest')
                : t('recording.analysis_limit.cta_free')
              : t('common.ok'),
          onPrimary:
            quotaSheetMode === 'limit'
              ? handleQuotaLimitPrimary
              : handleQuotaLimitDismiss,
          primaryTestID:
            quotaSheetMode === 'limit'
              ? tier === 'guest'
                ? TID.Button.QuotaLimitCtaGuest
                : TID.Button.QuotaLimitCtaFree
              : TID.Button.QuotaLimitCtaFree,
          secondaryLabel: quotaSheetMode === 'limit' ? t('recording.analysis_limit.journal') : undefined,
          onSecondary: quotaSheetMode === 'limit' ? handleQuotaLimitJournal : undefined,
          secondaryTestID: quotaSheetMode === 'limit' ? TID.Button.QuotaLimitJournal : undefined,
          linkLabel: quotaSheetMode === 'limit' ? t('recording.analysis_limit.dismiss') : undefined,
          onLink: quotaSheetMode === 'limit' ? handleQuotaLimitDismiss : undefined,
        }}
      >
        {quotaSheetMode === 'limit' && tier === 'free' && (
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

      {/* Subject Proposition */}
      {showSubjectProposition && detectedSubjectType && (
        <View style={styles.subjectPropositionOverlay}>
          <SubjectProposition
            subjectType={detectedSubjectType}
            onAccept={handleSubjectAccept}
            onDismiss={handleSubjectDismiss}
          />
        </View>
      )}

      {/* Reference Image Picker Sheet */}
      <StandardBottomSheet
        visible={showReferencePickerSheet}
        onClose={handleReferencePickerClose}
        title={detectedSubjectType === 'person'
          ? t('reference_image.title_person')
          : t('reference_image.title_animal')}
        actions={{
          primaryLabel: t('subject_proposition.accept'),
          onPrimary: handleGenerateWithReference,
          primaryDisabled: referenceImages.length === 0 || isPersisting,
          primaryLoading: isPersisting,
          secondaryLabel: t('subject_proposition.skip'),
          onSecondary: handleReferencePickerClose,
        }}
      >
        {detectedSubjectType && (
          <ReferenceImagePicker
            subjectType={detectedSubjectType}
            onImagesSelected={handleReferenceImagesSelected}
            maxImages={2}
          />
        )}
      </StandardBottomSheet>

      {/* Offline Model Download Sheet */}
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
  subjectPropositionOverlay: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    right: 16,
    zIndex: 100,
  },
});
