import { getAccessToken } from './auth';

export type HttpOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
};

export async function fetchJSON<T = unknown>(url: string, options: HttpOptions = {}): Promise<T> {
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
