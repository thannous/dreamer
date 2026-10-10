import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useMemo } from 'react';
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';

import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';

import { paintSweep } from './dreamStoryMotion';

const ASTRAL_ART = require('@/assets/images/onboarding-astral-background.webp');
const CANVAS = 112;

/**
 * Act III while the illustration is made: the same night window as the saved moment,
 * crossed by a band of light like a brush. It says "being painted" without a percentage;
 * the copy distinguishes a queued request from one already running.
 *
 * The test ID is the historical pending-illustration contract that journeys assert.
 */
export function DreamPaintingWait({ queued }: { queued: boolean }) {
  const { t } = useTranslation();
  const { colors, mode } = useTheme();
  const reduced = useReducedMotion();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const sweep = useMemo(() => paintSweep(CANVAS, reduced), [reduced]);

  return (
    <View testID="journal.detail.image.generation_dots" accessibilityLiveRegion="polite"
      className="items-center gap-3 rounded-lg bg-ink-soft px-5 py-6">
      <View accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden
        className="overflow-hidden rounded-full border border-line bg-ink" style={{ width: CANVAS, height: CANVAS }}>
        <Image source={ASTRAL_ART} contentFit="cover" style={{ width: '100%', height: '100%', opacity: 0.45 }} />
        <Animated.View className="absolute" style={[{ top: -CANVAS * 0.25, left: CANVAS * 0.25, width: CANVAS * 0.5, height: CANVAS * 1.5 }, sweep] as StyleProp<ViewStyle>}>
          <LinearGradient
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            colors={[`${noctalia.accent.text}00`, `${noctalia.accent.text}66`, `${noctalia.accent.text}00`]}
            style={{ width: '100%', height: '100%' }}
          />
        </Animated.View>
      </View>
      <Text className="text-center font-display-medium text-[18px] leading-6 text-ivory">
        {t('journal.detail.image.painting_title')}
      </Text>
      <Text className="text-center font-sans text-[14px] leading-5 text-ivory-muted">
        {t(queued ? 'journal.detail.image.queued_subtitle' : 'journal.detail.image.painting_body')}
      </Text>
    </View>
  );
}
