import { getSymbolStatus, type LinkedSymbol, type SymbolIndex } from '@/lib/symbolLinks';

type Translate = (key: string, replacements?: Record<string, string | number>) => string;

/** What a symbol has done so far, in words: born in this dream, back in some, or in every one. */
export function symbolStatusLabel(t: Translate, symbol: LinkedSymbol, index: SymbolIndex): string {
  const status = getSymbolStatus(symbol, index);
  if (status.kind === 'first') return t('journal.symbols.status.first');
  if (status.kind === 'every') return t('journal.symbols.status.every', { count: status.count });
  return t('journal.symbols.status.some', { count: status.count, total: index.dreamCount });
}
