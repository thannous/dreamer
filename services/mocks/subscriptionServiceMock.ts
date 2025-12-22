import type { User } from '@supabase/supabase-js';

import { getCurrentUser } from '@/lib/auth';
import type { PurchasePackage, SubscriptionStatus, SubscriptionTier } from '@/lib/types';

let initialized = false;
let currentStatus: SubscriptionStatus | null = null;
let currentStatusUserId: string | null = null;
const DEFAULT_PLUS_PRODUCT_ID = 'mock_plus';

const mockPackages: PurchasePackage[] = [
  {
    id: 'mock_monthly',
    interval: 'monthly',
    price: 4.99,
    priceFormatted: '$4.99',
    currency: 'USD',
    title: 'Monthly',
    description: 'Unlock premium dream analysis every month.',
  },
  {
    id: 'mock_annual',
    interval: 'annual',
    price: 39.99,
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
  const tier = (user?.app_metadata?.tier ?? user?.user_metadata?.tier) as SubscriptionTier | undefined;
  if (tier === 'premium' || tier === 'plus' || tier === 'guest') {
    return tier;
  }
  if ((user?.user_metadata as any)?.profile === 'premium') {
    return 'plus';
  }
  return 'free';
}

function buildStatusFromTier(tier: SubscriptionTier): SubscriptionStatus {
  const isActive = tier === 'plus' || tier === 'premium';
  return {
    tier,
    isActive,
    expiryDate: null,
    productId: isActive ? currentStatus?.productId ?? DEFAULT_PLUS_PRODUCT_ID : null,
  };
}

async function syncStatusWithCurrentUser(): Promise<SubscriptionStatus> {
  const user = await getCurrentUser();
  const userId = user?.id ?? null;

  if (currentStatusUserId !== userId) {
    currentStatus = null;
    currentStatusUserId = userId;
  }

  // If the user has purchased (currentStatus is paid), preserve that state for this user
  if (currentStatus?.tier === 'plus' || currentStatus?.tier === 'premium') {
    return currentStatus;
  }

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

function setTier(tier: SubscriptionTier, productId: string | null, userId: string | null): SubscriptionStatus {
  const status: SubscriptionStatus = {
    tier,
    isActive: tier === 'plus' || tier === 'premium',
    expiryDate: null,
    productId,
  };
  currentStatus = status;
  currentStatusUserId = userId;
  return status;
}

export async function purchasePackage(id: string): Promise<SubscriptionStatus> {
  if (!initialized) {
    throw new Error('Purchases not initialized');
  }
  const pkg = mockPackages.find((item) => item.id === id) ?? mockPackages[0];
  const user = await getCurrentUser();
  const userId = user?.id ?? null;
  return setTier('plus', pkg.id, userId);
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
