import type { SymbolLanguage } from '@/lib/symbolTypes';
import { loadSymbolContent, peekSymbolContent } from '@/services/symbolContent';
import { getAllSymbols, searchSymbols } from '@/services/symbolDictionaryService';

const LANGUAGES: SymbolLanguage[] = ['en', 'fr', 'es', 'de', 'it', 'pt'];

describe('symbol content assets', () => {
  it.each(LANGUAGES)('gives every %s symbol of the index a reading', async (language) => {
    const content = await loadSymbolContent(language);
    for (const symbol of getAllSymbols()) {
      expect(content[symbol.id]?.shortDescription).toEqual(expect.any(String));
      expect(content[symbol.id].shortDescription.length).toBeGreaterThan(0);
      expect(Array.isArray(content[symbol.id].askYourself)).toBe(true);
    }
    expect(peekSymbolContent(language)).toBe(content);
  });

  it('reads each language once, even when asked twice at the same time', async () => {
    const [first, second] = await Promise.all([loadSymbolContent('it'), loadSymbolContent('it')]);
    expect(first).toBe(second);
  });

  it('finds a symbol by its description only once the content is loaded', async () => {
    const water = getAllSymbols().find((symbol) => symbol.id === 'water')!;
    const content = await loadSymbolContent('en');
    const word = content.water.shortDescription.split(/\W+/).find((part) => part.length > 6
      && !getAllSymbols().some((symbol) => symbol.names.en.toLowerCase().includes(part.toLowerCase())))!;
    expect(searchSymbols(word, 'en').map((symbol) => symbol.id)).not.toContain(water.id);
    expect(searchSymbols(word, 'en', content).map((symbol) => symbol.id)).toContain(water.id);
  });
});
