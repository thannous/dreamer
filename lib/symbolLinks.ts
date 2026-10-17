import type { SymbolLanguage } from '@/lib/symbolTypes';
import type { DreamAnalysis, DreamSymbolInsight } from '@/lib/types';

/**
 * The threads between a dreamer's dreams: each symbol of a reading, followed through
 * the journal. A symbol the dictionary knows is linked by its id, the same in every
 * language; any other is the dreamer's own, linked by the key its analysis gave it.
 * Readings made before symbols carried a link fall back on their name.
 *
 * Pure and computed from the local journal, so links cost no request.
 */

export type SymbolKind = 'dictionary' | 'personal';

export type SymbolAppearance = { dream: DreamAnalysis; insight: DreamSymbolInsight };

export type LinkedSymbol = {
  /** `d:<dictionary id>`, `p:<personal key>` or, for an older reading, `n:<name>`. */
  linkKey: string;
  kind: SymbolKind;
  symbolId?: string;
  /** Set for a personal symbol named by a linking analysis; older readings have none. */
  personalKey?: string;
  /** The dictionary's name in the reader's language, otherwise the newest reading's. */
  name: string;
  /** Oldest first: the symbol's story through the journal. */
  appearances: SymbolAppearance[];
  /** The dreamer has opened this personal symbol at least once. */
  confirmed: boolean;
  /** Symbols seen in the same dreams, most often first. */
  companions: { linkKey: string; count: number }[];
};

export type SymbolIndex = {
  symbols: ReadonlyMap<string, LinkedSymbol>;
  /** Analyzed dreams that name at least one symbol: the "out of" of a symbol's count. */
  dreamCount: number;
};

export type SymbolStatus =
  | { kind: 'first' }
  | { kind: 'some'; count: number }
  | { kind: 'every'; count: number };

/** Personal symbols sent with an analysis request, as the API bounds them. */
export const MAX_KNOWN_SYMBOLS = 40;

const LEADING_ARTICLE = /^(?:the|a|an|le|la|les|l'|un|une|des|du|el|los|las|una|unos|unas|der|die|das|ein|eine|il|lo|gli|i|o|os|as|um|uma)\s+|^l'/;

const normalizeName = (name: string): string =>
  name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .trim()
    .replace(LEADING_ARTICLE, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

type DictionaryService = typeof import('@/services/symbolDictionaryService');
let dictionary: DictionaryService | null = null;

/** The dictionary is large: it loads with the first symbol to link, not with the app. */
const getDictionary = (): DictionaryService =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  (dictionary ??= require('@/services/symbolDictionaryService') as DictionaryService);

const getSymbolById = (id: string) => getDictionary().getSymbolById(id);

let dictionaryNames: Map<string, string> | null = null;

/** Every dictionary name in every language, so an older reading's "Cat" or "Chat" still links. */
const getDictionaryNames = (): Map<string, string> => {
  if (dictionaryNames) return dictionaryNames;
  dictionaryNames = new Map();
  for (const symbol of getDictionary().getAllSymbols()) {
    for (const language of ['en', 'fr', 'es', 'de', 'it', 'pt'] as const) {
      const name = normalizeName(symbol[language]?.name ?? '');
      if (name && !dictionaryNames.has(name)) dictionaryNames.set(name, symbol.id);
    }
  }
  return dictionaryNames;
};

/** Where a symbol of a reading leads, or null when it names nothing. */
export function symbolLinkKey(insight: Pick<DreamSymbolInsight, 'name' | 'symbolId' | 'key'>): string | null {
  if (insight.symbolId && getSymbolById(insight.symbolId)) return `d:${insight.symbolId}`;
  if (insight.key) return getSymbolById(insight.key) ? `d:${insight.key}` : `p:${insight.key}`;
  const name = normalizeName(insight.name ?? '');
  if (!name) return null;
  const dictionaryId = getDictionaryNames().get(name);
  return dictionaryId ? `d:${dictionaryId}` : `n:${name}`;
}

const isLinkableDream = (dream: DreamAnalysis): boolean =>
  typeof dream.id === 'number' && Boolean(dream.symbols?.length) && Boolean(dream.isAnalyzed || dream.analysisStatus === 'done');

/** One pass over the journal: every symbol with its appearances and companions. */
export function buildSymbolIndex(dreams: readonly DreamAnalysis[], language: SymbolLanguage): SymbolIndex {
  const symbols = new Map<string, LinkedSymbol>();
  const pairs = new Map<string, Map<string, number>>();
  let dreamCount = 0;
  const chronological = dreams.filter(isLinkableDream).sort((a, b) => a.id - b.id);

  for (const dream of chronological) {
    const inDream: string[] = [];
    for (const insight of dream.symbols ?? []) {
      const linkKey = symbolLinkKey(insight);
      if (!linkKey || inDream.includes(linkKey)) continue;
      inDream.push(linkKey);
      let symbol = symbols.get(linkKey);
      if (!symbol) {
        const symbolId = linkKey.startsWith('d:') ? linkKey.slice(2) : undefined;
        symbol = {
          linkKey,
          kind: symbolId ? 'dictionary' : 'personal',
          ...(symbolId ? { symbolId } : {}),
          ...(linkKey.startsWith('p:') ? { personalKey: linkKey.slice(2) } : {}),
          name: insight.name.trim(),
          appearances: [],
          confirmed: false,
          companions: [],
        };
        symbols.set(linkKey, symbol);
      }
      symbol.appearances.push({ dream, insight });
      // The newest reading names a personal symbol; the dictionary names its own.
      if (!symbol.symbolId) symbol.name = insight.name.trim();
      if (insight.confirmedAt) symbol.confirmed = true;
    }
    if (inDream.length) dreamCount += 1;
    for (const a of inDream) {
      for (const b of inDream) {
        if (a === b) continue;
        const counts = pairs.get(a) ?? new Map<string, number>();
        counts.set(b, (counts.get(b) ?? 0) + 1);
        pairs.set(a, counts);
      }
    }
  }

  for (const symbol of symbols.values()) {
    if (symbol.symbolId) {
      const entry = getSymbolById(symbol.symbolId);
      symbol.name = entry?.[language]?.name ?? entry?.en.name ?? symbol.name;
    }
    symbol.companions = [...(pairs.get(symbol.linkKey) ?? new Map<string, number>()).entries()]
      .map(([linkKey, count]) => ({ linkKey, count }))
      .sort((a, b) => b.count - a.count || a.linkKey.localeCompare(b.linkKey));
  }
  return { symbols, dreamCount };
}

const indexCache = new WeakMap<readonly DreamAnalysis[], Map<SymbolLanguage, SymbolIndex>>();

/**
 * The index of a journal, built once per journal state and language: the reading and the
 * pages drawn beside it share it.
 */
export function getSymbolIndex(dreams: readonly DreamAnalysis[], language: SymbolLanguage): SymbolIndex {
  let byLanguage = indexCache.get(dreams);
  if (!byLanguage) {
    byLanguage = new Map();
    indexCache.set(dreams, byLanguage);
  }
  let index = byLanguage.get(language);
  if (!index) {
    index = buildSymbolIndex(dreams, language);
    byLanguage.set(language, index);
  }
  return index;
}

/** What a symbol has done so far: born in this dream, returned in some dreams, or in every one. */
export function getSymbolStatus(symbol: LinkedSymbol, index: SymbolIndex): SymbolStatus {
  const count = symbol.appearances.length;
  if (count <= 1) return { kind: 'first' };
  if (count === index.dreamCount && count >= 3) return { kind: 'every', count };
  return { kind: 'some', count };
}

/** A personal symbol still waiting for its first look: it was born, the dreamer has not opened it. */
export function isNewPersonalSymbol(symbol: LinkedSymbol): boolean {
  return symbol.kind === 'personal' && Boolean(symbol.personalKey) && !symbol.confirmed;
}

/**
 * The dreamer's own symbols, most frequent first with their newest name, for an analysis
 * to reuse their keys. Only linked readings count: an older name is not a key.
 */
export function collectKnownSymbols(dreams: readonly DreamAnalysis[]): { key: string; name: string }[] {
  const counts = new Map<string, { name: string; count: number; newest: number }>();
  for (const dream of dreams) {
    if (!isLinkableDream(dream)) continue;
    const seen = new Set<string>();
    for (const insight of dream.symbols ?? []) {
      const key = insight.key && !insight.symbolId && !getSymbolById(insight.key) ? insight.key : undefined;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const entry = counts.get(key);
      if (!entry) {
        counts.set(key, { name: insight.name.trim(), count: 1, newest: dream.id });
        continue;
      }
      entry.count += 1;
      if (dream.id > entry.newest) Object.assign(entry, { name: insight.name.trim(), newest: dream.id });
    }
  }
  return [...counts.entries()]
    .sort(([, a], [, b]) => b.count - a.count || b.newest - a.newest)
    .slice(0, MAX_KNOWN_SYMBOLS)
    .map(([key, { name }]) => ({ key, name }));
}

/**
 * The dream's symbols once the dreamer has opened a personal symbol: its appearances in
 * this dream are marked as confirmed, which every device sees through the dream's sync.
 * Null when there is nothing to mark.
 */
export function confirmPersonalSymbol(
  dream: DreamAnalysis,
  personalKey: string,
  now: number = Date.now()
): DreamSymbolInsight[] | null {
  const symbols = dream.symbols ?? [];
  if (!symbols.some((insight) => insight.key === personalKey && !insight.confirmedAt)) return null;
  return symbols.map((insight) => (insight.key === personalKey && !insight.confirmedAt
    ? { ...insight, confirmedAt: now }
    : insight));
}
