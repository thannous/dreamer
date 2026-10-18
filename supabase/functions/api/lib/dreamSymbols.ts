import { DREAM_SYMBOL_IDS } from './dreamSymbolIds.ts';

/**
 * How a dream's symbols are linked across the journal. A symbol the dictionary knows
 * carries its id (`symbolId`, the same in every language); any other one is the
 * dreamer's own and carries a stable `key`. The analysis receives the dreamer's own
 * symbols so the same place, person or object keeps the same key from one dream to the
 * next, which is what draws the threads between dreams.
 */

const SYMBOL_ID_SET: ReadonlySet<string> = new Set(DREAM_SYMBOL_IDS);

/** Keys sent to the model, most frequent first: enough to recognise a return, small enough to stay cheap. */
export const MAX_KNOWN_SYMBOLS = 40;
const MAX_KEY_LENGTH = 48;
const MAX_NAME_LENGTH = 60;

export type KnownDreamSymbol = { key: string; name: string };

/** The dictionary id a model answered, or undefined when it is not one. Case-insensitive. */
export const normalizeDreamSymbolId = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const id = value.trim().toLowerCase();
  return SYMBOL_ID_SET.has(id) ? id : undefined;
};

/** A personal key as stored: lowercase ASCII words joined by hyphens, never a dictionary id. */
export const normalizePersonalSymbolKey = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const key = value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_KEY_LENGTH)
    .replace(/-+$/g, '');
  if (!key || key === 'none') return undefined;
  return key;
};

const boundedName = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH);
};

/** The dreamer's own symbols an app sends with an analysis request, bounded and normalized. */
export const parseKnownDreamSymbols = (value: unknown): KnownDreamSymbol[] => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const symbols: KnownDreamSymbol[] = [];
  for (const entry of value) {
    if (symbols.length >= MAX_KNOWN_SYMBOLS) break;
    const key = normalizePersonalSymbolKey((entry as { key?: unknown } | null)?.key);
    const name = boundedName((entry as { name?: unknown } | null)?.name);
    if (!key || !name || seen.has(key)) continue;
    seen.add(key);
    symbols.push({ key, name });
  }
  return symbols;
};

/**
 * The dreamer's own symbols as their saved analyses hold them (`analysis_details` rows,
 * newest first), the most frequent first and the newest name for each.
 */
export const collectKnownDreamSymbols = (analysisDetails: readonly unknown[]): KnownDreamSymbol[] => {
  const counts = new Map<string, { name: string; count: number; order: number }>();
  analysisDetails.forEach((details, order) => {
    const symbols = (details as { symbols?: unknown } | null)?.symbols;
    if (!Array.isArray(symbols)) return;
    const inDream = new Set<string>();
    for (const symbol of symbols) {
      const key = normalizePersonalSymbolKey((symbol as { key?: unknown } | null)?.key);
      const name = boundedName((symbol as { name?: unknown } | null)?.name);
      if (!key || !name || inDream.has(key)) continue;
      inDream.add(key);
      const known = counts.get(key);
      if (known) known.count += 1;
      else counts.set(key, { name, count: 1, order });
    }
  });
  return [...counts.entries()]
    .sort(([, a], [, b]) => b.count - a.count || a.order - b.order)
    .slice(0, MAX_KNOWN_SYMBOLS)
    .map(([key, { name }]) => ({ key, name }));
};
