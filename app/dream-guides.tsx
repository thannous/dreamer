import React, { useCallback, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DreamGuideCard } from '@/components/guides/DreamGuideCard';
import { AtmosphericBackground } from '@/components/inspiration/AtmosphericBackground';
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
import { getGeneralDreamGuides, getImportantDreamGuides } from '@/services/dreamGuideService';
import { getAllSymbols } from '@/services/symbolDictionaryService';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function DreamGuidesScreen() {
  const { colors, mode } = useTheme();
  const insets = useSafeAreaInsets();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const { currentLang, t } = useTranslation();
  const language = (currentLang ?? 'en') as DreamGuideLanguage;
  const copy = getDreamGuideCopy(language);
  const generalGuides = getGeneralDreamGuides();
  const symbolGuides = getImportantDreamGuides();
  const scrollPerf = useScrollIdle();

  const handleGuidePress = useCallback((id: string) => {
    router.push({ pathname: '/dream-guide/[id]', params: { id } });
  }, []);

  return (
    <ScrollPerfProvider isScrolling={scrollPerf.isScrolling}>
      <View
        style={[styles.container, { backgroundColor: noctalia.screen.background }]}
        testID="screen.dreamGuides"
      >
        <AtmosphericBackground variant="subtle" scene="path" />
        <ScrollView
          style={styles.scrollView}
          contentInsetAdjustmentBehavior="never"
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top + 20, paddingBottom: insets.bottom + ThemeLayout.spacing.xl },
          ]}
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
              accessibilityLabel={t('navigation.back')}
              style={[
                styles.backButton,
                { backgroundColor: noctalia.surface.raised, borderColor: noctalia.surface.border },
              ]}
            >
              <IconSymbol name="chevron.left" size={21} color={noctalia.text.secondary} />
            </Pressable>
            <Text selectable accessibilityRole="header" style={[styles.title, { color: noctalia.text.primary }]}>
              {copy.screenTitle}
            </Text>
          </View>

          <Text selectable style={[styles.subtitle, { color: noctalia.text.secondary }]}>
            {copy.screenSubtitle}
          </Text>

          <View>
            <Text accessibilityRole="header" style={[styles.sectionLabel, { color: noctalia.accent.text }]}>
              {copy.practicalLabel}
            </Text>
            {generalGuides.map((guide, index) => (
              <DreamGuideCard
                key={guide.id}
                guide={guide}
                language={language}
                metaLabel={copy.readingTime(guide.readingMinutes)}
                onPress={handleGuidePress}
                showSeparator={index < generalGuides.length - 1}
              />
            ))}
          </View>

          <View
            style={[
              styles.dictionaryCard,
              { backgroundColor: noctalia.surface.raised, borderColor: noctalia.surface.border },
            ]}
          >
            <View style={styles.dictionaryHeader}>
              <View accessible={false} style={styles.dictionaryIcon}>
                <IconSymbol name="book.closed.fill" size={26} color={noctalia.accent.text} />
              </View>
              <Text style={[styles.dictionaryTitle, { color: noctalia.text.primary }]}>
                {copy.dictionaryTitle}
              </Text>
            </View>
            <Text style={[styles.dictionaryBody, { color: noctalia.text.secondary }]}>
              {copy.dictionaryBody(getAllSymbols().length)}
            </Text>
            <Pressable
              onPress={() => router.push('/symbol-dictionary')}
              accessibilityRole="button"
              testID="btn.dreamGuides.dictionary"
              style={({ pressed }) => [
                styles.dictionaryButton,
                { backgroundColor: noctalia.action.primary, borderColor: noctalia.action.primaryBorder },
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.dictionaryButtonText, { color: noctalia.action.primaryText }]}>
                {copy.dictionaryCta}
              </Text>
              <View accessible={false}>
                <IconSymbol name="arrow.right" size={17} color={noctalia.action.primaryText} />
              </View>
            </Pressable>
          </View>

          <View>
            <Text accessibilityRole="header" style={[styles.sectionLabel, { color: noctalia.accent.text }]}>
              {copy.symbolGuidesLabel}
            </Text>
            {symbolGuides.map((guide, index) => (
              <DreamGuideCard
                key={guide.id}
                guide={guide}
                language={language}
                metaLabel={copy.symbolCount(guide.symbols.length)}
                onPress={handleGuidePress}
                showSeparator={index < symbolGuides.length - 1}
              />
            ))}
          </View>
        </ScrollView>
      </View>
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
    paddingHorizontal: ThemeLayout.spacing.lg20,
    paddingBottom: ThemeLayout.spacing.xl,
    gap: ThemeLayout.spacing.lg20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    minWidth: 0,
    fontFamily: Fonts.fraunces.bold,
    fontSize: 27,
    lineHeight: 34,
  },
  subtitle: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 15,
    lineHeight: 22,
  },
  sectionLabel: {
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  dictionaryCard: {
    borderRadius: 20,
    borderCurve: 'continuous',
    borderWidth: 1,
    padding: ThemeLayout.spacing.md,
    gap: 12,
  },
  dictionaryHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  dictionaryIcon: {
    width: 28,
    minHeight: 26,
    flexShrink: 0,
    alignItems: 'center',
  },
  dictionaryTitle: {
    flex: 1,
    minWidth: 0,
    fontFamily: Fonts.fraunces.semiBold,
    fontSize: 19,
    lineHeight: 25,
  },
  dictionaryBody: {
    marginLeft: 40,
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 14,
    lineHeight: 21,
  },
  dictionaryButton: {
    minHeight: 44,
    borderRadius: 15,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dictionaryButtonText: {
    flexShrink: 1,
    minWidth: 0,
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 13,
    lineHeight: 20,
  },
  pressed: {
    opacity: 0.82,
  },
});
