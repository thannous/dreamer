import React from 'react';
import { Text, View } from 'react-native';

import { PressableScale } from '@/components/motion';
import { FullMoonSeal } from '@/components/ui/FullMoonSeal';
import { IconSymbol } from '@/components/ui/icon-symbol';

import { TrendsSectionHead } from './TrendsSectionHead';

type Translate = (key: string, params?: Record<string, string | number>) => string;

/** The full moon letters, past the days Today offers them: the latest one, then the earlier ones listed under it. */
export function TrendsMoonLetters({ t, chevron, onOpen }: {
  t: Translate;
  chevron: string;
  onOpen: () => void;
}) {
  const open = t('trends.moon_letters.open');
  return (
    <View className="gap-5" testID="trends.section.moon_letters">
      <TrendsSectionHead title={t('trends.section.moon_letters')} subtitle={t('trends.moon_letters.body')} />
      <PressableScale onPress={onOpen} haptic="light" accessibilityRole="button" accessibilityLabel={open}
        testID="trends.moon_letters.open"
        className="min-h-[56px] flex-row items-center gap-3 rounded-[18px] border border-line bg-ink-card px-4 py-3">
        <FullMoonSeal size={28} />
        <Text className="min-w-0 flex-1 text-body font-sans-medium text-ivory">{open}</Text>
        <IconSymbol name="chevron.right" size={18} color={chevron} />
      </PressableScale>
    </View>
  );
}
