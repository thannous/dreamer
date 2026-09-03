import { ReminderOptInCard } from '@/components/reminders/ReminderOptInCard';
import { Toast } from '@/components/Toast';
import { DreamRecallAssistantCard } from '@/components/journal/DreamRecallAssistantCard';
import { DreamShareImage } from '@/components/journal/DreamShareImage';
import { ImageRetry } from '@/components/journal/ImageRetry';
import {
  AnalysisNoticeSheet,
  DeleteConfirmSheet,
  ImageErrorSheet,
  QuotaLimitSheet,
  ReanalyzeSheet,
  ReferenceImageSheet,
  ReplaceImageSheet,
  type AnalysisNotice,
} from '@/components/journal/JournalDetailSheets';
import { FlatGlassCard } from '@/components/inspiration/GlassCard';
import { AtmosphericBackground } from '@/components/inspiration/AtmosphericBackground';
import { PressableScale, Reveal } from '@/components/motion';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useOnboarding } from '@/context/OnboardingContext';
import { ScrollPerfProvider } from '@/context/ScrollPerfContext';
import { useDreams } from '@/context/DreamsContext';
import { useLanguage } from '@/context/LanguageContext';
import { useTheme } from '@/context/ThemeContext';
import { useClearWebFocus } from '@/hooks/useClearWebFocus';
import { useDreamShareComposite } from '@/hooks/useDreamShareComposite';
import { useLocaleFormatting } from '@/hooks/useLocaleFormatting';
import { useQuota } from '@/hooks/useQuota';
import { useScrollIdle } from '@/hooks/useScrollIdle';
import { useTranslation } from '@/hooks/useTranslation';
import { blurActiveElement } from '@/lib/accessibility';
import { buildFirstValueProperties } from '@/lib/activationAnalytics';
import { trackProductEvent } from '@/lib/analytics';
import {
  isRecoverablePendingAnalysis,
  isResumableAnalysisRequest,
} from '@/lib/analysisRequest';
import { getDreamThemeLabel, getDreamTypeLabel } from '@/lib/dreamLabels';
import { getDreamSyncState, normalizeDreamMemoryMetadata } from '@/lib/dreamUtils';
import {
  buildReflectionResumeHref,
  getDreamAnalysisState,
  getJournalDetailPrimaryFamily,
  getReflectionJourney,
  getReflectionQuotaHint,
  type ReflectionQuotaHint,
} from '@/lib/dreamUsage';
import { getDreamAnalysisFreshness } from '@/lib/dreamAnalysisFreshness';
import { isMockModeEnabled, isReferenceImagesEnabled } from '@/lib/env';
import { classifyError, QuotaError, QuotaErrorCode, type ClassifiedError } from '@/lib/errors';
import { getDreamImageVersion, getImageConfig, withCacheBuster } from '@/lib/imageUtils';
import {
  resolveJournalIllustrationAccess,
  resolveJournalIllustrationCta,
  resolveJournalIllustrationSidecar,
  shouldReplaceExistingImage,
  shouldShowCompletedJournalReading,
} from '@/lib/journalIllustrationPolicy';
import { getFileExtensionFromUrl, getMimeTypeFromExtension } from '@/lib/journal/shareImageUtils';
import { resolveJournalDreamRecallOfferEligible } from '@/lib/journalDreamRecallOffer';
import { isJournalSavedConfirmationParam } from '@/lib/journalSavedConfirmation';
import { buildPaywallHref } from '@/lib/paywallRoute';
import { sortWithSelectionFirst } from '@/lib/sorting';
import { TID } from '@/lib/testIDs';
import type { DreamAnalysis, DreamTheme, DreamType, ReferenceImage } from '@/lib/types';
import { categorizeDream, generateImageWithReference } from '@/services/geminiService';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/ui/icon-symbol';

type ShareNavigator = Navigator & {
  share?: (data: { title?: string; text?: string; url?: string }) => Promise<void>;
  clipboard?: {
    writeText?: (text: string) => Promise<void>;
  };
};

interface ShareImageData {
  source: string;
  extension: string;
  mimeType: string;
}

const getShareNavigator = (): ShareNavigator | undefined => {
  if (typeof navigator === 'undefined') {
    return undefined;
  }
  return navigator as ShareNavigator;
};

const DREAM_TYPES: DreamType[] = ['Lucid Dream', 'Recurring Dream', 'Nightmare', 'Symbolic Dream'];
const DREAM_THEMES: DreamTheme[] = ['surreal', 'mystical', 'calm', 'noir'];
const isMockMode = isMockModeEnabled();
const DREAM_IMAGE_ASPECT = 9 / 16;
const DREAM_IMAGE_CROP_EPSILON = 0.01;

const humanizeMemoryValue = (value: string): string => value.replace(/_/g, ' ');

const isTechnicalRevisionConflict = (message?: string | null): boolean =>
  String(message ?? '').toLowerCase().includes('revision conflict');

const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

type PickedImageAsset = {
  uri: string;
  width?: number;
  height?: number;
  base64?: string | null;
  mimeType?: string | null;
};

const getCenteredCropRect = (width: number, height: number, targetAspect: number) => {
  if (!width || !height) return null;
  const currentAspect = width / height;
  if (Math.abs(currentAspect - targetAspect) <= DREAM_IMAGE_CROP_EPSILON) return null;

  if (currentAspect > targetAspect) {
    const cropWidth = Math.floor(height * targetAspect);
    const originX = Math.max(0, Math.floor((width - cropWidth) / 2));
    return { originX, originY: 0, width: cropWidth, height };
  }

  const cropHeight = Math.floor(width / targetAspect);
  const originY = Math.max(0, Math.floor((height - cropHeight) / 2));
  return { originX: 0, originY, width, height: cropHeight };
};

const cropDreamImageToAspect = async (
  asset: PickedImageAsset,
  errorMessage: string
): Promise<PickedImageAsset> => {
  if (!asset.width || !asset.height) {
    throw new Error(errorMessage);
  }

  const crop = getCenteredCropRect(asset.width, asset.height, DREAM_IMAGE_ASPECT);
  if (!crop) {
    return asset;
  }

  try {
    const manipulator = await import('expo-image-manipulator');
    const result = await manipulator.manipulateAsync(asset.uri, [{ crop }], {
      compress: 1,
      format: manipulator.SaveFormat.JPEG,
      base64: Platform.OS === 'web',
    });

    return {
      ...asset,
      uri: result.uri,
      width: result.width,
      height: result.height,
      base64: result.base64 ?? asset.base64 ?? null,
      mimeType: 'image/jpeg',
    };
  } catch {
    throw new Error(errorMessage);
  }
};

const Skeleton = ({ className }: { className: string }) => (
  <View className={`bg-ink-soft ${className}`} />
);

const TypewriterText = ({ text, className, shouldAnimate }: { text: string; className: string; shouldAnimate: boolean }) => {
  const [displayedText, setDisplayedText] = useState(shouldAnimate ? '' : text);

  useEffect(() => {
    if (!shouldAnimate) {
      setDisplayedText(text);
      return;
    }

    if (!text.length) {
      setDisplayedText('');
      return;
    }

    let i = 0;
    const timer = setInterval(() => {
      i = Math.min(i + 2, text.length); // Speed
      setDisplayedText(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(timer);
      }
    }, 10);
    return () => clearInterval(timer);
  }, [text, shouldAnimate]);

  return <Text className={className}>{displayedText}</Text>;
};

export default function JournalDetailScreen() {
  const { id, saved: savedParam } = useLocalSearchParams<{ id: string; saved?: string | string[] }>();
  const dreamId = useMemo(() => Number(id), [id]);
  const [savedConfirmationVisible, setSavedConfirmationVisible] = useState(
    () => isJournalSavedConfirmationParam(savedParam)
  );
  const recallEligibleDreamIdRef = useRef<string | null>(
    resolveJournalDreamRecallOfferEligible({
      dreamId: id,
      savedParam,
      previouslyEligibleDreamId: null,
    }).eligibleDreamId
  );
  /* eslint-disable react-hooks/refs -- remember saved=1 after param clear without mutating the ref during render */
  const recallOffer = resolveJournalDreamRecallOfferEligible({
    dreamId: id,
    savedParam,
    previouslyEligibleDreamId: recallEligibleDreamIdRef.current,
  });
  /* eslint-enable react-hooks/refs */
  useEffect(() => {
    recallEligibleDreamIdRef.current = recallOffer.eligibleDreamId;
  }, [recallOffer.eligibleDreamId]);
  const {
    dreams,
    toggleFavorite,
    updateDream,
    deleteDream,
    retryDreamSync,
    resolveDreamConflict,
    generateDreamImage,
    analyzeDream,
  } = useDreams();
  const { user } = useAuth();
  const { state: onboardingState, transition: transitionOnboarding } = useOnboarding();
  const { colors, shadows, mode } = useTheme();
  const insets = useSafeAreaInsets();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const { language } = useLanguage();
  const scrollPerf = useScrollIdle();
  useClearWebFocus();

  useEffect(() => {
    if (!isJournalSavedConfirmationParam(savedParam)) {
      return;
    }
    router.setParams({ saved: undefined });
  }, [savedParam]);
  const [isRetryingImage, setIsRetryingImage] = useState(false);
  const [isRetryingSync, setIsRetryingSync] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisRecoveryClock, setAnalysisRecoveryClock] = useState(() => Date.now());
  const [showReplaceImageSheet, setShowReplaceImageSheet] = useState(false);
  const [showReanalyzeSheet, setShowReanalyzeSheet] = useState(false);
  const [showDeleteSheet, setShowDeleteSheet] = useState(false);
  const [reanalyzeImagePolicy, setReanalyzeImagePolicy] = useState<'keep' | 'regenerate'>('keep');
  const [isIllustrationFullscreen, setIsIllustrationFullscreen] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isShareModalVisible, setShareModalVisible] = useState(false);
  const [shareCopyStatus, setShareCopyStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [favoriteError, setFavoriteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [analysisNotice, setAnalysisNotice] = useState<AnalysisNotice | null>(null);
  const [showQuotaLimitSheet, setShowQuotaLimitSheet] = useState(false);
  const [quotaSheetMode, setQuotaSheetMode] = useState<'quota' | 'login'>('quota');
  const [imageErrorMessage, setImageErrorMessage] = useState<string | null>(null);

  // Reference image generation state
  const [showReferenceSheet, setShowReferenceSheet] = useState(false);
  const [referenceSubjectType, setReferenceSubjectType] = useState<'person' | 'animal' | null>(null);
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([]);
  const [isGeneratingWithReference, setIsGeneratingWithReference] = useState(false);
  const hasBackfilledSubjectRef = useRef(false);
  const trackedAnalysisResultRef = useRef<number | null>(null);

  useEffect(() => {
    if (isShareModalVisible) {
      blurActiveElement();
    }
  }, [isShareModalVisible]);
  const { formatDreamDate, formatDreamTime } = useLocaleFormatting();
  const {
    canAnalyzeNow,
    canAnalyze,
    canGenerateImageNow,
    tier,
    usage,
    loading: quotaLoading,
    quotaStatus,
  } = useQuota();
  const { t } = useTranslation();
  const referenceImagesEnabled = isReferenceImagesEnabled();
  const isPlus = tier === 'plus';
  const canUseReference = referenceImagesEnabled && Boolean(user);

  const dream = useMemo(() => dreams.find((d) => d.id === dreamId), [dreams, dreamId]);
  const handleImageUpgrade = useCallback(() => {
    router.push(buildPaywallHref('image_generation'));
  }, []);
  useEffect(() => {
    if (dream?.analysisStatus !== 'pending' || isAnalyzing) return undefined;

    const timer = setInterval(() => setAnalysisRecoveryClock(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, [dream?.analysisStatus, dream?.clientUpdatedAt, dream?.updatedAt, isAnalyzing]);
  const dreamSyncState = useMemo(
    () => (dream && !isMockMode ? getDreamSyncState(dream) : 'clean'),
    [dream]
  );
  const hasExistingImage = useMemo(() => Boolean(dream?.imageUrl?.trim()), [dream?.imageUrl]);
  const dreamTypeLabel = useMemo(
    () => (dream ? getDreamTypeLabel(dream.dreamType, t) ?? dream.dreamType : undefined),
    [dream, t]
  );
  const dreamThemeLabel = useMemo(
    () => (dream ? getDreamThemeLabel(dream.theme, t) ?? dream.theme : undefined),
    [dream, t]
  );
  const dreamMemory = useMemo(
    () => (dream ? normalizeDreamMemoryMetadata(dream.memory) : undefined),
    [dream]
  );
  const dreamMemoryItems = useMemo(() => {
    if (!dreamMemory) return [];

    const translatedMemoryValue = (key: string, fallback: string) => {
      const label = t(key);
      return label === key ? humanizeMemoryValue(fallback) : label;
    };

    const items: { key: string; label: string; value: string }[] = [];

    if (dreamMemory.rememberedKind) {
      items.push({
        key: 'kind',
        label: t('recording.remembered_profile.kind_label'),
        value: translatedMemoryValue(
          `recording.remembered_profile.kind.${dreamMemory.rememberedKind}`,
          dreamMemory.rememberedKind,
        ),
      });
    }
    if (dreamMemory.approximatePeriod) {
      items.push({
        key: 'period',
        label: t('recording.remembered_profile.period_label'),
        value: translatedMemoryValue(
          `recording.remembered_profile.period.${dreamMemory.approximatePeriod}`,
          dreamMemory.approximatePeriod,
        ),
      });
    }
    if (dreamMemory.strongestFragment) {
      items.push({
        key: 'fragment',
        label: t('recording.remembered_profile.fragment_label'),
        value: translatedMemoryValue(
          `recording.remembered_profile.fragment.${dreamMemory.strongestFragment}`,
          dreamMemory.strongestFragment,
        ),
      });
    }
    if (items.length === 0) {
      items.push({
        key: 'origin',
        label: t('journal.detail.zone.memory'),
        value: t('recording.activation_insight.signal.memory'),
      });
    }

    return items;
  }, [dreamMemory, t]);
  const [editableTitle, setEditableTitle] = useState('');
  const [editableTheme, setEditableTheme] = useState('');
  const [editableDreamType, setEditableDreamType] = useState('');
  const [editableTranscript, setEditableTranscript] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isPickingImage, setIsPickingImage] = useState(false);
  const [isEditingTranscript, setIsEditingTranscript] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [transcriptSectionOffset, setTranscriptSectionOffset] = useState(0);
  const scrollViewRef = useRef<ScrollView | null>(null);
  const lastAnalysisNoticeRef = useRef<AnalysisNotice | null>(null);

  const sortedDreamTypes = useMemo(() => {
    return sortWithSelectionFirst(DREAM_TYPES, dream?.dreamType);
  }, [dream?.dreamType]);

  const sortedDreamThemes = useMemo(() => {
    return sortWithSelectionFirst(DREAM_THEMES, dream?.theme);
  }, [dream?.theme]);

  useEffect(() => {
    if (analysisNotice) {
      lastAnalysisNoticeRef.current = analysisNotice;
    }
  }, [analysisNotice]);

  useEffect(() => {
    if (!dream) {
      setEditableTitle('');
      setEditableTheme('');
      setEditableDreamType('');
      setEditableTranscript('');
      setIsEditing(false);
      setIsEditingTranscript(false);
      return;
    }
    setEditableTitle(dream.title || '');
    setEditableTheme(dream.theme || '');
    setEditableDreamType(dream.dreamType || '');
    setEditableTranscript(dream.transcript || '');
    setIsEditing(false);
    setIsEditingTranscript(false);
  }, [dream]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, () => setIsKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setIsKeyboardVisible(false));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Lazy backfill hasPerson/hasAnimal if undefined and transcript exists
  useEffect(() => {
    if (!dream) return;
    if (hasBackfilledSubjectRef.current) return;
    if (dream.hasPerson !== undefined || dream.hasAnimal !== undefined) return;
    if (!dream.transcript?.trim()) return;

    hasBackfilledSubjectRef.current = true;

    (async () => {
      try {
        const result = await categorizeDream(dream.transcript, language);
        if (result.hasPerson !== undefined || result.hasAnimal !== undefined) {
          await updateDream({
            ...dream,
            hasPerson: result.hasPerson,
            hasAnimal: result.hasAnimal,
          });
        }
      } catch (err) {
        // Silently fail - this is a background optimization
        if (__DEV__) {
          console.warn('[JournalDetail] Lazy backfill failed:', err);
        }
      }
    })();
  }, [dream, language, updateDream]);

  useEffect(() => {
    if (!isEditingTranscript || !scrollViewRef.current) {
      return;
    }
    requestAnimationFrame(() => {
      scrollViewRef.current?.scrollTo({ y: Math.max(transcriptSectionOffset - 32, 0), animated: true });
    });
  }, [isEditingTranscript, transcriptSectionOffset]);


  const { shareImageRef, shareComposite } = useDreamShareComposite();

  const analysisState = useMemo(() => getDreamAnalysisState(dream), [dream]);
  const guestImageAvailable = useMemo(() => {
    if (quotaLoading) return false;
    const image = usage?.image;
    if (image) {
      return image.limit === null || image.used < image.limit;
    }
    return canGenerateImageNow;
  }, [canGenerateImageNow, quotaLoading, usage?.image]);
  const illustrationAccess = useMemo(
    () =>
      resolveJournalIllustrationAccess({
        tier,
        canGenerateImageNow: tier === 'guest' ? guestImageAvailable : canGenerateImageNow,
        isAnalyzed: analysisState.isAnalyzed,
        imageUrl: dream?.imageUrl,
        analysisRequestId: dream?.analysisRequestId,
      }),
    [
      analysisState.isAnalyzed,
      canGenerateImageNow,
      dream?.analysisRequestId,
      dream?.imageUrl,
      guestImageAvailable,
      tier,
    ]
  );
  const illustrationSidecar = useMemo(
    () =>
      resolveJournalIllustrationSidecar({
        imageUrl: dream?.imageUrl,
        imageGenerationFailed: dream?.imageGenerationFailed,
        imageJobStatus: dream?.imageJobStatus,
      }),
    [dream?.imageGenerationFailed, dream?.imageJobStatus, dream?.imageUrl]
  );
  const illustrationCta = useMemo(
    () =>
      resolveJournalIllustrationCta({
        sidecar: illustrationSidecar,
        isAnalyzed: analysisState.isAnalyzed,
        allowed: illustrationAccess.allowed,
        reason: illustrationAccess.reason,
        tier,
      }),
    [
      analysisState.isAnalyzed,
      illustrationAccess.allowed,
      illustrationAccess.reason,
      illustrationSidecar,
      tier,
    ]
  );
  const showCompletedReading = shouldShowCompletedJournalReading(
    dream?.analysisStatus,
    analysisState.isAnalyzed
  );
  const analysisFreshness = useMemo(() => getDreamAnalysisFreshness(dream), [dream]);
  const isAnalysisStale = analysisFreshness === 'stale';
  const visibleIllustrationCta =
    quotaLoading && illustrationCta === 'quota' ? 'none' : illustrationCta;
  const canOfferImageUpgrade = visibleIllustrationCta === 'upgrade';

  useEffect(() => {
    if (
      !dream ||
      !analysisState.isAnalyzed ||
      !dream.interpretation?.trim() ||
      trackedAnalysisResultRef.current === dream.id
    ) {
      return;
    }

    trackedAnalysisResultRef.current = dream.id;
    const isOnboardingResult =
      onboardingState.pendingRecordingIntent?.savedDreamId === dream.id;

    void trackProductEvent('analysis_result_viewed', {
      source: isOnboardingResult ? 'recording_flow' : 'journal_detail',
    });
    if (onboardingState.completionReason === 'analyze') {
      void trackProductEvent(
        'first_value_viewed',
        buildFirstValueProperties(onboardingState, 'analysis_result')
      );
    }

    if (isOnboardingResult) {
      void transitionOnboarding({ type: 'CLEAR_PENDING_INTENT' }).catch(() => {
        // The result remains visible and the persisted intent will be retried
        // safely on the next launch.
      });
    }
  }, [analysisState.isAnalyzed, dream, onboardingState, transitionOnboarding]);
  const reflectionJourney = useMemo(
    () => getReflectionJourney(dream, analysisRecoveryClock, { tier }),
    [analysisRecoveryClock, dream, tier]
  );
  const primaryKind = reflectionJourney.primary.kind;
  const primaryAction = getJournalDetailPrimaryFamily(primaryKind);
  const isStalePrimaryAction = isAnalysisStale && !isEditing && !isEditingTranscript;
  const visiblePrimaryAction = isStalePrimaryAction ? 'analyze' : primaryAction;
  const quotaHint = useMemo(
    () =>
      getReflectionQuotaHint(
        isStalePrimaryAction ? 'analysis' : reflectionJourney.primary.consumesQuota,
        usage
      ),
    [isStalePrimaryAction, reflectionJourney.primary.consumesQuota, usage]
  );
  const formatQuotaHint = useCallback(
    (hint: ReflectionQuotaHint) => {
      if (hint.kind === 'none') return null;
      if (hint.kind === 'unlimited') {
        return t('journal.detail.quota_hint.unlimited');
      }
      const quotaKey = `journal.detail.quota_hint.quota.${hint.quota}` as const;
      if (hint.kind === 'remaining') {
        return t('journal.detail.quota_hint.remaining', {
          quota: t(quotaKey),
          remaining: hint.remaining,
        });
      }
      return t('journal.detail.quota_hint.unknown', { quota: t(quotaKey) });
    },
    [t]
  );
  const quotaHintLabel = formatQuotaHint(quotaHint);
  const canRecoverPendingAnalysis = useMemo(
    () => !isAnalyzing && isRecoverablePendingAnalysis(dream, analysisRecoveryClock),
    [analysisRecoveryClock, dream, isAnalyzing]
  );
  const isAnalysisPending = reflectionJourney.isPendingFresh && !isAnalyzing;
  const isPrimaryActionBusy = visiblePrimaryAction === 'analyze' && (isAnalyzing || isAnalysisPending);
  const detailActionCard = useMemo(() => {
    if (!dream) {
      return null;
    }

    if (isAnalysisPending) {
      return {
        icon: 'sparkles' as const,
        title: t('journal.detail.action.pending.title'),
        message: t('journal.detail.action.pending.message'),
        step: t('journal.detail.action.pending.step'),
        cta: t('journal.detail.action.pending.cta'),
        disabled: true,
      };
    }

    if (isStalePrimaryAction) {
      return {
        icon: 'arrow.clockwise' as const,
        title: t('journal.detail.stale.label'),
        message: t('journal.detail.stale.banner'),
        step: t('journal.detail.action.analyze.step'),
        cta: t('journal.detail.stale.cta'),
        disabled: false,
      };
    }

    if (primaryAction === 'analyze') {
      const failed = dream.analysisStatus === 'failed' || canRecoverPendingAnalysis;
      return {
        icon: failed ? 'arrow.clockwise' as const : 'sparkles' as const,
        title: failed
          ? t('journal.detail.action.retry.title')
          : t('journal.detail.action.analyze.title'),
        message: failed
          ? t('journal.detail.action.retry.message')
          : t('journal.detail.action.analyze.message'),
        step: t('journal.detail.action.analyze.step'),
        cta: failed
          ? t('journal.detail.analyze_button.retry')
          : t('journal.detail.analyze_button.default'),
        disabled: false,
      };
    }

    if (primaryKind === 'retry_chat') {
      return {
        icon: 'arrow.clockwise' as const,
        title: t('journal.detail.action.retry_chat.title'),
        message: t('journal.detail.action.retry_chat.message'),
        step: t('journal.detail.action.continue.step'),
        cta: t('journal.detail.action.retry_chat.cta'),
        disabled: false,
      };
    }

    if (primaryAction === 'continue') {
      return {
        icon: 'bubble.left.and.bubble.right.fill' as const,
        title: t('journal.detail.action.continue.title'),
        message: t('journal.detail.action.continue.message'),
        step: t('journal.detail.action.continue.step'),
        cta: t('journal.detail.explore_button.continue'),
        disabled: false,
      };
    }

    return {
      icon: 'bubble.left.and.bubble.right' as const,
      title: t('journal.detail.action.explore.title'),
      message: t('journal.detail.action.explore.message'),
      step: t('journal.detail.action.explore.step'),
      cta: t('journal.detail.explore_button.new'),
      disabled: false,
    };
  }, [canRecoverPendingAnalysis, dream, isAnalysisPending, isStalePrimaryAction, primaryAction, primaryKind, t]);
  const isAnalysisLocked = !!dream && (isAnalysisPending || isAnalyzing);
  const isImageJobPending = illustrationSidecar === 'pending';
  const isSyncPending = dreamSyncState === 'pending';
  const isSyncFailed = dreamSyncState === 'failed';
  const isSyncConflict = dreamSyncState === 'conflict';
  const shareMessage = useMemo(() => {
    if (!dream) return '';
    const sections: string[] = [];
    if (dream.title) {
      sections.push(`🌙 ${dream.title}`);
    }
    const quote = dream.shareableQuote?.trim();
    if (quote) {
      sections.push(`“${quote}”`);
    }
    if (dream.interpretation?.trim()) {
      sections.push(
        `${t('journal.detail.share.interpretation_label')} ${dream.interpretation.trim()}`,
      );
    }
    const metadata: string[] = [];
    if (dream.dreamType) {
      metadata.push(t('journal.detail.share.type_label', { type: dreamTypeLabel || dream.dreamType }));
    }
    if (dream.theme) {
      metadata.push(
        t('journal.detail.share.theme_label', {
          theme: dreamThemeLabel || dream.theme,
        }),
      );
    }
    if (metadata.length) {
      sections.push(metadata.join(' • '));
    }
    sections.push(t('journal.detail.share.footer'));
    return sections.join('\n\n');
  }, [dream, dreamThemeLabel, dreamTypeLabel, t]);
  const shareTitle = useMemo(
    () => (dream?.title ? dream.title : t('journal.title')),
    [dream, t],
  );
  const shareImage = useMemo<ShareImageData | undefined>(() => {
    if (!dream) return undefined;
    const source = dream.imageUrl || dream.thumbnailUrl;
    if (!source) return undefined;
    const extension = getFileExtensionFromUrl(source);
    return {
      source,
      extension,
      mimeType: getMimeTypeFromExtension(extension),
    };
  }, [dream]);
  const clipboardSupported = Platform.OS === 'web' && Boolean(getShareNavigator()?.clipboard?.writeText);

  const startMetadataEditing = useCallback(() => {
    if (isAnalysisLocked) return;
    setIsEditingTranscript(false);
    setIsEditing(true);
  }, [isAnalysisLocked]);

  const handleSave = useCallback(async () => {
    if (!dream) return;

    const normalizedTitle = editableTitle.trim() || dream.title;
    const normalizedTheme = editableTheme.trim() || dream.theme;
    const normalizedDreamType = editableDreamType.trim() || dream.dreamType;

    const updatedDream: DreamAnalysis = {
      ...dream,
      title: normalizedTitle,
      // User can only meaningfully choose among the known themes/types today,
      // but we keep runtime flexible and trust persisted values here.
      theme: normalizedTheme as DreamAnalysis['theme'],
      dreamType: normalizedDreamType as DreamAnalysis['dreamType'],
    };

    await updateDream(updatedDream);
    setIsEditing(false);
  }, [dream, editableTitle, editableTheme, editableDreamType, updateDream]);

  const handlePickImage = useCallback(async () => {
    if (!dream || isAnalysisLocked) return;

    try {
      setIsPickingImage(true);
      const ImagePicker = await import('expo-image-picker');
      const allowCropInPicker = Platform.OS === 'android';
      const pickerQuality = allowCropInPicker ? 1 : 0.9;
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: allowCropInPicker,
        ...(allowCropInPicker ? { aspect: [9, 16] as [number, number] } : {}),
        quality: pickerQuality,
        base64: Platform.OS === 'web',
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      const asset = result.assets[0] as PickedImageAsset | undefined;
      if (!asset) {
        return;
      }

      const croppedAsset = await cropDreamImageToAspect(
        asset,
        t('journal.detail.image.crop_error')
      );
      const selectedUri = Platform.OS === 'web' && croppedAsset.base64
        ? `data:${croppedAsset.mimeType ?? 'image/jpeg'};base64,${croppedAsset.base64}`
        : croppedAsset.uri;

      if (!selectedUri) {
        return;
      }

      const imageUpdatedAt = Date.now();
      const analysisRequestId = generateUUID();
      const updatedDream: DreamAnalysis = {
        ...dream,
        imageUrl: selectedUri,
        thumbnailUrl: selectedUri,
        imageGenerationFailed: false,
        imageUpdatedAt,
        analysisRequestId,
        imageSource: 'user',
      };

      await updateDream(updatedDream);
      setIsEditing(false);
    } catch (error) {
      const msg = error instanceof Error ? error.message : t('common.unknown_error');
      Alert.alert(t('common.error_title'), msg);
    } finally {
      setIsPickingImage(false);
    }
  }, [dream, isAnalysisLocked, updateDream, t]);

  // Reference image generation handlers
  const handleReferenceImagesSelected = useCallback((images: ReferenceImage[]) => {
    setReferenceImages(images);
  }, []);

  const handleReferenceSheetClose = useCallback(() => {
    setShowReferenceSheet(false);
    setReferenceSubjectType(null);
    setReferenceImages([]);
  }, []);

  const handleGenerateWithReference = useCallback(async () => {
    if (!dream || referenceImages.length === 0 || !canUseReference) return;

    setShowReferenceSheet(false);
    setIsGeneratingWithReference(true);

    try {
      const imageUrl = await generateImageWithReference({
        transcript: dream.transcript,
        prompt: dream.transcript,
        referenceImages,
        previousImageUrl: dream.imageUrl || undefined,
        lang: language,
      });

      const imageUpdatedAt = Date.now();
      const analysisRequestId = generateUUID();
      const updatedDream: DreamAnalysis = {
        ...dream,
        imageUrl,
        thumbnailUrl: imageUrl,
        imageGenerationFailed: false,
        imageUpdatedAt,
        analysisRequestId,
        imageSource: 'ai',
      };

      await updateDream(updatedDream);

      // Cleanup
      setReferenceSubjectType(null);
      setReferenceImages([]);
    } catch (error) {
      const classified = error && typeof error === 'object' && 'userMessage' in error && 'canRetry' in error
        ? (error as ClassifiedError)
        : classifyError(error instanceof Error ? error : new Error('Unknown error'), t);
      if (classified.canRetry) {
        Alert.alert(t('common.error_title'), classified.userMessage, [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('analysis.retry'), onPress: () => void handleGenerateWithReference() },
        ]);
      } else {
        Alert.alert(t('common.error_title'), classified.userMessage);
      }
    } finally {
      setIsGeneratingWithReference(false);
    }
  }, [canUseReference, dream, language, referenceImages, t, updateDream]);

  const openShareModal = useCallback(() => {
    setShareCopyStatus('idle');
    setShareModalVisible(true);
  }, []);
  const closeShareModal = useCallback(() => {
    setShareModalVisible(false);
    setShareCopyStatus('idle');
  }, []);
  const handleCopyShareText = useCallback(async () => {
    const webNavigator = getShareNavigator();
    if (!webNavigator?.clipboard?.writeText) {
      setShareCopyStatus('error');
      return;
    }
    try {
      await webNavigator.clipboard.writeText(shareMessage || '');
      setShareCopyStatus('success');
    } catch {
      setShareCopyStatus('error');
    }
  }, [shareMessage]);
  // Use full-resolution image config for detail view
  const imageConfig = useMemo(() => getImageConfig('full'), []);
  const imageVersion = useMemo(() => {
    if (!dream?.imageUrl) return undefined;
    return getDreamImageVersion(dream);
  }, [dream]);
  const imageCacheKey = useMemo(() => {
    if (!dream?.imageUrl || !imageVersion) return undefined;
    return `${dream.imageUrl}|${imageVersion}`;
  }, [dream?.imageUrl, imageVersion]);
  const displayImageUrl = useMemo(() => {
    if (!dream?.imageUrl) return undefined;
    return withCacheBuster(dream.imageUrl, imageVersion);
  }, [dream?.imageUrl, imageVersion]);


  // Define callbacks before early return (hooks must be called unconditionally)
  const onShare = useCallback(async () => {
    if (!dream || isAnalysisLocked) return;
    setIsSharing(true);
    try {
      if (Platform.OS === 'web') {
        const webNavigator = getShareNavigator();
        if (webNavigator?.share) {
          try {
            await webNavigator.share({ text: shareMessage, title: shareTitle });
            return;
          } catch (error) {
            if (error instanceof DOMException && error.name === 'AbortError') {
              return;
            }
          }
        }
        openShareModal();
        return;
      }

      // Mobile (iOS/Android): Use composite image for sharing
      if (shareImage) {
        await shareComposite(dream);
        return;
      }

      // Fallback to text-only sharing if no image
      await Share.share({
        message: shareMessage,
        title: shareTitle,
      });
      return;
    } catch (error) {
      console.error('Share failed:', error);
      if (Platform.OS === 'web') {
        openShareModal();
      } else {
        Alert.alert(t('common.error_title'), t('journal.detail.share.error_message'));
      }
    } finally {
      setIsSharing(false);
    }
  }, [dream, isAnalysisLocked, openShareModal, shareComposite, shareImage, shareMessage, shareTitle, t]);

  const handleToggleFavorite = useCallback(async () => {
    if (!dream || isAnalysisLocked) return;
    try {
      setFavoriteError(null);
      await toggleFavorite(dream.id);
    } catch (error) {
      if (__DEV__) {
        console.error('Failed to toggle favorite', error);
      }
      setFavoriteError(t('journal.detail.favorite.error'));
    }
  }, [dream, isAnalysisLocked, toggleFavorite, t]);

  const handleRetrySync = useCallback(async () => {
    if (!dream) return;
    try {
      setIsRetryingSync(true);
      await retryDreamSync(dream.id);
    } catch (error) {
      if (__DEV__) {
        console.warn('[JournalDetail] Failed to retry sync', error);
      }
    } finally {
      setIsRetryingSync(false);
    }
  }, [dream, retryDreamSync]);

  const handleUseServerVersion = useCallback(async () => {
    if (!dream) return;
    await resolveDreamConflict(dream.id, 'use_server');
  }, [dream, resolveDreamConflict]);

  const handleKeepLocalVersion = useCallback(async () => {
    if (!dream) return;
    await resolveDreamConflict(dream.id, 'keep_local');
  }, [dream, resolveDreamConflict]);

  const deleteAndNavigate = useCallback(async () => {
    if (!dream) return;
    try {
      setIsDeleting(true);
      await deleteDream(dream.id);
      // One haptic, at the moment the dream is actually gone, in the same frame as the
      // sheet closing and the journal replacing this screen. Never the only feedback.
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setShowDeleteSheet(false);
      router.replace('/(tabs)/journal');
    } catch (error) {
      if (__DEV__) {
        console.error('Failed to delete dream', error);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      Alert.alert(t('common.error_title'), t('common.unknown_error'));
      setIsDeleting(false);
    }
  }, [deleteDream, dream, t]);

  const handleCloseDeleteSheet = useCallback(() => {
    if (isDeleting) return;
    setShowDeleteSheet(false);
  }, [isDeleting]);

  const onDelete = useCallback(() => {
    if (!dream || isAnalysisLocked) return;
    setShowDeleteSheet(true);
  }, [dream, isAnalysisLocked]);

  const handleConfirmDelete = useCallback(() => {
    if (!dream || isAnalysisLocked || isDeleting) return;
    void deleteAndNavigate();
  }, [deleteAndNavigate, dream, isAnalysisLocked, isDeleting]);

  const onRetryImage = useCallback(async () => {
    if (!dream) return;
    if (!illustrationAccess.allowed) {
      setImageErrorMessage(t('journal.detail.image.quota_exceeded_message'));
      return;
    }

    setIsRetryingImage(true);
    try {
      const sourceText = dream.transcript?.trim() || dream.interpretation?.trim();
      if (!sourceText) {
        throw new Error(t('journal.detail.image.no_source'));
      }

      await generateDreamImage(dream.id, {
        transcript: sourceText,
        previousImageUrl: dream.imageUrl || undefined,
        clientRequestId: illustrationAccess.bundledRequestId,
      });
    } catch (error) {
      if (error instanceof QuotaError) {
        setImageErrorMessage(t('journal.detail.image.quota_exceeded_message'));
        return;
      }
      const classified = classifyError(
        error instanceof Error ? error : new Error(t('common.unknown_error')),
        t
      );
      setImageErrorMessage(
        classified.userMessage === t('error.interpretation_limit')
          ? t('journal.detail.image.quota_exceeded_message')
          : classified.userMessage
      );
    } finally {
      setIsRetryingImage(false);
    }
  }, [dream, generateDreamImage, illustrationAccess.allowed, illustrationAccess.bundledRequestId, t]);

  const handleBackPress = useCallback(() => {
    router.replace('/(tabs)/journal');
  }, []);

  const handleJourneyPress = useCallback(() => {
    if (!dream) return;
    const href = buildReflectionResumeHref(dream.id, reflectionJourney.primary.resume);
    if (!href) {
      return;
    }
    router.push(href);
  }, [dream, reflectionJourney.primary.resume]);

  const showAnalysisNotice = useCallback(
    (title: string, message: string, tone: AnalysisNotice['tone'] = 'info') => {
      setAnalysisNotice({ title, message, tone });
    },
    []
  );

  const handleDismissAnalysisNotice = useCallback(() => {
    setAnalysisNotice(null);
  }, []);

  const handleDismissImageError = useCallback(() => {
    setImageErrorMessage(null);
  }, []);

  const handleRetryImageError = useCallback(() => {
    setImageErrorMessage(null);
    void onRetryImage();
  }, [onRetryImage]);

  const ensureAnalyzeAllowed = useCallback(async () => {
    try {
      const allowed = canAnalyzeNow || (await canAnalyze());
      if (!allowed) {
        // Don't show for paid users
        if (isPlus) return false;
        setQuotaSheetMode(!user && quotaStatus?.isUpgraded ? 'login' : 'quota');
        setShowQuotaLimitSheet(true);
        return false;
      }
      return true;
    } catch (error) {
      if (__DEV__) {
        console.error('[JournalDetail] Quota check failed:', error);
      }
      showAnalysisNotice(
        t('common.error_title'),
        t('journal.detail.quota_check_error'),
        'error'
      );
      return false;
    }
  }, [canAnalyze, canAnalyzeNow, isPlus, quotaStatus?.isUpgraded, showAnalysisNotice, t, user]);

  const handleQuotaLimitDismiss = useCallback(() => {
    setShowQuotaLimitSheet(false);
  }, []);

  const handleQuotaLimitPrimary = useCallback(() => {
    setShowQuotaLimitSheet(false);
    if (tier === 'guest') {
      if (quotaSheetMode === 'login') {
        router.push('/(tabs)/settings?section=account');
      } else {
        router.push('/(tabs)/settings');
      }
    } else {
      router.push(buildPaywallHref('analysis_cta'));
    }
  }, [quotaSheetMode, tier]);

  const handleQuotaLimitSecondary = useCallback(() => {
    setShowQuotaLimitSheet(false);
    router.push('/(tabs)/journal');
  }, []);

  const handleFirstValueBackup = useCallback(() => {
    router.push('/(tabs)/settings?section=account');
  }, []);

  const runAnalyze = useCallback(
    async (replaceImage: boolean, skipAllowanceCheck = false) => {
      if (!dream) return;

      if (!skipAllowanceCheck && !isResumableAnalysisRequest(dream)) {
        const allowed = await ensureAnalyzeAllowed();
        if (!allowed) return;
      }

      setShowReplaceImageSheet(false);
      setIsAnalyzing(true);
      try {
        await analyzeDream(dream.id, dream.transcript, {
          replaceExistingImage: replaceImage,
          lang: language,
          analyticsSource: 'journal_detail',
        });
        setAnalysisNotice(null);
      } catch (error) {
        if (error instanceof QuotaError) {
          if (error.code === QuotaErrorCode.LOGIN_REQUIRED && tier === 'guest') {
            setQuotaSheetMode('login');
            setShowQuotaLimitSheet(true);
            return;
          }
          // Show quota limit sheet with upgrade CTA for non-paid users
          if (!isPlus) {
            setQuotaSheetMode('quota');
            setShowQuotaLimitSheet(true);
          } else {
            // Plus users should never hit quota errors, but show a notice if they do.
            showAnalysisNotice(
              t('common.error_title'),
              error.userMessage || t('common.unknown_error'),
              'error'
            );
          }
        } else {
          const classified = classifyError(error as Error, t);
          showAnalysisNotice(t('analysis_error.title'), classified.userMessage, 'error');
        }
      } finally {
        setIsAnalyzing(false);
      }
    },
    [analyzeDream, dream, ensureAnalyzeAllowed, isPlus, language, showAnalysisNotice, t, tier]
  );

  const handleAnalyze = useCallback(async () => {
    if (!dream) return;

    if (!isResumableAnalysisRequest(dream)) {
      const allowed = await ensureAnalyzeAllowed();
      if (!allowed) return;
    }

    if (hasExistingImage) {
      setShowReplaceImageSheet(true);
      return;
    }

    void runAnalyze(shouldReplaceExistingImage('first'), true);
  }, [dream, ensureAnalyzeAllowed, hasExistingImage, runAnalyze]);

  const handleReplaceImage = useCallback(() => {
    void runAnalyze(shouldReplaceExistingImage('replace'));
  }, [runAnalyze]);

  const handleKeepImage = useCallback(() => {
    void runAnalyze(shouldReplaceExistingImage('keep'));
  }, [runAnalyze]);

  const handleDismissReanalyzeSheet = useCallback(() => {
    setShowReanalyzeSheet(false);
    setReanalyzeImagePolicy('keep');
  }, []);

  const handleReanalyzeImagePolicyChange = useCallback((next: 'keep' | 'regenerate') => {
    setReanalyzeImagePolicy(next);
  }, []);

  const handleConfirmReanalyze = useCallback(() => {
    setShowReanalyzeSheet(false);
    void runAnalyze(
      shouldReplaceExistingImage(reanalyzeImagePolicy === 'regenerate' ? 'regenerate' : 'keep')
    );
  }, [reanalyzeImagePolicy, runAnalyze]);

  const handleTranscriptSave = useCallback(async () => {
    if (!dream) return;
    const normalizedTranscript = editableTranscript.trim().length === 0
      ? dream.transcript
      : editableTranscript;

    const updatedDream: DreamAnalysis = {
      ...dream,
      transcript: normalizedTranscript,
    };
    await updateDream(updatedDream);
    setIsEditingTranscript(false);
  }, [dream, editableTranscript, updateDream]);

  const handleStaleReanalyze = useCallback(() => {
    if (isAnalysisLocked) return;
    setReanalyzeImagePolicy('keep');
    setShowReanalyzeSheet(true);
  }, [isAnalysisLocked]);

  const handleDismissReplaceSheet = useCallback(() => {
    setShowReplaceImageSheet(false);
  }, []);

  const gradientColors = ([noctalia.screen.gradient[0], noctalia.screen.gradient[1], noctalia.screen.background] as const);
  const gradientLocations = mode === 'dark' ? ([0, 0.7, 1] as const) : undefined;
  const displayedAnalysisNotice = analysisNotice ?? lastAnalysisNoticeRef.current;

  const keyboardBehavior: 'padding' | 'height' | undefined = Platform.select({
    ios: 'padding',
    android: 'height',
    default: undefined,
  });
  const keyboardVerticalOffset = Platform.select({ ios: 0, android: 0, web: 0 }) ?? 0;
  const shouldHideHeroMedia = isKeyboardVisible && (isEditing || isEditingTranscript);
  const floatingTranscriptBottom = Platform.OS === 'ios' ? 32 : 24;

  if (!dream) {
    return (
      <ScrollPerfProvider isScrolling={scrollPerf.isScrolling}>
        <View className="relative flex-1 overflow-hidden bg-ink">
          <LinearGradient
            colors={gradientColors}
            locations={gradientLocations}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <AtmosphericBackground />
          <KeyboardAvoidingView
            className="flex-1"
            behavior={keyboardBehavior}
            keyboardVerticalOffset={keyboardVerticalOffset}
          >
            <View className="flex-1 items-center justify-center p-5">
              <Text className="text-[18px] text-ivory">
                {t('journal.detail.not_found.title')}
              </Text>
              <PressableScale
                onPress={handleBackPress}
                className="mt-4 rounded-sm bg-champagne px-6 py-3"
              >
                <Text className="font-sans-bold text-[16px] text-on-champagne">
                  {t('journal.detail.not_found.back')}
                </Text>
              </PressableScale>
            </View>
            {savedConfirmationVisible ? (
              <Toast
                message={t('recording.save.confirmation')}
                mode="success"
                onHide={() => setSavedConfirmationVisible(false)}
                testID={TID.Text.RecordingSaveConfirmation}
              />
            ) : null}
          </KeyboardAvoidingView>
        </View>
      </ScrollPerfProvider>
    );
  }

  const renderTranscriptBody = () => (
    <View
      testID={TID.Component.TranscriptCard}
      className={`font-sans text-[15px] leading-6 opacity-90 ${
        isEditingTranscript ? 'border-2 border-champagne' : 'border-0 border-transparent'
      }`}
    >
      <View className="mb-3 flex-row items-center justify-between">
        <View className="flex-1 pr-3">
          {renderDetailZoneHeader(t('journal.detail.zone.dream'), TID.Text.DreamDetailDreamZone)}
          <Text className="font-sans-bold text-[18px] text-ivory">
            {t('journal.original_transcript')}
          </Text>
        </View>
        <PressableScale
          onPress={isEditingTranscript ? handleTranscriptSave : () => {
            setEditableTranscript(dream.transcript || '');
            setIsEditingTranscript(true);
          }}
          testID={TID.Button.EditTranscript}
          accessibilityLabel={t('journalDetail.a11y.editTranscript')}
          disabled={isAnalysisLocked}
          className={`h-8 w-8 items-center justify-center rounded-full border border-line ${
            isEditingTranscript ? 'bg-champagne' : 'bg-transparent'
          } ${isAnalysisLocked ? 'opacity-70' : ''}`}
          hitSlop={8}
        >
          <IconSymbol
            name={isEditingTranscript ? 'checkmark' : 'pencil'}
            size={18}
            color={isEditingTranscript ? noctalia.action.primaryText : noctalia.text.secondary}
          />
        </PressableScale>
      </View>
      {isEditingTranscript ? (
        <TextInput
          testID={TID.Input.DreamTranscript}
          className="min-h-[140px] rounded-md border border-line bg-ink-active p-3 font-sans text-[15px] leading-[22px] text-ivory"
          multiline
          value={editableTranscript}
          onChangeText={setEditableTranscript}
          placeholder={t('journal.transcript.placeholder') || 'Edit transcript...'}
          accessibilityLabel={t('journal.transcript.placeholder') || 'Edit transcript...'}
          placeholderTextColor={noctalia.text.secondary}
          textAlignVertical="top"
          autoFocus
        />
      ) : (
        <Text className="font-sans text-[15px] leading-6 text-ivory-muted opacity-90">{dream.transcript}</Text>
      )}
    </View>
  );

  const renderMetadataCard = (variant: 'inline' | 'floating' = 'inline') => {
    // The main content card and its inner accent cards share one surface colour so the
    // padding around them doesn't read as a darker band on Android.
    const borderClassName = isEditing
      ? 'border-2 border-champagne'
      : variant === 'floating'
        ? 'border border-line'
        : 'border-0 border-line-strong';

    return (
      <View
        testID={TID.Component.MetadataCard}
        style={variant === 'floating' ? shadows.xl : shadows.md}
        className={[
          'mb-6 rounded-t-xl rounded-b-lg px-5 pt-5 bg-ink-raised',
          borderClassName,
          // Keep room for the floating edit/check button so it doesn't overlap chips
          isEditing ? 'pb-16' : 'pb-5',
          variant === 'floating' ? 'rounded-[20px]' : '',
        ].join(' ')}
      >
      <View className="mb-3 flex-row items-center justify-between">
        <View className="flex-1 flex-row items-center gap-1.5">
          <IconSymbol name="calendar" size={16} color={noctalia.text.primary} />
          <Text className="font-sans-bold text-[14px] text-ivory">{formatDreamDate(dream.id)}</Text>
        </View>
        <View className="flex-row items-center gap-1.5">
          <IconSymbol name="clock" size={16} color={noctalia.text.primary} />
          <Text className="font-sans-bold text-[14px] text-ivory">{formatDreamTime(dream.id)}</Text>
        </View>
      </View>
      <View className="my-3 h-px bg-line" />

      {isEditing ? (
        <TextInput
          testID={TID.Input.DreamTitle}
          nativeID={TID.Input.DreamTitle}
          className="mb-3 border-b border-line pb-1 font-serif-bold text-[24px] leading-8 text-ivory"
          selectTextOnFocus
          value={editableTitle}
          onChangeText={setEditableTitle}
          placeholder={t('journal.detail.title_placeholder')}
          accessibilityLabel={t('journal.detail.title_placeholder')}
          placeholderTextColor={noctalia.text.secondary}
        />
      ) : (
        <Text className="mb-3 font-display-semibold text-[26px] leading-[34px] text-ivory">
          {dream.title || t('journal.detail.untitled_dream')}
        </Text>
      )}

      {(isEditing || dream.dreamType) && (
        <View className={`mt-2 flex-row gap-2 ${isEditing ? 'items-start' : 'items-center'}`}
        >
          <IconSymbol name="moon.stars.fill" size={18} color={noctalia.text.primary} style={{ marginTop: isEditing ? 4 : 0 }} />
          <Text className={`font-sans-medium text-[14px] text-ivory opacity-70 ${isEditing ? 'mt-1' : ''}`}>{t('journal.detail.dream_type_label')}</Text>
          {isEditing ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="grow-0">
              <View className="flex-row gap-2 py-0.5">
                {sortedDreamTypes.map((type) => {
                  const label = getDreamTypeLabel(type as DreamType, t) ?? type;
                  const selected = editableDreamType === type;
                  return (
                    <Pressable
                      key={type}
                      testID={`chip.type.${type}`}
                      onPress={() => setEditableDreamType(type)}
                      className={`rounded-[20px] border px-3 py-1.5 ${
                        selected ? 'border-champagne-soft bg-champagne' : 'border-line'
                      }`}
                    >
                      <Text
                        className={`text-[12px] capitalize ${
                          selected ? 'font-sans-bold text-on-champagne' : 'font-sans-medium text-ivory'
                        }`}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          ) : (
            <Text className="flex-1 font-sans-bold text-[14px] capitalize text-ivory">
              {dreamTypeLabel || dream.dreamType}
            </Text>
          )}
        </View>
      )}

      <View className={`mt-2 flex-row gap-2 ${isEditing ? 'items-start' : 'items-center'}`}>
        <IconSymbol name="paintpalette" size={18} color={noctalia.text.primary} style={{ marginTop: isEditing ? 4 : 0 }} />
        <Text className={`font-sans-medium text-[14px] text-ivory opacity-70 ${isEditing ? 'mt-1' : ''}`}>{t('journal.detail.theme_label')}</Text>
        {isEditing ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="grow-0">
            <View className="flex-row gap-2 py-0.5">
              {sortedDreamThemes.map((theme) => {
                const label = getDreamThemeLabel(theme as DreamTheme, t) ?? theme;
                const selected = editableTheme === theme;
                return (
                  <Pressable
                    key={theme}
                    testID={`chip.theme.${theme}`}
                    onPress={() => setEditableTheme(theme)}
                    className={`rounded-[20px] border px-3 py-1.5 ${
                      selected ? 'border-champagne-soft bg-champagne' : 'border-line'
                    }`}
                  >
                    <Text
                      className={`text-[12px] capitalize ${
                        selected ? 'font-sans-bold text-on-champagne' : 'font-sans-medium text-ivory'
                      }`}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        ) : (
          <Text className="flex-1 font-sans-bold text-[14px] capitalize text-ivory">
            {dreamThemeLabel || t('journal.detail.theme_placeholder')}
          </Text>
        )}
      </View>

      {!isEditing && dreamMemoryItems.length > 0 && (
        <View className="mt-3.5 gap-2 border-t border-t-line pt-3">
          <View className="flex-row items-center gap-2">
            <IconSymbol name="moon.stars.fill" size={16} color={noctalia.accent.text} />
            <Text className="font-sans-bold text-[12px] uppercase text-champagne-on">
              {t('journal.detail.zone.memory')}
            </Text>
          </View>
          {dreamMemoryItems.map((item) => (
            <View key={item.key} className="gap-0.5">
              <Text className="font-sans-medium text-[12px] leading-4 text-ivory-muted">
                {item.label}
              </Text>
              <Text className="font-sans-bold text-[14px] leading-[18px] text-ivory">
                {item.value}
              </Text>
            </View>
          ))}
        </View>
      )}

      <PressableScale
        onPress={isEditing ? handleSave : startMetadataEditing}
        testID={TID.Button.EditMetadata}
        nativeID={TID.Button.EditMetadata}
        accessibilityLabel={
          isEditing
            ? t('journal.detail.edit_metadata.save_accessibility')
            : t('journal.detail.edit_metadata.edit_accessibility')
        }
        accessibilityRole="button"
        accessibilityHint={
          isAnalysisLocked
            ? t('journal.detail.edit_metadata.locked_hint')
            : isEditing
              ? t('journal.detail.edit_metadata.save_hint')
              : t('journal.detail.edit_metadata.edit_hint')
        }
        accessibilityState={{ disabled: isAnalysisLocked }}
        accessible
        disabled={isAnalysisLocked}
        className={`absolute bottom-4 right-4 h-8 w-8 items-center justify-center rounded-full ${
          isEditing ? 'bg-champagne' : 'bg-ink-active'
        } ${isAnalysisLocked ? 'opacity-70' : ''}`}
        hitSlop={8}
      >
        <IconSymbol
          name={isEditing ? 'checkmark' : 'pencil'}
          size={16}
          color={isEditing ? noctalia.action.primaryText : noctalia.text.secondary}
        />
      </PressableScale>
    </View>
  );
  };

  const renderSyncStatusCard = () => {
    if (!dream || dreamSyncState === 'clean') {
      return null;
    }

    const title = isSyncConflict
      ? t('journal.detail.sync.conflict_title')
      : isSyncFailed
        ? t('journal.detail.sync.failed_title')
        : t('journal.detail.sync.pending_title');
    const message = isSyncConflict
      ? (dream.lastSyncError && !isTechnicalRevisionConflict(dream.lastSyncError)
          ? dream.lastSyncError
          : t('journal.detail.sync.conflict_message'))
      : isSyncFailed
        ? (dream.lastSyncError || t('journal.detail.sync.failed_message'))
        : t('journal.detail.sync.pending_message');
    // Icon colours go to a prop, not a style, so they stay on the TS tokens.
    const toneIconColor = isSyncConflict
      ? noctalia.status.danger.icon
      : isSyncFailed
        ? noctalia.status.warning.icon
        : noctalia.accent.text;
    const cardToneClassName = isSyncConflict
      ? 'bg-danger border-danger-line'
      : isSyncFailed
        ? 'bg-warning border-warning-line'
        : 'bg-ink-active border-line';
    const titleToneClassName = isSyncConflict
      ? 'text-danger-on'
      : isSyncFailed
        ? 'text-warning-on'
        : 'text-ivory';
    const messageToneClassName = isSyncConflict
      ? 'text-danger-on'
      : isSyncFailed
        ? 'text-warning-on'
        : 'text-ivory-muted';
    const iconName = isSyncConflict
      ? 'exclamationmark.octagon.fill'
      : isSyncFailed
        ? 'exclamationmark.triangle.fill'
        : 'arrow.triangle.2.circlepath';

    return (
      <View className={`mb-4 rounded-lg border p-6 ${cardToneClassName}`}>
        <View className="mb-3 flex-row items-center gap-3">
          <IconSymbol name={iconName} size={24} color={toneIconColor} />
          <Text className={`flex-1 font-serif-bold text-[22px] ${titleToneClassName}`}>{title}</Text>
        </View>
        <Text className={`mb-5 font-sans text-[15px] leading-[22px] ${messageToneClassName}`}>{message}</Text>
        {isSyncPending ? (
          <ActivityIndicator size="small" color={noctalia.accent.text} />
        ) : null}
        {isSyncPending || isSyncFailed ? (
          <PressableScale
            className="mb-4 flex-row items-center justify-center gap-2.5 rounded-md bg-champagne p-4"
            onPress={handleRetrySync}
            disabled={isRetryingSync}
            accessibilityState={{ disabled: isRetryingSync }}
          >
            {isRetryingSync ? (
              <ActivityIndicator size="small" color={noctalia.action.primaryText} />
            ) : (
              <IconSymbol name="arrow.clockwise" size={18} color={noctalia.action.primaryText} />
            )}
            <Text className="font-sans-bold text-[16px] text-on-champagne">
              {t('journal.detail.sync.retry')}
            </Text>
          </PressableScale>
        ) : null}
        {isSyncConflict ? (
          <View className="mt-2 flex-row gap-3">
            <PressableScale
              className="flex-1 items-center justify-center rounded-[14px] bg-danger-icon py-3.5"
              onPress={handleKeepLocalVersion}
            >
              <Text className="font-sans-bold text-[15px] text-on-champagne">
                {t('journal.detail.sync.keep_local')}
              </Text>
            </PressableScale>
            <PressableScale
              className="flex-1 items-center justify-center rounded-[14px] border border-danger-line py-3.5"
              onPress={handleUseServerVersion}
            >
              <Text className="font-sans-bold text-[15px] text-danger-on">
                {t('journal.detail.sync.use_server')}
              </Text>
            </PressableScale>
          </View>
        ) : null}
      </View>
    );
  };

  const renderQuotaHint = () => {
    if (!quotaHintLabel) {
      return null;
    }
    return (
      <Text
        className="font-sans text-[12px] leading-[16px] text-ivory-muted"
        testID={TID.Text.DreamDetailQuotaHint}
        accessibilityLiveRegion="polite"
      >
        {quotaHintLabel}
      </Text>
    );
  };

  const renderDetailActionCard = (
    visibleFamilies?: ('analyze' | 'explore' | 'continue')[]
  ) => {
    if (!detailActionCard || isEditing || isEditingTranscript) {
      return null;
    }
    if (visibleFamilies && !visibleFamilies.includes(visiblePrimaryAction)) {
      return null;
    }

    const disabled = detailActionCard.disabled || isPrimaryActionBusy || isAnalysisLocked;
    const onPress = isStalePrimaryAction
      ? handleStaleReanalyze
      : visiblePrimaryAction === 'analyze'
        ? handleAnalyze
        : handleJourneyPress;
    const isCompactExplorationAction =
      !isStalePrimaryAction &&
      (visiblePrimaryAction === 'continue' || visiblePrimaryAction === 'explore');
    const primaryButtonTestID = isStalePrimaryAction
      ? TID.Button.AnalysisStaleCta
      : TID.Button.DreamDetailPrimaryCta;

    if (isCompactExplorationAction) {
      return (
        <PressableScale
          testID={TID.Component.DreamDetailActionCard}
          onPress={onPress}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityState={{ disabled }}
          accessibilityHint={quotaHintLabel ?? undefined}
          className={`mb-[18px] min-h-[58px] flex-row items-center gap-3 rounded-lg border border-line-strong bg-ink-active px-4 py-3 ${
            disabled ? 'opacity-75' : ''
          }`}
        >
          <View className="h-[34px] w-[34px] items-center justify-center rounded-full bg-champagne">
            <IconSymbol name={detailActionCard.icon} size={18} color={noctalia.action.primaryText} />
          </View>
          <View className="flex-1 gap-1">
            <Text
              className="font-sans-bold text-[16px] text-ivory"
              testID={TID.Text.DreamDetailActionTitle}
            >
              {detailActionCard.cta}
            </Text>
            {renderQuotaHint()}
          </View>
          {isPrimaryActionBusy ? (
            <ActivityIndicator size="small" color={noctalia.text.primary} />
          ) : (
            <IconSymbol name="arrow.right" size={18} color={noctalia.text.primary} />
          )}
        </PressableScale>
      );
    }

    return (
      <View
        testID={TID.Component.DreamDetailActionCard}
        className="mb-[18px] gap-3.5 rounded-lg border border-line-strong bg-ink-active p-4"
      >
        <View className="flex-row items-start gap-3">
          <View className="h-[34px] w-[34px] items-center justify-center rounded-full bg-champagne">
            <IconSymbol name={detailActionCard.icon} size={18} color={noctalia.action.primaryText} />
          </View>
          <View className="flex-1 gap-1">
            <Text
              className="font-sans-bold text-[11px] uppercase text-champagne-on"
              testID={TID.Text.DreamDetailActionStep}
            >
              {detailActionCard.step}
            </Text>
            <Text
              className="font-display-medium text-[17px] leading-[23px] text-ivory"
              testID={TID.Text.DreamDetailActionTitle}
            >
              {detailActionCard.title}
            </Text>
            <Text
              className="font-sans text-[13px] leading-[18px] text-ivory-muted"
              testID={TID.Text.DreamDetailActionMessage}
            >
              {detailActionCard.message}
            </Text>
            {renderQuotaHint()}
          </View>
        </View>
        <PressableScale
          testID={primaryButtonTestID}
          onPress={onPress}
          disabled={disabled}
          className={`flex-row items-center justify-center gap-2 rounded-md bg-champagne px-4 py-[13px] ${
            disabled ? 'opacity-75' : ''
          }`}
          accessibilityRole="button"
          accessibilityState={{ disabled }}
          accessibilityHint={quotaHintLabel ?? undefined}
        >
          {isPrimaryActionBusy ? (
            <ActivityIndicator size="small" color={noctalia.action.primaryText} />
          ) : (
            <IconSymbol
              name={visiblePrimaryAction === 'analyze' ? (isStalePrimaryAction ? 'arrow.clockwise' : 'sparkles') : 'arrow.right'}
              size={18}
              color={noctalia.action.primaryText}
            />
          )}
          <Text className="font-sans-bold text-[15px] text-on-champagne">
            {detailActionCard.cta}
          </Text>
        </PressableScale>
      </View>
    );
  };

  const renderFirstValueBackupCard = () => {
    if (user || !analysisState.isAnalyzed || isEditing || isEditingTranscript) {
      return null;
    }

    return (
      <View
        testID={TID.Component.FirstValueBackupCard}
        className="mb-5 gap-2.5 rounded-lg border border-line-strong bg-ink-soft p-4"
      >
        <View className="flex-row items-center gap-2">
          <IconSymbol name="lock.shield" size={20} color={noctalia.accent.text} />
          <Text
            className="flex-1 font-display-medium text-[16px] leading-[22px] text-ivory"
            testID={TID.Text.FirstValueBackupTitle}
          >
            {t('journal.detail.backup_prompt.title')}
          </Text>
        </View>
        <Text className="font-sans text-[13px] leading-[18px] text-ivory-muted">
          {t('journal.detail.backup_prompt.message')}
        </Text>
        <PressableScale
          testID={TID.Button.FirstValueBackupCta}
          onPress={handleFirstValueBackup}
          className="flex-row items-center gap-1.5 self-start rounded-full border border-line px-3.5 py-[9px]"
          accessibilityRole="button"
        >
          <Text className="font-sans-bold text-[13px] text-ivory">
            {t('journal.detail.backup_prompt.cta')}
          </Text>
          <IconSymbol name="arrow.right" size={16} color={noctalia.text.primary} />
        </PressableScale>
      </View>
    );
  };

  const renderDetailZoneHeader = (label: string, testID?: string) => (
    <View className="mb-3 flex-row items-center gap-2.5">
      <Text
        className="font-sans-bold text-[12px] uppercase text-champagne-on"
        testID={testID}
      >
        {label}
      </Text>
      <View className="flex-1 bg-champagne opacity-45" style={{ height: StyleSheet.hairlineWidth }} />
    </View>
  );

  const renderStaleBanner = () => {
    if (!isAnalysisStale || isEditing || isEditingTranscript) {
      return null;
    }

    return (
      <View
        testID={TID.Component.AnalysisStaleBanner}
        className="mb-[18px] gap-3 rounded-lg border border-warning-line bg-warning p-4"
      >
        <View className="flex-row items-start gap-3">
          <IconSymbol name="exclamationmark.triangle.fill" size={20} color={noctalia.status.warning.icon} />
          <View className="flex-1 gap-1">
            <Text className="font-sans-bold text-[11px] uppercase text-warning-on">
              {t('journal.detail.stale.label')}
            </Text>
            <Text
              className="font-sans text-[13px] leading-[18px] text-warning-on"
              testID={TID.Text.AnalysisStaleBanner}
            >
              {t('journal.detail.stale.banner')}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const shouldShowIllustrationSection =
    Boolean(dream.imageUrl?.trim()) ||
    illustrationSidecar === 'pending' ||
    illustrationSidecar === 'failed' ||
    (analysisState.isAnalyzed && visibleIllustrationCta !== 'none');

  const renderIllustrationSection = () => {
    if (shouldHideHeroMedia || !shouldShowIllustrationSection) {
      return null;
    }

    return (
      <View testID={TID.Component.JournalIllustration} className="mb-5 overflow-hidden rounded-lg">
        {dream.imageUrl ? (
          <PressableScale
            testID={TID.Button.JournalIllustrationExpand}
            onPress={() => setIsIllustrationFullscreen(true)}
            accessibilityRole="button"
            accessibilityLabel={t('journal.detail.image.expand_accessibility')}
            className="overflow-hidden rounded-lg bg-ink-soft"
            style={{ height: 220 }}
          >
            <Image
              key={displayImageUrl ?? dream.imageUrl}
              source={{ uri: displayImageUrl ?? dream.imageUrl, cacheKey: imageCacheKey }}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
              transition={imageConfig.transition}
              cachePolicy={imageConfig.cachePolicy}
              priority={imageConfig.priority}
              placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
            />
          </PressableScale>
        ) : illustrationSidecar === 'failed' ? (
          visibleIllustrationCta === 'retry' ? (
            <ImageRetry onRetry={onRetryImage} isRetrying={isRetryingImage} />
          ) : (
            <View className="min-h-[180px] flex-col items-center justify-center gap-2.5 rounded-lg border border-line bg-ink-soft px-5 py-6">
              <IconSymbol name="photo" size={40} color={noctalia.text.secondary} />
              <Text className="text-center font-sans-bold text-[16px] text-ivory">
                {t('journal.detail.image.generation_failed')}
              </Text>
              <Text className="px-2 text-center font-sans text-[13px] leading-5 text-ivory-muted">
                {t('journal.detail.image.quota_exceeded_message')}
              </Text>
              {canOfferImageUpgrade ? (
                <PressableScale
                  onPress={handleImageUpgrade}
                  accessibilityRole="button"
                  testID={TID.Button.ImageUpgrade}
                  className="min-w-[150px] flex-row items-center justify-center gap-2 rounded-md bg-champagne px-4 py-3"
                  style={shadows.md}
                >
                  <IconSymbol name="sparkles" size={18} color={noctalia.action.primaryText} />
                  <Text className="font-sans-bold text-[15px] text-on-champagne">
                    {t('journal.detail.image.upgrade_action')}
                  </Text>
                </PressableScale>
              ) : null}
            </View>
          )
        ) : illustrationSidecar === 'pending' ? (
          <View className="min-h-[180px] flex-col items-center justify-center gap-3 rounded-lg border border-line-strong bg-ink-active px-6 py-6">
            <ActivityIndicator size="large" color={noctalia.accent.soft} />
            <Text className="text-center font-sans-bold text-[16px] text-ivory">
              {t('journal.detail.image.generating_title')}
            </Text>
            <Text className="px-2 text-center font-sans text-[13px] leading-5 text-ivory-muted">
              {dream.imageJobStatus === 'queued'
                ? t('journal.detail.image.queued_subtitle')
                : t('journal.detail.image.running_subtitle')}
            </Text>
          </View>
        ) : (
          <View className="min-h-[180px] flex-col items-center justify-center gap-2.5 rounded-lg border border-line bg-ink-soft px-5 py-6">
            <IconSymbol name="photo" size={28} color={noctalia.text.secondary} />
            <Text className="text-center font-sans-bold text-[16px] text-ivory">
              {t('journal.detail.image.no_image_title')}
            </Text>
            <Text className="px-2 text-center font-sans text-[13px] leading-5 text-ivory-muted">
              {visibleIllustrationCta === 'quota'
                ? t('journal.detail.image.quota_exceeded_message')
                : t('journal.detail.image.no_image_subtitle')}
            </Text>
            {!isRetryingImage && !isImageJobPending && (
              <View className="w-full items-center gap-3">
                {visibleIllustrationCta === 'upgrade' && (
                  <PressableScale
                    onPress={handleImageUpgrade}
                    accessibilityRole="button"
                    testID={TID.Button.ImageUpgrade}
                    className="min-w-[150px] flex-row items-center justify-center gap-2 rounded-md bg-champagne px-4 py-3"
                    style={shadows.md}
                  >
                    <IconSymbol name="sparkles" size={18} color={noctalia.action.primaryText} />
                    <Text className="font-sans-bold text-[15px] text-on-champagne">
                      {t('journal.detail.image.upgrade_action')}
                    </Text>
                  </PressableScale>
                )}
                {visibleIllustrationCta === 'illustrate' && (
                  <PressableScale
                    onPress={onRetryImage}
                    disabled={isRetryingImage || isImageJobPending}
                    testID={TID.Button.JournalIllustrate}
                    accessibilityRole="button"
                    className={`min-w-[150px] flex-row items-center justify-center gap-2 rounded-md bg-champagne px-4 py-3 ${
                      isRetryingImage ? 'opacity-70' : ''
                    }`}
                    style={shadows.md}
                  >
                    <IconSymbol name="sparkles" size={18} color={noctalia.action.primaryText} />
                    <Text className="font-sans-bold text-[15px] text-on-champagne">
                      {t('journal.detail.image.generate_action')}
                    </Text>
                  </PressableScale>
                )}
                <PressableScale
                  onPress={handlePickImage}
                  disabled={isPickingImage || isAnalysisLocked}
                  className={`min-w-[150px] flex-row items-center justify-center gap-2 rounded-md border border-line bg-transparent px-4 py-3 ${
                    (isPickingImage || isAnalysisLocked) ? 'opacity-70' : ''
                  }`}
                >
                  {isPickingImage ? (
                    <ActivityIndicator color={noctalia.text.primary} />
                  ) : (
                    <IconSymbol name="photo" size={18} color={noctalia.text.primary} />
                  )}
                  <Text className="font-sans-bold text-[15px] text-ivory">
                    {isPickingImage
                      ? t('journal.detail.image.adding_from_library')
                      : t('journal.detail.image.add_from_library')}
                  </Text>
                </PressableScale>
              </View>
            )}
          </View>
        )}
        {isRetryingImage && (
          <View className="absolute inset-0 items-center justify-center rounded-lg bg-ink-overlay">
            <ActivityIndicator color={noctalia.text.primary} />
          </View>
        )}
      </View>
    );
  };

  return (
    <ScrollPerfProvider isScrolling={scrollPerf.isScrolling}>
      <View className="relative flex-1 overflow-hidden bg-ink">
        <LinearGradient
          colors={gradientColors}
          locations={gradientLocations}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <AtmosphericBackground />
        <KeyboardAvoidingView
          className="flex-1"
          behavior={keyboardBehavior}
          keyboardVerticalOffset={keyboardVerticalOffset}
        >
        <PressableScale
          onPress={handleBackPress}
          className="absolute left-5 z-50 h-11 w-11 items-center justify-center rounded-[22px] border border-line bg-ink-raised"
          style={[shadows.lg, { top: insets.top + 12 }]}
          testID={TID.Button.NavigateJournal}
          accessibilityRole="button"
          accessibilityLabel={t('journal.back_button')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <IconSymbol name="chevron.left" size={22} color={noctalia.text.primary} />
        </PressableScale>
        <ScrollView
          ref={scrollViewRef}
          className="flex-1"
          style={{ marginTop: insets.top }}
          contentContainerStyle={{
            paddingTop: 64,
            paddingBottom:
              ((isEditing || isEditingTranscript) ? 220 : 100) + insets.bottom,
          }}
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={16}
          onScrollBeginDrag={scrollPerf.onScrollBeginDrag}
          onScrollEndDrag={scrollPerf.onScrollEndDrag}
          onMomentumScrollBegin={scrollPerf.onMomentumScrollBegin}
          onMomentumScrollEnd={scrollPerf.onMomentumScrollEnd}
        >
          <View className="px-4 pb-6">
            {/* The sections enter once, staggered, as the dream loads in. The `Reveal`
                wrappers sit OUTSIDE the conditionals on purpose: they mount with the
                screen and stay mounted, so toggling edit mode never replays the
                entrance. `staggerDelay` caps at 6 steps, so the last one starts at
                300 ms and this never reads as a loading sequence. */}
            <Reveal index={0}>
              {/* Plus metadata card */}
              {!isEditing && renderMetadataCard()}
            </Reveal>
            <Reveal index={1}>{renderSyncStatusCard()}</Reveal>

            {!isEditingTranscript && (
              <View
                className="mt-2 mb-5"
                onLayout={(event) => setTranscriptSectionOffset(event.nativeEvent.layout.y)}
              >
                <Reveal index={2}>
                  <View className="rounded-md border-t border-t-line bg-ink-soft px-4 pt-6 pb-4 dark:bg-ink-card">
                    {renderTranscriptBody()}
                  </View>
                </Reveal>
              </View>
            )}

            <Reveal index={3}>
              {renderStaleBanner()}
              {renderDetailActionCard(['analyze'])}
              <DreamRecallAssistantCard
                dreamId={String(dream.id)}
                originalTranscript={dream.transcript}
                originalPersistedSegmentId={dream.clientRequestId ?? String(dream.id)}
                offerEligible={recallOffer.offerEligible}
              />
            </Reveal>

            <Reveal index={4}>
              {(showCompletedReading || isAnalysisPending) ? (
                <View testID={TID.Component.DreamDetailReadingZone}>
                  {renderDetailZoneHeader(t('journal.detail.zone.reading'), TID.Text.DreamDetailReadingZone)}
                  {isAnalysisPending ? (
                    <Skeleton className="h-[60px] w-full rounded-sm" />
                  ) : dream.shareableQuote ? (
                    <FlatGlassCard style={{ padding: 20, marginVertical: 16, position: 'relative' }} animationDelay={450}>
                      <IconSymbol name="quote.opening" size={28} color={noctalia.accent.text} style={{ position: 'absolute', top: 12, left: 12, opacity: 0.25 }} />
                      <Text className="pl-2 text-[20px] leading-[30px] text-ivory" style={{ fontFamily: Fonts.lora.boldItalic }}>
                        &quot;{dream.shareableQuote}&quot;
                      </Text>
                    </FlatGlassCard>
                  ) : null}

                  {isAnalysisPending ? (
                    <View className="mb-4 gap-2">
                      <Skeleton className="h-4 w-full rounded-[4px]" />
                      <Skeleton className="h-4 w-[90%] rounded-[4px]" />
                      <Skeleton className="h-4 w-[95%] rounded-[4px]" />
                    </View>
                  ) : dream.interpretation ? (
                    <>
                      <View className="mt-2 mb-3 items-center">
                        <Text className="font-display-medium text-[13px] uppercase text-champagne-on">
                          {t('journal.detail.interpretation_header')}
                        </Text>
                        <View className="mt-2 h-[2.5px] w-9 self-center rounded-[1.5px] bg-champagne opacity-85" />
                      </View>
                      <TypewriterText
                        text={dream.interpretation}
                        className="mb-4 font-sans text-body text-ivory-muted"
                        shouldAnimate={false}
                      />
                    </>
                  ) : null}
                </View>
              ) : null}
            </Reveal>

            <Reveal index={5}>{renderIllustrationSection()}</Reveal>

            <Reveal index={6}>
              {!isAnalysisPending && showCompletedReading && dream.symbols && dream.symbols.length > 0 ? (
                <>
                  <View className="mt-2 mb-3 items-center">
                    <Text className="font-display-medium text-[13px] uppercase text-champagne-on">
                      {t('journal.detail.symbols_header')}
                    </Text>
                    <View className="mt-2 h-[2.5px] w-9 self-center rounded-[1.5px] bg-champagne opacity-85" />
                  </View>
                  {dream.symbols.map((symbol, index) => (
                    <View key={`symbol-${index}`} className="mb-3">
                      <Text className="mb-0.5 font-sans-bold text-[15px] leading-[22px] text-ivory">
                        {symbol.name}
                      </Text>
                      <Text className="font-sans text-[15px] leading-[22px] text-ivory-muted">
                        {symbol.meaning}
                      </Text>
                    </View>
                  ))}
                </>
              ) : null}

              {!isAnalysisPending && showCompletedReading && dream.emotions && dream.emotions.length > 0 ? (
                <>
                  <View className="mt-2 mb-3 items-center">
                    <Text className="font-display-medium text-[13px] uppercase text-champagne-on">
                      {t('journal.detail.emotions_header')}
                    </Text>
                    <View className="mt-2 h-[2.5px] w-9 self-center rounded-[1.5px] bg-champagne opacity-85" />
                  </View>
                  {dream.emotions.map((emotion, index) => (
                    <View key={`emotion-${index}`} className="mb-3">
                      <Text className="mb-0.5 font-sans-bold text-[15px] leading-[22px] text-ivory">
                        {emotion.name}
                      </Text>
                      <Text className="font-sans text-[15px] leading-[22px] text-ivory-muted">
                        {emotion.insight}
                      </Text>
                    </View>
                  ))}
                </>
              ) : null}

              {(showCompletedReading || (!isStalePrimaryAction && (visiblePrimaryAction === 'explore' || visiblePrimaryAction === 'continue'))) ? (
                <View testID={TID.Component.DreamDetailReflectionZone} className="mt-2">
                  {renderDetailZoneHeader(t('journal.detail.zone.reflection'), TID.Text.DreamDetailReflectionZone)}
                  {isStalePrimaryAction ? null : renderDetailActionCard(['explore', 'continue'])}
                  {!isAnalysisPending && showCompletedReading && dream.reflectionQuestions && dream.reflectionQuestions.length > 0 ? (
                    <>
                      <View className="mt-2 mb-3 items-center">
                        <Text className="font-display-medium text-[13px] uppercase text-champagne-on">
                          {t('journal.detail.reflection_header')}
                        </Text>
                        <View className="mt-2 h-[2.5px] w-9 self-center rounded-[1.5px] bg-champagne opacity-85" />
                      </View>
                      {dream.reflectionQuestions.map((question, index) => (
                        <View key={`reflection-${index}`} className="mb-3">
                          <Text className="font-sans text-[15px] leading-[22px] text-ivory-muted">
                            {question}
                          </Text>
                        </View>
                      ))}
                    </>
                  ) : null}
                </View>
              ) : null}
            </Reveal>

            <Reveal index={7}>
              {renderFirstValueBackupCard()}

              {!isEditing && !isEditingTranscript ? (
                <ReminderOptInCard surface="journal_detail" style={{ marginBottom: 20 }} />
              ) : null}
            </Reveal>

            <Reveal index={8}>
              {renderDetailZoneHeader(t('journal.detail.zone.actions'))}

              <View className="mb-6 flex-row justify-around gap-3">
                <PressableScale
                  onPress={handleToggleFavorite}
                  disabled={isAnalysisLocked}
                  testID={TID.Button.DreamFavorite}
                  accessibilityLabel={t('journalDetail.a11y.toggleFavorite')}
                  hitSlop={{ top: 8, bottom: 8, left: 0, right: 0 }}
                  className={`flex-1 flex-row items-center justify-center gap-2 rounded-md border border-line-strong bg-ink-soft px-4 py-3.5 ${
                    isAnalysisLocked ? 'opacity-60' : ''
                  }`}
                  style={shadows.sm}
                >
                  <IconSymbol
                    name={dream.isFavorite ? 'heart.fill' : 'heart'}
                    size={24}
                    color={dream.isFavorite ? noctalia.status.warning.icon : noctalia.text.primary}
                  />
                  <Text className="font-sans-medium text-[14px] text-ivory">
                    {dream.isFavorite
                      ? t('journal.detail.favorite.on')
                      : t('journal.detail.favorite.off')}
                  </Text>
                </PressableScale>
                <PressableScale
                  onPress={onShare}
                  disabled={isSharing || isAnalysisLocked}
                  testID={TID.Button.DreamShare}
                  accessibilityLabel={t('journalDetail.a11y.shareDream')}
                  hitSlop={{ top: 8, bottom: 8, left: 0, right: 0 }}
                  className={`flex-1 flex-row items-center justify-center gap-2 rounded-md border border-line-strong bg-ink-soft px-4 py-3.5 ${
                    isSharing || isAnalysisLocked ? 'opacity-70' : ''
                  }`}
                  style={shadows.sm}
                >
                  {isSharing ? (
                    <ActivityIndicator size="small" color={noctalia.text.primary} />
                  ) : (
                    <IconSymbol name="square.and.arrow.up" size={24} color={noctalia.text.primary} />
                  )}
                  <Text className="font-sans-medium text-[14px] text-ivory">
                    {isSharing
                      ? t('journal.detail.share.button_loading')
                      : t('journal.detail.share.button_default')}
                  </Text>
                </PressableScale>
              </View>

              <PressableScale
                onPress={onDelete}
                className="mt-2 min-h-[44px] min-w-[44px] flex-row items-center justify-center gap-1.5 self-center px-3"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                testID={TID.Button.DreamDelete}
                accessibilityLabel={t('journalDetail.a11y.deleteDream')}
              >
                <IconSymbol name="trash" size={18} color={noctalia.status.danger.icon} />
                <Text className="font-sans-bold text-[15px] text-danger-on">
                  {t('journal.menu.delete')}
                </Text>
              </PressableScale>
            </Reveal>
            </View>
        </ScrollView>

        {isEditing && (
          <View
            pointerEvents="auto"
            className="absolute inset-0 justify-end bg-ink-overlay px-4 pt-6 pb-4"
          >
            {dream.imageUrl ? (
              <View className="mb-3 w-full items-center border-transparent bg-transparent">
                {dream.imageSource !== 'ai' ? (
                  <PressableScale
                    onPress={handlePickImage}
                    disabled={isPickingImage || isAnalysisLocked}
                    className={`flex-row items-center gap-2 rounded-[10px] border border-line bg-ink-raised px-3.5 py-2.5 ${
                      (isPickingImage || isAnalysisLocked) ? 'opacity-70' : ''
                    }`}
                  >
                    {isPickingImage ? (
                      <ActivityIndicator color={noctalia.text.primary} />
                    ) : (
                      <IconSymbol name="photo" size={18} color={noctalia.text.primary} />
                    )}
                    <Text className="font-sans-bold text-[14px] text-ivory">
                      {isPickingImage
                        ? t('journal.detail.image.adding_from_library')
                        : t('journal.detail.image.replace_user_button')}
                    </Text>
                  </PressableScale>
                ) : (
                  <Text className="text-center font-sans-medium text-[13px] leading-[18px] text-ivory-muted">
                    {t('journal.detail.image.ai_locked_note')}
                  </Text>
                )}
              </View>
            ) : null}
            <View style={{ marginBottom: floatingTranscriptBottom }}>
              {renderMetadataCard('floating')}
            </View>
          </View>
        )}
        {isEditingTranscript && (
          <View
            pointerEvents="auto"
            className="absolute inset-0 justify-end bg-ink-overlay px-4 pt-6"
          >
            <View
              className="mt-6 mb-7 rounded-lg border border-line bg-ink-raised px-4 pt-6 pb-4"
              style={[shadows.xl, { marginBottom: floatingTranscriptBottom }]}
            >
              {renderTranscriptBody()}
            </View>
          </View>
        )}
        <AnalysisNoticeSheet
          visible={Boolean(analysisNotice)}
          onClose={handleDismissAnalysisNotice}
          notice={displayedAnalysisNotice}
        />
        <ReplaceImageSheet
          visible={showReplaceImageSheet}
          onClose={handleDismissReplaceSheet}
          onReplace={handleReplaceImage}
          onKeep={handleKeepImage}
          isLocked={isAnalysisLocked}
        />
        <ReanalyzeSheet
          visible={showReanalyzeSheet}
          onClose={handleDismissReanalyzeSheet}
          onConfirm={handleConfirmReanalyze}
          isLocked={isAnalysisLocked}
          imagePolicy={reanalyzeImagePolicy}
          onImagePolicyChange={handleReanalyzeImagePolicyChange}
        />
        <Modal
          visible={isIllustrationFullscreen}
          transparent
          animationType="fade"
          onRequestClose={() => setIsIllustrationFullscreen(false)}
        >
          <View
            testID={TID.Modal.JournalIllustrationFullscreen}
            className="flex-1 bg-ink-overlay"
          >
            <Pressable
              className="absolute inset-0"
              onPress={() => setIsIllustrationFullscreen(false)}
              accessibilityRole="button"
              accessibilityLabel={t('journal.detail.image.close_fullscreen')}
            />
            <View className="flex-1 items-center justify-center px-4">
              {dream.imageUrl ? (
                <Image
                  source={{ uri: displayImageUrl ?? dream.imageUrl, cacheKey: imageCacheKey }}
                  style={{ width: '100%', height: '80%' }}
                  contentFit="contain"
                />
              ) : null}
            </View>
            <PressableScale
              onPress={() => setIsIllustrationFullscreen(false)}
              testID={TID.Button.JournalIllustrationClose}
              accessibilityRole="button"
              accessibilityLabel={t('journal.detail.image.close_fullscreen')}
              className="absolute right-5 items-center justify-center rounded-full border border-line bg-ink-raised"
              style={{ top: insets.top + 12, height: 44, width: 44 }}
            >
              <IconSymbol name="xmark" size={18} color={noctalia.text.primary} />
            </PressableScale>
          </View>
        </Modal>
        <DeleteConfirmSheet
          visible={showDeleteSheet}
          onClose={handleCloseDeleteSheet}
          onConfirm={handleConfirmDelete}
          isDeleting={isDeleting}
        />
        <QuotaLimitSheet
          visible={showQuotaLimitSheet}
          onClose={handleQuotaLimitDismiss}
          onPrimary={handleQuotaLimitPrimary}
          onSecondary={handleQuotaLimitSecondary}
          onLink={handleQuotaLimitDismiss}
          tier={tier}
          mode={quotaSheetMode}
          usageLimit={usage?.analysis.limit}
        />
        <ImageErrorSheet
          visible={Boolean(imageErrorMessage)}
          onClose={handleDismissImageError}
          onRetry={handleRetryImageError}
          isRetrying={isRetryingImage}
          message={imageErrorMessage}
        />
        <Modal
          visible={isShareModalVisible}
          transparent
          animationType="fade"
          onRequestClose={closeShareModal}
        >
          <View className="flex-1 items-center justify-center bg-ink-overlay p-6">
            <Pressable className="absolute inset-0" onPress={closeShareModal} />
            <View className="w-full max-w-[420px] gap-4 rounded-[20px] bg-ink-raised p-6"
            >
              <Text className="font-serif-bold text-[20px] text-ivory">
                {t('journal.detail.share_modal.title')}
              </Text>
              <Text className="font-sans text-[15px] leading-[22px] text-ivory-muted"
              >
                {clipboardSupported
                  ? t('journal.detail.share_modal.description.clipboard')
                  : t('journal.detail.share_modal.description.manual')}
              </Text>
              <View className="rounded-[14px] border border-line bg-ink-soft p-4">
                <Text selectable className="font-serif text-body text-ivory"
                >
                  {shareMessage || t('journal.detail.share_modal.empty')}
                </Text>
              </View>
              {clipboardSupported && (
                <PressableScale
                  className="flex-row items-center justify-center gap-2 rounded-full bg-champagne py-3"
                  onPress={handleCopyShareText}
                  testID={TID.Button.ShareCopy}
                  accessibilityLabel={t('journalDetail.a11y.copyShareText')}
                >
                  <IconSymbol
                    name={shareCopyStatus === 'success' ? 'checkmark' : 'doc.on.doc'}
                    size={18}
                    color={noctalia.action.primaryText}
                  />
                  <Text className="font-sans-bold text-[15px] text-on-champagne"
                  >
                    {shareCopyStatus === 'success'
                      ? t('journal.detail.share_modal.copied')
                      : t('journal.detail.share_modal.copy')}
                  </Text>
                </PressableScale>
              )}
              {shareCopyStatus === 'error' && (
                <Text className="text-center font-sans-medium text-[13px] text-danger-on"
                >
                  {t('journal.detail.share_modal.copy_failed')}
                </Text>
              )}
              <PressableScale
                className="items-center rounded-full border border-line py-3"
                onPress={closeShareModal}
                testID={TID.Button.ShareClose}
                accessibilityLabel={t('journalDetail.a11y.closeShareModal')}
              >
                <Text className="font-sans-medium text-[14px] text-ivory-muted"
                >
                  {t('journal.detail.share_modal.close')}
                </Text>
              </PressableScale>
            </View>
          </View>
        </Modal>

        <ReferenceImageSheet
          visible={referenceImagesEnabled && showReferenceSheet}
          subjectType={referenceSubjectType}
          referenceImages={referenceImages}
          isGenerating={isGeneratingWithReference}
          onClose={handleReferenceSheetClose}
          onPrimary={handleGenerateWithReference}
          onSecondary={handleReferenceSheetClose}
          onImagesSelected={handleReferenceImagesSelected}
        />

        {savedConfirmationVisible ? (
          <Toast
            message={t('recording.save.confirmation')}
            mode="success"
            onHide={() => setSavedConfirmationVisible(false)}
            testID={TID.Text.RecordingSaveConfirmation}
          />
        ) : null}

        {favoriteError ? (
          <Toast
            message={favoriteError}
            mode="error"
            onHide={() => setFavoriteError(null)}
          />
        ) : null}

        {/* Hidden composite image generator for sharing */}
        {dream && shareImage && (
          <View className="absolute top-0 left-[-10000px] h-[1350px] w-[1080px]">
            <DreamShareImage ref={shareImageRef} dream={dream} t={t} />
          </View>
        )}
        </KeyboardAvoidingView>
      </View>
    </ScrollPerfProvider>
  );
}
