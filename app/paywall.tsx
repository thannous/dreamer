import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AtmosphericBackground } from '@/components/inspiration/AtmosphericBackground';
import { ScreenContainer } from '@/components/ScreenContainer';
import { Toast } from '@/components/Toast';
import { PricingOption } from '@/components/subscription/PricingOption';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { StandardBottomSheet } from '@/components/ui/StandardBottomSheet';
import { ThemeLayout } from '@/constants/journalTheme';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { useClearWebFocus } from '@/hooks/useClearWebFocus';
import { useLocaleFormatting } from '@/hooks/useLocaleFormatting';
import { useQuota } from '@/hooks/useQuota';
import { useSubscription } from '@/hooks/useSubscription';
import { useTranslation } from '@/hooks/useTranslation';
import { getPaywallTrigger, trackProductEvent } from '@/lib/analytics';
import { createScopedLogger } from '@/lib/logger';
import {
  calculateAnnualDiscount,
  calculateMonthlyEquivalent,
  sortPackages,
} from '@/lib/paywallUtils';
import { getPaywallVariant, PLUS_PAYWALL_FEATURE_KEYS } from '@/lib/paywallVariants';
import { TID } from '@/lib/testIDs';

const log = createScopedLogger('[Paywall]');
const PAYWALL_MAX_WIDTH = 720;

export default function PaywallScreen() {
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const { t, translationRevision } = useTranslation();
  const { formatDate, formatNumber, formatTime } = useLocaleFormatting();
  const params = useLocalSearchParams<{ trigger?: string }>();
  useClearWebFocus();
  const {
    status: subscriptionStatus,
    isActive,
    loading,
    processing,
    error,
    packages,
    purchase,
    restore,
    requiresAuth,
  } = useSubscription({ loadPackages: true });
  const { quotaStatus } = useQuota();
  const insets = useSafeAreaInsets();
  const sortedPackages = useMemo(() => sortPackages(packages), [packages]);
  const annualDiscount = useMemo(() => calculateAnnualDiscount(packages), [packages]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showErrorSheet, setShowErrorSheet] = useState(false);
  const viewedAnalyticsKeyRef = useRef<string | null>(null);

  const rootStyle = useMemo(
    () => [styles.root, { backgroundColor: noctalia.screen.background }],
    [noctalia.screen.background]
  );
  const headerContainerStyle = useMemo(
    () => [styles.headerContainer, { paddingTop: ThemeLayout.spacing.lg + insets.top }],
    [insets.top]
  );

  const isDeviceUpgraded = requiresAuth && quotaStatus?.isUpgraded === true;
  const routeTrigger = getPaywallTrigger(params.trigger);
  const paywallTrigger = isDeviceUpgraded ? 'returning_device' : routeTrigger;
  const paywallVariant = useMemo(() => getPaywallVariant(paywallTrigger), [paywallTrigger]);

  useEffect(() => {
    log.debug('error state changed', error?.message);
    if (error) {
      log.debug('showing error bottom sheet');
      setShowErrorSheet(true);
    }
  }, [error]);

  useEffect(() => {
    if (loading) {
      return;
    }
    const offeringId = sortedPackages[0]?.id ?? null;
    const usageCount = quotaStatus?.usage.analysis.used ?? null;
    const analyticsKey = `${paywallTrigger}:${subscriptionStatus?.tier ?? 'free'}:${usageCount ?? 'none'}:${offeringId ?? 'none'}`;
    if (viewedAnalyticsKeyRef.current === analyticsKey) {
      return;
    }
    viewedAnalyticsKeyRef.current = analyticsKey;
    void trackProductEvent('paywall_viewed', {
      trigger: paywallTrigger,
      tier: subscriptionStatus?.tier ?? 'free',
      usage_count: usageCount,
      offering_id: offeringId,
    });
  }, [loading, paywallTrigger, quotaStatus?.usage.analysis.used, sortedPackages, subscriptionStatus?.tier]);

  const defaultSelectedId = useMemo(
    () => sortedPackages.find((pkg) => pkg.interval === 'annual')?.id ?? sortedPackages[0]?.id ?? null,
    [sortedPackages]
  );
  const effectiveSelectedId = selectedId ?? defaultSelectedId;
  const canPurchase =
    Boolean(effectiveSelectedId) && !processing && !loading && !isActive && !requiresAuth;

  const handleClose = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/settings');
    }
  }, []);

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  const handleOpenAuth = useCallback(() => {
    router.replace('/(tabs)/settings');
  }, []);

  const handlePurchase = useCallback(async () => {
    if (!effectiveSelectedId || !canPurchase) return;
    try {
      await purchase(effectiveSelectedId);
      setToastMessage(t('subscription.paywall.toast.success'));
    } catch {
    }
  }, [canPurchase, effectiveSelectedId, purchase, t]);

  const handleRestore = useCallback(async () => {
    if (processing || requiresAuth) return;
    try {
      await restore();
      setToastMessage(t('subscription.paywall.toast.restored'));
    } catch {
    }
  }, [processing, requiresAuth, restore, t]);

  const handleHideToast = useCallback(() => {
    setToastMessage(null);
  }, []);

  const handleCloseErrorSheet = useCallback(() => {
    setShowErrorSheet(false);
  }, []);

  const translateWithFallback = useCallback((key: string, fallback?: string) => {
    void translationRevision;
    const translated = t(key);
    if (translated === key) {
      return fallback ?? key;
    }
    return translated;
  }, [t, translationRevision]);

  const activeTierKey = 'plus';
  const headerTitle = isActive
    ? t(`subscription.paywall.header.${activeTierKey}` as const)
    : translateWithFallback(paywallVariant.headerTitleKey);
  const headerSubtitle = isActive
    ? t(`subscription.paywall.header.subtitle.${activeTierKey}` as const)
    : translateWithFallback(paywallVariant.headerSubtitleKey);

  const formattedExpiryDate = useMemo(() => {
    const expiryDate = subscriptionStatus?.expiryDate;
    if (!expiryDate) return null;
    try {
      const date = new Date(expiryDate);
      if (Number.isNaN(date.getTime())) return null;
      const dateStr = formatDate(date, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
      const timeStr = formatTime(date, {
        hour: '2-digit',
        minute: '2-digit',
      });
      return `${dateStr} à ${timeStr}`;
    } catch {
      return null;
    }
  }, [formatDate, formatTime, subscriptionStatus?.expiryDate]);

  const subscriptionFeatures = useMemo(
    () => {
      void translationRevision;
      if (!isActive) {
        return paywallVariant.featureKeys.map((key) => translateWithFallback(key));
      }
      return PLUS_PAYWALL_FEATURE_KEYS.map((key) => t(key));
    },
    [isActive, paywallVariant.featureKeys, t, translateWithFallback, translationRevision]
  );

  const packageOptions = useMemo(
    () => {
      void translationRevision;
      return [...sortedPackages]
        .sort((a, b) => {
          if (a.interval === b.interval) return 0;
          return a.interval === 'annual' ? -1 : 1;
        })
        .map((pkg) => {
          const optionKey = pkg.interval === 'monthly' ? 'monthly' : 'annual';
          const isAnnual = pkg.interval === 'annual';
          const comparablePrice = isAnnual
            ? formatNumber(calculateMonthlyEquivalent(pkg), {
                style: 'currency',
                currency: pkg.currency,
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })
            : pkg.priceFormatted;
          return {
            id: pkg.id,
            title: translateWithFallback(
              `subscription.paywall.option.title.${optionKey}`,
              pkg.title
            ),
            price: comparablePrice,
            intervalLabel: translateWithFallback('subscription.paywall.option.interval.monthly'),
            billingDetail: isAnnual
              ? t('subscription.paywall.option.billing.annual', { price: pkg.priceFormatted })
              : t('subscription.paywall.option.billing.monthly'),
            badge:
              isAnnual && annualDiscount
                ? `−${annualDiscount}%`
                : undefined,
            testID:
              pkg.interval === 'monthly'
                ? TID.Button.PaywallSelectMonthly
                : TID.Button.PaywallSelectAnnual,
          };
        });
    },
    [annualDiscount, formatNumber, sortedPackages, t, translateWithFallback, translationRevision]
  );
  const visibleSubscriptionFeatures = subscriptionFeatures.slice(0, 3);
  const comparisonRows = useMemo(
    () => {
      void translationRevision;
      return [
        {
          key: 'recording',
          icon: 'book.closed.fill' as const,
          label: t('subscription.paywall.comparison.recording'),
          free: t('subscription.paywall.comparison.unlimited_recording'),
          plus: t('subscription.paywall.comparison.unlimited_recording'),
          showFreeInfinity: true,
          showPlusInfinity: true,
        },
        {
          key: 'analysis',
          icon: 'brain' as const,
          label: t('subscription.paywall.comparison.analysis'),
          free: t('subscription.paywall.comparison.limited'),
          plus: t('subscription.paywall.comparison.unlimited'),
          showFreeInfinity: false,
          showPlusInfinity: true,
        },
        {
          key: 'exploration',
          icon: 'bubble.left.and.bubble.right' as const,
          label: t('subscription.paywall.comparison.exploration'),
          free: t('subscription.paywall.comparison.limited'),
          plus: t('subscription.paywall.comparison.unlimited'),
          showFreeInfinity: false,
          showPlusInfinity: true,
        },
        {
          key: 'synthesis',
          icon: 'sparkles' as const,
          label: t('subscription.paywall.comparison.synthesis'),
          free: t('subscription.paywall.comparison.essential'),
          plus: t('subscription.paywall.comparison.deep'),
          showFreeInfinity: false,
          showPlusInfinity: false,
        },
      ];
    },
    [t, translationRevision]
  );

  if (isDeviceUpgraded) {
    return (
      <View style={rootStyle} testID={TID.Screen.Paywall}>
        <AtmosphericBackground />
        <ScreenContainer style={headerContainerStyle} maxWidth={PAYWALL_MAX_WIDTH}>
          <View style={styles.headerRow}>
            <Text style={[styles.headerTitle, { color: noctalia.text.primary }]}>
              {translateWithFallback(paywallVariant.headerTitleKey)}
            </Text>
            <Pressable
              onPress={handleClose}
              style={({ pressed }) => [styles.closeButton, pressed && styles.closeButtonPressed]}
              accessibilityRole="button"
              testID={TID.Button.PaywallClose}
            >
              <Text style={[styles.closeLabel, { color: noctalia.text.secondary }]}>
                {t('subscription.paywall.button.close')}
              </Text>
            </Pressable>
          </View>
        </ScreenContainer>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          contentInsetAdjustmentBehavior="automatic"
        >
          <ScreenContainer maxWidth={PAYWALL_MAX_WIDTH}>
            <View style={styles.upgradedMessageContainer}>
              <Text style={[styles.upgradedTitle, { color: noctalia.text.primary }]}>
                {translateWithFallback(paywallVariant.cardTitleKey)}
              </Text>
              <Text style={[styles.upgradedSubtitle, { color: noctalia.text.secondary }]}>
                {translateWithFallback(paywallVariant.cardSubtitleKey)}
              </Text>

              <Pressable
                style={({ pressed }) => [
                  styles.primaryButton,
                  {
                    backgroundColor: noctalia.action.primary,
                    borderColor: noctalia.action.primaryBorder,
                  },
                  pressed && styles.primaryButtonPressed,
                ]}
                onPress={handleOpenAuth}
                accessibilityRole="button"
                testID={TID.Button.PaywallPurchase}
              >
                <Text style={[styles.primaryLabel, { color: noctalia.action.primaryText }]}>
                  {translateWithFallback(paywallVariant.primaryLabelKey)}
                </Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.secondaryButtonPressed]}
                onPress={handleClose}
                accessibilityRole="button"
              >
                <Text style={[styles.secondaryLabel, { color: noctalia.text.secondary }]}>
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
    <View style={rootStyle} testID={TID.Screen.Paywall}>
      <AtmosphericBackground />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: ThemeLayout.spacing.sm + insets.top,
            paddingBottom: ThemeLayout.spacing.lg + insets.bottom,
          },
        ]}
        contentInsetAdjustmentBehavior="automatic"
      >
        <ScreenContainer maxWidth={PAYWALL_MAX_WIDTH}>
          <View style={styles.topBar}>
            <View style={styles.brandLockup}>
              <IconSymbol name="moon.stars.fill" size={24} color={noctalia.accent.base} />
              <Text style={[styles.brandName, { color: noctalia.text.primary }]}>Noctalia</Text>
            </View>
            <Pressable
              onPress={handleClose}
              style={({ pressed }) => [styles.closeButton, pressed && styles.closeButtonPressed]}
              accessibilityRole="button"
              testID={TID.Button.PaywallClose}
            >
              <Text style={[styles.closeLabel, { color: noctalia.accent.base }]}>
                {t('subscription.paywall.button.close')}
              </Text>
            </Pressable>
          </View>

          {!isActive ? (
            <View style={styles.kickerRow}>
              <IconSymbol name="sparkles" size={13} color={noctalia.accent.base} />
              <Text style={[styles.kickerText, { color: noctalia.accent.base }]}>
                {translateWithFallback(paywallVariant.chipKey)}
              </Text>
              <IconSymbol name="sparkles" size={13} color={noctalia.accent.base} />
            </View>
          ) : null}

          <Text style={[styles.headerTitle, { color: noctalia.text.primary }]}>{headerTitle}</Text>
          <Text style={[styles.headerSubtitle, { color: noctalia.text.secondary }]}>{headerSubtitle}</Text>

          {isActive && formattedExpiryDate ? (
            <Text style={[styles.expiryDate, { color: noctalia.text.secondary }]}>
              {t('subscription.paywall.expiry_date', { date: formattedExpiryDate })}
              {subscriptionStatus?.willRenew !== undefined
                ? subscriptionStatus.willRenew
                  ? ` · ${t('subscription.paywall.auto_renew.on')}`
                  : ` · ${t('subscription.paywall.auto_renew.off')}`
                : ''}
            </Text>
          ) : null}

          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={noctalia.accent.base} />
              <Text style={[styles.loadingLabel, { color: noctalia.text.secondary }]}>
                {t('subscription.paywall.loading')}
              </Text>
            </View>
          ) : null}

          {!isActive ? (
            <View
              style={[
                styles.comparisonTable,
                {
                  borderColor: noctalia.surface.borderStrong,
                  backgroundColor: noctalia.surface.base,
                },
              ]}
            >
              <View style={styles.comparisonHeaderRow}>
                <View style={styles.comparisonFeatureCell} />
                <View style={styles.comparisonFreeCell}>
                  <Text style={[styles.comparisonHeaderText, { color: noctalia.text.secondary }]}>
                    {t('subscription.paywall.comparison.free')}
                  </Text>
                </View>
                <View style={[styles.comparisonPlusCell, { backgroundColor: noctalia.surface.active }]}>
                  <View style={styles.comparisonPlusHeader}>
                    <Text style={[styles.comparisonPlusHeaderText, { color: noctalia.accent.base }]}>
                      {t('subscription.paywall.comparison.plus')}
                    </Text>
                    <IconSymbol name="sparkles" size={16} color={noctalia.accent.base} />
                  </View>
                </View>
              </View>

              {comparisonRows.map((row) => (
                <View
                  key={row.key}
                  style={[styles.comparisonRow, { borderTopColor: noctalia.surface.border }]}
                  accessible
                  accessibilityLabel={`${row.label}. ${t('subscription.paywall.comparison.free')}: ${row.free}. ${t('subscription.paywall.comparison.plus')}: ${row.plus}.`}
                >
                  <View style={styles.comparisonFeatureCell}>
                    <View style={[styles.comparisonIcon, { backgroundColor: noctalia.surface.soft }]}>
                      <IconSymbol name={row.icon} size={15} color={noctalia.accent.base} />
                    </View>
                    <Text style={[styles.comparisonFeatureText, { color: noctalia.text.primary }]}>
                      {row.label}
                    </Text>
                  </View>
                  <View style={styles.comparisonFreeCell}>
                    <View style={styles.comparisonFreeValue}>
                      {row.showFreeInfinity ? (
                        <Text style={[styles.comparisonInfinity, { color: noctalia.accent.base }]}>∞</Text>
                      ) : null}
                      <Text
                        style={[
                          styles.comparisonFreeText,
                          {
                            color: row.showFreeInfinity
                              ? noctalia.text.primary
                              : noctalia.text.secondary,
                          },
                        ]}
                      >
                        {row.free}
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.comparisonPlusCell, { backgroundColor: noctalia.surface.active }]}>
                    <View style={styles.comparisonPlusValue}>
                      {row.showPlusInfinity ? (
                        <Text style={[styles.comparisonInfinity, { color: noctalia.accent.base }]}>∞</Text>
                      ) : null}
                      <Text style={[styles.comparisonPlusText, { color: noctalia.text.primary }]}>
                        {row.plus}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.benefitList}>
              {visibleSubscriptionFeatures.map((feature, index) => (
                <View key={feature} style={styles.benefitRow}>
                  <View style={[styles.benefitIcon, { backgroundColor: noctalia.surface.active }]}>
                    {index < 2 ? (
                      <Text
                        accessible={false}
                        style={[styles.benefitInfinity, { color: noctalia.accent.base }]}
                      >
                        ∞
                      </Text>
                    ) : (
                      <IconSymbol name="checkmark" size={14} color={noctalia.accent.base} />
                    )}
                  </View>
                  <Text
                    style={[
                      styles.benefitText,
                      index < 2 && styles.benefitTextUnlimited,
                      { color: noctalia.text.primary },
                    ]}
                  >
                    {feature}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {!isActive ? (
            <View style={styles.pricingGrid}>
              {packageOptions.map((pkg) => (
                <PricingOption
                  key={pkg.id}
                  id={pkg.id}
                  title={pkg.title}
                  price={pkg.price}
                  intervalLabel={pkg.intervalLabel}
                  billingDetail={pkg.billingDetail}
                  badge={pkg.badge}
                  state={
                    processing || loading
                      ? effectiveSelectedId === pkg.id
                        ? 'selectedDisabled'
                        : 'disabled'
                      : effectiveSelectedId === pkg.id
                        ? 'selected'
                        : 'unselected'
                  }
                  onPress={handleSelect}
                  testID={pkg.testID}
                  compact
                  style={styles.pricingOption}
                />
              ))}
            </View>
          ) : null}

          {!loading && !requiresAuth && !isActive && sortedPackages.length === 0 ? (
            <Text style={[styles.emptyText, { color: noctalia.text.secondary }]}>
              {t('subscription.paywall.empty')}
            </Text>
          ) : null}

          <View style={styles.actions}>
            {!isActive ? (
              <Pressable
                style={({ pressed }) => [
                  styles.primaryButton,
                  {
                    backgroundColor: requiresAuth
                      ? noctalia.action.primary
                      : canPurchase
                        ? noctalia.action.primary
                        : noctalia.action.disabled,
                    borderColor: requiresAuth || canPurchase
                      ? noctalia.action.primaryBorder
                      : noctalia.action.disabledBorder,
                  },
                  !requiresAuth && pressed && canPurchase && styles.primaryButtonPressed,
                ]}
                disabled={requiresAuth ? processing || loading : !canPurchase}
                onPress={requiresAuth ? handleOpenAuth : handlePurchase}
                accessibilityRole="button"
                testID={TID.Button.PaywallPurchase}
              >
                {processing ? (
                  <ActivityIndicator color={noctalia.action.primaryText} />
                ) : (
                  <Text
                    style={[
                      styles.primaryLabel,
                      {
                        color:
                          requiresAuth || canPurchase
                            ? noctalia.action.primaryText
                            : noctalia.action.disabledText,
                      },
                    ]}
                  >
                    {requiresAuth
                      ? t('subscription.paywall.button.primary.auth')
                      : translateWithFallback(paywallVariant.primaryLabelKey)}
                  </Text>
                )}
              </Pressable>
            ) : null}

            {!isActive ? (
              <Pressable
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.secondaryButtonPressed]}
                onPress={handleClose}
                disabled={processing}
                accessibilityRole="button"
              >
                <Text style={[styles.secondaryLabel, { color: noctalia.text.secondary }]}>
                  {t('subscription.paywall.button.continue_free')}
                </Text>
              </Pressable>
            ) : null}

            {!requiresAuth ? (
              <Pressable
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.secondaryButtonPressed]}
                onPress={handleRestore}
                disabled={processing}
                accessibilityRole="button"
                testID={TID.Button.PaywallRestore}
              >
                <Text style={[styles.secondaryLabel, { color: noctalia.text.secondary }]}>
                  {t('subscription.paywall.button.restore')}
                </Text>
              </Pressable>
            ) : null}
          </View>

          {!requiresAuth ? (
            <Text style={[styles.notice, { color: noctalia.text.secondary }]}>
              {t('subscription.paywall.notice.store')}
            </Text>
          ) : null}
        </ScreenContainer>
      </ScrollView>

      {toastMessage ? (
        <Toast
          message={toastMessage}
          mode="success"
          onHide={handleHideToast}
          testID={TID.Toast.PaywallSuccess}
        />
      ) : null}

      <StandardBottomSheet
        visible={showErrorSheet}
        onClose={handleCloseErrorSheet}
        title={t('subscription.paywall.error.title')}
        subtitle={error ? translateWithFallback(error.message, error.message) : undefined}
        actions={{
          primaryLabel: t('subscription.paywall.error.ok'),
          onPrimary: handleCloseErrorSheet,
        }}
        testID={TID.BottomSheet.PaywallError}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
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
  topBar: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  brandLockup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandName: {
    fontSize: 21,
    lineHeight: 26,
    fontFamily: Fonts.spaceGrotesk.bold,
  },
  headerTitle: {
    fontSize: 28,
    lineHeight: 31,
    fontFamily: Fonts.spaceGrotesk.bold,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 15,
    lineHeight: 21,
    fontFamily: Fonts.spaceGrotesk.regular,
    marginTop: 6,
    textAlign: 'center',
  },
  kickerRow: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 8,
  },
  kickerText: {
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    fontFamily: Fonts.spaceGrotesk.bold,
  },
  expiryDate: {
    fontSize: 13,
    fontFamily: Fonts.spaceGrotesk.medium,
    marginBottom: 8,
  },
  closeButton: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
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
  },
  comparisonTable: {
    overflow: 'hidden',
    borderWidth: 1,
    borderRadius: ThemeLayout.borderRadius.md,
    marginTop: ThemeLayout.spacing.md,
    marginBottom: ThemeLayout.spacing.md,
  },
  comparisonHeaderRow: {
    minHeight: 48,
    flexDirection: 'row',
  },
  comparisonRow: {
    minHeight: 62,
    flexDirection: 'row',
    borderTopWidth: 1,
  },
  comparisonFeatureCell: {
    flex: 1.35,
    minWidth: 0,
    paddingHorizontal: 10,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  comparisonFreeCell: {
    flex: 0.72,
    minWidth: 0,
    paddingHorizontal: 5,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  comparisonPlusCell: {
    flex: 1.05,
    minWidth: 0,
    paddingHorizontal: 7,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  comparisonHeaderText: {
    fontSize: 12,
    fontFamily: Fonts.spaceGrotesk.bold,
    textAlign: 'center',
  },
  comparisonPlusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  comparisonPlusHeaderText: {
    fontSize: 14,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontFamily: Fonts.spaceGrotesk.bold,
  },
  comparisonIcon: {
    width: 27,
    height: 27,
    borderRadius: ThemeLayout.borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  comparisonFeatureText: {
    flex: 1,
    minWidth: 0,
    fontSize: 12,
    lineHeight: 15,
    fontFamily: Fonts.spaceGrotesk.bold,
  },
  comparisonFreeText: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: Fonts.spaceGrotesk.medium,
    textAlign: 'center',
  },
  comparisonFreeValue: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  comparisonPlusValue: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  comparisonInfinity: {
    fontSize: 20,
    lineHeight: 20,
    fontFamily: Fonts.spaceGrotesk.bold,
  },
  comparisonPlusText: {
    flexShrink: 1,
    fontSize: 12,
    lineHeight: 15,
    fontFamily: Fonts.spaceGrotesk.bold,
    textAlign: 'center',
  },
  pricingGrid: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: ThemeLayout.spacing.sm,
  },
  pricingOption: {
    flex: 1,
    minWidth: 0,
  },
  actions: {
    marginTop: ThemeLayout.spacing.md,
    gap: ThemeLayout.spacing.sm,
  },
  benefitList: {
    marginBottom: ThemeLayout.spacing.md,
    gap: ThemeLayout.spacing.sm,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: ThemeLayout.spacing.sm,
  },
  benefitIcon: {
    width: 24,
    height: 24,
    borderRadius: ThemeLayout.borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: Fonts.spaceGrotesk.regular,
  },
  benefitTextUnlimited: {
    fontFamily: Fonts.spaceGrotesk.bold,
  },
  benefitInfinity: {
    fontSize: 19,
    lineHeight: 20,
    fontFamily: Fonts.spaceGrotesk.bold,
  },
  primaryButton: {
    borderRadius: ThemeLayout.borderRadius.full,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
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
    gap: 3,
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
