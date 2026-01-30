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
import { GradientColors } from '@/constants/gradients';
import { DecoLines } from '@/constants/journalTheme';
import { Fonts } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useDreams } from '@/context/DreamsContext';
import { useLanguage } from '@/context/LanguageContext';
import { useTheme } from '@/context/ThemeContext';
import { useClearWebFocus } from '@/hooks/useClearWebFocus';
import { useDreamShareComposite } from '@/hooks/useDreamShareComposite';
import { useLocaleFormatting } from '@/hooks/useLocaleFormatting';
import { useQuota } from '@/hooks/useQuota';
import { useTranslation } from '@/hooks/useTranslation';
import { blurActiveElement } from '@/lib/accessibility';
import { isCategoryExplored } from '@/lib/chatCategoryUtils';
import { getDreamThemeLabel, getDreamTypeLabel } from '@/lib/dreamLabels';
import { getDreamDetailAction } from '@/lib/dreamUsage';
import { isReferenceImagesEnabled } from '@/lib/env';
import { classifyError, QuotaError, QuotaErrorCode, type ClassifiedError } from '@/lib/errors';
import { getDreamImageVersion, getImageConfig, getThumbnailUrl, withCacheBuster } from '@/lib/imageUtils';
import { getFileExtensionFromUrl, getMimeTypeFromExtension } from '@/lib/journal/shareImageUtils';
import { MotiView } from '@/lib/moti';
import { sortWithSelectionFirst } from '@/lib/sorting';
import { TID } from '@/lib/testIDs';
import type { DreamAnalysis, DreamChatCategory, DreamTheme, DreamType, ReferenceImage } from '@/lib/types';
import { categorizeDream, generateImageFromTranscript, generateImageWithReference } from '@/services/geminiService';
import { Ionicons } from '@expo/vector-icons';
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
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type TextStyle,
  type ViewStyle
} from 'react-native';

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
const IMAGE_FALLBACK_RATIO = 2 / 3;
const DREAM_IMAGE_ASPECT = 9 / 16;
const DREAM_IMAGE_CROP_EPSILON = 0.01;

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
  return (
    <MotiView
      from={{ opacity: 0.3 }}
      animate={{ opacity: 0.7 }}
      transition={{
        type: 'timing',
        duration: 800,
        loop: true,
        repeatReverse: true,
      }}
      style={[style, { backgroundColor: 'rgba(150,150,150,0.2)' }]}
    />
  );
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
  const { dreams, toggleFavorite, updateDream, deleteDream, analyzeDream } = useDreams();
  const { user } = useAuth();
  const { colors, shadows, mode } = useTheme();
  const { language } = useLanguage();
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
  const [showFloatingExploreButton, setShowFloatingExploreButton] = useState(false);
  const [isScrollViewScrollable, setIsScrollViewScrollable] = useState<boolean | null>(null);

  // Reference image generation state
  const [showReferenceSheet, setShowReferenceSheet] = useState(false);
  const [referenceSubjectType, setReferenceSubjectType] = useState<'person' | 'animal' | null>(null);
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([]);
  const [isGeneratingWithReference, setIsGeneratingWithReference] = useState(false);
  const hasBackfilledSubjectRef = useRef(false);

  useEffect(() => {
    if (isShareModalVisible) {
      blurActiveElement();
    }
  }, [isShareModalVisible]);
  const { formatDreamDate, formatDreamTime } = useLocaleFormatting();
  const { canAnalyzeNow, canAnalyze, tier, usage, loading: quotaLoading, quotaStatus } = useQuota();
  const { t } = useTranslation();
  const referenceImagesEnabled = isReferenceImagesEnabled();
  const isPremium = tier === 'premium' || tier === 'plus';
  const canGenerateImage = !quotaLoading && canAnalyzeNow && (isPremium || tier === 'guest');
  const canUseReference = referenceImagesEnabled && Boolean(user);

  const dream = useMemo(() => dreams.find((d) => d.id === dreamId), [dreams, dreamId]);
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
  const scrollMetricsRef = useRef({ layoutHeight: 0, contentHeight: 0 });
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

  const primaryAction = useMemo(() => getDreamDetailAction(dream), [dream]);
  const allThemesExplored = useMemo(() => {
    if (!dream) return false;
    return THEME_CATEGORIES.every((category) => isCategoryExplored(dream.chatHistory, category));
  }, [dream]);
  const exploreButtonLabel = useMemo(() => {
    if (primaryAction === 'analyze') {
      return t('journal.detail.analyze_button.default');
    }
    if (primaryAction === 'continue') {
      return t('journal.detail.explore_button.continue');
    }
    return t('journal.detail.explore_button.new');
  }, [primaryAction, t]);
  const isPrimaryActionBusy = primaryAction === 'analyze' && (isAnalyzing || dream?.analysisStatus === 'pending');
  const isAnalysisLocked = !!dream && (dream.analysisStatus === 'pending' || isAnalyzing);
  const isAnalysisPending = dream?.analysisStatus === 'pending';
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

  const updateScrollability = useCallback(() => {
    const { layoutHeight, contentHeight } = scrollMetricsRef.current;
    if (!layoutHeight || !contentHeight) return;
    const scrollable = contentHeight - layoutHeight > 8;
    setIsScrollViewScrollable((prev) => (prev === scrollable ? prev : scrollable));
  }, []);

  const handleScrollViewLayout = useCallback((event: LayoutChangeEvent) => {
    scrollMetricsRef.current.layoutHeight = event.nativeEvent.layout.height;
    updateScrollability();
  }, [updateScrollability]);

  const handleScrollContentSizeChange = useCallback((_width: number, height: number) => {
    scrollMetricsRef.current.contentHeight = height;
    updateScrollability();
  }, [updateScrollability]);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const scrollY = event.nativeEvent.contentOffset.y;
    const threshold = 200;
    setShowFloatingExploreButton(scrollY > threshold);
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

      const imageUrl = await generateImageFromTranscript(sourceText, dream.imageUrl);
      const thumbnailUrl = imageUrl ? getThumbnailUrl(imageUrl) : undefined;

      const imageUpdatedAt = Date.now();
      const analysisRequestId = generateUUID();
      const updatedDream: DreamAnalysis = {
        ...dream,
        imageUrl,
        thumbnailUrl,
        imageGenerationFailed: false,
        imageUpdatedAt,
        analysisRequestId,
        imageSource: 'ai',
      };

      await updateDream(updatedDream);
    } catch (error) {
      const msg = error instanceof Error ? error.message : t('common.unknown_error');
      setImageErrorMessage(msg);
    } finally {
      setIsRetryingImage(false);
    }
  }, [canAnalyzeNow, dream, isAnalysisLocked, updateDream, t]);

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
        if (isPremium) return false;
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
  }, [canAnalyze, canAnalyzeNow, isPremium, quotaStatus?.isUpgraded, showAnalysisNotice, t, user]);

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
      router.push('/paywall');
    }
  }, [quotaSheetMode, tier]);

  const handleQuotaLimitSecondary = useCallback(() => {
    setShowQuotaLimitSheet(false);
    router.push('/(tabs)/journal');
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
        await analyzeDream(dream.id, dream.transcript, { replaceExistingImage: replaceImage, lang: language });
        setAnalysisNotice(null);
      } catch (error) {
        if (error instanceof QuotaError) {
          if (error.code === QuotaErrorCode.LOGIN_REQUIRED && tier === 'guest') {
            setQuotaSheetMode('login');
            setShowQuotaLimitSheet(true);
            return;
          }
          // Show quota limit sheet with upgrade CTA for non-paid users
          if (!isPremium) {
            setQuotaSheetMode('quota');
            setShowQuotaLimitSheet(true);
          } else {
            // Premium users should never hit quota errors, but show a notice if they do
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
    [analyzeDream, dream, ensureAnalyzeAllowed, isPremium, language, showAnalysisNotice, t, tier]
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

  const gradientColors = mode === 'dark'
    ? GradientColors.dreamJournal
    : ([colors.backgroundSecondary, colors.backgroundDark] as const);
  const displayedAnalysisNotice = analysisNotice ?? lastAnalysisNoticeRef.current;

  const keyboardBehavior: 'padding' | 'height' | undefined = Platform.select({
    ios: 'padding',
    android: 'height',
    default: undefined,
  });
  const keyboardVerticalOffset = Platform.select({ ios: 0, android: 0, web: 0 }) ?? 0;
  const shouldHideHeroMedia = isKeyboardVisible && (isEditing || isEditingTranscript);
  const transcriptBackgroundColor = mode === 'dark'
    ? 'rgba(19, 16, 34, 0.3)'
    : 'rgba(0, 0, 0, 0.03)';
  const floatingTranscriptBottom = Platform.OS === 'ios' ? 32 : 24;
  const shouldShowFloatingExploreButton = showFloatingExploreButton || isScrollViewScrollable === false;

  // Use a single surface color for the main content card and its inner accent cards/buttons
  // so we don't get a darker band/padding effect on Android where slight
  // alpha tints can look like a different background.
  const accentSurfaceBorderColor =
    mode === 'dark'
      ? 'rgba(207, 207, 234, 0.2)'
      : 'rgba(212, 165, 116, 0.3)';

  if (!dream) {
    return (
      <KeyboardAvoidingView
        style={styles.keyboardAvoiding}
        behavior={keyboardBehavior}
        keyboardVerticalOffset={keyboardVerticalOffset}
      >
        <LinearGradient colors={gradientColors} style={styles.container}>
          <Text style={{ color: colors.textPrimary, fontSize: 18 }}>
            {t('journal.detail.not_found.title')}
          </Text>
          <Pressable onPress={handleBackPress} style={[styles.backButton, { backgroundColor: colors.accent }]}>
            <Text style={[styles.backButtonText, { color: colors.textPrimary }]}>
              {t('journal.detail.not_found.back')}
            </Text>
          </Pressable>
        </LinearGradient>
      </KeyboardAvoidingView>
    );
  }

  const renderTranscriptBody = () => (
    <MotiView
      testID={TID.Component.TranscriptCard}
      animate={{
        borderColor: isEditingTranscript ? colors.accent : 'transparent',
        borderWidth: isEditingTranscript ? 2 : 0,
        opacity: isEditingTranscript ? [0.8, 1, 0.8] : 1,
      }}
      transition={{
        type: 'timing',
        duration: 1800,
        loop: true,
      }}
      style={[
        styles.transcript,
        {
          borderColor: 'transparent',
        }
      ]}
    >
      <View style={styles.transcriptHeader}>
        <Text style={[styles.transcriptTitle, { color: colors.textPrimary }]}>
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
              backgroundColor: isEditingTranscript ? colors.accent : 'transparent',
              borderColor: colors.divider,
            },
          ]}
          hitSlop={8}
        >
          <MotiView
            animate={{
              scale: isEditingTranscript ? [1, 1.15, 1] : 1,
            }}
            transition={{
              type: 'timing',
              duration: 1800,
              loop: true,
            }}
          >
            <Ionicons
              name={isEditingTranscript ? 'checkmark' : 'pencil'}
              size={18}
              color={isEditingTranscript ? colors.textPrimary : colors.textSecondary}
            />
          </MotiView>
        </Pressable>
      </View>
      {isEditingTranscript ? (
        <TextInput
          testID={TID.Input.DreamTranscript}
          style={[styles.transcriptInput, {
            color: colors.textPrimary,
            borderColor: colors.divider,
            backgroundColor: colors.backgroundSecondary,
          }]}
          multiline
          value={editableTranscript}
          onChangeText={setEditableTranscript}
          placeholder={t('journal.transcript.placeholder') || 'Edit transcript...'}
          accessibilityLabel={t('journal.transcript.placeholder') || 'Edit transcript...'}
          placeholderTextColor={colors.textSecondary}
          textAlignVertical="top"
          autoFocus
        />
      ) : (
        <Text style={[styles.transcript, { color: colors.textSecondary }]}>{dream.transcript}</Text>
      )}
    </MotiView>
  );

  const renderMetadataCard = (variant: 'inline' | 'floating' = 'inline') => (
    <MotiView
      testID={TID.Component.MetadataCard}
      animate={{
        borderColor: isEditing ? colors.accent : (variant === 'floating' ? colors.divider : accentSurfaceBorderColor),
        borderWidth: isEditing ? 2 : (variant === 'floating' ? 1 : 0),
        opacity: isEditing ? [0.8, 1, 0.8] : 1,
      }}
      transition={{
        type: 'timing',
        duration: 1800,
        loop: true,
      }}
      style={[
        styles.metadataCard,
        variant === 'floating' && styles.metadataFloatingCard,
        variant === 'floating' ? shadows.xl : shadows.md,
        {
          backgroundColor: colors.backgroundCard,
          borderColor: variant === 'floating' ? colors.divider : accentSurfaceBorderColor,
          // Keep room for the floating edit/check button so it doesn't overlap chips
          paddingBottom: isEditing ? 64 : 20,
        },
      ]}
    >
      <View style={styles.metadataHeader}>
        <View style={styles.dateContainer}>
          <Ionicons name="calendar-outline" size={16} color={colors.textOnAccentSurface} />
          <Text style={[styles.dateText, { color: colors.textOnAccentSurface }]}>{formatDreamDate(dream.id)}</Text>
        </View>
        <View style={styles.timeContainer}>
          <Ionicons name="time-outline" size={16} color={colors.textOnAccentSurface} />
          <Text style={[styles.timeText, { color: colors.textOnAccentSurface }]}>{formatDreamTime(dream.id)}</Text>
        </View>
      </View>
      <View style={[styles.divider, { backgroundColor: colors.divider }]} />

      {isEditing ? (
        <TextInput
          testID={TID.Input.DreamTitle}
          nativeID={TID.Input.DreamTitle}
          style={[styles.metadataTitleInput, { color: colors.textPrimary, borderColor: colors.divider }]}
          selectTextOnFocus
          value={editableTitle}
          onChangeText={setEditableTitle}
          placeholder={t('journal.detail.title_placeholder')}
          accessibilityLabel={t('journal.detail.title_placeholder')}
          placeholderTextColor={colors.textSecondary}
        />
      ) : (
        <Text style={[styles.metadataTitle, { color: colors.textPrimary }]}>
          {dream.title || t('journal.detail.untitled_dream')}
        </Text>
      )}

      {(isEditing || dream.dreamType) && (
        <View style={[styles.metadataRow, isEditing && { alignItems: 'flex-start' }]}
        >
          <Ionicons name="moon-outline" size={18} color={colors.textPrimary} style={{ marginTop: isEditing ? 4 : 0 }} />
          <Text style={[styles.metadataLabel, { color: colors.textPrimary, marginTop: isEditing ? 4 : 0 }]}>{t('journal.detail.dream_type_label')}</Text>
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
                        { borderColor: colors.divider },
                        editableDreamType === type && { backgroundColor: colors.accent, borderColor: colors.accent }
                      ]}
                    >
                      <Text style={[
                        styles.chipText,
                        { color: colors.textPrimary },
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
            <Text style={[styles.metadataValue, { color: colors.textPrimary, flex: 1 }]}>
              {dreamTypeLabel || dream.dreamType}
            </Text>
          )}
        </View>
      )}

      <View style={[styles.metadataRow, isEditing && { alignItems: 'flex-start' }]}>
        <Ionicons name="color-palette-outline" size={18} color={colors.textPrimary} style={{ marginTop: isEditing ? 4 : 0 }} />
        <Text style={[styles.metadataLabel, { color: colors.textPrimary, marginTop: isEditing ? 4 : 0 }]}>{t('journal.detail.theme_label')}</Text>
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
                      { borderColor: colors.divider },
                      editableTheme === theme && { backgroundColor: colors.accent, borderColor: colors.accent }
                    ]}
                  >
                    <Text style={[
                      styles.chipText,
                      { color: colors.textPrimary },
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
          <Text style={[styles.metadataValue, { color: colors.textPrimary, flex: 1 }]}>
            {dreamThemeLabel || t('journal.detail.theme_placeholder')}
          </Text>
        )}
      </View>

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
            backgroundColor: isEditing ? colors.accent : colors.backgroundSecondary,
          },
        ]}
        hitSlop={8}
      >
        <MotiView
          animate={{
            scale: isEditing ? [1, 1.15, 1] : 1,
          }}
          transition={{
            type: 'timing',
            duration: 1800,
            loop: true,
          }}
        >
          <Ionicons
            name={isEditing ? 'checkmark' : 'pencil'}
            size={16}
            color={isEditing ? colors.textPrimary : colors.textSecondary}
          />
        </MotiView>
      </Pressable>
    </MotiView>
  );

  return (
    <KeyboardAvoidingView
      style={styles.keyboardAvoiding}
      behavior={keyboardBehavior}
      keyboardVerticalOffset={keyboardVerticalOffset}
    >
      <LinearGradient colors={gradientColors} style={styles.gradient}>
        <Pressable
          onPress={handleBackPress}
          style={[styles.floatingBackButton, shadows.lg, {
            backgroundColor: mode === 'dark' ? 'rgba(35, 26, 63, 0.85)' : colors.backgroundCard,
            borderWidth: 1,
            borderColor: mode === 'dark' ? 'rgba(160, 151, 184, 0.25)' : colors.divider,
          }]}
          testID={TID.Button.NavigateJournal}
          accessibilityRole="button"
          accessibilityLabel={t('journal.back_button')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: (isEditing || isEditingTranscript) ? 220 : 100 },
          ]}
          keyboardShouldPersistTaps="handled"
          onLayout={handleScrollViewLayout}
          onContentSizeChange={handleScrollContentSizeChange}
          onScroll={handleScroll}
          scrollEventThrottle={16}
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
                    <View style={styles.imageOverlay} />
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
                          backgroundColor: colors.backgroundSecondary,
                          borderColor: colors.divider,
                        },
                      ]}
                    >
                      <Ionicons name="image-outline" size={64} color={colors.textSecondary} />
                      <Text style={[styles.imagePlaceholderTitle, { color: colors.textPrimary }]}>
                        {t('journal.detail.image.generation_failed')}
                      </Text>
                      <Text style={[styles.imagePlaceholderSubtitle, { color: colors.textSecondary }]}>
                        {t('journal.detail.image.quota_exceeded_message')}
                      </Text>
                    </View>
                  )
                ) : dream.analysisStatus === 'pending' ? (
                  <Skeleton style={{ width: '100%', height: '100%' }} />
                ) : (
                  <View
                    style={[
                      styles.dreamImage,
                      styles.imagePlaceholderCard,
                      {
                        backgroundColor: colors.backgroundSecondary,
                        borderColor: colors.divider,
                      },
                    ]}
                  >
                    <Ionicons name="image-outline" size={32} color={colors.textSecondary} />
                    <Text style={[styles.imagePlaceholderTitle, { color: colors.textPrimary }]}>
                      {t('journal.detail.image.no_image_title')}
                    </Text>
                    <Text style={[styles.imagePlaceholderSubtitle, { color: colors.textSecondary }]}>
                      {t('journal.detail.image.no_image_subtitle')}
                    </Text>
                    {!isRetryingImage && !isAnalysisLocked && (
                      <View style={styles.imageActionsColumn}>
                        {canGenerateImage && (
                          <>
                            <Pressable
                              onPress={onRetryImage}
                              disabled={isRetryingImage || isAnalysisLocked}
                              style={[
                                styles.imageActionButton,
                                shadows.md,
                                { backgroundColor: colors.accent },
                                (isRetryingImage || isAnalysisLocked) && styles.imageActionButtonDisabled,
                              ]}
                            >
                              <Ionicons name="refresh" size={18} color={colors.textPrimary} />
                              <Text style={[styles.imageActionText, { color: colors.textPrimary }]}>
                                {t('journal.detail.image.generate_action')}
                              </Text>
                            </Pressable>

                            <Text style={[styles.imageOrText, { color: colors.textSecondary }]}>
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
                              borderColor: colors.divider,
                            },
                            (isPickingImage || isAnalysisLocked) && styles.imageActionButtonDisabled,
                          ]}
                        >
                          {isPickingImage ? (
                            <ActivityIndicator color={colors.textPrimary} />
                          ) : (
                            <Ionicons name="image-outline" size={18} color={colors.textPrimary} />
                          )}
                          <Text style={[styles.imageActionText, { color: colors.textPrimary }]}>
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
                  <View style={[styles.imageLoadingOverlay, { backgroundColor: colors.overlay }]}>
                    <ActivityIndicator color={colors.textPrimary} />
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Image Top Vignette */}
          {!shouldHideHeroMedia && (
            <LinearGradient
              colors={['rgba(19, 16, 34, 0.3)', 'transparent']}
              style={styles.imageTopVignette}
              pointerEvents="none"
            />
          )}

          {/* Content Card - Overlaps image */}
          <MotiView
            from={{ opacity: 0, translateY: 40 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 700, delay: 200 }}
          >
            <View style={[styles.contentCard, shadows.xl, { backgroundColor: colors.backgroundCard }]}>

            {/* Premium Metadata Card */}
            {!isEditing && renderMetadataCard()}

            {(dream.isAnalyzed || isAnalysisPending) && (
              <>
                {/* Quote */}
                {isAnalysisPending ? (
                  <Skeleton style={{ height: 60, width: '100%', borderRadius: 8 }} />
                ) : dream.shareableQuote ? (
                  <FlatGlassCard style={styles.quoteBoxGlass} animationDelay={450}>
                    <Ionicons
                      name="chatbox-ellipses"
                      size={28}
                      color={colors.accent}
                      style={styles.quoteIcon}
                    />
                    <Text style={[styles.quote, { color: colors.textPrimary }]}>
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
                      <Text style={[styles.sectionHeaderText, { color: colors.accent }]}>
                        {t('journal.detail.interpretation_header')}
                      </Text>
                      <View style={[DecoLines.rule, { backgroundColor: colors.accent, marginTop: 8 }]} />
                    </View>
                    <TypewriterText
                      text={dream.interpretation}
                      style={[styles.interpretation, { color: colors.textSecondary }]}
                      shouldAnimate={false}
                    />
                  </>
                ) : null}
              </>
            )}

            {/* Additional Actions */}
            {(!dream.isAnalyzed || dream.analysisStatus !== 'done') && !isAnalysisLocked && (
              <Pressable
                onPress={handleAnalyze}
                disabled={isAnalyzing || dream.analysisStatus === 'pending'}
                style={[styles.analyzeButton, shadows.md, { backgroundColor: colors.accent }]}
              >
                {isAnalyzing || dream.analysisStatus === 'pending' ? (
                  <ActivityIndicator color={colors.textPrimary} />
                ) : (
                  <>
                    <Ionicons name="sparkles-outline" size={20} color={colors.textPrimary} />
                    <Text style={[styles.analyzeButtonText, { color: colors.textPrimary }]}
                    >
                      {dream.analysisStatus === 'failed'
                        ? t('journal.detail.analyze_button.retry')
                        : t('journal.detail.analyze_button.default')}
                    </Text>
                  </>
                )}
              </Pressable>
            )}

            {!shouldShowFloatingExploreButton &&
              !isEditing &&
              !isEditingTranscript &&
              primaryAction !== 'analyze' &&
              (dream.analysisStatus === 'done' || (dream.interpretation && dream.imageUrl)) && (
              <Pressable
                testID={TID.Button.ExploreDream}
                onPress={handleExplorePress}
                disabled={isAnalysisLocked}
                style={[styles.exploreButton, shadows.md, {
                  backgroundColor: colors.accent,
                  borderColor: mode === 'dark' ? 'rgba(140, 158, 255, 0.3)' : 'rgba(212, 165, 116, 0.3)',
                  opacity: isAnalysisLocked ? 0.8 : 1,
                }]}
              >
                <MotiView
                  from={{ rotate: '-10deg' }}
                  animate={{ rotate: '10deg' }}
                  transition={{ type: 'timing', duration: 2000, loop: true, repeatReverse: true }}
                >
                  <Ionicons name="sparkles" size={24} color={colors.textPrimary} />
                </MotiView>
                <Text style={[styles.exploreButtonText, { color: colors.textPrimary }]}>{exploreButtonLabel}</Text>
              </Pressable>
            )}

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
                    backgroundColor: colors.backgroundCard,
                    borderColor: accentSurfaceBorderColor,
                    opacity: isAnalysisLocked ? 0.6 : 1,
                  },
                ]}
              >
                <Ionicons
                  name={dream.isFavorite ? 'heart' : 'heart-outline'}
                  size={24}
                  color={dream.isFavorite ? '#F59E0B' : colors.textPrimary}
                />
                <Text style={[styles.actionButtonText, { color: colors.textPrimary }]}
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
                    backgroundColor: colors.backgroundCard,
                    borderColor: accentSurfaceBorderColor,
                    opacity: isSharing || isAnalysisLocked ? 0.7 : 1,
                  },
                ]}
              >
                {isSharing ? (
                  <ActivityIndicator size="small" color={colors.textOnAccentSurface} />
                ) : (
                  <Ionicons name="share-outline" size={24} color={colors.textOnAccentSurface} />
                )}
                <Text style={[styles.actionButtonText, { color: colors.textOnAccentSurface }]}
                >
                  {isSharing
                    ? t('journal.detail.share.button_loading')
                    : t('journal.detail.share.button_default')}
                </Text>
              </Pressable>
            </View>

            {/* Transcript Section */}
            {!isEditingTranscript && (
              <View
                style={[styles.transcriptSection, {
                  borderTopColor: colors.divider,
                  backgroundColor: transcriptBackgroundColor,
                }]}
                onLayout={(event) => setTranscriptSectionOffset(event.nativeEvent.layout.y)}
              >
                {renderTranscriptBody()}
              </View>
            )}

            <Pressable
              onPress={onDelete}
              style={styles.deleteLink}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="link"
              testID={TID.Button.DreamDelete}
              accessibilityLabel="Delete dream"
            >
              <Ionicons name="trash-outline" size={18} color="#EF4444" />
              <Text style={styles.deleteLinkText}>{t('journal.menu.delete')}</Text>
            </Pressable>
            </View>
          </MotiView>
        </ScrollView>

        {/* Floating Explore/Analyze Button */}
        {shouldShowFloatingExploreButton &&
          !isEditing &&
          !isEditingTranscript &&
          (dream.analysisStatus === 'done' || (dream.interpretation && dream.imageUrl)) && (
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            exit={{ opacity: 0, translateY: 20 }}
            transition={{ type: 'timing', duration: 250 }}
            style={[styles.floatingExploreButton, shadows.xl]}
          >
            <Pressable
              testID={`${TID.Button.ExploreDream}-floating`}
              onPress={primaryAction === 'analyze' ? handleAnalyze : handleExplorePress}
              disabled={isPrimaryActionBusy || isAnalysisLocked}
              style={[styles.exploreButton, {
                backgroundColor: colors.accent,
                borderColor: mode === 'dark' ? 'rgba(140, 158, 255, 0.3)' : 'rgba(212, 165, 116, 0.3)',
                marginTop: 0,
                marginBottom: 0,
                opacity: isPrimaryActionBusy || isAnalysisLocked ? 0.8 : 1,
              }]}
            >
              {isPrimaryActionBusy ? (
                <ActivityIndicator color={colors.textPrimary} />
              ) : (
                <MotiView
                  from={{ rotate: '-10deg' }}
                  animate={{ rotate: '10deg' }}
                  transition={{ type: 'timing', duration: 2000, loop: true, repeatReverse: true }}
                >
                  <Ionicons name="sparkles" size={24} color={colors.textPrimary} />
                </MotiView>
              )}
              <Text style={[styles.exploreButtonText, { color: colors.textPrimary }]}>{exploreButtonLabel}</Text>
            </Pressable>
          </MotiView>
        )}

        {isEditing && (
          <View
            style={[
              styles.metadataOverlay,
              { backgroundColor: colors.overlay },
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
                        backgroundColor: colors.backgroundCard,
                        borderColor: colors.divider,
                      },
                      (isPickingImage || isAnalysisLocked) && styles.imageActionButtonDisabled,
                    ]}
                  >
                    {isPickingImage ? (
                      <ActivityIndicator color={colors.textPrimary} />
                    ) : (
                      <Ionicons name="image-outline" size={18} color={colors.textPrimary} />
                    )}
                    <Text style={[styles.imageEditButtonText, { color: colors.textPrimary }]}>
                      {isPickingImage
                        ? t('journal.detail.image.adding_from_library')
                        : t('journal.detail.image.replace_user_button')}
                    </Text>
                  </Pressable>
                ) : (
                  <Text style={[styles.imageEditNote, { color: colors.textSecondary }]}>
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
              { backgroundColor: colors.overlay },
              styles.pointerAuto,
            ]}
          >
            <View
              style={[
                styles.transcriptSection,
                styles.transcriptFloatingCard,
                shadows.xl,
                {
                  backgroundColor: colors.backgroundCard,
                  borderColor: colors.divider,
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
          <View style={styles.shareModalOverlay}>
            <Pressable style={StyleSheet.absoluteFill} onPress={closeShareModal} />
            <View style={[styles.shareModalContent, { backgroundColor: colors.backgroundCard }]}
            >
              <Text style={[styles.shareModalTitle, { color: colors.textPrimary }]}>
                {t('journal.detail.share_modal.title')}
              </Text>
              <Text style={[styles.shareModalDescription, { color: colors.textSecondary }]}
              >
                {clipboardSupported
                  ? t('journal.detail.share_modal.description.clipboard')
                  : t('journal.detail.share_modal.description.manual')}
              </Text>
              <View
                style={[
                  styles.shareMessageBox,
                  { backgroundColor: colors.backgroundSecondary, borderColor: colors.divider },
                ]}
              >
                <Text selectable style={[styles.shareMessageText, { color: colors.textPrimary }]}
                >
                  {shareMessage || t('journal.detail.share_modal.empty')}
                </Text>
              </View>
              {clipboardSupported && (
                <Pressable
                  style={[styles.shareCopyButton, { backgroundColor: colors.accent }]}
                  onPress={handleCopyShareText}
                  testID={TID.Button.ShareCopy}
                  accessibilityLabel="Copy share text"
                >
                  <Ionicons
                    name={shareCopyStatus === 'success' ? 'checkmark' : 'copy-outline'}
                    size={18}
                    color={colors.textPrimary}
                  />
                  <Text style={[styles.shareCopyButtonText, { color: colors.textPrimary }]}
                  >
                    {shareCopyStatus === 'success'
                      ? t('journal.detail.share_modal.copied')
                      : t('journal.detail.share_modal.copy')}
                  </Text>
                </Pressable>
              )}
              {shareCopyStatus === 'error' && (
                <Text style={[styles.shareFeedbackText, { color: '#EF4444' }]}
                >
                  {t('journal.detail.share_modal.copy_failed')}
                </Text>
              )}
              <Pressable
                style={[styles.shareCloseButton, { borderColor: colors.divider }]}
                onPress={closeShareModal}
                testID={TID.Button.ShareClose}
                accessibilityLabel="Close share modal"
              >
                <Text style={[styles.shareCloseButtonText, { color: colors.textSecondary }]}
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
            <DreamShareImage ref={shareImageRef} dream={dream} isPremium={isPremium} t={t} />
          </View>
        )}
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardAvoiding: {
    flex: 1,
  },
  gradient: {
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
    letterSpacing: 0.2,
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
    backgroundColor: 'rgba(140, 158, 255, 0.05)',
  },
  imageLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
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
  // Premium Metadata Card with Glassmorphism
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
    fontSize: 13,
    fontFamily: Fonts.spaceGrotesk.medium,
    // color: set dynamically
    letterSpacing: 0.3,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timeText: {
    fontSize: 13,
    fontFamily: Fonts.spaceGrotesk.medium,
    // color: set dynamically
    letterSpacing: 0.3,
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
    ...StyleSheet.absoluteFillObject,
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
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  imageTopVignette: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 100,
    zIndex: 1,
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
  floatingExploreButton: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    zIndex: 100,
  },
  exploreButtonText: {
    fontSize: 17,
    fontFamily: Fonts.fraunces.medium,
    // color: set dynamically
    letterSpacing: 0.5,
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
    paddingTop: 24,
    paddingHorizontal: 16,

    paddingBottom: 16,
    borderTopWidth: 1,
    // borderTopColor and backgroundColor: set dynamically
    borderRadius: 12,
  },
  transcriptOverlay: {
    ...StyleSheet.absoluteFillObject,
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
    color: '#EF4444',
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 15,
    letterSpacing: 0.3,
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
    letterSpacing: 0.4,
  },
  sheetSecondaryButtonText: {
    fontSize: 15,
    fontFamily: Fonts.spaceGrotesk.bold,
    letterSpacing: 0.4,
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
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
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
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
    letterSpacing: 0.5,
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
    letterSpacing: 1,
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
