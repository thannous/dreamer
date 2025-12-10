import { describe, expect, it, vi } from 'vitest';
import {
    canRetryError,
    classifyError,
    ErrorType,
    getUserErrorMessage,
    QuotaError,
    QuotaErrorCode,
    SubscriptionError,
    SubscriptionErrorCode,
} from '../errors';

describe('classifyError', () => {
  it('should classify network errors correctly', () => {
    const error = new Error('Network request failed');
    const result = classifyError(error);
    
    expect(result.type).toBe(ErrorType.NETWORK);
    expect(result.canRetry).toBe(true);
  });

  it('should classify fetch failed errors as network', () => {
    const error = new Error('Failed to fetch data');
    const result = classifyError(error);
    
    expect(result.type).toBe(ErrorType.NETWORK);
  });

  it('should classify timeout errors correctly', () => {
    const error = new Error('Request timeout exceeded');
    const result = classifyError(error);
    
    expect(result.type).toBe(ErrorType.TIMEOUT);
    expect(result.canRetry).toBe(true);
  });

  it('should classify aborted requests as timeout', () => {
    const error = new Error('Request was aborted');
    const result = classifyError(error);
    
    expect(result.type).toBe(ErrorType.TIMEOUT);
  });

  it('should classify rate limit errors correctly', () => {
    const error = new Error('HTTP 429 Too Many Requests');
    const result = classifyError(error);
    
    expect(result.type).toBe(ErrorType.RATE_LIMIT);
    expect(result.canRetry).toBe(true);
  });

  it('should classify server errors correctly', () => {
    const error = new Error('HTTP 500 Internal Server Error');
    const result = classifyError(error);
    
    expect(result.type).toBe(ErrorType.SERVER);
    expect(result.canRetry).toBe(true);
  });

  it('should classify client errors correctly', () => {
    const error = new Error('HTTP 400 Bad Request');
    const result = classifyError(error);
    
    expect(result.type).toBe(ErrorType.CLIENT);
    expect(result.canRetry).toBe(false);
  });

  it('should classify unknown errors correctly', () => {
    const error = new Error('Something unexpected happened');
    const result = classifyError(error);
    
    expect(result.type).toBe(ErrorType.UNKNOWN);
    expect(result.canRetry).toBe(true);
  });

  it('should preserve original error', () => {
    const error = new Error('Test error');
    const result = classifyError(error);
    
    expect(result.originalError).toBe(error);
    expect(result.message).toBe('Test error');
  });
});

describe('classifyError with i18n', () => {
  it('should use translation function when provided', () => {
    const mockTranslate = vi.fn().mockReturnValue('Translated network error');
    const error = new Error('Network request failed');
    
    const result = classifyError(error, mockTranslate);
    
    expect(mockTranslate).toHaveBeenCalledWith('error.network');
    expect(result.userMessage).toBe('Translated network error');
  });

  it('should fall back to default message when translation returns key', () => {
    const mockTranslate = vi.fn().mockImplementation((key) => key);
    const error = new Error('Network request failed');
    
    const result = classifyError(error, mockTranslate);
    
    expect(result.userMessage).toBe('No internet connection. Please check your network and try again.');
  });

  it('should translate timeout errors', () => {
    const mockTranslate = vi.fn().mockReturnValue('Délai dépassé');
    const error = new Error('Request timeout');
    
    const result = classifyError(error, mockTranslate);
    
    expect(mockTranslate).toHaveBeenCalledWith('error.timeout');
    expect(result.userMessage).toBe('Délai dépassé');
  });

  it('should translate rate limit errors', () => {
    const mockTranslate = vi.fn().mockReturnValue('Trop de requêtes');
    const error = new Error('HTTP 429');
    
    const result = classifyError(error, mockTranslate);
    
    expect(mockTranslate).toHaveBeenCalledWith('error.rate_limit');
    expect(result.userMessage).toBe('Trop de requêtes');
  });
});

describe('getUserErrorMessage', () => {
  it('should return user-friendly message', () => {
    const error = new Error('Network failed');
    const message = getUserErrorMessage(error);
    
    expect(message).toBe('No internet connection. Please check your network and try again.');
  });

  it('should use translation function when provided', () => {
    const mockTranslate = vi.fn().mockReturnValue('Pas de connexion');
    const error = new Error('Network failed');
    
    const message = getUserErrorMessage(error, mockTranslate);
    
    expect(message).toBe('Pas de connexion');
  });
});

describe('canRetryError', () => {
  it('should return true for network errors', () => {
    const error = new Error('Network failed');
    expect(canRetryError(error)).toBe(true);
  });

  it('should return false for client errors', () => {
    const error = new Error('HTTP 400 Bad Request');
    expect(canRetryError(error)).toBe(false);
  });
});

describe('QuotaError', () => {
  it('should create error with correct code and tier', () => {
    const error = new QuotaError(QuotaErrorCode.ANALYSIS_LIMIT_REACHED, 'guest');
    
    expect(error.code).toBe(QuotaErrorCode.ANALYSIS_LIMIT_REACHED);
    expect(error.tier).toBe('guest');
    expect(error.name).toBe('QuotaError');
  });

  it('should generate default message for guest analysis limit', () => {
    const error = new QuotaError(QuotaErrorCode.ANALYSIS_LIMIT_REACHED, 'guest');
    
    expect(error.userMessage).toContain('2 analyses');
    expect(error.userMessage).toContain('guest mode');
  });

  it('should generate default message for free analysis limit', () => {
    const error = new QuotaError(QuotaErrorCode.ANALYSIS_LIMIT_REACHED, 'free');
    
    expect(error.userMessage).toContain('5 free analyses');
    expect(error.userMessage).toContain('premium');
  });

  it('should allow custom user message', () => {
    const customMessage = 'Custom quota message';
    const error = new QuotaError(QuotaErrorCode.ANALYSIS_LIMIT_REACHED, 'guest', customMessage);
    
    expect(error.userMessage).toBe(customMessage);
    expect(error.message).toBe(customMessage);
  });

  it('should set canUpgrade correctly', () => {
    const guestError = new QuotaError(QuotaErrorCode.ANALYSIS_LIMIT_REACHED, 'guest');
    const freeError = new QuotaError(QuotaErrorCode.ANALYSIS_LIMIT_REACHED, 'free');
    const premiumError = new QuotaError(QuotaErrorCode.ANALYSIS_LIMIT_REACHED, 'premium');

    expect(guestError.canUpgrade).toBe(true);
    expect(freeError.canUpgrade).toBe(true);
    expect(premiumError.canUpgrade).toBe(false);
  });

  describe('EXPLORATION_LIMIT_REACHED', () => {
    it('should generate message for guest exploration limit', () => {
      const error = new QuotaError(QuotaErrorCode.EXPLORATION_LIMIT_REACHED, 'guest');

      expect(error.userMessage).toContain('2 dreams');
      expect(error.userMessage).toContain('guest mode');
    });

    it('should generate message for free exploration limit', () => {
      const error = new QuotaError(QuotaErrorCode.EXPLORATION_LIMIT_REACHED, 'free');

      expect(error.userMessage).toContain('exploration limit');
      expect(error.userMessage).toContain('premium');
    });

    it('should generate message for premium exploration limit', () => {
      const error = new QuotaError(QuotaErrorCode.EXPLORATION_LIMIT_REACHED, 'premium');

      expect(error.userMessage).toBe('Exploration limit reached.');
    });
  });

  describe('MESSAGE_LIMIT_REACHED', () => {
    it('should generate message for guest message limit', () => {
      const error = new QuotaError(QuotaErrorCode.MESSAGE_LIMIT_REACHED, 'guest');

      expect(error.userMessage).toContain('20 messages');
      expect(error.userMessage).toContain('premium');
    });

    it('should generate message for free message limit', () => {
      const error = new QuotaError(QuotaErrorCode.MESSAGE_LIMIT_REACHED, 'free');

      expect(error.userMessage).toContain('20 messages');
      expect(error.userMessage).toContain('premium');
    });

    it('should generate message for premium message limit', () => {
      const error = new QuotaError(QuotaErrorCode.MESSAGE_LIMIT_REACHED, 'premium');

      expect(error.userMessage).toBe('Message limit reached.');
    });
  });

  describe('GUEST_LIMIT_REACHED', () => {
    it('should generate backward-compatible message', () => {
      const error = new QuotaError(QuotaErrorCode.GUEST_LIMIT_REACHED, 'guest');

      expect(error.userMessage).toContain('2 dreams');
      expect(error.userMessage).toContain('guest mode');
    });
  });
});

describe('SubscriptionError', () => {
  it('should create error with correct code', () => {
    const error = new SubscriptionError(SubscriptionErrorCode.PURCHASE_FAILED);

    expect(error.code).toBe(SubscriptionErrorCode.PURCHASE_FAILED);
    expect(error.name).toBe('SubscriptionError');
  });

  it('should generate default message for PURCHASE_FAILED', () => {
    const error = new SubscriptionError(SubscriptionErrorCode.PURCHASE_FAILED);

    expect(error.userMessage).toContain('Payment failed');
  });

  it('should generate default message for RESTORE_FAILED', () => {
    const error = new SubscriptionError(SubscriptionErrorCode.RESTORE_FAILED);

    expect(error.userMessage).toContain('could not restore');
  });

  it('should generate default message for NOT_ELIGIBLE', () => {
    const error = new SubscriptionError(SubscriptionErrorCode.NOT_ELIGIBLE);

    expect(error.userMessage).toContain('not eligible');
  });

  it('should generate default message for NOT_AVAILABLE', () => {
    const error = new SubscriptionError(SubscriptionErrorCode.NOT_AVAILABLE);

    expect(error.userMessage).toContain('not available');
  });

  it('should allow custom user message', () => {
    const customMessage = 'Custom subscription error';
    const error = new SubscriptionError(SubscriptionErrorCode.PURCHASE_FAILED, customMessage);

    expect(error.userMessage).toBe(customMessage);
    expect(error.message).toBe(customMessage);
  });
});
