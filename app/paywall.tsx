import { SubscriptionExpiryNotice } from '@/components/subscription/SubscriptionExpiryNotice';
import { router, useFocusEffect, useLocalSearchParams, type Href } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DreamerArtworkWindow } from '@/components/ui/DreamerBackground';
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
import { useAuth } from '@/context/AuthContext';
import { QUOTAS } from '@/constants/limits';
import { useDreamsData } from '@/context/DreamsContext';
import { whileHeld } from '@/lib/attempt';
import { formatQuotaResetDate } from '@/lib/quotaReset';
import { resolveDreamRoute } from '@/lib/dreamRoute';
import { getSavedDreamReturnRoute, requestAnalysisReturnRoute, type AnalysisPaywallParams } from '@/lib/paywallRoute';
import { useTheme } from '@/context/ThemeContext';
import { useClearWebFocus } from '@/hooks/useClearWebFocus';
import { useLocaleFormatting } from '@/hooks/useLocaleFormatting';
import { useQuota } from '@/hooks/useQuota';
import { useSubscription } from '@/hooks/useSubscription';
import { useTranslation } from '@/hooks/useTranslation';
import { getPaywallTrigger, trackProductEvent } from '@/lib/analytics';
import { markStoreReviewPaywallSeen } from '@/lib/storeReview';
import {
  clearReturnToPaywallIntent,
  clearReturnToPaywallRestore,
  peekReturnToPaywallRestore,
  requestReturnToPaywallIntent,
} from '@/lib/navigationIntents';
import {
  calculateAnnualDiscount,
  calculateMonthlyEquivalent,
  sortPackages,
} from '@/lib/paywallUtils';
import { getPaywallVariant, PLUS_PAYWALL_FEATURE_KEYS } from '@/lib/paywallVariants';
import { classifyPurchaseFailure } from '@/lib/subscriptionErrors';
import { TID } from '@/lib/testIDs';
import { HeaderScrollView, useHeaderScroll } from '@/components/ui/headerStretch';
import { withHeaderScroll } from '@/components/ui/HeaderScrollScope';
import { TypeScale } from '@/constants/typeScale';

const PAYWALL_MAX_WIDTH = 720;
const PAYWALL_PAINTING_HEIGHT = 170;
/** Each store only names itself; the web keeps the line that covers both. */
const STORE_NOTICE_KEY = Platform.select({
  ios: 'subscription.paywall.notice.store_ios',
  android: 'subscription.paywall.notice.store_android',
  default: 'subscription.paywall.notice.store',
});

/**
 * The purchase button changes colour when the selection makes it purchasable. Crossing
 * that over — rather than repainting it — is the visual answer to picking a plan.
 */
const CTA_TRANSITION = ['backgroundColor', 'borderColor'] as const;

/** What a free account gets against Plus, the numbers every variant's copy can quote. */
const QUOTA_COPY = {
  analyses: QUOTAS.free.analysis ?? 0,
  freeExchanges: QUOTAS.free.messagesPerDream ?? 0,
};

function PaywallScreen() {
  // This screen's own scroll, published to its header painting and title.
  const onHeaderScroll = useHeaderScroll();
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const { t, translationRevision, currentLang } = useTranslation();
  const { formatDate, formatNumber, formatTime, locale } = useLocaleFormatting();
  const params = useLocalSearchParams<AnalysisPaywallParams & { trigger?: string }>();
  const { user, sessionGeneration, isCurrentSession } = useAuth();
  const userId = user?.id;
  const currentSession = useCallback(() => isCurrentSession(userId ?? null, sessionGeneration),
    [isCurrentSession, sessionGeneration, userId]);
  const savedDreamReturnRoute = useMemo(() => getSavedDreamReturnRoute(params, userId), [params, userId]);
  const exitDispatchedRef = useRef(false);
  const [exitDestination, setExitDestination] = useState<Href | null>(null);
  const navigateToDream = useCallback((destination: Href) => setExitDestination(destination), []);
  useClearWebFocus();
  const {
    status: subscriptionStatus,
    isActive,
    loading,
    processing,
    activationPending,
    error,
    clearError,
    packages,
    purchase,
    restore,
    refreshSubscription,
    requiresAuth,
    storeUnavailable,
  } = useSubscription({ loadPackages: true });
  const operationInFlightRef = useRef(false);
  const [operationPending, setOperationPending] = useState(false);
  const awaitingServerAccess = activationPending;
  const busy = processing || operationPending;
  const { quotaStatus } = useQuota();
  const insets = useSafeAreaInsets();
  const sortedPackages = useMemo(() => sortPackages(packages), [packages]);
  const annualDiscount = useMemo(() => calculateAnnualDiscount(packages), [packages]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; mode: 'success' | 'info' } | null>(null);
  const showErrorSheet = Boolean(error);
  const viewedAnalyticsKeyRef = useRef<string | null>(null);
  const purchaseOutcomeRef = useRef<'none' | 'completed' | 'restored'>('none');
  const dismissedTrackedRef = useRef(false);
  // Read on arrival: the root layout drops the paywall intent once this screen shows.
  const [restoreAfterSignIn] = useState(() => Boolean(userId) && peekReturnToPaywallRestore());
  const restoreAfterSignInStartedRef = useRef(false);

  const rootStyle = useMemo(
    () => [styles.root, { backgroundColor: noctalia.screen.background }],
    [noctalia.screen.background]
  );

  const paywallTrigger = getPaywallTrigger(params.trigger);
  const isDreamAnalysisOffer = paywallTrigger === 'analysis_cta' && Boolean(params.dreamId)
    && params.dreamOwnerId === userId;
  // From the start of a prepared analysis: the analysis is already written, not to be made.
  const isPreparedOffer = isDreamAnalysisOffer && params.prepared === '1';
  const paywallVariant = useMemo(() => getPaywallVariant(paywallTrigger), [paywallTrigger]);
  const { dreams } = useDreamsData();
  // The saved-dream offer shows the person's own first words: the dream is what they pay to read.
  const offeredDreamText = useMemo(() => {
    if (!isDreamAnalysisOffer) return '';
    const dream = resolveDreamRoute(dreams, {
      id: params.dreamId,
      remoteId: params.dreamRemoteId,
      clientRequestId: params.dreamClientRequestId,
    });
    return (dream?.transcript || dream?.title || '').trim();
  }, [dreams, isDreamAnalysisOffer, params.dreamId, params.dreamRemoteId, params.dreamClientRequestId]);
  const resetDate = useMemo(() => formatQuotaResetDate(locale), [locale]);

  // Keeps rating requests away from the paywall and the minutes after it.
  useEffect(() => {
    markStoreReviewPaywallSeen();
    return () => markStoreReviewPaywallSeen();
  }, []);

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
    Boolean(effectiveSelectedId) && !busy && !awaitingServerAccess && !loading && !isActive && !requiresAuth;

  const handleClose = useCallback(() => {
    if (operationInFlightRef.current || processing) return;
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
    if (savedDreamReturnRoute) {
      navigateToDream(savedDreamReturnRoute);
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/settings');
    }
  }, [analyticsTier, isActive, navigateToDream, paywallTrigger, processing, savedDreamReturnRoute, selectedId]);

  // A direct capture -> offer transition has no detail screen underneath it.
  // Native gestures, Android Back and explicit dismissal share the same destination.
  usePreventRemove((Boolean(savedDreamReturnRoute) || busy) && exitDestination === null, handleClose);
  useFocusEffect(useCallback(() => {
    if ((!savedDreamReturnRoute && !busy) || exitDestination !== null) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      handleClose();
      return true;
    });
    return () => subscription.remove();
  }, [busy, exitDestination, handleClose, savedDreamReturnRoute]));

  // Release the navigation guard before performing the chosen exit.
  useEffect(() => {
    if (!exitDestination || exitDispatchedRef.current) return;
    exitDispatchedRef.current = true;
    if (savedDreamReturnRoute) router.replace(exitDestination);
    else router.dismissTo(exitDestination);
  }, [exitDestination, savedDreamReturnRoute]);

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

  const openAuth = useCallback((options?: { restore: true }) => {
    // Remember the paywall context so a successful sign-in comes straight back
    // here instead of leaving the user on the Settings tab.
    requestReturnToPaywallIntent(paywallTrigger, { persist: true, ...options });
    router.replace('/settings?section=account');
  }, [paywallTrigger]);
  const handleOpenAuth = useCallback(() => openAuth(), [openAuth]);
  // Plus belongs to an account: a guest signs in first, then the restore runs here.
  const handleRestoreAfterSignIn = useCallback(() => openAuth({ restore: true }), [openAuth]);

  const handleOpenLegalLink = useCallback((kind: LegalLinkKind) => {
    void Linking.openURL(getLegalLink(kind, currentLang)).catch(() => {
      // No browser available: nothing actionable to surface here.
    });
  }, [currentLang]);

  const confirmAccessAndResume = useCallback(async (result: Awaited<ReturnType<typeof purchase>> | null) => {
    if (!currentSession()) return 'pending';
    let confirmed = result;
    if (!confirmed?.serverConfirmed || (!confirmed.isActive && confirmed.storeActive)) {
      try {
        // Retry the entitlement check without another store operation.
        confirmed = await refreshSubscription();
      } catch {
        if (currentSession()) clearError();
        return 'pending';
      }
    }
    if (!currentSession() || !confirmed.serverConfirmed) return 'pending';
    if (!confirmed.isActive) return confirmed.storeActive ? 'pending' : 'free';
    if (confirmed.tier !== 'plus') return 'pending';
    const returnRoute = requestAnalysisReturnRoute(params, userId);
    if (returnRoute) navigateToDream(returnRoute);
    return 'plus';
  }, [clearError, currentSession, navigateToDream, params, refreshSubscription, userId]);

  const showActivationOutcome = useCallback((outcome: 'plus' | 'free' | 'pending') => {
    if (!currentSession()) return;
    if (outcome === 'plus') {
      setToast({
        message: t(purchaseOutcomeRef.current === 'restored' ? 'subscription.paywall.toast.restored' : 'subscription.paywall.toast.success'),
        mode: 'success',
      });
    } else if (outcome === 'free') {
      setToast({ message: t('subscription.paywall.toast.nothing_to_restore'), mode: 'info' });
    }
  }, [currentSession, t]);

  const handleRetryActivation = useCallback(async () => {
    if (!currentSession() || operationInFlightRef.current || processing) return;
    setOperationPending(true);
    await whileHeld(operationInFlightRef, async () => {
      showActivationOutcome(await confirmAccessAndResume(null));
    }, {
      finally: () => { if (currentSession()) setOperationPending(false); },
    });
  }, [confirmAccessAndResume, currentSession, processing, showActivationOutcome]);

  const handlePurchase = useCallback(async () => {
    if (!currentSession() || !effectiveSelectedId || !canPurchase || !selectedPlan || operationInFlightRef.current) return;
    setOperationPending(true);
    void trackProductEvent('purchase_started', {
      trigger: paywallTrigger,
      plan: selectedPlan,
      tier: analyticsTier,
    });
    await whileHeld(operationInFlightRef, async () => {
      const nextStatus = await purchase(effectiveSelectedId);
      if (!currentSession()) return;
      purchaseOutcomeRef.current = 'completed';
      clearReturnToPaywallIntent();
      void trackProductEvent('purchase_completed', {
        trigger: paywallTrigger,
        plan: selectedPlan,
        tier: nextStatus.storeActive ? 'plus' : nextStatus.tier,
      });
      showActivationOutcome(await confirmAccessAndResume(nextStatus));
    }, {
      catch: (purchaseError) => {
        if (currentSession()) void trackProductEvent('purchase_failed', {
          trigger: paywallTrigger,
          plan: selectedPlan,
          reason: classifyPurchaseFailure(purchaseError),
        });
      },
      finally: () => { if (currentSession()) setOperationPending(false); },
    });
  }, [analyticsTier, canPurchase, confirmAccessAndResume, currentSession, effectiveSelectedId, paywallTrigger, purchase, selectedPlan, showActivationOutcome]);

  const handleRestore = useCallback(async () => {
    if (!currentSession() || processing || requiresAuth || awaitingServerAccess || operationInFlightRef.current) return;
    setOperationPending(true);
    await whileHeld(operationInFlightRef, async () => {
      const nextStatus = await restore();
      if (!currentSession()) return;
      purchaseOutcomeRef.current = 'restored';
      const outcome = await confirmAccessAndResume(nextStatus);
      if (!currentSession()) return;
      if (outcome !== 'free') clearReturnToPaywallIntent();
      if (outcome !== 'pending') void trackProductEvent('restore_completed', {
        trigger: paywallTrigger,
        outcome: outcome === 'plus' ? 'restored' : 'nothing_to_restore',
      });
      showActivationOutcome(outcome);
    }, {
      catch: (restoreError) => {
        if (currentSession()) void trackProductEvent('restore_completed', {
          trigger: paywallTrigger,
          outcome: classifyPurchaseFailure(restoreError) === 'cancelled' ? 'cancelled' : 'failed',
        });
      },
      finally: () => { if (currentSession()) setOperationPending(false); },
    });
  }, [awaitingServerAccess, confirmAccessAndResume, currentSession, paywallTrigger, processing, requiresAuth, restore, showActivationOutcome]);

  useEffect(() => {
    if (!restoreAfterSignIn || restoreAfterSignInStartedRef.current || requiresAuth || loading || processing) return;
    restoreAfterSignInStartedRef.current = true;
    clearReturnToPaywallRestore();
    void handleRestore();
  }, [handleRestore, loading, processing, requiresAuth, restoreAfterSignIn]);

  const handleHideToast = useCallback(() => {
    setToast(null);
  }, []);

  const handleCloseErrorSheet = useCallback(() => {
    clearError();
  }, [clearError]);

  // The error lives in the shared subscription provider. One left by a failed
  // refresh elsewhere (the quota card in Settings) must not open this screen
  // on an error sheet about a purchase nobody attempted.
  useEffect(() => {
    clearError();
  }, [clearError]);

  const translateWithFallback = useCallback((key: string, fallback?: string) => {
    void translationRevision;
    const translated = t(key);
    if (translated === key) {
      return fallback ?? key;
    }
    return translated;
  }, [t, translationRevision]);

  const activeTierKey = 'plus';
  const headerTitle = awaitingServerAccess
    ? t('subscription.paywall.activation_pending.title')
    : isActive
    ? t(`subscription.paywall.header.${activeTierKey}` as const)
    : isPreparedOffer ? t('subscription.paywall.prepared.title')
    : isDreamAnalysisOffer ? t('recording.saved_analysis.title')
      : translateWithFallback(paywallVariant.headerTitleKey);
  const headerSubtitle = isActive && !awaitingServerAccess
    ? t(`subscription.paywall.header.subtitle.${activeTierKey}` as const)
    : isDreamAnalysisOffer ? t('subscription.paywall.saved_dream.message')
      // A guest's two analyses never come back: only an account brings more.
      : !user && paywallVariant.trigger === 'analysis_limit'
        ? t('subscription.paywall.variant.analysis_limit.subtitle_guest', QUOTA_COPY)
        : t(paywallVariant.headerSubtitleKey, { ...QUOTA_COPY, date: resetDate });

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
      return `${dateStr} · ${timeStr}`;
    } catch {
      return null;
    }
  }, [formatDate, formatTime, subscriptionStatus?.expiryDate]);

  const subscriptionFeatures = useMemo(
    () => {
      void translationRevision;
      if (isDreamAnalysisOffer) {
        return [t('subscription.paywall.saved_dream.analysis'), t('subscription.paywall.saved_dream.illustration')];
      }
      return PLUS_PAYWALL_FEATURE_KEYS.map((key) => t(key));
    },
    [isDreamAnalysisOffer, t, translationRevision]
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
          const billedInterval = translateWithFallback(`subscription.paywall.option.interval.${optionKey}`);
          const monthlyEquivalent = isAnnual
            ? formatNumber(calculateMonthlyEquivalent(pkg), {
                style: 'currency',
                currency: pkg.currency,
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })
            : '';
          // App Store rule: the amount billed is the largest price on a card. Android and the web
          // have no such rule and keep the annual monthly equivalent large (owner decision 2026-10-19).
          const leadsWithEquivalent = isAnnual && Platform.OS !== 'ios';
          return {
            id: pkg.id,
            title: translateWithFallback(
              `subscription.paywall.option.title.${optionKey}`,
              pkg.title
            ),
            price: leadsWithEquivalent ? monthlyEquivalent : pkg.priceFormatted,
            intervalLabel: leadsWithEquivalent
              ? translateWithFallback('subscription.paywall.option.interval.monthly')
              : billedInterval,
            billingDetail: pkg.freeTrialDays
              ? t('subscription.paywall.option.billing.trial', {
                  days: pkg.freeTrialDays,
                  price: pkg.priceFormatted,
                  interval: billedInterval,
                })
              : leadsWithEquivalent
                ? t('subscription.paywall.option.billing.annual', { price: pkg.priceFormatted })
                : isAnnual
                  ? t('subscription.paywall.option.billing.annual_equivalent', { price: monthlyEquivalent })
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
      // Recording is unlimited on both sides, so it is said once under the table
      // instead of taking a row: each row here is a real difference.
      return [
        {
          key: 'analysis',
          icon: 'brain' as const,
          label: t('subscription.paywall.comparison.analysis'),
          free: t('subscription.paywall.comparison.free_analyses', { count: QUOTA_COPY.analyses }),
          plus: t('subscription.paywall.comparison.unlimited'),
          showPlusInfinity: true,
        },
        {
          // Each free analysis brings its illustration; Plus illustrates every dream.
          key: 'illustrations',
          icon: 'paintpalette' as const,
          label: t('subscription.paywall.comparison.illustrations'),
          free: t('subscription.paywall.comparison.free_analyses', { count: QUOTA_COPY.analyses }),
          plus: t('subscription.paywall.comparison.all_dreams'),
          showPlusInfinity: false,
        },
        {
          key: 'exploration',
          icon: 'bubble.left.and.bubble.right' as const,
          label: t('subscription.paywall.comparison.exchanges'),
          free: formatNumber(QUOTA_COPY.freeExchanges),
          // Plus sells exchanges as unlimited; the note under the table names the abuse safeguards.
          plus: t('subscription.paywall.comparison.unlimited_exchanges'),
          showPlusInfinity: true,
        },
        {
          key: 'synthesis',
          icon: 'sparkles' as const,
          label: t('subscription.paywall.comparison.synthesis_360'),
          free: t('subscription.paywall.comparison.none'),
          plus: t('subscription.paywall.comparison.included'),
          showPlusInfinity: false,
        },
      ];
    },
    [formatNumber, t, translationRevision]
  );


  return (
    <View style={rootStyle} testID={TID.Screen.Paywall}>
      {/* Close stays in reach over the painting, whatever the scroll. It comes first so
          keyboard and screen-reader focus meets it first; zIndex keeps it above the scroll. */}
      <View pointerEvents="box-none" style={[styles.closeOverlay, { top: ThemeLayout.spacing.sm + insets.top }]}>
        <ScreenContainer maxWidth={PAYWALL_MAX_WIDTH} pointerEvents="box-none">
          <Pressable
            onPress={handleClose}
            disabled={busy}
            // Its edge keeps it apart from the cards it floats over once the page scrolls.
            style={({ pressed }) => [styles.closeButton, styles.closeButtonFloating, { backgroundColor: noctalia.surface.raised, borderColor: noctalia.surface.border }, pressed && styles.closeButtonPressed]}
            accessibilityRole="button"
            testID={TID.Button.PaywallClose}
          >
            <Text style={[styles.closeLabel, { color: noctalia.accent.text }]}>
              {t('subscription.paywall.button.close')}
            </Text>
          </Pressable>
        </ScreenContainer>
      </View>
      <HeaderScrollView onScroll={onHeaderScroll} scrollEventThrottle={16}
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
        {/* A short window: the offer, not the sky, should hold the screen. If the painting
            fails to load, the slot still keeps the copy clear of the floating Close. */}
        <View style={styles.artworkSlot}>
          <DreamerArtworkWindow scene="observatory" maxHeight={PAYWALL_PAINTING_HEIGHT} style={{ marginHorizontal: -ThemeLayout.spacing.md }} bleedTop={ThemeLayout.spacing.sm + insets.top} />
        </View>
        <ScreenContainer maxWidth={PAYWALL_MAX_WIDTH}>
          {/* The paywall is a rare screen and a pitch: the offer arrives a beat before the
              price, and the price a beat before the button. This is the one surface where
              a staggered entrance is the point rather than decoration. */}
          <Reveal index={0}>
            {!isActive ? (
              <View style={styles.kickerRow}>
                <IconSymbol name="sparkles" size={13} color={noctalia.accent.text} />
                <Text style={[styles.kickerText, { color: noctalia.accent.text }]}>
                  {isDreamAnalysisOffer ? 'Noctalia Plus' : translateWithFallback(paywallVariant.chipKey)}
                </Text>
                <IconSymbol name="sparkles" size={13} color={noctalia.accent.text} />
              </View>
            ) : null}

            <Text style={[styles.headerTitle, { color: noctalia.text.primary }]}>{headerTitle}</Text>
            <Text style={[styles.headerSubtitle, { color: noctalia.text.secondary }]}>{headerSubtitle}</Text>

            {offeredDreamText && !isActive ? (
              <View
                style={[styles.dreamExcerpt, { backgroundColor: noctalia.surface.base, borderColor: noctalia.surface.borderStrong }]}
                testID={TID.Text.PaywallDreamExcerpt}
              >
                <Text style={[styles.dreamExcerptLabel, { color: noctalia.accent.text }]}>
                  {t(isPreparedOffer ? 'subscription.paywall.prepared.label' : 'subscription.paywall.saved_dream.waiting')}
                </Text>
                <Text numberOfLines={3} style={[styles.dreamExcerptText, { color: noctalia.text.primary }]}>
                  {offeredDreamText}
                </Text>
              </View>
            ) : null}

            {!isDreamAnalysisOffer ? <SubscriptionExpiryNotice status={subscriptionStatus} loading={loading} /> : null}

            {isActive && !awaitingServerAccess && formattedExpiryDate ? (
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
          {!isActive && !isDreamAnalysisOffer ? (
            <>
            <View
              testID="component.paywall.comparison"
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
                    <IconSymbol name={row.icon} size={17} color={noctalia.accent.text} />
                    <Text style={[styles.comparisonFeatureText, { color: noctalia.text.primary }]}>
                      {row.label}
                    </Text>
                  </View>
                  <View style={styles.comparisonFreeCell}>
                    <Text style={[styles.comparisonFreeText, { color: noctalia.text.secondary }]}>
                      {row.free}
                    </Text>
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
            <Text style={[styles.comparisonNote, { color: noctalia.text.secondary }]}>
              {t('subscription.paywall.comparison.recording_note')}{' '}
              {t('subscription.paywall.comparison.fair_use_note')}
            </Text>
            </>
          ) : (
            <View style={styles.benefitList}>
              {visibleSubscriptionFeatures.map((feature, index) => (
                <View key={feature} style={styles.benefitRow}>
                  <View style={[styles.benefitIcon, { backgroundColor: noctalia.surface.active }]}>
                    {!isDreamAnalysisOffer && index < 2 ? (
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
                      !isDreamAnalysisOffer && index < 2 && styles.benefitTextUnlimited,
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
                    processing || loading || awaitingServerAccess
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

          {!loading && !isActive && sortedPackages.length === 0 && (storeUnavailable || !requiresAuth) ? (
            <Text style={[styles.emptyText, { color: noctalia.text.secondary }]}>
              {t(storeUnavailable ? 'subscription.error.item_unavailable' : 'subscription.paywall.empty')}
            </Text>
          ) : null}

          <Reveal index={3} style={styles.actions}>
            {awaitingServerAccess ? (
              <Text style={[styles.notice, { color: noctalia.text.secondary }]} accessibilityRole="alert">
                {t('subscription.paywall.activation_pending')}
              </Text>
            ) : null}
            {(!isActive && !storeUnavailable) || awaitingServerAccess ? (
              <PressableScale
                style={[
                  styles.primaryButton,
                  {
                    backgroundColor: awaitingServerAccess || requiresAuth
                      ? noctalia.action.primary
                      : canPurchase
                        ? noctalia.action.primary
                        : noctalia.action.disabled,
                    borderColor: awaitingServerAccess || requiresAuth || canPurchase
                      ? noctalia.action.primaryBorder
                      : noctalia.action.disabledBorder,
                  },
                ]}
                transitionProperties={CTA_TRANSITION}
                disabled={awaitingServerAccess ? busy : requiresAuth ? busy || loading : !canPurchase}
                onPress={awaitingServerAccess ? handleRetryActivation : requiresAuth ? handleOpenAuth : handlePurchase}
                // The button spans the screen and already clears 44pt; extra slop would
                // only reach into the footnote above it.
                hitSlop={0}
                accessibilityRole="button"
                testID={TID.Button.PaywallPurchase}
              >
                {busy ? (
                  <ActivityIndicator color={noctalia.action.primaryText} />
                ) : (
                  <Text
                    style={[
                      styles.primaryLabel,
                      {
                        color:
                          awaitingServerAccess || requiresAuth || canPurchase
                            ? noctalia.action.primaryText
                            : noctalia.action.disabledText,
                      },
                    ]}
                  >
                    {awaitingServerAccess ? t('subscription.paywall.retry_activation')
                      : requiresAuth
                      ? t('subscription.paywall.button.primary.auth')
                      : selectedTrialDays
                        ? t('subscription.paywall.button.primary.trial', { days: selectedTrialDays })
                        : isPreparedOffer ? t('subscription.paywall.prepared.cta')
                        : isDreamAnalysisOffer ? t('subscription.paywall.saved_dream.cta')
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
                  interval: translateWithFallback(
                    `subscription.paywall.option.interval.${selectedPackage.interval === 'monthly' ? 'monthly' : 'annual'}`
                  ),
                })}
              </Text>
            ) : null}

            {/* A guest is asked to sign in before paying: say why, right under the button. */}
            {!isActive && requiresAuth ? (
              <Text
                style={[styles.authReason, { color: noctalia.text.secondary }]}
                testID={TID.Text.PaywallAuthReason}
              >
                {t('subscription.paywall.notice.auth')}
              </Text>
            ) : null}

            {!isActive ? (
              <Pressable
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.secondaryButtonPressed]}
                onPress={handleClose}
                disabled={busy}
                accessibilityRole="button"
              >
                <Text style={[styles.secondaryLabel, { color: noctalia.text.secondary }]}>
                  {t(isDreamAnalysisOffer ? 'recording.analysis_offer.view' : 'subscription.paywall.button.continue_free')}
                </Text>
              </Pressable>
            ) : null}
            {!isActive && isDreamAnalysisOffer && user ? (
              <Text style={[styles.notice, { color: noctalia.text.secondary }]}>
                {t('subscription.paywall.saved_dream.reset', { date: resetDate })}
              </Text>
            ) : null}

          </Reveal>

          <Reveal index={4}>
          {/* Renewal terms are part of the offer, so everyone reads them, guests included. A
              subscriber who turned renewal off reads that state above instead. */}
          {!isActive || subscriptionStatus?.willRenew === true ? (
            <Text style={[styles.notice, { color: noctalia.text.secondary }]} testID={TID.Text.PaywallStoreNotice}>
              {t(STORE_NOTICE_KEY)}
            </Text>
          ) : null}
          {/* A utility, not an offer: it sits with the fine print, still a full 44pt target.
              Everyone sees it (App Review 3.1.1); a guest signs in on the way. */}
          {/* Nothing to restore from where no store is reachable (the keyless web build). */}
          {storeUnavailable ? null : (
          <Pressable
            style={({ pressed }) => [styles.restoreButton, pressed && styles.legalLinkPressed]}
            onPress={requiresAuth ? handleRestoreAfterSignIn : handleRestore}
            disabled={busy || awaitingServerAccess}
            accessibilityRole="button"
            testID={TID.Button.PaywallRestore}
          >
            <Text style={[styles.legalLink, { color: noctalia.text.secondary }]}>
              {t('subscription.paywall.button.restore')}
            </Text>
          </Pressable>
          )}

          {/* Reviewers and readers tap these on a phone: each keeps a full 44pt target. */}
          <View style={styles.legalLinks}>
            <Pressable
              accessibilityRole="link"
              onPress={() => handleOpenLegalLink('termsOfUse')}
              style={({ pressed }) => [styles.legalLinkTarget, pressed && styles.legalLinkPressed]}
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
              style={({ pressed }) => [styles.legalLinkTarget, pressed && styles.legalLinkPressed]}
              testID={TID.Button.PaywallPrivacyPolicy}
            >
              <Text style={[styles.legalLink, { color: noctalia.text.secondary }]}>
                {t('settings.legal.privacyPolicy')}
              </Text>
            </Pressable>
          </View>
          </Reveal>
        </ScreenContainer>
      </HeaderScrollView>

      {toast ? (
        <Toast
          message={toast.message}
          mode={toast.mode}
          onHide={handleHideToast}
          testID={toast.mode === 'success' ? TID.Toast.PaywallSuccess : TID.Toast.PaywallInfo}
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
  closeOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 1,
    paddingHorizontal: ThemeLayout.spacing.md,
  },
  artworkSlot: {
    // The floating Close's row, when the painting is missing.
    minHeight: 44 + ThemeLayout.spacing.sm,
  },
  headerTitle: {
    fontSize: TypeScale.h1.fontSize,
    lineHeight: TypeScale.h1.lineHeight,
    letterSpacing: -0.2,
    fontFamily: Fonts.fraunces.semiBold,
    textAlign: 'center',
  },
  headerSubtitle: {
    // A short measure keeps the subtitle a centred block, not a ragged paragraph.
    maxWidth: 340,
    alignSelf: 'center',
    fontSize: TypeScale.body.fontSize,
    lineHeight: TypeScale.body.lineHeight,
    fontFamily: Fonts.outfit.regular,
    marginTop: ThemeLayout.spacing.sm,
    textAlign: 'center',
  },
  dreamExcerpt: {
    marginTop: ThemeLayout.spacing.md,
    paddingHorizontal: ThemeLayout.spacing.md,
    paddingVertical: 14,
    borderWidth: 1,
    borderRadius: ThemeLayout.borderRadius.lg,
    gap: 6,
  },
  dreamExcerptLabel: {
    fontSize: TypeScale.overline.fontSize,
    lineHeight: TypeScale.overline.lineHeight,
    letterSpacing: TypeScale.overline.letterSpacing,
    textTransform: 'uppercase',
    fontFamily: Fonts.outfit.bold,
  },
  dreamExcerptText: {
    // The dream in the journal's own voice: Lora, as the person wrote it.
    fontSize: TypeScale.body.fontSize,
    lineHeight: TypeScale.body.lineHeight,
    fontFamily: Fonts.lora.regularItalic,
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
    fontSize: TypeScale.overline.fontSize,
    lineHeight: TypeScale.overline.lineHeight,
    letterSpacing: TypeScale.overline.letterSpacing,
    textTransform: 'uppercase',
    fontFamily: Fonts.outfit.bold,
  },
  expiryDate: {
    fontSize: TypeScale.bodySm.fontSize,
    fontFamily: Fonts.outfit.medium,
    marginBottom: 8,
  },
  closeButton: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 8,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonFloating: {
    alignSelf: 'flex-end',
    paddingHorizontal: 14,
    borderWidth: 1,
  },
  closeButtonPressed: {
    opacity: 0.7,
  },
  closeLabel: {
    fontSize: TypeScale.bodySm.fontSize,
    fontFamily: Fonts.outfit.regular,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  loadingLabel: {
    fontSize: TypeScale.bodySm.fontSize,
    fontFamily: Fonts.outfit.regular,
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
    minHeight: 40,
    flexDirection: 'row',
  },
  comparisonRow: {
    minHeight: 54,
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  comparisonFeatureCell: {
    flex: 1.3,
    minWidth: 0,
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  comparisonFreeCell: {
    flex: 0.9,
    minWidth: 0,
    paddingHorizontal: 4,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  comparisonPlusCell: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 4,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  comparisonHeaderText: {
    fontSize: TypeScale.overline.fontSize,
    lineHeight: TypeScale.overline.lineHeight,
    letterSpacing: TypeScale.overline.letterSpacing,
    textTransform: 'uppercase',
    fontFamily: Fonts.outfit.bold,
    textAlign: 'center',
  },
  comparisonPlusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  comparisonPlusHeaderText: {
    fontSize: TypeScale.overline.fontSize,
    lineHeight: TypeScale.overline.lineHeight,
    letterSpacing: TypeScale.overline.letterSpacing,
    textTransform: 'uppercase',
    fontFamily: Fonts.outfit.bold,
  },
  comparisonFeatureText: {
    flex: 1,
    minWidth: 0,
    fontSize: TypeScale.bodySm.fontSize,
    lineHeight: 18,
    fontFamily: Fonts.outfit.medium,
  },
  comparisonFreeText: {
    fontSize: TypeScale.bodySm.fontSize,
    lineHeight: 18,
    fontFamily: Fonts.outfit.regular,
    textAlign: 'center',
  },
  comparisonPlusValue: {
    flexDirection: 'row',
    // German 'Unbegrenzt' does not fit beside the ∞ on a 320 pt phone: the word wraps under it.
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 4,
  },
  comparisonInfinity: {
    fontSize: TypeScale.h3.fontSize,
    lineHeight: 18,
    fontFamily: Fonts.outfit.bold,
  },
  comparisonPlusText: {
    flexShrink: 1,
    fontSize: TypeScale.bodySm.fontSize,
    lineHeight: 18,
    fontFamily: Fonts.outfit.bold,
    textAlign: 'center',
  },
  comparisonNote: {
    marginTop: -ThemeLayout.spacing.xs,
    marginBottom: ThemeLayout.spacing.md,
    fontSize: TypeScale.caption.fontSize,
    lineHeight: TypeScale.caption.lineHeight,
    fontFamily: Fonts.outfit.regular,
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
    // Centred as one block under the centred title, with room on both sides.
    alignSelf: 'center',
    marginTop: ThemeLayout.spacing.lg20,
    marginBottom: ThemeLayout.spacing.lg,
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
    flexShrink: 1,
    fontSize: TypeScale.body.fontSize,
    lineHeight: TypeScale.body.lineHeight,
    fontFamily: Fonts.outfit.regular,
  },
  benefitTextUnlimited: {
    fontFamily: Fonts.outfit.bold,
  },
  benefitInfinity: {
    fontSize: TypeScale.h3.fontSize,
    lineHeight: TypeScale.h3.lineHeight,
    fontFamily: Fonts.outfit.bold,
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
    fontSize: TypeScale.caption.fontSize,
    lineHeight: 16,
  },
  authReason: {
    textAlign: 'center',
    fontSize: TypeScale.bodySm.fontSize,
    lineHeight: TypeScale.bodySm.lineHeight,
    fontFamily: Fonts.outfit.regular,
  },
  primaryLabel: {
    fontSize: TypeScale.body.fontSize,
    fontFamily: Fonts.outfit.bold,
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
    fontSize: TypeScale.bodySm.fontSize,
    fontFamily: Fonts.outfit.medium,
  },
  notice: {
    marginTop: 8,
    fontSize: TypeScale.caption.fontSize,
    lineHeight: 16,
    fontFamily: Fonts.outfit.regular,
    textAlign: 'center',
  },
  restoreButton: {
    minHeight: 44,
    alignSelf: 'center',
    justifyContent: 'center',
    paddingHorizontal: ThemeLayout.spacing.sm,
  },
  legalLinks: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    marginTop: 4,
  },
  legalLink: {
    fontFamily: Fonts.outfit.medium,
    fontSize: TypeScale.caption.fontSize,
    textDecorationLine: 'underline',
  },
  legalLinkTarget: {
    minHeight: 44,
    justifyContent: 'center',
  },
  legalLinkPressed: {
    opacity: 0.75,
  },
  legalSeparator: {
    fontFamily: Fonts.outfit.regular,
    fontSize: TypeScale.caption.fontSize,
  },
  emptyText: {
    marginTop: ThemeLayout.spacing.md,
    fontSize: TypeScale.bodySm.fontSize,
    fontFamily: Fonts.outfit.regular,
    textAlign: 'center',
  },
});

const PaywallWithHeader = withHeaderScroll(PaywallScreen);

export default function SessionPaywall() {
  const { user, sessionGeneration } = useAuth();
  return <PaywallWithHeader key={`${sessionGeneration}:${user?.id ?? ''}`} />;
}
