/** @jest-environment jsdom */
import React, { Suspense } from 'react';
import { act, cleanup, render, renderHook } from '@testing-library/react';

import type { SubscriptionStatus } from '@/lib/types';
import { useSubscriptionCustomerInfoListener } from './useSubscriptionCustomerInfoListener';

let mockStatusListener: ((status: SubscriptionStatus) => void) | undefined;
const mockRemoveListener = jest.fn();
const mockAddListener = jest.fn((callback: (status: SubscriptionStatus) => void) => {
  mockStatusListener = callback;
  return mockRemoveListener;
});
jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
jest.mock('@/lib/env', () => ({ isMockModeEnabled: () => false }));
jest.mock('@/services/subscriptionService', () => ({
  isSubscriptionInitialized: () => true,
  addSubscriptionStatusUpdateListener: (callback: (status: SubscriptionStatus) => void) => mockAddListener(callback),
}));

const status: SubscriptionStatus = { tier: 'plus', isActive: true };

// Real billing E2E cannot deterministically interrupt a React commit while a
// native SDK callback arrives. Keep callback ownership and speculative renders
// isolated here; these mocks do not qualify a Store transaction.
describe('subscription status listener ownership', () => {
  beforeEach(() => { jest.clearAllMocks(); mockStatusListener = undefined; });
  afterEach(() => cleanup());

  it('keeps each mounted subscriber when they receive the same callback', () => {
    const callback = jest.fn();
    const first = renderHook(() => useSubscriptionCustomerInfoListener(callback));
    const second = renderHook(() => useSubscriptionCustomerInfoListener(callback));
    expect(mockAddListener).toHaveBeenCalledTimes(1);
    act(() => mockStatusListener?.(status));
    expect(callback).toHaveBeenCalledTimes(2);
    first.unmount();
    expect(mockRemoveListener).not.toHaveBeenCalled();
    act(() => mockStatusListener?.(status));
    expect(callback).toHaveBeenCalledTimes(3);
    second.unmount();
    expect(mockRemoveListener).toHaveBeenCalledTimes(1);
  });

  it('uses the latest committed callback and detaches when disabled', () => {
    const first = jest.fn();
    const second = jest.fn();
    const view = renderHook(({ callback, enabled }) => useSubscriptionCustomerInfoListener(callback, enabled), {
      initialProps: { callback: first, enabled: true },
    });
    view.rerender({ callback: second, enabled: true });
    act(() => mockStatusListener?.(status));
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith(status);
    view.rerender({ callback: second, enabled: false });
    second.mockClear();
    act(() => mockStatusListener?.(status));
    expect(second).not.toHaveBeenCalled();
  });

  it('does not publish the callback of a suspended, uncommitted render', () => {
    const committed = jest.fn();
    const speculative = jest.fn();
    const suspended = new Promise<void>(() => undefined);
    function Subscriber({ callback, suspend }: { callback: (next: SubscriptionStatus) => void; suspend: boolean }) {
      useSubscriptionCustomerInfoListener(callback);
      if (suspend) throw suspended;
      return null;
    }
    const view = render(<Suspense fallback={null}><Subscriber callback={committed} suspend={false} /></Suspense>);
    view.rerender(<Suspense fallback={null}><Subscriber callback={speculative} suspend /></Suspense>);
    act(() => mockStatusListener?.(status));
    expect(committed).toHaveBeenCalledWith(status);
    expect(speculative).not.toHaveBeenCalled();
  });
});
