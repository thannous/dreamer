import { renderHook, waitFor } from '@testing-library/react-native';
import React from 'react';

import { SubscriptionProvider, useSubscription } from '@/context/SubscriptionContext';
import { SESSION_BY_ID } from '@/content/sessions';
import * as subscriptions from '@/services/subscriptionService';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@/context/LibraryContext', () => ({
  useLibrary: () => ({ practiceLog: [] }),
}));

jest.mock('@/lib/env', () => ({
  areSubscriptionsEnabled: () => false,
}));

jest.mock('@/services/subscriptionService', () => ({
  configure: jest.fn(),
  currentTier: jest.fn(),
}));

describe('subscription audit mode', () => {
  beforeEach(() => jest.clearAllMocks());

  it('grants full access without initialising or opening the subscription store', async () => {
    const wrapper = ({ children }: React.PropsWithChildren) => (
      <SubscriptionProvider>{children}</SubscriptionProvider>
    );
    const { result } = renderHook(() => useSubscription(), { wrapper });

    await waitFor(() => expect(result.current.loaded).toBe(true));

    expect(result.current.subscriptionsEnabled).toBe(false);
    expect(result.current.isPlus).toBe(true);
    expect(result.current.remainingPlays).toBe(Number.POSITIVE_INFINITY);
    expect(result.current.gateForSession(SESSION_BY_ID['dream-lucid'])).toEqual({ allowed: true });
    expect(result.current.gateForPattern('four-seven-eight')).toEqual({ allowed: true });
    expect(result.current.gateForTimer(30)).toEqual({ allowed: true });

    result.current.openPaywall('premium-session');

    expect(subscriptions.configure).not.toHaveBeenCalled();
    expect(subscriptions.currentTier).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });
});
