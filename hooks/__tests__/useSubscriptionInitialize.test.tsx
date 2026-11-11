/**
 * @jest-environment jsdom
 */
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockInitialize = jest.fn(async (_userId: string | null) => ({ tier: 'free', isActive: false }));
const mockRefreshUser = jest.fn(async () => null);
const mockSync = jest.fn(async () => ({ ok: true }));
const calls: string[] = [];

// One stable context value, as the real provider memoizes it: a new identity per render would rerun the hook.
const mockAuth = { user: { id: 'user-1' }, sessionGeneration: 1, isCurrentSession: () => true, refreshUser: mockRefreshUser };
jest.mock('@/context/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('@/services/subscriptionService', () => ({
  initializeSubscription: (userId: string | null) => mockInitialize(userId),
  isSubscriptionInitialized: () => false,
}));
jest.mock('@/services/subscriptionSyncService', () => ({
  syncSubscriptionFromServer: () => mockSync(),
}));

const { useSubscriptionInitialize } =
  require('../useSubscriptionInitialize') as typeof import('../useSubscriptionInitialize');

describe('useSubscriptionInitialize', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    calls.length = 0;
    mockInitialize.mockImplementation(async () => { calls.push('initialize'); return { tier: 'free', isActive: false }; });
    mockRefreshUser.mockImplementation(async () => { calls.push('refreshUser'); return null; });
  });

  it('links the store to the account and refreshes the user, leaving the server sync to the provider', async () => {
    const { result } = renderHook(() => useSubscriptionInitialize());

    await waitFor(() => expect(result.current.initialized).toBe(true));
    expect(mockInitialize).toHaveBeenCalledWith('user-1');
    expect(calls).toEqual(['initialize', 'refreshUser']);
    // The provider sends the one reconciliation and applies its answer; a second
    // request from here doubled the RevenueCat calls on every launch.
    expect(mockSync).not.toHaveBeenCalled();
  });

  it('does nothing until startup allows it', async () => {
    renderHook(() => useSubscriptionInitialize({ enabled: false }));
    await Promise.resolve();
    expect(mockInitialize).not.toHaveBeenCalled();
  });
});
