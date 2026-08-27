import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';

import { BackLink, Button, IconSymbol, Text } from '@/components/ui';
import { WorldPurchaseReadableBlock, WorldScene } from '@/components/worlds/WorldScene';
import { Themes } from '@/constants/theme';
import { DEFAULT_WORLD_ID, isWorldId, WORLD_BY_ID } from '@/constants/worlds';
import { useTranslation } from '@/context/LanguageContext';
import { useWorld } from '@/context/WorldContext';
import { useWorldPurchases } from '@/context/WorldPurchaseContext';
import { useCompactLayout } from '@/hooks/useCompactLayout';
import { useWorldSoundscape } from '@/hooks/useWorldSoundscape';
import type { TranslationKey } from '@/lib/i18n';
import { TID } from '@/lib/testIDs';

const FALLBACK_PRICE = '0,99 €';
const WORLD_BENEFITS = [1, 2, 3, 4, 5] as const;

export default function WorldPurchaseScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const compact = useCompactLayout();
  const { fontScale } = useWindowDimensions();
  const { setWorld } = useWorld();
  const { loaded, isWorldOwned, offerForWorld, purchaseWorld, restoreWorlds } =
    useWorldPurchases();
  const worldId = isWorldId(id) ? id : DEFAULT_WORLD_ID;
  const world = WORLD_BY_ID[worldId];
  const colors = Themes[world.appearance];
  const offer = offerForWorld(worldId);
  const owned = isWorldOwned(worldId);
  const largeText = fontScale >= 1.5;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<TranslationKey | null>(null);
  const [previewRequested, setPreviewRequested] = useState(false);
  const soundscape = useWorldSoundscape(worldId, previewRequested);
  const previewPlaying = previewRequested && soundscape.soundEnabled;
  const worldName = t(world.nameKey);
  const worldCopy = { world: worldName };

  const handlePreviewSound = () => {
    if (!previewRequested) {
      setPreviewRequested(true);
      return;
    }
    soundscape.toggleSound();
  };

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

  const purchaseActions = (
    <WorldPurchaseReadableBlock
      appearance={world.appearance}
      testID="world.purchase.actions-backing"
      className={compact || largeText ? 'mt-6 items-stretch gap-3' : 'mt-8 items-stretch gap-2'}>
      <Text variant="bodySm" tone="accent" className="text-center">
        {owned ? t('world.purchase.owned') : t('world.purchase.oneTime')}
      </Text>

      <Button
        label={ctaLabel}
        labelVariant="cta"
        luminous
        loading={busy}
        disabled={!owned && (!loaded || !offer)}
        onPress={() => void handleBuy()}
        className="w-full"
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
    </WorldPurchaseReadableBlock>
  );

  return (
    <WorldScene
      world={world}
      artwork="purchase"
      immersive={world.id === 'constellation'}
      scrimStrength={world.id === 'tide' ? 0.42 : 0.72}
      edges={['top', 'bottom']}
      testID={TID.Screen.WorldPurchase}>
      <View className="flex-1 px-gutter">
        <WorldPurchaseReadableBlock
          appearance={world.appearance}
          testID="world.purchase.chrome-backing"
          className={
            compact || largeText
              ? 'shrink-0 gap-3'
              : 'flex-row items-center justify-between gap-3'
          }>
          <BackLink
            label={t('common.back')}
            iconColor={colors.accentText}
            className={compact || largeText ? 'self-start' : 'min-w-0 flex-1'}
            testID={TID.Button.WorldPurchaseBack}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: previewPlaying }}
            accessibilityLabel={
              previewPlaying
                ? t('world.purchase.preview.soundOff', worldCopy)
                : t('world.purchase.preview.soundOn', worldCopy)
            }
            hitSlop={8}
            onPress={handlePreviewSound}
            className={
              compact || largeText
                ? 'min-h-12 flex-row items-center gap-2 self-start'
                : 'min-h-12 shrink flex-row items-center justify-end gap-2'
            }
            testID="btn.worldPurchase.sound">
            <IconSymbol
              name={previewPlaying ? 'speaker.wave.2.fill' : 'speaker.slash.fill'}
              size={22}
              color={colors.accentText}
            />
            <Text variant="caption" tone="accent">
              {previewPlaying
                ? t('world.purchase.preview.soundOff', worldCopy)
                : t('world.purchase.preview.soundOn', worldCopy)}
            </Text>
          </Pressable>
        </WorldPurchaseReadableBlock>

        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerClassName={compact || largeText ? 'pt-4 pb-6 gap-5' : 'pt-6 pb-8 gap-6'}>
          <WorldPurchaseReadableBlock
            appearance={world.appearance}
            testID="world.purchase.intro-backing"
            className="gap-2">
            <Text variant="overline">{t('world.purchase.preview.eyebrow')}</Text>
            <Text variant={largeText ? 'h1' : 'hero'}>{t(world.nameKey)}</Text>
            <Text variant="bodySm" tone="muted">
              {t(`world.${worldId}.purchaseDescription` as TranslationKey)}
            </Text>
            <Text variant="caption" tone="muted">
              {t('world.purchase.preview.soundHint', worldCopy)}
            </Text>
          </WorldPurchaseReadableBlock>

          <WorldPurchaseReadableBlock
            appearance={world.appearance}
            testID="world.purchase.benefits-backing"
            className="gap-3">
            <Text variant="overline">{t('world.purchase.benefits.title')}</Text>
            {WORLD_BENEFITS.map((index) => (
              <View key={index} className="flex-row items-start gap-3">
                <View className="mt-[9px] h-[3px] w-3 rounded-full bg-champagne" />
                <Text variant="bodySm" className="flex-1">
                  {t(`world.purchase.benefit.${index}` as TranslationKey, worldCopy)}
                </Text>
              </View>
            ))}
          </WorldPurchaseReadableBlock>

          <WorldPurchaseReadableBlock
            appearance={world.appearance}
            testID="world.purchase.offer-backing"
            className="gap-2">
            <Text variant="bodySm" tone="accent">
              {t('world.purchase.notPlus')}
            </Text>
            <Text variant="caption" tone="muted">
              {t('world.purchase.notPlus.detail', worldCopy)}
            </Text>
          </WorldPurchaseReadableBlock>

          {purchaseActions}
        </ScrollView>
      </View>
    </WorldScene>
  );
}
