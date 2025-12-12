import Purchases from 'react-native-purchases';
import RevenueCatUI, {
  PAYWALL_RESULT,
  type PresentCustomerCenterParams,
} from 'react-native-purchases-ui';

import { REVENUECAT_ENTITLEMENT_ID, REVENUECAT_OFFERING_ID } from '@/constants/subscription';
import type { SubscriptionStatus } from '@/lib/types';
import {
  getSubscriptionStatus,
  initializeSubscription,
  isSubscriptionInitialized,
  refreshSubscriptionStatus,
} from './subscriptionService';
import { isMockModeEnabled } from '@/lib/env';

type PresentPaywallOptions = {
  offeringId?: string | null;
  requiredEntitlementId?: string | null;
  userId?: string | null;
};

type PaywallResponse = {
  result: PAYWALL_RESULT;
  status: SubscriptionStatus | null;
};

const isMockMode = isMockModeEnabled();

async function ensurePurchasesReady(userId?: string | null): Promise<void> {
  if (isMockMode) {
    return;
  }
  if (!isSubscriptionInitialized()) {
    await initializeSubscription(userId ?? null);
  }
}

async function resolveOffering(offeringId?: string | null) {
  const offerings = await Purchases.getOfferings();
  if (offeringId && offerings.all?.[offeringId]) {
    return offerings.all[offeringId];
  }
  return offerings.current ?? null;
}

async function getLatestStatus(): Promise<SubscriptionStatus | null> {
  if (isMockMode) {
    return getSubscriptionStatus();
  }
  if (typeof refreshSubscriptionStatus === 'function') {
    return refreshSubscriptionStatus();
  }
  return getSubscriptionStatus();
}

export async function presentRevenueCatPaywall(
  options: PresentPaywallOptions = {}
): Promise<PaywallResponse> {
  if (isMockMode) {
    return { result: PAYWALL_RESULT.NOT_PRESENTED, status: await getSubscriptionStatus() };
  }
  await ensurePurchasesReady(options.userId ?? null);
  const offering = await resolveOffering(options.offeringId ?? REVENUECAT_OFFERING_ID);
  if (!offering) {
    throw new Error('Aucune offre RevenueCat configurée pour ce client.');
  }

  const shouldGateByEntitlement = options.requiredEntitlementId !== null;
  const requiredEntitlementId = options.requiredEntitlementId ?? REVENUECAT_ENTITLEMENT_ID;

  const result = shouldGateByEntitlement
    ? await RevenueCatUI.presentPaywallIfNeeded({
        requiredEntitlementIdentifier: requiredEntitlementId,
        offering,
        displayCloseButton: true,
      })
    : await RevenueCatUI.presentPaywall({
        offering,
        displayCloseButton: true,
      });

  const status = await getLatestStatus();
  return { result, status };
}

type PresentCustomerCenterOptions = {
  userId?: string | null;
  params?: PresentCustomerCenterParams;
};

export async function presentRevenueCatCustomerCenter(
  options: PresentCustomerCenterOptions = {}
): Promise<SubscriptionStatus | null> {
  if (isMockMode) {
    return getSubscriptionStatus();
  }
  await ensurePurchasesReady(options.userId ?? null);
  await RevenueCatUI.presentCustomerCenter(options.params);
  return getLatestStatus();
}
