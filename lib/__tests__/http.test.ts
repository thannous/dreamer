import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

// Mock dependencies before importing the module
type AnyFunction = (...args: any[]) => any;
const typedJestFn = <T extends AnyFunction>() => jest.fn() as jest.MockedFunction<T>;

const mockGetAccessToken = typedJestFn<() => Promise<string | null>>();
const mockClassifyError = jest.fn();
const LEGACY_ANON_JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlc3QiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTc2MDg0NDUxMCwiZXhwIjoyMDc2NDIwNTEwfQ.signature';

jest.mock('../auth', () => ({
  getAccessToken: () => mockGetAccessToken(),
}));

jest.mock('../errors', () => ({
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

process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = LEGACY_ANON_JWT;

let fetchJSON: typeof import('../http').fetchJSON;


describe('http', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
    jest.doMock('expo-constants', () => ({
      __esModule: true,
      default: {
        expoConfig: {
          extra: {
            supabaseUrl: 'https://test.supabase.co',
            supabaseAnonKey: LEGACY_ANON_JWT,
          },
        },
      },
    }));
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = LEGACY_ANON_JWT;
    mockGetAccessToken.mockResolvedValue(null);
    mockClassifyError.mockReturnValue({ type: 'unknown', canRetry: true });
    ({ fetchJSON } = require('../http'));
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.resetAllMocks();
    global.fetch = originalFetch;
  });

  describe('fetchJSON', () => {
    it('given successful response when fetching then returns JSON data', async () => {
      const mockData = { result: 'success' };
      global.fetch = jest.fn().mockResolvedValue({
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
      global.fetch = jest.fn().mockResolvedValue({
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
      global.fetch = jest.fn().mockResolvedValue({
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

    it('given HTTP error when fetching then throws without leaking body in message', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: () => Promise.resolve('Resource not found'),
      });

      await expect(fetchJSON('https://api.example.com/data')).rejects.toThrow('HTTP 404 Not Found');
    });

    it('given 204 response when fetching then returns undefined', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 204,
        statusText: 'No Content',
        headers: {
          get: () => null,
        },
        text: () => Promise.resolve(''),
      });

      const result = await fetchJSON('https://api.example.com/data');

      expect(result).toBeUndefined();
    });

    it('given successful empty body when fetching then returns undefined', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          get: (name: string) => (name.toLowerCase() === 'content-length' ? '0' : null),
        },
        text: () => Promise.resolve(''),
      });

      const result = await fetchJSON('https://api.example.com/data');

      expect(result).toBeUndefined();
    });

    it('given non-json success body when fetching then throws invalid json error', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          get: (name: string) => (name.toLowerCase() === 'content-type' ? 'text/plain' : null),
        },
        text: () => Promise.resolve('plain text body'),
      });

      await expect(fetchJSON('https://api.example.com/data')).rejects.toThrow('Invalid JSON response');
    });

    it('given Supabase URL with an auth token when fetching then attaches auth and apikey headers', async () => {
      mockGetAccessToken.mockResolvedValue('user-access-token');
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await fetchJSON('https://test.supabase.co/rest/v1/dreams');

      const request = (global.fetch as any).mock.calls[0][1];
      expect(request.headers.Authorization).toBe('Bearer user-access-token');
      expect(request.headers.apikey).toBe(LEGACY_ANON_JWT);
    });

    it('given insecure Supabase URL when fetching then skips auth headers', async () => {
      mockGetAccessToken.mockResolvedValue('user-access-token');
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await fetchJSON('http://test.supabase.co/rest/v1/dreams');

      const request = (global.fetch as any).mock.calls[0][1];
      expect(request.headers.Authorization).toBeUndefined();
      expect(request.headers.apikey).toBeUndefined();
    });

    it('given the local backend on a private address when fetching then attaches auth in development only', async () => {
      const localBackend = 'http://192.168.1.9:31300';
      process.env.EXPO_PUBLIC_SUPABASE_URL = localBackend;
      jest.doMock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra: {} } } }));
      mockGetAccessToken.mockResolvedValue('user-access-token');
      global.fetch = jest.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
      const runtime = globalThis as unknown as { __DEV__: boolean };
      const wasDev = runtime.__DEV__;
      try {
        runtime.__DEV__ = true;
        jest.resetModules();
        await require('../http').fetchJSON(`${localBackend}/rest/v1/dreams`);
        expect((global.fetch as any).mock.calls[0][1].headers.Authorization).toBe('Bearer user-access-token');
        // A release build never sends a session token in cleartext beyond loopback.
        runtime.__DEV__ = false;
        jest.resetModules();
        await require('../http').fetchJSON(`${localBackend}/rest/v1/dreams`);
        expect((global.fetch as any).mock.calls[1][1].headers.Authorization).toBeUndefined();
      } finally {
        runtime.__DEV__ = wasDev;
      }
    });

    it('given Supabase URL without user auth token when fetching then falls back to anon apikey only', async () => {
      mockGetAccessToken.mockResolvedValue(null);
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await fetchJSON('https://test.supabase.co/rest/v1/dreams');

      const request = (global.fetch as any).mock.calls[0][1];
      expect(request.headers.Authorization).toBeUndefined();
      expect(request.headers.apikey).toBe(LEGACY_ANON_JWT);
    });

    it('given Supabase auth URL without user auth token when fetching then does not send anon bearer', async () => {
      mockGetAccessToken.mockResolvedValue(null);
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await fetchJSON('https://test.supabase.co/auth/v1/user');

      const request = (global.fetch as any).mock.calls[0][1];
      expect(request.headers.Authorization).toBeUndefined();
      expect(request.headers.apikey).toBe(LEGACY_ANON_JWT);
    });

    it('given Supabase function URL without user auth token when fetching then sends function bearer', async () => {
      mockGetAccessToken.mockResolvedValue(null);
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await fetchJSON('https://test.functions.supabase.co/api/quota/status', {
        method: 'POST',
        body: {},
      });

      const request = (global.fetch as any).mock.calls[0][1];
      expect(request.headers.Authorization).toBe(`Bearer ${LEGACY_ANON_JWT}`);
      expect(request.headers.apikey).toBe(LEGACY_ANON_JWT);
    });

    it('given non-Supabase URL when fetching then does not attach Supabase auth', async () => {
      global.fetch = jest.fn().mockResolvedValue({
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
      global.fetch = jest.fn().mockImplementation(() => {
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

      await jest.runAllTimersAsync();

      const result = await resultPromise;
      expect(result).toEqual({ success: true });
      expect(callCount).toBe(2);
    });

    it('given server error with retries when fetching then retries the request', async () => {
      mockClassifyError.mockReturnValue({ type: 'server', canRetry: true });

      let callCount = 0;
      global.fetch = jest.fn().mockImplementation(() => {
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
      await jest.runAllTimersAsync();

      const result = await resultPromise;
      expect(result).toEqual({ recovered: true });
      expect(callCount).toBe(3);
    });

    it('given timeout error with retries when fetching then retries the request', async () => {
      mockClassifyError.mockReturnValue({ type: 'timeout', canRetry: true });

      let callCount = 0;
      global.fetch = jest.fn().mockImplementation(() => {
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
      await jest.runAllTimersAsync();

      const result = await resultPromise;
      expect(result).toEqual({ data: 'recovered' });
      expect(callCount).toBe(2);
    });

    it('given client error when fetching then does not retry', async () => {
      mockClassifyError.mockReturnValue({ type: 'client', canRetry: false });

      global.fetch = jest.fn().mockRejectedValue(new Error('HTTP 400 Bad Request'));

      const resultPromise = fetchJSON('https://api.example.com/data', { retries: 3 });

      await expect(resultPromise).rejects.toThrow('HTTP 400 Bad Request');
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('retries a transient rate limit within the configured budget', async () => {
      mockClassifyError.mockReturnValue({ type: 'rate_limit', canRetry: true });
      global.fetch = jest.fn().mockRejectedValueOnce(new Error('HTTP 429'))
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ ok: true }) });
      const result = fetchJSON('https://api.example.com/data', { retries: 1 });
      await jest.runAllTimersAsync();
      await expect(result).resolves.toEqual({ ok: true });
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('retries unrecognized failures with exponential jitter and an unchanged request key', async () => {
      const random = jest.spyOn(Math, 'random').mockReturnValueOnce(0).mockReturnValueOnce(1);
      const times: number[] = [];
      global.fetch = jest.fn().mockImplementation(() => {
        times.push(Date.now());
        return times.length < 3 ? Promise.reject(new Error('Unrecognized failure'))
          : Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) });
      });
      try {
        const result = fetchJSON('https://api.example.com/analysis-jobs', {
          method: 'POST', body: { analysisRequestId: 'existing-key' }, retries: 2, retryDelay: 1000,
        });
        await jest.runAllTimersAsync();
        await result;
        expect(times.slice(1).map((time, i) => time - times[i])).toEqual([800, 2600]);
        for (const [, options] of (global.fetch as jest.Mock).mock.calls) {
          expect((options as RequestInit).body).toBe(JSON.stringify({ analysisRequestId: 'existing-key' }));
        }
      } finally { random.mockRestore(); }
    });

    it('never replays an unkeyed write even if a caller requests retries', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Unknown transport failure'));
      await expect(fetchJSON('https://api.example.com/analyzeDream', {
        method: 'POST', body: { transcript: 'A door.' }, retries: 3,
      })).rejects.toThrow('Unknown transport failure');
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('allows a POST explicitly declared read-only to recover from transient errors', async () => {
      global.fetch = jest.fn().mockRejectedValueOnce(new Error('Unknown transport failure'))
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ status: 'running' }) });
      const result = fetchJSON('https://api.example.com/analysis-jobs/status', {
        method: 'POST', body: { jobId: 'job' }, readOnly: true, retries: 1,
      });
      await jest.runAllTimersAsync();
      await expect(result).resolves.toEqual({ status: 'running' });
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it.each([10, 30])('respects the provider cooldown/probe wait of %s seconds with the same key', async (seconds: number) => {
      global.fetch = jest.fn().mockResolvedValueOnce({ ok: false, status: 503, statusText: 'Unavailable',
        json: () => Promise.resolve({ code: 'ANALYSIS_PROVIDER_UNAVAILABLE', retryAfter: seconds }),
      }).mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ ok: true }) });
      const result = fetchJSON('https://api.example.com/analyzeDream', {
        method: 'POST', body: { analysisRequestId: 'same-key' }, retries: 1, retryDelay: 1000,
      });
      await jest.advanceTimersByTimeAsync(seconds * 1000 - 1);
      expect(global.fetch).toHaveBeenCalledTimes(1);
      await jest.advanceTimersByTimeAsync(1);
      await expect(result).resolves.toEqual({ ok: true });
      expect(global.fetch).toHaveBeenCalledTimes(2);
      for (const [, options] of (global.fetch as jest.Mock).mock.calls) {
        expect((options as RequestInit).body).toBe(JSON.stringify({ analysisRequestId: 'same-key' }));
      }
    });

    it('preserves retries for an explicitly idempotent reconciliation mutation', async () => {
      global.fetch = jest.fn().mockRejectedValueOnce(new Error('Unknown transport failure'))
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ ok: true }) });
      const result = fetchJSON('https://api.example.com/subscription/refresh', {
        method: 'POST', body: { source: 'app_launch' }, idempotent: true, retries: 1,
      });
      await jest.runAllTimersAsync();
      await expect(result).resolves.toEqual({ ok: true });
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('given all retries exhausted when fetching then throws last error', async () => {
      mockClassifyError.mockReturnValue({ type: 'network', canRetry: true });

      global.fetch = jest.fn().mockRejectedValue(new Error('Persistent network error'));

      const resultPromise = fetchJSON('https://api.example.com/data', { retries: 2 });

      const [result] = await Promise.allSettled([
        resultPromise,
        jest.runAllTimersAsync(),
      ]);

      expect(result.status).toBe('rejected');
      if (result.status === 'rejected') {
        expect(result.reason.message).toBe('Persistent network error');
      }
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('given no retries option when fetching then does not retry', async () => {
      mockClassifyError.mockReturnValue({ type: 'network', canRetry: true });

      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      await expect(fetchJSON('https://api.example.com/data')).rejects.toThrow('Network error');
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('given external abort with retries when aborted then stops retrying', async () => {
      const controller = new AbortController();
      global.fetch = jest.fn().mockImplementation((_url: RequestInfo | URL, options?: RequestInit) => {
        const abortSignal = (options as RequestInit).signal;
        return new Promise((_, reject) => {
          abortSignal?.addEventListener('abort', () => {
            reject(new Error('The operation was aborted'));
          });
        });
      });

      const resultPromise = fetchJSON('https://api.example.com/data', {
        retries: 2,
        signal: controller.signal,
      });

      controller.abort();

      await expect(resultPromise).rejects.toThrow('The operation was aborted');
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('given custom retry delay when fetching then uses custom delay', async () => {
      mockClassifyError.mockReturnValue({ type: 'network', canRetry: true });

      let callCount = 0;
      global.fetch = jest.fn().mockImplementation(() => {
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

      await jest.advanceTimersByTimeAsync(3000);
      expect(callCount).toBe(1);

      await jest.runAllTimersAsync();
      await resultPromise;
      expect(callCount).toBe(2);
    });
  });

  it('does not truncate an HTTP-date Retry-After that exceeds its replay budget', async () => {
    mockClassifyError.mockReturnValue({ type: 'rate_limit', canRetry: true });
    const deadline = new Date(Math.ceil(Date.now() / 1000) * 1000 + 600_000).toUTCString();
    global.fetch = jest.fn().mockResolvedValue({
      ok: false, status: 429, statusText: 'Too Many Requests',
      headers: { get: (key: string) => key.toLowerCase() === 'retry-after' ? deadline : null },
      json: async () => ({}),
    });
    await expect(fetchJSON('https://api.example.com/analysis-jobs', {
      method: 'POST', body: { analysisRequestId: 'same-key' }, retries: 1,
    })).rejects.toMatchObject({ status: 429, retryAfterMs: Date.parse(deadline) - Date.now() });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  it.each([
    ['AI_ACTOR_RATE_LIMIT', '1'], ['AI_GLOBAL_RATE_LIMIT', '2'],
    ['AI_ADMISSION_DENIED', '3'], ['OTHER_RATE_LIMIT', '540'],
  ])('returns 429 %s immediately with its original deadline', async (code: string, seconds: string) => {
    mockClassifyError.mockReturnValue({ type: 'rate_limit', canRetry: true });
    global.fetch = typedJestFn<AnyFunction>().mockResolvedValue({
      ok: false, status: 429, statusText: 'Too Many Requests',
      headers: { get: (key: string) => key.toLowerCase() === 'retry-after' ? seconds : null },
      json: async () => ({ code }),
    }) as typeof fetch;
    await expect(fetchJSON('https://api.example.com/analyzeDream', {
      method: 'POST', body: { analysisRequestId: 'same-key' }, retries: 1,
    })).rejects.toMatchObject({ status: 429, retryAfterMs: Number(seconds) * 1000 });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  it.each([false, true])('records whether a request left the device before consent withdrawal (sent=%s)', async (sent: boolean) => {
    const { wasHttpRequestDispatched } = require('../http') as typeof import('../http');
    const withdrawal = Object.assign(new Error('consent withdrawn'), { name: 'AiConsentWithdrawnError' });
    mockClassifyError.mockImplementation((error: Error) => ({ type: 'unknown', canRetry: error !== withdrawal }));
    global.fetch = jest.fn().mockRejectedValue(new TypeError('Reply lost'));
    let checks = 0;
    const result = fetchJSON('https://api.example.com/analysis-jobs', {
      method: 'POST', body: { analysisRequestId: 'stable-key' }, retries: 1, retryDelay: 1,
      beforeRequest: async () => { if (!sent || ++checks > 1) throw withdrawal; },
    }).catch(error => error);
    await jest.runAllTimersAsync();
    expect(await result).toBe(withdrawal);
    expect(global.fetch).toHaveBeenCalledTimes(sent ? 1 : 0);
    expect(wasHttpRequestDispatched(withdrawal)).toBe(sent);
  });

  describe('timeout handling', () => {
    it('given custom timeout when request takes too long then aborts', async () => {
      let abortSignal: AbortSignal | null | undefined;
      global.fetch = jest.fn().mockImplementation((_url: RequestInfo | URL, options?: RequestInit) => {
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
        jest.advanceTimersByTimeAsync(6000),
      ]);

      expect(result.status).toBe('rejected');
    });

    it('given external abort signal when aborted then rejects', async () => {
      let abortSignal: AbortSignal | null | undefined;
      global.fetch = jest.fn().mockImplementation((_url: RequestInfo | URL, options?: RequestInit) => {
        abortSignal = (options as RequestInit).signal;
        return new Promise((_, reject) => {
          abortSignal?.addEventListener('abort', () => {
            reject(new Error('The operation was aborted'));
          });
        });
      });

      const controller = new AbortController();
      const resultPromise = fetchJSON('https://api.example.com/slow', {
        signal: controller.signal,
      });

      controller.abort();

      await expect(resultPromise).rejects.toThrow('The operation was aborted');
    });
  });

  describe('HTTP methods', () => {
    beforeEach(() => {
      global.fetch = jest.fn().mockResolvedValue({
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
