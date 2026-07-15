import { Toast } from '@/components/Toast';
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
import { DecoLines } from '@/constants/journalTheme';
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
import { isCategoryExplored } from '@/lib/chatCategoryUtils';
import { getDreamThemeLabel, getDreamTypeLabel } from '@/lib/dreamLabels';
import { getDreamSyncState, normalizeDreamMemoryMetadata } from '@/lib/dreamUtils';
import { getDreamAnalysisState, getDreamDetailAction } from '@/lib/dreamUsage';
import { isMockModeEnabled, isReferenceImagesEnabled } from '@/lib/env';
import { classifyError, QuotaError, QuotaErrorCode, type ClassifiedError } from '@/lib/errors';
import { getDreamImageVersion, getImageConfig, withCacheBuster } from '@/lib/imageUtils';
import { getFileExtensionFromUrl, getMimeTypeFromExtension } from '@/lib/journal/shareImageUtils';
import { buildPaywallHref } from '@/lib/paywallRoute';
import { sortWithSelectionFirst } from '@/lib/sorting';
import { TID } from '@/lib/testIDs';
import type { DreamAnalysis, DreamChatCategory, DreamTheme, DreamType, ReferenceImage } from '@/lib/types';
import { categorizeDream, generateImageWithReference } from '@/services/geminiService';
import { Image, type ImageLoadEventData } from 'expo-image';
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
  type StyleProp,
  type TextStyle,
  type ViewStyle
} from 'react-native';
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
const THEME_CATEGORIES: Exclude<DreamChatCategory, 'general'>[] = ['symbols', 'emotions', 'growth'];
const isMockMode = isMockModeEnabled();
const IMAGE_FALLBACK_RATIO = 2 / 3;
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

const Skeleton = ({ style }: { style: StyleProp<ViewStyle> }) => {
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);

  return <View style={[style, { backgroundColor: noctalia.surface.soft }]} />;
};

const TypewriterText = ({ text, style, shouldAnimate }: { text: string; style: StyleProp<TextStyle>; shouldAnimate: boolean }) => {
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

  return <Text style={style}>{displayedText}</Text>;
};

export default function JournalDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const dreamId = useMemo(() => Number(id), [id]);
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
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const { language } = useLanguage();
  const scrollPerf = useScrollIdle();
  useClearWebFocus();
  const [isRetryingImage, setIsRetryingImage] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showReplaceImageSheet, setShowReplaceImageSheet] = useState(false);
  const [showReanalyzeSheet, setShowReanalyzeSheet] = useState(false);
  const [showDeleteSheet, setShowDeleteSheet] = useState(false);
  const [reanalyzeImagePolicy, setReanalyzeImagePolicy] = useState<'keep' | 'regenerate'>('keep');
  const [isSharing, setIsSharing] = useState(false);
  const [isShareModalVisible, setShareModalVisible] = useState(false);
  const [shareCopyStatus, setShareCopyStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [favoriteError, setFavoriteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [analysisNotice, setAnalysisNotice] = useState<AnalysisNotice | null>(null);
  const [showQuotaLimitSheet, setShowQuotaLimitSheet] = useState(false);
  const [quotaSheetMode, setQuotaSheetMode] = useState<'quota' | 'login'>('quota');
  const [imageErrorMessage, setImageErrorMessage] = useState<string | null>(null);
  const [imageAspectRatio, setImageAspectRatio] = useState<number | null>(null);

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
  const { canAnalyzeNow, canAnalyze, tier, usage, loading: quotaLoading, quotaStatus } = useQuota();
  const { t } = useTranslation();
  const referenceImagesEnabled = isReferenceImagesEnabled();
  const isPlus = tier === 'plus';
  const canGenerateImage = !quotaLoading && canAnalyzeNow && (isPlus || tier === 'guest');
  const canUseReference = referenceImagesEnabled && Boolean(user);

  const dream = useMemo(() => dreams.find((d) => d.id === dreamId), [dreams, dreamId]);
  const dreamSyncState = useMemo(
    () => (dream && !isMockMode ? getDreamSyncState(dream) : 'clean'),
    [dream]
  );
  const hasExistingImage = useMemo(() => Boolean(dream?.imageUrl?.trim()), [dream?.imageUrl]);
  useEffect(() => {
    setImageAspectRatio(null);
  }, [dream?.imageUrl]);
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
  const primaryAction = useMemo(() => getDreamDetailAction(dream), [dream]);
  const allThemesExplored = useMemo(() => {
    if (!dream) return false;
    return THEME_CATEGORIES.every((category) => isCategoryExplored(dream.chatHistory, category));
  }, [dream]);
  const isPrimaryActionBusy = primaryAction === 'analyze' && (isAnalyzing || dream?.analysisStatus === 'pending');
  const detailActionCard = useMemo(() => {
    if (!dream) {
      return null;
    }

    if (dream.analysisStatus === 'pending') {
      return {
        icon: 'sparkles' as const,
        title: t('journal.detail.action.pending.title'),
        message: t('journal.detail.action.pending.message'),
        step: t('journal.detail.action.pending.step'),
        cta: t('journal.detail.action.pending.cta'),
        disabled: true,
      };
    }

    if (primaryAction === 'analyze') {
      const failed = dream.analysisStatus === 'failed';
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
  }, [dream, primaryAction, t]);
  const isAnalysisLocked = !!dream && (dream.analysisStatus === 'pending' || isAnalyzing);
  const isAnalysisPending = dream?.analysisStatus === 'pending';
  const isImageJobPending = dream?.imageJobStatus === 'queued' || dream?.imageJobStatus === 'running';
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
  const handleImageLoad = useCallback((event: ImageLoadEventData) => {
    const { width, height } = event.source ?? {};
    if (!width || !height) return;
    const ratio = width / height;
    if (!Number.isFinite(ratio) || ratio <= 0) return;
    setImageAspectRatio(ratio);
  }, []);

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
      await retryDreamSync(dream.id);
    } catch (error) {
      if (__DEV__) {
        console.warn('[JournalDetail] Failed to retry sync', error);
      }
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
      setShowDeleteSheet(false);
      router.replace('/(tabs)/journal');
    } catch (error) {
      if (__DEV__) {
        console.error('Failed to delete dream', error);
      }
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
    if (!dream || isAnalysisLocked) return;

    // Defensive check: verify quota before attempting generation
    if (!canAnalyzeNow) {
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
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : t('common.unknown_error');
      setImageErrorMessage(msg);
    } finally {
      setIsRetryingImage(false);
    }
  }, [canAnalyzeNow, dream, generateDreamImage, isAnalysisLocked, t]);

  const handleBackPress = useCallback(() => {
    router.replace('/(tabs)/journal');
  }, []);

  const handleExplorePress = useCallback(() => {
    if (!dream) return;
    if (allThemesExplored) {
      router.push(`/dream-chat/${dream.id}`);
      return;
    }
    router.push(`/dream-categories/${dream.id}`);
  }, [allThemesExplored, dream]);

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

      if (!skipAllowanceCheck) {
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

    const allowed = await ensureAnalyzeAllowed();
    if (!allowed) return;

    if (hasExistingImage) {
      setShowReplaceImageSheet(true);
      return;
    }

    void runAnalyze(true, true);
  }, [dream, ensureAnalyzeAllowed, hasExistingImage, runAnalyze]);

  const handleReplaceImage = useCallback(() => {
    void runAnalyze(true);
  }, [runAnalyze]);

  const handleKeepImage = useCallback(() => {
    void runAnalyze(false);
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
    void runAnalyze(reanalyzeImagePolicy === 'regenerate');
  }, [reanalyzeImagePolicy, runAnalyze]);

  const handleTranscriptSave = useCallback(async () => {
    if (!dream) return;
    const normalizedTranscript = editableTranscript.trim().length === 0
      ? dream.transcript
      : editableTranscript;
    const transcriptChanged = normalizedTranscript !== dream.transcript;

    const updatedDream: DreamAnalysis = {
      ...dream,
      transcript: normalizedTranscript,
    };
    await updateDream(updatedDream);
    setIsEditingTranscript(false);

    if (transcriptChanged) {
      setReanalyzeImagePolicy(hasExistingImage ? 'keep' : 'regenerate');
      setShowReanalyzeSheet(true);
    }
  }, [dream, editableTranscript, hasExistingImage, updateDream]);

  const handleDismissReplaceSheet = useCallback(() => {
    setShowReplaceImageSheet(false);
  }, []);

  const gradientColors = ([noctalia.screen.gradient[0], noctalia.screen.gradient[1], noctalia.screen.background] as const);
  const gradientLocations = mode === 'dark' ? ([0, 0.7, 1] as const) : undefined;
  const displayedAnalysisNotice = analysisNotice ?? lastAnalysisNoticeRef.current;
  const screenBackgroundColor = gradientColors[gradientColors.length - 1] ?? noctalia.screen.background;

  const keyboardBehavior: 'padding' | 'height' | undefined = Platform.select({
    ios: 'padding',
    android: 'height',
    default: undefined,
  });
  const keyboardVerticalOffset = Platform.select({ ios: 0, android: 0, web: 0 }) ?? 0;
  const shouldHideHeroMedia = isKeyboardVisible && (isEditing || isEditingTranscript);
  const transcriptBackgroundColor = mode === 'dark'
    ? noctalia.surface.base
    : noctalia.surface.soft;
  const floatingTranscriptBottom = Platform.OS === 'ios' ? 32 : 24;
  // Use a single surface color for the main content card and its inner accent cards/buttons
  // so we don't get a darker band/padding effect on Android where slight
  // alpha tints can look like a different background.
  const accentSurfaceBorderColor = noctalia.surface.borderStrong;

  if (!dream) {
    return (
      <ScrollPerfProvider isScrolling={scrollPerf.isScrolling}>
        <View style={[styles.screen, { backgroundColor: screenBackgroundColor }]}>
          <LinearGradient
            colors={gradientColors}
            locations={gradientLocations}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <AtmosphericBackground />
          <KeyboardAvoidingView
            style={styles.keyboardAvoiding}
            behavior={keyboardBehavior}
            keyboardVerticalOffset={keyboardVerticalOffset}
          >
            <View style={styles.container}>
              <Text style={{ color: noctalia.text.primary, fontSize: 18 }}>
                {t('journal.detail.not_found.title')}
              </Text>
              <Pressable
                onPress={handleBackPress}
                style={[
                  styles.backButton,
                  { backgroundColor: noctalia.action.primary, borderColor: noctalia.action.primaryBorder },
                ]}
              >
                <Text style={[styles.backButtonText, { color: noctalia.action.primaryText }]}>
                  {t('journal.detail.not_found.back')}
                </Text>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </View>
      </ScrollPerfProvider>
    );
  }

  const renderTranscriptBody = () => (
    <View
      testID={TID.Component.TranscriptCard}
      style={[
        styles.transcript,
        {
          borderColor: isEditingTranscript ? noctalia.accent.base : 'transparent',
          borderWidth: isEditingTranscript ? 2 : 0,
        }
      ]}
    >
      <View style={styles.transcriptHeader}>
        <Text style={[styles.transcriptTitle, { color: noctalia.text.primary }]}>
          {t('journal.original_transcript')}
        </Text>
        <Pressable
          onPress={isEditingTranscript ? handleTranscriptSave : () => {
            setEditableTranscript(dream.transcript || '');
            setIsEditingTranscript(true);
          }}
          testID={TID.Button.EditTranscript}
          accessibilityLabel="Edit transcript"
          disabled={isAnalysisLocked}
          style={({ pressed }) => [
            styles.transcriptEditButton,
            {
              opacity: pressed || isAnalysisLocked ? 0.7 : 1,
              backgroundColor: isEditingTranscript ? noctalia.action.primary : 'transparent',
              borderColor: noctalia.surface.border,
            },
          ]}
          hitSlop={8}
        >
          <IconSymbol
            name={isEditingTranscript ? 'checkmark' : 'pencil'}
            size={18}
            color={isEditingTranscript ? noctalia.action.primaryText : noctalia.text.secondary}
          />
        </Pressable>
      </View>
      {isEditingTranscript ? (
        <TextInput
          testID={TID.Input.DreamTranscript}
          style={[styles.transcriptInput, {
            color: noctalia.text.primary,
            borderColor: noctalia.surface.border,
            backgroundColor: noctalia.surface.active,
          }]}
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
        <Text style={[styles.transcript, { color: noctalia.text.secondary }]}>{dream.transcript}</Text>
      )}
    </View>
  );

  const renderMetadataCard = (variant: 'inline' | 'floating' = 'inline') => {
    const borderColor = isEditing
      ? noctalia.accent.base
      : (variant === 'floating' ? noctalia.surface.border : accentSurfaceBorderColor);
    const borderWidth = isEditing ? 2 : (variant === 'floating' ? 1 : 0);

    return (
      <View
        testID={TID.Component.MetadataCard}
        style={[
          styles.metadataCard,
          variant === 'floating' && styles.metadataFloatingCard,
          variant === 'floating' ? shadows.xl : shadows.md,
          {
            backgroundColor: noctalia.surface.raised,
            borderColor,
            borderWidth,
            // Keep room for the floating edit/check button so it doesn't overlap chips
            paddingBottom: isEditing ? 64 : 20,
          },
        ]}
      >
      <View style={styles.metadataHeader}>
        <View style={styles.dateContainer}>
          <IconSymbol name="calendar" size={16} color={noctalia.text.primary} />
          <Text style={[styles.dateText, { color: noctalia.text.primary }]}>{formatDreamDate(dream.id)}</Text>
        </View>
        <View style={styles.timeContainer}>
          <IconSymbol name="clock" size={16} color={noctalia.text.primary} />
          <Text style={[styles.timeText, { color: noctalia.text.primary }]}>{formatDreamTime(dream.id)}</Text>
        </View>
      </View>
      <View style={[styles.divider, { backgroundColor: noctalia.surface.border }]} />

      {isEditing ? (
        <TextInput
          testID={TID.Input.DreamTitle}
          nativeID={TID.Input.DreamTitle}
          style={[styles.metadataTitleInput, { color: noctalia.text.primary, borderColor: noctalia.surface.border }]}
          selectTextOnFocus
          value={editableTitle}
          onChangeText={setEditableTitle}
          placeholder={t('journal.detail.title_placeholder')}
          accessibilityLabel={t('journal.detail.title_placeholder')}
          placeholderTextColor={noctalia.text.secondary}
        />
      ) : (
        <Text style={[styles.metadataTitle, { color: noctalia.text.primary }]}>
          {dream.title || t('journal.detail.untitled_dream')}
        </Text>
      )}

      {(isEditing || dream.dreamType) && (
        <View style={[styles.metadataRow, isEditing && { alignItems: 'flex-start' }]}
        >
          <IconSymbol name="moon.stars.fill" size={18} color={noctalia.text.primary} style={{ marginTop: isEditing ? 4 : 0 }} />
          <Text style={[styles.metadataLabel, { color: noctalia.text.primary, marginTop: isEditing ? 4 : 0 }]}>{t('journal.detail.dream_type_label')}</Text>
          {isEditing ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
              <View style={styles.chipsContainer}>
                {sortedDreamTypes.map((type) => {
                  const label = getDreamTypeLabel(type as DreamType, t) ?? type;
                  return (
                    <Pressable
                      key={type}
                      testID={`chip.type.${type}`}
                      onPress={() => setEditableDreamType(type)}
                      style={[
                        styles.chip,
                        { borderColor: noctalia.surface.border },
                        editableDreamType === type && { backgroundColor: noctalia.action.primary, borderColor: noctalia.action.primaryBorder }
                      ]}
                    >
                      <Text style={[
                        styles.chipText,
                        { color: editableDreamType === type ? noctalia.action.primaryText : noctalia.text.primary },
                        editableDreamType === type && styles.chipTextSelected
                      ]}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          ) : (
            <Text style={[styles.metadataValue, { color: noctalia.text.primary, flex: 1 }]}>
              {dreamTypeLabel || dream.dreamType}
            </Text>
          )}
        </View>
      )}

      <View style={[styles.metadataRow, isEditing && { alignItems: 'flex-start' }]}>
        <IconSymbol name="paintpalette" size={18} color={noctalia.text.primary} style={{ marginTop: isEditing ? 4 : 0 }} />
        <Text style={[styles.metadataLabel, { color: noctalia.text.primary, marginTop: isEditing ? 4 : 0 }]}>{t('journal.detail.theme_label')}</Text>
        {isEditing ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
            <View style={styles.chipsContainer}>
              {sortedDreamThemes.map((theme) => {
                const label = getDreamThemeLabel(theme as DreamTheme, t) ?? theme;
                return (
                  <Pressable
                    key={theme}
                    testID={`chip.theme.${theme}`}
                    onPress={() => setEditableTheme(theme)}
                    style={[
                      styles.chip,
                      { borderColor: noctalia.surface.border },
                      editableTheme === theme && { backgroundColor: noctalia.action.primary, borderColor: noctalia.action.primaryBorder }
                    ]}
                  >
                    <Text style={[
                      styles.chipText,
                      { color: editableTheme === theme ? noctalia.action.primaryText : noctalia.text.primary },
                      editableTheme === theme && styles.chipTextSelected
                    ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        ) : (
          <Text style={[styles.metadataValue, { color: noctalia.text.primary, flex: 1 }]}>
            {dreamThemeLabel || t('journal.detail.theme_placeholder')}
          </Text>
        )}
      </View>

      {!isEditing && dreamMemoryItems.length > 0 && (
        <View style={[styles.metadataMemoryBlock, { borderTopColor: noctalia.surface.border }]}>
          <View style={styles.metadataMemoryHeader}>
            <IconSymbol name="moon.stars.fill" size={16} color={noctalia.accent.base} />
            <Text style={[styles.metadataMemoryTitle, { color: noctalia.accent.base }]}>
              {t('journal.detail.zone.memory')}
            </Text>
          </View>
          {dreamMemoryItems.map((item) => (
            <View key={item.key} style={styles.metadataMemoryRow}>
              <Text style={[styles.metadataMemoryLabel, { color: noctalia.text.secondary }]}>
                {item.label}
              </Text>
              <Text style={[styles.metadataMemoryValue, { color: noctalia.text.primary }]}>
                {item.value}
              </Text>
            </View>
          ))}
        </View>
      )}

      <Pressable
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
        style={({ pressed }) => [
          styles.editButton,
          {
            opacity: pressed || isAnalysisLocked ? 0.7 : 1,
            backgroundColor: isEditing ? noctalia.action.primary : noctalia.surface.active,
          },
        ]}
        hitSlop={8}
      >
        <IconSymbol
          name={isEditing ? 'checkmark' : 'pencil'}
          size={16}
          color={isEditing ? noctalia.action.primaryText : noctalia.text.secondary}
        />
      </Pressable>
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
    const cardTone = isSyncConflict
      ? {
          background: noctalia.status.danger.background,
          border: noctalia.status.danger.border,
          icon: noctalia.status.danger.icon,
          title: noctalia.status.danger.text,
          message: noctalia.status.danger.text,
          primaryBackground: noctalia.status.danger.icon,
          primaryText: noctalia.action.primaryText,
          secondaryBorder: noctalia.status.danger.border,
          secondaryText: noctalia.status.danger.text,
        }
      : isSyncFailed
        ? {
            background: noctalia.status.warning.background,
            border: noctalia.status.warning.border,
            icon: noctalia.status.warning.icon,
            title: noctalia.status.warning.text,
            message: noctalia.status.warning.text,
          }
        : {
            background: noctalia.surface.active,
            border: noctalia.surface.border,
            icon: noctalia.accent.base,
            title: noctalia.text.primary,
            message: noctalia.text.secondary,
          };
    const iconName = isSyncConflict
      ? 'exclamationmark.octagon.fill'
      : isSyncFailed
        ? 'exclamationmark.triangle.fill'
        : 'arrow.triangle.2.circlepath';

    return (
      <View style={[styles.statusCard, { backgroundColor: cardTone.background, borderColor: cardTone.border }]}>
        <View style={styles.statusHeader}>
          <IconSymbol name={iconName} size={24} color={cardTone.icon} />
          <Text style={[styles.statusTitle, { color: cardTone.title }]}>{title}</Text>
        </View>
        <Text style={[styles.statusMessage, { color: cardTone.message }]}>{message}</Text>
        {isSyncPending ? (
          <ActivityIndicator size="small" color={noctalia.accent.base} />
        ) : null}
        {isSyncFailed ? (
          <Pressable
            style={[styles.analyzeButton, { backgroundColor: noctalia.action.primary }]}
            onPress={handleRetrySync}
          >
            <IconSymbol name="arrow.clockwise" size={18} color={noctalia.action.primaryText} />
            <Text style={[styles.analyzeButtonText, { color: noctalia.action.primaryText }]}>
              {t('journal.detail.sync.retry')}
            </Text>
          </Pressable>
        ) : null}
        {isSyncConflict ? (
          <View style={styles.sheetButtons}>
            <Pressable
              style={[styles.sheetPrimaryButton, { backgroundColor: cardTone.primaryBackground }]}
              onPress={handleKeepLocalVersion}
            >
              <Text style={[styles.sheetPrimaryButtonText, { color: cardTone.primaryText }]}>
                {t('journal.detail.sync.keep_local')}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.sheetSecondaryButton, { borderColor: cardTone.secondaryBorder }]}
              onPress={handleUseServerVersion}
            >
              <Text style={[styles.sheetSecondaryButtonText, { color: cardTone.secondaryText }]}>
                {t('journal.detail.sync.use_server')}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    );
  };

  const renderDetailActionCard = () => {
    if (!detailActionCard || isEditing || isEditingTranscript) {
      return null;
    }

    const disabled = detailActionCard.disabled || isPrimaryActionBusy || isAnalysisLocked;
    const onPress = primaryAction === 'analyze' ? handleAnalyze : handleExplorePress;
    const isCompactExplorationAction = primaryAction === 'continue' || primaryAction === 'explore';

    if (isCompactExplorationAction) {
      return (
        <Pressable
          testID={TID.Component.DreamDetailActionCard}
          onPress={onPress}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityState={{ disabled }}
          style={({ pressed }) => [
            styles.detailActionCompactCard,
            {
              backgroundColor: noctalia.surface.active,
              borderColor: noctalia.surface.borderStrong,
              opacity: disabled ? 0.75 : pressed ? 0.82 : 1,
            },
          ]}
        >
          <View style={[styles.detailActionCompactIcon, { backgroundColor: noctalia.action.primary }]}>
            <IconSymbol name={detailActionCard.icon} size={18} color={noctalia.action.primaryText} />
          </View>
          <Text
            style={[styles.detailActionCompactText, { color: noctalia.text.primary }]}
            testID={TID.Text.DreamDetailActionTitle}
          >
            {detailActionCard.cta}
          </Text>
          {isPrimaryActionBusy ? (
            <ActivityIndicator size="small" color={noctalia.text.primary} />
          ) : (
            <IconSymbol name="arrow.right" size={18} color={noctalia.text.primary} />
          )}
        </Pressable>
      );
    }

    return (
      <View
        testID={TID.Component.DreamDetailActionCard}
        style={[
          styles.detailActionCard,
          {
            backgroundColor: noctalia.surface.active,
            borderColor: noctalia.surface.borderStrong,
          },
        ]}
      >
        <View style={styles.detailActionHeader}>
          <View style={[styles.detailActionIcon, { backgroundColor: noctalia.action.primary }]}>
            <IconSymbol name={detailActionCard.icon} size={18} color={noctalia.action.primaryText} />
          </View>
          <View style={styles.detailActionCopy}>
            <Text
              style={[styles.detailActionStep, { color: noctalia.accent.base }]}
              testID={TID.Text.DreamDetailActionStep}
            >
              {detailActionCard.step}
            </Text>
            <Text
              style={[styles.detailActionTitle, { color: noctalia.text.primary }]}
              testID={TID.Text.DreamDetailActionTitle}
            >
              {detailActionCard.title}
            </Text>
            <Text
              style={[styles.detailActionMessage, { color: noctalia.text.secondary }]}
              testID={TID.Text.DreamDetailActionMessage}
            >
              {detailActionCard.message}
            </Text>
          </View>
        </View>
        <Pressable
          testID={TID.Button.DreamDetailPrimaryCta}
          onPress={onPress}
          disabled={disabled}
          style={[
            styles.detailActionButton,
            {
              backgroundColor: noctalia.action.primary,
              opacity: disabled ? 0.75 : 1,
            },
          ]}
          accessibilityRole="button"
          accessibilityState={{ disabled }}
        >
          {isPrimaryActionBusy ? (
            <ActivityIndicator size="small" color={noctalia.action.primaryText} />
          ) : (
            <IconSymbol
              name={primaryAction === 'analyze' ? 'sparkles' : 'arrow.right'}
              size={18}
              color={noctalia.action.primaryText}
            />
          )}
          <Text style={[styles.detailActionButtonText, { color: noctalia.action.primaryText }]}>
            {detailActionCard.cta}
          </Text>
        </Pressable>
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
        style={[
          styles.firstValueBackupCard,
          {
            backgroundColor: noctalia.surface.soft,
            borderColor: noctalia.surface.borderStrong,
          },
        ]}
      >
        <View style={styles.firstValueBackupHeader}>
          <IconSymbol name="lock.shield" size={20} color={noctalia.accent.base} />
          <Text
            style={[styles.firstValueBackupTitle, { color: noctalia.text.primary }]}
            testID={TID.Text.FirstValueBackupTitle}
          >
            {t('journal.detail.backup_prompt.title')}
          </Text>
        </View>
        <Text style={[styles.firstValueBackupMessage, { color: noctalia.text.secondary }]}>
          {t('journal.detail.backup_prompt.message')}
        </Text>
        <Pressable
          testID={TID.Button.FirstValueBackupCta}
          onPress={handleFirstValueBackup}
          style={[styles.firstValueBackupButton, { borderColor: noctalia.surface.border }]}
          accessibilityRole="button"
        >
          <Text style={[styles.firstValueBackupButtonText, { color: noctalia.text.primary }]}>
            {t('journal.detail.backup_prompt.cta')}
          </Text>
          <IconSymbol name="arrow.right" size={16} color={noctalia.text.primary} />
        </Pressable>
      </View>
    );
  };

  const renderDetailZoneHeader = (label: string) => (
    <View style={styles.detailZoneHeader}>
      <Text style={[styles.detailZoneHeaderText, { color: noctalia.accent.base }]}>
        {label}
      </Text>
      <View style={[styles.detailZoneRule, { backgroundColor: noctalia.accent.base }]} />
    </View>
  );

  return (
    <ScrollPerfProvider isScrolling={scrollPerf.isScrolling}>
      <View style={[styles.screen, { backgroundColor: screenBackgroundColor }]}>
        <LinearGradient
          colors={gradientColors}
          locations={gradientLocations}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <AtmosphericBackground />
        <KeyboardAvoidingView
          style={styles.keyboardAvoiding}
          behavior={keyboardBehavior}
          keyboardVerticalOffset={keyboardVerticalOffset}
        >
        <Pressable
          onPress={handleBackPress}
          style={[styles.floatingBackButton, shadows.lg, {
            backgroundColor: noctalia.surface.raised,
            borderWidth: 1,
            borderColor: noctalia.surface.border,
          }]}
          testID={TID.Button.NavigateJournal}
          accessibilityRole="button"
          accessibilityLabel={t('journal.back_button')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <IconSymbol name="chevron.left" size={22} color={noctalia.text.primary} />
        </Pressable>
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: (isEditing || isEditingTranscript) ? 220 : 100 },
          ]}
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={16}
          onScrollBeginDrag={scrollPerf.onScrollBeginDrag}
          onScrollEndDrag={scrollPerf.onScrollEndDrag}
          onMomentumScrollBegin={scrollPerf.onMomentumScrollBegin}
          onMomentumScrollEnd={scrollPerf.onMomentumScrollEnd}
        >

          {/* Dream Image */}
          {!shouldHideHeroMedia && (
            <View style={styles.imageContainer}>
              <View style={[styles.imageFrame, { aspectRatio: imageAspectRatio ?? IMAGE_FALLBACK_RATIO }]}>
                {dream.imageUrl ? (
                  <>
                    <Image
                      key={displayImageUrl ?? dream.imageUrl}
                      source={{ uri: displayImageUrl ?? dream.imageUrl, cacheKey: imageCacheKey }}
                      style={styles.dreamImage}
                      contentFit="contain"
                      transition={imageConfig.transition}
                      cachePolicy={imageConfig.cachePolicy}
                      priority={imageConfig.priority}
                      onLoad={handleImageLoad}
                      placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
                    />
                    <View style={[styles.imageOverlay, { backgroundColor: noctalia.atmosphere.horizon }]} />
                  </>
                ) : dream.imageGenerationFailed ? (
                  canGenerateImage ? (
                    <ImageRetry onRetry={onRetryImage} isRetrying={isRetryingImage} />
                  ) : (
                    <View
                      style={[
                        styles.dreamImage,
                        styles.imagePlaceholderCard,
                        {
                          backgroundColor: noctalia.surface.soft,
                          borderColor: noctalia.surface.border,
                        },
                      ]}
                    >
                      <IconSymbol name="photo" size={64} color={noctalia.text.secondary} />
                      <Text style={[styles.imagePlaceholderTitle, { color: noctalia.text.primary }]}>
                        {t('journal.detail.image.generation_failed')}
                      </Text>
                      <Text style={[styles.imagePlaceholderSubtitle, { color: noctalia.text.secondary }]}>
                        {t('journal.detail.image.quota_exceeded_message')}
                      </Text>
                    </View>
                  )
                ) : dream.analysisStatus === 'pending' || isImageJobPending ? (
                  <View
                    style={[
                      styles.dreamImage,
                      styles.imageGeneratingCard,
                      {
                        backgroundColor: noctalia.surface.active,
                        borderColor: noctalia.surface.borderStrong,
                      },
                    ]}
                  >
                    <View style={[styles.imageGeneratingIcon, { backgroundColor: noctalia.action.primary }]}>
                      <IconSymbol name="sparkles" size={28} color={noctalia.action.primaryText} />
                    </View>
                    <ActivityIndicator size="large" color={noctalia.accent.soft} />
                    <Text style={[styles.imagePlaceholderTitle, { color: noctalia.text.primary }]}>
                      {isImageJobPending
                        ? t('journal.detail.image.generating_title')
                        : t('journal.detail.image.preparing_title')}
                    </Text>
                    <Text style={[styles.imagePlaceholderSubtitle, { color: noctalia.text.secondary }]}>
                      {dream.imageJobStatus === 'queued'
                        ? t('journal.detail.image.queued_subtitle')
                        : dream.imageJobStatus === 'running'
                          ? t('journal.detail.image.running_subtitle')
                          : t('journal.detail.image.preparing_subtitle')}
                    </Text>
                  </View>
                ) : (
                  <View
                    style={[
                      styles.dreamImage,
                      styles.imagePlaceholderCard,
                      {
                        backgroundColor: noctalia.surface.soft,
                        borderColor: noctalia.surface.border,
                      },
                    ]}
                  >
                    <IconSymbol name="photo" size={32} color={noctalia.text.secondary} />
                    <Text style={[styles.imagePlaceholderTitle, { color: noctalia.text.primary }]}>
                      {t('journal.detail.image.no_image_title')}
                    </Text>
                    <Text style={[styles.imagePlaceholderSubtitle, { color: noctalia.text.secondary }]}>
                      {t('journal.detail.image.no_image_subtitle')}
                    </Text>
                    {!isRetryingImage && !isImageJobPending && !isAnalysisLocked && (
                      <View style={styles.imageActionsColumn}>
                        {canGenerateImage && (
                          <>
                            <Pressable
                              onPress={onRetryImage}
                              disabled={isRetryingImage || isImageJobPending || isAnalysisLocked}
                              style={[
                                styles.imageActionButton,
                                shadows.md,
                                { backgroundColor: noctalia.action.primary },
                                (isRetryingImage || isAnalysisLocked) && styles.imageActionButtonDisabled,
                              ]}
                            >
                              <IconSymbol name="arrow.clockwise" size={18} color={noctalia.action.primaryText} />
                              <Text style={[styles.imageActionText, { color: noctalia.action.primaryText }]}>
                                {t('journal.detail.image.generate_action')}
                              </Text>
                            </Pressable>

                            <Text style={[styles.imageOrText, { color: noctalia.text.secondary }]}>
                              {t('journal.detail.image.or')}
                            </Text>
                          </>
                        )}

                        <Pressable
                          onPress={handlePickImage}
                          disabled={isPickingImage || isAnalysisLocked}
                          style={[
                            styles.imageActionButton,
                            styles.imageActionButtonSecondary,
                            {
                              borderColor: noctalia.surface.border,
                            },
                            (isPickingImage || isAnalysisLocked) && styles.imageActionButtonDisabled,
                          ]}
                        >
                          {isPickingImage ? (
                            <ActivityIndicator color={noctalia.text.primary} />
                          ) : (
                            <IconSymbol name="photo" size={18} color={noctalia.text.primary} />
                          )}
                          <Text style={[styles.imageActionText, { color: noctalia.text.primary }]}>
                            {isPickingImage
                              ? t('journal.detail.image.adding_from_library')
                              : t('journal.detail.image.add_from_library')}
                          </Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                )}
                {(isRetryingImage || isAnalysisLocked) && (
                  <View style={[styles.imageLoadingOverlay, { backgroundColor: noctalia.surface.overlay }]}>
                    <ActivityIndicator color={noctalia.text.primary} />
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Image Top Vignette */}
          {!shouldHideHeroMedia && (
            <LinearGradient
              colors={[noctalia.surface.base, 'transparent']}
              style={styles.imageTopVignette}
              pointerEvents="none"
            />
          )}

          {/* Content Card - Overlaps image */}
          <View style={[styles.contentCard, shadows.xl, { backgroundColor: noctalia.surface.base }]}>
            {/* Plus metadata card */}
            {!isEditing && renderMetadataCard()}
            {renderSyncStatusCard()}

            {(analysisState.isAnalyzed || isAnalysisPending) && (
              <>
                {/* Quote */}
                {isAnalysisPending ? (
                  <Skeleton style={{ height: 60, width: '100%', borderRadius: 8 }} />
                  ) : dream.shareableQuote ? (
                  <FlatGlassCard style={styles.quoteBoxGlass} animationDelay={450}>
                    <IconSymbol name="quote.opening" size={28} color={noctalia.accent.base} style={styles.quoteIcon} />
                    <Text style={[styles.quote, { color: noctalia.text.primary }]}>
                      &quot;{dream.shareableQuote}&quot;
                    </Text>
                  </FlatGlassCard>
                ) : null}

                {isAnalysisPending ? (
                  <View style={{ gap: 8, marginBottom: 16 }}>
                    <Skeleton style={{ height: 16, width: '100%', borderRadius: 4 }} />
                    <Skeleton style={{ height: 16, width: '90%', borderRadius: 4 }} />
                    <Skeleton style={{ height: 16, width: '95%', borderRadius: 4 }} />
                  </View>
                ) : dream.interpretation ? (
                  <>
                    <View style={styles.sectionHeader}>
                      <Text style={[styles.sectionHeaderText, { color: noctalia.accent.base }]}>
                        {t('journal.detail.interpretation_header')}
                      </Text>
                      <View style={[DecoLines.rule, { backgroundColor: noctalia.accent.base, marginTop: 8 }]} />
                    </View>
                    <TypewriterText
                      text={dream.interpretation}
                      style={[styles.interpretation, { color: noctalia.text.secondary }]}
                      shouldAnimate={false}
                    />
                  </>
                ) : null}
              </>
            )}

            {/* Transcript Section */}
            {!isEditingTranscript && (
              <View
                style={[styles.transcriptSection, {
                  borderTopColor: noctalia.surface.border,
                  backgroundColor: transcriptBackgroundColor,
                }]}
                onLayout={(event) => setTranscriptSectionOffset(event.nativeEvent.layout.y)}
              >
                {renderTranscriptBody()}
              </View>
            )}

            {renderFirstValueBackupCard()}

            {renderDetailZoneHeader(t('journal.detail.zone.actions'))}

            <View style={styles.actionsRow}>
              <Pressable
                onPress={handleToggleFavorite}
                disabled={isAnalysisLocked}
                testID={TID.Button.DreamFavorite}
                accessibilityLabel="Toggle favorite"
                style={[
                  styles.actionButton,
                  shadows.sm,
                  {
                    // Match the main card surface so the padding around the
                    // button doesn't look like a darker band on Android.
                    backgroundColor: noctalia.surface.soft,
                    borderColor: noctalia.surface.borderStrong,
                    opacity: isAnalysisLocked ? 0.6 : 1,
                  },
                ]}
              >
                <IconSymbol
                  name={dream.isFavorite ? 'heart.fill' : 'heart'}
                  size={24}
                  color={dream.isFavorite ? noctalia.status.warning.icon : noctalia.text.primary}
                />
                <Text style={[styles.actionButtonText, { color: noctalia.text.primary }]}
                >
                  {dream.isFavorite
                    ? t('journal.detail.favorite.on')
                    : t('journal.detail.favorite.off')}
                </Text>
              </Pressable>
              <Pressable
                onPress={onShare}
                disabled={isSharing || isAnalysisLocked}
                testID={TID.Button.DreamShare}
                accessibilityLabel="Share dream"
                style={[
                  styles.actionButton,
                  shadows.sm,
                  {
                    backgroundColor: noctalia.surface.soft,
                    borderColor: noctalia.surface.borderStrong,
                    opacity: isSharing || isAnalysisLocked ? 0.7 : 1,
                  },
                ]}
              >
                {isSharing ? (
                  <ActivityIndicator size="small" color={noctalia.text.primary} />
                ) : (
                  <IconSymbol name="square.and.arrow.up" size={24} color={noctalia.text.primary} />
                )}
                <Text style={[styles.actionButtonText, { color: noctalia.text.primary }]}
                >
                  {isSharing
                    ? t('journal.detail.share.button_loading')
                    : t('journal.detail.share.button_default')}
                </Text>
              </Pressable>
            </View>

            {renderDetailActionCard()}

            <Pressable
              onPress={onDelete}
              style={styles.deleteLink}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="link"
              testID={TID.Button.DreamDelete}
              accessibilityLabel="Delete dream"
            >
              <IconSymbol name="trash" size={18} color={noctalia.status.danger.icon} />
              <Text style={[styles.deleteLinkText, { color: noctalia.status.danger.text }]}>
                {t('journal.menu.delete')}
              </Text>
            </Pressable>
            </View>
        </ScrollView>

        {isEditing && (
          <View
            style={[
              styles.metadataOverlay,
              { backgroundColor: noctalia.surface.overlay },
              styles.pointerAuto,
            ]}
          >
            {dream.imageUrl ? (
              <View
                style={[
                  styles.imageEditOverlay,
                  { borderColor: 'transparent', backgroundColor: 'transparent' },
                ]}
              >
                {dream.imageSource !== 'ai' ? (
                  <Pressable
                    onPress={handlePickImage}
                    disabled={isPickingImage || isAnalysisLocked}
                    style={[
                      styles.imageEditButton,
                      {
                        backgroundColor: noctalia.surface.raised,
                        borderColor: noctalia.surface.border,
                      },
                      (isPickingImage || isAnalysisLocked) && styles.imageActionButtonDisabled,
                    ]}
                  >
                    {isPickingImage ? (
                      <ActivityIndicator color={noctalia.text.primary} />
                    ) : (
                      <IconSymbol name="photo" size={18} color={noctalia.text.primary} />
                    )}
                    <Text style={[styles.imageEditButtonText, { color: noctalia.text.primary }]}>
                      {isPickingImage
                        ? t('journal.detail.image.adding_from_library')
                        : t('journal.detail.image.replace_user_button')}
                    </Text>
                  </Pressable>
                ) : (
                  <Text style={[styles.imageEditNote, { color: noctalia.text.secondary }]}>
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
            style={[
              styles.transcriptOverlay,
              { backgroundColor: noctalia.surface.overlay },
              styles.pointerAuto,
            ]}
          >
            <View
              style={[
                styles.transcriptSection,
                styles.transcriptFloatingCard,
                shadows.xl,
                {
                  backgroundColor: noctalia.surface.raised,
                  borderColor: noctalia.surface.border,
                  marginBottom: floatingTranscriptBottom,
                },
              ]}
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
          <View style={[styles.shareModalOverlay, { backgroundColor: noctalia.surface.overlay }]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={closeShareModal} />
            <View style={[styles.shareModalContent, { backgroundColor: noctalia.surface.raised }]}
            >
              <Text style={[styles.shareModalTitle, { color: noctalia.text.primary }]}>
                {t('journal.detail.share_modal.title')}
              </Text>
              <Text style={[styles.shareModalDescription, { color: noctalia.text.secondary }]}
              >
                {clipboardSupported
                  ? t('journal.detail.share_modal.description.clipboard')
                  : t('journal.detail.share_modal.description.manual')}
              </Text>
              <View
                style={[
                  styles.shareMessageBox,
                  { backgroundColor: noctalia.surface.soft, borderColor: noctalia.surface.border },
                ]}
              >
                <Text selectable style={[styles.shareMessageText, { color: noctalia.text.primary }]}
                >
                  {shareMessage || t('journal.detail.share_modal.empty')}
                </Text>
              </View>
              {clipboardSupported && (
                <Pressable
                  style={[styles.shareCopyButton, { backgroundColor: noctalia.action.primary }]}
                  onPress={handleCopyShareText}
                  testID={TID.Button.ShareCopy}
                  accessibilityLabel="Copy share text"
                >
                  <IconSymbol
                    name={shareCopyStatus === 'success' ? 'checkmark' : 'doc.on.doc'}
                    size={18}
                    color={noctalia.action.primaryText}
                  />
                  <Text style={[styles.shareCopyButtonText, { color: noctalia.action.primaryText }]}
                  >
                    {shareCopyStatus === 'success'
                      ? t('journal.detail.share_modal.copied')
                      : t('journal.detail.share_modal.copy')}
                  </Text>
                </Pressable>
              )}
              {shareCopyStatus === 'error' && (
                <Text style={[styles.shareFeedbackText, { color: noctalia.status.danger.text }]}
                >
                  {t('journal.detail.share_modal.copy_failed')}
                </Text>
              )}
              <Pressable
                style={[styles.shareCloseButton, { borderColor: noctalia.surface.border }]}
                onPress={closeShareModal}
                testID={TID.Button.ShareClose}
                accessibilityLabel="Close share modal"
              >
                <Text style={[styles.shareCloseButtonText, { color: noctalia.text.secondary }]}
                >
                  {t('journal.detail.share_modal.close')}
                </Text>
              </Pressable>
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

        {favoriteError ? (
          <Toast
            message={favoriteError}
            mode="error"
            onHide={() => setFavoriteError(null)}
          />
        ) : null}

        {/* Hidden composite image generator for sharing */}
        {dream && shareImage && (
          <View style={{ position: 'absolute', left: -10000, top: 0, width: 1080, height: 1350 }}>
            <DreamShareImage ref={shareImageRef} dream={dream} isPlus={isPlus} t={t} />
          </View>
        )}
        </KeyboardAvoidingView>
      </View>
    </ScrollPerfProvider>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  keyboardAvoiding: {
    flex: 1,
  },
  floatingBackButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 50,
    width: 44,
    height: 44,
    borderRadius: 22,
    // backgroundColor: set dynamically
    justifyContent: 'center',
    alignItems: 'center',
    // shadow: applied via theme shadows.lg
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  backButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    // backgroundColor: set dynamically
    borderRadius: 8,
  },
  backButtonText: {
    // color: set dynamically
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 16,
  },
  imageContainer: {
    width: '100%',
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0,
  },
  imageFrame: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  dreamImage: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholderCard: {
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'column',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 24,
    borderRadius: 16,
    borderWidth: 1,
  },
  imageGeneratingCard: {
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'column',
    gap: 12,
    paddingHorizontal: 24,
    paddingVertical: 28,
    borderRadius: 16,
    borderWidth: 1,
  },
  imageGeneratingIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePlaceholderTitle: {
    fontSize: 18,
    fontFamily: Fonts.spaceGrotesk.bold,
    textAlign: 'center',
  },
  imagePlaceholderSubtitle: {
    fontSize: 14,
    fontFamily: Fonts.spaceGrotesk.regular,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  imageActionsRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  imageActionsColumn: {
    width: '100%',
    gap: 12,
    alignItems: 'center',
  },
  imageActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    minWidth: 150,
    gap: 8,
  },
  imageActionButtonSecondary: {
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  imageActionButtonDisabled: {
    opacity: 0.7,
  },
  imageActionText: {
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 15,
  },
  imageOrText: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 13,
  },
  imageEditRow: {
    marginTop: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    width: '92%',
    zIndex: 2,
  },
  imageEditOverlay: {
    width: '100%',
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderRadius: 0,
    borderWidth: 0,
    marginBottom: 12,
    alignItems: 'center',
  },
  imageEditButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  imageEditButtonText: {
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 14,
  },
  imageEditNote: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  imageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 16,
  },
  imageLoadingOverlay: {
    ...StyleSheet.absoluteFill,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentCard: {
    marginTop: -24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    // backgroundColor: set dynamically
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 24,
    // shadow: applied via theme shadows.xl
  },
  // Plus metadata card
  metadataCard: {
    // backgroundColor and borderColor: set dynamically
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    // shadow: applied via theme shadows.md
  },
  metadataHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  dateText: {
    fontSize: 14,
    fontFamily: Fonts.spaceGrotesk.bold,
    // color: set dynamically
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timeText: {
    fontSize: 14,
    fontFamily: Fonts.spaceGrotesk.bold,
    // color: set dynamically
  },
  divider: {
    height: 1,
    // backgroundColor: set dynamically
    marginVertical: 12,
  },
  metadataTitle: {
    fontSize: 26,
    fontFamily: Fonts.fraunces.semiBold,
    // color: set dynamically
    marginBottom: 12,
    lineHeight: 34,
  },
  metadataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  metadataOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 16,
  },
  pointerAuto: {
    pointerEvents: 'auto',
  } as ViewStyle,
  metadataFloatingCard: {
    borderRadius: 20,
  },
  metadataLabel: {
    fontSize: 14,
    fontFamily: Fonts.spaceGrotesk.medium,
    // color: set dynamically
    opacity: 0.7,
  },
  metadataValue: {
    fontSize: 14,
    fontFamily: Fonts.spaceGrotesk.bold,
    // color: set dynamically
    textTransform: 'capitalize',
  },
  metadataMemoryBlock: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    gap: 8,
  },
  metadataMemoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metadataMemoryTitle: {
    fontSize: 12,
    fontFamily: Fonts.spaceGrotesk.bold,
    textTransform: 'uppercase',
  },
  metadataMemoryRow: {
    gap: 2,
  },
  metadataMemoryLabel: {
    fontSize: 12,
    fontFamily: Fonts.spaceGrotesk.medium,
    lineHeight: 16,
  },
  metadataMemoryValue: {
    fontSize: 14,
    fontFamily: Fonts.spaceGrotesk.bold,
    lineHeight: 18,
  },
  title: {
    fontSize: 28,
    fontFamily: Fonts.lora.bold,
    // color: set dynamically
    marginBottom: 12,
    lineHeight: 36,
  },
  interpretation: {
    fontSize: 16,
    fontFamily: Fonts.spaceGrotesk.regular,
    // color: set dynamically
    lineHeight: 24,
    marginBottom: 16,
  },
  quoteBox: {
    borderLeftWidth: 4,
    // borderLeftColor: set dynamically
    paddingLeft: 16,
    paddingVertical: 8,
    marginVertical: 16,
  },
  quoteBoxGlass: {
    padding: 20,
    marginVertical: 16,
    position: 'relative',
  },
  quoteIcon: {
    position: 'absolute',
    top: 12,
    left: 12,
    opacity: 0.25,
  },
  quote: {
    fontSize: 20,
    fontFamily: Fonts.lora.boldItalic,
    // color: set dynamically
    lineHeight: 30,
    paddingLeft: 8,
  },
  sectionHeader: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  sectionHeaderText: {
    fontSize: 13,
    fontFamily: Fonts.fraunces.medium,
    textTransform: 'uppercase',
  },
  detailZoneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  detailZoneHeaderText: {
    fontSize: 12,
    fontFamily: Fonts.spaceGrotesk.bold,
    textTransform: 'uppercase',
  },
  detailZoneRule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    opacity: 0.45,
  },
  imageTopVignette: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 100,
    zIndex: 1,
  },
  detailActionCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 18,
    gap: 14,
  },
  detailActionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  detailActionIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailActionCopy: {
    flex: 1,
    gap: 4,
  },
  detailActionStep: {
    fontSize: 11,
    fontFamily: Fonts.spaceGrotesk.bold,
    textTransform: 'uppercase',
  },
  detailActionTitle: {
    fontSize: 17,
    fontFamily: Fonts.fraunces.medium,
    lineHeight: 23,
  },
  detailActionMessage: {
    fontSize: 13,
    fontFamily: Fonts.spaceGrotesk.regular,
    lineHeight: 18,
  },
  detailActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  detailActionButtonText: {
    fontSize: 15,
    fontFamily: Fonts.spaceGrotesk.bold,
  },
  detailActionCompactCard: {
    minHeight: 58,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  detailActionCompactIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailActionCompactText: {
    flex: 1,
    fontSize: 16,
    fontFamily: Fonts.spaceGrotesk.bold,
  },
  firstValueBackupCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    gap: 10,
  },
  firstValueBackupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  firstValueBackupTitle: {
    flex: 1,
    fontSize: 16,
    fontFamily: Fonts.fraunces.medium,
    lineHeight: 22,
  },
  firstValueBackupMessage: {
    fontSize: 13,
    fontFamily: Fonts.spaceGrotesk.regular,
    lineHeight: 18,
  },
  firstValueBackupButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  firstValueBackupButtonText: {
    fontSize: 13,
    fontFamily: Fonts.spaceGrotesk.bold,
  },
  exploreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    // backgroundColor and borderColor: set dynamically
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 14,
    marginTop: 20,
    marginBottom: 20,
    // shadow: applied via theme shadows.xl
    borderWidth: 1,
  },
  exploreButtonText: {
    fontSize: 17,
    fontFamily: Fonts.fraunces.medium,
    // color: set dynamically
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 12,
    marginBottom: 24,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    // backgroundColor and borderColor: set dynamically
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    // shadow: applied via theme shadows.sm
  },
  actionButtonText: {
    fontSize: 14,
    fontFamily: Fonts.spaceGrotesk.medium,
    // color: set dynamically
  },
  transcriptSection: {
    marginTop: 24,
    marginBottom: 28,
    paddingTop: 24,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    // borderTopColor and backgroundColor: set dynamically
    borderRadius: 12,
  },
  transcriptOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  transcriptFloatingCard: {
    borderWidth: 1,
    borderRadius: 16,
  },
  transcriptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  transcriptTitle: {
    fontSize: 18,
    fontFamily: Fonts.spaceGrotesk.bold,
    // color: set dynamically
    marginBottom: 0,
  },
  transcript: {
    fontSize: 15,
    fontFamily: Fonts.spaceGrotesk.regular,
    // color: set dynamically
    lineHeight: 24,
    opacity: 0.9,
  },
  transcriptEditButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  transcriptInput: {
    minHeight: 140,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    fontFamily: Fonts.spaceGrotesk.regular,
    lineHeight: 22,
  },
  deleteLink: {
    marginTop: 24,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  deleteLinkText: {
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 15,
  },
  sheetButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  sheetPrimaryButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetSecondaryButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  sheetPrimaryButtonText: {
    fontSize: 15,
    fontFamily: Fonts.spaceGrotesk.bold,
  },
  sheetSecondaryButtonText: {
    fontSize: 15,
    fontFamily: Fonts.spaceGrotesk.bold,
  },
  sheetLinkButton: {
    marginTop: 4,
    alignItems: 'center',
    paddingVertical: 8,
  },
  sheetLinkText: {
    fontSize: 14,
    fontFamily: Fonts.spaceGrotesk.medium,
  },
  shareModalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  shareModalContent: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 20,
    padding: 24,
    gap: 16,
  },
  shareModalTitle: {
    fontSize: 20,
    fontFamily: Fonts.lora.bold,
  },
  shareModalDescription: {
    fontSize: 15,
    fontFamily: Fonts.spaceGrotesk.regular,
    lineHeight: 22,
  },
  shareMessageBox: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
  },
  shareMessageText: {
    fontSize: 16,
    fontFamily: Fonts.lora.regular,
    lineHeight: 24,
  },
  shareModalSubtitle: {
    fontSize: 16,
    fontFamily: Fonts.spaceGrotesk.bold,
  },
  shareImagePreviewContainer: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    gap: 12,
  },
  shareImagePreview: {
    width: '100%',
    height: 180,
    borderRadius: 12,
  },
  shareImageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  shareImageButtonText: {
    fontSize: 14,
    fontFamily: Fonts.spaceGrotesk.bold,
  },
  shareImageCaption: {
    fontSize: 13,
    fontFamily: Fonts.spaceGrotesk.regular,
    textAlign: 'center',
    lineHeight: 18,
  },
  shareCopyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 999,
  },
  shareCopyButtonText: {
    fontSize: 15,
    fontFamily: Fonts.spaceGrotesk.bold,
  },
  shareFeedbackText: {
    fontSize: 13,
    fontFamily: Fonts.spaceGrotesk.medium,
    textAlign: 'center',
  },
  shareCloseButton: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
  },
  shareCloseButtonText: {
    fontSize: 14,
    fontFamily: Fonts.spaceGrotesk.medium,
  },
  // Status card for unanalyzed/pending/failed dreams
  statusCard: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  statusTitle: {
    fontFamily: Fonts.lora.bold,
    fontSize: 22,
    flex: 1,
  },
  statusMessage: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
  },
  analyzeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  analyzeButtonText: {
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 16,
  },
  loadingContainer: {
    padding: 24,
    alignItems: 'center',
  },
  transcriptContainer: {
    borderTopWidth: 1,
    paddingTop: 16,
    marginTop: 8,
  },
  transcriptLabel: {
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 13,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  transcriptText: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 15,
    lineHeight: 24,
  },
  editButton: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    // backgroundColor: set dynamically
  },
  metadataTitleInput: {
    fontSize: 24,
    fontFamily: Fonts.lora.bold,
    marginBottom: 12,
    lineHeight: 32,
    borderBottomWidth: 1,
    paddingBottom: 4,
  },
  metadataValueInput: {
    fontSize: 14,
    fontFamily: Fonts.spaceGrotesk.bold,
    borderBottomWidth: 1,
    paddingBottom: 2,
    flex: 1,
  },
  chipsScroll: {
    flexGrow: 0,
  },
  chipsContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
    fontFamily: Fonts.spaceGrotesk.medium,
    textTransform: 'capitalize',
  },
  chipTextSelected: {
    fontFamily: Fonts.spaceGrotesk.bold,
  },
});
