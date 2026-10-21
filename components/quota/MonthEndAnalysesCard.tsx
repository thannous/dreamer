import { router } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useTheme } from '@/context/ThemeContext';
import { useLocaleFormatting } from '@/hooks/useLocaleFormatting';
import { useTranslation } from '@/hooks/useTranslation';
import { getDreamRouteParams } from '@/lib/dreamRoute';
import type { MonthEndAnalyses } from '@/lib/monthEndAnalyses';
import { formatQuotaLastDay, withFirstDayOrdinal } from '@/lib/quotaReset';
import { TID } from '@/lib/testIDs';

/**
 * The month's last days: how many included analyses are left until its end, and the dream
 * still waiting for a reading. It opens that dream, where its reading starts.
 */
export function MonthEndAnalysesCard({ offer, now, className }: {
  offer: MonthEndAnalyses;
  now: number;
  className?: string;
}) {
  const { t } = useTranslation();
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const { locale, formatNumber, formatDate } = useLocaleFormatting();
  const date = formatQuotaLastDay(locale, new Date(now));
  const message = offer.remaining === 1
    ? t('quota.month_end.remaining_one', { date })
    : t('quota.month_end.remaining', { count: formatNumber(offer.remaining), date });
  const title = offer.dream.title?.trim();
  // An untitled dream is named by its day rather than by « Untitled dream ».
  const dream = title ? t('quota.month_end.dream', { title })
    : t('quota.month_end.dream_untitled', { date: withFirstDayOrdinal(formatDate(offer.dream.id, { day: 'numeric', month: 'long' }), locale) });
  const cta = t('quota.month_end.cta');

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/journal/[id]', params: getDreamRouteParams(offer.dream) })}
      accessibilityRole="button"
      accessibilityLabel={`${message} ${dream} ${cta}`}
      testID={TID.Button.MonthEndAnalyses}
      className={`min-h-[60px] flex-row items-center gap-3 border-t border-line py-4 active:opacity-70 ${className ?? ''}`}
    >
      <View className="w-10 items-center">
        <IconSymbol name="sparkles" size={22} color={noctalia.accent.text} />
      </View>
      <View className="min-w-0 flex-1 gap-0.5">
        <Text className="font-sans text-body leading-[22px] text-ivory">{message}</Text>
        <Text numberOfLines={2} className="font-serif-italic text-body-sm leading-[19px] text-ivory-muted">{dream}</Text>
        <Text className="font-sans-medium text-body-sm leading-[18px] text-champagne-on">{cta}</Text>
      </View>
      <IconSymbol name="chevron.right" size={18} color={noctalia.text.tertiary} />
    </Pressable>
  );
}
