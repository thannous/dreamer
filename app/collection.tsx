import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, Text, View, type LayoutChangeEvent } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BadgeCard, TierPips } from '@/components/badges/BadgeCard';
import { BadgeDetail } from '@/components/badges/BadgeDetail';
import { badgeAccessibilityLabel, badgeName, badgeStatus } from '@/components/badges/badgeCopy';
import { COLLECTION } from '@/components/badges/badgeMaterials';
import { ProgressFill, Reveal } from '@/components/motion';
import { DreamerArtworkWindow } from '@/components/ui/DreamerBackground';
import { HeaderScrollView, useHeaderScroll } from '@/components/ui/headerStretch';
import { withHeaderScroll } from '@/components/ui/HeaderScrollScope';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useAuth } from '@/context/AuthContext';
import { useBadgeSyncStatus } from '@/services/badgeSyncStatus';
import { useContentWindow } from '@/context/ContentWindowContext';
import { useDreamsData } from '@/context/DreamsContext';
import { useTheme } from '@/context/ThemeContext';
import { useBadgeCollection } from '@/hooks/useBadgeCollection';
import { useLocaleFormatting } from '@/hooks/useLocaleFormatting';
import { useTranslation } from '@/hooks/useTranslation';
import { BADGE_CARD_COUNT, BADGE_CHAPTERS, BADGE_TIERS, type BadgeFamilyId, type BadgeTierLevel } from '@/lib/badges/catalog';
import type { BadgeFamilyState } from '@/lib/badges/ledger';
import { markBadgeFamilyRevealed, settleBadges } from '@/services/badgeLedgerStore';

const GAP = 12;
const GUTTER = 20;

/** Two cards side by side on a phone, more on a wider window; one when text is very large. */
function columnsFor(width: number, fontScale: number): number {
  if (fontScale >= 1.6 && width < 480) return 1;
  if (width >= 900) return 5;
  if (width >= 600) return 4;
  if (width >= 440) return 3;
  return 2;
}

/** Where a family's next step is taken. */
function openAction(state: BadgeFamilyState) {
  switch (state.family.action) {
    case 'capture':
    case 'capture_voice':
      router.push('/recording');
      return;
    case 'capture_memory':
      router.push({ pathname: '/recording', params: { intent: 'remembered', source: 'journal' } });
      return;
    case 'journal':
    case 'favorites':
      router.navigate('/(tabs)/journal');
      return;
    case 'dictionary':
      router.push('/symbol-dictionary');
      return;
    case 'guides':
      router.push('/dream-guides');
      return;
    case 'trends':
      router.navigate('/(tabs)/statistics');
      return;
  }
}

/**
 * The collection: twenty families laid out as an album of cards, chapter by chapter. Each
 * card shows its highest tier; a tier just earned waits face down until it is turned over.
 */
function CollectionScreen() {
  const onHeaderScroll = useHeaderScroll();
  const { user } = useAuth();
  const syncStatus = useBadgeSyncStatus(user?.id);
  const insets = useSafeAreaInsets();
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const { t } = useTranslation();
  const { formatNumber, formatDate } = useLocaleFormatting();
  const { fontScale } = useContentWindow();
  const { dreams, loaded } = useDreamsData();
  const { collection, ready } = useBadgeCollection();
  const [gridWidth, setGridWidth] = useState(0);
  const [openId, setOpenId] = useState<BadgeFamilyId | null>(null);

  // Opening the album stamps what the journal has earned, so a turned card stays turned.
  useEffect(() => {
    if (ready && loaded) settleBadges(dreams);
  }, [dreams, loaded, ready]);

  const columns = columnsFor(gridWidth, fontScale);
  const cardWidth = gridWidth > 0 ? Math.floor((gridWidth - GAP * (columns - 1)) / columns) : 0;
  const openState = openId ? collection.families.find((state) => state.family.id === openId) ?? null : null;
  const closeDetail = useCallback(() => setOpenId(null), []);
  const reveal = useCallback((id: BadgeFamilyId, tier: BadgeTierLevel) => markBadgeFamilyRevealed(id, tier), []);
  const act = useCallback((state: BadgeFamilyState) => {
    setOpenId(null);
    openAction(state);
  }, []);
  const onGridLayout = useCallback((event: LayoutChangeEvent) => {
    const width = Math.round(event.nativeEvent.layout.width);
    setGridWidth((current) => (current === width ? current : width));
  }, []);

  const summary = t(collection.earnedCards === 0 ? 'badges.summary_zero'
    : collection.earnedCards === 1 ? 'badges.summary_one' : 'badges.summary', {
    count: formatNumber(collection.earnedCards),
    total: formatNumber(BADGE_CARD_COUNT),
  });
  const newCaption = t('badges.card.new');

  return (
    <View className="flex-1 bg-ink" testID="screen.collection">
      <HeaderScrollView
        className="flex-1"
        onScroll={onHeaderScroll}
        scrollEventThrottle={16}
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={{ paddingTop: insets.top + 20, paddingBottom: insets.bottom + 40, paddingHorizontal: GUTTER, gap: 28 }}
        showsVerticalScrollIndicator={false}
        accessibilityElementsHidden={openState !== null}
        importantForAccessibility={openState ? 'no-hide-descendants' : 'auto'}
      >
        <DreamerArtworkWindow scene="astral" style={{ marginHorizontal: -GUTTER }} bleedTop={insets.top + 20} />
        <View className="flex-row items-center gap-3.5">
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('navigation.back')}
            testID="btn.collection.back"
            className="h-11 w-11 items-center justify-center rounded-full border border-line bg-ink-raised">
            <IconSymbol name="chevron.left" size={21} color={noctalia.text.secondary} />
          </Pressable>
          <Text accessibilityRole="header" className="min-w-0 flex-1 font-display-bold text-h1 text-ivory">
            {t('badges.title')}
          </Text>
        </View>

        <View className="gap-3">
          <Text className="font-sans text-body text-ivory-muted">{t('badges.subtitle')}</Text>
          <Text accessibilityLiveRegion="polite" testID="collection.sync-status" className="font-sans text-body-sm text-ivory-muted">
            {t(`badges.sync.${syncStatus}`)}
          </Text>
          <View className="gap-3 rounded-[24px] border border-line bg-ink-card p-4" testID="collection.summary">
            <View className="flex-row flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <Text className="font-display-semibold text-h2 text-ivory" testID="collection.summary.count">{summary}</Text>
              {ready && collection.unrevealedCards > 0 ? (
                <Text className="font-sans-bold text-body-sm text-champagne-on" testID="collection.summary.new">
                  {t(collection.unrevealedCards === 1 ? 'badges.new_cards_one' : 'badges.new_cards', {
                    count: formatNumber(collection.unrevealedCards),
                  })}
                </Text>
              ) : null}
            </View>
            <View accessible accessibilityRole="progressbar" accessibilityLabel={summary}
              accessibilityValue={{ min: 0, max: BADGE_CARD_COUNT, now: collection.earnedCards }}
              className="h-1.5 overflow-hidden rounded-full bg-ink-active">
              <ProgressFill percent={(collection.earnedCards / BADGE_CARD_COUNT) * 100} className="h-full rounded-full bg-champagne" />
            </View>
            <View className="flex-row flex-wrap gap-x-5 gap-y-2">
              {BADGE_TIERS.map((tier) => (
                <View key={tier} className="flex-row items-center gap-2" accessible
                  accessibilityLabel={t('badges.summary.tier', { tier: t(`badges.tier.${tier}`), count: formatNumber(collection.counts[tier]) })}>
                  <View style={{ width: 10, height: 10, transform: [{ rotate: '45deg' }], backgroundColor: COLLECTION[tier].ink, borderWidth: 1, borderColor: COLLECTION[tier].frame[0] }} />
                  <Text className="font-sans-medium text-body-sm text-ivory">
                    {t(`badges.tier.${tier}`)} · {formatNumber(collection.counts[tier])}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        <View onLayout={onGridLayout} className="gap-9">
          {/* Cards are laid only once the ledger is read: none shows face down, then face up. */}
          {cardWidth > 0 && ready ? BADGE_CHAPTERS.map((chapter, chapterIndex) => {
            const families = collection.families.filter((state) => state.family.chapter === chapter);
            return (
              <Reveal key={chapter} index={chapterIndex} className="gap-4">
                <View className="gap-1">
                  <View className="mb-2 h-[2px] w-7 rounded-full bg-champagne" />
                  <Text accessibilityRole="header" className="font-display-semibold text-h2 text-ivory">
                    {t(`badges.chapter.${chapter}`)}
                  </Text>
                </View>
                <View className="flex-row flex-wrap" style={{ gap: GAP }}>
                  {families.map((state) => (
                    <BadgeCard
                      key={state.family.id}
                      state={state}
                      width={cardWidth}
                      name={badgeName(t, state.family.id)}
                      status={badgeStatus(t, state, formatNumber)}
                      accessibilityLabel={badgeAccessibilityLabel(t, state, formatNumber)}
                      newCaption={newCaption}
                      onPress={setOpenId}
                      testID={`collection.card.${state.family.id}`}
                    />
                  ))}
                </View>
              </Reveal>
            );
          }) : null}
        </View>

        <View className="gap-3 border-t border-line pt-6">
          <View className="flex-row items-center gap-3">
            <TierPips tier={3} />
            <Text className="min-w-0 flex-1 font-sans-bold text-body-sm text-ivory">{t('badges.footnote.title')}</Text>
          </View>
          <Text className="font-sans text-body-sm text-ivory-muted">{t('badges.footnote.principles')}</Text>
          <Text className="font-sans text-body-sm text-ivory-muted">{t('badges.footnote.history')}</Text>
        </View>
      </HeaderScrollView>
      {/* A modal of its own: above the screen's status-bar veil, closed by back or Escape. The
          card's tilt needs a gesture root inside it on Android. */}
      {openState ? (
        <Modal visible transparent animationType="fade" statusBarTranslucent navigationBarTranslucent
          onRequestClose={closeDetail}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <BadgeDetail
              key={openState.family.id}
              state={openState}
              t={t}
              formatNumber={formatNumber}
              formatDate={formatDate}
              onClose={closeDetail}
              onReveal={reveal}
              onAction={act}
            />
          </GestureHandlerRootView>
        </Modal>
      ) : null}
    </View>
  );
}

export default withHeaderScroll(CollectionScreen);
