import { router } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';

import { FullMoonSeal } from '@/components/ui/FullMoonSeal';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { getDreamRouteParams } from '@/lib/dreamRoute';
import { getFullMoonMoment } from '@/lib/fullMoon';
import { getLocalDateKey } from '@/lib/ritualProgressUtils';
import { TID } from '@/lib/testIDs';
import type { DreamAnalysis } from '@/lib/types';

/**
 * Once a month, on the day before a full moon's night and on the day after it: the dream
 * noted that day wears the silver seal. The eve only announces it; the morning opens the
 * capture, or the dream that already wears it.
 */
export function HomeFullMoonRow({ dreams, now }: { dreams: DreamAnalysis[]; now: number }) {
  const { colors, mode } = useTheme();
  const ink = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const { t } = useTranslation();
  const moment = useMemo(() => getFullMoonMoment(now), [now]);
  const sealed = useMemo(() => {
    if (moment?.kind !== 'morning') return null;
    return dreams.reduce<DreamAnalysis | null>((latest, dream) =>
      getLocalDateKey(new Date(dream.id)) === moment.morningKey && (!latest || dream.id > latest.id) ? dream : latest, null);
  }, [dreams, moment]);
  if (!moment) return null;

  const label = t(moment.kind === 'eve' ? 'home.full_moon.eve.label' : 'home.full_moon.morning.label');
  const body = t(moment.kind === 'eve' ? 'home.full_moon.eve.body'
    : sealed ? 'home.full_moon.sealed.body' : 'home.full_moon.morning.body');
  const content = (
    <>
      <View className="w-10 items-center"><FullMoonSeal size={28} /></View>
      <View className="min-w-0 flex-1 gap-0.5">
        <Text maxFontSizeMultiplier={1.4}
          className="font-sans-medium text-overline uppercase text-ivory-muted">{label}</Text>
        <Text testID={TID.Text.HomeFullMoon} maxFontSizeMultiplier={1.4}
          className="font-sans text-body leading-[22px] text-ivory">{body}</Text>
      </View>
    </>
  );

  if (moment.kind === 'eve') {
    return (
      <View accessible accessibilityLabel={`${label}. ${body}`} testID={TID.Component.HomeFullMoon}
        className="min-h-[60px] flex-row items-center gap-3 border-t border-line py-4">
        {content}
      </View>
    );
  }
  return (
    <Pressable testID={TID.Component.HomeFullMoon} accessibilityRole="button" accessibilityLabel={`${label}. ${body}`}
      onPress={() => (sealed
        ? router.push({ pathname: '/journal/[id]', params: getDreamRouteParams(sealed) })
        : router.push('/recording'))}
      className="min-h-[60px] flex-row items-center gap-3 border-t border-line py-4 active:opacity-70">
      {content}
      <IconSymbol name="chevron.right" size={18} color={ink.text.tertiary} />
    </Pressable>
  );
}
