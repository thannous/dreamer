import React from 'react';
import { Text, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemeLayout } from '@/constants/journalTheme';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import type { SymbolCategory, SymbolLanguage } from '@/lib/symbolTypes';
import { getCategoryIcon, getCategoryName } from '@/services/symbolDictionaryService';

interface CategoryHeaderProps {
  category: SymbolCategory;
  count: number;
  language: SymbolLanguage;
}

export function CategoryHeader({ category, count, language }: CategoryHeaderProps) {
  const { colors } = useTheme();
  const icon = getCategoryIcon(category);
  const name = getCategoryName(category, language);

  return (
    <View
      style={{
        paddingHorizontal: ThemeLayout.spacing.md,
        paddingTop: ThemeLayout.spacing.lg,
        paddingBottom: ThemeLayout.spacing.sm,
        gap: 6,
      }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: ThemeLayout.spacing.sm,
        }}>
        <IconSymbol name={icon} size={18} color={colors.accent} />
        <Text
          style={{
            flex: 1,
            fontFamily: Fonts.fraunces.medium,
            fontSize: 16,
            color: colors.textPrimary,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}>
          {name}
        </Text>
        <Text
          style={{
            fontFamily: Fonts.spaceGrotesk.regular,
            fontSize: 13,
            color: colors.textTertiary,
            fontVariant: ['tabular-nums'],
          }}>
          {count}
        </Text>
      </View>
      <View
        style={{
          height: 1,
          backgroundColor: colors.accent,
          opacity: 0.3,
        }}
      />
    </View>
  );
}
