/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';
import type { SubscriptionStatus } from '@/lib/types';
import { getSubscriptionStatus, refreshSubscriptionStatus } from '@/services/subscriptionService';
import { syncSubscriptionFromServer } from '@/services/subscriptionSyncService';
import { useQuota } from '../useQuota';
import { useSubscriptionExpiryTimer } from '../useSubscriptionExpiryTimer';

jest.mock('@/services/subscriptionService', () => ({ getSubscriptionStatus: jest.fn(), refreshSubscriptionStatus: jest.fn() }));
jest.mock('@/services/subscriptionSyncService', () => ({ syncSubscriptionFromServer: jest.fn() }));
jest.mock('@/lib/env', () => ({ isMockModeEnabled: () => false }));
jest.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock('../useSubscription', () => ({ useSubscription: () => ({ status: mockStatus, loading: false }) }));
jest.mock('@/services/quotaService', () => ({ quotaService: {
  getQuotaStatus: jest.fn(async () => ({ tier: 'free', usage: {}, canAnalyze: false, canExplore: false })),
  invalidateAll: jest.fn(), subscribe: () => () => {},
} }));
jest.mock('@/lib/guestSession', () => ({
  getGuestBootstrapState: () => ({ status: 'ready' }), subscribeGuestBootstrapState: () => () => {},
}));

const refresh = jest.mocked(refreshSubscriptionStatus);
const cached = jest.mocked(getSubscriptionStatus);
const sync = jest.mocked(syncSubscriptionFromServer);
const start = Date.parse('2026-10-19T00:00:00Z');
const hour = 60 * 60 * 1000;
const mockUser = { id: 'timer-quota', app_metadata: { tier: 'plus' } };
let mockStatus: SubscriptionStatus;
beforeEach(() => {
  jest.clearAllMocks(); jest.useFakeTimers(); jest.setSystemTime(start);
  mockStatus = { tier: 'plus', isActive: true, expiryDate: new Date(start + 60000).toISOString(), willRenew: false };
  refresh.mockResolvedValue({ tier: 'free', isActive: false });
  cached.mockResolvedValue(mockStatus);
  sync.mockRejectedValue(new Error('offline'));
});
afterEach(() => { jest.useRealTimers(); });

// Store/browser journeys cannot hold a cached entitlement unchanged while advancing
// a day and failing both subscription/backend refreshes without a real purchase.
it('keeps the expiry+1min refresh and ends local24h quota allowance even when RevenueCat stays cached offline', async () => {
  refresh.mockRejectedValue(new Error('RevenueCat offline'));
  const updates = jest.fn();
  const { result, unmount } = renderHook(() => {
    useSubscriptionExpiryTimer({ status: mockStatus, userId: mockUser.id, onStatusChange: updates });
    return useQuota();
  });
  await act(async () => { jest.advanceTimersByTime(120000 - 1); });
  expect(refresh).not.toHaveBeenCalled();
  await act(async () => { jest.advanceTimersByTime(1); });
  expect(refresh).toHaveBeenCalledTimes(1);
  expect(updates).toHaveBeenLastCalledWith(mockStatus);
  expect(mockStatus.tier).toBe('plus');
  expect(result.current.tier).toBe('plus');
  await act(async () => { jest.advanceTimersByTime(24 * hour - 60000); });
  expect(result.current.tier).toBe('plus');
  await act(async () => { jest.advanceTimersByTime(1); });
  expect(result.current.tier).toBe('free');
  expect(result.current.canGenerateImageNow).toBe(false);
  expect(mockStatus.tier).toBe('plus');
  unmount();
});

it('retries unavailable expiry refresh after5min and applies a later confirmed free status', async () => {
  refresh.mockRejectedValue(new Error('offline'));
  cached.mockRejectedValue(new Error('cache unavailable'));
  const updates = jest.fn();
  const { unmount } = renderHook(() => useSubscriptionExpiryTimer({ status: mockStatus, userId: mockUser.id, onStatusChange: updates }));
  await act(async () => { jest.advanceTimersByTime(120000); });
  expect(refresh).toHaveBeenCalledTimes(1);
  expect(updates).not.toHaveBeenCalled();
  refresh.mockResolvedValue({ tier: 'free', isActive: false });
  await act(async () => { jest.advanceTimersByTime(5 * 60000 - 1); });
  expect(refresh).toHaveBeenCalledTimes(1);
  await act(async () => { jest.advanceTimersByTime(1); });
  expect(updates).toHaveBeenLastCalledWith({ tier: 'free', isActive: false });
  unmount();
});

it('delivers a scheduled result to the latest committed callback and releases work on unmount', async () => {
  const first = jest.fn(), replacement = jest.fn();
  const { rerender, unmount } = renderHook(({ callback }) => useSubscriptionExpiryTimer({ status: mockStatus, onStatusChange: callback }),
    { initialProps: { callback: first } });
  rerender({ callback: replacement });
  await act(async () => { jest.advanceTimersByTime(120000); });
  expect(first).not.toHaveBeenCalled();
  expect(replacement).toHaveBeenCalledWith({ tier: 'free', isActive: false });
  unmount();
  await act(async () => { jest.advanceTimersByTime(48 * hour); });
  expect(refresh).toHaveBeenCalledTimes(1);
});

it('replaces the pending expiry timer when an entitlement renews before its deadline', async () => {
  const updates = jest.fn();
  const { rerender, unmount } = renderHook(({ status }) => useSubscriptionExpiryTimer({ status, onStatusChange: updates }),
    { initialProps: { status: mockStatus } });
  const renewed = { ...mockStatus, expiryDate: new Date(start + hour).toISOString() };
  rerender({ status: renewed });
  await act(async () => { jest.advanceTimersByTime(120000); });
  expect(refresh).not.toHaveBeenCalled();
  await act(async () => { jest.advanceTimersByTime(hour - 60000); });
  expect(refresh).toHaveBeenCalledTimes(1);
  unmount();
});
