import React, { memo, useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PressableScale } from '@/components/motion';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import type { DreamGuide, DreamGuideLanguage } from '@/lib/dreamGuideTypes';
import { getDreamGuideContent, getDreamGuideIcon } from '@/services/dreamGuideService';
import { TypeScale } from '@/constants/typeScale';

interface DreamGuideCardProps {
  guide: DreamGuide;
  language: DreamGuideLanguage;
  metaLabel: string;
  progressLabel?: string;
  onPress: (id: string) => void;
  showSeparator?: boolean;
}

export const DreamGuideCard = memo(function DreamGuideCard({
  guide,
  language,
  metaLabel,
  progressLabel,
  onPress,
  showSeparator = true,
}: DreamGuideCardProps) {
  const { colors, mode } = useTheme();
  const noctalia = getNoctaliaDesignTokens(colors, mode);
  const content = getDreamGuideContent(guide, language);
  const handlePress = useCallback(() => onPress(guide.id), [guide.id, onPress]);

  return (
    <PressableScale
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`${content.title}. ${metaLabel}${progressLabel ? `. ${progressLabel}` : ''}`}
      accessibilityHint={content.metaDescription}
      testID={`dream-guide-${guide.id}`}
      // Adjacent reading rows already provide a generous, separate touch target.
      hitSlop={0}
      style={[
        styles.row,
        { borderBottomColor: noctalia.surface.border, borderBottomWidth: showSeparator ? 1 : 0 },
      ]}
    >
      <View accessible={false} style={styles.iconWrap}>
        <IconSymbol name={getDreamGuideIcon(guide.id)} size={24} color={noctalia.accent.text} />
      </View>
      <View style={styles.copy}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: noctalia.text.primary }]}>
            {content.title}
          </Text>
          <View accessible={false} style={styles.chevron}>
            <IconSymbol name="chevron.right" size={18} color={noctalia.text.tertiary} />
          </View>
        </View>
        <Text style={[styles.description, { color: noctalia.text.secondary }]}>
          {content.metaDescription}
        </Text>
        <Text style={[styles.metadata, { color: noctalia.accent.text }]}>{metaLabel}</Text>
        {progressLabel ? <Text testID={`guide-progress-${guide.id}`} style={[styles.metadata, { color: noctalia.text.secondary }]}>{progressLabel}</Text> : null}
      </View>
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  row: {
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  iconWrap: {
    width: 32,
    minHeight: 24,
    paddingTop: 2,
    flexShrink: 0,
    alignItems: 'center',
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  title: {
    flex: 1,
    minWidth: 0,
    fontFamily: Fonts.fraunces.semiBold,
    fontSize: TypeScale.h3.fontSize,
    lineHeight: 24,
  },
  chevron: {
    paddingTop: 3,
    flexShrink: 0,
  },
  description: {
    fontFamily: Fonts.outfit.regular,
    fontSize: TypeScale.bodySm.fontSize,
    lineHeight: 20,
  },
  metadata: {
    fontFamily: Fonts.outfit.medium,
    fontSize: TypeScale.caption.fontSize,
    lineHeight: 17,
  },
});
