import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Screen } from '@/components/atmosphere/Screen';
import { BackLink, Button, Card, Rule, Text } from '@/components/ui';
import { useTranslation } from '@/context/LanguageContext';
import { TID } from '@/lib/testIDs';
import { useSubscription } from '@/context/SubscriptionContext';
import { usePressMotion } from '@/hooks/usePressMotion';
import type { GateReason } from '@/lib/entitlements';
import type { TranslationKey } from '@/lib/i18n';
import * as subscriptions from '@/services/subscriptionService';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const BENEFITS = [1, 2, 3, 4] as const;
const TERMS_URL = 'https://noctalia.app/terms';

function PlanCard({
  offer,
  selected,
  onPress,
}: {
  offer: subscriptions.Offer;
  selected: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const { style, handlePressIn, handlePressOut } = usePressMotion({ surface: 'card' });

  return (
    <AnimatedPressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      aria-checked={selected}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={style}
      className={`rounded-xl border p-gutter ${
        selected ? 'border-champagne bg-ink-panel' : 'border-hairline bg-ink-card'
      }`}>
      <View className="flex-row items-center justify-between">
        <Text variant="h3">{t(`paywall.plan.${offer.period}` as TranslationKey)}</Text>
        <Text variant="h3" tone="accent">
          {offer.priceLabel}
        </Text>
      </View>
      <Text variant="bodySm" className="mt-1">
        {offer.period === 'annual'
          ? t('paywall.plan.trial', { price: offer.priceLabel })
          : t('paywall.plan.per.monthly')}
      </Text>
    </AnimatedPressable>
  );
}

export default function PaywallScreen() {
  const { reason } = useLocalSearchParams<{ reason?: GateReason }>();
  const router = useRouter();
  const { t } = useTranslation();
  const { isPlus, applyTier, remainingPlays } = useSubscription();

  const [offers, setOffers] = useState<subscriptions.Offer[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let mounted = true;

    subscriptions
      .listOffers()
      .then((list) => {
        if (!mounted) return;
        setOffers(list);
        // The yearly plan is preselected: it carries the trial, and a paywall
        // that preselects nothing makes the reader do the work twice.
        setSelected(list.find((offer) => offer.period === 'annual')?.id ?? list[0]?.id ?? null);
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, []);

  const buy = async () => {
    const offer = offers.find((item) => item.id === selected);
    if (!offer) return;

    setBusy(true);
    setFailed(false);
    try {
      applyTier(await subscriptions.purchase(offer));
      router.back();
    } catch {
      // A cancelled purchase and a failed one look the same from here, and
      // both mean the same thing to the reader: nothing was charged.
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    setBusy(true);
    try {
      const tier = await subscriptions.restore();
      applyTier(tier);
      if (tier === 'plus') router.back();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  if (isPlus) {
    return (
      <Screen variant="immersive">
        <BackLink
        testID={TID.Button.PaywallClose}
        label={t('paywall.close')}
        className="px-gutter pt-2"
      />
        <View className="flex-1 items-center justify-center gap-3 px-gutter">
          <Text variant="h1" className="text-center">
            {t('paywall.active.title')}
          </Text>
          <Rule />
          <Text variant="bodySm" className="text-center">
            {t('paywall.active.body')}
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen variant="immersive">
      <BackLink label={t('paywall.close')} className="px-gutter pt-2" />

      <ScrollView
        testID={TID.Screen.Paywall}
        contentContainerClassName="px-gutter pb-6 pt-2 gap-6"
        showsVerticalScrollIndicator={false}>
        <View className="gap-3">
          <Text variant="overline">{t('paywall.title')}</Text>
          <Text variant="display">{t('paywall.subtitle')}</Text>
          <Rule className="self-start" />
          {reason ? (
            <Text variant="quote">{t(`paywall.reason.${reason}` as TranslationKey)}</Text>
          ) : null}
        </View>

        <Card featured>
          <View className="gap-3">
            {BENEFITS.map((index) => (
              <View key={index} className="flex-row items-start gap-3">
                <View className="mt-[9px] h-[3px] w-3 rounded-full bg-champagne" />
                <Text variant="body" tone="muted" className="flex-1">
                  {t(`paywall.benefit.${index}` as TranslationKey)}
                </Text>
              </View>
            ))}
          </View>
        </Card>

        <View className="gap-3">
          {offers.map((offer) => (
            <PlanCard
              key={offer.id}
              offer={offer}
              selected={selected === offer.id}
              onPress={() => setSelected(offer.id)}
            />
          ))}
        </View>

        {failed ? <Text variant="bodySm">{t('paywall.error')}</Text> : null}

        <Text variant="caption" className="text-center">
          {remainingPlays > 0
            ? t('paywall.remaining', { count: remainingPlays })
            : t('paywall.remaining.none')}
        </Text>
      </ScrollView>

      <View className="gap-2 px-gutter pb-4">
        <Button
          testID={TID.Button.PaywallBuy}
          label={t('paywall.cta')}
          loading={busy}
          disabled={!selected}
          onPress={buy}
        />
        {/* Both are mandatory on a paywall, on either store. */}
        <Button
          testID={TID.Button.PaywallRestore}
          label={t('paywall.restore')}
          variant="ghost"
          onPress={restore}
        />
        <Pressable
          accessibilityRole="link"
          onPress={() => Linking.openURL(TERMS_URL).catch(() => {})}
          className="items-center py-1 active:opacity-70">
          <Text variant="caption">{t('paywall.legal')}</Text>
        </Pressable>
      </View>
    </Screen>
  );
}
