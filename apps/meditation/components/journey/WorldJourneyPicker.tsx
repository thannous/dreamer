import * as Haptics from 'expo-haptics';
import { Image, type ImageProps } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type GestureResponderEvent,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { ScopedTheme } from 'uniwind';

import { IconSymbol, Text } from '@/components/ui';
import { ArtworkScrim, NightTheme, Radius } from '@/constants/theme';
import type { MeditationWorld, WorldId } from '@/constants/worlds';
import { useTranslation } from '@/context/LanguageContext';
import { usePressMotion } from '@/hooks/usePressMotion';
import { useCompactLayout } from '@/hooks/useCompactLayout';
import { useScreenReader } from '@/hooks/useScreenReader';
import type { TranslationKey } from '@/lib/i18n';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const HIT_SLOP = { top: 4, bottom: 4, left: 2, right: 2 } as const;
const PRESS_RETENTION = { top: 12, bottom: 12, left: 12, right: 12 } as const;
export const ACTIVE_JOURNEY_CTA_TEST_ID = 'home.journey.cta';
/** Literal IDs keep Maestro's static anchor audit honest while the cards are
 * still rendered from the world registry. */
export const WORLD_JOURNEY_TEST_ID: Record<WorldId, string> = {
  constellation: 'home.world-switcher.constellation',
  dawn: 'home.world-switcher.dawn',
  forest: 'home.world-switcher.forest',
  tide: 'home.world-switcher.tide',
  sanctuary: 'home.world-switcher.sanctuary',
  cloud: 'home.world-switcher.cloud',
};
export const ACTIVE_JOURNEY_WIDTH_RATIO = 0.78;
export const INACTIVE_JOURNEY_MIN_HEIGHT = 172;
export const COMPACT_INACTIVE_JOURNEY_MIN_HEIGHT = 132;
const JOURNEY_GAP = 12;

type Props = {
  worlds: readonly MeditationWorld[];
  selectedWorldId: WorldId;
  previewedWorldId?: WorldId | null;
  onSelect: (worldId: WorldId) => void;
  isWorldOwned: (worldId: WorldId) => boolean;
  priceForWorld: (worldId: WorldId) => string | undefined;
  initialSelectionReady?: boolean;
  accessibilityLabel?: string;
  testID?: string;
};

function WorldJourneyCard({
  world,
  selected,
  previewed,
  isWorldOwned,
  priceForWorld,
  width,
  onSelect,
  testID,
  compact,
}: {
  world: MeditationWorld;
  selected: boolean;
  previewed: boolean;
  isWorldOwned: (worldId: WorldId) => boolean;
  priceForWorld: (worldId: WorldId) => string | undefined;
  width: number;
  onSelect: (worldId: WorldId) => void;
  testID?: string;
  compact: boolean;
}) {
  const { t } = useTranslation();
  const name = t(world.nameKey);
  const role = t(`world.${world.id}.role` as TranslationKey);
  const moment = t(`world.${world.id}.moment` as TranslationKey);
  const ritual = t(`world.${world.id}.ritual` as TranslationKey);
  const purchasable = world.access === 'purchase';
  const owned = purchasable && isWorldOwned(world.id);
  const locked = purchasable && !owned;
  const priceLabel = priceForWorld(world.id) ?? '0,99 €';
  const ownedLabel = t('world.purchase.owned');
  const { style, handlePressIn, handlePressOut } = usePressMotion({ surface: 'card' });
  const accessibilityHint = locked
    ? `${role}. ${ritual} ${t('world.purchase.oneTime')}. ${priceLabel}.`
    : owned
      ? `${role}. ${ritual} ${ownedLabel}.`
      : `${role}. ${ritual}`;

  const highlighted = selected || previewed;

  const handlePress = (_event: GestureResponderEvent) => {
    if (highlighted) return;
    Haptics.selectionAsync().catch(() => {});
    onSelect(world.id);
  };

  return (
    <AnimatedPressable
      accessibilityRole="radio"
      accessibilityLabel={name}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ checked: selected, selected }}
      hitSlop={HIT_SLOP}
      pressRetentionOffset={PRESS_RETENTION}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[
        style,
        {
          width,
          minHeight: compact
            ? COMPACT_INACTIVE_JOURNEY_MIN_HEIGHT
            : INACTIVE_JOURNEY_MIN_HEIGHT,
          borderColor: highlighted ? NightTheme.accentLight : NightTheme.divider,
          borderRadius: Radius.xl,
          borderWidth: highlighted ? 1.5 : 1,
          overflow: 'hidden',
        },
      ]}
      testID={testID}>
      <Image
        accessible={false}
        source={world.thumbnail as ImageProps['source']}
        contentFit="cover"
        recyclingKey={`${world.id}-journey`}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={[ArtworkScrim.transparent, ArtworkScrim.strong]}
        locations={highlighted ? [0.12, 1] : [0.2, 1]}
        style={StyleSheet.absoluteFill}
      />

      <ScopedTheme theme="dark">
        <View className="flex-1 justify-between gap-3 p-3">
          <View className="flex-row items-center justify-between gap-2">
            {locked ? (
              <View
                className="flex-row items-center gap-1 rounded-full bg-ink-panel px-2 py-1"
                testID={testID ? `${testID}.locked` : undefined}>
                <IconSymbol name="lock.fill" size={12} color={NightTheme.textPrimary} />
                <Text variant="overline">
                  {priceLabel}
                </Text>
              </View>
            ) : owned ? (
              <View
                className="rounded-full bg-ink-panel px-2 py-1"
                testID={testID ? `${testID}.owned` : undefined}>
                <Text variant="overline">
                  {ownedLabel}
                </Text>
              </View>
            ) : (
              <View />
            )}
            <View
              className="h-7 w-7 items-center justify-center rounded-full border"
              style={{
                backgroundColor: selected ? NightTheme.accent : NightTheme.backgroundCard,
                borderColor: selected ? NightTheme.accentLight : NightTheme.divider,
              }}>
              {selected && !locked ? (
                <View
                  testID={`home.world-switcher.current.${world.id}`}
                  className="h-2.5 w-2.5 rounded-full bg-ink"
                />
              ) : null}
            </View>
          </View>

          <View className="gap-1">
            <Text variant="h3" testID={testID ? `${testID}.name` : undefined}>
              {name}
            </Text>
            <Text variant="bodySm">
              {role}
            </Text>
            <Text variant="caption" tone="muted">
              {moment}
            </Text>
          </View>
        </View>
      </ScopedTheme>
    </AnimatedPressable>
  );
}

/**
 * Home-only world carousel. Worlds never advance by themselves: the listener
 * swipes, then selects. Every radio keeps the same geometry; the ritual CTA is
 * a sibling shelf below, so selection never recentres the rail or nests controls.
 * A running screen reader replaces the nested horizontal rail with a stacked
 * list so TalkBack can reach every world, then leave for the tab bar.
 */
export function WorldJourneyPicker({
  worlds,
  selectedWorldId,
  previewedWorldId,
  onSelect,
  isWorldOwned,
  priceForWorld,
  initialSelectionReady = false,
  accessibilityLabel,
  testID,
}: Props) {
  const { width: viewportWidth } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const revealedInitialSelectionRef = useRef(false);
  const compact = useCompactLayout();
  const screenReader = useScreenReader();
  const availableWidth = Math.max(280, viewportWidth - 32);
  const activeWidth = compact
    ? Math.min(244, Math.max(208, availableWidth * 0.7))
    : Math.min(316, Math.max(248, availableWidth * ACTIVE_JOURNEY_WIDTH_RATIO));

  // Hydration can replace the default world with one several cards away. Show
  // that real initial choice once, then leave every later rail position under
  // the listener's direct control.
  useEffect(() => {
    if (screenReader || !initialSelectionReady || revealedInitialSelectionRef.current) return;

    revealedInitialSelectionRef.current = true;
    const selectedIndex = worlds.findIndex((world) => world.id === selectedWorldId);
    if (selectedIndex <= 0) return;

    scrollRef.current?.scrollTo({
      x: selectedIndex * (activeWidth + JOURNEY_GAP),
      y: 0,
      animated: false,
    });
  }, [activeWidth, initialSelectionReady, screenReader, selectedWorldId, worlds]);

  const cards = worlds.map((world) => {
    const selected = world.id === selectedWorldId;
    const previewed = world.id === previewedWorldId;

    return (
      <WorldJourneyCard
        key={world.id}
        world={world}
        selected={selected}
        previewed={previewed}
        isWorldOwned={isWorldOwned}
        priceForWorld={priceForWorld}
        width={screenReader ? availableWidth : activeWidth}
        onSelect={onSelect}
        testID={testID ? WORLD_JOURNEY_TEST_ID[world.id] : undefined}
        compact={compact}
      />
    );
  });

  return (
    <View
      accessible={false}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      importantForAccessibility="no"
      testID={testID}>
      {screenReader ? (
        <View className="gap-3">{cards}</View>
      ) : (
        <ScrollView
          ref={scrollRef}
          horizontal
          nestedScrollEnabled
          alwaysBounceHorizontal={false}
          decelerationRate="fast"
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="items-start gap-3 pr-gutter">
          {cards}
        </ScrollView>
      )}
    </View>
  );
}
