import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemeLayout } from '@/constants/journalTheme';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import type { DreamSymbol, SymbolLanguage } from '@/lib/symbolTypes';
import { getCategoryIcon } from '@/services/symbolDictionaryService';

interface SymbolCardProps {
  symbol: DreamSymbol;
  language: SymbolLanguage;
  onPress: () => void;
}

export function SymbolCard({ symbol, language, onPress }: SymbolCardProps) {
  const { colors, shadows } = useTheme();
  const content = symbol[language] ?? symbol.en;
  const icon = getCategoryIcon(symbol.category);

  return (
    <Pressable
      onPress={onPress}
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
        backgroundColor: colors.backgroundCard,
        borderRadius: ThemeLayout.borderRadius.md,
        borderCurve: 'continuous',
        opacity: pressed ? 0.8 : 1,
        ...shadows.sm,
      })}>
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: ThemeLayout.borderRadius.sm,
          borderCurve: 'continuous',
          backgroundColor: colors.backgroundSecondary,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <IconSymbol name={icon} size={20} color={colors.accent} />
      </View>
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
