import { router } from 'expo-router';
import React, { memo } from 'react';
import { Text, View } from 'react-native';

import { PressableScale } from '@/components/motion';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useBadgeSummary } from '@/hooks/useBadgeSummary';
import { useLocaleFormatting } from '@/hooks/useLocaleFormatting';
import { useTranslation } from '@/hooks/useTranslation';
import { BADGE_CARD_COUNT, BADGE_FAMILIES } from '@/lib/badges/catalog';

import { BadgeCardFrame } from './BadgeCard';
import { BadgeMedallion } from './BadgeMedallion';
import { COLLECTION, tierOfLevel } from './badgeMaterials';

type Translate = (key: string, params?: Record<string, string | number>) => string;

export const COLLECTION_ROUTE = '/collection' as const;

/** How many cards are held, and how many wait to be turned over. */
export function collectionSummaryText(t: Translate, earned: number, unrevealed: number, formatNumber: (value: number) => string) {
  const held = t(earned === 0 ? 'badges.summary_zero' : earned === 1 ? 'badges.summary_one' : 'badges.summary', {
    count: formatNumber(earned),
    total: formatNumber(BADGE_CARD_COUNT),
  });
  if (unrevealed === 0) return held;
  const waiting = t(unrevealed === 1 ? 'badges.new_cards_one' : 'badges.new_cards', { count: formatNumber(unrevealed) });
  return `${held} · ${waiting}`;
}

/** A small fan of three cards: the one earned last in front, two families behind it. */
export const CollectionFan = memo(function CollectionFan({ width }: { width: number }) {
  const { featured } = useBadgeSummary();
  const tier = tierOfLevel(featured.tier);
  const behind = BADGE_FAMILIES.filter((family) => family.id !== featured.id).slice(0, 2);
  const card = Math.round(width * 0.56);
  return (
    <View style={{ width, height: Math.round(card / 0.7) + 6 }} accessible={false}>
      {behind.map((family, index) => (
        <View key={family.id} style={{
          position: 'absolute',
          left: index === 0 ? 0 : width - card,
          top: 6,
          transform: [{ rotate: index === 0 ? '-10deg' : '10deg' }],
          opacity: 0.85,
        }}>
          <BadgeCardFrame tier={null} width={card}>
            <View className="flex-1 items-center justify-center">
              <BadgeMedallion family={family.id} tier={null} size={Math.round(card * 0.66)} veiled small />
            </View>
          </BadgeCardFrame>
        </View>
      ))}
      <View style={{ position: 'absolute', left: (width - card) / 2, top: 0 }}>
        <BadgeCardFrame tier={tier} width={card}>
          <View className="flex-1 items-center justify-center">
            <BadgeMedallion family={featured.id} tier={tier} size={Math.round(card * 0.7)} veiled={!tier} small />
          </View>
        </BadgeCardFrame>
      </View>
    </View>
  );
});

/** The collection's door at the head of Explore. */
export function CollectionEntryCard({ testID }: { testID?: string }) {
  const { t } = useTranslation();
  const { formatNumber } = useLocaleFormatting();
  const { earnedCards, unrevealedCards, ready } = useBadgeSummary();
  const summary = ready ? collectionSummaryText(t, earnedCards, unrevealedCards, formatNumber) : t('badges.entry.body');
  return (
    <PressableScale onPress={() => router.push(COLLECTION_ROUTE)} accessibilityRole="button"
      accessibilityLabel={`${t('badges.title')}. ${summary}`} testID={testID} haptic="light"
      className="overflow-hidden rounded-[24px] border border-line" style={{ backgroundColor: COLLECTION.ground[1] }}>
      <View className="flex-row items-center gap-4 p-4">
        <CollectionFan width={96} />
        <View className="min-w-0 flex-1 gap-1.5">
          <Text style={{ color: COLLECTION.gold.ink }} className="font-sans-medium text-overline uppercase tracking-[1.3px]">
            {t('badges.entry.eyebrow')}
          </Text>
          <Text style={{ color: COLLECTION.text }} className="font-display-semibold text-h3">{t('badges.title')}</Text>
          <Text style={{ color: COLLECTION.muted }} className="font-sans text-body-sm">{summary}</Text>
        </View>
        <IconSymbol name="chevron.right" size={18} color={COLLECTION.muted} />
      </View>
    </PressableScale>
  );
}
