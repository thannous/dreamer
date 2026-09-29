import type { User } from '@supabase/supabase-js';

import { getCurrentUser } from '@/lib/auth';
import { normalizeSubscriptionTier } from '@/lib/quotaTier';
import type { PurchasePackage, SubscriptionStatus, SubscriptionTier } from '@/lib/types';

type SubscriptionStatusListener = (status: SubscriptionStatus) => void;
export type MockSubscriptionScenario = 'free' | 'monthly' | 'annual' | 'cancelled' | 'expired' | 'restore_available';
export type MockPurchaseOutcome = 'success' | 'cancelled' | 'error';

let initialized = false;
let currentStatus: SubscriptionStatus | null = null;
let currentStatusUserId: string | null = null;
let hasExplicitStatus = false;
let nextPurchase: { userId: string; outcome: MockPurchaseOutcome } | null = null;
// A simulated store receipt is separate from locally loaded access and scoped to its owner.
const receipts = new Map<string, SubscriptionStatus>();
const DEFAULT_PLUS_PRODUCT_ID = 'mock_plus';
const listeners = new Set<SubscriptionStatusListener>();

// Development preview only. Production uses the localized price strings returned by each store.
const mockPackages: PurchasePackage[] = [
  {
    id: 'mock_monthly',
    interval: 'monthly',
    price: 3.59,
    priceFormatted: '3,59 €',
    currency: 'EUR',
    title: 'Monthly',
    description: 'Unlock Noctalia Plus dream analysis every month.',
  },
  {
    id: 'mock_annual',
    interval: 'annual',
    price: 22.99,
    priceFormatted: '22,99 €',
    currency: 'EUR',
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
    hasExplicitStatus = false;
    if (nextPurchase?.userId !== userId) nextPurchase = null;
  }

  // Refresh must preserve explicit expiry/free states as well as active purchases.
  if (currentStatus && hasExplicitStatus) {
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

function setStatus(status: SubscriptionStatus, userId: string | null): SubscriptionStatus {
  currentStatus = status;
  currentStatusUserId = userId;
  hasExplicitStatus = true;
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
  if (!user) throw new Error('auth_required');
  initialized = true;
  const status = buildMockScenarioStatus(scenario);
  if (scenario === 'free') receipts.delete(user.id);
  else receipts.set(user.id, scenario === 'restore_available' ? buildMockScenarioStatus('monthly') : status);
  return setStatus(status, user.id);
}

export async function setNextMockPurchaseOutcome(outcome: MockPurchaseOutcome): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error('auth_required');
  nextPurchase = { userId: user.id, outcome };
}

export async function purchasePackage(id: string): Promise<SubscriptionStatus> {
  if (!initialized) {
    throw new Error('Purchases not initialized');
  }
  const pkg = mockPackages.find((item) => item.id === id);
  if (!pkg) throw new Error('ITEM_UNAVAILABLE');
  const user = await getCurrentUser();
  if (!user) throw new Error('auth_required');
  const outcome = nextPurchase?.userId === user.id ? nextPurchase.outcome : 'success';
  nextPurchase = null;
  if (outcome === 'cancelled') {
    throw Object.assign(new Error('Purchase cancelled'), { userCancelled: true });
  }
  if (outcome === 'error') throw new Error('NETWORK_ERROR');
  const status = buildMockScenarioStatus(pkg.interval === 'annual' ? 'annual' : 'monthly');
  receipts.set(user.id, status);
  return setStatus(status, user.id);
}

export async function restorePurchases(): Promise<SubscriptionStatus> {
  if (!initialized) {
    throw new Error('Purchases not initialized');
  }
  const user = await getCurrentUser();
  if (!user) throw new Error('auth_required');
  const receipt = receipts.get(user.id);
  return receipt ? setStatus(receipt, user.id) : syncStatusWithCurrentUser();
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
  hasExplicitStatus = false;
  nextPurchase = null;
  listeners.clear();
}
