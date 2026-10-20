import { Directory, File, Paths } from 'expo-file-system';

import { fetchJSON } from '@/lib/http';
import { isSymbolAtlas, type SymbolAtlas } from '@/lib/symbolAtlas';

// Published by the marketing site build (scripts/docs-build.js) from the same sources as
// data/app/symbol-atlas.json, so a new batch of paintings reaches installed apps with a
// site publish. Its file name carries the format's version.
export const SYMBOL_ATLAS_URL = 'https://noctalia.app/content/symbols/atlas-v1.json';

const DIRECTORY_SEGMENT = 'symbol-content';
const DOWNLOAD_TIMEOUT_MS = 20_000;
// Every thumbnail asks for the atlas as it mounts, so after a failed download (offline, or
// a site that does not have the file yet) the next try waits instead of following the scroll.
const RETRY_AFTER_MS = 5 * 60_000;

// A development build reads the repository's copy until the site publishes its own, so a
// change can be tried on a phone before that publish. Release builds never bundle it.
const DEVELOPMENT_COPY: unknown = __DEV__ ? require('@/data/app/symbol-atlas.json') : undefined;

let atlas: SymbolAtlas | undefined;
let readDisk = false;
let refreshedThisSession = false;
let retryAt = 0;
const listeners = new Set<() => void>();

function cacheFile(): File {
  return new File(new Directory(Paths.document, DIRECTORY_SEGMENT), 'atlas-v1.json');
}

function publish(next: SymbolAtlas) {
  atlas = next;
  listeners.forEach((listener) => listener());
}

/**
 * The atlas known right now: in memory, else the copy on disk, read once and synchronously
 * so a list drawn after a previous visit shows its paintings from the first frame.
 */
export function peekSymbolAtlas(): SymbolAtlas | undefined {
  if (!atlas && !readDisk) {
    readDisk = true;
    try {
      const file = cacheFile();
      const data: unknown = file.exists ? JSON.parse(file.textSync()) : undefined;
      if (isSymbolAtlas(data)) atlas = data;
    } catch {
      // A damaged copy is replaced by the next download.
    }
    if (!atlas && isSymbolAtlas(DEVELOPMENT_COPY)) atlas = DEVELOPMENT_COPY;
  }
  return atlas;
}

export function subscribeSymbolAtlas(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Fetches the site's atlas once per launch and keeps it for offline visits. A failed
 * download leaves the copy already known (or none: every symbol stays classic) and is
 * tried again by a screen that asks a few minutes later.
 */
export async function loadSymbolAtlas(): Promise<SymbolAtlas | undefined> {
  peekSymbolAtlas();
  if (refreshedThisSession || Date.now() < retryAt) return atlas;
  refreshedThisSession = true;
  try {
    const data = await fetchJSON<unknown>(SYMBOL_ATLAS_URL, { timeoutMs: DOWNLOAD_TIMEOUT_MS });
    if (!isSymbolAtlas(data)) throw new Error('Unexpected symbol atlas');
    const text = JSON.stringify(data);
    if (!atlas || JSON.stringify(atlas) !== text) publish(data);
    try {
      new Directory(Paths.document, DIRECTORY_SEGMENT).create({ idempotent: true, intermediates: true });
      await cacheFile().write(text);
    } catch {
      // A full disk only costs the copy for next launch; this session keeps the download.
    }
  } catch {
    refreshedThisSession = false;
    retryAt = Date.now() + RETRY_AFTER_MS;
  }
  return atlas;
}
