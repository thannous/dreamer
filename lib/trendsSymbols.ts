import type { LinkedSymbol, SymbolIndex } from '@/lib/symbolLinks';

export type PeriodSymbol = { symbol: LinkedSymbol; count: number };

/** A symbol seen once has not come back yet. */
const MIN_RETURNS = 2;
const MAX_PERIOD_SYMBOLS = 3;

const personalFirst = (symbol: LinkedSymbol) => (symbol.kind === 'personal' ? 0 : 1);

/**
 * The symbols that come back most in a period's analyzed dreams, the dreamer's own
 * included: by how many of those dreams hold them, then the one seen last, then the
 * dreamer's own before the dictionary's.
 */
export function getPeriodSymbols(index: SymbolIndex, analyzedIds: readonly number[]): PeriodSymbol[] {
  const inPeriod = new Set(analyzedIds);
  const ranked: (PeriodSymbol & { last: number })[] = [];
  for (const symbol of index.symbols.values()) {
    const seen = symbol.appearances.filter(({ dream }) => inPeriod.has(dream.id));
    if (seen.length < MIN_RETURNS) continue;
    ranked.push({ symbol, count: seen.length, last: seen[seen.length - 1].dream.id });
  }
  return ranked
    .sort((a, b) => b.count - a.count || b.last - a.last
      || personalFirst(a.symbol) - personalFirst(b.symbol) || a.symbol.linkKey.localeCompare(b.symbol.linkKey))
    .slice(0, MAX_PERIOD_SYMBOLS)
    .map(({ symbol, count }) => ({ symbol, count }));
}
