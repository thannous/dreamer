import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemeLayout } from '@/constants/journalTheme';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import type { SymbolLanguage, SymbolVariation } from '@/lib/symbolTypes';
import {
  getCategoryIcon,
  getCategoryName,
  getExtendedContent,
  getSymbolById,
  parseHtmlParagraphs,
} from '@/services/symbolDictionaryService';

export default function SymbolDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, shadows } = useTheme();
  const { t, currentLang } = useTranslation();
  const lang = (currentLang ?? 'en') as SymbolLanguage;

  const symbol = useMemo(() => getSymbolById(id!), [id]);
  const extended = useMemo(() => (id ? getExtendedContent(id, lang) : undefined), [id, lang]);

  if (!symbol) {
    return (
      <View
        style={[styles.emptyState, { backgroundColor: colors.backgroundDark }]}
      >
        <Text
          style={[styles.emptyText, { color: colors.textSecondary }]}
        >
          {t('symbols.not_found')}
        </Text>
      </View>
    );
  }

  const content = symbol[lang] ?? symbol.en;
  const categoryIcon = getCategoryIcon(symbol.category);
  const categoryName = getCategoryName(symbol.category, lang);
  const paragraphs = extended?.fullInterpretation
    ? parseHtmlParagraphs(extended.fullInterpretation)
    : [];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.backgroundDark }]}
      contentContainerStyle={styles.scrollContent}
      contentInsetAdjustmentBehavior="automatic">
      {/* Category badge */}
      <View
        style={styles.categoryRow}
      >
        <IconSymbol name={categoryIcon} size={16} color={colors.accent} />
        <Text
          style={[styles.categoryText, { color: colors.accent }]}
        >
          {categoryName}
        </Text>
      </View>

      {/* Title */}
      <Text
        selectable
        style={[styles.title, { color: colors.textPrimary }]}
      >
        {content.name}
      </Text>

      {/* Short description */}
      <Text
        selectable
        style={[styles.description, { color: colors.textSecondary }]}
      >
        {content.shortDescription}
      </Text>

      {/* Full interpretation */}
      {paragraphs.length > 0 && (
        <View style={styles.sectionBlock}>
          <SectionTitle text={t('symbols.interpretation')} colors={colors} />
          <View style={styles.sectionBody}>
            {paragraphs.map((p, i) => (
              <Text
                key={`${p}-${i}`}
                selectable
                style={[styles.paragraphText, { color: colors.textPrimary }]}
              >
                {p}
              </Text>
            ))}
          </View>
        </View>
      )}

      {/* Variations */}
      {extended?.variations && extended.variations.length > 0 && (
        <View style={styles.sectionBlock}>
          <SectionTitle text={t('symbols.variations')} colors={colors} />
          <View style={styles.variationsList}>
            {extended.variations.map((v) => (
              <VariationCard
                key={`${v.context}-${v.meaning}`}
                variation={v}
                colors={colors}
                shadows={shadows}
              />
            ))}
          </View>
        </View>
      )}

      {/* Ask yourself */}
      {content.askYourself.length > 0 && (
        <View style={styles.sectionBlock}>
          <SectionTitle text={t('symbols.ask_yourself')} colors={colors} />
          <View style={styles.askList}>
            {content.askYourself.map((q, i) => (
              <View key={`${q}-${i}`} style={styles.askRow}>
                <IconSymbol name="questionmark.circle.fill" size={18} color={colors.accent} />
                <Text
                  selectable
                  style={[styles.askText, { color: colors.textPrimary }]}
                >
                  {q}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Related symbols */}
      {symbol.relatedSymbols.length > 0 && (
        <View style={styles.sectionBlock}>
          <SectionTitle text={t('symbols.related')} colors={colors} />
          <View style={styles.relatedList}>
            {symbol.relatedSymbols.map((relId) => {
              const related = getSymbolById(relId);
              if (!related) return null;
              const relContent = related[lang] ?? related.en;
              return (
                <Pressable
                  key={relId}
                  onPress={() => router.push(`/symbol-detail/${relId}` as any)}
                  accessibilityRole="button"
                  accessibilityLabel={relContent.name}
                  style={({ pressed }) => [
                    styles.relatedButton,
                    {
                      backgroundColor: colors.backgroundCard,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <IconSymbol
                    name={getCategoryIcon(related.category)}
                    size={14}
                    color={colors.accent}
                  />
                  <Text
                    style={[styles.relatedName, { color: colors.textPrimary }]}
                  >
                    {relContent.name}
                  </Text>
                  <IconSymbol name="arrow.right" size={12} color={colors.textTertiary} />
                </Pressable>
              );
            })}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

function SectionTitle({ text, colors }: { text: string; colors: any }) {
  return (
    <Text
      style={[styles.sectionTitle, { color: colors.textSecondary }]}
    >
      {text}
    </Text>
  );
}

function VariationCard({
  variation,
  colors,
  shadows,
}: {
  variation: SymbolVariation;
  colors: any;
  shadows: any;
}) {
  return (
    <View
      style={[styles.variationCard, { backgroundColor: colors.backgroundCard }, shadows.sm]}
    >
      <Text
        selectable
        style={[styles.variationContext, { color: colors.accent }]}
      >
        {variation.context}
      </Text>
      <Text
        selectable
        style={[styles.variationMeaning, { color: colors.textPrimary }]}
      >
        {variation.meaning}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: ThemeLayout.spacing.md,
  },
  emptyText: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 16,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: ThemeLayout.spacing.lg,
    paddingTop: ThemeLayout.spacing.lg,
  },
  categoryText: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  title: {
    fontFamily: Fonts.lora.bold,
    fontSize: 28,
    paddingHorizontal: ThemeLayout.spacing.lg,
    paddingTop: ThemeLayout.spacing.sm,
  },
  description: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 15,
    lineHeight: 22,
    paddingHorizontal: ThemeLayout.spacing.lg,
    paddingTop: ThemeLayout.spacing.sm,
  },
  sectionBlock: {
    paddingTop: ThemeLayout.spacing.xl,
  },
  sectionBody: {
    paddingHorizontal: ThemeLayout.spacing.lg,
    gap: ThemeLayout.spacing.md,
  },
  paragraphText: {
    fontFamily: Fonts.lora.regular,
    fontSize: 15,
    lineHeight: 24,
  },
  variationsList: {
    paddingHorizontal: ThemeLayout.spacing.lg,
    gap: ThemeLayout.spacing.sm,
  },
  askList: {
    paddingHorizontal: ThemeLayout.spacing.lg,
    gap: ThemeLayout.spacing.sm,
  },
  askRow: {
    flexDirection: 'row',
    gap: ThemeLayout.spacing.sm,
    alignItems: 'flex-start',
  },
  askText: {
    flex: 1,
    fontFamily: Fonts.lora.regularItalic,
    fontSize: 15,
    lineHeight: 22,
  },
  relatedList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ThemeLayout.spacing.sm,
    paddingHorizontal: ThemeLayout.spacing.lg,
  },
  relatedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: ThemeLayout.borderRadius.full,
  },
  relatedName: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 13,
  },
  sectionTitle: {
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: ThemeLayout.spacing.lg,
    paddingBottom: ThemeLayout.spacing.sm,
  },
  variationCard: {
    borderRadius: ThemeLayout.borderRadius.md,
    borderCurve: 'continuous',
    padding: ThemeLayout.spacing.md,
    gap: 6,
  },
  variationContext: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 14,
  },
  variationMeaning: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 14,
    lineHeight: 20,
  },
});
