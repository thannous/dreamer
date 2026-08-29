import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';

import { Screen } from '@/components/atmosphere/Screen';
import { BackLink, Button, Card, Rule, Text } from '@/components/ui';
import { useTranslation } from '@/context/LanguageContext';
import { useSubscription } from '@/context/SubscriptionContext';
import type { GateReason } from '@/lib/entitlements';
import type { TranslationKey } from '@/lib/i18n';
import { TID } from '@/lib/testIDs';
import * as subscriptions from '@/services/subscriptionService';

const BENEFITS = [1, 2, 3, 4] as const;
const TERMS_URL = 'https://noctalia.app/terms';
const PRIVACY_URL = 'https://noctalia.app/privacy';
const GATE_REASONS: readonly GateReason[] = [
  'premium-session',
  'monthly-quota',
  'premium-pattern',
  'premium-timer',
];
const REASON_ALIASES: Record<string, GateReason> = {
  session: 'premium-session',
  quota: 'monthly-quota',
};

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function isGateReason(value: string): value is GateReason {
  return (GATE_REASONS as readonly string[]).includes(value);
}

/** Maps the query string to a known gate, including the older `session` alias. */
export function resolvePaywallReason(
  raw: string | string[] | undefined
): GateReason | null {
  const value = firstParam(raw);
  if (!value) return null;
  if (isGateReason(value)) return value;
  return REASON_ALIASES[value] ?? null;
}

/** Never interpolates an unknown token: missing and garbage both fall back. */
export function paywallReasonKey(
  raw: string | string[] | undefined
): TranslationKey {
  const resolved = resolvePaywallReason(raw);
  return resolved
    ? (`paywall.reason.${resolved}` as TranslationKey)
    : 'paywall.reason.fallback';
}

function PlanCard({
  offer,
  compact,
}: {
  offer: subscriptions.Offer;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const periodKey = (
    offer.period === 'annual' ? 'paywall.plan.annual' : 'paywall.plan.monthly'
  ) satisfies TranslationKey;

  return (
    <View
      testID="paywall.plan"
      className={`rounded-xl border border-champagne bg-ink-panel ${compact ? 'p-3' : 'p-gutter'}`}>
      <View className="flex-row flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <Text variant="h3" testID="paywall.plan.period">
          {t(periodKey)}
        </Text>
        <Text variant="h3" tone="accent" testID="paywall.plan.price">
          {offer.priceLabel}
        </Text>
      </View>
      <Text variant="bodySm" className="mt-1" testID="paywall.plan.trial">
        {offer.period === 'annual'
          ? t('paywall.plan.trial', { price: offer.priceLabel })
          : t('paywall.plan.price.monthly', { price: offer.priceLabel })}
      </Text>
      <Text variant="caption" className="mt-2" testID="paywall.plan.renewal">
        {t('paywall.plan.renewal')}
      </Text>
    </View>
  );
}

function commercialTerms(
  offer: subscriptions.Offer,
  t: (key: TranslationKey, values?: { price: string }) => string
): string {
  return offer.period === 'annual'
    ? t('paywall.terms.trial', { price: offer.priceLabel })
    : t('paywall.terms.monthly', { price: offer.priceLabel });
}

export default function PaywallScreen() {
  const { reason } = useLocalSearchParams<{ reason?: GateReason }>();
  const router = useRouter();
  const { t } = useTranslation();
  const { width, height, fontScale } = useWindowDimensions();
  const {
    subscriptionsEnabled = true,
    isPlus,
    applyTier,
    remainingPlays,
  } = useSubscription();
  const reasonKey = paywallReasonKey(reason);
  const largeText = fontScale >= 1.5;
  const compact = width < 375 || height < 700 || fontScale > 1.15;
  const prioritizeOffer = compact || largeText;

  const [offer, setOffer] = useState<subscriptions.Offer | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!subscriptionsEnabled) return;

    let mounted = true;

    subscriptions
      .listOffers()
      .then((list) => {
        if (!mounted) return;
        // One decision, one offer: the annual plan carries the trial and is the
        // only purchase presented. Keeping the monthly fallback here still
        // leaves the paywall usable if a store configuration temporarily omits
        // the annual package.
        setOffer(list.find((item) => item.period === 'annual') ?? list[0] ?? null);
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, [subscriptionsEnabled]);

  useEffect(() => {
    if (!subscriptionsEnabled) router.replace('/');
  }, [router, subscriptionsEnabled]);

  const buy = async () => {
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

  const purchaseActions = (
    <View
      className={
        largeText
          ? 'gap-2 pb-4 pt-2'
          : 'gap-2 border-t border-hairline bg-ink-raised px-gutter pb-4 pt-3'
      }>
      {offer ? (
        <Text variant="caption" className="text-center">
          {commercialTerms(offer, t)}
        </Text>
      ) : null}
      <Button
        testID={TID.Button.PaywallBuy}
        label={
          offer?.period === 'monthly' ? t('paywall.cta.monthly') : t('paywall.cta')
        }
        loading={busy}
        disabled={!offer}
        onPress={buy}
      />
      {/* Both are mandatory on a paywall, on either store. */}
      <Button
        testID={TID.Button.PaywallRestore}
        label={t('paywall.restore')}
        variant="ghost"
        onPress={restore}
      />
      <View className="flex-row flex-wrap items-center justify-center gap-x-4">
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={t('legal.terms')}
          testID="paywall.legal.terms"
          onPress={() => Linking.openURL(TERMS_URL).catch(() => {})}
          className="min-h-12 min-w-12 items-center justify-center px-2 py-1 active:opacity-70">
          <Text variant="caption">{t('legal.terms')}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={t('legal.privacy')}
          testID="paywall.legal.privacy"
          onPress={() => Linking.openURL(PRIVACY_URL).catch(() => {})}
          className="min-h-12 min-w-12 items-center justify-center px-2 py-1 active:opacity-70">
          <Text variant="caption">{t('legal.privacy')}</Text>
        </Pressable>
      </View>
    </View>
  );

  if (!subscriptionsEnabled) return null;

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
      <BackLink
        testID={TID.Button.PaywallClose}
        label={t('paywall.close')}
        className="px-gutter pt-2"
      />

      <ScrollView
        testID={TID.Screen.Paywall}
        contentContainerClassName={
          prioritizeOffer ? 'px-gutter pb-6 pt-2 gap-4' : 'px-gutter pb-6 pt-2 gap-6'
        }
        showsVerticalScrollIndicator={false}>
        <Text variant="overline">{t('paywall.title')}</Text>

        {prioritizeOffer ? null : (
          <View className="gap-3">
            <Text variant="display">{t('paywall.subtitle')}</Text>
            <Rule className="self-start" />
            <Text variant="quote">{t(reasonKey)}</Text>
          </View>
        )}

        {offer ? <PlanCard offer={offer} compact={prioritizeOffer} /> : null}

        {prioritizeOffer ? <Text variant="bodySm">{t(reasonKey)}</Text> : null}

        {/* Keep the commercial terms in the first viewport at 150–200% text,
            where a sticky footer would cover the offer itself. */}
        {largeText ? purchaseActions : null}

        {prioritizeOffer ? (
          <View className="gap-3">
            <Text variant="h1">{t('paywall.subtitle')}</Text>
            <Rule className="self-start" />
          </View>
        ) : null}

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

        {failed ? <Text variant="bodySm">{t('paywall.error')}</Text> : null}

        <Text variant="caption" className="text-center">
          {remainingPlays === 0
            ? t('paywall.remaining.none')
            : remainingPlays === 1
              ? t('paywall.remaining.one')
              : t('paywall.remaining', { count: remainingPlays })}
        </Text>
      </ScrollView>

      {/* Chrome over scrolling content, so it says so: the hairline and the
          raised fill are what tell the eye the page continues underneath
          instead of ending at the button. */}
      {largeText ? null : purchaseActions}
    </Screen>
  );
}
