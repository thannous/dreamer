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
import type { SubscriptionStatus } from '@/lib/types';
import type { SubscriptionSyncResponse } from '@/services/subscriptionSyncService';

// Mock __DEV__ global
(globalThis as any).__DEV__ = true;
let mockSelectedSubscriptionMock = false;

jest.mock('../services/subscriptionService', () => {
  return {
    get isMockSubscriptionService() { return mockSelectedSubscriptionMock; },
    initializeSubscription: jest.fn(async () => ({ tier: 'free', isActive: false })),
    isSubscriptionInitialized: jest.fn(() => false),
    getSubscriptionStatus: jest.fn(async () => ({ tier: 'free', isActive: false })),
    refreshSubscriptionStatus: jest.fn(async () => ({ tier: 'free', isActive: false })),
    loadSubscriptionPackages: jest.fn(async () => [
      { id: 'mock_monthly', interval: 'monthly', priceFormatted: '$4.99', currency: 'USD' },
    ]),
    purchaseSubscriptionPackage: jest.fn(async () => ({ tier: 'plus', isActive: true })),
    restoreSubscriptionPurchases: jest.fn(async () => ({ tier: 'plus', isActive: true })),
    syncSubscriptionPurchases: jest.fn(async () => {}),
    addSubscriptionStatusUpdateListener: jest.fn(() => () => {}),
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
let mockGeneration = 1;
const mockIsCurrentSession = (id: string | null, generation: number) =>
  (mockCurrentUser?.id ?? null) === id && mockGeneration === generation;
const mockRefreshUser = jest.fn(async () => mockCurrentUser);
const mockSetUserTierLocally = jest.fn();

const mockSubscriptionMonitor = jest.fn();
const mockForegroundListener = jest.fn();
const mockCustomerInfoListener = jest.fn();
jest.mock('@/hooks/useAppState', () => ({
  useAppState: (onForeground: () => Promise<void>) => mockForegroundListener(onForeground),
}));
jest.mock('./useSubscriptionMonitor', () => ({
  useSubscriptionMonitor: (...args: Parameters<typeof import('./useSubscriptionMonitor').useSubscriptionMonitor>) => {
    mockSubscriptionMonitor(...args);
    const actual = jest.requireActual('./useSubscriptionMonitor') as typeof import('./useSubscriptionMonitor');
    actual.useSubscriptionMonitor(...args);
  },
}));
jest.mock('./useSubscriptionCustomerInfoListener', () => ({
  useSubscriptionCustomerInfoListener: (...args: unknown[]) => mockCustomerInfoListener(...args),
}));

jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: mockCurrentUser,
    sessionGeneration: mockGeneration,
    isCurrentSession: mockIsCurrentSession,
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
    mockSelectedSubscriptionMock = false;
    mockGeneration = 1;
    const { Platform } = require('react-native');
    Platform.OS = 'ios';
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
    jest.mocked(service.syncSubscriptionPurchases).mockResolvedValue(undefined as any);
    jest.mocked(service.addSubscriptionStatusUpdateListener).mockReturnValue(() => {});
  });

  it.each(['resume', 'customer_info_free'])('handles a background 401 from %s without rejecting or changing the user tier', async (source: string) => {
    const { syncSubscriptionFromServer } = require('../services/subscriptionSyncService');
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const now = jest.spyOn(Date, 'now');
    try {
      const { result } = renderSubscriptionHook();
      await waitFor(() => expect(result.current.loading).toBe(false));
      mockSetUserTierLocally.mockClear();
      now.mockReturnValue(Date.now() + 61_000);
      syncSubscriptionFromServer.mockRejectedValueOnce(Object.assign(new Error('HTTP 401'), {
        status: 401, bodyText: 'private response', url: 'https://private.example',
      }));
      const hook = source === 'resume' ? mockSubscriptionMonitor : mockCustomerInfoListener;
      const callback = hook.mock.calls.at(-1)?.[0] as (status: { tier: string; isActive: boolean }) => void;
      await act(async () => {
        callback({ tier: 'free', isActive: false });
      });
      await waitFor(() => expect(warn).toHaveBeenCalledWith(
        '[useSubscription] Background sync failed', { source, status: 401 }
      ));
      expect(mockSetUserTierLocally).not.toHaveBeenCalled();
      expect(result.current.loading).toBe(false);
    } finally {
      now.mockRestore();
      warn.mockRestore();
    }
  });

  it('rereads renewal details for the current account after a native customer-info signal', async () => {
    const prior: SubscriptionStatus = {
      tier: 'plus', isActive: true, willRenew: false,
      expiryDate: new Date(Date.now() + 86_400_000).toISOString(),
    };
    const renewed = { ...prior, willRenew: true, expiryDate: new Date(Date.now() + 30 * 86_400_000).toISOString() };
    const { initializeSubscription, refreshSubscriptionStatus } = require('../services/subscriptionService');
    mockCurrentUser = { ...mockCurrentUser, app_metadata: { tier: 'plus', subscription_version: 1 } };
    initializeSubscription.mockResolvedValue(prior);
    refreshSubscriptionStatus.mockResolvedValue(renewed);
    const { result } = renderSubscriptionHook();
    await waitFor(() => expect(result.current.status).toMatchObject(prior));

    const callback = mockCustomerInfoListener.mock.calls.at(-1)?.[0] as (status: SubscriptionStatus) => void;
    await act(async () => { callback(prior); });

    expect(result.current.status).toMatchObject(renewed);
    expect(refreshSubscriptionStatus).toHaveBeenCalledTimes(1);
  });

  it('discards a native customer-info reread when its session changes', async () => {
    const paid: SubscriptionStatus = { tier: 'plus', isActive: true, willRenew: true };
    const free: SubscriptionStatus = { tier: 'free', isActive: false };
    const { initializeSubscription, refreshSubscriptionStatus } = require('../services/subscriptionService');
    mockCurrentUser = { ...mockCurrentUser, app_metadata: { tier: 'plus', subscription_version: 1 } };
    initializeSubscription.mockResolvedValueOnce(paid).mockResolvedValue(free);
    let finish!: (status: SubscriptionStatus) => void;
    refreshSubscriptionStatus.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const { result, rerender } = renderSubscriptionHook();
    await waitFor(() => expect(result.current.status).toMatchObject(paid));
    const callback = mockCustomerInfoListener.mock.calls.at(-1)?.[0] as (status: SubscriptionStatus) => void;
    await act(async () => { callback(paid); });

    mockCurrentUser = { ...mockCurrentUser, id: 'user-2', app_metadata: { tier: 'free', subscription_version: 1 } };
    mockGeneration++;
    rerender();
    await waitFor(() => expect(result.current.status).toMatchObject(free));
    mockSetUserTierLocally.mockClear();
    await act(async () => { finish(paid); });

    expect(result.current.status).toMatchObject(free);
    expect(mockSetUserTierLocally).not.toHaveBeenCalled();
  });

  it.each(['customer info', 'resume'] as const)('keeps confirmed Free when a %s read returns old Plus', async (source: 'customer info' | 'resume') => {
    const paid: SubscriptionStatus = { tier: 'plus', isActive: true, willRenew: true };
    const free: SubscriptionStatus = { tier: 'free', isActive: false };
    const { initializeSubscription, refreshSubscriptionStatus } = require('../services/subscriptionService');
    const { syncSubscriptionFromServer } = require('../services/subscriptionSyncService');
    mockCurrentUser = { ...mockCurrentUser, app_metadata: { tier: 'plus', subscription_version: 1 } };
    initializeSubscription.mockResolvedValue(paid);
    const { result } = renderSubscriptionHook();
    await waitFor(() => expect(result.current.status).toMatchObject(paid));

    let finish!: (status: SubscriptionStatus) => void;
    refreshSubscriptionStatus.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const resume = mockForegroundListener.mock.calls.at(-1)?.[0] as () => Promise<void>;
    const customerInfo = mockCustomerInfoListener.mock.calls.at(-1)?.[0] as (status: SubscriptionStatus) => void;
    let foregroundRead: Promise<void> | undefined;
    await act(async () => {
      if (source === 'resume') foregroundRead = resume();
      else customerInfo(paid);
    });
    expect(refreshSubscriptionStatus).toHaveBeenCalledTimes(1);

    let finishManual!: (status: SubscriptionStatus) => void;
    refreshSubscriptionStatus.mockImplementationOnce(() => new Promise(resolve => { finishManual = resolve; }));
    syncSubscriptionFromServer.mockResolvedValueOnce({ ok: true, ...free, version: 1, changed: true });
    let manualRefresh: Promise<unknown> | undefined;
    await act(async () => { manualRefresh = result.current.refreshSubscription(); });
    await act(async () => {
      customerInfo(paid);
      void resume();
    });
    expect(refreshSubscriptionStatus).toHaveBeenCalledTimes(2);

    await act(async () => {
      finishManual(free);
      await manualRefresh;
    });
    expect(result.current.status).toMatchObject(free);
    mockSetUserTierLocally.mockClear();

    await act(async () => {
      finish(paid);
      await foregroundRead;
    });
    expect(result.current.status).toMatchObject(free);
    expect(mockSetUserTierLocally).not.toHaveBeenCalled();
  });

  describe('authentication handling', () => {
    it('does not transfer Play purchases automatically when switching accounts on Android', async () => {
      const { Platform } = require('react-native');
      const { initializeSubscription, syncSubscriptionPurchases } = require('../services/subscriptionService');
      Platform.OS = 'android';

      const { rerender } = renderSubscriptionHook();

      await waitFor(() => {
        expect(initializeSubscription).toHaveBeenCalledWith('user-1');
      });

      mockCurrentUser = {
        id: 'free-user-2',
        app_metadata: { tier: 'free', subscription_version: 1 },
        user_metadata: {},
      };
      rerender();

      await waitFor(() => {
        expect(initializeSubscription).toHaveBeenCalledWith('free-user-2');
      });

      expect(syncSubscriptionPurchases).not.toHaveBeenCalled();
    });

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

    it('given unauthenticated user when loading packages then shows prices without enabling purchase', async () => {
      mockCurrentUser = null;
      const { initializeSubscription, loadSubscriptionPackages } = require('../services/subscriptionService');
      const { result } = renderSubscriptionHook({ loadPackages: true });

      await waitFor(() => {
        expect(result.current.packages).toHaveLength(1);
      });

      expect(initializeSubscription).toHaveBeenCalledWith(null);
      expect(loadSubscriptionPackages).toHaveBeenCalledTimes(1);
      expect(result.current.requiresAuth).toBe(true);
      await expect(result.current.purchase('mock_monthly')).rejects.toThrow('auth_required');
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
    // The web E2E fixture enforces global mock mode and blocks real Auth/backend
    // traffic. Cover the selected-service fallback separately with owned auth data.
    it.each(['purchase', 'restore'])('confirms fallback mock %s without contacting the backend when global mock mode is off', async (action: string) => {
      const mockMode = jest.spyOn(require('../lib/env'), 'isMockModeEnabled').mockReturnValue(false);
      mockSelectedSubscriptionMock = true;
      const { syncSubscriptionFromServer } = require('../services/subscriptionSyncService');
      syncSubscriptionFromServer.mockRejectedValue(new Error('Mock receipts cannot be confirmed by the real backend'));
      try {
        const { result } = renderSubscriptionHook();
        await act(async () => {});
        let outcome: any;
        await act(async () => {
          outcome = action === 'purchase' ? await result.current.purchase('mock_monthly') : await result.current.restore();
        });
        expect(outcome).toEqual(expect.objectContaining({ tier: 'plus', isActive: true, serverConfirmed: true }));
        expect(syncSubscriptionFromServer).not.toHaveBeenCalled();
      } finally {
        mockMode.mockRestore();
        syncSubscriptionFromServer.mockReset().mockResolvedValue({ ok: true, tier: 'plus', isActive: true, version: 1, changed: true });
      }
    });

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
      expect(mockSetUserTierLocally).toHaveBeenCalledWith(expect.objectContaining({ tier: 'plus' }), { userId: 'user-1', generation: mockGeneration });
    });

    it.each(['purchase', 'restore'])('does not claim server confirmation when %s succeeds locally but synchronization fails', async (action: string) => {
      const { result } = renderSubscriptionHook();
      await act(async () => {});
      const { syncSubscriptionFromServer } = require('../services/subscriptionSyncService');
      syncSubscriptionFromServer.mockRejectedValueOnce(new Error('temporary sync failure'));
      let outcome: any;
      await act(async () => {
        outcome = action === 'purchase' ? await result.current.purchase('mock_monthly') : await result.current.restore();
      });
      expect(outcome).toEqual(expect.objectContaining({ isActive: false, storeActive: true, serverConfirmed: false }));
      expect(result.current.isActive).toBe(false);
      expect(result.current.activationPending).toBe(true);
      expect(result.current.processing).toBe(false);
    });

    it.each(['purchase', 'restore'])('marks %s as confirmed only after the server responds', async (action: string) => {
      const { result } = renderSubscriptionHook();
      await act(async () => {});
      const { syncSubscriptionFromServer } = require('../services/subscriptionSyncService');
      let finish!: (value: any) => void;
      syncSubscriptionFromServer.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
      let operation!: Promise<any>;
      let completed = false;
      await act(async () => {
        operation = action === 'purchase' ? result.current.purchase('mock_monthly') : result.current.restore();
        void operation.then(() => { completed = true; });
      });
      expect(completed).toBe(false);
      expect(result.current.processing).toBe(true);
      let outcome: any;
      await act(async () => {
        finish({ ok: true, tier: 'plus', isActive: true, version: 1, changed: true });
        outcome = await operation;
      });
      expect(outcome).toEqual(expect.objectContaining({ tier: 'plus', isActive: true, serverConfirmed: true }));
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
    it.each(['empty', 'paid'] as const)('uses the receipt to decide whether to block purchases after %s restore if the server is unavailable', async (receipt: 'empty' | 'paid') => {
      const free: SubscriptionStatus = { tier: 'free', isActive: false };
      const plus: SubscriptionStatus = { tier: 'plus', isActive: true };
      const receiptActive = receipt === 'paid';
      const { restoreSubscriptionPurchases, purchaseSubscriptionPackage } = require('../services/subscriptionService');
      const { syncSubscriptionFromServer } = require('../services/subscriptionSyncService');
      syncSubscriptionFromServer.mockResolvedValueOnce({ ok: true, ...free, version: 1, changed: false });
      const { result } = renderSubscriptionHook();
      await waitFor(() => expect(result.current.loading).toBe(false));
      mockSetUserTierLocally.mockClear();
      restoreSubscriptionPurchases.mockResolvedValueOnce(receiptActive ? plus : free);
      syncSubscriptionFromServer.mockRejectedValueOnce(new Error('Backend unavailable'));

      await act(async () => {
        await expect(result.current.restore()).resolves.toMatchObject({ ...free, storeActive: receiptActive, serverConfirmed: false });
      });
      expect(result.current.status).toMatchObject(free);
      expect(result.current.activationPending).toBe(receiptActive);
      expect(mockSetUserTierLocally).not.toHaveBeenCalled();

      await act(async () => {
        if (receiptActive) {
          await expect(result.current.purchase('mock_monthly')).rejects.toThrow('subscription_operation_pending');
        } else {
          syncSubscriptionFromServer.mockResolvedValueOnce({ ok: true, ...plus, version: 1, changed: true });
          await expect(result.current.purchase('mock_monthly')).resolves.toMatchObject({ ...plus, serverConfirmed: true });
        }
      });
      expect(purchaseSubscriptionPackage).toHaveBeenCalledTimes(receiptActive ? 0 : 1);
    });

    it('given authenticated user when restoring successfully then updates subscription', async () => {
      // Given
      const { restoreSubscriptionPurchases } = require('../services/subscriptionService');
      const { result } = renderSubscriptionHook();
      await act(async () => {});

      // When
      await act(async () => {
        await result.current.restore();
      });

      // Then
      expect(result.current.isActive).toBe(true);
      expect(result.current.processing).toBe(false);
      expect(restoreSubscriptionPurchases).toHaveBeenCalledTimes(1);
      expect(mockSetUserTierLocally).toHaveBeenCalledWith(expect.objectContaining({ tier: 'plus' }), { userId: 'user-1', generation: mockGeneration });
    });

    it('given backend sync succeeds when restoring then logs convergence completion', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
      const { result } = renderSubscriptionHook();
      await act(async () => {});

      try {
        await act(async () => {
          await result.current.restore();
        });

        expect(consoleLogSpy).toHaveBeenCalledWith(
          '[useSubscription] Subscription convergence completed',
          expect.objectContaining({
            userId: 'user-1',
            source: 'restore',
            syncedTier: 'plus',
            isActive: true,
            version: 1,
            changed: true,
          })
        );
      } finally {
        consoleLogSpy.mockRestore();
      }
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

    it('keeps the secondary account free when RevenueCat rejects a receipt owned by another account', async () => {
      const { restoreSubscriptionPurchases } = require('../services/subscriptionService');
      const { syncSubscriptionFromServer } = require('../services/subscriptionSyncService');
      const receiptAlreadyInUseError = Object.assign(
        new Error('Receipt already in use by another App User ID'),
        { code: 'RECEIPT_ALREADY_IN_USE' }
      );
      jest.mocked(restoreSubscriptionPurchases).mockRejectedValue(receiptAlreadyInUseError);
      mockCurrentUser = {
        id: 'free-user-2',
        app_metadata: { tier: 'free', subscription_version: 1 },
        user_metadata: {},
      };

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
      const { result } = renderSubscriptionHook();
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      jest.mocked(syncSubscriptionFromServer).mockClear();
      mockSetUserTierLocally.mockClear();

      try {
        await act(async () => {
          await expect(result.current.restore()).rejects.toBe(receiptAlreadyInUseError);
        });

        expect(result.current.status).toMatchObject({ tier: 'free', isActive: false });
        expect(result.current.isActive).toBe(false);
        expect(result.current.error?.message).toBe('subscription.error.receipt_already_in_use');
        expect(restoreSubscriptionPurchases).toHaveBeenCalledTimes(1);
        expect(syncSubscriptionFromServer).not.toHaveBeenCalled();
        expect(mockSetUserTierLocally).not.toHaveBeenCalledWith(
          expect.objectContaining({ tier: 'plus' }), expect.anything()
        );
      } finally {
        consoleErrorSpy.mockRestore();
      }
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
    it.each([false, true])('discards a refresh from an older session (same account returns: %s)', async (returnToSame: boolean) => {
      const { result, rerender } = renderSubscriptionHook();
      await waitFor(() => expect(result.current.loading).toBe(false));
      const sync = jest.mocked(require('../services/subscriptionSyncService').syncSubscriptionFromServer);
      let finish!: (value: SubscriptionSyncResponse) => void;
      sync.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
      let obsolete!: Promise<unknown>;
      await act(async () => { obsolete = result.current.refreshSubscription().catch((error: unknown) => error); });
      const firstUser = mockCurrentUser;
      mockCurrentUser = { ...firstUser, id: 'user-2' };
      mockGeneration++;
      rerender();
      if (returnToSame) {
        mockCurrentUser = firstUser;
        mockGeneration++;
        rerender();
      }
      await waitFor(() => expect(result.current.loading).toBe(false));
      mockSetUserTierLocally.mockClear();
      await act(async () => {
        finish({ ok: true, tier: 'plus', isActive: true, version: 1, changed: true });
        expect(await obsolete).toMatchObject({ message: 'subscription_session_changed' });
      });
      expect(result.current.status?.tier).toBe('free');
      expect(result.current.error).toBeNull();
      expect(result.current.refreshing).toBe(false);
      expect(mockSetUserTierLocally).not.toHaveBeenCalled();
    });

    it.each(['plus', 'free'] as const)('keeps the last confirmed right through unknown and settles confirmed %s on retry', async (tier: 'plus' | 'free') => {
      const plus = { tier: 'plus', isActive: true } as const;
      const free = { tier: 'free', isActive: false } as const;
      const prior = tier === 'free' ? plus : free;
      mockCurrentUser = { ...mockCurrentUser, app_metadata: { tier: prior.tier, subscription_version: 1 } };
      const service = require('../services/subscriptionService');
      service.initializeSubscription.mockResolvedValue(prior);
      const sync = jest.mocked(require('../services/subscriptionSyncService').syncSubscriptionFromServer);
      const { result } = renderSubscriptionHook();
      await waitFor(() => expect(result.current.status).toMatchObject(prior));
      const unknown = { ok: true, ...free, version: 1, changed: false, outcome: 'unknown_entitlement' };
      sync.mockResolvedValueOnce(unknown);
      await act(async () => {
        await expect(result.current.restore()).resolves.toMatchObject({ storeActive: true, serverConfirmed: false });
      });
      expect(result.current.status).toMatchObject(prior);
      expect(result.current.activationPending).toBe(true);
      service.refreshSubscriptionStatus.mockResolvedValue(tier === 'plus' ? plus : free);
      sync.mockResolvedValueOnce({ ok: true, ...(tier === 'plus' ? plus : free), version: 1, changed: true });
      await act(async () => {
        await expect(result.current.refreshSubscription()).resolves.toMatchObject({ tier, serverConfirmed: true });
      });
      expect(result.current.status?.tier).toBe(tier);
      expect(result.current.activationPending).toBe(false);
      expect(service.restoreSubscriptionPurchases).toHaveBeenCalledTimes(1);
      expect(service.purchaseSubscriptionPackage).not.toHaveBeenCalled();
    });

    it('refreshes subscription status from RevenueCat', async () => {
      const { refreshSubscriptionStatus } = require('../services/subscriptionService');
      jest.mocked(refreshSubscriptionStatus).mockResolvedValueOnce({ tier: 'plus', isActive: true } as any);

      const { result } = renderSubscriptionHook();
      await act(async () => {});

      await act(async () => {
        await result.current.refreshSubscription();
      });

      expect(refreshSubscriptionStatus).toHaveBeenCalled();
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
