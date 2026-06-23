import React, { useMemo } from 'react';
import { Text, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemeLayout } from '@/constants/journalTheme';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
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
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
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
        <IconSymbol name={icon} size={18} color={noctalia.accent.base} />
        <Text
          style={{
            flex: 1,
            fontFamily: Fonts.fraunces.medium,
            fontSize: 16,
            color: noctalia.text.primary,
            textTransform: 'uppercase',
          }}>
          {name}
        </Text>
        <Text
          style={{
            fontFamily: Fonts.spaceGrotesk.regular,
            fontSize: 13,
            color: noctalia.text.tertiary,
            fontVariant: ['tabular-nums'],
          }}>
          {count}
        </Text>
      </View>
      <View
        style={{
          height: 1,
          backgroundColor: noctalia.accent.base,
          opacity: 0.3,
        }}
      />
    </View>
  );
}
