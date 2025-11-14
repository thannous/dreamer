// Error classification and user-friendly message generation for API errors

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
 * Classifies an error and returns metadata about it
 */
export function classifyError(error: Error): ClassifiedError {
  const message = error.message.toLowerCase();

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
      userMessage: 'No internet connection. Please check your network and try again.',
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
      userMessage: 'Request timed out. The server is taking too long to respond. Please try again.',
      canRetry: true,
    };
  }

  // Rate limiting (429)
  if (message.includes('429') || message.includes('rate limit')) {
    return {
      type: ErrorType.RATE_LIMIT,
      message: error.message,
      originalError: error,
      userMessage: 'Too many requests. Please wait a moment and try again.',
      canRetry: true,
    };
  }

  // Server errors (500+)
  if (message.includes('http 5')) {
    return {
      type: ErrorType.SERVER,
      message: error.message,
      originalError: error,
      userMessage: 'Server error. The service is temporarily unavailable. Please try again in a few moments.',
      canRetry: true,
    };
  }

  // Client errors (400-499 except 429)
  if (message.includes('http 4')) {
    return {
      type: ErrorType.CLIENT,
      message: error.message,
      originalError: error,
      userMessage: 'Invalid request. Please check your input and try again.',
      canRetry: false,
    };
  }

  // Unknown errors
  return {
    type: ErrorType.UNKNOWN,
    message: error.message,
    originalError: error,
    userMessage: `An unexpected error occurred: ${error.message}`,
    canRetry: true,
  };
}

/**
 * Gets a user-friendly error message from an error
 */
export function getUserErrorMessage(error: Error): string {
  return classifyError(error).userMessage;
}

/**
 * Checks if an error can be retried
 */
export function canRetryError(error: Error): boolean {
  return classifyError(error).canRetry;
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
          return 'You have reached the limit of 2 analyses in guest mode. Create a free account to get 3 more analyses!';
        } else if (tier === 'free') {
          return 'You have used all 5 free analyses. Upgrade to premium for unlimited analyses!';
        }
        return 'Analysis limit reached.';

      case QuotaErrorCode.EXPLORATION_LIMIT_REACHED:
        if (tier === 'guest') {
          return 'You have explored 2 dreams in guest mode. Create a free account to continue exploring!';
        } else if (tier === 'free') {
          return 'You have reached the exploration limit. Upgrade to premium for unlimited dream exploration!';
        }
        return 'Exploration limit reached.';

      case QuotaErrorCode.MESSAGE_LIMIT_REACHED:
        if (tier === 'guest' || tier === 'free') {
          return 'You have reached the limit of 20 messages for this dream. Upgrade to premium for unlimited conversations!';
        }
        return 'Message limit reached.';

      case QuotaErrorCode.GUEST_LIMIT_REACHED:
        return 'You have reached the limit of 2 dreams in guest mode. Create a free account to continue!';

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
