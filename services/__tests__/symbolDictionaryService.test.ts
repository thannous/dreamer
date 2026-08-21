import { searchSymbols } from '@/services/symbolDictionaryService';

describe('symbolDictionaryService', () => {
  it.each([
    ['agua', 'water'],
    ['coracao', 'heart'],
    ['mae', 'mother'],
    ['passaro', 'bird'],
  ])('finds Portuguese symbol names without typed diacritics', (query, symbolId) => {
    expect(searchSymbols(query, 'pt').map((symbol) => symbol.id)).toContain(symbolId);
  });
});
