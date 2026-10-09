import { Directory, File, Paths } from 'expo-file-system';

import { fetchJSON } from '@/lib/http';
import type { ExtendedSymbolContent, SymbolLanguage } from '@/lib/symbolTypes';

export type ExtendedSymbolContentMap = Record<string, ExtendedSymbolContent>;

// Published by the marketing site build (scripts/docs-build.js) from the same
// sources as data/app/. Bundling all six languages cost about 1 MB of every
// download; the reader's language is ~160 KB over the wire, fetched once.
export const SYMBOL_CONTENT_BASE_URL = 'https://noctalia.app/content/symbols';

const DIRECTORY_SEGMENT = 'symbol-content';
const DOWNLOAD_TIMEOUT_MS = 20_000;

const loaded = new Map<SymbolLanguage, ExtendedSymbolContentMap>();
const pending = new Map<SymbolLanguage, Promise<ExtendedSymbolContentMap>>();
const refreshedThisSession = new Set<SymbolLanguage>();

function isContentMap(value: unknown): value is ExtendedSymbolContentMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.values(value).every(
    (entry) => !!entry && typeof (entry as ExtendedSymbolContent).fullInterpretation === 'string',
  );
}

function cacheFile(language: SymbolLanguage): File {
  return new File(new Directory(Paths.document, DIRECTORY_SEGMENT), `${language}.json`);
}

async function download(language: SymbolLanguage): Promise<ExtendedSymbolContentMap> {
  const data = await fetchJSON<unknown>(`${SYMBOL_CONTENT_BASE_URL}/${language}.json`, {
    timeoutMs: DOWNLOAD_TIMEOUT_MS,
  });
  if (!isContentMap(data)) throw new Error(`Unexpected symbol content for ${language}`);

  new Directory(Paths.document, DIRECTORY_SEGMENT).create({ idempotent: true, intermediates: true });
  cacheFile(language).write(JSON.stringify(data));
  loaded.set(language, data);
  return data;
}

async function readCache(language: SymbolLanguage): Promise<ExtendedSymbolContentMap | undefined> {
  const file = cacheFile(language);
  if (!file.exists) return undefined;
  try {
    const data: unknown = JSON.parse(await file.text());
    return isContentMap(data) ? data : undefined;
  } catch {
    return undefined;
  }
}

async function readOrDownload(language: SymbolLanguage): Promise<ExtendedSymbolContentMap> {
  const cached = await readCache(language);
  if (!cached) {
    const data = await download(language);
    refreshedThisSession.add(language);
    return data;
  }

  loaded.set(language, cached);
  // Serve the copy on disk right away, and pick up site edits once per launch.
  if (!refreshedThisSession.has(language)) {
    refreshedThisSession.add(language);
    void download(language).catch(() => undefined);
  }
  return cached;
}

/** Content already in memory, so a revisited symbol renders without a loading pass. */
export function peekExtendedSymbolContent(language: SymbolLanguage): ExtendedSymbolContentMap | undefined {
  return loaded.get(language);
}

/**
 * Full interpretations and variations for one language. The first call downloads
 * them into the document directory; later launches read that copy, so the
 * dictionary keeps working offline after one connected visit.
 */
export function loadExtendedSymbolContent(language: SymbolLanguage): Promise<ExtendedSymbolContentMap> {
  const inMemory = loaded.get(language);
  if (inMemory) return Promise.resolve(inMemory);

  let request = pending.get(language);
  if (!request) {
    request = readOrDownload(language).finally(() => pending.delete(language));
    pending.set(language, request);
  }
  return request;
}
