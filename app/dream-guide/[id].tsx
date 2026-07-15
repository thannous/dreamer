import React, { useCallback, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AtmosphericBackground } from '@/components/inspiration/AtmosphericBackground';
import { FlatGlassCard } from '@/components/inspiration/GlassCard';
import { SymbolCard } from '@/components/symbols/SymbolCard';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { DecoLines, ThemeLayout } from '@/constants/journalTheme';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { ScrollPerfProvider } from '@/context/ScrollPerfContext';
import { useTheme } from '@/context/ThemeContext';
import { useScrollIdle } from '@/hooks/useScrollIdle';
import { useTranslation } from '@/hooks/useTranslation';
import { getDreamGuideCopy } from '@/lib/dreamGuideCopy';
import type { DreamGuideLanguage } from '@/lib/dreamGuideTypes';
import {
  getDreamGuideById,
  getDreamGuideContent,
  getDreamGuideIcon,
  getDreamGuideSymbols,
} from '@/services/dreamGuideService';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';

export default function DreamGuideDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const guideId = Array.isArray(id) ? id[0] : id;
  const { colors, mode, shadows } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const { currentLang } = useTranslation();
  const language = (currentLang ?? 'en') as DreamGuideLanguage;
  const copy = getDreamGuideCopy(language);
  const scrollPerf = useScrollIdle();
  const guide = useMemo(() => (guideId ? getDreamGuideById(guideId) : undefined), [guideId]);
  const symbols = useMemo(() => (guide ? getDreamGuideSymbols(guide) : []), [guide]);

  const handleSymbolPress = useCallback((symbolId: string) => {
    router.push({
      pathname: '/symbol-detail/[id]',
      params: { id: symbolId, source: 'guide' },
    });
  }, []);

  if (!guide) {
    return (
      <LinearGradient colors={noctalia.screen.gradient} style={styles.emptyState}>
        <AtmosphericBackground variant="subtle" />
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          style={[
            styles.emptyBackButton,
            { backgroundColor: noctalia.surface.raised, borderColor: noctalia.surface.border },
          ]}
        >
          <IconSymbol name="chevron.left" size={21} color={noctalia.text.secondary} />
        </Pressable>
        <Text selectable style={[styles.emptyText, { color: noctalia.text.secondary }]}>
          {copy.notFound}
        </Text>
      </LinearGradient>
    );
  }

  const content = getDreamGuideContent(guide, language);

  return (
    <ScrollPerfProvider isScrolling={scrollPerf.isScrolling}>
      <LinearGradient
        colors={noctalia.screen.gradient}
        style={styles.container}
        testID="screen.dreamGuideDetail"
      >
        <AtmosphericBackground variant="subtle" />
        <ScrollView
          style={styles.scrollView}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          onScrollBeginDrag={scrollPerf.onScrollBeginDrag}
          onScrollEndDrag={scrollPerf.onScrollEndDrag}
          onMomentumScrollBegin={scrollPerf.onMomentumScrollBegin}
          onMomentumScrollEnd={scrollPerf.onMomentumScrollEnd}
        >
          <View style={styles.headerRow}>
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              style={[
                styles.backButton,
                shadows.sm,
                {
                  backgroundColor: noctalia.surface.raised,
                  borderColor: noctalia.surface.border,
                },
              ]}
            >
              <IconSymbol name="chevron.left" size={21} color={noctalia.text.secondary} />
            </Pressable>
            <View style={[styles.guideBadgeIcon, { backgroundColor: noctalia.surface.soft }]}>
              <IconSymbol
                name={getDreamGuideIcon(guide.id)}
                size={21}
                color={noctalia.accent.base}
              />
            </View>
            <Text style={[styles.guideLabel, { color: noctalia.accent.base }]}>
              {copy.guideLabel}
            </Text>
          </View>

          <Text selectable style={[styles.title, { color: noctalia.text.primary }]}>
            {content.title}
          </Text>

          <View style={[DecoLines.rule, styles.rule, { backgroundColor: noctalia.accent.base }]} />

          <FlatGlassCard intensity="strong" style={styles.introCard}>
            <Text selectable style={[styles.introText, { color: noctalia.text.primary }]}>
              {content.intro}
            </Text>
          </FlatGlassCard>

          <View style={styles.sectionHeadingRow}>
            <IconSymbol name="book.closed.fill" size={19} color={noctalia.accent.base} />
            <Text style={[styles.sectionHeading, { color: noctalia.text.primary }]}>
              {copy.symbolsHeading}
            </Text>
            <Text style={[styles.symbolCount, { color: noctalia.text.tertiary }]}>
              {copy.symbolCount(symbols.length)}
            </Text>
          </View>

          <View style={styles.symbolList}>
            {symbols.map((symbol) => (
              <SymbolCard
                key={symbol.id}
                symbol={symbol}
                language={language}
                onPress={handleSymbolPress}
              />
            ))}
          </View>

          <View style={styles.conclusionSection}>
            <View style={styles.sectionHeadingRow}>
              <IconSymbol name="lightbulb.fill" size={19} color={noctalia.accent.base} />
              <Text style={[styles.sectionHeading, { color: noctalia.text.primary }]}>
                {copy.conclusionHeading}
              </Text>
            </View>
            <FlatGlassCard intensity="subtle" style={styles.conclusionCard}>
              <Text selectable style={[styles.conclusionText, { color: noctalia.text.secondary }]}>
                {content.outro}
              </Text>
            </FlatGlassCard>
          </View>
        </ScrollView>
      </LinearGradient>
    </ScrollPerfProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: ThemeLayout.spacing.md,
    paddingTop: 38,
    paddingBottom: ThemeLayout.spacing.xl,
    gap: ThemeLayout.spacing.lg20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guideBadgeIcon: {
    width: 42,
    height: 42,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guideLabel: {
    flex: 1,
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 12,
    lineHeight: 16,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: Fonts.fraunces.bold,
    fontSize: 31,
    lineHeight: 38,
  },
  rule: {
    width: 64,
  },
  introCard: {
    borderRadius: 24,
    borderCurve: 'continuous',
    padding: ThemeLayout.spacing.md,
  },
  introText: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 15,
    lineHeight: 23,
  },
  sectionHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionHeading: {
    flex: 1,
    fontFamily: Fonts.fraunces.semiBold,
    fontSize: 20,
    lineHeight: 26,
  },
  symbolCount: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 12,
    lineHeight: 16,
  },
  symbolList: {
    marginHorizontal: -ThemeLayout.spacing.md,
  },
  conclusionSection: {
    gap: 12,
  },
  conclusionCard: {
    borderRadius: 22,
    borderCurve: 'continuous',
    padding: ThemeLayout.spacing.md,
  },
  conclusionText: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 14,
    lineHeight: 22,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: ThemeLayout.spacing.md,
  },
  emptyBackButton: {
    position: 'absolute',
    top: 38,
    left: ThemeLayout.spacing.md,
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 16,
  },
});
