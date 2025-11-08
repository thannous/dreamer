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
