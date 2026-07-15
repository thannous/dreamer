import React, { useCallback, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DreamGuideCard } from '@/components/guides/DreamGuideCard';
import { AtmosphericBackground } from '@/components/inspiration/AtmosphericBackground';
import { FlatGlassCard } from '@/components/inspiration/GlassCard';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemeLayout } from '@/constants/journalTheme';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { ScrollPerfProvider } from '@/context/ScrollPerfContext';
import { useTheme } from '@/context/ThemeContext';
import { useScrollIdle } from '@/hooks/useScrollIdle';
import { useTranslation } from '@/hooks/useTranslation';
import { getDreamGuideCopy } from '@/lib/dreamGuideCopy';
import type { DreamGuideLanguage } from '@/lib/dreamGuideTypes';
import { getImportantDreamGuides } from '@/services/dreamGuideService';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';

export default function DreamGuidesScreen() {
  const { colors, mode, shadows } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const { currentLang } = useTranslation();
  const language = (currentLang ?? 'en') as DreamGuideLanguage;
  const copy = getDreamGuideCopy(language);
  const guides = getImportantDreamGuides();
  const scrollPerf = useScrollIdle();

  const handleGuidePress = useCallback((id: string) => {
    router.push({ pathname: '/dream-guide/[id]', params: { id } } as any);
  }, []);

  return (
    <ScrollPerfProvider isScrolling={scrollPerf.isScrolling}>
      <LinearGradient
        colors={noctalia.screen.gradient}
        style={styles.container}
        testID="screen.dreamGuides"
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
              accessibilityLabel={copy.screenTitle}
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
            <Text selectable style={[styles.title, { color: noctalia.text.primary }]}>
              {copy.screenTitle}
            </Text>
          </View>

          <Text selectable style={[styles.subtitle, { color: noctalia.text.secondary }]}>
            {copy.screenSubtitle}
          </Text>

          <FlatGlassCard intensity="strong" style={styles.dictionaryCard}>
            <View style={[styles.dictionaryIcon, { backgroundColor: noctalia.surface.soft }]}>
              <IconSymbol name="book.closed.fill" size={24} color={noctalia.accent.base} />
            </View>
            <View style={styles.dictionaryCopy}>
              <Text style={[styles.dictionaryTitle, { color: noctalia.text.primary }]}>
                {copy.dictionaryTitle}
              </Text>
              <Text style={[styles.dictionaryBody, { color: noctalia.text.secondary }]}>
                {copy.dictionaryBody}
              </Text>
              <Pressable
                onPress={() => router.push('/symbol-dictionary')}
                accessibilityRole="button"
                testID="btn.dreamGuides.dictionary"
                style={({ pressed }) => [
                  styles.dictionaryButton,
                  {
                    backgroundColor: noctalia.action.primary,
                    borderColor: noctalia.action.primaryBorder,
                  },
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.dictionaryButtonText, { color: noctalia.action.primaryText }]}>
                  {copy.dictionaryCta}
                </Text>
                <IconSymbol name="arrow.right" size={17} color={noctalia.action.primaryText} />
              </Pressable>
            </View>
          </FlatGlassCard>

          <Text style={[styles.sectionLabel, { color: noctalia.accent.base }]}>
            {copy.featuredLabel}
          </Text>
          <View style={styles.guideList}>
            {guides.map((guide) => (
              <DreamGuideCard
                key={guide.id}
                guide={guide}
                language={language}
                symbolCountLabel={copy.symbolCount(guide.symbols.length)}
                onPress={handleGuidePress}
              />
            ))}
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
    gap: 14,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontFamily: Fonts.fraunces.bold,
    fontSize: 27,
    lineHeight: 34,
  },
  subtitle: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 15,
    lineHeight: 22,
  },
  dictionaryCard: {
    borderRadius: 24,
    borderCurve: 'continuous',
    padding: ThemeLayout.spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: ThemeLayout.spacing.md,
  },
  dictionaryIcon: {
    width: 48,
    height: 48,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dictionaryCopy: {
    flex: 1,
    gap: 8,
  },
  dictionaryTitle: {
    fontFamily: Fonts.fraunces.semiBold,
    fontSize: 19,
    lineHeight: 24,
  },
  dictionaryBody: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 13,
    lineHeight: 19,
  },
  dictionaryButton: {
    alignSelf: 'flex-start',
    minHeight: 42,
    borderRadius: 15,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dictionaryButtonText: {
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 13,
  },
  sectionLabel: {
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 12,
    lineHeight: 16,
    textTransform: 'uppercase',
  },
  guideList: {
    gap: 12,
  },
  pressed: {
    opacity: 0.82,
  },
});
