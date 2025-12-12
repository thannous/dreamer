// Error classification and user-friendly message generation for API errors

import { QUOTAS } from '@/constants/limits';

/**
 * Translation function type for i18n support
 */
export type TranslateFunction = (key: string, params?: Record<string, unknown>) => string;

/**
 * Default error messages (English fallback)
 */
const DEFAULT_ERROR_MESSAGES: Record<string, string> = {
  'error.network': 'No internet connection. Please check your network and try again.',
  'error.timeout': 'Request timed out. The server is taking too long to respond. Please try again.',
  'error.rate_limit': 'Too many requests. Please wait a moment and try again.',
  'error.server': 'Server error. The service is temporarily unavailable. Please try again in a few moments.',
  'error.client': 'Invalid request. Please check your input and try again.',
  'error.unknown': 'An unexpected error occurred.',
};

export enum ErrorType {
  NETWORK = 'network',
  TIMEOUT = 'timeout',
  RATE_LIMIT = 'rate_limit',
  SERVER = 'server',
  CLIENT = 'client',
  UNKNOWN = 'unknown',
}

export interface ClassifiedError {
  type: ErrorType;
  message: string;
  originalError: Error;
  userMessage: string;
  canRetry: boolean;
}

/**
 * Classifies an error and returns metadata about it.
 * Optionally accepts a translation function for i18n support.
 */
export function classifyError(error: Error, t?: TranslateFunction): ClassifiedError {
  const message = error.message.toLowerCase();
  const translate = (key: string, fallbackKey?: string): string => {
    if (t) {
      const translated = t(key);
      // If translation returns the key itself, use fallback
      if (translated !== key) return translated;
    }
    return DEFAULT_ERROR_MESSAGES[fallbackKey ?? key] ?? error.message;
  };

  // Network/connectivity errors
  if (
    message.includes('network') ||
    message.includes('fetch failed') ||
    message.includes('failed to fetch') ||
    message.includes('connection') ||
    message.includes('econnrefused') ||
    message.includes('enotfound')
  ) {
    return {
      type: ErrorType.NETWORK,
      message: error.message,
      originalError: error,
      userMessage: translate('error.network'),
      canRetry: true,
    };
  }

  // Timeout errors
  if (
    message.includes('timeout') ||
    message.includes('aborted') ||
    message.includes('abort')
  ) {
    return {
      type: ErrorType.TIMEOUT,
      message: error.message,
      originalError: error,
      userMessage: translate('error.timeout'),
      canRetry: true,
    };
  }

  // Rate limiting (429)
  if (message.includes('429') || message.includes('rate limit')) {
    return {
      type: ErrorType.RATE_LIMIT,
      message: error.message,
      originalError: error,
      userMessage: translate('error.rate_limit'),
      canRetry: true,
    };
  }

  // Server errors (500+)
  if (message.includes('http 5')) {
    return {
      type: ErrorType.SERVER,
      message: error.message,
      originalError: error,
      userMessage: translate('error.server'),
      canRetry: true,
    };
  }

  // Client errors (400-499 except 429)
  if (message.includes('http 4')) {
    return {
      type: ErrorType.CLIENT,
      message: error.message,
      originalError: error,
      userMessage: translate('error.client'),
      canRetry: false,
    };
  }

  // Unknown errors
  return {
    type: ErrorType.UNKNOWN,
    message: error.message,
    originalError: error,
    userMessage: `${translate('error.unknown')}: ${error.message}`,
    canRetry: true,
  };
}

/**
 * Gets a user-friendly error message from an error
 * @param error The error to get message from
 * @param t Optional translation function for i18n
 */
export function getUserErrorMessage(error: Error, t?: TranslateFunction): string {
  return classifyError(error, t).userMessage;
}

/**
 * Checks if an error can be retried
 * @param error The error to check
 * @param t Optional translation function (not used for retry check but kept for consistency)
 */
export function canRetryError(error: Error, t?: TranslateFunction): boolean {
  return classifyError(error, t).canRetry;
}

/**
 * Quota error codes
 */
export enum QuotaErrorCode {
  ANALYSIS_LIMIT_REACHED = 'ANALYSIS_LIMIT_REACHED',
  EXPLORATION_LIMIT_REACHED = 'EXPLORATION_LIMIT_REACHED',
  MESSAGE_LIMIT_REACHED = 'MESSAGE_LIMIT_REACHED',
  GUEST_LIMIT_REACHED = 'GUEST_LIMIT_REACHED', // Backward compatibility
}

/**
 * Custom error for quota violations
 */
export class QuotaError extends Error {
  public readonly code: QuotaErrorCode;
  public readonly tier: 'guest' | 'free' | 'premium';
  public readonly userMessage: string;
  public readonly canUpgrade: boolean;

  constructor(
    code: QuotaErrorCode,
    tier: 'guest' | 'free' | 'premium',
    userMessage?: string
  ) {
    super(userMessage || QuotaError.getDefaultMessage(code, tier));
    this.name = 'QuotaError';
    this.code = code;
    this.tier = tier;
    this.userMessage = userMessage || QuotaError.getDefaultMessage(code, tier);
    this.canUpgrade = tier !== 'premium';
  }

  private static getDefaultMessage(code: QuotaErrorCode, tier: 'guest' | 'free' | 'premium'): string {
    switch (code) {
      case QuotaErrorCode.ANALYSIS_LIMIT_REACHED:
        if (tier === 'guest') {
          return `You have reached the limit of ${QUOTAS.guest.analysis ?? 0} analyses in guest mode. Create a free account to get ${QUOTAS.free.analysis ?? 0} analyses per month!`;
        } else if (tier === 'free') {
          return `You have used all ${QUOTAS.free.analysis ?? 0} free analyses for this month. Upgrade to premium for unlimited analyses!`;
        }
        return 'Analysis limit reached.';

      case QuotaErrorCode.EXPLORATION_LIMIT_REACHED:
        if (tier === 'guest') {
          return `You have explored ${QUOTAS.guest.exploration ?? 0} dreams in guest mode. Create a free account to continue exploring!`;
        } else if (tier === 'free') {
          return `You have used all ${QUOTAS.free.exploration ?? 0} free dream explorations for this month. Upgrade to premium for unlimited dream exploration!`;
        }
        return 'Exploration limit reached.';

      case QuotaErrorCode.MESSAGE_LIMIT_REACHED:
        if (tier === 'guest' || tier === 'free') {
          const limit = tier === 'guest' ? QUOTAS.guest.messagesPerDream : QUOTAS.free.messagesPerDream;
          return `You have reached the limit of ${limit ?? 0} messages for this dream. Upgrade to premium for unlimited conversations!`;
        }
        return 'Message limit reached.';

      case QuotaErrorCode.GUEST_LIMIT_REACHED:
        return `You have reached the limit of ${QUOTAS.guest.exploration ?? 0} dreams in guest mode. Create a free account to continue!`;

      default:
        return 'Quota limit reached.';
    }
  }
}

export enum SubscriptionErrorCode {
  PURCHASE_FAILED = 'PURCHASE_FAILED',
  RESTORE_FAILED = 'RESTORE_FAILED',
  NOT_ELIGIBLE = 'NOT_ELIGIBLE',
  NOT_AVAILABLE = 'NOT_AVAILABLE',
}

export class SubscriptionError extends Error {
  public readonly code: SubscriptionErrorCode;
  public readonly userMessage: string;

  constructor(code: SubscriptionErrorCode, userMessage?: string) {
    const message = userMessage || SubscriptionError.getDefaultMessage(code);
    super(message);
    this.name = 'SubscriptionError';
    this.code = code;
    this.userMessage = message;
  }

  private static getDefaultMessage(code: SubscriptionErrorCode): string {
    switch (code) {
      case SubscriptionErrorCode.PURCHASE_FAILED:
        return 'Payment failed. Please try again or use a different payment method.';
      case SubscriptionErrorCode.RESTORE_FAILED:
        return 'We could not restore your purchases. Please try again later.';
      case SubscriptionErrorCode.NOT_ELIGIBLE:
        return 'You are not eligible for this subscription.';
      case SubscriptionErrorCode.NOT_AVAILABLE:
        return 'Subscriptions are not available on this device or platform.';
      default:
        return 'Subscription error.';
    }
  }
}
