import Constants from 'expo-constants';

import { getAccessToken } from './auth';
import { classifyError, ErrorType } from './errors';

export type HttpOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
  retries?: number; // Number of automatic retries (default: 0)
  retryDelay?: number; // Delay between retries in ms (default: 2000)
};

/**
 * Sleep helper for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type ExpoExtra = {
  supabaseAnonKey?: string;
};

function getSupabaseAnonKey(): string | undefined {
  const env = process?.env as Record<string, string> | undefined;
  const envKey = env?.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  const extra = (Constants?.expoConfig as { extra?: ExpoExtra } | undefined)?.extra;
  const extraKey = extra?.supabaseAnonKey;

  return envKey || extraKey;
}

/**
 * Performs a single HTTP request
 */
async function fetchJSONOnce<T = unknown>(url: string, options: HttpOptions = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 30000);
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };

    // Attach Supabase access token if present and not explicitly overridden
    try {
      if (!headers.Authorization) {
        const token = await getAccessToken();
        if (token) headers.Authorization = `Bearer ${token}`;
      }
      // Fallback to anon key so public Supabase functions work for guests (prevents 401)
      if (!headers.Authorization) {
        const anonKey = getSupabaseAnonKey();
        if (anonKey) {
          headers.Authorization = `Bearer ${anonKey}`;
          if (!headers.apikey) headers.apikey = anonKey;
        }
      }
    } catch {
      // ignore token retrieval errors; proceed without auth
    }

    const res = await fetch(url, {
      method: options.method ?? 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    } as RequestInit);
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status} ${res.statusText}: ${text}`);
    }
    const json = (await res.json()) as T;
    return json;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Fetches JSON with automatic retry logic
 */
export async function fetchJSON<T = unknown>(url: string, options: HttpOptions = {}): Promise<T> {
  const retries = options.retries ?? 0;
  const retryDelay = options.retryDelay ?? 2000;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fetchJSONOnce<T>(url, options);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // If we have more retries left, check if we should retry
      if (attempt < retries) {
        const classified = classifyError(lastError);

        // Only retry on network, timeout, or server errors
        if (
          classified.type === ErrorType.NETWORK ||
          classified.type === ErrorType.TIMEOUT ||
          classified.type === ErrorType.SERVER
        ) {
          // Exponential backoff: delay * (attempt + 1)
          await sleep(retryDelay * (attempt + 1));
          continue;
        } else {
          // For other errors (rate limit, client errors), don't retry automatically
          throw lastError;
        }
      }
    }
  }

  // All retries exhausted, throw the last error
  throw lastError!;
}
