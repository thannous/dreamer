import React, { memo, useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemeLayout } from '@/constants/journalTheme';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import type { DreamSymbol, SymbolLanguage } from '@/lib/symbolTypes';

interface SymbolCardProps {
  symbol: DreamSymbol;
  language: SymbolLanguage;
  onPress: (id: string) => void;
}

export const SymbolCard = memo(function SymbolCard({ symbol, language, onPress }: SymbolCardProps) {
  const { colors, mode } = useTheme();
  const noctalia = getNoctaliaDesignTokens(colors, mode);
  const content = symbol[language] ?? symbol.en;
  const handlePress = useCallback(() => {
    onPress(symbol.id);
  }, [onPress, symbol.id]);

  const glassBackground = noctalia.surface.raised;
  const cardStyle = useMemo(
    () => [
      styles.card,
      {
        backgroundColor: glassBackground,
        borderColor: noctalia.surface.border,
      },
    ],
    [glassBackground, noctalia.surface.border],
  );
  const contentStyle = useMemo(() => [styles.content, { gap: 2 }], []);
  const titleStyle = useMemo(
    () => [
      styles.title,
      {
        color: noctalia.text.primary,
      },
    ],
    [noctalia.text.primary],
  );
  const descriptionStyle = useMemo(
    () => [
      styles.description,
      {
        color: noctalia.text.secondary,
      },
    ],
    [noctalia.text.secondary],
  );
  const pressableStyle = useCallback(
    ({ pressed }: { pressed: boolean }) => [
      ...cardStyle,
      pressed && styles.cardPressed,
    ],
    [cardStyle],
  );

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={content.name}
      style={pressableStyle}>
      <View style={contentStyle}>
        <Text
          style={titleStyle}
          numberOfLines={1}>
          {content.name}
        </Text>
        <Text
          style={descriptionStyle}
          numberOfLines={2}>
          {content.shortDescription}
        </Text>
      </View>
      <IconSymbol name="chevron.right" size={16} color={noctalia.text.tertiary} />
    </Pressable>
  );
});

const styles = StyleSheet.create({
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
