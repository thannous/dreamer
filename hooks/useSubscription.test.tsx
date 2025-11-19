/**
 * Lightweight behavioral tests for useSubscription.
 * We mock subscriptionService to avoid RevenueCat/native dependencies.
 */
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/subscriptionService', () => {
  return {
    initializeSubscription: vi.fn(async () => ({ tier: 'free', isActive: false })),
    isSubscriptionInitialized: vi.fn(() => false),
    getSubscriptionStatus: vi.fn(async () => ({ tier: 'free', isActive: false })),
    loadSubscriptionPackages: vi.fn(async () => [
      { id: 'mock_monthly', interval: 'monthly', priceFormatted: '$4.99', currency: 'USD' },
    ]),
    purchaseSubscriptionPackage: vi.fn(async () => ({ tier: 'premium', isActive: true })),
    restoreSubscriptionPurchases: vi.fn(async () => ({ tier: 'premium', isActive: true })),
  };
});

vi.mock('@/lib/auth', () => ({
  updateUserTier: vi.fn(async () => null),
}));

let currentUser: any = { id: 'user-1' };
const refreshUser = vi.fn(async () => currentUser);
const setUserTierLocally = vi.fn();

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: currentUser,
    loading: false,
    refreshUser,
    setUserTierLocally,
  }),
}));

import { useSubscription } from './useSubscription';

describe('useSubscription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = { id: 'user-1' };
  });

  it('blocks purchase when unauthenticated', async () => {
    currentUser = null;
    const { result } = renderHook(() => useSubscription());

    expect(result.current.requiresAuth).toBe(true);
    await expect(result.current.purchase('mock_monthly')).rejects.toThrow('auth_required');
  });

  it('loads offers and upgrades user when purchasing', async () => {
    const { result } = renderHook(() => useSubscription());

    // Wait for initial effect flush
    await act(async () => {});
    expect(result.current.packages).toHaveLength(1);
    expect(result.current.isActive).toBe(false);

    await act(async () => {
      await result.current.purchase('mock_monthly');
    });

    expect(result.current.isActive).toBe(true);
  });
});
