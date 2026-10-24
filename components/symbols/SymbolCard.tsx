import { Link } from 'expo-router';
import React, { memo, useMemo } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { SymbolArtwork } from '@/components/symbols/SymbolArtwork';
import { SymbolLink, type SymbolDetailSource } from '@/components/symbols/SymbolLink';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemeLayout } from '@/constants/journalTheme';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import type { DreamSymbol, SymbolLanguage } from '@/lib/symbolTypes';
import { TID } from '@/lib/testIDs';
import { TypeScale } from '@/constants/typeScale';

interface SymbolCardProps {
  symbol: DreamSymbol;
  language: SymbolLanguage;
  source: SymbolDetailSource;
  variant?: 'card' | 'row';
}

export const SymbolCard = memo(function SymbolCard({ symbol, language, source, variant = 'card' }: SymbolCardProps) {
  const { colors, mode } = useTheme();
  const { fontScale } = useWindowDimensions();
  const isRow = variant === 'row';
  const noctalia = getNoctaliaDesignTokens(colors, mode);
  const content = symbol[language] ?? symbol.en;

  const glassBackground = noctalia.surface.raised;
  const cardStyle = useMemo(
    () => [
      isRow ? styles.row : styles.card,
      {
        backgroundColor: isRow ? 'transparent' : glassBackground,
        borderColor: noctalia.surface.border,
      },
    ],
    [glassBackground, isRow, noctalia.surface.border],
  );
  const contentStyle = useMemo(() => [styles.content, { gap: 2 }], []);
  const titleStyle = useMemo(
    () => [
      styles.title,
      isRow && styles.rowTitle,
      {
        color: noctalia.text.primary,
      },
    ],
    [isRow, noctalia.text.primary],
  );
  const descriptionStyle = useMemo(
    () => [
      styles.description,
      isRow && styles.rowDescription,
      {
        color: noctalia.text.secondary,
      },
    ],
    [isRow, noctalia.text.secondary],
  );
  // A zoom source takes one child with a plain style object.
  const thumbStyle = useMemo(
    () => StyleSheet.flatten([styles.thumb, { backgroundColor: noctalia.surface.soft }]),
    [noctalia.surface.soft],
  );

  return (
    <SymbolLink
      symbolId={symbol.id}
      source={source}
      accessibilityLabel={content.name}
      testID={TID.List.SymbolItem(symbol.id)}
      surfaceStyle={cardStyle}
      pressedStyle={isRow ? styles.rowPressed : styles.cardPressed}>
      {isRow ? (
        <Link.AppleZoom>
          <View style={thumbStyle}>
            <SymbolArtwork symbolId={symbol.id} size="thumb" />
          </View>
        </Link.AppleZoom>
      ) : null}
      <View style={contentStyle}>
        <Text
          style={titleStyle}
          numberOfLines={isRow ? undefined : 1}>
          {content.name}
        </Text>
        <Text
          style={descriptionStyle}
          numberOfLines={isRow ? (fontScale >= 1.6 ? undefined : 2) : 2}>
          {content.shortDescription}
        </Text>
      </View>
      <IconSymbol name="chevron.right" size={16} color={noctalia.text.tertiary} />
    </SymbolLink>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
    marginHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowTitle: { fontFamily: Fonts.fraunces.medium, fontSize: TypeScale.h3.fontSize, lineHeight: TypeScale.h3.lineHeight },
  rowDescription: { fontSize: TypeScale.bodySm.fontSize, lineHeight: 21 },
  thumb: { width: 56, height: 56, borderRadius: 12, borderCurve: 'continuous', overflow: 'hidden', alignSelf: 'flex-start', marginTop: 2 },
  rowPressed: { opacity: 0.78 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ThemeLayout.spacing.md,
    paddingVertical: 14,
    paddingHorizontal: ThemeLayout.spacing.md,
    marginHorizontal: ThemeLayout.spacing.md,
    marginBottom: ThemeLayout.spacing.sm,
    borderRadius: ThemeLayout.borderRadius.md,
    borderCurve: 'continuous',
    borderWidth: 1,
  },
  cardPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  content: {
    flex: 1,
  },
  title: {
    fontFamily: Fonts.outfit.medium,
    fontSize: TypeScale.body.fontSize,
  },
  description: {
    fontFamily: Fonts.outfit.regular,
    fontSize: TypeScale.bodySm.fontSize,
    lineHeight: TypeScale.bodySm.lineHeight,
  },
});
