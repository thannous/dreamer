import { Image, type ImageSource } from 'expo-image';
import { useState } from 'react';

import APP_MEDIA from '@/assets/remote/app-media.json';

/**
 * Paintings the app shows from the site's CDN instead of its bundle (owner decision,
 * 2026-10-29): today the full badge paintings, seen only on a card held open. Each is
 * published once under its SHA-256 by `npm run docs:media -- app-upload` and never
 * replaced nor deleted, so a URL stays valid for every installed version and the file can
 * be cached for good. The URL names the file only: no account, device or query.
 */
export const APP_MEDIA_ORIGIN = 'https://media.noctalia.app';

export type RemoteArtKey = keyof typeof APP_MEDIA;
type AppMediaEntry = readonly [sourcePath: string, bytes: number, sha256: string];

export function remoteArtUrl(key: RemoteArtKey): string {
  const [sourcePath, , sha256] = APP_MEDIA[key] as unknown as AppMediaEntry;
  return `${APP_MEDIA_ORIGIN}/app/v1/${sha256}${sourcePath.slice(sourcePath.lastIndexOf('.'))}`;
}

export type RemoteArt = {
  /** What to draw: the remote painting, else its bundled stand-in, else nothing. */
  source: ImageSource | number | null;
  /** The bundled stand-in, shown while the remote painting loads. */
  placeholder: number | undefined;
  onError: () => void;
};

/**
 * A painting served from the CDN with its bundled export as the stand-in: shown while the
 * remote file loads, and in its place once that fails (offline with nothing cached, or
 * unreachable). `source` is null once the bundled export fails too, so the caller can draw
 * its own. Without a key the bundled export is drawn directly.
 */
export function useRemoteArt(key: RemoteArtKey | null, bundled: number | null): RemoteArt {
  const [failed, setFailed] = useState<'remote' | 'all' | null>(null);
  const remote = key && !failed ? { uri: remoteArtUrl(key) } : null;
  return {
    source: remote ?? (failed === 'all' ? null : bundled),
    placeholder: remote ? bundled ?? undefined : undefined,
    onError: () => setFailed(remote ? 'remote' : 'all'),
  };
}

const prefetched = new Set<RemoteArtKey>();

/**
 * Warms expo-image's disk cache, under the same URLs the images ask for, with paintings
 * likely to be opened next. Offline it quietly does nothing and is tried again next time.
 */
export async function prefetchRemoteArt(keys: readonly RemoteArtKey[]): Promise<boolean> {
  const missing = [...new Set(keys)].filter((key) => !prefetched.has(key));
  if (!missing.length) return true;
  try {
    const done = await Image.prefetch(missing.map(remoteArtUrl), 'disk');
    if (done) missing.forEach((key) => prefetched.add(key));
    return done;
  } catch {
    return false;
  }
}
