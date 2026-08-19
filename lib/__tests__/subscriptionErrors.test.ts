import { classifyPurchaseFailure, isUserCancelledError } from '@/lib/subscriptionErrors';

describe('subscriptionErrors', () => {
  it('detects RevenueCat user cancellations across SDK shapes', () => {
    expect(isUserCancelledError(Object.assign(new Error('x'), { userCancelled: true }))).toBe(true);
    expect(isUserCancelledError(Object.assign(new Error('x'), { code: 'PURCHASE_CANCELLED_ERROR' }))).toBe(true);
    expect(isUserCancelledError(Object.assign(new Error('x'), { code: '1' }))).toBe(true);
    expect(isUserCancelledError(Object.assign(new Error('x'), { code: 1 }))).toBe(true);
    expect(isUserCancelledError(new Error('NETWORK_ERROR'))).toBe(false);
    expect(isUserCancelledError(null)).toBe(false);
    expect(isUserCancelledError('cancelled')).toBe(false);
  });

  it('buckets purchase failures into categorical reasons', () => {
    expect(classifyPurchaseFailure(Object.assign(new Error('x'), { userCancelled: true }))).toBe('cancelled');
    expect(classifyPurchaseFailure(new Error('auth_required'))).toBe('auth_required');
    expect(classifyPurchaseFailure(new Error('User not identified'))).toBe('auth_required');
    expect(classifyPurchaseFailure(new Error('NETWORK_ERROR: timeout'))).toBe('network');
    expect(classifyPurchaseFailure(new Error('ITEM_UNAVAILABLE'))).toBe('store');
    expect(classifyPurchaseFailure(new Error('BILLING_UNAVAILABLE'))).toBe('store');
    expect(classifyPurchaseFailure(new Error('PurchaseError: something'))).toBe('store');
    expect(classifyPurchaseFailure(new Error('Purchases not initialized'))).toBe('store');
    expect(classifyPurchaseFailure(new Error('weird'))).toBe('unknown');
    expect(classifyPurchaseFailure(undefined)).toBe('unknown');
    expect(classifyPurchaseFailure('boom')).toBe('unknown');
  });
});
