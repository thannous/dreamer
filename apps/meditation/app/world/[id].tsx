import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button, IconSymbol, Text } from '@/components/ui';
import { WorldScene } from '@/components/worlds';
import { Themes } from '@/constants/theme';
import { DEFAULT_WORLD_ID, isWorldId, WORLD_BY_ID } from '@/constants/worlds';
import { useTranslation } from '@/context/LanguageContext';
import { useWorld } from '@/context/WorldContext';
import { useWorldPurchases } from '@/context/WorldPurchaseContext';
import { useCompactLayout } from '@/hooks/useCompactLayout';
import type { TranslationKey } from '@/lib/i18n';
import { TID } from '@/lib/testIDs';

const FALLBACK_PRICE = '0,99 €';

export default function WorldPurchaseScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const compact = useCompactLayout();
  const { setWorld } = useWorld();
  const { loaded, isWorldOwned, offerForWorld, purchaseWorld, restoreWorlds } =
    useWorldPurchases();
  const worldId = isWorldId(id) ? id : DEFAULT_WORLD_ID;
  const world = WORLD_BY_ID[worldId];
  const colors = Themes[world.appearance];
  const offer = offerForWorld(worldId);
  const owned = isWorldOwned(worldId);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<TranslationKey | null>(null);

  const priceLabel = offer?.priceLabel ?? FALLBACK_PRICE;
  const ctaLabel = useMemo(
    () =>
      owned
        ? t('world.purchase.continue')
        : t('world.purchase.buy', { price: priceLabel }),
    [owned, priceLabel, t]
  );

  const enterWorld = async (withSuccessFeedback: boolean) => {
    // `setWorld` updates the shared scene synchronously, then persists it. The
    // native fade therefore reveals the same universe instead of a generic
    // success screen or a mismatched home background.
    const selection = setWorld(worldId);
    if (withSuccessFeedback) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    await selection;
    router.dismissTo('/(drawer)/(tabs)');
  };

  const handleBuy = async () => {
    if (owned) {
      await enterWorld(false);
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      const purchased = await purchaseWorld(worldId);
      if (purchased) {
        await enterWorld(true);
      } else {
        setMessage('world.purchase.error');
      }
    } catch {
      setMessage('world.purchase.error');
    } finally {
      setBusy(false);
    }
  };

  const handleRestore = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const restored = await restoreWorlds();
      const restoredCurrentWorld = restored.includes(worldId);
      if (restoredCurrentWorld) {
        await enterWorld(true);
      } else {
        setMessage('world.purchase.restore.empty');
      }
    } catch {
      setMessage('world.purchase.error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <WorldScene
      world={world}
      artwork="purchase"
      immersive={world.id === 'constellation'}
      scrimStrength={0.72}
      edges={['top', 'bottom']}
      testID={TID.Screen.WorldPurchase}>
      <View className="flex-1 px-gutter">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          hitSlop={8}
          onPress={() => router.back()}
          className="h-12 w-12 items-start justify-center"
          testID={TID.Button.WorldPurchaseBack}>
          <IconSymbol name="chevron.left" size={30} color={colors.accentText} weight="semibold" />
        </Pressable>

        <View className="flex-1" />

        <View className="pb-0">
          <View className="ml-2 gap-2">
            <Text variant="hero">{t(world.nameKey)}</Text>
            <Text variant="bodySm" tone="muted" className="max-w-[58%]">
              {t(`world.${worldId}.purchaseDescription` as TranslationKey)}
            </Text>
          </View>

          <View className={compact ? 'mt-7 items-center gap-3' : 'mt-12 items-center gap-2'}>
            <Text variant="bodySm" tone="accent">
              {owned ? t('world.purchase.owned') : t('world.purchase.oneTime')}
            </Text>

            <Button
              label={ctaLabel}
              labelVariant="cta"
              luminous
              loading={busy}
              disabled={!owned && (!loaded || !offer)}
              onPress={() => void handleBuy()}
              className="w-[82%] min-w-[260px] max-w-[324px]"
              testID={TID.Button.WorldPurchaseBuy}
            />

            <Button
              label={t('world.purchase.restore')}
              labelVariant="body"
              labelTone="muted"
              variant="ghost"
              size="md"
              disabled={busy}
              onPress={() => void handleRestore()}
              testID={TID.Button.WorldPurchaseRestore}
            />

            {message ? (
              <Text variant="caption" tone="muted" className="text-center">
                {t(message)}
              </Text>
            ) : null}
          </View>
        </View>
      </View>
    </WorldScene>
  );
}
