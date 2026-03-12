import React, { memo, useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemeLayout } from '@/constants/journalTheme';
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
  const content = symbol[language] ?? symbol.en;
  const handlePress = useCallback(() => {
    onPress(symbol.id);
  }, [onPress, symbol.id]);

  const glassBackground = mode === 'dark'
    ? 'rgba(35, 26, 63, 0.4)'
    : `${colors.backgroundCard}A6`;
  const cardStyle = useMemo(
    () => [
      styles.card,
      {
        backgroundColor: glassBackground,
        borderColor: colors.divider,
      },
    ],
    [colors.divider, glassBackground],
  );
  const contentStyle = useMemo(() => [styles.content, { gap: 2 }], []);
  const titleStyle = useMemo(
    () => [
      styles.title,
      {
        color: colors.textPrimary,
      },
    ],
    [colors.textPrimary],
  );
  const descriptionStyle = useMemo(
    () => [
      styles.description,
      {
        color: colors.textSecondary,
      },
    ],
    [colors.textSecondary],
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
      <IconSymbol name="chevron.right" size={16} color={colors.textTertiary} />
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
