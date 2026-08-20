import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AtmosphericBackground } from '@/components/inspiration/AtmosphericBackground';
import { PressableScale, Reveal } from '@/components/motion';
import { ScreenContainer } from '@/components/ScreenContainer';
import { Toast } from '@/components/Toast';
import { PricingOption } from '@/components/subscription/PricingOption';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { StandardBottomSheet } from '@/components/ui/StandardBottomSheet';
import { ThemeLayout } from '@/constants/journalTheme';
import { getLegalLink, type LegalLinkKind } from '@/constants/legalLinks';
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
import { clearReturnToPaywallIntent, requestReturnToPaywallIntent } from '@/lib/navigationIntents';
import {
  calculateAnnualDiscount,
  calculateMonthlyEquivalent,
  sortPackages,
} from '@/lib/paywallUtils';
import { getPaywallVariant, PLUS_PAYWALL_FEATURE_KEYS } from '@/lib/paywallVariants';
import { classifyPurchaseFailure } from '@/lib/subscriptionErrors';
import { TID } from '@/lib/testIDs';

const log = createScopedLogger('[Paywall]');
const PAYWALL_MAX_WIDTH = 720;

/**
 * The purchase button changes colour when the selection makes it purchasable. Crossing
 * that over — rather than repainting it — is the visual answer to picking a plan.
 */
const CTA_TRANSITION = ['backgroundColor', 'borderColor'] as const;

export default function PaywallScreen() {
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const { t, translationRevision, currentLang } = useTranslation();
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
  const purchaseOutcomeRef = useRef<'none' | 'completed' | 'restored'>('none');
  const dismissedTrackedRef = useRef(false);

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
  const selectedPackage = useMemo(
    () => sortedPackages.find((pkg) => pkg.id === effectiveSelectedId) ?? null,
    [effectiveSelectedId, sortedPackages]
  );
  const selectedPlan = selectedPackage?.interval ?? null;
  const selectedTrialDays = selectedPackage?.freeTrialDays ?? null;
  const analyticsTier = subscriptionStatus?.tier ?? 'free';
  const canPurchase =
    Boolean(effectiveSelectedId) && !processing && !loading && !isActive && !requiresAuth;

  const handleClose = useCallback(() => {
    // Leaving the paywall on purpose ends any "come back after sign-in" intent.
    clearReturnToPaywallIntent();
    if (!isActive && purchaseOutcomeRef.current === 'none' && !dismissedTrackedRef.current) {
      dismissedTrackedRef.current = true;
      void trackProductEvent('paywall_dismissed', {
        trigger: paywallTrigger,
        tier: analyticsTier,
        plan_selected: selectedId !== null,
      });
    }
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/settings');
    }
  }, [analyticsTier, isActive, paywallTrigger, selectedId]);

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
    const plan = sortedPackages.find((pkg) => pkg.id === id)?.interval;
    if (plan) {
      void trackProductEvent('paywall_plan_selected', {
        trigger: paywallTrigger,
        plan,
        tier: analyticsTier,
      });
    }
  }, [analyticsTier, paywallTrigger, sortedPackages]);

  const handleOpenAuth = useCallback(() => {
    // Remember the paywall context so a successful sign-in comes straight back
    // here instead of leaving the user on the Settings tab.
    requestReturnToPaywallIntent(paywallTrigger, { persist: true });
    router.replace('/(tabs)/settings?section=account');
  }, [paywallTrigger]);

  const handleOpenLegalLink = useCallback((kind: LegalLinkKind) => {
    void Linking.openURL(getLegalLink(kind, currentLang)).catch(() => {
      // No browser available: nothing actionable to surface here.
    });
  }, [currentLang]);

  const handlePurchase = useCallback(async () => {
    if (!effectiveSelectedId || !canPurchase || !selectedPlan) return;
    void trackProductEvent('purchase_started', {
      trigger: paywallTrigger,
      plan: selectedPlan,
      tier: analyticsTier,
    });
    try {
      const nextStatus = await purchase(effectiveSelectedId);
      purchaseOutcomeRef.current = 'completed';
      clearReturnToPaywallIntent();
      void trackProductEvent('purchase_completed', {
        trigger: paywallTrigger,
        plan: selectedPlan,
        tier: nextStatus?.tier ?? 'plus',
      });
      setToastMessage(t('subscription.paywall.toast.success'));
    } catch (purchaseError) {
      void trackProductEvent('purchase_failed', {
        trigger: paywallTrigger,
        plan: selectedPlan,
        reason: classifyPurchaseFailure(purchaseError),
      });
    }
  }, [analyticsTier, canPurchase, effectiveSelectedId, paywallTrigger, purchase, selectedPlan, t]);

  const handleRestore = useCallback(async () => {
    if (processing || requiresAuth) return;
    try {
      const nextStatus = await restore();
      const restored = Boolean(nextStatus?.isActive);
      if (restored) {
        purchaseOutcomeRef.current = 'restored';
        clearReturnToPaywallIntent();
      }
      void trackProductEvent('restore_completed', {
        trigger: paywallTrigger,
        outcome: restored ? 'restored' : 'nothing_to_restore',
      });
      setToastMessage(t('subscription.paywall.toast.restored'));
    } catch (restoreError) {
      void trackProductEvent('restore_completed', {
        trigger: paywallTrigger,
        outcome: classifyPurchaseFailure(restoreError) === 'cancelled' ? 'cancelled' : 'failed',
      });
    }
  }, [paywallTrigger, processing, requiresAuth, restore, t]);

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
            billingDetail: pkg.freeTrialDays
              ? t('subscription.paywall.option.billing.trial', {
                  days: pkg.freeTrialDays,
                  price: pkg.priceFormatted,
                })
              : isAnnual
                ? t('subscription.paywall.option.billing.annual', { price: pkg.priceFormatted })
                : t('subscription.paywall.option.billing.monthly'),
            badge:
              pkg.freeTrialDays
                ? t('subscription.paywall.option.badge.trial', { days: pkg.freeTrialDays })
                : isAnnual && annualDiscount
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

              <PressableScale
                style={[
                  styles.primaryButton,
                  {
                    backgroundColor: noctalia.action.primary,
                    borderColor: noctalia.action.primaryBorder,
                  },
                ]}
                onPress={handleOpenAuth}
                hitSlop={0}
                accessibilityRole="button"
                testID={TID.Button.PaywallPurchase}
              >
                <Text style={[styles.primaryLabel, { color: noctalia.action.primaryText }]}>
                  {translateWithFallback(paywallVariant.primaryLabelKey)}
                </Text>
              </PressableScale>

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
              <IconSymbol name="moon.stars.fill" size={24} color={noctalia.accent.text} />
              <Text style={[styles.brandName, { color: noctalia.text.primary }]}>Noctalia</Text>
            </View>
            <Pressable
              onPress={handleClose}
              style={({ pressed }) => [styles.closeButton, pressed && styles.closeButtonPressed]}
              accessibilityRole="button"
              testID={TID.Button.PaywallClose}
            >
              <Text style={[styles.closeLabel, { color: noctalia.accent.text }]}>
                {t('subscription.paywall.button.close')}
              </Text>
            </Pressable>
          </View>

          {/* The paywall is a rare screen and a pitch: the offer arrives a beat before the
              price, and the price a beat before the button. This is the one surface where
              a staggered entrance is the point rather than decoration. */}
          <Reveal index={0}>
            {!isActive ? (
              <View style={styles.kickerRow}>
                <IconSymbol name="sparkles" size={13} color={noctalia.accent.text} />
                <Text style={[styles.kickerText, { color: noctalia.accent.text }]}>
                  {translateWithFallback(paywallVariant.chipKey)}
                </Text>
                <IconSymbol name="sparkles" size={13} color={noctalia.accent.text} />
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
          </Reveal>

          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={noctalia.accent.text} />
              <Text style={[styles.loadingLabel, { color: noctalia.text.secondary }]}>
                {t('subscription.paywall.loading')}
              </Text>
            </View>
          ) : null}

          <Reveal index={1}>
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
                    <Text style={[styles.comparisonPlusHeaderText, { color: noctalia.accent.text }]}>
                      {t('subscription.paywall.comparison.plus')}
                    </Text>
                    <IconSymbol name="sparkles" size={16} color={noctalia.accent.text} />
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
                      <IconSymbol name={row.icon} size={15} color={noctalia.accent.text} />
                    </View>
                    <Text style={[styles.comparisonFeatureText, { color: noctalia.text.primary }]}>
                      {row.label}
                    </Text>
                  </View>
                  <View style={styles.comparisonFreeCell}>
                    <View style={styles.comparisonFreeValue}>
                      {row.showFreeInfinity ? (
                        <Text style={[styles.comparisonInfinity, { color: noctalia.accent.text }]}>∞</Text>
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
                        <Text style={[styles.comparisonInfinity, { color: noctalia.accent.text }]}>∞</Text>
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
                        style={[styles.benefitInfinity, { color: noctalia.accent.text }]}
                      >
                        ∞
                      </Text>
                    ) : (
                      <IconSymbol name="checkmark" size={14} color={noctalia.accent.text} />
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
          </Reveal>

          {!isActive ? (
            <Reveal index={2} style={styles.pricingGrid}>
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
            </Reveal>
          ) : null}

          {!loading && !requiresAuth && !isActive && sortedPackages.length === 0 ? (
            <Text style={[styles.emptyText, { color: noctalia.text.secondary }]}>
              {t('subscription.paywall.empty')}
            </Text>
          ) : null}

          <Reveal index={3} style={styles.actions}>
            {!isActive ? (
              <PressableScale
                style={[
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
                ]}
                transitionProperties={CTA_TRANSITION}
                disabled={requiresAuth ? processing || loading : !canPurchase}
                onPress={requiresAuth ? handleOpenAuth : handlePurchase}
                // The button spans the screen and already clears 44pt; extra slop would
                // only reach into the footnote above it.
                hitSlop={0}
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
                      : selectedTrialDays
                        ? t('subscription.paywall.button.primary.trial', { days: selectedTrialDays })
                        : translateWithFallback(paywallVariant.primaryLabelKey)}
                  </Text>
                )}
              </PressableScale>
            ) : null}

            {!isActive && !requiresAuth && selectedTrialDays && selectedPackage ? (
              <Text
                style={[styles.trialFootnote, { color: noctalia.text.secondary }]}
                testID={TID.Text.PaywallTrialFootnote}
              >
                {t('subscription.paywall.trial_footnote', {
                  days: selectedTrialDays,
                  price: selectedPackage.priceFormatted,
                })}
              </Text>
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
          </Reveal>

          <Reveal index={4}>
          {!requiresAuth ? (
            <Text style={[styles.notice, { color: noctalia.text.secondary }]}>
              {t('subscription.paywall.notice.store')}
            </Text>
          ) : null}

          <View style={styles.legalLinks}>
            <Pressable
              accessibilityRole="link"
              onPress={() => handleOpenLegalLink('termsOfUse')}
              style={({ pressed }) => [pressed && styles.legalLinkPressed]}
              testID={TID.Button.PaywallTermsOfUse}
            >
              <Text style={[styles.legalLink, { color: noctalia.text.secondary }]}>
                {t('settings.legal.termsOfUse')}
              </Text>
            </Pressable>
            <Text style={[styles.legalSeparator, { color: noctalia.text.secondary }]}>·</Text>
            <Pressable
              accessibilityRole="link"
              onPress={() => handleOpenLegalLink('privacyPolicy')}
              style={({ pressed }) => [pressed && styles.legalLinkPressed]}
              testID={TID.Button.PaywallPrivacyPolicy}
            >
              <Text style={[styles.legalLink, { color: noctalia.text.secondary }]}>
                {t('settings.legal.privacyPolicy')}
              </Text>
            </Pressable>
          </View>
          </Reveal>
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
        subtitle={error
          ? translateWithFallback(error.message, t('subscription.paywall.error.message'))
          : undefined}
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
  trialFootnote: {
    marginTop: 8,
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 16,
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
  legalLinks: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    marginTop: 10,
  },
  legalLink: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  legalLinkPressed: {
    opacity: 0.75,
  },
  legalSeparator: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 12,
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
