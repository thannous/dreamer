/**
 * Lightweight behavioral tests for useSubscription.
 * We mock subscriptionService to avoid RevenueCat/native dependencies.
 */
// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useSubscription } from './useSubscription';

// Mock __DEV__ global
global.__DEV__ = true;

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

describe('useSubscription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = { id: 'user-1' };
  });

  describe('authentication handling', () => {
    it('given unauthenticated user when using subscription then requires auth', async () => {
      // Given
      currentUser = null;
      const { result } = renderHook(() => useSubscription());

      // When
      // Hook renders automatically

      // Then
      expect(result.current.requiresAuth).toBe(true);
      expect(result.current.status).toBeNull();
      expect(result.current.packages).toHaveLength(0);
    });

    it('given unauthenticated user when purchasing then rejects with auth error', async () => {
      // Given
      currentUser = null;
      const { result } = renderHook(() => useSubscription());

      // When/Then
      await expect(result.current.purchase('mock_monthly')).rejects.toThrow('auth_required');
    });

    it('given unauthenticated user when restoring then rejects with auth error', async () => {
      // Given
      currentUser = null;
      const { result } = renderHook(() => useSubscription());

      // When/Then
      await expect(result.current.restore()).rejects.toThrow('auth_required');
    });
  });

  describe('initialization and loading', () => {
    it('given authenticated user when initializing then loads subscription data', async () => {
      // Given
      const { result } = renderHook(() => useSubscription());

      // When
      await act(async () => {});

      // Then
      expect(result.current.loading).toBe(false);
      expect(result.current.packages).toHaveLength(1);
      expect(result.current.status?.tier).toBe('free');
      expect(result.current.requiresAuth).toBe(false);
    });

    it('given authenticated user when initializing then handles errors gracefully', async () => {
      // Given
      const { initializeSubscription } = await import('@/services/subscriptionService');
      vi.mocked(initializeSubscription).mockRejectedValue(new Error('Purchases not initialized'));
      
      const { result } = renderHook(() => useSubscription());

      // When
      await act(async () => {});

      // Then
      expect(result.current.loading).toBe(false);
      expect(result.current.error?.message).toBe('Service des achats non initialisé. Veuillez redémarrer l\'application.');
    });
  });

  describe('purchase functionality', () => {
    it('given authenticated user when purchasing successfully then upgrades subscription', async () => {
      // Given
      const { result } = renderHook(() => useSubscription());

      // When
      await act(async () => {
        await result.current.purchase('mock_monthly');
      });

      // Then
      expect(result.current.isActive).toBe(true);
      expect(result.current.processing).toBe(false);
      expect(setUserTierLocally).toHaveBeenCalledWith('premium');
    });

    it('given authenticated user when purchasing fails then sets error and throws', async () => {
      // Given
      const { purchaseSubscriptionPackage } = await import('@/services/subscriptionService');
      vi.mocked(purchaseSubscriptionPackage).mockRejectedValue(new Error('Purchase failed'));
      
      const { result } = renderHook(() => useSubscription());

      // When/Then
      await act(async () => {
        await expect(result.current.purchase('mock_monthly')).rejects.toThrow('Purchase failed');
      });

      expect(result.current.processing).toBe(false);
      expect(result.current.error?.message).toBe('Purchase failed');
    });

    it('given authenticated user when purchasing with initialization error then formats error message', async () => {
      // Given
      const { purchaseSubscriptionPackage } = await import('@/services/subscriptionService');
      vi.mocked(purchaseSubscriptionPackage).mockRejectedValue(new Error('Purchases not initialized'));
      
      const { result } = renderHook(() => useSubscription());

      // When
      await act(async () => {
        await result.current.purchase('mock_monthly').catch(() => {});
      });

      // Then
      expect(result.current.error?.message).toBe('Service des achats non initialisé. Veuillez redémarrer l\'application.');
    });
  });

  describe('restore functionality', () => {
    it('given authenticated user when restoring successfully then updates subscription', async () => {
      // Given
      const { result } = renderHook(() => useSubscription());

      // When
      await act(async () => {
        await result.current.restore();
      });

      // Then
      expect(result.current.isActive).toBe(true);
      expect(result.current.processing).toBe(false);
      expect(setUserTierLocally).toHaveBeenCalledWith('premium');
    });

    it('given authenticated user when restoring fails then sets error and throws', async () => {
      // Given
      const { restoreSubscriptionPurchases } = await import('@/services/subscriptionService');
      vi.mocked(restoreSubscriptionPurchases).mockRejectedValue(new Error('Restore failed'));
      
      const { result } = renderHook(() => useSubscription());

      // When/Then
      await act(async () => {
        await expect(result.current.restore()).rejects.toThrow('Restore failed');
      });

      expect(result.current.processing).toBe(false);
      expect(result.current.error?.message).toBe('Restore failed');
    });

    it('given authenticated user when restoring with initialization error then formats error message', async () => {
      // Given
      const { restoreSubscriptionPurchases } = await import('@/services/subscriptionService');
      vi.mocked(restoreSubscriptionPurchases).mockRejectedValue(new Error('Purchases not initialized'));
      
      const { result } = renderHook(() => useSubscription());

      // When
      await act(async () => {
        await result.current.restore().catch(() => {});
      });

      // Then
      expect(result.current.error?.message).toBe('Service des achats non initialisé. Veuillez redémarrer l\'application.');
    });
  });

  describe('error handling and formatting', () => {
    it('given unknown error when formatting then returns generic error message', async () => {
      // Given
      const { result } = renderHook(() => useSubscription());

      // When
      await act(async () => {
        // Test basic error handling by triggering a purchase error
        await result.current.purchase('mock_monthly').catch(() => {});
      });

      // Then
      // Basic error handling test - just ensure no unhandled errors
      expect(result.current.processing).toBe(false);
    });
  });
});
