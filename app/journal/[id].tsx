import { ImageRetry } from '@/components/journal/ImageRetry';
import { GradientColors } from '@/constants/gradients';
import { Fonts } from '@/constants/theme';
import { useDreams } from '@/context/DreamsContext';
import { useTheme } from '@/context/ThemeContext';
import { getImageConfig } from '@/lib/imageUtils';
import { generateImageForDream } from '@/services/geminiService';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Share, StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { useLocaleFormatting } from '@/hooks/useLocaleFormatting';
import { useQuota } from '@/hooks/useQuota';
import { QuotaError } from '@/lib/errors';

export default function JournalDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const dreamId = useMemo(() => Number(id), [id]);
  const { dreams, toggleFavorite, updateDream, deleteDream, analyzeDream } = useDreams();
  const { colors, shadows, mode } = useTheme();
  const [isRetryingImage, setIsRetryingImage] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const { formatDreamDate, formatDreamTime } = useLocaleFormatting();
  const { canAnalyzeNow } = useQuota();

  const dream = useMemo(() => dreams.find((d) => d.id === dreamId), [dreams, dreamId]);

  // Use full-resolution image config for detail view
  const imageConfig = useMemo(() => getImageConfig('full'), []);

  // Define callbacks before early return (hooks must be called unconditionally)
  const onShare = useCallback(async () => {
    if (!dream) return;
    try {
      await Share.share({ message: `"${dream.shareableQuote}" - From my dream journal.` });
    } catch {
      Alert.alert('Share failed');
    }
  }, [dream]);

  const onDelete = useCallback(async () => {
    if (!dream) return;
    Alert.alert(
      'Delete Dream',
      'Are you sure you want to delete this dream?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteDream(dream.id);
            router.replace('/(tabs)/journal');
          },
        },
      ]
    );
  }, [dream, deleteDream]);

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
      Alert.alert('Success', 'Dream image generated successfully!');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      Alert.alert('Image Generation Failed', msg);
    } finally {
      setIsRetryingImage(false);
    }
  }, [dream, updateDream]);

  const handleBackPress = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/journal');
    }
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!dream) return;

    // Check quota
    if (!canAnalyzeNow) {
      Alert.alert(
        'Analysis Limit Reached',
        'You have reached your analysis limit. Please upgrade to analyze more dreams.',
        [{ text: 'OK' }]
      );
      return;
    }

    setIsAnalyzing(true);
    try {
      await analyzeDream(dream.id, dream.transcript);
      Alert.alert('Success', 'Dream analyzed successfully!');
    } catch (error) {
      if (error instanceof QuotaError) {
        Alert.alert('Quota Exceeded', error.userMessage);
      } else {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        Alert.alert('Analysis Failed', msg);
      }
    } finally {
      setIsAnalyzing(false);
    }
  }, [dream, canAnalyzeNow, analyzeDream]);

  const gradientColors = mode === 'dark'
    ? GradientColors.dreamJournal
    : ([colors.backgroundSecondary, colors.backgroundDark] as const);

  if (!dream) {
    return (
      <LinearGradient colors={gradientColors} style={styles.container}>
        <Text style={{ color: colors.textPrimary, fontSize: 18 }}>Dream not found.</Text>
        <Pressable onPress={handleBackPress} style={[styles.backButton, { backgroundColor: colors.accent }]}>
          <Text style={[styles.backButtonText, { color: colors.textPrimary }]}>Go Back</Text>
        </Pressable>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={gradientColors} style={styles.gradient}>
      <Pressable onPress={handleBackPress} style={[styles.floatingBackButton, shadows.lg, { backgroundColor: colors.backgroundCard }]}>
        <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
      </Pressable>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>

        {/* Dream Image */}
        <View style={styles.imageContainer}>
          <View style={styles.imageFrame}>
            {dream.imageGenerationFailed ? (
              <ImageRetry onRetry={onRetryImage} isRetrying={isRetryingImage} />
            ) : (
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
            )}
          </View>
        </View>

        {/* Content Card - Overlaps image */}
        <View style={[styles.contentCard, shadows.xl, { backgroundColor: colors.backgroundCard }]}>

          {/* Not Analyzed / Pending / Failed State */}
          {(!dream.isAnalyzed || dream.analysisStatus !== 'done') && (
            <View style={[styles.statusCard, shadows.md, { backgroundColor: colors.backgroundSecondary }]}>
              <View style={styles.statusHeader}>
                <Ionicons
                  name={dream.analysisStatus === 'pending' ? 'hourglass-outline' : dream.analysisStatus === 'failed' ? 'alert-circle-outline' : 'information-circle-outline'}
                  size={32}
                  color={dream.analysisStatus === 'failed' ? '#EF4444' : colors.accent}
                />
                <Text style={[styles.statusTitle, { color: colors.textPrimary }]}>
                  {dream.analysisStatus === 'pending' ? 'Analysis in Progress...' :
                   dream.analysisStatus === 'failed' ? 'Analysis Failed' :
                   'Not Analyzed'}
                </Text>
              </View>

              <Text style={[styles.statusMessage, { color: colors.textSecondary }]}>
                {dream.analysisStatus === 'pending' ? 'Your dream is being analyzed. Please wait...' :
                 dream.analysisStatus === 'failed' ? 'The analysis failed. Please try again.' :
                 'This dream has not been analyzed yet. Tap the button below to analyze it with AI.'}
              </Text>

              {dream.analysisStatus !== 'pending' && (
                <Pressable
                  onPress={handleAnalyze}
                  disabled={isAnalyzing}
                  style={[styles.analyzeButton, shadows.md, { backgroundColor: colors.accent }]}
                >
                  {isAnalyzing ? (
                    <ActivityIndicator color={colors.textPrimary} />
                  ) : (
                    <>
                      <Ionicons name="sparkles-outline" size={20} color={colors.textPrimary} />
                      <Text style={[styles.analyzeButtonText, { color: colors.textPrimary }]}>
                        {dream.analysisStatus === 'failed' ? 'Retry Analysis' : 'Analyze Dream'}
                      </Text>
                    </>
                  )}
                </Pressable>
              )}

              {dream.analysisStatus === 'pending' && (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={colors.accent} />
                </View>
              )}

              {/* Show transcript */}
              <View style={[styles.transcriptContainer, { borderColor: colors.divider }]}>
                <Text style={[styles.transcriptLabel, { color: colors.textSecondary }]}>Transcript:</Text>
                <Text style={[styles.transcriptText, { color: colors.textPrimary }]}>{dream.transcript}</Text>
              </View>
            </View>
          )}

          {/* Regular analyzed content */}
          {dream.isAnalyzed && dream.analysisStatus === 'done' && (
            <>
              {/* Premium Metadata Card */}
              <View style={[styles.metadataCard, shadows.md, {
                backgroundColor: mode === 'dark' ? 'rgba(140, 158, 255, 0.15)' : 'rgba(212, 165, 116, 0.15)',
                borderColor: mode === 'dark' ? 'rgba(207, 207, 234, 0.2)' : 'rgba(212, 165, 116, 0.3)'
              }]}>
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
                <Text style={[styles.metadataTitle, { color: colors.textPrimary }]}>{dream.title}</Text>
            {dream.dreamType && (
              <View style={styles.metadataRow}>
                <Ionicons name="moon-outline" size={18} color={colors.textPrimary} />
                <Text style={[styles.metadataLabel, { color: colors.textPrimary }]}>Dream Type:</Text>
                <Text style={[styles.metadataValue, { color: colors.textPrimary }]}>{dream.dreamType}</Text>
              </View>
            )}
            {dream.theme && (
              <View style={styles.metadataRow}>
                <Ionicons name="color-palette-outline" size={18} color={colors.textPrimary} />
                <Text style={[styles.metadataLabel, { color: colors.textPrimary }]}>Theme:</Text>
                <Text style={[styles.metadataValue, { color: colors.textPrimary }]}>{dream.theme}</Text>
              </View>
            )}
          </View>

          {/* Quote */}
          <View style={[styles.quoteBox, { borderLeftColor: colors.accent }]}>
            <Text style={[styles.quote, { color: colors.textPrimary }]}>
              &quot;{dream.shareableQuote}&quot;
            </Text>
          </View>

          <Text style={[styles.interpretation, { color: colors.textSecondary }]}>{dream.interpretation}</Text>

          {/* Action Buttons */}
          <Pressable style={[styles.exploreButton, shadows.xl, {
            backgroundColor: colors.accent,
            borderColor: mode === 'dark' ? 'rgba(140, 158, 255, 0.3)' : 'rgba(212, 165, 116, 0.3)'
          }]} onPress={() => {
            router.push(`/dream-categories/${dream.id}`);
          }}>
            <Ionicons name="sparkles" size={24} color={colors.textPrimary} />
            <Text style={[styles.exploreButtonText, { color: colors.textPrimary }]}>Explore Dream Further</Text>
          </Pressable>

          {/* Additional Actions */}
          <View style={styles.actionsRow}>
            <Pressable onPress={() => toggleFavorite(dream.id)} style={[styles.actionButton, shadows.sm, {
              backgroundColor: mode === 'dark' ? 'rgba(140, 158, 255, 0.15)' : 'rgba(212, 165, 116, 0.15)',
              borderColor: colors.divider
            }]}>
              <Ionicons
                name={dream.isFavorite ? 'heart' : 'heart-outline'}
                size={24}
                color={dream.isFavorite ? '#F59E0B' : colors.textPrimary}
              />
              <Text style={[styles.actionButtonText, { color: colors.textPrimary }]}>
                {dream.isFavorite ? 'Favorited' : 'Favorite'}
              </Text>
            </Pressable>
            <Pressable onPress={onShare} style={[styles.actionButton, shadows.sm, {
              backgroundColor: mode === 'dark' ? 'rgba(140, 158, 255, 0.15)' : 'rgba(212, 165, 116, 0.15)',
              borderColor: colors.divider
            }]}>
              <Ionicons name="share-outline" size={24} color={colors.textOnAccentSurface} />
              <Text style={[styles.actionButtonText, { color: colors.textOnAccentSurface }]}>Share</Text>
            </Pressable>
          </View>

          {/* Transcript Section */}
          <View style={[styles.transcriptSection, {
            borderTopColor: colors.divider,
            backgroundColor: mode === 'dark' ? 'rgba(19, 16, 34, 0.3)' : 'rgba(0, 0, 0, 0.03)'
          }]}>
            <Text style={[styles.transcriptTitle, { color: colors.textPrimary }]}>Original Transcript</Text>
            <Text style={[styles.transcript, { color: colors.textSecondary }]}>{dream.transcript}</Text>
          </View>

          <Pressable
            onPress={onDelete}
            style={styles.deleteLink}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="link"
          >
            <Ionicons name="trash-outline" size={18} color="#EF4444" />
            <Text style={styles.deleteLinkText}>Delete Dream</Text>
          </Pressable>
            </>
          )}
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
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
  transcriptTitle: {
    fontSize: 18,
    fontFamily: Fonts.spaceGrotesk.bold,
    // color: set dynamically
    marginBottom: 12,
  },
  transcript: {
    fontSize: 15,
    fontFamily: Fonts.spaceGrotesk.regular,
    // color: set dynamically
    lineHeight: 24,
    opacity: 0.9,
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
    fontFamily: Fonts.lora.semiBold,
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
});
