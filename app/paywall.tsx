import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenContainer } from '@/components/ScreenContainer';
import { Toast } from '@/components/Toast';
import { PricingOption } from '@/components/subscription/PricingOption';
import { SubscriptionCard } from '@/components/subscription/SubscriptionCard';
import { StandardBottomSheet } from '@/components/ui/StandardBottomSheet';
import { ThemeLayout } from '@/constants/journalTheme';
import { useTheme } from '@/context/ThemeContext';
import { useClearWebFocus } from '@/hooks/useClearWebFocus';
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

function calculateAnnualDiscount(packages: PurchasePackage[]): number | null {
  const monthly = packages.find((p) => p.interval === 'monthly');
  const annual = packages.find((p) => p.interval === 'annual');
  if (!monthly || !annual || monthly.price <= 0 || annual.price <= 0) {
    return null;
  }
  const yearlyFromMonthly = monthly.price * 12;
  const savings = ((yearlyFromMonthly - annual.price) / yearlyFromMonthly) * 100;
  return Math.round(savings);
}

export default function PaywallScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  useClearWebFocus();
  const { isActive, loading, processing, error, packages, purchase, restore, requiresAuth } = useSubscription();
  const insets = useSafeAreaInsets();
  const sortedPackages = useMemo(() => sortPackages(packages), [packages]);
  const annualDiscount = useMemo(() => calculateAnnualDiscount(packages), [packages]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [showErrorSheet, setShowErrorSheet] = useState(false);

  // Afficher la bottom sheet quand une erreur survient
  useEffect(() => {
    if (__DEV__) {
      console.log('[Paywall] error state changed:', error?.message);
    }
    if (error) {
      if (__DEV__) {
        console.log('[Paywall] showing error bottom sheet');
      }
      setShowErrorSheet(true);
    }
  }, [error]);

  const effectiveSelectedId = selectedId ?? (sortedPackages[0]?.id ?? null);
  const canPurchase =
    Boolean(effectiveSelectedId) && !processing && !loading && !isActive && !requiresAuth;

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

  const handleOpenAuth = () => {
    router.replace('/(tabs)/settings');
  };

  const handlePurchase = async () => {
    if (!effectiveSelectedId || !canPurchase) return;
    try {
      await purchase(effectiveSelectedId);
      setToastMessage(t('subscription.paywall.toast.success'));
    } catch {
    }
  };

  const handleRestore = async () => {
    if (processing || requiresAuth) return;
    try {
      await restore();
      setToastMessage(t('subscription.paywall.toast.restored'));
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
        {(requiresAuth || loading) && (
          <View style={styles.loadingRow}>
            {!requiresAuth && <ActivityIndicator color={colors.accent} />}
            <Text style={[styles.loadingLabel, { color: colors.textSecondary }]}>
              {requiresAuth
                ? t('subscription.paywall.auth_required')
                : t('subscription.paywall.loading')}
            </Text>
          </View>
        )}
        {/* Erreurs affichées dans la bottom sheet */}
      </ScreenContainer>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <ScreenContainer>
          <SubscriptionCard
            title={t('subscription.paywall.card.title')}
            subtitle={t('subscription.paywall.card.subtitle')}
            badge={isActive ? t('subscription.paywall.card.badge.premium') : undefined}
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
                    ? annualDiscount && annualDiscount > 0
                      ? `-${annualDiscount}%`
                      : t('subscription.paywall.option.badge.annual')
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
          {!loading && sortedPackages.length === 0 && (
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {t('subscription.paywall.empty')}
            </Text>
          )}

          <View style={styles.actions}>
            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                {
                  backgroundColor: requiresAuth
                    ? colors.accent
                    : canPurchase
                      ? colors.accent
                      : colors.backgroundSecondary,
                },
                !requiresAuth && pressed && canPurchase && styles.primaryButtonPressed,
              ]}
              disabled={requiresAuth ? processing || loading : !canPurchase}
              onPress={requiresAuth ? handleOpenAuth : handlePurchase}
              testID={TID.Button.PaywallPurchase}
            >
              {processing ? (
                <ActivityIndicator color={colors.textOnAccentSurface} />
              ) : (
                <Text
                  style={[
                    styles.primaryLabel,
                    {
                      color:
                        requiresAuth || canPurchase
                          ? colors.textOnAccentSurface
                          : colors.textSecondary,
                    },
                  ]}
                >
                  {requiresAuth
                    ? t('subscription.paywall.button.primary.auth')
                    : t(
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
              disabled={processing || requiresAuth}
              testID={TID.Button.PaywallRestore}
            >
              <Text style={[styles.secondaryLabel, { color: colors.textSecondary }]}>
                {t('subscription.paywall.button.restore')}
              </Text>
            </Pressable>
          </View>

          <Text style={[styles.notice, { color: colors.textSecondary }]}>
            {requiresAuth
              ? t('subscription.paywall.notice.auth')
              : t('subscription.paywall.notice.store')}
          </Text>
        </ScreenContainer>
      </ScrollView>
      {toastMessage ? (
        <Toast
          message={toastMessage}
          mode="success"
          onHide={() => setToastMessage(null)}
          testID={TID.Toast.PaywallSuccess}
        />
      ) : null}

      <StandardBottomSheet
        visible={showErrorSheet}
        onClose={() => setShowErrorSheet(false)}
        title={t('subscription.paywall.error.title')}
        subtitle={error?.message}
        actions={{
          primaryLabel: t('subscription.paywall.error.ok'),
          onPrimary: () => setShowErrorSheet(false),
        }}
        testID={TID.BottomSheet.PaywallError}
      />
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
  emptyText: {
    marginTop: ThemeLayout.spacing.md,
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_400Regular',
    textAlign: 'center',
  },
});
