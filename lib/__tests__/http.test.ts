import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock dependencies before importing the module
const mockGetAccessToken = vi.fn<() => Promise<string | null>>();
const mockClassifyError = vi.fn();

vi.mock('../auth', () => ({
  getAccessToken: () => mockGetAccessToken(),
}));

vi.mock('../errors', () => ({
  classifyError: (error: Error) => mockClassifyError(error),
  ErrorType: {
    NETWORK: 'network',
    TIMEOUT: 'timeout',
    RATE_LIMIT: 'rate_limit',
    SERVER: 'server',
    CLIENT: 'client',
    UNKNOWN: 'unknown',
  },
}));

vi.mock('expo-constants', () => ({
  default: {
    expoConfig: {
      extra: {
        supabaseUrl: 'https://test.supabase.co',
        supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test',
      },
    },
  },
}));

import { fetchJSON } from '../http';

describe('http', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.useFakeTimers();
    mockGetAccessToken.mockResolvedValue(null);
    mockClassifyError.mockReturnValue({ type: 'unknown', canRetry: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetAllMocks();
    global.fetch = originalFetch;
  });

  describe('fetchJSON', () => {
    it('given successful response when fetching then returns JSON data', async () => {
      const mockData = { result: 'success' };
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockData),
      });

      const result = await fetchJSON('https://api.example.com/data');

      expect(result).toEqual(mockData);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('given POST method when fetching then sends body as JSON', async () => {
      const requestBody = { name: 'test' };
      const responseData = { id: 1, name: 'test' };
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(responseData),
      });

      await fetchJSON('https://api.example.com/data', {
        method: 'POST',
        body: requestBody,
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/data',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(requestBody),
        })
      );
    });

    it('given custom headers when fetching then merges with default headers', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await fetchJSON('https://api.example.com/data', {
        headers: { 'X-Custom-Header': 'custom-value' },
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/data',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-Custom-Header': 'custom-value',
          }),
        })
      );
    });

    it('given HTTP error when fetching then throws with status and body text', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: () => Promise.resolve('Resource not found'),
      });

      await expect(fetchJSON('https://api.example.com/data')).rejects.toThrow(
        'HTTP 404 Not Found: Resource not found'
      );
    });

    it('given Supabase URL when fetching then attaches auth headers', async () => {
      mockGetAccessToken.mockResolvedValue('user-access-token');
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await fetchJSON('https://test.supabase.co/rest/v1/dreams');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://test.supabase.co/rest/v1/dreams',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer user-access-token',
            apikey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test',
          }),
        })
      );
    });

    it('given Supabase URL without auth token when fetching then uses anon key for apikey', async () => {
      mockGetAccessToken.mockResolvedValue(null);
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await fetchJSON('https://test.supabase.co/rest/v1/dreams');

      // The anon key in the mock ('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test') has only 2 parts,
      // so isLikelyJWT returns false and Authorization is not added.
      // But apikey header is still set.
      expect(global.fetch).toHaveBeenCalledWith(
        'https://test.supabase.co/rest/v1/dreams',
        expect.objectContaining({
          headers: expect.objectContaining({
            apikey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test',
          }),
        })
      );
    });

    it('given non-Supabase URL when fetching then does not attach Supabase auth', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await fetchJSON('https://external-api.com/data');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://external-api.com/data',
        expect.objectContaining({
          headers: expect.not.objectContaining({
            apikey: expect.any(String),
            Authorization: expect.stringContaining('Bearer'),
          }),
        })
      );
    });
  });

  describe('retry logic', () => {
    it('given network error with retries when fetching then retries the request', async () => {
      mockClassifyError.mockReturnValue({ type: 'network', canRetry: true });

      let callCount = 0;
      global.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount < 2) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });
      });

      const resultPromise = fetchJSON('https://api.example.com/data', { retries: 2 });

      await vi.runAllTimersAsync();

      const result = await resultPromise;
      expect(result).toEqual({ success: true });
      expect(callCount).toBe(2);
    });

    it('given server error with retries when fetching then retries the request', async () => {
      mockClassifyError.mockReturnValue({ type: 'server', canRetry: true });

      let callCount = 0;
      global.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          return Promise.reject(new Error('HTTP 500 Internal Server Error'));
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ recovered: true }),
        });
      });

      const resultPromise = fetchJSON('https://api.example.com/data', { retries: 3 });
      await vi.runAllTimersAsync();

      const result = await resultPromise;
      expect(result).toEqual({ recovered: true });
      expect(callCount).toBe(3);
    });

    it('given timeout error with retries when fetching then retries the request', async () => {
      mockClassifyError.mockReturnValue({ type: 'timeout', canRetry: true });

      let callCount = 0;
      global.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error('Request timeout'));
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: 'recovered' }),
        });
      });

      const resultPromise = fetchJSON('https://api.example.com/data', { retries: 1 });
      await vi.runAllTimersAsync();

      const result = await resultPromise;
      expect(result).toEqual({ data: 'recovered' });
      expect(callCount).toBe(2);
    });

    it('given client error when fetching then does not retry', async () => {
      mockClassifyError.mockReturnValue({ type: 'client', canRetry: false });

      global.fetch = vi.fn().mockRejectedValue(new Error('HTTP 400 Bad Request'));

      const resultPromise = fetchJSON('https://api.example.com/data', { retries: 3 });

      await expect(resultPromise).rejects.toThrow('HTTP 400 Bad Request');
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('given rate limit error when fetching then does not retry automatically', async () => {
      mockClassifyError.mockReturnValue({ type: 'rate_limit', canRetry: true });

      global.fetch = vi.fn().mockRejectedValue(new Error('HTTP 429 Too Many Requests'));

      const resultPromise = fetchJSON('https://api.example.com/data', { retries: 3 });

      await expect(resultPromise).rejects.toThrow('HTTP 429 Too Many Requests');
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('given all retries exhausted when fetching then throws last error', async () => {
      mockClassifyError.mockReturnValue({ type: 'network', canRetry: true });

      global.fetch = vi.fn().mockRejectedValue(new Error('Persistent network error'));

      const resultPromise = fetchJSON('https://api.example.com/data', { retries: 2 });

      const [result] = await Promise.allSettled([
        resultPromise,
        vi.runAllTimersAsync(),
      ]);

      expect(result.status).toBe('rejected');
      if (result.status === 'rejected') {
        expect(result.reason.message).toBe('Persistent network error');
      }
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('given no retries option when fetching then does not retry', async () => {
      mockClassifyError.mockReturnValue({ type: 'network', canRetry: true });

      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      await expect(fetchJSON('https://api.example.com/data')).rejects.toThrow('Network error');
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('given custom retry delay when fetching then uses custom delay', async () => {
      mockClassifyError.mockReturnValue({ type: 'network', canRetry: true });

      let callCount = 0;
      global.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });
      });

      const resultPromise = fetchJSON('https://api.example.com/data', {
        retries: 1,
        retryDelay: 5000,
      });

      await vi.advanceTimersByTimeAsync(3000);
      expect(callCount).toBe(1);

      await vi.runAllTimersAsync();
      await resultPromise;
      expect(callCount).toBe(2);
    });
  });

  describe('timeout handling', () => {
    it('given custom timeout when request takes too long then aborts', async () => {
      let abortSignal: AbortSignal | null | undefined;
      global.fetch = vi.fn().mockImplementation((_url, options) => {
        abortSignal = (options as RequestInit).signal;
        return new Promise((_, reject) => {
          abortSignal?.addEventListener('abort', () => {
            reject(new Error('The operation was aborted'));
          });
        });
      });

      const resultPromise = fetchJSON('https://api.example.com/slow', {
        timeoutMs: 5000,
      });

      const [result] = await Promise.allSettled([
        resultPromise,
        vi.advanceTimersByTimeAsync(6000),
      ]);

      expect(result.status).toBe('rejected');
    });
  });

  describe('HTTP methods', () => {
    beforeEach(() => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });

    it('given PUT method when fetching then uses PUT', async () => {
      await fetchJSON('https://api.example.com/data', { method: 'PUT', body: { id: 1 } });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ method: 'PUT' })
      );
    });

    it('given PATCH method when fetching then uses PATCH', async () => {
      await fetchJSON('https://api.example.com/data', { method: 'PATCH', body: { name: 'updated' } });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ method: 'PATCH' })
      );
    });

    it('given DELETE method when fetching then uses DELETE', async () => {
      await fetchJSON('https://api.example.com/data/1', { method: 'DELETE' });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    it('given no method when fetching then defaults to GET', async () => {
      await fetchJSON('https://api.example.com/data');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ method: 'GET' })
      );
    });
  });
});
