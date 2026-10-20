import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { DreamSymbolSheet } from '@/components/journal/symbols/DreamSymbolSheet';
import { SymbolMedallion } from '@/components/journal/symbols/SymbolMedallion';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { getDreamThemeLabel } from '@/lib/dreamLabels';
import { isDreamAnalyzed } from '@/lib/dreamUsage';
import { PERSONAL_READING_WINDOW_DAYS, type PersonalReading } from '@/lib/personalReading';
import { getSymbolIndex } from '@/lib/symbolLinks';
import { TID } from '@/lib/testIDs';
import { getPeriodSymbols } from '@/lib/trendsSymbols';
import type { DreamAnalysis } from '@/lib/types';
import { WEEKLY_RECAP_ROUTE } from '@/lib/weeklyRecap';

const DAY_MS = 24 * 60 * 60 * 1000;
const MEDALLION = 64;

/**
 * What keeps coming back over thirty days. A returning symbol wears its painting and opens
 * its page, as in Tendances; otherwise the theme that returns, or what is still missing,
 * opens the weekly recap.
 */
export function HomeRecurringCard({ dreams, reading, now }: {
  dreams: DreamAnalysis[];
  reading: PersonalReading;
  now: number;
}) {
  const { colors, mode } = useTheme();
  const ink = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const { t, currentLang } = useTranslation();
  const [openSymbol, setOpenSymbol] = useState<string | null>(null);
  // The same index as the dream readings and Tendances, built once per journal state.
  const index = useMemo(() => getSymbolIndex(dreams, currentLang), [currentLang, dreams]);
  const lead = useMemo(() => {
    const since = now - PERSONAL_READING_WINDOW_DAYS * DAY_MS;
    const analyzedIds = dreams.filter((dream) => dream.id >= since && isDreamAnalyzed(dream)).map((dream) => dream.id);
    return getPeriodSymbols(index, analyzedIds)[0] ?? null;
  }, [dreams, index, now]);

  const theme = reading.recurringTheme;
  const title = lead
    ? lead.symbol.name
    : theme ? getDreamThemeLabel(theme.theme, t) ?? theme.theme : null;
  const count = lead?.count ?? theme?.count;
  const detail = count
    ? t('inspiration.reading.recurring_count', { count })
    : t(reading.analyzedInWindow > 0 ? 'inspiration.reading.recurring_none' : 'inspiration.reading.recurring_needs_analysis');
  const label = t('inspiration.reading.recurring_label');

  return (
    <>
      <Pressable onPress={() => lead ? setOpenSymbol(lead.symbol.linkKey) : router.push(WEEKLY_RECAP_ROUTE)}
        accessibilityRole="button" accessibilityLabel={[label, title, detail].filter(Boolean).join('. ')}
        testID={TID.Button.HomeRecurring}
        className="min-h-[88px] flex-row items-center gap-4 border-t border-line py-4 active:opacity-70">
        {lead ? <SymbolMedallion symbol={lead.symbol} size={MEDALLION} /> : (
          <View className="h-16 w-16 items-center justify-center rounded-full bg-ink-active">
            <IconSymbol name="arrow.triangle.2.circlepath" size={26} color={ink.accent.text} />
          </View>
        )}
        <View className="min-w-0 flex-1 gap-0.5">
          <Text maxFontSizeMultiplier={1.4}
            className="font-sans-medium text-[11px] uppercase tracking-[1.6px] text-ivory-muted">{label}</Text>
          {title ? <Text numberOfLines={2} maxFontSizeMultiplier={1.3}
            className="font-display-semibold text-[21px] leading-[26px] text-ivory">{title}</Text> : null}
          <Text testID={TID.Text.HomeRecurringDetail} maxFontSizeMultiplier={1.4}
            className={title ? 'font-sans text-[13px] leading-[18px] text-ivory-muted' : 'font-sans text-[15px] leading-[22px] text-ivory'}>
            {detail}
          </Text>
        </View>
        <IconSymbol name="chevron.right" size={18} color={ink.text.tertiary} />
      </Pressable>
      <DreamSymbolSheet index={index} dream={null} linkKey={openSymbol} onSelect={setOpenSymbol}
        onClose={() => setOpenSymbol(null)} />
    </>
  );
}
