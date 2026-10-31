import { isDreamAnalyzed } from '@/lib/dreamUsage';
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
  /** The dictionary's name in the reader's language, otherwise the one its readings use most. */
  name: string;
  /** Oldest first: the symbol's story through the journal. */
  appearances: SymbolAppearance[];
  /** The dreamer has opened this personal symbol at least once. */
  confirmed: boolean;
  /** Symbols seen in the same dreams, the most telling first (see `TELLING_COMPANIONS_FROM`). */
  companions: { linkKey: string; count: number }[];
};

export type SymbolIndex = {
  symbols: ReadonlyMap<string, LinkedSymbol>;
  /** Analyzed dreams, as Tendances counts them: the "out of" of a symbol's count. */
  dreamCount: number;
  /** An older reading's name that the dreamer's own symbol bears: `n:<name>` leads to its `p:<key>`. */
  aliases: ReadonlyMap<string, string>;
};

export type SymbolStatus =
  | { kind: 'first' }
  | { kind: 'some'; count: number }
  | { kind: 'every'; count: number };

/** Personal symbols sent with an analysis request, as the API bounds them. */
export const MAX_KNOWN_SYMBOLS = 40;

/** From this many analyzed dreams, companions that meet more often than chance would have it lead. */
export const TELLING_COMPANIONS_FROM = 15;

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

/** "Mer / Océan" or "Dents (perdre ses dents)": an older reading says "La mer" or "Dents". */
const nameParts = (name: string): string[] => name.replace(/\s*\([^)]*\)\s*$/, '').split(/\s+\/\s+/);

/** Every dictionary name in every language, so an older reading's "Cat" or "Chat" still links. */
const getDictionaryNames = (): Map<string, string> => {
  if (dictionaryNames) return dictionaryNames;
  const names = new Map<string, string>();
  const symbols = getDictionary().getAllSymbols();
  const languages = ['en', 'fr', 'es', 'de', 'it', 'pt'] as const;
  const add = (name: string, id: string) => {
    const normalized = normalizeName(name);
    if (normalized && !names.has(normalized)) names.set(normalized, id);
  };
  // Whole names first: a part of one entry's name never takes another entry's own name.
  for (const symbol of symbols) for (const language of languages) add(symbol.names[language] ?? '', symbol.id);
  for (const symbol of symbols) {
    for (const language of languages) for (const part of nameParts(symbol.names[language] ?? '')) add(part, symbol.id);
  }
  dictionaryNames = names;
  return names;
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

/** Where a symbol of a reading leads in this journal: an older reading's name may lead to the dreamer's own symbol. */
export function resolveLinkKey(index: SymbolIndex, insight: Pick<DreamSymbolInsight, 'name' | 'symbolId' | 'key'>): string | null {
  const linkKey = symbolLinkKey(insight);
  return linkKey ? index.aliases.get(linkKey) ?? linkKey : null;
}

export type ReadingSymbol = { insight: DreamSymbolInsight; linked: LinkedSymbol | undefined };

/**
 * A reading's symbols as its page shows them: one entry per symbol, even when the reading
 * names it twice ("La mer", "L'océan"); the second meaning joins the first.
 */
export function readingSymbols(insights: readonly DreamSymbolInsight[] | undefined, index: SymbolIndex): ReadingSymbol[] {
  const entries: ReadingSymbol[] = [];
  const at = new Map<string, number>();
  for (const insight of insights ?? []) {
    if (!insight.name?.trim()) continue;
    const linkKey = resolveLinkKey(index, insight);
    const earlier = linkKey ? at.get(linkKey) : undefined;
    if (earlier !== undefined) {
      const { insight: first, linked } = entries[earlier];
      const meaning = [first.meaning, insight.meaning].filter((text) => text?.trim()).join('\n\n');
      entries[earlier] = { insight: { ...first, meaning }, linked };
      continue;
    }
    if (linkKey) at.set(linkKey, entries.length);
    entries.push({ insight, linked: linkKey ? index.symbols.get(linkKey) : undefined });
  }
  return entries;
}

const isLinkableDream = (dream: DreamAnalysis): boolean =>
  typeof dream.id === 'number' && Boolean(dream.symbols?.length) && Boolean(dream.isAnalyzed || dream.analysisStatus === 'done');

/**
 * A reading made before symbols carried a link says "Le moulin"; a later one names the same
 * windmill by its key. A name leads to the dreamer's own symbol that bears it, unless two do.
 */
function personalNameAliases(dreams: readonly DreamAnalysis[]): Map<string, string> {
  const byName = new Map<string, string | null>();
  for (const dream of dreams) {
    for (const insight of dream.symbols ?? []) {
      const linkKey = insight.key ? symbolLinkKey(insight) : null;
      const name = normalizeName(insight.name ?? '');
      if (!linkKey?.startsWith('p:') || !name) continue;
      const known = byName.get(`n:${name}`);
      byName.set(`n:${name}`, known === undefined || known === linkKey ? linkKey : null);
    }
  }
  const aliases = new Map<string, string>();
  for (const [name, linkKey] of byName) if (linkKey) aliases.set(name, linkKey);
  return aliases;
}

/** The name a symbol of the dreamer's own goes by most often; at a tie, the one it was born with. */
function commonestName(names: ReadonlyMap<string, { name: string; count: number }>, fallback: string): string {
  let best: { name: string; count: number } | undefined;
  for (const entry of names.values()) if (!best || entry.count > best.count) best = entry;
  return best?.name ?? fallback;
}

/**
 * How telling a companion is. Past a few dreams, the symbols met most are the ones met
 * everywhere; those that meet more often than chance would have it say more.
 */
function companionWeight(count: number, own: number, other: number, dreamCount: number): number {
  if (dreamCount < TELLING_COMPANIONS_FROM || count < 2 || !own || !other) return 0;
  return (count * dreamCount) / (own * other);
}

/** One pass over the journal: every symbol with its appearances and companions. */
export function buildSymbolIndex(dreams: readonly DreamAnalysis[], language: SymbolLanguage): SymbolIndex {
  const symbols = new Map<string, LinkedSymbol>();
  const pairs = new Map<string, Map<string, number>>();
  const names = new Map<string, Map<string, { name: string; count: number }>>();
  let dreamCount = 0;
  const chronological = dreams.filter(isLinkableDream).sort((a, b) => a.id - b.id);
  const aliases = personalNameAliases(chronological);
  // A reading that named no symbol still counts: "2 of 7" says the same here and in Tendances.
  for (const dream of dreams) if (isDreamAnalyzed(dream) && !isLinkableDream(dream)) dreamCount += 1;

  for (const dream of chronological) {
    const inDream: string[] = [];
    for (const insight of dream.symbols ?? []) {
      const found = symbolLinkKey(insight);
      const linkKey = found ? aliases.get(found) ?? found : null;
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
      if (!symbol.symbolId) {
        // Readings word the same symbol differently; it keeps the name it goes by most often.
        const said = names.get(linkKey) ?? new Map<string, { name: string; count: number }>();
        const name = insight.name.trim();
        const entry = said.get(normalizeName(name)) ?? { name, count: 0 };
        entry.count += 1;
        said.set(normalizeName(name), entry);
        names.set(linkKey, said);
      }
      if (insight.confirmedAt) symbol.confirmed = true;
    }
    if (inDream.length || isDreamAnalyzed(dream)) dreamCount += 1;
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
      symbol.name = entry?.names[language] ?? entry?.names.en ?? symbol.name;
    } else {
      symbol.name = commonestName(names.get(symbol.linkKey) ?? new Map(), symbol.name);
    }
  }
  for (const symbol of symbols.values()) {
    const own = symbol.appearances.length;
    const weight = ({ linkKey, count }: { linkKey: string; count: number }) =>
      companionWeight(count, own, symbols.get(linkKey)?.appearances.length ?? 0, dreamCount);
    symbol.companions = [...(pairs.get(symbol.linkKey) ?? new Map<string, number>()).entries()]
      .map(([linkKey, count]) => ({ linkKey, count }))
      .sort((a, b) => weight(b) - weight(a) || b.count - a.count || a.linkKey.localeCompare(b.linkKey));
  }
  return { symbols, dreamCount, aliases };
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
 * The dreamer's own symbols, most frequent first with the name they go by, for an analysis
 * to reuse their keys. Only linked readings count: an older name is not a key.
 */
export function collectKnownSymbols(dreams: readonly DreamAnalysis[]): { key: string; name: string }[] {
  const counts = new Map<string, { names: Map<string, { name: string; count: number }>; count: number; newest: number }>();
  for (const dream of dreams.filter(isLinkableDream).sort((a, b) => a.id - b.id)) {
    const seen = new Set<string>();
    for (const insight of dream.symbols ?? []) {
      const key = insight.key && !insight.symbolId && !getSymbolById(insight.key) ? insight.key : undefined;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const entry = counts.get(key) ?? { names: new Map(), count: 0, newest: dream.id };
      const name = insight.name.trim();
      const said = entry.names.get(normalizeName(name)) ?? { name, count: 0 };
      said.count += 1;
      entry.names.set(normalizeName(name), said);
      entry.count += 1;
      entry.newest = dream.id;
      counts.set(key, entry);
    }
  }
  return [...counts.entries()]
    .sort(([, a], [, b]) => b.count - a.count || b.newest - a.newest)
    .slice(0, MAX_KNOWN_SYMBOLS)
    .map(([key, { names }]) => ({ key, name: commonestName(names, key) }));
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
