import Constants from 'expo-constants';

import { getAccessToken } from './auth';
import { classifyError, ErrorType } from './errors';

export class HttpError<TBody = unknown> extends Error {
  public readonly name = 'HttpError';
  public readonly status: number;
  public readonly statusText: string;
  public readonly url: string;
  public readonly bodyText: string;
  public readonly body?: TBody;

  constructor(options: {
    status: number;
    statusText: string;
    url: string;
    bodyText: string;
    body?: TBody;
  }) {
    super(`HTTP ${options.status} ${options.statusText}: ${options.bodyText}`);
    this.status = options.status;
    this.statusText = options.statusText;
    this.url = options.url;
    this.bodyText = options.bodyText;
    this.body = options.body;
  }
}

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
  supabaseUrl?: string;
  supabaseFunctionJwt?: string;
};

function getSupabaseUrl(): string | undefined {
  const env = process?.env as Record<string, string> | undefined;
  const envUrl = env?.EXPO_PUBLIC_SUPABASE_URL;

  const extra = (Constants?.expoConfig as { extra?: ExpoExtra } | undefined)?.extra;
  const extraUrl = extra?.supabaseUrl;

  return envUrl || extraUrl;
}

function getSupabaseAnonKey(): string | undefined {
  const env = process?.env as Record<string, string> | undefined;
  const envKey = env?.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  const extra = (Constants?.expoConfig as { extra?: ExpoExtra } | undefined)?.extra;
  const extraKey = extra?.supabaseAnonKey;

  return envKey || extraKey;
}

/**
 * Optional override for Edge Functions when using publishable keys.
 * Edge Functions still expect a JWT-style bearer token. If your project
 * only exposes `sb_publishable_` keys, set EXPO_PUBLIC_SUPABASE_FUNCTION_JWT
 * to the legacy anon JWT from the Supabase dashboard to avoid 401s.
 */
function getSupabaseFunctionJwt(): string | undefined {
  const env = process?.env as Record<string, string> | undefined;
  const envJwt = env?.EXPO_PUBLIC_SUPABASE_FUNCTION_JWT;

  const extra = (Constants?.expoConfig as { extra?: ExpoExtra } | undefined)?.extra;
  const extraJwt = extra?.supabaseFunctionJwt;

  return envJwt || extraJwt || getSupabaseAnonKey();
}

const isLikelyJWT = (token?: string | null): token is string => {
  if (!token) return false;
  // Basic heuristic: JWTs have 3 dot-separated parts and often start with "ey"
  const parts = token.split('.');
  return parts.length === 3 && token.startsWith('ey');
};

const SUPABASE_HOSTS = (() => {
  const hosts = new Set<string>();
  const supabaseUrl = getSupabaseUrl();

  if (supabaseUrl) {
    try {
      const parsed = new URL(supabaseUrl);
      hosts.add(parsed.host);

      // Also allow the functions subdomain for the same project (e.g., xyz.functions.supabase.co)
      if (parsed.host.endsWith('.supabase.co')) {
        const fnHost = parsed.host.replace('.supabase.co', '.functions.supabase.co');
        hosts.add(fnHost);
      }
    } catch {
      // Ignore malformed Supabase URLs
    }
  }

  return hosts;
})();

function shouldAttachSupabaseAuth(targetUrl: string): boolean {
  try {
    const parsed = new URL(targetUrl, 'http://localhost');
    return SUPABASE_HOSTS.has(parsed.host);
  } catch {
    return false;
  }
}

function isSupabaseFunctionsUrl(targetUrl: string): boolean {
  try {
    const parsed = new URL(targetUrl, 'http://localhost');
    return parsed.host.endsWith('.functions.supabase.co');
  } catch {
    return false;
  }
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

    const allowSupabaseAuth = shouldAttachSupabaseAuth(url);
    const isFunctionRequest = allowSupabaseAuth && isSupabaseFunctionsUrl(url);

    // Attach Supabase access token if present and not explicitly overridden
    try {
      if (allowSupabaseAuth && !headers.Authorization) {
        const token = await getAccessToken();
        if (token) headers.Authorization = `Bearer ${token}`;
      }
      // Fallback to anon/legacy function key so public Supabase functions work for guests (prevents 401)
      if (allowSupabaseAuth) {
        const anonKey = isFunctionRequest ? getSupabaseFunctionJwt() : getSupabaseAnonKey();
        if (anonKey) {
          // Edge Functions expect an Authorization header even for guests.
          if (!headers.Authorization && (isFunctionRequest || isLikelyJWT(anonKey))) {
            headers.Authorization = `Bearer ${anonKey}`;
            if (__DEV__ && isFunctionRequest && !isLikelyJWT(anonKey)) {
              console.warn(
                '[HTTP] Supabase functions are using a publishable key; set EXPO_PUBLIC_SUPABASE_FUNCTION_JWT to the legacy anon JWT to avoid 401 errors.'
              );
            }
          }
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
      const bodyText = await res.text().catch(() => '');
      let body: unknown = undefined;
      const trimmed = bodyText.trim();
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
          body = JSON.parse(trimmed);
        } catch {
          body = undefined;
        }
      }
      throw new HttpError({
        status: res.status,
        statusText: res.statusText,
        url,
        bodyText,
        body,
      });
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
          // Exponential backoff with jitter to avoid thundering herd
          const jitter = 0.8 + Math.random() * 0.5; // 0.8-1.3 multiplier
          const delay = Math.min(
            retryDelay * Math.pow(2, attempt) * jitter,
            30000 // Cap at 30 seconds max
          );
          await sleep(delay);
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
