import { ImageRetry } from '@/components/journal/ImageRetry';
import { GradientColors } from '@/constants/gradients';
import { Fonts } from '@/constants/theme';
import { useDreams } from '@/context/DreamsContext';
import { useTheme } from '@/context/ThemeContext';
import { useClearWebFocus } from '@/hooks/useClearWebFocus';
import { useLocaleFormatting } from '@/hooks/useLocaleFormatting';
import { useQuota } from '@/hooks/useQuota';
import { useTranslation } from '@/hooks/useTranslation';
import { blurActiveElement } from '@/lib/accessibility';
import { isDreamExplored } from '@/lib/dreamUsage';
import { getDreamThemeLabel, getDreamTypeLabel } from '@/lib/dreamLabels';
import { QuotaError } from '@/lib/errors';
import { getImageConfig } from '@/lib/imageUtils';
import { sortWithSelectionFirst } from '@/lib/sorting';
import { TID } from '@/lib/testIDs';
import type { DreamAnalysis, DreamTheme, DreamType } from '@/lib/types';
import { generateImageForDream } from '@/services/geminiService';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Easing,
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

const SHARE_IMAGE_FALLBACK_EXTENSION = 'jpg';

const getFileExtensionFromUrl = (url?: string): string => {
  if (!url) return SHARE_IMAGE_FALLBACK_EXTENSION;
  const cleanUrl = url.split('?')[0] ?? '';
  const match = cleanUrl.match(/\.([a-z0-9]+)$/i);
  if (!match) return SHARE_IMAGE_FALLBACK_EXTENSION;
  const ext = match[1].toLowerCase();
  if (ext === 'jpeg') return 'jpg';
  return ext;
};

const getMimeTypeFromExtension = (ext: string): string => {
  switch (ext) {
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'jpg':
    default:
    return 'image/jpeg';
  }
};

const DREAM_TYPES: DreamType[] = ['Lucid Dream', 'Recurring Dream', 'Nightmare', 'Symbolic Dream'];
const DREAM_THEMES: DreamTheme[] = ['surreal', 'mystical', 'calm', 'noir'];
const nativeDriver = Platform.OS !== 'web';

const Skeleton = ({ style }: { style: any }) => {
  const opacity = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 800, useNativeDriver: nativeDriver }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: nativeDriver }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);
  return <Animated.View style={[style, { opacity, backgroundColor: 'rgba(150,150,150,0.2)' }]} />;
};

const TypewriterText = ({ text, style, shouldAnimate }: { text: string; style: any; shouldAnimate: boolean }) => {
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
  const { colors, shadows, mode } = useTheme();
  useClearWebFocus();
  const [isRetryingImage, setIsRetryingImage] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isShareModalVisible, setShareModalVisible] = useState(false);
  const [shareCopyStatus, setShareCopyStatus] = useState<'idle' | 'success' | 'error'>('idle');
  useEffect(() => {
    if (isShareModalVisible) {
      blurActiveElement();
    }
  }, [isShareModalVisible]);
  const { formatDreamDate, formatDreamTime } = useLocaleFormatting();
  const { canAnalyzeNow } = useQuota();
  const { t } = useTranslation();

  const dream = useMemo(() => dreams.find((d) => d.id === dreamId), [dreams, dreamId]);
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
  const metadataPulse = useRef(new Animated.Value(0)).current;
  const transcriptPulse = useRef(new Animated.Value(0)).current;

  const sortedDreamTypes = useMemo(() => {
    return sortWithSelectionFirst(DREAM_TYPES, dream?.dreamType);
  }, [dream?.dreamType]);

  const sortedDreamThemes = useMemo(() => {
    return sortWithSelectionFirst(DREAM_THEMES, dream?.theme);
  }, [dream?.theme]);

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

  useEffect(() => {
    if (!isEditingTranscript || !scrollViewRef.current) {
      return;
    }
    requestAnimationFrame(() => {
      scrollViewRef.current?.scrollTo({ y: Math.max(transcriptSectionOffset - 32, 0), animated: true });
    });
  }, [isEditingTranscript, transcriptSectionOffset]);

  useEffect(() => {
    let animation: Animated.CompositeAnimation | undefined;
    if (isEditing) {
      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(metadataPulse, {
            toValue: 1,
            duration: 900,
            easing: Easing.out(Easing.quad),
            useNativeDriver: nativeDriver,
          }),
          Animated.timing(metadataPulse, {
            toValue: 0,
            duration: 900,
            easing: Easing.in(Easing.quad),
            useNativeDriver: nativeDriver,
          }),
        ]),
      );
      animation.start();
    } else {
      metadataPulse.stopAnimation();
      metadataPulse.setValue(0);
    }
    return () => {
      animation?.stop();
    };
  }, [isEditing, metadataPulse]);

  useEffect(() => {
    let animation: Animated.CompositeAnimation | undefined;
    if (isEditingTranscript) {
      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(transcriptPulse, {
            toValue: 1,
            duration: 900,
            easing: Easing.out(Easing.quad),
            useNativeDriver: nativeDriver,
          }),
          Animated.timing(transcriptPulse, {
            toValue: 0,
            duration: 900,
            easing: Easing.in(Easing.quad),
            useNativeDriver: nativeDriver,
          }),
        ]),
      );
      animation.start();
    } else {
      transcriptPulse.stopAnimation();
      transcriptPulse.setValue(0);
    }
    return () => {
      animation?.stop();
    };
  }, [isEditingTranscript, transcriptPulse]);

  const hasExistingChat = useMemo(() => {
    if (!dream) {
      return false;
    }
    if (isDreamExplored(dream)) {
      return true;
    }
    return dream.chatHistory.some((message) => message.role === 'model');
  }, [dream]);
  const exploreButtonLabel = hasExistingChat
    ? t('journal.detail.explore_button.continue')
    : t('journal.detail.explore_button.new');
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
    setIsEditingTranscript(false);
    setIsEditing(true);
  }, []);

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
    if (!dream) return;

    try {
      setIsPickingImage(true);
      const ImagePicker = await import('expo-image-picker');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: Platform.OS !== 'web',
        aspect: Platform.OS !== 'web' ? [2, 3] : undefined,
        quality: 0.9,
        base64: Platform.OS === 'web',
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      const asset = result.assets[0];
      if (!asset) {
        return;
      }

      const selectedUri = Platform.OS === 'web' && asset.base64
        ? `data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}`
        : asset.uri;

      if (!selectedUri) {
        return;
      }

      const updatedDream = {
        ...dream,
        imageUrl: selectedUri,
        thumbnailUrl: selectedUri,
        imageGenerationFailed: false,
      };

      await updateDream(updatedDream);
    } catch (error) {
      const msg = error instanceof Error ? error.message : t('common.unknown_error');
      Alert.alert(t('common.error_title'), msg);
    } finally {
      setIsPickingImage(false);
    }
  }, [dream, updateDream, t]);

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

  const getShareableImageUri = useCallback(async () => {
    if (!shareImage) {
      // If getInfo fails, we'll re-download the file.
      return undefined;
    }
    return shareImage.source;
  }, [shareImage]);

  // Define callbacks before early return (hooks must be called unconditionally)
  const onShare = useCallback(async () => {
    if (!dream) return;
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

      let localImageUri: string | undefined;
      if (shareImage) {
        localImageUri = await getShareableImageUri();
      }

      const sharePayload: {
        message: string;
        title?: string;
        url?: string;
      } = {
        message: shareMessage,
        title: shareTitle,
      };

      if (localImageUri) {
        sharePayload.url = localImageUri;
      }

      await Share.share(sharePayload);
      return;
    } catch {
      if (Platform.OS === 'web') {
        openShareModal();
      } else {
        Alert.alert(t('common.error_title'), t('journal.detail.share.error_message'));
      }
    } finally {
      setIsSharing(false);
    }
  }, [dream, shareImage, shareMessage, shareTitle, openShareModal, getShareableImageUri, t]);

  const deleteAndNavigate = useCallback(async () => {
    if (!dream) return;
    await deleteDream(dream.id);
    router.replace('/(tabs)/journal');
  }, [dream, deleteDream]);

  const onDelete = useCallback(() => {
    if (!dream) return;
    const confirmMessage = t('journal.detail.delete_confirm.message');

    if (Platform.OS === 'web') {
      const confirmed =
        typeof window !== 'undefined' ? window.confirm(confirmMessage) : false;
      if (confirmed) {
        void deleteAndNavigate();
      }
      return;
    }

    Alert.alert(
      t('journal.detail.delete_confirm.title'),
      confirmMessage,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('journal.detail.delete_confirm.confirm'),
          style: 'destructive',
          onPress: () => {
            void deleteAndNavigate();
          },
        },
      ],
    );
  }, [dream, deleteAndNavigate, t]);

  const onRetryImage = useCallback(async () => {
    if (!dream) return;

    setIsRetryingImage(true);
    try {
      // Get the image prompt from the dream's analysis
      // We need to reconstruct it or store it - for now we'll use a generic approach
      // In a real scenario, you'd want to store the imagePrompt in the DreamAnalysis type
      const imageUrl = await generateImageForDream(dream.interpretation);

      // Update the dream with the new image
      const updatedDream = {
        ...dream,
        imageUrl,
        imageGenerationFailed: false,
      };

      await updateDream(updatedDream);
      Alert.alert(t('common.success'), t('journal.detail.image.success_message'));
    } catch (error) {
      const msg = error instanceof Error ? error.message : t('common.unknown_error');
      Alert.alert(t('common.error_title'), msg);
    } finally {
      setIsRetryingImage(false);
    }
  }, [dream, updateDream, t]);

  const handleBackPress = useCallback(() => {
    router.replace('/(tabs)/journal');
  }, []);

  const handleExplorePress = useCallback(() => {
    if (!dream) return;
    if (hasExistingChat) {
      router.push(`/dream-chat/${dream.id}`);
      return;
    }
    router.push(`/dream-categories/${dream.id}`);
  }, [dream, hasExistingChat]);

  const handleAnalyze = useCallback(async () => {
    if (!dream) return;

    // Check quota
    if (!canAnalyzeNow) {
      Alert.alert(
        t('journal.detail.analysis_limit.title'),
        t('journal.detail.analysis_limit.message'),
        [{ text: t('common.ok') }],
      );
      return;
    }

    setIsAnalyzing(true);
    try {
      await analyzeDream(dream.id, dream.transcript);
      Alert.alert(t('common.success'), t('journal.detail.analysis.success_message'));
    } catch (error) {
      if (error instanceof QuotaError) {
        Alert.alert(t('journal.detail.quota_exceeded.title'), error.userMessage);
      } else {
        const msg = error instanceof Error ? error.message : t('common.unknown_error');
        Alert.alert(t('analysis_error.title'), msg);
      }
    } finally {
      setIsAnalyzing(false);
    }
  }, [dream, canAnalyzeNow, analyzeDream, t]);

  const gradientColors = mode === 'dark'
    ? GradientColors.dreamJournal
    : ([colors.backgroundSecondary, colors.backgroundDark] as const);

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
  const metadataSaveAnimatedStyle = useMemo(() => ({
    transform: [
      {
        scale: metadataPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }),
      },
    ],
    opacity: metadataPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.85] }),
  }), [metadataPulse]);
  const transcriptSaveAnimatedStyle = useMemo(() => ({
    transform: [
      {
        scale: transcriptPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }),
      },
    ],
    opacity: transcriptPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.85] }),
  }), [transcriptPulse]);

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
    <>
      <View style={styles.transcriptHeader}>
        <Text style={[styles.transcriptTitle, { color: colors.textPrimary }]}>
          {t('journal.original_transcript')}
        </Text>
        <Pressable
          onPress={isEditingTranscript ? handleTranscriptSave : () => {
            setEditableTranscript(dream.transcript || '');
            setIsEditingTranscript(true);
          }}
          testID="btn.editTranscript"
          style={({ pressed }) => [
            styles.transcriptEditButton,
            {
              opacity: pressed ? 0.7 : 1,
              backgroundColor: isEditingTranscript ? colors.accent : 'transparent',
              borderColor: colors.divider,
            },
          ]}
          hitSlop={8}
        >
          <Animated.View style={transcriptSaveAnimatedStyle}>
            <Ionicons
              name={isEditingTranscript ? 'checkmark' : 'pencil'}
              size={18}
              color={isEditingTranscript ? colors.textPrimary : colors.textSecondary}
            />
          </Animated.View>
        </Pressable>
      </View>
      {isEditingTranscript ? (
        <TextInput
          style={[styles.transcriptInput, {
            color: colors.textPrimary,
            borderColor: colors.divider,
            backgroundColor: colors.backgroundSecondary,
          }]}
          multiline
          value={editableTranscript}
          onChangeText={setEditableTranscript}
          placeholder={t('journal.transcript.placeholder') || 'Edit transcript...'}
          placeholderTextColor={colors.textSecondary}
          textAlignVertical="top"
          autoFocus
        />
      ) : (
        <Text style={[styles.transcript, { color: colors.textSecondary }]}>{dream.transcript}</Text>
      )}
    </>
  );

  const renderMetadataCard = (variant: 'inline' | 'floating' = 'inline') => (
    <View
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
          style={[styles.metadataTitleInput, { color: colors.textPrimary, borderColor: colors.divider }]}
          selectTextOnFocus
          value={editableTitle}
          onChangeText={setEditableTitle}
          placeholder={t('journal.detail.title_placeholder')}
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
            <Text style={[styles.metadataValue, { color: colors.textPrimary }]}>
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
        testID="btn.editMetadata"
        style={({ pressed }) => [
          styles.editButton,
          {
            opacity: pressed ? 0.7 : 1,
            backgroundColor: isEditing ? colors.accent : colors.backgroundSecondary,
          },
        ]}
        hitSlop={8}
      >
        <Animated.View style={metadataSaveAnimatedStyle}>
          <Ionicons
            name={isEditing ? 'checkmark' : 'pencil'}
            size={16}
            color={isEditing ? colors.textPrimary : colors.textSecondary}
          />
        </Animated.View>
      </Pressable>
    </View>
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
          style={[styles.floatingBackButton, shadows.lg, { backgroundColor: colors.backgroundCard }]}
          testID={TID.Button.NavigateJournal}
        >
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            (isEditing || isEditingTranscript) && { paddingBottom: 220 },
          ]}
          keyboardShouldPersistTaps="handled"
        >

          {/* Dream Image */}
          {!shouldHideHeroMedia && (
            <View style={styles.imageContainer}>
              <View style={styles.imageFrame}>
                {dream.imageGenerationFailed ? (
                  <ImageRetry onRetry={onRetryImage} isRetrying={isRetryingImage} />
                ) : dream.imageUrl ? (
                  <>
                    <Image
                      source={{ uri: dream.imageUrl }}
                      style={styles.dreamImage}
                      contentFit={imageConfig.contentFit}
                      transition={imageConfig.transition}
                      cachePolicy={imageConfig.cachePolicy}
                      priority={imageConfig.priority}
                      placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
                    />
                    <View style={styles.imageOverlay} />
                  </>
                ) : dream.analysisStatus === 'pending' ? (
                  <Skeleton style={{ width: '100%', height: '100%' }} />
                ) : (
                  <Pressable
                    onPress={handlePickImage}
                    disabled={isPickingImage}
                    style={[
                      styles.dreamImage,
                      {
                        justifyContent: 'center',
                        alignItems: 'center',
                        backgroundColor: colors.backgroundSecondary,
                        flexDirection: 'column',
                      },
                    ]}
                  >
                    {isPickingImage ? (
                      <ActivityIndicator color={colors.textPrimary} />
                    ) : (
                      <>
                        <Ionicons name="image-outline" size={28} color={colors.textSecondary} />
                        <Text
                          style={{
                            marginTop: 8,
                            color: colors.textSecondary,
                            fontFamily: Fonts.spaceGrotesk.medium,
                            fontSize: 14,
                          }}
                        >
                          {t('journal.detail.add_image')}
                        </Text>
                      </>
                    )}
                  </Pressable>
                )}
              </View>
            </View>
          )}

          {/* Content Card - Overlaps image */}
          <View style={[styles.contentCard, shadows.xl, { backgroundColor: colors.backgroundCard }]}>

            {/* Premium Metadata Card */}
            {!isEditing && renderMetadataCard()}

            {(dream.isAnalyzed || dream.analysisStatus === 'pending') && (
              <>
                {/* Quote */}
                {dream.shareableQuote ? (
                  <View style={[styles.quoteBox, { borderLeftColor: colors.accent }]}>
                    <Text style={[styles.quote, { color: colors.textPrimary }]}>
                      &quot;{dream.shareableQuote}&quot;
                    </Text>
                  </View>
                ) : dream.analysisStatus === 'pending' ? (
                  <Skeleton style={{ height: 60, width: '100%', marginBottom: 16, borderRadius: 8 }} />
                ) : null}

                {dream.interpretation ? (
                  <TypewriterText
                    text={dream.interpretation}
                    style={[styles.interpretation, { color: colors.textSecondary }]}
                    shouldAnimate={dream.analysisStatus === 'pending'}
                  />
                ) : dream.analysisStatus === 'pending' ? (
                  <View style={{ gap: 8, marginBottom: 16 }}>
                    <Skeleton style={{ height: 16, width: '100%', borderRadius: 4 }} />
                    <Skeleton style={{ height: 16, width: '90%', borderRadius: 4 }} />
                    <Skeleton style={{ height: 16, width: '95%', borderRadius: 4 }} />
                  </View>
                ) : null}

                {/* Action Buttons */}
                {(dream.analysisStatus === 'done' || (dream.interpretation && dream.imageUrl)) && (
                  <Pressable
                    testID={TID.Button.ExploreDream}
                    style={[styles.exploreButton, shadows.xl, {
                      backgroundColor: colors.accent,
                      borderColor: mode === 'dark' ? 'rgba(140, 158, 255, 0.3)' : 'rgba(212, 165, 116, 0.3)',
                    }]}
                    onPress={handleExplorePress}
                  >
                    <Ionicons name="sparkles" size={24} color={colors.textPrimary} />
                    <Text style={[styles.exploreButtonText, { color: colors.textPrimary }]}>{exploreButtonLabel}</Text>
                  </Pressable>
                )}
              </>
            )}

            {/* Additional Actions */}
            {(!dream.isAnalyzed || dream.analysisStatus !== 'done') && (
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

            <View style={styles.actionsRow}>
              <Pressable
                onPress={() => toggleFavorite(dream.id)}
                style={[
                  styles.actionButton,
                  shadows.sm,
                  {
                    // Match the main card surface so the padding around the
                    // button doesn't look like a darker band on Android.
                    backgroundColor: colors.backgroundCard,
                    borderColor: accentSurfaceBorderColor,
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
                disabled={isSharing}
                style={[
                  styles.actionButton,
                  shadows.sm,
                  {
                    backgroundColor: colors.backgroundCard,
                    borderColor: accentSurfaceBorderColor,
                    opacity: isSharing ? 0.7 : 1,
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
            >
              <Ionicons name="trash-outline" size={18} color="#EF4444" />
              <Text style={styles.deleteLinkText}>{t('journal.menu.delete')}</Text>
            </Pressable>
          </View>
        </ScrollView>
        {isEditing && (
          <View
            style={[
              styles.metadataOverlay,
              { backgroundColor: colors.overlay },
              styles.pointerAuto,
            ]}
          >
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
              >
                <Text style={[styles.shareCloseButtonText, { color: colors.textSecondary }]}
                >
                  {t('journal.detail.share_modal.close')}
                </Text>
              </Pressable>
            </View>
          </View>
        </Modal>
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
    aspectRatio: 2 / 3,
    overflow: 'hidden',
    position: 'relative',
  },
  dreamImage: {
    width: '100%',
    height: '100%',
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
  contentCard: {
    marginTop: -24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    // backgroundColor: set dynamically
    paddingHorizontal: 16,
    paddingVertical: 24,
    // shadow: applied via theme shadows.xl
  },
  // Premium Metadata Card with Glassmorphism
  metadataCard: {
    // backgroundColor and borderColor: set dynamically
    borderRadius: 16,
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
    fontSize: 24,
    fontFamily: Fonts.lora.bold,
    // color: set dynamically
    marginBottom: 12,
    lineHeight: 32,
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
  quote: {
    fontSize: 18,
    fontFamily: Fonts.lora.regularItalic,
    // color: set dynamically
    lineHeight: 28,
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
    fontFamily: Fonts.spaceGrotesk.bold,
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
