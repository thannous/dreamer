import React, { useCallback } from 'react';
import { Pressable, Text, View } from 'react-native';

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

export function SymbolCard({ symbol, language, onPress }: SymbolCardProps) {
  const { colors, mode } = useTheme();
  const content = symbol[language] ?? symbol.en;
  const handlePress = useCallback(() => {
    onPress(symbol.id);
  }, [onPress, symbol.id]);

  const glassBackground = mode === 'dark'
    ? 'rgba(35, 26, 63, 0.4)'
    : `${colors.backgroundCard}A6`;

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={content.name}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: ThemeLayout.spacing.md,
        paddingVertical: 14,
        paddingHorizontal: ThemeLayout.spacing.md,
        marginHorizontal: ThemeLayout.spacing.md,
        marginBottom: ThemeLayout.spacing.sm,
        backgroundColor: glassBackground,
        borderRadius: ThemeLayout.borderRadius.md,
        borderCurve: 'continuous',
        borderWidth: 1,
        borderColor: colors.divider,
        opacity: pressed ? 0.8 : 1,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          style={{
            fontFamily: Fonts.spaceGrotesk.medium,
            fontSize: 15,
            color: colors.textPrimary,
          }}
          numberOfLines={1}>
          {content.name}
        </Text>
        <Text
          style={{
            fontFamily: Fonts.spaceGrotesk.regular,
            fontSize: 13,
            color: colors.textSecondary,
            lineHeight: 18,
          }}
          numberOfLines={2}>
          {content.shortDescription}
        </Text>
      </View>
      <IconSymbol name="chevron.right" size={16} color={colors.textTertiary} />
    </Pressable>
  );
}
