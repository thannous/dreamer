import Constants from 'expo-constants';
import { supabase } from '@/lib/supabase';
import { getGuestMediaOwner } from '@/lib/guestSession';

const BUCKET = 'dream-images';
const PREFIX = `supabase-storage://${BUCKET}/`;
const TTL_SECONDS = 24 * 60 * 60;
const EXPIRY_MARGIN_MS = 60_000;
const BATCH_SIZE = 50;
const MAX_CACHE_ENTRIES = 256;

type Status = 'ready' | 'missing' | 'error';
type Resource = { url: string; status: Status; expiresAt?: number };
type Version = string | number | undefined;
export type DreamMediaInput = {
  imageUrl?: string | null;
  thumbnailUrl?: string | null;
  imageUpdatedAt?: number;
  analysisRequestId?: string;
  analyzedAt?: number;
};
export type DreamMediaResult = {
  imageUrl: string;
  thumbnailUrl?: string;
  imageStatus: Status;
  thumbnailStatus: Status;
  expiresAt?: number;
};
type SignedResponse = {
  data: { path?: string | null; signedUrl?: string; error?: unknown }[] | null;
  error: unknown;
};
type Options = {
  sign: (bucket: string, paths: string[], expiresIn: number) => Promise<SignedResponse>;
  now?: () => number;
  storageOrigin?: string;
  guestOwner?: () => Promise<string | null>;
};
type Entry = {
  path: string;
  version: Version;
  generation: number;
  promise: Promise<Resource>;
  complete: (resource: Resource) => void;
};
const configuredOrigin = process.env.EXPO_PUBLIC_SUPABASE_URL || Constants.expoConfig?.extra?.supabaseUrl;

/** Only public/external or local values may be displayed before asynchronous resolution. */
export function getDirectDreamMediaUrl(value?: string | null): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (!['https:', 'http:', 'file:', 'data:', 'blob:', 'content:'].includes(url.protocol)) return undefined;
    const ownOrigin = configuredOrigin ? new URL(configuredOrigin).origin : undefined;
    if (url.origin === ownOrigin && /^\/storage\/v1\/object\/(?:sign|public|authenticated)\/dream-images\//.test(url.pathname)) return undefined;
    return value;
  } catch { return undefined; }
}

const failed: Resource = { url: '', status: 'error' };

/** Private URLs live only in this bounded, account-scoped memory cache. */
export function createDreamMediaResolver({ sign, now = Date.now, storageOrigin, guestOwner }: Options) {
  let owner: string | null = null;
  let generation = 0;
  let active = 0;
  let scheduled = false;
  const pending = new Map<string, Entry>();
  const cache = new Map<string, { version: Version; resource: Resource; expiresAt: number }>();
  const queue: Entry[] = [];
  const counters = { batches: 0, signedPaths: 0, cacheHits: 0, deduplicated: 0, errors: 0 };
  let origin: string | undefined;
  try { origin = storageOrigin ? new URL(storageOrigin).origin : undefined; } catch { /* Unconfigured origin. */ }

  function parse(value: string): { path: string } | { direct: string } | null {
    let encoded: string;
    if (value.startsWith(PREFIX)) encoded = value.slice(PREFIX.length);
    else if (value.startsWith('supabase-storage:')) return null;
    else {
      try {
        const url = new URL(value);
        const match = url.pathname.match(/^\/storage\/v1\/object\/(?:sign|public|authenticated)\/dream-images\/(.*)$/);
        if (origin && url.origin === origin && match) encoded = match[1];
        else if (['https:', 'http:', 'file:', 'data:', 'blob:', 'content:'].includes(url.protocol)) return { direct: value };
        else return null;
      } catch { return null; }
    }
    try {
      const path = decodeURIComponent(encoded);
      const segments = path.split('/');
      if (segments.length < 2 || segments.some(part => !part || part === '.' || part === '..') || /[\\\u0000-\u001f]/.test(path)) return null;
      return { path };
    } catch { return null; }
  }

  function cancel(path: string) {
    cache.delete(path);
    const entry = pending.get(path);
    if (entry) {
      pending.delete(path);
      entry.complete(failed);
    }
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    void Promise.resolve().then(() => { scheduled = false; pump(); });
  }

  function pump() {
    while (active < 2 && queue.length) {
      const batch: Entry[] = [];
      while (batch.length < BATCH_SIZE && queue.length) {
        const entry = queue.shift()!;
        if (pending.get(entry.path) === entry && entry.generation === generation) batch.push(entry);
      }
      if (!batch.length) continue;
      active++;
      // Expiration starts at request dispatch, never at a delayed response receipt.
      const expiresAt = now() + TTL_SECONDS * 1000 - EXPIRY_MARGIN_MS;
      void Promise.resolve().then(() => {
        // Scope may change between scheduling this batch and starting its request.
        const current = batch.filter(entry => entry.generation === generation && pending.get(entry.path) === entry);
        if (!current.length) return { data: null, error: true } as SignedResponse;
        counters.batches++;
        counters.signedPaths += current.length;
        return sign(BUCKET, current.map(entry => entry.path), TTL_SECONDS);
      })
        .catch((): SignedResponse => ({ data: null, error: true }))
        .then(response => {
          const rows = new Map(response.data?.map(row => [row.path, row]));
          for (const entry of batch) {
            if (entry.generation !== generation || pending.get(entry.path) !== entry) continue;
            pending.delete(entry.path);
            const row = rows.get(entry.path);
            const resource: Resource = !response.error && !row?.error && row?.signedUrl && expiresAt > now()
              ? { url: row.signedUrl, status: 'ready', expiresAt } : failed;
            if (resource.status === 'ready') {
              cache.set(entry.path, { version: entry.version, resource, expiresAt });
              while (cache.size > MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value!);
            } else counters.errors++;
            entry.complete(resource);
          }
        }).finally(() => { active--; pump(); });
    }
  }

  async function resolve(value: string | null | undefined, userId: string | null, version?: Version, cacheOnly = false): Promise<Resource> {
    if (userId !== owner) return Promise.resolve(failed);
    if (!value) return Promise.resolve({ url: '', status: 'missing' });
    const parsed = parse(value);
    if (!parsed) return Promise.resolve(failed);
    if ('direct' in parsed) return Promise.resolve({ url: parsed.direct, status: 'ready' });
    const { path } = parsed;
    if (!owner) {
      // Guest objects cannot be re-signed with anonymous RLS. Preserve only this
      // device's existing server-signed capability, up to its actual expiry.
      const requestGeneration = generation;
      const localOwner = await guestOwner?.().catch(() => null);
      if (!localOwner || requestGeneration !== generation || owner !== null || path.split('/')[0] !== localOwner) return failed;
      try {
        const url = new URL(value);
        if (url.origin !== origin || !url.pathname.startsWith('/storage/v1/object/sign/dream-images/')) return failed;
        const encoded = url.searchParams.get('token')?.split('.')[1];
        if (!encoded) return failed;
        const payload = JSON.parse(atob(encoded.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(encoded.length / 4) * 4, '=')));
        const expiresAt = typeof payload.exp === 'number' ? payload.exp * 1000 - EXPIRY_MARGIN_MS : NaN;
        if (!Number.isFinite(expiresAt) || expiresAt <= now() || payload.url !== `${BUCKET}/${path}`) return failed;
        return { url: value, status: 'ready', expiresAt };
      } catch { return failed; }
    }
    if (path.split('/')[0] !== owner) return Promise.resolve(failed);
    const cached = cache.get(path);
    if (cached && cached.version === version && cached.expiresAt > now()) {
      counters.cacheHits++;
      cache.delete(path);
      cache.set(path, cached);
      return Promise.resolve(cached.resource);
    }
    if (cacheOnly) return failed;
    if (cached) cache.delete(path);
    const existing = pending.get(path);
    if (existing && existing.version === version) {
      counters.deduplicated++;
      return existing.promise;
    }
    if (existing) cancel(path);
    let complete!: Entry['complete'];
    const promise = new Promise<Resource>(resolvePromise => { complete = resolvePromise; });
    const entry = { path, version, generation, promise, complete };
    pending.set(path, entry);
    queue.push(entry);
    schedule();
    return promise;
  }

  return {
    setDreamMediaScope(userId: string | null) {
      if (userId === owner) return;
      owner = userId;
      generation++;
      cache.clear();
      pending.forEach(entry => entry.complete(failed));
      pending.clear();
      queue.length = 0;
    },
    invalidateDreamMedia(value?: string) {
      if (value === undefined) {
        cache.clear();
        pending.forEach(entry => entry.complete(failed));
        pending.clear();
        queue.length = 0;
      } else {
        const parsed = parse(value);
        if (parsed && 'path' in parsed) cancel(parsed.path);
      }
    },
    async resolveDreamMedia(dream: DreamMediaInput, userId: string | null, options?: { cacheOnly?: boolean }): Promise<DreamMediaResult> {
      const requestGeneration = generation;
      const version = dream.imageUpdatedAt ?? dream.analysisRequestId ?? dream.analyzedAt;
      const [image, thumbnail] = await Promise.all([
        resolve(dream.imageUrl, userId, version, options?.cacheOnly),
        resolve(dream.thumbnailUrl, userId, version, options?.cacheOnly),
      ]);
      if (requestGeneration !== generation || userId !== owner) {
        return { imageUrl: '', imageStatus: 'error', thumbnailStatus: 'error' };
      }
      const expirations = [image.expiresAt, thumbnail.expiresAt].filter((value): value is number => value !== undefined);
      return {
        imageUrl: image.url, thumbnailUrl: thumbnail.url || undefined,
        imageStatus: image.status, thumbnailStatus: thumbnail.status,
        ...(expirations.length ? { expiresAt: Math.min(...expirations) } : {}),
      };
    },
    getDreamMediaMetrics: () => ({ ...counters, cacheEntries: cache.size, pendingPaths: pending.size, activeBatches: active }),
  };
}

const resolver = createDreamMediaResolver({
  storageOrigin: configuredOrigin,
  guestOwner: getGuestMediaOwner,
  sign: (bucket, paths, expiresIn) => supabase.storage.from(bucket).createSignedUrls(paths, expiresIn),
});
export const { resolveDreamMedia, setDreamMediaScope, invalidateDreamMedia, getDreamMediaMetrics } = resolver;
