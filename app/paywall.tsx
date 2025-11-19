import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenContainer } from '@/components/ScreenContainer';
import { PricingOption } from '@/components/subscription/PricingOption';
import { SubscriptionCard } from '@/components/subscription/SubscriptionCard';
import { ThemeLayout } from '@/constants/journalTheme';
import { useTheme } from '@/context/ThemeContext';
import { useSubscription } from '@/hooks/useSubscription';
import { useTranslation } from '@/hooks/useTranslation';
import { TID } from '@/lib/testIDs';
import type { PurchasePackage } from '@/lib/types';

function sortPackages(packages: PurchasePackage[]): PurchasePackage[] {
  return [...packages].sort((a, b) => {
    if (a.interval === b.interval) return 0;
    if (a.interval === 'monthly') return -1;
    return 1;
  });
}

export default function PaywallScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { isActive, loading, processing, error, packages, purchase, restore } = useSubscription();
  const insets = useSafeAreaInsets();
  const sortedPackages = useMemo(() => sortPackages(packages), [packages]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const effectiveSelectedId = selectedId ?? (sortedPackages[0]?.id ?? null);
  const canPurchase = Boolean(effectiveSelectedId) && !processing && !loading && !isActive;

  const handleClose = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/settings');
    }
  };

  const handleSelect = (id: string) => {
    setSelectedId(id);
  };

  const handlePurchase = async () => {
    if (!effectiveSelectedId || !canPurchase) return;
    try {
      await purchase(effectiveSelectedId);
    } catch {
    }
  };

  const handleRestore = async () => {
    try {
      await restore();
    } catch {
    }
  };

  const headerTitle = isActive
    ? t('subscription.paywall.header.premium')
    : t('subscription.paywall.header.free');
  const headerSubtitle = isActive
    ? t('subscription.paywall.header.subtitle.premium')
    : t('subscription.paywall.header.subtitle.free');

  const translateWithFallback = (key: string, fallback?: string) => {
    const translated = t(key);
    if (translated === key) {
      return fallback ?? key;
    }
    return translated;
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.backgroundDark }]} testID={TID.Screen.Paywall}>
      <ScreenContainer style={[styles.headerContainer, { paddingTop: ThemeLayout.spacing.lg + insets.top }]}>
        <View style={styles.headerRow}>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{headerTitle}</Text>
          <Pressable
            onPress={handleClose}
            style={({ pressed }) => [styles.closeButton, pressed && styles.closeButtonPressed]}
            accessibilityRole="button"
            testID={TID.Button.PaywallClose}
          >
            <Text style={[styles.closeLabel, { color: colors.textSecondary }]}>
              {t('subscription.paywall.button.close')}
            </Text>
          </Pressable>
        </View>
        <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>{headerSubtitle}</Text>
        {loading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.accent} />
            <Text style={[styles.loadingLabel, { color: colors.textSecondary }]}>
              {t('subscription.paywall.loading')}
            </Text>
          </View>
        )}
        {error && (
          <Text style={[styles.errorText, { color: '#EF4444' }]}>{error.message}</Text>
        )}
      </ScreenContainer>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <ScreenContainer>
          <SubscriptionCard
            title={t('subscription.paywall.card.title')}
            subtitle={t('subscription.paywall.card.subtitle')}
            badge={t(
              isActive
                ? 'subscription.paywall.card.badge.premium'
                : 'subscription.paywall.card.badge.free'
            )}
            features={[
              t('subscription.paywall.card.feature.unlimited_analyses'),
              t('subscription.paywall.card.feature.unlimited_explorations'),
              t('subscription.paywall.card.feature.priority'),
            ]}
            loading={processing}
          />

          {sortedPackages.map((pkg) => {
            const optionKey = pkg.interval === 'monthly' ? 'monthly' : 'annual';
            return (
              <PricingOption
                key={pkg.id}
                id={pkg.id}
                title={translateWithFallback(
                  `subscription.paywall.option.title.${optionKey}`,
                  pkg.title
                )}
                subtitle={translateWithFallback(
                  `subscription.paywall.option.description.${optionKey}`,
                  pkg.description
                )}
                price={pkg.priceFormatted}
                intervalLabel={translateWithFallback(
                  `subscription.paywall.option.interval.${optionKey}`
                )}
                badge={
                  pkg.interval === 'annual'
                    ? t('subscription.paywall.option.badge.annual')
                    : undefined
                }
                selected={effectiveSelectedId === pkg.id}
                disabled={processing || loading || isActive}
                onPress={handleSelect}
                testID={
                  pkg.interval === 'monthly'
                    ? TID.Button.PaywallSelectMonthly
                    : TID.Button.PaywallSelectAnnual
                }
              />
            );
          })}

          <View style={styles.actions}>
            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                { backgroundColor: canPurchase ? colors.accent : colors.backgroundSecondary },
                pressed && canPurchase && styles.primaryButtonPressed,
              ]}
              disabled={!canPurchase}
              onPress={handlePurchase}
              testID={TID.Button.PaywallPurchase}
            >
              {processing ? (
                <ActivityIndicator color={colors.textOnAccentSurface} />
              ) : (
                <Text
                  style={[
                    styles.primaryLabel,
                    { color: canPurchase ? colors.textOnAccentSurface : colors.textSecondary },
                  ]}
                >
                  {t(
                    isActive
                      ? 'subscription.paywall.button.primary.premium'
                      : 'subscription.paywall.button.primary.free'
                  )}
                </Text>
              )}
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.secondaryButtonPressed]}
              onPress={handleRestore}
              disabled={processing}
              testID={TID.Button.PaywallRestore}
            >
              <Text style={[styles.secondaryLabel, { color: colors.textSecondary }]}>
                {t('subscription.paywall.button.restore')}
              </Text>
            </Pressable>
          </View>

          <Text style={[styles.notice, { color: colors.textSecondary }]}>
            {t('subscription.paywall.notice.store')}
          </Text>
        </ScreenContainer>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  headerContainer: {
    paddingTop: ThemeLayout.spacing.lg,
    paddingHorizontal: ThemeLayout.spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  headerSubtitle: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_400Regular',
    marginBottom: 8,
  },
  closeButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  closeButtonPressed: {
    opacity: 0.7,
  },
  closeLabel: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_400Regular',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  loadingLabel: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_400Regular',
  },
  errorText: {
    marginTop: 4,
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_400Regular',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: ThemeLayout.spacing.md,
    paddingTop: ThemeLayout.spacing.md,
    paddingBottom: ThemeLayout.spacing.lg,
  },
  actions: {
    marginTop: ThemeLayout.spacing.lg,
    gap: ThemeLayout.spacing.sm,
  },
  primaryButton: {
    borderRadius: ThemeLayout.borderRadius.full,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonPressed: {
    opacity: 0.9,
  },
  primaryLabel: {
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  secondaryButton: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  secondaryButtonPressed: {
    opacity: 0.8,
  },
  secondaryLabel: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_500Medium',
  },
  notice: {
    marginTop: 8,
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_400Regular',
  },
});
