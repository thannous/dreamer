import { router } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';

import { WeekConstellationFigure } from '@/components/trends/WeekConstellationFigure';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { getDreamThemeLabel } from '@/lib/dreamLabels';
import { getSymbolIndex } from '@/lib/symbolLinks';
import { TID } from '@/lib/testIDs';
import type { DreamAnalysis } from '@/lib/types';
import { canStillForm, CONSTELLATION_NIGHTS, getWeekNights, nameWeek } from '@/lib/weekConstellations';

/**
 * The week under way as its constellation in the making: the nights noted since Monday,
 * and how many make it form. A week that can no longer form only says a new one comes on
 * Monday. It opens Tendances, where the formed weeks stay.
 */
export function HomeWeekConstellation({ dreams, now }: { dreams: DreamAnalysis[]; now: number }) {
  const { colors, mode } = useTheme();
  const ink = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const { t, currentLang } = useTranslation();
  const week = useMemo(() => getWeekNights(dreams, now), [dreams, now]);
  // Named only once formed: the readings' symbols, as Tendances indexes them.
  const name = useMemo(() => (week.formed ? nameWeek(week, getSymbolIndex(dreams, currentLang)) : null),
    [currentLang, dreams, week]);

  const label = t('home.constellation.label');
  const goal = CONSTELLATION_NIGHTS;
  const named = name ? ('symbol' in name ? name.symbol.name : getDreamThemeLabel(name.theme, t) ?? name.theme) : null;
  const body = week.formed
    ? named ? t('home.constellation.formed', { name: named }) : t('home.constellation.formed_unnamed')
    : !canStillForm(week, now)
      ? t(week.count === 0 ? 'home.constellation.next_week_zero'
        : week.count === 1 ? 'home.constellation.next_week_one' : 'home.constellation.next_week', { count: week.count })
      : week.count === 0
        ? t('home.constellation.progress_zero', { goal })
        : t(week.count === 1 ? 'home.constellation.progress_one' : 'home.constellation.progress', { count: week.count, goal });

  return (
    <Pressable onPress={() => router.navigate('/(tabs)/statistics')} accessibilityRole="button"
      accessibilityLabel={`${label}. ${body}`} testID={TID.Button.HomeConstellation}
      className="min-h-[72px] flex-row items-center gap-3 border-t border-line py-4 active:opacity-70">
      <WeekConstellationFigure week={week} width={64} height={44} ink={ink.accent.text} dust={ink.text.tertiary} />
      <View className="min-w-0 flex-1 gap-0.5">
        <Text maxFontSizeMultiplier={1.4}
          className="font-sans-medium text-overline uppercase text-ivory-muted">{label}</Text>
        <Text testID={TID.Text.HomeConstellation} maxFontSizeMultiplier={1.4}
          className="font-sans text-body leading-[22px] text-ivory">{body}</Text>
      </View>
      <IconSymbol name="chevron.right" size={18} color={ink.text.tertiary} />
    </Pressable>
  );
}
