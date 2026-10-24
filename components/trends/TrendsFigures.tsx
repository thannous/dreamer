import React from 'react';
import { Text, View } from 'react-native';

import type { DreamTrends } from '@/lib/dreamTrends';

import { useCountUp } from './useCountUp';

type Translate = (key: string, params?: Record<string, string | number>) => string;
type FormatNumber = (value: number, options?: Intl.NumberFormatOptions) => string;

type Note = { text: string; tone: 'up' | 'flat' };

function Figure({ testID, value, label, note, spoken, entrance, reduced, delay, formatNumber, stacked }: {
  testID: string;
  value: number;
  label: string;
  note: Note | null;
  spoken: string;
  entrance: boolean;
  reduced: boolean;
  delay: number;
  formatNumber: FormatNumber;
  stacked: boolean;
}) {
  const shown = useCountUp(value, { fromZero: entrance, still: reduced, delay });
  return (
    <View testID={testID} accessible accessibilityLabel={spoken}
      className={stacked ? 'flex-row items-baseline gap-3' : 'min-w-0 flex-1 gap-[2px]'}>
      <Text testID={`${testID}.value`} maxFontSizeMultiplier={stacked ? undefined : 1.15}
        className="text-hero font-display-semibold text-ivory" style={{ fontVariant: ['tabular-nums'] }}>
        {formatNumber(shown)}
      </Text>
      <View className={stacked ? 'min-w-0 flex-1 gap-[2px]' : 'gap-[2px]'}>
        <Text className="text-body-sm font-sans text-ivory">{label}</Text>
        {note ? (
          <Text testID={`${testID}.note`}
            className={`text-caption ${note.tone === 'up' ? 'font-sans-medium text-champagne-on' : 'font-sans text-ivory-muted'}`}>
            {note.text}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/**
 * Dreams, nights noted, nights in a row: each with how it moved against the period
 * before (only when that period holds a dream) or the record. The numbers climb from
 * zero on arrival and travel to their new value when the period changes.
 */
export function TrendsFigures({ trends, entrance, reduced, stacked, t, formatNumber, formatDate }: {
  trends: DreamTrends;
  entrance: boolean;
  reduced: boolean;
  /** Large text: one figure per line. */
  stacked: boolean;
  t: Translate;
  formatNumber: FormatNumber;
  formatDate: (value: Date | number, options?: Intl.DateTimeFormatOptions) => string;
}) {
  const plural = (key: string, count: number) => t(count === 1 ? `${key}_one` : key);
  const previous = trends.period === 'all' ? '' : t(`trends.previous.${trends.period}`);
  const delta = (value: number | null): Note | null => {
    if (value == null) return null;
    const count = formatNumber(Math.abs(value));
    return value > 0 ? { text: t('trends.figure.more', { count }), tone: 'up' }
      : value < 0 ? { text: t('trends.figure.fewer', { count }), tone: 'flat' }
        : { text: t('trends.figure.same'), tone: 'flat' };
  };
  const deltaSpoken = (value: number | null) => {
    if (value == null) return null;
    const count = formatNumber(Math.abs(value));
    return value > 0 ? t('trends.compare.more', { count, previous })
      : value < 0 ? t('trends.compare.fewer', { count, previous })
        : t('trends.compare.same', { previous });
  };

  const dreamsNote = trends.countDelta != null ? delta(trends.countDelta)
    : trends.period === 'all' && trends.count > 0
      ? { text: t('trends.figure.since', { date: formatDate(trends.range.start, { month: 'short', year: 'numeric' }) }), tone: 'flat' as const }
      : null;
  const nightsNote: Note | null = trends.activeNightsDelta != null ? delta(trends.activeNightsDelta)
    : { text: t('trends.figure.of_nights', { count: formatNumber(trends.range.nights) }), tone: 'flat' as const };
  const { current, longest } = trends.streak;
  const streakNote: Note | null = longest > current
    ? { text: t('trends.figure.record', { count: formatNumber(longest) }), tone: 'flat' }
    : current >= 2 ? { text: t('trends.figure.record_now'), tone: 'up' } : null;

  const figures = [
    {
      key: 'dreams', value: trends.count, label: plural('trends.figure.dreams', trends.count), note: dreamsNote,
      extra: trends.countDelta != null ? deltaSpoken(trends.countDelta) : dreamsNote?.text,
    },
    {
      key: 'nights', value: trends.activeNights, label: plural('trends.figure.nights', trends.activeNights), note: nightsNote,
      extra: trends.activeNightsDelta != null ? deltaSpoken(trends.activeNightsDelta) : nightsNote?.text,
    },
    { key: 'streak', value: current, label: plural('trends.figure.streak', current), note: streakNote, extra: streakNote?.text },
  ];

  return (
    <View testID="trends.figures" className={stacked ? 'gap-3' : 'flex-row gap-4'}>
      {figures.map((figure, index) => (
        <React.Fragment key={figure.key}>
          {index > 0 && !stacked ? <View className="w-px self-stretch bg-line" /> : null}
          <Figure testID={`trends.figure.${figure.key}`} value={figure.value} label={figure.label} note={figure.note}
            spoken={[`${formatNumber(figure.value)} ${figure.label}`, figure.extra].filter(Boolean).join(', ')}
            entrance={entrance} reduced={reduced} delay={index * 120} formatNumber={formatNumber} stacked={stacked} />
        </React.Fragment>
      ))}
    </View>
  );
}
