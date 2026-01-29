import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

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
        style={{
          flex: 1,
          backgroundColor: colors.backgroundDark,
          alignItems: 'center',
          justifyContent: 'center',
          gap: ThemeLayout.spacing.md,
        }}>
        <Text
          style={{
            fontFamily: Fonts.spaceGrotesk.medium,
            fontSize: 16,
            color: colors.textSecondary,
          }}>
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
      style={{ flex: 1, backgroundColor: colors.backgroundDark }}
      contentContainerStyle={{ paddingBottom: 40 }}
      contentInsetAdjustmentBehavior="automatic">
      {/* Category badge */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: ThemeLayout.spacing.lg,
          paddingTop: ThemeLayout.spacing.lg,
        }}>
        <IconSymbol name={categoryIcon} size={16} color={colors.accent} />
        <Text
          style={{
            fontFamily: Fonts.spaceGrotesk.medium,
            fontSize: 12,
            color: colors.accent,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}>
          {categoryName}
        </Text>
      </View>

      {/* Title */}
      <Text
        selectable
        style={{
          fontFamily: Fonts.lora.bold,
          fontSize: 28,
          color: colors.textPrimary,
          paddingHorizontal: ThemeLayout.spacing.lg,
          paddingTop: ThemeLayout.spacing.sm,
        }}>
        {content.name}
      </Text>

      {/* Short description */}
      <Text
        selectable
        style={{
          fontFamily: Fonts.spaceGrotesk.regular,
          fontSize: 15,
          color: colors.textSecondary,
          lineHeight: 22,
          paddingHorizontal: ThemeLayout.spacing.lg,
          paddingTop: ThemeLayout.spacing.sm,
        }}>
        {content.shortDescription}
      </Text>

      {/* Full interpretation */}
      {paragraphs.length > 0 && (
        <View style={{ paddingTop: ThemeLayout.spacing.xl }}>
          <SectionTitle text={t('symbols.interpretation')} colors={colors} />
          <View
            style={{
              paddingHorizontal: ThemeLayout.spacing.lg,
              gap: ThemeLayout.spacing.md,
            }}>
            {paragraphs.map((p, i) => (
              <Text
                key={i}
                selectable
                style={{
                  fontFamily: Fonts.lora.regular,
                  fontSize: 15,
                  color: colors.textPrimary,
                  lineHeight: 24,
                }}>
                {p}
              </Text>
            ))}
          </View>
        </View>
      )}

      {/* Variations */}
      {extended?.variations && extended.variations.length > 0 && (
        <View style={{ paddingTop: ThemeLayout.spacing.xl }}>
          <SectionTitle text={t('symbols.variations')} colors={colors} />
          <View
            style={{
              paddingHorizontal: ThemeLayout.spacing.lg,
              gap: ThemeLayout.spacing.sm,
            }}>
            {extended.variations.map((v, i) => (
              <VariationCard key={i} variation={v} colors={colors} shadows={shadows} />
            ))}
          </View>
        </View>
      )}

      {/* Ask yourself */}
      {content.askYourself.length > 0 && (
        <View style={{ paddingTop: ThemeLayout.spacing.xl }}>
          <SectionTitle text={t('symbols.ask_yourself')} colors={colors} />
          <View
            style={{
              paddingHorizontal: ThemeLayout.spacing.lg,
              gap: ThemeLayout.spacing.sm,
            }}>
            {content.askYourself.map((q, i) => (
              <View
                key={i}
                style={{
                  flexDirection: 'row',
                  gap: ThemeLayout.spacing.sm,
                  alignItems: 'flex-start',
                }}>
                <IconSymbol name="questionmark.circle.fill" size={18} color={colors.accent} />
                <Text
                  selectable
                  style={{
                    flex: 1,
                    fontFamily: Fonts.lora.regularItalic,
                    fontSize: 15,
                    color: colors.textPrimary,
                    lineHeight: 22,
                  }}>
                  {q}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Related symbols */}
      {symbol.relatedSymbols.length > 0 && (
        <View style={{ paddingTop: ThemeLayout.spacing.xl }}>
          <SectionTitle text={t('symbols.related')} colors={colors} />
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: ThemeLayout.spacing.sm,
              paddingHorizontal: ThemeLayout.spacing.lg,
            }}>
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
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: ThemeLayout.borderRadius.full,
                    backgroundColor: colors.backgroundCard,
                    opacity: pressed ? 0.7 : 1,
                  })}>
                  <IconSymbol
                    name={getCategoryIcon(related.category)}
                    size={14}
                    color={colors.accent}
                  />
                  <Text
                    style={{
                      fontFamily: Fonts.spaceGrotesk.medium,
                      fontSize: 13,
                      color: colors.textPrimary,
                    }}>
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
      style={{
        fontFamily: Fonts.spaceGrotesk.bold,
        fontSize: 14,
        color: colors.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        paddingHorizontal: ThemeLayout.spacing.lg,
        paddingBottom: ThemeLayout.spacing.sm,
      }}>
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
      style={{
        backgroundColor: colors.backgroundCard,
        borderRadius: ThemeLayout.borderRadius.md,
        borderCurve: 'continuous',
        padding: ThemeLayout.spacing.md,
        gap: 6,
        ...shadows.sm,
      }}>
      <Text
        selectable
        style={{
          fontFamily: Fonts.spaceGrotesk.medium,
          fontSize: 14,
          color: colors.accent,
        }}>
        {variation.context}
      </Text>
      <Text
        selectable
        style={{
          fontFamily: Fonts.spaceGrotesk.regular,
          fontSize: 14,
          color: colors.textPrimary,
          lineHeight: 20,
        }}>
        {variation.meaning}
      </Text>
    </View>
  );
}
