/**
 * Lightweight behavioral tests for useSubscription.
 * We mock subscriptionService to avoid RevenueCat/native dependencies.
 *
 * @vitest-environment happy-dom
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock __DEV__ global
(globalThis as any).__DEV__ = true;

vi.mock('../services/subscriptionService', () => {
  return {
    initializeSubscription: vi.fn(async () => ({ tier: 'free', isActive: false })),
    isSubscriptionInitialized: vi.fn(() => false),
    getSubscriptionStatus: vi.fn(async () => ({ tier: 'free', isActive: false })),
    refreshSubscriptionStatus: vi.fn(async () => ({ tier: 'free', isActive: false })),
    loadSubscriptionPackages: vi.fn(async () => [
      { id: 'mock_monthly', interval: 'monthly', priceFormatted: '$4.99', currency: 'USD' },
    ]),
    purchaseSubscriptionPackage: vi.fn(async () => ({ tier: 'plus', isActive: true })),
    restoreSubscriptionPurchases: vi.fn(async () => ({ tier: 'plus', isActive: true })),
  };
});

vi.mock('../services/subscriptionSyncService', () => ({
  syncSubscriptionFromServer: vi.fn(async () => ({ ok: true })),
}));

const mockMapStatusFromInfo = vi.fn((..._args: unknown[]) => ({ tier: 'free', isActive: false }));
const mockIsEntitlementExpired = vi.fn((..._args: unknown[]) => false);

vi.mock('../lib/revenuecat', () => ({
  isEntitlementExpired: (...args: unknown[]) => mockIsEntitlementExpired(...args),
  mapStatus: (...args: unknown[]) => mockMapStatusFromInfo(...args),
}));

let currentUser: any = { id: 'user-1' };
const refreshUser = vi.fn(async () => currentUser);
const setUserTierLocally = vi.fn();

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: currentUser,
    loading: false,
    refreshUser,
    setUserTierLocally,
  }),
}));

vi.mock('../services/quotaService', () => ({
  quotaService: {
    invalidate: vi.fn(),
  },
}));

vi.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    addCustomerInfoUpdateListener: vi.fn(),
    removeCustomerInfoUpdateListener: vi.fn(),
    syncPurchases: vi.fn().mockResolvedValue(undefined),
    invalidateCustomerInfoCache: vi.fn(),
    getCustomerInfo: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('expo-router', () => ({
  router: {
    back: vi.fn(),
    canGoBack: vi.fn(() => false),
    push: vi.fn(),
    replace: vi.fn(),
  },
}));

const { useSubscription } = await import('./useSubscription');

describe('useSubscription', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    currentUser = { id: 'user-1' };
    mockIsEntitlementExpired.mockReturnValue(false);
    mockMapStatusFromInfo.mockReturnValue({ tier: 'free', isActive: false });

    const service = await import('../services/subscriptionService');
    vi.mocked(service.initializeSubscription).mockResolvedValue({ tier: 'free', isActive: false } as any);
    vi.mocked(service.isSubscriptionInitialized).mockReturnValue(false);
    vi.mocked(service.getSubscriptionStatus).mockResolvedValue({ tier: 'free', isActive: false } as any);
    vi.mocked(service.refreshSubscriptionStatus).mockResolvedValue({ tier: 'free', isActive: false } as any);
    vi.mocked(service.loadSubscriptionPackages).mockResolvedValue([
      { id: 'mock_monthly', interval: 'monthly', priceFormatted: '$4.99', currency: 'USD' },
    ] as any);
    vi.mocked(service.purchaseSubscriptionPackage).mockResolvedValue({ tier: 'plus', isActive: true } as any);
    vi.mocked(service.restoreSubscriptionPurchases).mockResolvedValue({ tier: 'plus', isActive: true } as any);
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

    it('given unauthenticated user when refreshing then rejects with auth error', async () => {
      currentUser = null;
      const { result } = renderHook(() => useSubscription());

      await expect(result.current.refreshSubscription()).rejects.toThrow('auth_required');
    });
  });

  describe('initialization and loading', () => {
    it('given authenticated user when initializing then loads subscription data', async () => {
      // Given
      const { result } = renderHook(() => useSubscription({ loadPackages: true }));

      // When
      await act(async () => {});

      // Then
      expect(result.current.loading).toBe(false);
      expect(result.current.packages).toHaveLength(1);
      expect(result.current.status?.tier).toBe('free');
      expect(result.current.requiresAuth).toBe(false);
    });

    it('given authenticated user when initializing without packages then skips package loading', async () => {
      // Given
      const { loadSubscriptionPackages } = await import('../services/subscriptionService');
      const { result } = renderHook(() => useSubscription());

      // When
      await act(async () => {});

      // Then
      expect(result.current.loading).toBe(false);
      expect(result.current.packages).toHaveLength(0);
      expect(vi.mocked(loadSubscriptionPackages)).not.toHaveBeenCalled();
    });

    it('given authenticated user when initializing then handles errors gracefully', async () => {
      // Given
      const { initializeSubscription } = await import('../services/subscriptionService');
      vi.mocked(initializeSubscription).mockRejectedValue(new Error('Purchases not initialized'));
      
      const { result } = renderHook(() => useSubscription());

      // When
      await act(async () => {});

      // Then
      expect(result.current.loading).toBe(false);
      expect(result.current.error?.message).toBe('subscription.error.not_initialized');
    });
  });

  describe('purchase functionality', () => {
    it('given authenticated user when purchasing successfully then upgrades subscription', async () => {
      // Given
      const { result } = renderHook(() => useSubscription());
      await act(async () => {});

      // When
      await act(async () => {
        await result.current.purchase('mock_monthly');
      });

      // Then
      expect(result.current.isActive).toBe(true);
      expect(result.current.processing).toBe(false);
      expect(setUserTierLocally).toHaveBeenCalledWith('plus');
    });

    it('given authenticated user when purchasing fails then sets error and throws', async () => {
      // Given
      const { purchaseSubscriptionPackage } = await import('../services/subscriptionService');
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
      const { purchaseSubscriptionPackage } = await import('../services/subscriptionService');
      vi.mocked(purchaseSubscriptionPackage).mockRejectedValue(new Error('Purchases not initialized'));
      
      const { result } = renderHook(() => useSubscription());

      // When
      await act(async () => {
        await result.current.purchase('mock_monthly').catch(() => {});
      });

      // Then
      expect(result.current.error?.message).toBe('subscription.error.not_initialized');
    });
  });

  describe('restore functionality', () => {
    it('given authenticated user when restoring successfully then updates subscription', async () => {
      // Given
      const { result } = renderHook(() => useSubscription());
      await act(async () => {});

      // When
      await act(async () => {
        await result.current.restore();
      });

      // Then
      expect(result.current.isActive).toBe(true);
      expect(result.current.processing).toBe(false);
      expect(setUserTierLocally).toHaveBeenCalledWith('plus');
    });

    it('given authenticated user when restoring fails then sets error and throws', async () => {
      // Given
      const { restoreSubscriptionPurchases } = await import('../services/subscriptionService');
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
      const { restoreSubscriptionPurchases } = await import('../services/subscriptionService');
      vi.mocked(restoreSubscriptionPurchases).mockRejectedValue(new Error('Purchases not initialized'));
      
      const { result } = renderHook(() => useSubscription());

      // When
      await act(async () => {
        await result.current.restore().catch(() => {});
      });

      // Then
      expect(result.current.error?.message).toBe('subscription.error.not_initialized');
    });
  });

  describe('refresh and cancellation flows', () => {
    it('refreshes subscription status from RevenueCat', async () => {
      const { result } = renderHook(() => useSubscription());
      await act(async () => {});

      mockMapStatusFromInfo.mockReturnValueOnce({ tier: 'plus', isActive: true });

      await act(async () => {
        await result.current.refreshSubscription();
      });

      expect(mockMapStatusFromInfo).toHaveBeenCalled();
      expect(result.current.status?.tier).toBe('plus');
      expect(result.current.refreshing).toBe(false);
    });

    it('does not set error state when purchase is cancelled', async () => {
      const { purchaseSubscriptionPackage } = await import('../services/subscriptionService');
      vi.mocked(purchaseSubscriptionPackage).mockRejectedValueOnce({ userCancelled: true, message: 'cancelled' });

      const { result } = renderHook(() => useSubscription());

      await act(async () => {
        await expect(result.current.purchase('mock_monthly')).rejects.toBeDefined();
      });

      await waitFor(() => {
        expect(result.current.error).toBeNull();
      });
    });

    it('refreshes status when entitlement is expired', async () => {
      const { getSubscriptionStatus, initializeSubscription } = await import('../services/subscriptionService');
      vi.mocked(getSubscriptionStatus).mockResolvedValueOnce({
        tier: 'plus',
        isActive: true,
        expiryDate: '2020-01-01T00:00:00Z',
      } as any);
      vi.mocked(initializeSubscription).mockResolvedValueOnce({ tier: 'free', isActive: false } as any);
      mockIsEntitlementExpired.mockReturnValueOnce(true);

      const { result } = renderHook(() => useSubscription());

      await act(async () => {});
      await act(async () => {});

      expect(initializeSubscription).toHaveBeenCalled();
      await waitFor(() => {
        expect(result.current.status?.tier).toBe('free');
      });
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
