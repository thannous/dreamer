import React, { memo, useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemeLayout } from '@/constants/journalTheme';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import type { DreamGuide, DreamGuideLanguage } from '@/lib/dreamGuideTypes';
import { getDreamGuideContent, getDreamGuideIcon } from '@/services/dreamGuideService';

interface DreamGuideCardProps {
  guide: DreamGuide;
  language: DreamGuideLanguage;
  metaLabel: string;
  onPress: (id: string) => void;
}

export const DreamGuideCard = memo(function DreamGuideCard({
  guide,
  language,
  metaLabel,
  onPress,
}: DreamGuideCardProps) {
  const { colors, mode } = useTheme();
  const noctalia = getNoctaliaDesignTokens(colors, mode);
  const content = getDreamGuideContent(guide, language);
  const handlePress = useCallback(() => onPress(guide.id), [guide.id, onPress]);

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={content.title}
      testID={`dream-guide-${guide.id}`}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: noctalia.surface.raised,
          borderColor: noctalia.surface.border,
        },
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: noctalia.surface.soft }]}>
        <IconSymbol
          name={getDreamGuideIcon(guide.id)}
          size={22}
          color={noctalia.accent.base}
        />
      </View>
      <View style={styles.copy}>
        <Text style={[styles.title, { color: noctalia.text.primary }]} numberOfLines={2}>
          {content.title}
        </Text>
        <Text style={[styles.description, { color: noctalia.text.secondary }]} numberOfLines={2}>
          {content.metaDescription}
        </Text>
        <Text style={[styles.count, { color: noctalia.accent.base }]}>{metaLabel}</Text>
      </View>
      <IconSymbol name="chevron.right" size={18} color={noctalia.text.tertiary} />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    minHeight: 126,
    borderRadius: ThemeLayout.borderRadius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    padding: ThemeLayout.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: ThemeLayout.spacing.md,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.985 }],
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontFamily: Fonts.fraunces.semiBold,
    fontSize: 18,
    lineHeight: 23,
  },
  description: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  count: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 12,
    lineHeight: 16,
  },
});
