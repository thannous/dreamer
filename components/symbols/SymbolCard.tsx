import React, { memo, useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { Image } from 'expo-image';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemeLayout } from '@/constants/journalTheme';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { getSymbolIllustration } from '@/constants/symbolIllustrations';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import type { DreamSymbol, SymbolLanguage } from '@/lib/symbolTypes';
import { TID } from '@/lib/testIDs';

interface SymbolCardProps {
  symbol: DreamSymbol;
  language: SymbolLanguage;
  onPress: (id: string) => void;
  variant?: 'card' | 'row';
}

export const SymbolCard = memo(function SymbolCard({ symbol, language, onPress, variant = 'card' }: SymbolCardProps) {
  const { colors, mode } = useTheme();
  const { fontScale } = useWindowDimensions();
  const isRow = variant === 'row';
  const noctalia = getNoctaliaDesignTokens(colors, mode);
  const content = symbol[language] ?? symbol.en;
  const illustration = isRow ? getSymbolIllustration(symbol.id) : undefined;
  const handlePress = useCallback(() => {
    onPress(symbol.id);
  }, [onPress, symbol.id]);

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
  const pressableStyle = useCallback(
    ({ pressed }: { pressed: boolean }) => [
      ...cardStyle,
      pressed && (isRow ? styles.rowPressed : styles.cardPressed),
    ],
    [cardStyle, isRow],
  );

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={content.name}
      testID={TID.List.SymbolItem(symbol.id)}
      style={pressableStyle}>
      {isRow ? (
        <View style={[styles.thumb, { backgroundColor: noctalia.surface.soft }]}>
          {illustration ? <Image source={illustration} contentFit="cover" style={StyleSheet.absoluteFill} /> : null}
        </View>
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
    </Pressable>
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
  rowTitle: { fontFamily: Fonts.fraunces.medium, fontSize: 19, lineHeight: 25 },
  rowDescription: { fontSize: 14, lineHeight: 21 },
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
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 15,
  },
  description: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 13,
    lineHeight: 18,
  },
});
