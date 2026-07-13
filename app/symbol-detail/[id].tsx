import { FlatGlassCard } from '@/components/inspiration/GlassCard';
import { AtmosphericBackground } from '@/components/inspiration/AtmosphericBackground';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { DecoLines, ThemeLayout } from '@/constants/journalTheme';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { ScrollPerfProvider } from '@/context/ScrollPerfContext';
import { useOnboarding } from '@/context/OnboardingContext';
import { useTheme } from '@/context/ThemeContext';
import { useScrollIdle } from '@/hooks/useScrollIdle';
import { useTranslation } from '@/hooks/useTranslation';
import { MotiView } from '@/lib/moti';
import { buildFirstValueProperties } from '@/lib/activationAnalytics';
import { trackProductEvent } from '@/lib/analytics';
import { TID } from '@/lib/testIDs';
import type { SymbolLanguage, SymbolVariation } from '@/lib/symbolTypes';
import {
  getCategoryIcon,
  getCategoryName,
  getExtendedContent,
  getRelatedSymbols,
  getSymbolById,
  parseHtmlParagraphs,
} from '@/services/symbolDictionaryService';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function SymbolDetailScreen() {
  const { id, source } = useLocalSearchParams<{ id: string; source?: string }>();
  const { state: onboardingState } = useOnboarding();
  const { colors, shadows, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const { t, currentLang } = useTranslation();
  const lang = (currentLang ?? 'en') as SymbolLanguage;
  const scrollPerf = useScrollIdle();
  const trackedSymbolRef = useRef<string | null>(null);

  const symbol = useMemo(() => getSymbolById(id!), [id]);
  const extended = useMemo(() => (id ? getExtendedContent(id, lang) : undefined), [id, lang]);
  const relatedSymbols = useMemo(() => (symbol ? getRelatedSymbols(symbol) : []), [symbol]);

  useEffect(() => {
    if (!symbol || trackedSymbolRef.current === symbol.id) return;
    trackedSymbolRef.current = symbol.id;

    const analyticsSource =
      source === 'onboarding' || source === 'dictionary' || source === 'search'
        ? source
        : 'unknown';
    void trackProductEvent('symbol_detail_viewed', { source: analyticsSource });

    if (source === 'onboarding' && onboardingState.completionReason === 'dictionary') {
      void trackProductEvent(
        'first_value_viewed',
        buildFirstValueProperties(onboardingState, 'symbol_detail')
      );
    }
  }, [onboardingState, source, symbol]);

  const gradientColors = noctalia.screen.gradient;

  const glassBackground = noctalia.surface.raised;

  if (!symbol) {
    return (
      <ScrollPerfProvider isScrolling={scrollPerf.isScrolling}>
        <LinearGradient colors={gradientColors} style={styles.emptyState}>
          <AtmosphericBackground />
          <Text
            style={[styles.emptyText, { color: noctalia.text.secondary }]}
          >
            {t('symbols.not_found')}
          </Text>
        </LinearGradient>
      </ScrollPerfProvider>
    );
  }

  const content = symbol[lang] ?? symbol.en;
  const categoryIcon = getCategoryIcon(symbol.category);
  const categoryName = getCategoryName(symbol.category, lang);
  const paragraphs = extended?.fullInterpretation
    ? parseHtmlParagraphs(extended.fullInterpretation)
    : [];

  return (
    <ScrollPerfProvider isScrolling={scrollPerf.isScrolling}>
      <LinearGradient colors={gradientColors} style={styles.gradient} testID={TID.Screen.SymbolDetail}>
        <AtmosphericBackground />
        {/* Floating Back Button */}
        <Pressable
          onPress={() => router.back()}
          style={[styles.floatingBackButton, shadows.lg, {
            backgroundColor: noctalia.surface.raised,
            borderWidth: 1,
            borderColor: noctalia.surface.border,
          }]}
          accessibilityRole="button"
          accessibilityLabel={t('journal.back_button')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <IconSymbol name="chevron.left" size={22} color={noctalia.accent.base} />
        </Pressable>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          onScrollBeginDrag={scrollPerf.onScrollBeginDrag}
          onScrollEndDrag={scrollPerf.onScrollEndDrag}
          onMomentumScrollBegin={scrollPerf.onMomentumScrollBegin}
          onMomentumScrollEnd={scrollPerf.onMomentumScrollEnd}
        >
        {/* Header card: badge + title + description */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 600 }}
        >
          <FlatGlassCard style={styles.headerCard} animationDelay={0}>
            {/* Category badge */}
            <View style={styles.categoryRow}>
              <IconSymbol name={categoryIcon} size={16} color={noctalia.accent.base} />
              <Text style={[styles.categoryText, { color: noctalia.accent.base }]}>
                {categoryName}
              </Text>
            </View>

            {/* Decorative rule */}
            <View style={[DecoLines.rule, styles.headerRule, { backgroundColor: noctalia.accent.base }]} />

            {/* Title */}
            <Text
              selectable
              style={[styles.title, { color: noctalia.text.primary }]}
            >
              {content.name}
            </Text>

            {/* Short description */}
            <Text
              selectable
              style={[styles.description, { color: noctalia.text.secondary }]}
            >
              {content.shortDescription}
            </Text>
          </FlatGlassCard>
        </MotiView>

        {/* Full interpretation */}
        {paragraphs.length > 0 && (
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 600, delay: 200 }}
            style={styles.sectionBlock}
          >
            <SectionTitle text={t('symbols.interpretation')} noctalia={noctalia} />
            <FlatGlassCard style={styles.contentCard} animationDelay={0}>
              {paragraphs.map((p, i) => (
                <Text
                  key={`${p}-${i}`}
                  selectable
                  style={[styles.paragraphText, { color: noctalia.text.primary }]}
                >
                  {p}
                </Text>
              ))}
            </FlatGlassCard>
          </MotiView>
        )}

        {/* Variations */}
        {extended?.variations && extended.variations.length > 0 && (
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 600, delay: 300 }}
            style={styles.sectionBlock}
          >
            <SectionTitle text={t('symbols.variations')} noctalia={noctalia} />
            <View style={styles.variationsList}>
              {extended.variations.map((v, index) => (
                <VariationCard
                  key={`${v.context}-${v.meaning}`}
                  variation={v}
                  noctalia={noctalia}
                  index={index}
                />
              ))}
            </View>
          </MotiView>
        )}

        {/* Ask yourself */}
        {content.askYourself.length > 0 && (
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 600, delay: 400 }}
            style={styles.sectionBlock}
          >
            <SectionTitle text={t('symbols.ask_yourself')} noctalia={noctalia} />
            <FlatGlassCard style={styles.contentCard} animationDelay={0}>
              {content.askYourself.map((q, i) => (
                <View key={`${q}-${i}`} style={styles.askRow}>
                  <IconSymbol name="questionmark.circle.fill" size={18} color={noctalia.accent.base} />
                  <Text
                    selectable
                    style={[styles.askText, { color: noctalia.text.primary }]}
                  >
                    {q}
                  </Text>
                </View>
              ))}
            </FlatGlassCard>
          </MotiView>
        )}

        {/* Related symbols */}
        {relatedSymbols.length > 0 && (
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 600, delay: 500 }}
            style={styles.sectionBlock}
          >
            <SectionTitle text={t('symbols.related')} noctalia={noctalia} />
            <View style={styles.relatedList}>
              {relatedSymbols.map((related) => {
                const relId = related.id;
                const relContent = related[lang] ?? related.en;
                return (
                  <Pressable
                    key={relId}
                    onPress={() => router.replace(`/symbol-detail/${relId}` as any)}
                    accessibilityRole="button"
                    accessibilityLabel={relContent.name}
                    style={({ pressed }) => [
                      styles.relatedButton,
                      {
                        backgroundColor: glassBackground,
                        borderWidth: 1,
                        borderColor: noctalia.surface.border,
                        opacity: pressed ? 0.7 : 1,
                        transform: [{ scale: pressed ? 0.96 : 1 }],
                      },
                    ]}
                  >
                    <IconSymbol
                      name={getCategoryIcon(related.category)}
                      size={14}
                      color={noctalia.accent.base}
                    />
                    <Text
                      style={[styles.relatedName, { color: noctalia.text.primary }]}
                    >
                      {relContent.name}
                    </Text>
                    <IconSymbol name="arrow.right" size={12} color={noctalia.text.tertiary} />
                  </Pressable>
                );
              })}
            </View>
          </MotiView>
        )}
        </ScrollView>
      </LinearGradient>
    </ScrollPerfProvider>
  );
}

function SectionTitle({
  text,
  noctalia,
}: {
  text: string;
  noctalia: ReturnType<typeof getNoctaliaDesignTokens>;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text
        style={[styles.sectionTitle, { color: noctalia.text.secondary }]}
      >
        {text}
      </Text>
      <View style={[styles.sectionTitleRule, { backgroundColor: noctalia.accent.base }]} />
    </View>
  );
}

function VariationCard({
  variation,
  noctalia,
  index,
}: {
  variation: SymbolVariation;
  noctalia: ReturnType<typeof getNoctaliaDesignTokens>;
  index: number;
}) {
  return (
    <MotiView
      from={{ opacity: 0, translateY: 12 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 400, delay: index * 100 }}
    >
      <View
        style={[styles.variationCard, {
          backgroundColor: noctalia.surface.raised,
          borderWidth: 1,
          borderColor: noctalia.surface.border,
        }]}
      >
        <Text
          selectable
          style={[styles.variationContext, { color: noctalia.accent.base }]}
        >
          {variation.context}
        </Text>
        <View style={[styles.variationDivider, { backgroundColor: noctalia.accent.base }]} />
        <Text
          selectable
          style={[styles.variationMeaning, { color: noctalia.text.primary }]}
        >
          {variation.meaning}
        </Text>
      </View>
    </MotiView>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 64,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: ThemeLayout.spacing.md,
    overflow: 'hidden',
    position: 'relative',
  },
  emptyText: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 16,
  },
  floatingBackButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 50,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCard: {
    marginHorizontal: ThemeLayout.spacing.lg20,
    marginTop: 108,
    paddingHorizontal: ThemeLayout.spacing.lg,
    paddingTop: 28,
    paddingBottom: ThemeLayout.spacing.lg,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryText: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 12,
    textTransform: 'uppercase',
  },
  headerRule: {
    marginTop: 14,
    marginBottom: 10,
    alignSelf: 'flex-start',
  },
  title: {
    fontFamily: Fonts.fraunces.semiBold,
    fontSize: 28,
    lineHeight: 36,
  },
  description: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 15,
    lineHeight: 23,
    marginTop: 12,
  },
  sectionBlock: {
    marginTop: 36,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: ThemeLayout.spacing.lg,
    marginBottom: 14,
  },
  sectionTitle: {
    fontFamily: Fonts.fraunces.medium,
    fontSize: 13,
    textTransform: 'uppercase',
  },
  sectionTitleRule: {
    flex: 1,
    height: 1,
    opacity: 0.3,
  },
  contentCard: {
    marginHorizontal: ThemeLayout.spacing.lg20,
    paddingHorizontal: ThemeLayout.spacing.lg,
    paddingVertical: ThemeLayout.spacing.lg,
    gap: 18,
  },
  paragraphText: {
    fontFamily: Fonts.lora.regular,
    fontSize: 15,
    lineHeight: 25,
  },
  variationsList: {
    paddingHorizontal: ThemeLayout.spacing.lg20,
    gap: 10,
  },
  variationCard: {
    borderRadius: ThemeLayout.borderRadius.md,
    borderCurve: 'continuous',
    paddingHorizontal: ThemeLayout.spacing.md,
    paddingVertical: 14,
    gap: 8,
  },
  variationDivider: {
    height: 1,
    opacity: 0.2,
  },
  variationContext: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 14,
  },
  variationMeaning: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 14,
    lineHeight: 21,
  },
  askRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  askText: {
    flex: 1,
    fontFamily: Fonts.lora.regularItalic,
    fontSize: 15,
    lineHeight: 23,
  },
  relatedList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: ThemeLayout.spacing.lg20,
  },
  relatedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: ThemeLayout.borderRadius.full,
  },
  relatedName: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 13,
  },
});
