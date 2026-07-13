import type { User } from '@supabase/supabase-js';

import { getCurrentUser } from '@/lib/auth';
import { normalizeSubscriptionTier } from '@/lib/quotaTier';
import type { PurchasePackage, SubscriptionStatus, SubscriptionTier } from '@/lib/types';

type SubscriptionStatusListener = (status: SubscriptionStatus) => void;
export type MockSubscriptionScenario = 'free' | 'monthly' | 'annual' | 'cancelled' | 'expired';

let initialized = false;
let currentStatus: SubscriptionStatus | null = null;
let currentStatusUserId: string | null = null;
const DEFAULT_PLUS_PRODUCT_ID = 'mock_plus';
const listeners = new Set<SubscriptionStatusListener>();

const mockPackages: PurchasePackage[] = [
  {
    id: 'mock_monthly',
    interval: 'monthly',
    price: 4.99,
    priceFormatted: '$4.99',
    currency: 'USD',
    title: 'Monthly',
    description: 'Unlock Noctalia Plus dream analysis every month.',
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
  const tier = normalizeSubscriptionTier(user?.app_metadata?.tier ?? user?.user_metadata?.tier, 'free');
  if (tier === 'plus' || tier === 'guest') return tier;
  return 'free';
}

function buildStatusFromTier(tier: SubscriptionTier): SubscriptionStatus {
  const isActive = tier === 'plus';
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
  if (currentStatus?.tier === 'plus') {
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

export function getStoreMode(): string {
  return 'Mock services';
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
    isActive: tier === 'plus',
    expiryDate: null,
    productId,
  };
  currentStatus = status;
  currentStatusUserId = userId;
  emitStatus(status);
  return status;
}

function emitStatus(status: SubscriptionStatus): void {
  listeners.forEach((listener) => {
    try {
      listener(status);
    } catch {
      // Keep one QA listener from breaking the mock service.
    }
  });
}

function buildMockScenarioStatus(scenario: MockSubscriptionScenario): SubscriptionStatus {
  const now = Date.now();
  if (scenario === 'monthly') {
    return {
      tier: 'plus',
      isActive: true,
      expiryDate: new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString(),
      productId: 'mock_monthly',
      willRenew: true,
    };
  }
  if (scenario === 'annual') {
    return {
      tier: 'plus',
      isActive: true,
      expiryDate: new Date(now + 365 * 24 * 60 * 60 * 1000).toISOString(),
      productId: 'mock_annual',
      willRenew: true,
    };
  }
  if (scenario === 'cancelled') {
    return {
      tier: 'plus',
      isActive: true,
      expiryDate: new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString(),
      productId: 'mock_monthly',
      willRenew: false,
    };
  }
  if (scenario === 'expired') {
    return {
      tier: 'free',
      isActive: false,
      expiryDate: new Date(now - 24 * 60 * 60 * 1000).toISOString(),
      productId: 'mock_monthly',
      willRenew: false,
    };
  }
  return getDefaultStatus();
}

export async function applyMockScenario(scenario: MockSubscriptionScenario): Promise<SubscriptionStatus> {
  const user = await getCurrentUser();
  initialized = true;
  const status = buildMockScenarioStatus(scenario);
  currentStatus = status;
  currentStatusUserId = user?.id ?? null;
  emitStatus(status);
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

export async function syncPurchases(): Promise<void> {
  return;
}

export function addStatusUpdateListener(_listener: SubscriptionStatusListener): () => void {
  listeners.add(_listener);
  return () => {
    listeners.delete(_listener);
  };
}

export async function logOutUser(): Promise<void> {
  initialized = false;
  currentStatus = null;
  currentStatusUserId = null;
  listeners.clear();
}
