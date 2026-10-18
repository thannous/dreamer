import {
  buildSymbolIndex,
  collectKnownSymbols,
  confirmPersonalSymbol,
  getSymbolStatus,
  isNewPersonalSymbol,
  readingSymbols,
  TELLING_COMPANIONS_FROM,
} from '../symbolLinks';
import type { DreamAnalysis, DreamSymbolInsight } from '../types';

// Isolation control: the web journey sees one language, new readings only and a few dreams.
// These combinations (older readings named in other languages or before keys, a key the
// dreamer owns across renamed readings, a reading naming one symbol twice, companions past
// fifteen dreams, a confirmation that must touch only its own symbol) would link wrongly
// without a visible failure in that journey.

const night = (day: number, symbols: DreamSymbolInsight[], overrides: Partial<DreamAnalysis> = {}): DreamAnalysis => ({
  id: Date.UTC(2026, 9, day, 6),
  transcript: 'x',
  title: `Dream ${day}`,
  interpretation: 'Reading',
  shareableQuote: '',
  imageUrl: '',
  chatHistory: [],
  dreamType: 'Symbolic Dream',
  isAnalyzed: true,
  analysisStatus: 'done',
  symbols,
  ...overrides,
});

describe('symbol links', () => {
  it('follows one dictionary symbol through older readings named in other languages', () => {
    const dreams = [
      night(3, [{ name: 'Le chat', meaning: 'Il veille.' }]),
      night(1, [{ name: 'Cat', meaning: 'It waits.' }, { name: 'Maison', meaning: 'Le seuil.' }]),
      night(5, [{ name: 'Chaton', meaning: 'Un petit chat.', symbolId: 'cat' }, { name: 'House', meaning: 'Home.', symbolId: 'house' }]),
      night(6, [{ name: 'Chat', meaning: 'Pas encore lu.' }], { isAnalyzed: false, analysisStatus: 'pending' }),
    ];
    const index = buildSymbolIndex(dreams, 'fr');
    const cat = index.symbols.get('d:cat')!;

    expect(index.dreamCount).toBe(3);
    expect(cat.name).toBe('Chat');
    expect(cat.appearances.map(({ dream }) => dream.title)).toEqual(['Dream 1', 'Dream 3', 'Dream 5']);
    expect(getSymbolStatus(cat, index)).toEqual({ kind: 'every', count: 3 });
    expect(cat.companions).toEqual([{ linkKey: 'd:house', count: 2 }]);
    expect(getSymbolStatus(index.symbols.get('d:house')!, index)).toEqual({ kind: 'some', count: 2 });
  });

  it('links an older reading named after one part of a dictionary name', () => {
    // Seen on a real journal: "La mer" stayed apart from a new reading the analysis gave `ocean`,
    // whose French name is "Mer / Océan"; "Route" stays the road's own entry, not the path's.
    const dreams = [
      night(1, [{ name: 'La mer', meaning: 'Elle monte.' }, { name: 'Dents', meaning: 'Elles tombent.' }]),
      night(2, [{ name: 'Route', meaning: 'Elle file.' }]),
      night(4, [{ name: 'Mer calme', meaning: 'Au loin.', symbolId: 'ocean' }]),
    ];
    const index = buildSymbolIndex(dreams, 'fr');

    expect(index.symbols.get('d:ocean')!.appearances.map(({ dream }) => dream.title)).toEqual(['Dream 1', 'Dream 4']);
    expect(index.symbols.has('d:teeth')).toBe(true);
    expect(index.symbols.has('d:road')).toBe(true);
  });

  it('counts a symbol out of every analyzed dream, as Tendances does', () => {
    // Seen dogfooding: "In 2 of 2 dreams" beside "2 of 7" in Tendances; a reading without
    // symbols was left out, so a symbol could also read "in each of your dreams" too soon.
    const dreams = [
      night(1, [{ name: 'Chat', meaning: 'Il veille.', symbolId: 'cat' }]),
      night(2, [{ name: 'Chat', meaning: 'Il revient.', symbolId: 'cat' }]),
      night(3, [{ name: 'Chat', meaning: 'Encore.', symbolId: 'cat' }]),
      night(4, [], { analyzedAt: Date.UTC(2026, 9, 4, 7) }),
      night(5, [], { isAnalyzed: false, analysisStatus: 'pending' }),
    ];
    const index = buildSymbolIndex(dreams, 'fr');

    expect(index.dreamCount).toBe(4);
    expect(getSymbolStatus(index.symbols.get('d:cat')!, index)).toEqual({ kind: 'some', count: 3 });
  });

  it('keeps a personal symbol by its key, under the name it goes by most, until the dreamer opens it', () => {
    const first = night(1, [{ name: 'La maison de mamie', meaning: 'Le jardin.', key: 'grandmother-house' }]);
    const second = night(4, [
      { name: 'Maison de grand-mère', meaning: 'Elle revient.', key: 'grandmother-house' },
      { name: 'Loup', meaning: 'Il attend.', key: 'wolf' },
      { name: 'Lampe bleue', meaning: 'Une lumière.', key: 'blue-lamp' },
    ]);
    const index = buildSymbolIndex([second, first], 'fr');
    const house = index.symbols.get('p:grandmother-house')!;

    // At a tie, the name it was born with.
    expect(house.name).toBe('La maison de mamie');
    expect(house.appearances).toHaveLength(2);
    expect(isNewPersonalSymbol(house)).toBe(true);
    // A dictionary id answered as a key is that dictionary symbol, never a personal one.
    expect(index.symbols.has('d:wolf')).toBe(true);
    expect(collectKnownSymbols([first, second])).toEqual([
      { key: 'grandmother-house', name: 'La maison de mamie' },
      { key: 'blue-lamp', name: 'Lampe bleue' },
    ]);
    // A third reading wording it the second way: that name now leads, here and for the analysis.
    const third = night(6, [{ name: 'maison de grand-mère', meaning: 'Encore.', key: 'grandmother-house' }]);
    expect(buildSymbolIndex([third, second, first], 'fr').symbols.get('p:grandmother-house')!.name)
      .toBe('Maison de grand-mère');
    expect(collectKnownSymbols([third, first, second])[0]).toEqual({ key: 'grandmother-house', name: 'Maison de grand-mère' });

    const confirmed = confirmPersonalSymbol(second, 'grandmother-house', 42);
    expect(confirmed).toEqual([
      { name: 'Maison de grand-mère', meaning: 'Elle revient.', key: 'grandmother-house', confirmedAt: 42 },
      second.symbols![1],
      second.symbols![2],
    ]);
    const after = buildSymbolIndex([{ ...second, symbols: confirmed! }, first], 'fr');
    expect(isNewPersonalSymbol(after.symbols.get('p:grandmother-house')!)).toBe(false);
    expect(isNewPersonalSymbol(after.symbols.get('p:blue-lamp')!)).toBe(true);
    expect(confirmPersonalSymbol({ ...second, symbols: confirmed! }, 'grandmother-house')).toBeNull();
  });

  it('joins an older reading to the dreamer’s own symbol that bears its name', () => {
    const older = night(1, [{ name: 'Le phare', meaning: 'Il veille.' }]);
    const newer = night(3, [{ name: 'Phare', meaning: 'Il revient.', key: 'lighthouse' }]);
    const index = buildSymbolIndex([newer, older], 'fr');
    const lighthouse = index.symbols.get('p:lighthouse')!;

    expect(index.symbols.has('n:phare')).toBe(false);
    expect(lighthouse.appearances.map(({ dream }) => dream.title)).toEqual(['Dream 1', 'Dream 3']);
    expect(readingSymbols(older.symbols, index)[0].linked).toBe(lighthouse);

    // A name two of the dreamer's symbols bear leads to neither.
    const other = night(4, [{ name: 'Phare', meaning: 'Un autre.', key: 'harbour-light' }]);
    const ambiguous = buildSymbolIndex([older, newer, other], 'fr');
    expect(ambiguous.symbols.get('n:phare')!.appearances).toHaveLength(1);
    expect(ambiguous.symbols.get('p:lighthouse')!.appearances).toHaveLength(1);
  });

  it('shows a symbol a reading names twice once, with both meanings', () => {
    const dream = night(2, [
      { name: 'La mer', meaning: 'Elle monte.', symbolId: 'ocean' },
      { name: 'Loup', meaning: 'Il attend.', symbolId: 'wolf' },
      { name: 'L’océan', meaning: 'Il recouvre tout.', symbolId: 'ocean' },
    ]);
    const index = buildSymbolIndex([dream], 'fr');
    const symbols = readingSymbols(dream.symbols, index);

    expect(symbols.map(({ insight }) => insight.name)).toEqual(['La mer', 'Loup']);
    expect(symbols[0].insight.meaning).toBe('Elle monte.\n\nIl recouvre tout.');
    expect(symbols[0].linked).toBe(index.symbols.get('d:ocean'));
    expect(index.symbols.get('d:ocean')!.appearances).toHaveLength(1);
  });

  it('leads with companions that meet more often than chance, from fifteen dreams', () => {
    // Water is in every dream, so it meets the cat everywhere without saying anything.
    const dreams = Array.from({ length: TELLING_COMPANIONS_FROM }, (_, at) => {
      const day = at + 1;
      const symbols: DreamSymbolInsight[] = [{ name: 'Eau', meaning: '.', symbolId: 'water' }];
      if (day <= 4) symbols.push({ name: 'Chat', meaning: '.', symbolId: 'cat' });
      if (day <= 2) symbols.push({ name: 'Maison', meaning: '.', symbolId: 'house' });
      if (day === 3) symbols.push({ name: 'Lune', meaning: '.', symbolId: 'moon' });
      return night(day, symbols);
    });
    const companions = (journal: DreamAnalysis[]) =>
      buildSymbolIndex(journal, 'fr').symbols.get('d:cat')!.companions.map(({ linkKey }) => linkKey);

    // A single shared dream says too little to lead.
    expect(companions(dreams)).toEqual(['d:house', 'd:water', 'd:moon']);
    // Below fifteen dreams, the most frequent companions lead, as before.
    expect(companions(dreams.slice(0, TELLING_COMPANIONS_FROM - 1))).toEqual(['d:water', 'd:house', 'd:moon']);
  });
});
