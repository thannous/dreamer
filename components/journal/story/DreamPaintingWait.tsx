import { Image } from 'expo-image';
import React from 'react';
import { Text, View } from 'react-native';

import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';

import { PaintingCanvas } from './PaintingCanvas';
import { SEAL_GOLD } from './sealMarks';

const ASTRAL_ART = require('@/assets/images/onboarding-astral-background.webp');
const CANVAS = 112;

/**
 * Act III while the illustration is made: the same night window as the saved moment,
 * painted as the seal's is, under a band of light and a brush. It says "being painted"
 * without a percentage; the copy distinguishes a queued request from one already running.
 *
 * The test ID is the historical pending-illustration contract that journeys assert.
 */
export function DreamPaintingWait({ queued }: { queued: boolean }) {
  const { t } = useTranslation();
  const { mode } = useTheme();

  return (
    <View testID="journal.detail.image.generation_dots" accessibilityLiveRegion="polite"
      className="items-center gap-3 rounded-lg bg-ink-soft px-5 py-6">
      <View accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden
        className="overflow-hidden rounded-full border border-line bg-ink" style={{ width: CANVAS, height: CANVAS }}>
        {/* A dimmed night reads as night on the night ground, but as a grey stain on paper. */}
        <Image source={ASTRAL_ART} contentFit="cover" style={{ width: '100%', height: '100%', opacity: mode === 'dark' ? 0.45 : 0.9 }} />
        <PaintingCanvas travel={CANVAS} ink={SEAL_GOLD} brush={26} />
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
