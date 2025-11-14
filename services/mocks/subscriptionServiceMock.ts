import type { PurchasePackage, SubscriptionStatus, SubscriptionTier } from '@/lib/types';

let initialized = false;
let currentStatus: SubscriptionStatus | null = null;

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

export async function initialize(): Promise<SubscriptionStatus> {
  initialized = true;
  if (!currentStatus) {
    currentStatus = getDefaultStatus();
  }
  return currentStatus;
}

export function isInitialized(): boolean {
  return initialized;
}

export async function getStatus(): Promise<SubscriptionStatus | null> {
  if (!initialized) {
    return null;
  }
  if (!currentStatus) {
    currentStatus = getDefaultStatus();
  }
  return currentStatus;
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
  if (!currentStatus) {
    currentStatus = getDefaultStatus();
  }
  return currentStatus;
}
