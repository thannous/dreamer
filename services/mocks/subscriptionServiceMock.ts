import type { User } from '@supabase/supabase-js';

import { getCurrentUser } from '@/lib/auth';
import type { PurchasePackage, SubscriptionStatus, SubscriptionTier } from '@/lib/types';

let initialized = false;
let currentStatus: SubscriptionStatus | null = null;
const DEFAULT_PREMIUM_PRODUCT_ID = 'mock_premium';

const mockPackages: PurchasePackage[] = [
  {
    id: 'mock_monthly',
    interval: 'monthly',
    priceFormatted: '$4.99',
    currency: 'USD',
    title: 'Monthly',
    description: 'Unlock premium dream analysis every month.',
  },
  {
    id: 'mock_annual',
    interval: 'annual',
    priceFormatted: '$39.99',
    currency: 'USD',
    title: 'Annual',
    description: 'Best value for dedicated dreamers.',
  },
];

function getDefaultStatus(): SubscriptionStatus {
  return {
    tier: 'free',
    isActive: false,
    expiryDate: null,
    productId: null,
  };
}

function mapTierFromUser(user: User | null): SubscriptionTier {
  const tier = user?.user_metadata?.tier as SubscriptionTier | undefined;
  if (tier === 'premium' || tier === 'guest') {
    return tier;
  }
  if ((user?.user_metadata as any)?.profile === 'premium') {
    return 'premium';
  }
  return 'free';
}

function buildStatusFromTier(tier: SubscriptionTier): SubscriptionStatus {
  return {
    tier,
    isActive: tier === 'premium',
    expiryDate: null,
    productId: tier === 'premium' ? currentStatus?.productId ?? DEFAULT_PREMIUM_PRODUCT_ID : null,
  };
}

async function syncStatusWithCurrentUser(): Promise<SubscriptionStatus> {
  const user = await getCurrentUser();
  const tier = mapTierFromUser(user);
  const nextStatus = buildStatusFromTier(tier);

  if (!currentStatus || currentStatus.tier !== tier) {
    currentStatus = nextStatus;
  } else {
    currentStatus = { ...currentStatus, ...nextStatus };
  }

  return currentStatus;
}

export async function initialize(_userId?: string | null): Promise<SubscriptionStatus> {
  initialized = true;
  if (!currentStatus) {
    currentStatus = getDefaultStatus();
  }
  return syncStatusWithCurrentUser();
}

export function isInitialized(): boolean {
  return initialized;
}

export async function getStatus(): Promise<SubscriptionStatus | null> {
  if (!initialized) {
    return null;
  }
  return syncStatusWithCurrentUser();
}

export async function loadOfferings(): Promise<PurchasePackage[]> {
  if (!initialized) {
    return [];
  }
  return mockPackages;
}

function setTier(tier: SubscriptionTier, productId: string | null): SubscriptionStatus {
  const status: SubscriptionStatus = {
    tier,
    isActive: tier === 'premium',
    expiryDate: null,
    productId,
  };
  currentStatus = status;
  return status;
}

export async function purchasePackage(id: string): Promise<SubscriptionStatus> {
  if (!initialized) {
    throw new Error('Purchases not initialized');
  }
  const pkg = mockPackages.find((item) => item.id === id) ?? mockPackages[0];
  return setTier('premium', pkg.id);
}

export async function restorePurchases(): Promise<SubscriptionStatus> {
  if (!initialized) {
    throw new Error('Purchases not initialized');
  }
  return syncStatusWithCurrentUser();
}

export async function refreshStatus(): Promise<SubscriptionStatus> {
  if (!initialized) {
    throw new Error('Purchases not initialized');
  }
  return syncStatusWithCurrentUser();
}
