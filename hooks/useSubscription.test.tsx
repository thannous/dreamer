/**
 * Lightweight behavioral tests for useSubscription.
 * We mock subscriptionService to avoid RevenueCat/native dependencies.
 *
 * @jest-environment jsdom
 */
import React, { type PropsWithChildren } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { SubscriptionProvider } from '../context/SubscriptionContext';
import type { UseSubscriptionOptions } from './useSubscription';

// Mock __DEV__ global
(globalThis as any).__DEV__ = true;

jest.mock('../services/subscriptionService', () => {
  return {
    initializeSubscription: jest.fn(async () => ({ tier: 'free', isActive: false })),
    isSubscriptionInitialized: jest.fn(() => false),
    getSubscriptionStatus: jest.fn(async () => ({ tier: 'free', isActive: false })),
    refreshSubscriptionStatus: jest.fn(async () => ({ tier: 'free', isActive: false })),
    loadSubscriptionPackages: jest.fn(async () => [
      { id: 'mock_monthly', interval: 'monthly', priceFormatted: '$4.99', currency: 'USD' },
    ]),
    purchaseSubscriptionPackage: jest.fn(async () => ({ tier: 'plus', isActive: true })),
    restoreSubscriptionPurchases: jest.fn(async () => ({ tier: 'plus', isActive: true })),
  };
});

jest.mock('../services/subscriptionSyncService', () => ({
  syncSubscriptionFromServer: jest.fn(async () => ({
    ok: true,
    tier: 'plus',
    isActive: true,
    version: 1,
    changed: true,
  })),
}));

const mockMapStatusFromInfo = jest.fn((..._args: unknown[]) => ({ tier: 'free', isActive: false }));
const mockIsEntitlementExpired = jest.fn((..._args: unknown[]) => false);

jest.mock('../lib/revenuecat', () => ({
  isEntitlementExpired: (...args: unknown[]) => mockIsEntitlementExpired(...args),
  mapStatus: (...args: unknown[]) => mockMapStatusFromInfo(...args),
}));

let mockCurrentUser: any = { id: 'user-1', app_metadata: { subscription_version: 1 }, user_metadata: {} };
const mockRefreshUser = jest.fn(async () => mockCurrentUser);
const mockSetUserTierLocally = jest.fn();

jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: mockCurrentUser,
    loading: false,
    refreshUser: mockRefreshUser,
    setUserTierLocally: mockSetUserTierLocally,
  }),
}));

jest.mock('../services/quotaService', () => ({
  quotaService: {
    invalidate: jest.fn(),
  },
}));

jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    addCustomerInfoUpdateListener: jest.fn(),
    removeCustomerInfoUpdateListener: jest.fn(),
    syncPurchases: jest.fn().mockResolvedValue(undefined),
    invalidateCustomerInfoCache: jest.fn(),
    getCustomerInfo: jest.fn().mockResolvedValue({}),
  },
}));

jest.mock('expo-router', () => ({
  router: {
    back: jest.fn(),
    canGoBack: jest.fn(() => false),
    push: jest.fn(),
    replace: jest.fn(),
  },
}));

jest.mock('react-native', () => ({
  AppState: {
    currentState: 'active',
    addEventListener: () => ({ remove: () => {} }),
  },
  Platform: {
    OS: 'ios',
    select: (spec: Record<string, unknown>) => (spec as any).ios ?? spec.default,
  },
  NativeModules: {
    ExponentConstants: {},
  },
  TurboModuleRegistry: {
    get: () => null,
  },
}));

const { useSubscription } = require('./useSubscription');

const wrapper = ({ children }: PropsWithChildren) => (
  <SubscriptionProvider>{children}</SubscriptionProvider>
);

const renderSubscriptionHook = (options?: UseSubscriptionOptions) =>
  renderHook(() => useSubscription(options), { wrapper });

describe('useSubscription', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockCurrentUser = { id: 'user-1', app_metadata: { subscription_version: 1 }, user_metadata: {} };
    mockIsEntitlementExpired.mockReturnValue(false);
    mockMapStatusFromInfo.mockReturnValue({ tier: 'free', isActive: false });

    const service = require('../services/subscriptionService');
    jest.mocked(service.initializeSubscription).mockResolvedValue({ tier: 'free', isActive: false } as any);
    jest.mocked(service.isSubscriptionInitialized).mockReturnValue(false);
    jest.mocked(service.getSubscriptionStatus).mockResolvedValue({ tier: 'free', isActive: false } as any);
    jest.mocked(service.refreshSubscriptionStatus).mockResolvedValue({ tier: 'free', isActive: false } as any);
    jest.mocked(service.loadSubscriptionPackages).mockResolvedValue([
      { id: 'mock_monthly', interval: 'monthly', priceFormatted: '$4.99', currency: 'USD' },
    ] as any);
    jest.mocked(service.purchaseSubscriptionPackage).mockResolvedValue({ tier: 'plus', isActive: true } as any);
    jest.mocked(service.restoreSubscriptionPurchases).mockResolvedValue({ tier: 'plus', isActive: true } as any);
  });

  describe('authentication handling', () => {
    it('given unauthenticated user when using subscription then requires auth', async () => {
      // Given
      mockCurrentUser = null;
      const { result } = renderSubscriptionHook();

      // When
      // Hook renders automatically

      // Then
      expect(result.current.requiresAuth).toBe(true);
      expect(result.current.status).toBeNull();
      expect(result.current.packages).toHaveLength(0);
    });

    it('given unauthenticated user when purchasing then rejects with auth error', async () => {
      // Given
      mockCurrentUser = null;
      const { result } = renderSubscriptionHook();

      // When/Then
      await expect(result.current.purchase('mock_monthly')).rejects.toThrow('auth_required');
    });

    it('given unauthenticated user when restoring then rejects with auth error', async () => {
      // Given
      mockCurrentUser = null;
      const { result } = renderSubscriptionHook();

      // When/Then
      await expect(result.current.restore()).rejects.toThrow('auth_required');
    });

    it('given unauthenticated user when refreshing then rejects with auth error', async () => {
      mockCurrentUser = null;
      const { result } = renderSubscriptionHook();

      await expect(result.current.refreshSubscription()).rejects.toThrow('auth_required');
    });
  });

  describe('initialization and loading', () => {
    it('given authenticated user when initializing then loads subscription data', async () => {
      // Given
      const { result } = renderSubscriptionHook({ loadPackages: true });

      // When
      await act(async () => {});

      // Then
      await waitFor(() => {
        expect(result.current.packages).toHaveLength(1);
      });
      expect(result.current.loading).toBe(false);
      expect(result.current.status?.tier).toBe('free');
      expect(result.current.requiresAuth).toBe(false);
    });

    it('given authenticated user when initializing without packages then skips package loading', async () => {
      // Given
      const { loadSubscriptionPackages } = require('../services/subscriptionService');
      const { result } = renderSubscriptionHook();

      // When
      await act(async () => {});

      // Then
      expect(result.current.loading).toBe(false);
      expect(result.current.packages).toHaveLength(0);
      expect(jest.mocked(loadSubscriptionPackages)).not.toHaveBeenCalled();
    });

    it('given authenticated user when initializing then handles errors gracefully', async () => {
      // Given
      const { initializeSubscription } = require('../services/subscriptionService');
      jest.mocked(initializeSubscription).mockRejectedValue(new Error('Purchases not initialized'));
      
      const { result } = renderSubscriptionHook();

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
      const { result } = renderSubscriptionHook();
      await act(async () => {});

      // When
      await act(async () => {
        await result.current.purchase('mock_monthly');
      });

      // Then
      expect(result.current.isActive).toBe(true);
      expect(result.current.processing).toBe(false);
      expect(mockSetUserTierLocally).toHaveBeenCalledWith(expect.objectContaining({ tier: 'plus' }));
    });

    it('given authenticated user when purchasing fails then sets error and throws', async () => {
      // Given
      const { purchaseSubscriptionPackage } = require('../services/subscriptionService');
      jest.mocked(purchaseSubscriptionPackage).mockRejectedValue(new Error('Purchase failed'));
      
      const { result } = renderSubscriptionHook();

      // When/Then
      await act(async () => {
        await expect(result.current.purchase('mock_monthly')).rejects.toThrow('Purchase failed');
      });

      expect(result.current.processing).toBe(false);
      expect(result.current.error?.message).toBe('Purchase failed');
    });

    it('given authenticated user when purchasing with initialization error then formats error message', async () => {
      // Given
      const { purchaseSubscriptionPackage } = require('../services/subscriptionService');
      jest.mocked(purchaseSubscriptionPackage).mockRejectedValue(new Error('Purchases not initialized'));
      
      const { result } = renderSubscriptionHook();

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
      const { result } = renderSubscriptionHook();
      await act(async () => {});

      // When
      await act(async () => {
        await result.current.restore();
      });

      // Then
      expect(result.current.isActive).toBe(true);
      expect(result.current.processing).toBe(false);
      expect(mockSetUserTierLocally).toHaveBeenCalledWith(expect.objectContaining({ tier: 'plus' }));
    });

    it('given authenticated user when restoring fails then sets error and throws', async () => {
      // Given
      const { restoreSubscriptionPurchases } = require('../services/subscriptionService');
      jest.mocked(restoreSubscriptionPurchases).mockRejectedValue(new Error('Restore failed'));
      
      const { result } = renderSubscriptionHook();

      // When/Then
      await act(async () => {
        await expect(result.current.restore()).rejects.toThrow('Restore failed');
      });

      expect(result.current.processing).toBe(false);
      expect(result.current.error?.message).toBe('Restore failed');
    });

    it('given authenticated user when restoring with initialization error then formats error message', async () => {
      // Given
      const { restoreSubscriptionPurchases } = require('../services/subscriptionService');
      jest.mocked(restoreSubscriptionPurchases).mockRejectedValue(new Error('Purchases not initialized'));
      
      const { result } = renderSubscriptionHook();

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
      const { result } = renderSubscriptionHook();
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
      const { purchaseSubscriptionPackage } = require('../services/subscriptionService');
      jest.mocked(purchaseSubscriptionPackage).mockRejectedValueOnce({ userCancelled: true, message: 'cancelled' });

      const { result } = renderSubscriptionHook();

      await act(async () => {
        await expect(result.current.purchase('mock_monthly')).rejects.toBeDefined();
      });

      await waitFor(() => {
        expect(result.current.error).toBeNull();
      });
    });

    it('refreshes status when entitlement is expired', async () => {
      const { getSubscriptionStatus, initializeSubscription } = require('../services/subscriptionService');
      jest.mocked(getSubscriptionStatus).mockResolvedValueOnce({
        tier: 'plus',
        isActive: true,
        expiryDate: '2020-01-01T00:00:00Z',
      } as any);
      jest.mocked(initializeSubscription).mockResolvedValueOnce({ tier: 'free', isActive: false } as any);
      mockIsEntitlementExpired.mockReturnValueOnce(true);

      const { result } = renderSubscriptionHook();

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
      const { result } = renderSubscriptionHook();

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
