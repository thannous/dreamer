import { Image } from 'expo-image';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useTheme } from '@/context/ThemeContext';
import { useDreamMedia } from '@/hooks/useDreamMedia';
import { useTranslation } from '@/hooks/useTranslation';
import { getDreamRouteParams } from '@/lib/dreamRoute';
import { getDreamThumbnailUri } from '@/lib/imageUtils';
import { getFormattingLocale } from '@/lib/locale';
import { getLocalDateKey } from '@/lib/ritualProgressUtils';
import { TID } from '@/lib/testIDs';
import type { DreamAnalysis } from '@/lib/types';
import { WEEKLY_RECAP_ROUTE } from '@/lib/weeklyRecap';

const NIGHTS = 7;
const FACE = 42;

type Night = { key: string; date: Date; dream: DreamAnalysis | null; today: boolean };

/**
 * The last seven nights, each one opening its dream. A night without a dream stays a quiet
 * dot: no count to keep and no streak to break.
 */
export function HomeWeekNights({ dreams, now }: { dreams: DreamAnalysis[]; now: number }) {
  const { colors, mode } = useTheme();
  const ink = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const { t, currentLang } = useTranslation();
  const locale = getFormattingLocale(currentLang ?? 'en');
  const nights = useMemo<Night[]>(() => {
    const latest = new Map<string, DreamAnalysis>();
    for (const dream of dreams) {
      const key = getLocalDateKey(new Date(dream.id));
      const kept = latest.get(key);
      if (!kept || dream.id > kept.id) latest.set(key, dream);
    }
    const today = new Date(now);
    return Array.from({ length: NIGHTS }, (_, index) => {
      // Calendar days rather than 24-hour steps: a clock change never skips or repeats a night.
      const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (NIGHTS - 1 - index), 12);
      const key = getLocalDateKey(date);
      return { key, date, dream: latest.get(key) ?? null, today: index === NIGHTS - 1 };
    });
  }, [dreams, now]);

  return (
    <View testID={TID.Component.HomeWeek} className="gap-2 border-t border-line pb-5 pt-2">
      <View className="flex-row items-center justify-between gap-3">
        <Text maxFontSizeMultiplier={1.4}
          className="min-w-0 shrink font-sans-medium text-[11px] uppercase tracking-[1.6px] text-ivory-muted">
          {t('home.week.title')}
        </Text>
        <Pressable onPress={() => router.push(WEEKLY_RECAP_ROUTE)} accessibilityRole="button"
          testID={TID.Button.HomeWeekRecap}
          className="min-h-11 flex-row items-center gap-1 active:opacity-70">
          <Text maxFontSizeMultiplier={1.4} className="font-sans-medium text-[13px] text-champagne-on">
            {t('inspiration.reading.recap_cta')}
          </Text>
          <IconSymbol name="chevron.right" size={14} color={ink.accent.text} />
        </Pressable>
      </View>
      <View className="flex-row">
        {nights.map((night) => <WeekNight key={night.key} night={night} locale={locale} />)}
      </View>
    </View>
  );
}

function WeekNight({ night, locale }: { night: Night; locale: string }) {
  const { colors, mode } = useTheme();
  const ink = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const { t } = useTranslation();
  const { dream } = night;
  const media = useDreamMedia(dream, { variant: 'thumbnail' });
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const thumbnail = dream ? getDreamThumbnailUri({
    thumbnailUrl: media.thumbnailUrl,
    imageUrl: media.imageUrl,
    imageUpdatedAt: dream.imageUpdatedAt,
    analysisRequestId: dream.analysisRequestId,
    analyzedAt: dream.analyzedAt,
    id: dream.id,
  })?.trim() : undefined;
  const source = useMemo(
    () => thumbnail ? { uri: thumbnail, cacheKey: media.thumbnailUrl ? media.thumbnailCacheKey : undefined } : undefined,
    [media.thumbnailCacheKey, media.thumbnailUrl, thumbnail],
  );
  const dayLabel = night.date.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
  const face = (
    <>
      <Text maxFontSizeMultiplier={1.4}
        className={`font-sans-medium text-[12px] uppercase ${night.today ? 'text-champagne-on' : 'text-ivory-muted'}`}>
        {night.date.toLocaleDateString(locale, { weekday: 'narrow' })}
      </Text>
      {/* expo-image and the ring's colours take native props. */}
      <View style={{
        width: '100%', maxWidth: FACE, aspectRatio: 1, borderRadius: FACE / 2, overflow: 'hidden',
        alignItems: 'center', justifyContent: 'center',
        borderWidth: night.today ? 2 : 1,
        borderColor: night.today ? ink.accent.text : ink.surface.border,
        backgroundColor: dream ? ink.surface.raised : 'transparent',
      }}>
        {source && thumbnail !== failedUri ? <Image source={source} contentFit="cover" cachePolicy="memory-disk"
          recyclingKey={`${dream?.id}:${thumbnail}`} transition={0} onError={() => setFailedUri(thumbnail ?? null)}
          style={{ width: '100%', height: '100%' }} />
          : dream ? <IconSymbol name="sparkles" size={16} color={ink.accent.text} />
            : <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: ink.text.tertiary }} />}
      </View>
      <Text maxFontSizeMultiplier={1.4} className="font-sans text-[11px] text-ivory-muted">{night.date.getDate()}</Text>
    </>
  );

  if (!dream) {
    return <View accessible accessibilityLabel={t('home.week.night_empty', { day: dayLabel })}
      className="flex-1 items-center gap-1.5 px-0.5">{face}</View>;
  }
  return (
    <Pressable onPress={() => router.push({ pathname: '/journal/[id]', params: getDreamRouteParams(dream) })}
      accessibilityRole="button"
      accessibilityLabel={`${dayLabel}, ${dream.title?.trim() || t('weekly_recap.next.untitled')}`}
      testID={TID.Button.HomeWeekNight(night.key)}
      className="flex-1 items-center gap-1.5 px-0.5 active:opacity-70">
      {face}
    </Pressable>
  );
}
