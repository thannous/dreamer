/**
 * Store/RevenueCat error classification shared by the subscription hook and
 * purchase analytics. Pure functions only: no logging, no side effects.
 */
import type { PurchaseFailureReason } from '@/lib/analytics';

export type RevenueCatLikeError = Error & {
  userCancelled?: boolean;
  code?: string | number;
};

export type { PurchaseFailureReason };

/**
 * RevenueCat signals a user-initiated cancellation through several shapes
 * depending on SDK version and platform: a `userCancelled` flag, string codes,
 * or the numeric code `1`.
 */
export function isUserCancelledError(e: unknown): boolean {
  if (typeof e !== 'object' || e === null) return false;
  const error = e as RevenueCatLikeError;

  if (error.userCancelled === true) return true;
  if (error.code === 'PURCHASE_CANCELLED_ERROR') return true;
  if (error.code === 'PurchaseCancelledError') return true;
  if (error.code === 'USER_CANCELED') return true;
  const numericCode = typeof error.code === 'string' ? Number.parseInt(error.code, 10) : error.code;
  if (numericCode === 1) return true;

  return false;
}

/**
 * Buckets a purchase/restore failure into a categorical, content-free reason
 * suitable for product analytics.
 */
export function classifyPurchaseFailure(e: unknown): PurchaseFailureReason {
  if (isUserCancelledError(e)) return 'cancelled';
  if (!(e instanceof Error)) return 'unknown';

  const message = e.message.toLowerCase();
  if (message === 'auth_required' || message.includes('not logged in') || message.includes('user not identified')) {
    return 'auth_required';
  }
  if (message.includes('network_error') || message.includes('networkerror') || message.includes('network')) {
    return 'network';
  }
  if (
    message.includes('item_unavailable') ||
    message.includes('productnotavailableforpurchase') ||
    message.includes('billing_unavailable') ||
    message.includes('service_unavailable') ||
    message.includes('receipt_already_in_use') ||
    message.includes('receipt already in use') ||
    message.includes('purchaseerror') ||
    message.includes('purchases not initialized') ||
    message.includes('store')
  ) {
    return 'store';
  }
  return 'unknown';
}
