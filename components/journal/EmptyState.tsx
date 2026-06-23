import { ThemeLayout } from '@/constants/journalTheme';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { useFadeInUp } from '@/hooks/useJournalAnimations';
import { useTranslation } from '@/hooks/useTranslation';
import { TID } from '@/lib/testIDs';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import { IconSymbol } from '@/components/ui/icon-symbol';

function MoonStarsIcon({ size = 64, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      {/* Crescent moon */}
      <Path
        d="M38 8c-1.6 0-3.16.16-4.66.46A20 20 0 0 1 44 28a20 20 0 0 1-10.66 17.54c1.5.3 3.06.46 4.66.46 11.05 0 20-8.95 20-19S49.05 8 38 8z"
        fill={color}
        opacity={0.8}
      />
      {/* Stars */}
      <Circle cx={12} cy={12} r={2} fill={color} opacity={0.6} />
      <Circle cx={22} cy={6} r={1.5} fill={color} opacity={0.4} />
      <Circle cx={8} cy={24} r={1.2} fill={color} opacity={0.5} />
      <Circle cx={16} cy={48} r={1.8} fill={color} opacity={0.35} />
      <Circle cx={6} cy={38} r={1} fill={color} opacity={0.45} />
    </Svg>
  );
}

interface EmptyStateProps {
  /** Whether a filter is currently active (shows different message) */
  hasActiveFilter: boolean;
  onClearFilters?: () => void;
  onStartRememberedDream?: () => void;
}

export function EmptyState({
  hasActiveFilter,
  onClearFilters,
  onStartRememberedDream,
}: EmptyStateProps) {
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const { t } = useTranslation();
  const animatedStyle = useFadeInUp(100);
  const showRememberedAction = !hasActiveFilter && !!onStartRememberedDream;

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <MoonStarsIcon size={64} color={noctalia.text.tertiary} />
      <View style={styles.copy}>
        <Text style={[styles.title, { color: noctalia.text.primary }]}>
          {hasActiveFilter ? t('journal.empty.filtered') : t('journal.empty.default')}
        </Text>
        {showRememberedAction ? (
          <Text style={[styles.body, { color: noctalia.text.secondary }]}>
            {t('journal.empty.remembered_hint')}
          </Text>
        ) : null}
      </View>
      {showRememberedAction ? (
        <Pressable
          style={[styles.primaryButton, { backgroundColor: noctalia.action.primary, borderColor: noctalia.action.primaryBorder }]}
          onPress={onStartRememberedDream}
          accessibilityRole="button"
          accessibilityLabel={t('journal.empty.remembered_cta')}
          testID={TID.Button.EmptyStartRememberedDream}
        >
          <IconSymbol name="pencil" size={18} color={noctalia.action.primaryText} />
          <Text style={[styles.primaryText, { color: noctalia.action.primaryText }]}>
            {t('journal.empty.remembered_cta')}
          </Text>
        </Pressable>
      ) : null}
      {hasActiveFilter && onClearFilters ? (
        <Pressable
          style={[styles.secondaryButton, { borderColor: noctalia.action.primaryBorder }]}
          onPress={onClearFilters}
          accessibilityRole="button"
          testID={TID.Button.EmptyClearFilters}
        >
          <Text style={[styles.secondaryText, { color: noctalia.accent.base }]}>
            {t('journal.filter.clear')}
          </Text>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 80,
    alignItems: 'center',
    gap: ThemeLayout.spacing.md,
    paddingHorizontal: ThemeLayout.spacing.lg,
  },
  title: {
    fontSize: 16,
    fontFamily: Fonts.spaceGrotesk.regular,
    textAlign: 'center',
    lineHeight: 24,
  },
  copy: {
    alignItems: 'center',
    gap: 8,
  },
  body: {
    fontSize: 14,
    fontFamily: Fonts.spaceGrotesk.regular,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 320,
  },
  primaryButton: {
    marginTop: ThemeLayout.spacing.sm,
    minHeight: 48,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: ThemeLayout.borderRadius.full,
    borderCurve: 'continuous',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
  },
  primaryText: {
    fontSize: 15,
    fontFamily: Fonts.spaceGrotesk.bold,
    textAlign: 'center',
  },
  secondaryButton: {
    marginTop: ThemeLayout.spacing.sm,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: ThemeLayout.borderRadius.full,
    borderCurve: 'continuous',
    borderWidth: 1,
  },
  secondaryText: {
    fontSize: 16,
    fontFamily: Fonts.spaceGrotesk.bold,
  },
});
