import React from 'react';
import { Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { sparklePath } from '@/components/journal/story/sparkle';
import { SymbolMedallion } from '@/components/journal/symbols/SymbolMedallion';
import { PressableScale, ProgressFill } from '@/components/motion';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { getDreamTypeLabel, getEmotionFamilyLabel } from '@/lib/dreamLabels';
import { MIN_DREAMS_FOR_TRENDS, type DreamTrends } from '@/lib/dreamTrends';
import type { PeriodSymbol } from '@/lib/trendsSymbols';
import type { DreamType } from '@/lib/types';

import { TrendsSectionHead } from './TrendsSectionHead';

type Translate = (key: string, params?: Record<string, string | number>) => string;

const TREND_ICONS = { up: 'arrow.up', down: 'arrow.down' } as const;

const typeSlug = (type: DreamType) => type.toLowerCase().replace(/\s+/g, '-');

/**
 * What returns across the period's analyzed dreams: the symbols that come back, each
 * opening its page, the emotions, with their share and how it moved, and the kinds of
 * dreams, each a door to those dreams in the journal. Below three analyzed dreams nothing
 * is said to return; the stars show how far off that is.
 */
export function TrendsReturns({ trends, symbols, lit, ink, t, formatNumber, onOpenUnanalyzed, onOpenType, onOpenSymbol, plusHint }: {
  trends: DreamTrends;
  /** The symbols that came back in the period's analyzed dreams, most present first. */
  symbols: readonly PeriodSymbol[];
  /** The section is on screen: the bars grow then, not out of sight. */
  lit: boolean;
  ink: string;
  t: Translate;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  onOpenUnanalyzed: () => void;
  onOpenType: (type: DreamType) => void;
  onOpenSymbol: (linkKey: string) => void;
  /** Only once the month's free analyses are used: the unread dreams could join through Plus. */
  plusHint?: { text: string; cta: string; onPress: () => void };
}) {
  const { analyzed, unanalyzed, ready, emotions, types } = trends.patterns;
  const missing = Math.max(0, MIN_DREAMS_FOR_TRENDS - analyzed);
  const basis = trends.count > 0
    ? t(analyzed === 1 ? 'trends.returns.basis_one' : 'trends.returns.basis', {
      count: formatNumber(analyzed),
      total: formatNumber(trends.count),
    })
    : undefined;

  return (
    <View className="gap-5" testID="trends.section.returns" accessible={false} accessibilityRole="none">
      <TrendsSectionHead title={t('trends.section.returns')} subtitle={basis}>
        {unanalyzed > 0 ? (
          <PressableScale testID="trends.returns.toAnalyze" onPress={onOpenUnanalyzed} haptic="light"
            accessibilityRole="button"
            accessibilityLabel={t(unanalyzed === 1 ? 'trends.returns.to_analyze_label_one' : 'trends.returns.to_analyze_label', {
              count: formatNumber(unanalyzed),
            })}
            className="min-h-[30px] flex-row items-center gap-1 rounded-full border border-champagne-soft px-3">
            <Text className="text-caption font-sans-medium text-champagne-on">
              {t('trends.returns.to_analyze', { count: formatNumber(unanalyzed) })}
            </Text>
            <IconSymbol name="chevron.right" size={12} color={ink} />
          </PressableScale>
        ) : null}
      </TrendsSectionHead>
      {plusHint ? (
        <PressableScale testID="trends.returns.plusHint" onPress={plusHint.onPress} haptic="light"
          accessibilityRole="button" accessibilityLabel={`${plusHint.text} ${plusHint.cta}`}
          className="min-h-[60px] flex-row items-center gap-3 border-y border-line py-3">
          <View className="h-10 w-10 items-center justify-center rounded-full border border-champagne-soft">
            <IconSymbol name="sparkles" size={18} color={ink} />
          </View>
          <View className="min-w-0 flex-1 gap-0.5">
            <Text className="text-body-sm leading-[20px] font-sans text-ivory">{plusHint.text}</Text>
            <Text className="text-body-sm leading-[18px] font-sans-medium text-champagne-on">{plusHint.cta}</Text>
          </View>
          <IconSymbol name="chevron.right" size={12} color={ink} />
        </PressableScale>
      ) : null}

      {!ready ? (
        <View className="card flex-row items-center gap-4 px-4 py-4" testID="trends.returns.threshold" accessible>
          <View className="flex-row gap-1" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {Array.from({ length: MIN_DREAMS_FOR_TRENDS }, (_, index) => (
              <Svg key={index} width={16} height={16} style={{ opacity: index < analyzed ? 1 : 0.28 }}>
                <Path d={sparklePath(8, 8, 7)} fill={ink} />
              </Svg>
            ))}
          </View>
          <Text className="min-w-0 flex-1 text-body-sm font-sans text-ivory">
            {t('trends.returns.threshold')}{' '}
            {t(missing === 1 ? 'trends.returns.missing_one' : 'trends.returns.missing', { count: formatNumber(missing) })}
          </Text>
        </View>
      ) : (
        <View className="gap-6">
          {symbols.length > 0 ? (
            <View className="gap-3" testID="trends.returns.symbols">
              <Text className="text-overline font-sans-medium uppercase text-champagne-on" accessibilityRole="header">{t('trends.returns.symbols')}</Text>
              {symbols.map(({ symbol, count }) => {
                const share = t('trends.returns.share', { count: formatNumber(count), total: formatNumber(analyzed) });
                const kind = symbol.kind === 'personal' ? t('journal.symbols.kind.personal') : null;
                return (
                  <PressableScale key={symbol.linkKey} testID={`trends.returns.symbol.${symbol.linkKey.replace(':', '.')}`}
                    onPress={() => onOpenSymbol(symbol.linkKey)} haptic="light" accessibilityRole="button"
                    accessibilityLabel={[symbol.name, kind, share].filter(Boolean).join(', ')}
                    accessibilityHint={t('journal.symbols.open_hint')}
                    className="min-h-[56px] flex-row items-center gap-3">
                    <SymbolMedallion symbol={symbol} size={48} />
                    <View className="min-w-0 flex-1">
                      <Text className="text-body leading-[22px] font-sans-medium text-ivory" numberOfLines={1}>{symbol.name}</Text>
                      {kind ? <Text className="text-caption font-sans text-champagne-on">{kind}</Text> : null}
                    </View>
                    <Text className="text-body-sm font-sans text-ivory-muted">{share}</Text>
                    <IconSymbol name="chevron.right" size={12} color={ink} />
                  </PressableScale>
                );
              })}
            </View>
          ) : null}

          {emotions.length === 0 ? (
            <Text className="text-body font-sans text-ivory-muted" testID="trends.returns.none">
              {t('trends.returns.none')}
            </Text>
          ) : (
            <View className="gap-4" testID="trends.returns.emotions">
              <Text className="text-overline font-sans-medium uppercase text-champagne-on" accessibilityRole="header">{t('trends.returns.emotions')}</Text>
              {emotions.map((emotion) => {
                const label = getEmotionFamilyLabel(emotion.family, t) ?? emotion.family;
                const share = t('trends.returns.share', { count: formatNumber(emotion.count), total: formatNumber(analyzed) });
                const trend = emotion.trend ? t(`trends.returns.trend.${emotion.trend}`) : null;
                return (
                  <View key={emotion.family} className="gap-2" testID={`trends.returns.emotion.${emotion.family}`}
                    accessible accessibilityLabel={[label, share, trend].filter(Boolean).join(', ')}>
                    <View className="flex-row items-baseline gap-3">
                      <Text className="min-w-0 flex-1 text-body leading-[22px] font-sans-medium text-ivory">{label}</Text>
                      {emotion.trend ? (
                        <View className="flex-row items-center gap-1" testID={`trends.returns.emotion.${emotion.family}.trend`}>
                          {emotion.trend !== 'same' ? (
                            <IconSymbol name={TREND_ICONS[emotion.trend]} size={12} color={ink} />
                          ) : null}
                          <Text className="text-caption font-sans text-ivory-muted">{trend}</Text>
                        </View>
                      ) : null}
                      <Text className="text-body-sm font-sans text-ivory-muted">{share}</Text>
                    </View>
                    <View className="h-1.5 overflow-hidden rounded-[3px] bg-line">
                      <ProgressFill percent={lit ? emotion.share * 100 : 0} growOnMount={false}
                        className="h-1.5 rounded-[3px] bg-champagne" />
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {types.length > 0 ? (
            <View className="gap-3" testID="trends.returns.types">
              <Text className="text-overline font-sans-medium uppercase text-champagne-on" accessibilityRole="header">{t('trends.returns.types')}</Text>
              <View className="flex-row flex-wrap gap-2">
                {types.map((facet) => {
                  const label = getDreamTypeLabel(facet.value, t) ?? facet.value;
                  return (
                    <PressableScale key={facet.value} testID={`trends.returns.type.${typeSlug(facet.value)}`}
                      onPress={() => onOpenType(facet.value)} haptic="light" accessibilityRole="button"
                      accessibilityLabel={t('trends.returns.type_label', { type: `${label}, ${formatNumber(facet.count)}` })}
                      className="min-h-[44px] flex-row items-center gap-2 rounded-full border border-line px-4">
                      <Text className="text-body-sm font-sans-medium text-ivory">{label}</Text>
                      <Text className="text-body-sm font-sans text-champagne-on">{formatNumber(facet.count)}</Text>
                    </PressableScale>
                  );
                })}
              </View>
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}
