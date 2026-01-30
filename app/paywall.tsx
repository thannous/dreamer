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
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { useClearWebFocus } from '@/hooks/useClearWebFocus';
import { useQuota } from '@/hooks/useQuota';
import { useSubscription } from '@/hooks/useSubscription';
import { useTranslation } from '@/hooks/useTranslation';
import { calculateAnnualDiscount, sortPackages } from '@/lib/paywallUtils';
import { createScopedLogger } from '@/lib/logger';
import { TID } from '@/lib/testIDs';

const log = createScopedLogger('[Paywall]');

export default function PaywallScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  useClearWebFocus();
  const { status: subscriptionStatus, isActive, loading, processing, error, packages, purchase, restore, requiresAuth } =
    useSubscription({ loadPackages: true });
  const { quotaStatus } = useQuota();
  const insets = useSafeAreaInsets();
  const sortedPackages = useMemo(() => sortPackages(packages), [packages]);
  const annualDiscount = useMemo(() => calculateAnnualDiscount(packages), [packages]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [showErrorSheet, setShowErrorSheet] = useState(false);

  // If device fingerprint is upgraded, show message encouraging login (guest-only guard).
  // `isUpgraded` is a guest quota concept (device fingerprint was used to create an account before).
  const isDeviceUpgraded = requiresAuth && quotaStatus?.isUpgraded === true;

  // Afficher la bottom sheet quand une erreur survient
  useEffect(() => {
    log.debug('error state changed', error?.message);
    if (error) {
      log.debug('showing error bottom sheet');
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

  const activeTierKey = 'plus';
  const headerTitle = isActive
    ? t(`subscription.paywall.header.${activeTierKey}` as const)
    : t('subscription.paywall.header.free');
  const headerSubtitle = isActive
    ? t(`subscription.paywall.header.subtitle.${activeTierKey}` as const)
    : t('subscription.paywall.header.subtitle.free');

  const translateWithFallback = (key: string, fallback?: string) => {
    const translated = t(key);
    if (translated === key) {
      return fallback ?? key;
    }
    return translated;
  };

  // Format expiry date for display
  const formattedExpiryDate = useMemo(() => {
    const expiryDate = subscriptionStatus?.expiryDate;
    if (!expiryDate) return null;
    try {
      const date = new Date(expiryDate);
      if (Number.isNaN(date.getTime())) return null;
      const dateStr = date.toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
      const timeStr = date.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
      });
      return `${dateStr} à ${timeStr}`;
    } catch {
      return null;
    }
  }, [subscriptionStatus?.expiryDate]);

  // Show upgrade message if device fingerprint is already upgraded
  if (isDeviceUpgraded) {
    return (
      <View style={[styles.root, { backgroundColor: colors.backgroundDark }]} testID={TID.Screen.Paywall}>
        <ScreenContainer style={[styles.headerContainer, { paddingTop: ThemeLayout.spacing.lg + insets.top }]}>
          <View style={styles.headerRow}>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
              {t('subscription.paywall.header.free')}
            </Text>
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
        </ScreenContainer>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <ScreenContainer>
            <View style={styles.upgradedMessageContainer}>
              <Text style={[styles.upgradedTitle, { color: colors.textPrimary }]}>
                {"Vous avez déjà utilisé l'application !"}
              </Text>
              <Text style={[styles.upgradedSubtitle, { color: colors.textSecondary }]}>
                Connectez-vous pour retrouver vos rêves et analyses étendues.
              </Text>

              <Pressable
                style={({ pressed }) => [
                  styles.primaryButton,
                  { backgroundColor: colors.accent },
                  pressed && styles.primaryButtonPressed,
                ]}
                onPress={handleOpenAuth}
                testID={TID.Button.PaywallPurchase}
              >
                <Text
                  style={[
                    styles.primaryLabel,
                    { color: colors.textOnAccentSurface },
                  ]}
                >
                  Se connecter
                </Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.secondaryButtonPressed]}
                onPress={handleClose}
              >
                <Text style={[styles.secondaryLabel, { color: colors.textSecondary }]}>
                  {t('subscription.paywall.button.close')}
                </Text>
              </Pressable>
            </View>
          </ScreenContainer>
        </ScrollView>
      </View>
    );
  }

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
        {isActive && formattedExpiryDate && (
          <Text style={[styles.expiryDate, { color: colors.textSecondary }]}>
            {t('subscription.paywall.expiry_date', { date: formattedExpiryDate })}
            {subscriptionStatus?.willRenew !== undefined && (
              subscriptionStatus.willRenew
                ? ` · ${t('subscription.paywall.auto_renew.on')}`
                : ` · ${t('subscription.paywall.auto_renew.off')}`
            )}
          </Text>
        )}
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
            badge={isActive ? t(`subscription.paywall.card.badge.${activeTierKey}` as const) : undefined}
            features={[
              t('subscription.paywall.card.feature.unlimited_analyses'),
              t('subscription.paywall.card.feature.unlimited_explorations'),
              t('subscription.paywall.card.feature.recorded_dreams'),
              t('subscription.paywall.card.feature.priority'),
            ]}
            status={processing ? 'loading' : 'idle'}
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
                state={
                  (processing || loading || isActive)
                    ? (effectiveSelectedId === pkg.id ? 'selectedDisabled' : 'disabled')
                    : (effectiveSelectedId === pkg.id ? 'selected' : 'unselected')
                }
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
                          ? (`subscription.paywall.button.primary.${activeTierKey}` as const)
                          : 'subscription.paywall.button.primary.free'
                      )}
                </Text>
              )}
            </Pressable>

            {!requiresAuth && (
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
            )}
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
        subtitle={error ? translateWithFallback(error.message, error.message) : undefined}
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
    fontFamily: Fonts.spaceGrotesk.bold,
  },
  headerSubtitle: {
    fontSize: 14,
    fontFamily: Fonts.spaceGrotesk.regular,
    marginBottom: 8,
  },
  expiryDate: {
    fontSize: 13,
    fontFamily: Fonts.spaceGrotesk.medium,
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
    fontFamily: Fonts.spaceGrotesk.regular,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  loadingLabel: {
    fontSize: 13,
    fontFamily: Fonts.spaceGrotesk.regular,
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
    fontFamily: Fonts.spaceGrotesk.bold,
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
    fontFamily: Fonts.spaceGrotesk.medium,
  },
  notice: {
    marginTop: 8,
    fontSize: 12,
    fontFamily: Fonts.spaceGrotesk.regular,
  },
  emptyText: {
    marginTop: ThemeLayout.spacing.md,
    fontSize: 14,
    fontFamily: Fonts.spaceGrotesk.regular,
    textAlign: 'center',
  },
  upgradedMessageContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: ThemeLayout.spacing.xl,
    paddingHorizontal: ThemeLayout.spacing.md,
  },
  upgradedTitle: {
    fontSize: 20,
    fontFamily: Fonts.spaceGrotesk.bold,
    marginBottom: ThemeLayout.spacing.md,
    textAlign: 'center',
  },
  upgradedSubtitle: {
    fontSize: 14,
    fontFamily: Fonts.spaceGrotesk.regular,
    textAlign: 'center',
    marginBottom: ThemeLayout.spacing.lg,
    lineHeight: 20,
  },
});
