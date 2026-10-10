import { Pressable, View, type GestureResponderEvent } from 'react-native';
import * as Haptics from 'expo-haptics';
import React from 'react';

import { IconSymbol, Text } from '@/components/ui';
import { Themes } from '@/constants/theme';
import type { MeditationWorld, WorldId } from '@/constants/worlds';
import { useTranslation } from '@/context/LanguageContext';
import type { WorldAccess, WorldPurchaseResourceStatus } from '@/context/WorldPurchaseContext';
import type { TranslationKey } from '@/lib/i18n';

/** 48 pt targets: the names are short, the slop makes up the height. */
const HIT_SLOP = { top: 14, bottom: 14, left: 6, right: 6 } as const;
const PRESS_RETENTION = { top: 12, bottom: 12, left: 12, right: 12 } as const;
export const ACTIVE_JOURNEY_CTA_TEST_ID = 'home.journey.cta';
/** Literal IDs keep Maestro's static anchor audit honest while the names are
 * still rendered from the world registry. */
export const WORLD_JOURNEY_TEST_ID: Record<WorldId, string> = {
  constellation: 'home.world-switcher.constellation',
  dawn: 'home.world-switcher.dawn',
  forest: 'home.world-switcher.forest',
  tide: 'home.world-switcher.tide',
  sanctuary: 'home.world-switcher.sanctuary',
  cloud: 'home.world-switcher.cloud',
};

type Props = {
  worlds: readonly MeditationWorld[];
  selectedWorldId: WorldId;
  previewedWorldId?: WorldId | null;
  onSelect: (worldId: WorldId) => void;
  isWorldOwned: (worldId: WorldId) => boolean;
  worldAccess?: (worldId: WorldId) => WorldAccess;
  offersStatus?: WorldPurchaseResourceStatus;
  priceForWorld: (worldId: WorldId) => string | undefined;
  /** Appearance of the artwork the index sits on, for the lock glyph. */
  appearance?: MeditationWorld['appearance'];
  accessibilityLabel?: string;
  testID?: string;
};

function WorldIndexEntry({
  world,
  selected,
  previewed,
  isWorldOwned,
  worldAccess,
  offersStatus,
  priceForWorld,
  onSelect,
  appearance,
  testID,
}: {
  world: MeditationWorld;
  selected: boolean;
  previewed: boolean;
  isWorldOwned: (worldId: WorldId) => boolean;
  worldAccess?: (worldId: WorldId) => WorldAccess;
  offersStatus?: WorldPurchaseResourceStatus;
  priceForWorld: (worldId: WorldId) => string | undefined;
  onSelect: (worldId: WorldId) => void;
  appearance: MeditationWorld['appearance'];
  testID?: string;
}) {
  const { t } = useTranslation();
  const name = t(world.nameKey);
  const role = t(`world.${world.id}.role` as TranslationKey);
  const ritual = t(`world.${world.id}.ritual` as TranslationKey);
  const purchasable = world.access === 'purchase';
  const owned = purchasable && isWorldOwned(world.id);
  const access = worldAccess?.(world.id) ?? (owned ? 'owned' : purchasable ? 'not-owned' : 'free');
  const locked = purchasable && access === 'not-owned';
  const priceLabel = priceForWorld(world.id);
  const offerLabel =
    priceLabel ??
    t(offersStatus === 'loading' ? 'world.purchase.offer.checking' : 'world.purchase.offer.unavailable');
  const commercialHint = priceLabel
    ? `${t('world.purchase.oneTime')}. ${priceLabel}`
    : offerLabel;
  const ownedLabel = t('world.purchase.owned');
  const accessibilityHint = locked
    ? `${role}. ${ritual} ${commercialHint}.`
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
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={name}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ checked: selected, selected }}
      hitSlop={HIT_SLOP}
      pressRetentionOffset={PRESS_RETENTION}
      onPress={handlePress}
      className="flex-row items-center gap-1.5 py-1"
      testID={testID}>
      {selected && !locked ? (
        <View
          testID={`home.world-switcher.current.${world.id}`}
          className="h-1.5 w-1.5 rounded-full bg-champagne"
        />
      ) : null}
      <Text
        variant="bodySm"
        tone={highlighted ? 'default' : 'muted'}
        className={highlighted ? 'font-medium underline' : ''}
        testID={testID ? `${testID}.name` : undefined}>
        {name}
      </Text>
      {locked ? (
        <View
          className="flex-row items-center gap-1"
          testID={testID ? `${testID}.locked` : undefined}>
          <IconSymbol name="lock.fill" size={11} color={Themes[appearance].textTertiary} />
          <Text variant="caption" tone="faint">
            {offerLabel}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/**
 * The home's index of worlds, in the manner of the landing's symbol index: six
 * names on the artwork of the chosen one. Worlds never advance by themselves.
 * A flat, wrapping row has no nested scroll, so a screen reader walks the six
 * radios in visual order, then leaves for the session below.
 */
export function WorldJourneyPicker({
  worlds,
  selectedWorldId,
  previewedWorldId,
  onSelect,
  isWorldOwned,
  worldAccess,
  offersStatus,
  priceForWorld,
  appearance = 'dark',
  accessibilityLabel,
  testID,
}: Props) {
  return (
    <View
      accessible={false}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      importantForAccessibility="no"
      className="flex-row flex-wrap gap-x-4 gap-y-1"
      testID={testID}>
      {worlds.map((world) => (
        <WorldIndexEntry
          key={world.id}
          world={world}
          selected={world.id === selectedWorldId}
          previewed={world.id === previewedWorldId}
          isWorldOwned={isWorldOwned}
          worldAccess={worldAccess}
          offersStatus={offersStatus}
          priceForWorld={priceForWorld}
          onSelect={onSelect}
          appearance={appearance}
          testID={testID ? WORLD_JOURNEY_TEST_ID[world.id] : undefined}
        />
      ))}
    </View>
  );
}
