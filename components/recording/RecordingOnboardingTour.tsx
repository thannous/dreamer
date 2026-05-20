import { ThemeLayout } from '@/constants/journalTheme';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { TID } from '@/lib/testIDs';
import React, { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { RecordingSpotlightRect } from './RecordingOnboardingSpotlightOverlay';

export type RecordingOnboardingTarget = 'voice' | 'text' | 'explore';

export const RECORDING_ONBOARDING_TARGETS: RecordingOnboardingTarget[] = ['voice', 'text', 'explore'];

export function RecordingOnboardingTour({
  target,
  index,
  total,
  onNext,
  onSkip,
  onSpotlightLayout,
  spotlightMeasureKey = 0,
}: {
  target: RecordingOnboardingTarget;
  index: number;
  total: number;
  onNext: () => void;
  onSkip: () => void;
  onSpotlightLayout?: (rect: RecordingSpotlightRect) => void;
  spotlightMeasureKey?: number;
}) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const isLast = index >= total - 1;
  const cardRef = useRef<View | null>(null);

  useEffect(() => {
    if (!onSpotlightLayout) {
      return;
    }

    const measureCard = () => {
      cardRef.current?.measureInWindow((x, y, width, height) => {
        onSpotlightLayout({ x, y, width, height });
      });
    };

    const frame = requestAnimationFrame(measureCard);
    const timeout = setTimeout(measureCard, 220);

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timeout);
    };
  }, [index, onSpotlightLayout, spotlightMeasureKey, target]);

  return (
    <View
      ref={cardRef}
      collapsable={false}
      style={[
        styles.card,
        {
          backgroundColor: colors.backgroundCard,
          borderColor: `${colors.accentLight}55`,
        },
      ]}
      testID={TID.Component.RecordingOnboardingTour}
    >
      <View style={styles.copy}>
        <View
          style={[
            styles.stepBadge,
            {
              backgroundColor: colors.backgroundSecondary,
              borderColor: colors.divider,
            },
          ]}
        >
          <Text style={[styles.stepText, { color: colors.textPrimary }]}>
            {t('recording.onboarding.step_count', { current: index + 1, total })}
          </Text>
        </View>
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          {t(`recording.onboarding.${target}.body`)}
        </Text>
      </View>

      <View style={styles.actions}>
        <Pressable
          onPress={onSkip}
          style={styles.skipButton}
          accessibilityRole="button"
          testID={TID.Button.RecordingOnboardingSkip}
        >
          <Text style={[styles.skipText, { color: colors.textSecondary }]}>
            {t('recording.onboarding.skip')}
          </Text>
        </Pressable>
        <Pressable
          onPress={onNext}
          style={[styles.nextButton, { backgroundColor: colors.backgroundSecondary }]}
          accessibilityRole="button"
          testID={TID.Button.RecordingOnboardingNext}
        >
          <Text style={[styles.nextText, { color: colors.textPrimary }]}>
            {isLast ? t('recording.onboarding.done') : t('recording.onboarding.next')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: ThemeLayout.borderRadius.md,
    borderCurve: 'continuous',
    padding: ThemeLayout.spacing.md,
    gap: ThemeLayout.spacing.md,
  },
  copy: {
    alignItems: 'flex-start',
    gap: 8,
  },
  stepBadge: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: ThemeLayout.borderRadius.full,
    borderCurve: 'continuous',
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  stepText: {
    fontSize: 11,
    fontFamily: Fonts.spaceGrotesk.bold,
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  body: {
    fontSize: 15,
    lineHeight: 21,
    fontFamily: Fonts.spaceGrotesk.regular,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 10,
  },
  skipButton: {
    paddingVertical: 9,
    paddingHorizontal: 4,
  },
  skipText: {
    fontSize: 13,
    fontFamily: Fonts.spaceGrotesk.medium,
  },
  nextButton: {
    minHeight: 38,
    borderRadius: ThemeLayout.borderRadius.full,
    borderCurve: 'continuous',
    paddingHorizontal: 14,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextText: {
    fontSize: 13,
    fontFamily: Fonts.spaceGrotesk.bold,
  },
});
