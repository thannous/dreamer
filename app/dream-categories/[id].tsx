import { Image } from 'expo-image';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnalysisReadingModal } from '@/components/analysis/AnalysisReadingModal';
import { Exploration360Panel } from '@/components/chat/Exploration360Panel';
import { DreamerArtworkWindow } from '@/components/ui/DreamerBackground';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { useDreamsData } from '@/context/DreamsContext';
import { ScrollPerfProvider } from '@/context/ScrollPerfContext';
import { useTheme } from '@/context/ThemeContext';
import { useClearWebFocus } from '@/hooks/useClearWebFocus';
import { useDreamMedia } from '@/hooks/useDreamMedia';
import { useQuota } from '@/hooks/useQuota';
import { useScrollIdle } from '@/hooks/useScrollIdle';
import { useTranslation } from '@/hooks/useTranslation';
import { getDreamRouteParams, resolveDreamRoute } from '@/lib/dreamRoute';
import { isDreamExplored } from '@/lib/dreamUsage';
import { canUseExploration360Synthesis, getExploration360SynthesisStatus } from '@/lib/exploration360';
import { getDreamImageVersion, withCacheBuster } from '@/lib/imageUtils';
import { buildPaywallHref } from '@/lib/paywallRoute';
import { TID } from '@/lib/testIDs';

const CATEGORY_ICONS = { symbols: 'sparkles', emotions: 'heart.fill', growth: 'leaf.fill' } as const;

export default function DreamCategoriesScreen() {
  const { t } = useTranslation();
  const route = useLocalSearchParams<{ id: string; remoteId?: string; clientRequestId?: string }>();
  const { dreams } = useDreamsData();
  const { colors, mode } = useTheme();
  const { fontScale } = useWindowDimensions();
  const tokens = getNoctaliaDesignTokens(colors, mode);
  const insets = useSafeAreaInsets();
  const scrollPerf = useScrollIdle();
  const [reading, setReading] = useState(false);
  const [failedImage, setFailedImage] = useState<string | null>(null);
  useClearWebFocus();
  const dream = resolveDreamRoute(dreams, route);
  const { tier, subscriptionLoading } = useQuota({ dreamId: dream?.id, dream });
  const media = useDreamMedia(dream);
  const status = getExploration360SynthesisStatus(dream);
  const mediaUrl = media.thumbnailUrl || media.imageUrl;
  const cacheKey = media.thumbnailUrl ? media.thumbnailCacheKey : media.imageCacheKey;
  const uri = mediaUrl ? withCacheBuster(mediaUrl, getDreamImageVersion(dream ?? {})) : '';
  const imageIdentity = JSON.stringify([media.accessScope, cacheKey, uri]);
  const source = useMemo(() => uri ? { uri, cacheKey } : undefined, [uri, cacheKey]);
  const showImage = Boolean(source && !media.error && imageIdentity !== failedImage);
  const canUseSynthesis = canUseExploration360Synthesis(tier);
  const subscriptionReady = !subscriptionLoading || canUseSynthesis;

  if (!dream) {
    return <View style={[styles.empty, { backgroundColor: tokens.screen.background }]}>
      <Text style={[styles.description, { color: tokens.text.primary }]}>{t('dream_categories.not_found.title')}</Text>
    </View>;
  }

  const openChat = () => router.push({ pathname: '/dream-chat/[id]', params: getDreamRouteParams(dream) });
  const openSynthesis = () => {
    if (!subscriptionReady) return;
    router.push(canUseSynthesis
      ? { pathname: '/dream-chat/[id]', params: { ...getDreamRouteParams(dream), mode: 'synthesis' } }
      : buildPaywallHref('exploration_limit'));
  };

  return (
    <ScrollPerfProvider isScrolling={scrollPerf.isScrolling}>
      <View style={[styles.screen, { backgroundColor: tokens.screen.background }]} testID="screen.dreamCategories">
        <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 }]}
          onScrollBeginDrag={scrollPerf.onScrollBeginDrag} onScrollEndDrag={scrollPerf.onScrollEndDrag}
          onMomentumScrollBegin={scrollPerf.onMomentumScrollBegin} onMomentumScrollEnd={scrollPerf.onMomentumScrollEnd}>
          <DreamerArtworkWindow scene="dialogue" style={{ marginHorizontal: -32 }} />
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('navigation.back')}
            style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
            <IconSymbol name="chevron.left" size={22} color={tokens.accent.text} />
            <Text style={[styles.backText, { color: tokens.accent.text }]}>{t('journal.detail.zone.dream')}</Text>
          </Pressable>

          <Text accessibilityRole="header" style={[styles.title, { color: tokens.text.primary }]}>{t('dream_categories.exploration360.eyebrow')}</Text>
          <View style={[styles.dreamContext, fontScale >= 1.5 && styles.largeTypeContext]}>
            {showImage ? <Image testID="image.reflection.dream" source={source} contentFit="cover" contentPosition="center"
              cachePolicy="memory-disk" recyclingKey={imageIdentity} transition={0}
              accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
              onError={() => setFailedImage(imageIdentity)} style={styles.thumbnail} /> : null}
            <View style={styles.dreamCopy}>
              <Text accessibilityRole="header" style={[styles.dreamTitle, { color: tokens.text.primary }]}>{dream.title}</Text>
              {dream.interpretation?.trim() ? <Pressable onPress={() => setReading(true)} testID="btn.dreamCategory.readAnalysis"
                accessibilityRole="button" style={({ pressed }) => [styles.readAnalysis, pressed && styles.pressed]}>
                <IconSymbol name="book" size={18} color={tokens.accent.text} />
                <Text style={[styles.linkText, { color: tokens.accent.text }]}>{t('dream_categories.read_analysis')}</Text>
              </Pressable> : null}
            </View>
          </View>
          {status.progress.completedCount > 0 ? <View style={styles.exchangeSaved}>
            <IconSymbol name="checkmark.circle.fill" size={22} color={tokens.status.success.icon} />
            <Text testID="text.reflection.exchangeSaved" accessibilityLiveRegion="polite"
              style={[styles.description, { color: tokens.text.secondary }]}>{t('dream_categories.exchange_saved')}</Text>
          </View> : null}

          <Text accessibilityRole="header" style={[styles.question, { color: tokens.text.primary }]}>{t('dream_categories.explore_angle')}</Text>
          <View>
            {status.progress.axes.map((axis, index) => {
              const iconColor = axis.id === 'emotions' ? colors.tags.mystical : axis.id === 'growth' ? colors.tags.calm : tokens.accent.text;
              return <React.Fragment key={axis.id}>
                {index > 0 ? <View style={[styles.separator, { backgroundColor: tokens.surface.border }]} /> : null}
                <Pressable testID={TID.Button.DreamCategory(axis.id)} accessibilityRole="button" accessibilityLabel={t(axis.titleKey)}
                  accessibilityHint={axis.completed ? t('dream_categories.resume_hint') : t(axis.descriptionKey)}
                  onPress={() => axis.completed ? openChat() : router.push({ pathname: '/dream-chat/[id]', params: { ...getDreamRouteParams(dream), category: axis.id } })}
                  style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
                  <IconSymbol name={CATEGORY_ICONS[axis.id]} size={24} color={iconColor} />
                  <View style={styles.rowCopy}>
                    <View style={styles.rowHeading}>
                      <Text style={[styles.rowTitle, { color: tokens.text.primary }]}>{t(axis.titleKey)}</Text>
                      {axis.completed ? <Text style={[styles.resume, { color: tokens.accent.text }]}>{t('dream_categories.resume')}</Text> : null}
                    </View>
                    <Text style={[styles.description, { color: tokens.text.secondary }]}>{t(axis.descriptionKey)}</Text>
                  </View>
                  <IconSymbol name="chevron.right" size={18} color={tokens.accent.text} />
                </Pressable>
              </React.Fragment>;
            })}
          </View>

          <Exploration360Panel hasSynthesis={status.hasSynthesis} canGenerateSynthesis={status.canGenerateSynthesis}
            onSynthesisPress={openSynthesis} synthesisDisabled={!subscriptionReady}
            onReadSynthesisPress={openChat} variant="reflection" style={styles.recap} />

          <Pressable onPress={openChat} testID={TID.Button.DreamFreeChat} accessibilityRole="button"
            style={({ pressed }) => [styles.openChat, pressed && styles.pressed]}>
            <IconSymbol name="bubble.left.and.bubble.right" size={18} color={tokens.accent.text} />
            <Text style={[styles.linkText, { color: tokens.accent.text }]}>
              {isDreamExplored(dream) ? t('dream_categories.view_chat') : t('dream_categories.free_chat_prompt')}
            </Text>
          </Pressable>
        </ScrollView>
        {reading ? <AnalysisReadingModal dream={dream} imageUri={media.imageUrl} imageCacheKey={media.imageCacheKey}
          imageLoadFailed={media.error} onReloadImage={() => { setFailedImage(null); media.retry(); }} onClose={() => setReading(false)} /> : null}
      </View>
    </ScrollPerfProvider>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 32, width: '100%', maxWidth: 640, alignSelf: 'center' },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, alignSelf: 'flex-start', marginLeft: -5 },
  backText: { fontFamily: Fonts.spaceGrotesk.medium, fontSize: 16 },
  title: { fontFamily: Fonts.fraunces.semiBold, fontSize: 34, lineHeight: 42, marginTop: 4 },
  dreamContext: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 10 },
  largeTypeContext: { flexDirection: 'column', alignItems: 'flex-start' },
  thumbnail: { width: 90, height: 96, borderRadius: 12, flexShrink: 0 },
  dreamCopy: { flex: 1, minWidth: 0, alignSelf: 'stretch', justifyContent: 'center' },
  dreamTitle: { fontFamily: Fonts.fraunces.semiBold, fontSize: 20, lineHeight: 26 },
  readAnalysis: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, marginTop: 2, alignSelf: 'flex-start' },
  linkText: { fontFamily: Fonts.spaceGrotesk.medium, fontSize: 14, lineHeight: 20, flexShrink: 1 },
  exchangeSaved: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  question: { fontFamily: Fonts.fraunces.semiBold, fontSize: 20, lineHeight: 28, marginTop: 18, marginBottom: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10, minHeight: 64 },
  rowCopy: { flex: 1, minWidth: 0, gap: 2 },
  rowHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  rowTitle: { fontFamily: Fonts.fraunces.semiBold, fontSize: 17, lineHeight: 22, flexShrink: 1 },
  resume: { fontFamily: Fonts.spaceGrotesk.medium, fontSize: 12, lineHeight: 18 },
  description: { fontFamily: Fonts.spaceGrotesk.regular, fontSize: 14, lineHeight: 20, flexShrink: 1 },
  separator: { height: StyleSheet.hairlineWidth },
  recap: { marginTop: 8 },
  openChat: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 44, marginTop: 12 },
  pressed: { opacity: 0.7 },
});
