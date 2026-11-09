/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';
import type { SubscriptionStatus } from '@/lib/types';
import { getSubscriptionStatus, refreshSubscriptionStatus } from '@/services/subscriptionService';
import { syncSubscriptionFromServer } from '@/services/subscriptionSyncService';
import { useQuota } from '../useQuota';
import { useSubscriptionExpiryTimer } from '../useSubscriptionExpiryTimer';
import { useSubscriptionMonitor } from '../useSubscriptionMonitor';

jest.mock('@/services/subscriptionService', () => ({ getSubscriptionStatus: jest.fn(), refreshSubscriptionStatus: jest.fn() }));
jest.mock('@/services/subscriptionSyncService', () => ({ syncSubscriptionFromServer: jest.fn() }));
jest.mock('@/lib/env', () => ({ isMockModeEnabled: () => false }));
let mockForeground: (() => Promise<void>) | undefined;
jest.mock('@/hooks/useAppState', () => ({ useAppState: (callback: () => Promise<void>) => { mockForeground = callback; } }));
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

it('does not publish a delayed expiry check to a different session of the same account', async () => {
  const updates = jest.fn();
  let finish!: (status: SubscriptionStatus) => void;
  refresh.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const { rerender } = renderHook(({ sessionKey, status }) =>
    useSubscriptionExpiryTimer({ sessionKey, status, userId: mockUser.id, onStatusChange: updates }),
  { initialProps: { sessionKey: 'old', status: mockStatus } });
  await act(async () => { jest.advanceTimersByTime(120000); });
  expect(refresh).toHaveBeenCalledTimes(1);
  rerender({ sessionKey: 'new', status: { tier: 'free', isActive: false } });
  await act(async () => { finish(mockStatus); });
  expect(updates).not.toHaveBeenCalled();
  expect(sync).not.toHaveBeenCalled();
});

it('does not redirect an in-flight foreground response to the new subscriber', async () => {
  const first = jest.fn(), second = jest.fn();
  let finish!: (status: SubscriptionStatus) => void;
  const hold = () => new Promise<SubscriptionStatus>(resolve => { finish = resolve; });
  cached.mockImplementationOnce(hold);
  refresh.mockImplementationOnce(hold);
  let active = true;
  const { rerender } = renderHook(({ callback, current }) => useSubscriptionMonitor(callback, true, () => current),
    { initialProps: { callback: first, current: () => active } });
  let oldRequest: Promise<void> | undefined;
  await act(async () => { oldRequest = mockForeground?.(); });
  active = false;
  rerender({ callback: second, current: () => true });
  await act(async () => { finish(mockStatus); await oldRequest; });
  expect(first).not.toHaveBeenCalled();
  expect(second).not.toHaveBeenCalled();
});
