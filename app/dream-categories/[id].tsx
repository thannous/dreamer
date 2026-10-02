import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnalysisReadingModal } from '@/components/analysis/AnalysisReadingModal';
import { Exploration360Panel } from '@/components/chat/Exploration360Panel';
import { AtmosphericBackground } from '@/components/inspiration/AtmosphericBackground';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { useDreamsData } from '@/context/DreamsContext';
import { ScrollPerfProvider } from '@/context/ScrollPerfContext';
import { useTheme } from '@/context/ThemeContext';
import { useClearWebFocus } from '@/hooks/useClearWebFocus';
import { useDreamMedia } from '@/hooks/useDreamMedia';
import { useScrollIdle } from '@/hooks/useScrollIdle';
import { useTranslation } from '@/hooks/useTranslation';
import { isCategoryExplored } from '@/lib/chatCategoryUtils';
import { getDreamRouteParams, resolveDreamRoute } from '@/lib/dreamRoute';
import { isDreamExplored } from '@/lib/dreamUsage';
import { EXPLORATION_360_AXES, getExploration360SynthesisStatus } from '@/lib/exploration360';
import { TID } from '@/lib/testIDs';

const CATEGORY_ICONS = { symbols: 'sparkles', emotions: 'heart.fill', growth: 'leaf.fill' } as const;

export default function DreamCategoriesScreen() {
  const { t } = useTranslation();
  const route = useLocalSearchParams<{ id: string; remoteId?: string; clientRequestId?: string }>();
  const { dreams } = useDreamsData();
  const { colors, mode } = useTheme();
  const tokens = getNoctaliaDesignTokens(colors, mode);
  const insets = useSafeAreaInsets();
  const scrollPerf = useScrollIdle();
  const [reading, setReading] = useState(false);
  useClearWebFocus();
  const dream = resolveDreamRoute(dreams, route);
  const media = useDreamMedia(dream);
  const status = getExploration360SynthesisStatus(dream);

  if (!dream) {
    return <View style={[styles.empty, { backgroundColor: tokens.screen.background }]}>
      <Text style={[styles.description, { color: tokens.text.primary }]}>{t('dream_categories.not_found.title')}</Text>
    </View>;
  }

  const openChat = () => router.push({ pathname: '/dream-chat/[id]', params: getDreamRouteParams(dream) });

  return (
    <ScrollPerfProvider isScrolling={scrollPerf.isScrolling}>
      <View style={[styles.screen, { backgroundColor: tokens.screen.background }]} testID="screen.dreamCategories">
        <AtmosphericBackground variant="subtle" />
        <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 32 }]}
          onScrollBeginDrag={scrollPerf.onScrollBeginDrag} onScrollEndDrag={scrollPerf.onScrollEndDrag}
          onMomentumScrollBegin={scrollPerf.onMomentumScrollBegin} onMomentumScrollEnd={scrollPerf.onMomentumScrollEnd}>
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('navigation.back')}
            style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
            <IconSymbol name="chevron.left" size={22} color={tokens.accent.text} />
            <Text style={[styles.backText, { color: tokens.accent.text }]}>{t('journal.detail.zone.dream')}</Text>
          </Pressable>

          <Text accessibilityRole="header" style={[styles.title, { color: tokens.text.primary }]}>{t('dream_categories.exploration360.eyebrow')}</Text>
          <Text style={[styles.dreamTitle, { color: tokens.text.primary }]}>{dream.title}</Text>
          {dream.interpretation?.trim() ? <Pressable onPress={() => setReading(true)} testID="btn.dreamCategory.readAnalysis"
            accessibilityRole="button" style={({ pressed }) => [styles.readAnalysis, pressed && styles.pressed]}>
            <IconSymbol name="book" size={18} color={tokens.accent.text} />
            <Text style={[styles.linkText, { color: tokens.accent.text }]}>{t('dream_categories.read_analysis')}</Text>
          </Pressable> : null}

          <Text style={[styles.question, { color: tokens.text.primary }]}>{t('dream_categories.subtitle')}</Text>
          <View style={[styles.group, { backgroundColor: tokens.surface.raised, borderColor: tokens.surface.border }]}>
            {EXPLORATION_360_AXES.map((axis, index) => {
              const explored = isCategoryExplored(dream.chatHistory, axis.id);
              const iconColor = axis.id === 'emotions' ? colors.tags.mystical : axis.id === 'growth' ? colors.tags.calm : tokens.accent.text;
              return <React.Fragment key={axis.id}>
                {index > 0 ? <View style={[styles.separator, { backgroundColor: tokens.surface.border }]} /> : null}
                <Pressable testID={TID.Button.DreamCategory(axis.id)} accessibilityRole="button" accessibilityLabel={t(axis.titleKey)}
                  accessibilityHint={explored ? t('dream_categories.resume_hint') : t(axis.descriptionKey)}
                  onPress={() => explored ? openChat() : router.push({ pathname: '/dream-chat/[id]', params: { ...getDreamRouteParams(dream), category: axis.id } })}
                  style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
                  <View style={[styles.icon, { backgroundColor: `${iconColor}18` }]}>
                    <IconSymbol name={CATEGORY_ICONS[axis.id]} size={23} color={iconColor} />
                  </View>
                  <View style={styles.rowCopy}>
                    <Text style={[styles.rowTitle, { color: tokens.text.primary }]}>{t(axis.titleKey)}</Text>
                    <Text style={[styles.description, { color: tokens.text.secondary }]}>{t(axis.descriptionKey)}</Text>
                  </View>
                  <IconSymbol name="chevron.right" size={18} color={tokens.accent.text} />
                </Pressable>
              </React.Fragment>;
            })}
          </View>

          <Exploration360Panel hasSynthesis={status.hasSynthesis} canGenerateSynthesis={status.canGenerateSynthesis}
            onSynthesisPress={() => router.push({ pathname: '/dream-chat/[id]', params: { ...getDreamRouteParams(dream), mode: 'synthesis' } })}
            onReadSynthesisPress={openChat} style={styles.recap} />

          <Pressable onPress={openChat} testID={TID.Button.DreamFreeChat} accessibilityRole="button"
            style={({ pressed }) => [styles.openChat, pressed && styles.pressed]}>
            <IconSymbol name="bubble.left.and.bubble.right" size={18} color={tokens.accent.text} />
            <Text style={[styles.linkText, { color: tokens.accent.text }]}>
              {isDreamExplored(dream) ? t('dream_categories.view_chat') : t('dream_categories.free_chat_prompt')}
            </Text>
          </Pressable>
        </ScrollView>
        {reading ? <AnalysisReadingModal dream={dream} imageUri={media.imageUrl} imageCacheKey={media.imageCacheKey}
          imageLoadFailed={media.error} onReloadImage={media.retry} onClose={() => setReading(false)} /> : null}
      </View>
    </ScrollPerfProvider>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, overflow: 'hidden' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 24, width: '100%', maxWidth: 640, alignSelf: 'center' },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, alignSelf: 'flex-start', marginLeft: -5 },
  backText: { fontFamily: Fonts.spaceGrotesk.medium, fontSize: 16 },
  title: { fontFamily: Fonts.fraunces.semiBold, fontSize: 38, lineHeight: 46, marginTop: 24 },
  dreamTitle: { fontFamily: Fonts.fraunces.medium, fontSize: 23, lineHeight: 31, marginTop: 14 },
  readAnalysis: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, marginTop: 4, alignSelf: 'flex-start' },
  linkText: { fontFamily: Fonts.spaceGrotesk.medium, fontSize: 14, lineHeight: 20, flexShrink: 1 },
  question: { fontFamily: Fonts.spaceGrotesk.regular, fontSize: 16, lineHeight: 24, marginTop: 28, marginBottom: 18 },
  group: { marginHorizontal: -8, borderWidth: 1, borderRadius: 20, borderCurve: 'continuous', overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 18, minHeight: 94 },
  icon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowCopy: { flex: 1, gap: 4 },
  rowTitle: { fontFamily: Fonts.fraunces.semiBold, fontSize: 18, lineHeight: 24 },
  description: { fontFamily: Fonts.spaceGrotesk.regular, fontSize: 14, lineHeight: 20 },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 72, marginRight: 16 },
  recap: { marginTop: 24 },
  openChat: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, marginTop: 20, alignSelf: 'flex-start' },
  pressed: { opacity: 0.7 },
});
