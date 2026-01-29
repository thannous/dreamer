import { ThemeLayout } from '@/constants/journalTheme';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { useFadeInUp } from '@/hooks/useJournalAnimations';
import { useTranslation } from '@/hooks/useTranslation';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import Animated from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

function MoonStarsIcon({ size = 64, color = '#a097b8' }) {
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
}

export function EmptyState({ hasActiveFilter }: EmptyStateProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const animatedStyle = useFadeInUp(100);

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <MoonStarsIcon size={64} color={colors.textTertiary} />
      <Text style={[styles.title, { color: colors.textPrimary }]}>
        {hasActiveFilter ? t('journal.empty.filtered') : t('journal.empty.default')}
      </Text>
      {!hasActiveFilter && (
        <Pressable
          style={[styles.ctaButton, { backgroundColor: colors.accent }]}
          onPress={() => router.push('/recording')}
          accessibilityRole="button"
        >
          <Text style={[styles.ctaText, { color: colors.backgroundCard }]}>
            {t('journal.add_button.label')}
          </Text>
        </Pressable>
      )}
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
  ctaButton: {
    marginTop: ThemeLayout.spacing.sm,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: ThemeLayout.borderRadius.full,
    borderCurve: 'continuous',
  },
  ctaText: {
    fontSize: 16,
    fontFamily: Fonts.spaceGrotesk.bold,
  },
});
