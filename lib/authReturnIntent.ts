import type { Href } from 'expo-router';

import { getPendingAuthReturn, savePendingAuthReturn } from '@/services/storageService';

export const AUTH_RETURN_TTL_MS = 10 * 60 * 1000;
export type AuthReturnIntent = { destination: string; createdAt: number };

const DREAM_PATH = /^\/(journal|dream-chat)\/[1-9]\d*$/;
const SAFE_PATHS = new Set(['/recording', '/weekly-recap', '/explore', '/journal']);
const IDENTITY_PARAMS = new Set(['remoteId', 'clientRequestId', 'category', 'mode', 'messageId']);

/** Only app destinations, never auth callbacks, external URLs or action flags. */
export function normalizeAuthReturnDestination(value: unknown): string | null {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[\\\s]/.test(value)) return null;
  try {
    const url = new URL(value, 'https://noctalia.invalid');
    if (url.origin !== 'https://noctalia.invalid' || url.hash) return null;
    const path = url.pathname.replace(/^\/\(tabs\)(?=\/)/, '');
    if (!DREAM_PATH.test(path) && !SAFE_PATHS.has(path)) return null;
    if (DREAM_PATH.test(path) && !Number.isSafeInteger(Number(path.split('/').pop()))) return null;
    for (const [key, param] of url.searchParams) {
      if (!DREAM_PATH.test(path) || !IDENTITY_PARAMS.has(key) || url.searchParams.getAll(key).length !== 1) return null;
      if (!/^[a-zA-Z0-9_-]{1,128}$/.test(param)) return null;
      if (key === 'remoteId' && (!/^[1-9]\d*$/.test(param) || !Number.isSafeInteger(Number(param)))) return null;
    }
    return `${path}${url.search}`;
  } catch {
    return null;
  }
}

export function dreamAuthReturnDestination(
  screen: 'journal' | 'dream-chat',
  params: Record<string, unknown>
): string | null {
  if (typeof params.id !== 'string') return null;
  const query = new URLSearchParams();
  for (const key of IDENTITY_PARAMS) {
    const value = params[key];
    if (value !== undefined) {
      if (typeof value !== 'string') return null;
      query.set(key, value);
    }
  }
  const suffix = query.toString();
  return normalizeAuthReturnDestination(`/${screen}/${params.id}${suffix ? `?${suffix}` : ''}`);
}

export function parseAuthReturnIntent(raw: string | null, now = Date.now()): AuthReturnIntent | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<AuthReturnIntent>;
    const destination = normalizeAuthReturnDestination(value?.destination);
    if (!destination || typeof value.createdAt !== 'number' || !Number.isFinite(value.createdAt) || value.createdAt > now || now - value.createdAt >= AUTH_RETURN_TTL_MS) return null;
    return { destination, createdAt: value.createdAt };
  } catch {
    return null;
  }
}

type Snapshot = { intent: AuthReturnIntent | null; ready: boolean };
let snapshot: Snapshot = { intent: null, ready: false };
const listeners = new Set<() => void>();
let queue: Promise<unknown> = Promise.resolve();
let restoration: Promise<void> | null = null;

const publish = (intent: AuthReturnIntent | null) => {
  snapshot = { intent, ready: true };
  listeners.forEach((listener) => listener());
};

// Serialize restoration, replacement and acknowledgement. A late clear must
// never erase a newer link selected while authentication was in flight.
function serialize<T>(operation: () => Promise<T>): Promise<T> {
  const result = queue.then(operation, operation);
  queue = result.catch(() => undefined);
  return result;
}

export const getAuthReturnSnapshot = (): Snapshot => snapshot;
export function subscribeAuthReturn(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function restoreAuthReturnIntent(): Promise<void> {
  restoration ??= serialize(async () => {
    try {
      publish(parseAuthReturnIntent(await getPendingAuthReturn()));
    } catch (error) {
      // No deletion on storage failure. A new explicit request can still retry.
      publish(null);
      throw error;
    }
  });
  return restoration;
}

export function requestAuthReturn(destination: string): Promise<void> {
  const safe = normalizeAuthReturnDestination(destination);
  if (!safe) return Promise.reject(new Error('Invalid auth return destination'));
  return serialize(async () => {
    const intent = { destination: safe, createdAt: Date.now() };
    await savePendingAuthReturn(JSON.stringify(intent));
    publish(intent);
  });
}

export function completeAuthReturn(intent: AuthReturnIntent): Promise<void> {
  return serialize(async () => {
    if (snapshot.intent !== intent) return;
    await savePendingAuthReturn('null');
    publish(null);
  });
}

export function expireAuthReturn(intent: AuthReturnIntent): void {
  if (snapshot.intent === intent && Date.now() - intent.createdAt >= AUTH_RETURN_TTL_MS) {
    // The persisted timestamp is rejected on the next restore as well. Expiry
    // must not depend on storage being writable at this moment.
    publish(null);
  }
}

export function isAuthReturnObserved(
  intent: AuthReturnIntent,
  pathname: string,
  params: Record<string, unknown>
): boolean {
  const url = new URL(intent.destination, 'https://noctalia.invalid');
  return pathname.replace(/^\/\(tabs\)(?=\/)/, '') === url.pathname &&
    [...url.searchParams].every(([key, value]) => params[key] === value);
}

export const authReturnHref = (intent: AuthReturnIntent): Href => intent.destination as Href;
