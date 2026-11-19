/**
 * BDD-style tests for dreamFilters utility functions
 * Tests dream filtering, sorting, and data extraction functionality
 */
import { describe, expect, it, jest } from '@jest/globals';
import {
    applyFilters,
    createNarrowingFilter,
    filterByDateRange,
    filterByDreamType,
    filterByFavorites,
    filterBySearch,
    filterByTheme,
    getUniqueDreamTypes,
    getUniqueThemes,
    isRememberedDream,
    isRecurringDream,
    sortDreamsByDate,
    type DreamFilters,
} from '../dreamFilters';
import type { DreamAnalysis, DreamTheme, DreamType } from '../types';

describe('dreamFilters', () => {
  const buildDream = (overrides: Partial<DreamAnalysis> = {}): DreamAnalysis => ({
    id: Date.now(),
    title: 'Dream',
    transcript: 'Transcript',
    interpretation: 'Interpretation',
    shareableQuote: 'Quote',
    imageUrl: '',
    chatHistory: [],
    dreamType: 'Symbolic Dream',
    ...overrides,
  });

  const mockDreams: DreamAnalysis[] = [
    buildDream({
      id: 1640000000000, // 2021-12-20
      title: 'Flying Dream',
      transcript: 'I was flying over mountains',
      interpretation: 'Feeling of freedom',
      dreamType: 'Lucid Dream',
      theme: 'surreal',
      isFavorite: false,
      isAnalyzed: true,
      analysisStatus: 'done',
      analyzedAt: 1640000000000,
    }),
    buildDream({
      id: 1640086400000, // 2021-12-21
      title: 'Falling Dream',
      transcript: 'I was falling from a building',
      interpretation: 'Fear of losing control',
      dreamType: 'Nightmare',
      theme: 'noir',
      isFavorite: true,
      isAnalyzed: true,
      analysisStatus: 'done',
      analyzedAt: 1640086400000,
      explorationStartedAt: 1640086400000,
    }),
    buildDream({
      id: 1640172800000, // 2021-12-22
      title: 'Water Dream',
      transcript: 'Swimming in the ocean',
      interpretation: 'Emotional journey',
      dreamType: 'Symbolic Dream',
      theme: 'calm',
      isFavorite: false,
      isAnalyzed: false,
    }),
  ];

  describe('filterBySearch', () => {
    it('given empty search query when filtering then returns all dreams', () => {
      const query = '   '; // whitespace only

      const result = filterBySearch(mockDreams, query);

      expect(result).toEqual(mockDreams);
    });

    it('given search term matching title when filtering then returns matching dreams', () => {
      const query = 'Flying';

      const result = filterBySearch(mockDreams, query);

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Flying Dream');
    });

    it('given search term matching transcript when filtering then returns matching dreams', () => {
      const query = 'swimming';

      const result = filterBySearch(mockDreams, query);

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Water Dream');
    });

    it('given search term matching interpretation when filtering then returns matching dreams', () => {
      const query = 'freedom';

      const result = filterBySearch(mockDreams, query);

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Flying Dream');
    });

    it('given search term matching dream type when filtering then returns matching dreams', () => {
      const query = 'nightmare';

      const result = filterBySearch(mockDreams, query);

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Falling Dream');
    });

    it('given localized dream type label when filtering then returns matching dreams', () => {
      const query = 'cauchemar';

      const result = filterBySearch(mockDreams, query, {
        dreamTypeLabelResolver: (dreamType) => (dreamType === 'Nightmare' ? 'Cauchemar' : undefined),
      });

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Falling Dream');
    });

    it('given search term with different case when filtering then returns matching dreams', () => {
      const query = 'FLYING';

      const result = filterBySearch(mockDreams, query);

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Flying Dream');
    });

    it('given search term with no matches when filtering then returns empty array', () => {
      const query = 'nonexistent';

      const result = filterBySearch(mockDreams, query);

      expect(result).toHaveLength(0);
    });

    it('given memory metadata when filtering then searches remembered fields and labels', () => {
      const dreams: DreamAnalysis[] = [
        buildDream({
          title: 'Anchor memory',
          memory: {
            origin: 'remembered',
            rememberedKind: 'old',
            approximatePeriod: 'childhood',
            strongestFragment: 'person',
          },
        }),
        buildDream({
          title: 'Fresh dream',
          memory: undefined,
        }),
      ];

      const rawResult = filterBySearch(dreams, 'childhood');
      const localizedResult = filterBySearch(dreams, 'personne', {
        dreamMemoryLabelResolver: (field, value) => {
          if (field === 'fragment' && value === 'person') return 'Une personne';
          return undefined;
        },
      });

      expect(rawResult).toHaveLength(1);
      expect(rawResult[0].title).toBe('Anchor memory');
      expect(localizedResult).toHaveLength(1);
      expect(localizedResult[0].title).toBe('Anchor memory');
    });

    it('given multi-word query spanning fields when filtering then matches via joined text', () => {
      const dreams: DreamAnalysis[] = [
        buildDream({
          title: 'Hello',
          transcript: 'World',
          interpretation: '',
          dreamType: 'Symbolic Dream',
        }),
      ];
      const query = 'hello world';

      const result = filterBySearch(dreams, query);

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Hello');
    });

    it('given a resolver when title already matches then does not resolve localized labels', () => {
      const resolver = jest.fn(() => 'Should not be called');
      const dreams: DreamAnalysis[] = [
        buildDream({ title: 'Needle A', dreamType: 'Nightmare' }),
        buildDream({ title: 'Needle B', dreamType: 'Nightmare' }),
      ];
      const query = 'needle';

      const result = filterBySearch(dreams, query, { dreamTypeLabelResolver: resolver });

      expect(result).toHaveLength(2);
      expect(resolver).not.toHaveBeenCalled();
    });
  });

  describe('filterByTheme', () => {
    it('given null theme when filtering then returns all dreams', () => {
      const theme = null;

      const result = filterByTheme(mockDreams, theme);

      expect(result).toEqual(mockDreams);
    });

    it('given valid theme when filtering then returns dreams with that theme', () => {
      const theme = 'surreal';

      const result = filterByTheme(mockDreams, theme);

      expect(result).toHaveLength(1);
      expect(result[0].theme).toBe('surreal');
    });

    it('given theme with no matches when filtering then returns empty array', () => {
      const theme = 'nonexistent' as DreamTheme;

      const result = filterByTheme(mockDreams, theme);

      expect(result).toHaveLength(0);
    });
  });

  describe('filterByDreamType', () => {
    it('given null dream type when filtering then returns all dreams', () => {
      const dreamType = null;

      const result = filterByDreamType(mockDreams, dreamType);

      expect(result).toEqual(mockDreams);
    });

    it('given valid dream type when filtering then returns dreams with that type', () => {
      const dreamType: DreamType = 'Lucid Dream';

      const result = filterByDreamType(mockDreams, dreamType);

      expect(result).toHaveLength(1);
      expect(result[0].dreamType).toBe('Lucid Dream');
    });

    it('given dream type with no matches when filtering then returns empty array', () => {
      const dreamType = 'nonexistent' as DreamType;

      const result = filterByDreamType(mockDreams, dreamType);

      expect(result).toHaveLength(0);
    });
  });

  describe('filterByFavorites', () => {
    it('given favoritesOnly false when filtering then returns all dreams', () => {
      const favoritesOnly = false;

      const result = filterByFavorites(mockDreams, favoritesOnly);

      expect(result).toEqual(mockDreams);
    });

    it('given favoritesOnly true when filtering then returns only favorite dreams', () => {
      const favoritesOnly = true;

      const result = filterByFavorites(mockDreams, favoritesOnly);

      expect(result).toHaveLength(1);
      expect(result[0].isFavorite).toBe(true);
      expect(result[0].title).toBe('Falling Dream');
    });
  });

  describe('filterByDateRange', () => {
    it('given null start and end dates when filtering then returns all dreams', () => {
      const startDate = null;
      const endDate = null;

      const result = filterByDateRange(mockDreams, startDate, endDate);

      expect(result).toEqual(mockDreams);
    });

    it('given start date only when filtering then returns dreams after start date', () => {
      const startDate = new Date('2021-12-21');
      const endDate = null;

      const result = filterByDateRange(mockDreams, startDate, endDate);

      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('Falling Dream');
      expect(result[1].title).toBe('Water Dream');
    });

    it('given end date only when filtering then returns dreams before end date', () => {
      const startDate = null;
      const endDate = new Date('2021-12-21');

      const result = filterByDateRange(mockDreams, startDate, endDate);

      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('Flying Dream');
      expect(result[1].title).toBe('Falling Dream');
    });

    it('given date range when filtering then returns dreams within range', () => {
      const startDate = new Date('2021-12-21');
      const endDate = new Date('2021-12-21');

      const result = filterByDateRange(mockDreams, startDate, endDate);

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Falling Dream');
    });

    it('given date range with end date when filtering then includes dreams up to end of day', () => {
      const startDate = new Date('2021-12-20');
      const endDate = new Date('2021-12-21');

      const result = filterByDateRange(mockDreams, startDate, endDate);

      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('Flying Dream');
      expect(result[1].title).toBe('Falling Dream');
    });
  });

  describe('applyFilters', () => {
    it('given empty filters when applying then returns all dreams', () => {
      const filters: DreamFilters = {};

      const result = applyFilters(mockDreams, filters);

      expect(result).toBe(mockDreams);
      expect(result).toEqual(mockDreams);
    });

    it('given search filter when applying then returns filtered dreams', () => {
      const filters: DreamFilters = { searchQuery: 'Flying' };

      const result = applyFilters(mockDreams, filters);

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Flying Dream');
    });

    it('given localized search term and resolver when applying then returns filtered dreams', () => {
      const filters: DreamFilters = { searchQuery: 'pesadilla' };

      const result = applyFilters(mockDreams, filters, {
        searchOptions: {
          dreamTypeLabelResolver: (dreamType) => (dreamType === 'Nightmare' ? 'Pesadilla' : undefined),
        },
      });

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Falling Dream');
    });

    it('given theme filter when applying then returns filtered dreams', () => {
      const filters: DreamFilters = { theme: 'surreal' };

      const result = applyFilters(mockDreams, filters);

      expect(result).toHaveLength(1);
      expect(result[0].theme).toBe('surreal');
    });

    it('given dream type filter when applying then returns filtered dreams', () => {
      const filters: DreamFilters = { dreamType: 'Nightmare' };

      const result = applyFilters(mockDreams, filters);

      expect(result).toHaveLength(1);
      expect(result[0].dreamType).toBe('Nightmare');
    });

    it('given favorites filter when applying then returns filtered dreams', () => {
      const filters: DreamFilters = { favoritesOnly: true };

      const result = applyFilters(mockDreams, filters);

      expect(result).toHaveLength(1);
      expect(result[0].isFavorite).toBe(true);
    });

    it('given analyzed only filter when applying then returns analyzed dreams', () => {
      const filters: DreamFilters = { analyzedOnly: true };

      const result = applyFilters(mockDreams, filters);

      expect(result).toHaveLength(2);
      expect(result.every(dream => dream.isAnalyzed)).toBe(true);
    });

    it('includes a recorded exploration or a personal follow-up, and excludes the opening exchange alone', () => {
      const opening = buildDream({
        id: 101,
        transcript: 'I was flying',
        chatHistory: [
          { id: 'transcript', role: 'user', text: 'I was flying' },
          { id: 'opening', role: 'model', text: 'What stood out to you?' },
        ],
      });
      const followUp = buildDream({
        id: 102,
        chatHistory: [{ id: 'reply', role: 'user', text: 'I was afraid of landing.' }],
      });

      const result = applyFilters([...mockDreams, opening, followUp], { exploredOnly: true });

      expect(result.map(dream => dream.id)).toEqual([mockDreams[1].id, followUp.id]);
    });

    it('given remembered only filter when applying then returns dreams with memory metadata', () => {
      const rememberedDream = buildDream({
        title: 'Old house memory',
        memory: {
          strongestFragment: 'place',
        },
      });
      const freshDream = buildDream({
        title: 'Fresh dream',
        memory: undefined,
      });
      const filters: DreamFilters = { rememberedOnly: true };

      const result = applyFilters([rememberedDream, freshDream], filters);

      expect(result).toEqual([rememberedDream]);
      expect(isRememberedDream(rememberedDream)).toBe(true);
      expect(isRememberedDream(freshDream)).toBe(false);
    });

    it('given date range filter when applying then returns filtered dreams', () => {
      const filters: DreamFilters = {
        startDate: new Date('2021-12-21'),
        endDate: new Date('2021-12-21'),
      };

      const result = applyFilters(mockDreams, filters);

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Falling Dream');
    });

    it('given needsExplorationOnly when applying then returns analyzed unexplored dreams', () => {
      const filters: DreamFilters = { needsExplorationOnly: true };
      const result = applyFilters(mockDreams, filters);
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Flying Dream');
    });

    it('given analysisStatus unanalyzed when applying then returns unanalyzed dreams', () => {
      const unanalyzed = buildDream({
        title: 'Raw fragment',
        isAnalyzed: false,
        analysisStatus: 'none',
        interpretation: '',
      });
      const result = applyFilters([...mockDreams, unanalyzed], { analysisStatus: 'unanalyzed' });
      expect(result.map((dream) => dream.title)).toEqual(['Water Dream', 'Raw fragment']);
    });

    it('given recurringOnly when applying then keeps type and memory recurrence independently', () => {
      const recurringByType = buildDream({
        title: 'Type recurrence',
        dreamType: 'Recurring Dream',
      });
      const recurringByMemory = buildDream({
        title: 'Memory recurrence',
        dreamType: 'Nightmare',
        memory: { origin: 'remembered', rememberedKind: 'recurring', recurring: true },
      });
      const ordinary = buildDream({
        title: 'Ordinary night',
        dreamType: 'Symbolic Dream',
      });

      const result = applyFilters(
        [recurringByType, recurringByMemory, ordinary],
        { recurringOnly: true, dreamType: 'Nightmare' },
      );

      expect(result.map((dream) => dream.title)).toEqual(['Memory recurrence']);
      expect(isRecurringDream(recurringByType)).toBe(true);
      expect(isRecurringDream(recurringByMemory)).toBe(true);
      expect(isRecurringDream(ordinary)).toBe(false);
    });

    it('given multiple filters when applying then returns dreams matching all criteria', () => {
      const filters: DreamFilters = {
        theme: 'noir',
        dreamType: 'Nightmare',
        favoritesOnly: true,
        analyzedOnly: true,
        exploredOnly: true,
      };

      const result = applyFilters(mockDreams, filters);

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Falling Dream');
    });
  });

  describe('sortDreamsByDate', () => {
    it('given dreams when sorting descending then returns dreams newest first', () => {
      const ascending = false;

      const result = sortDreamsByDate(mockDreams, ascending);

      expect(result[0].title).toBe('Water Dream'); // 2021-12-22
      expect(result[1].title).toBe('Falling Dream'); // 2021-12-21
      expect(result[2].title).toBe('Flying Dream'); // 2021-12-20
    });

    it('given dreams when sorting ascending then returns dreams oldest first', () => {
      const ascending = true;

      const result = sortDreamsByDate(mockDreams, ascending);

      expect(result[0].title).toBe('Flying Dream'); // 2021-12-20
      expect(result[1].title).toBe('Falling Dream'); // 2021-12-21
      expect(result[2].title).toBe('Water Dream'); // 2021-12-22
    });

    it('given empty array when sorting then returns empty array', () => {
      const dreams: DreamAnalysis[] = [];

      const result = sortDreamsByDate(dreams);

      expect(result).toHaveLength(0);
    });
  });

  describe('getUniqueThemes', () => {
    it('given dreams with themes when getting unique themes then returns sorted unique themes', () => {
      const dreams = mockDreams;

      const result = getUniqueThemes(dreams);

      expect(result).toEqual(['calm', 'noir', 'surreal']);
    });

    it('given dreams with null themes when getting unique themes then excludes null themes', () => {
      const dreamsWithNullTheme = [
        ...mockDreams,
        {
          ...mockDreams[0],
          theme: undefined,
        },
      ];

      const result = getUniqueThemes(dreamsWithNullTheme);

      expect(result).toEqual(['calm', 'noir', 'surreal']);
    });

    it('given empty array when getting unique themes then returns empty array', () => {
      const dreams: DreamAnalysis[] = [];

      const result = getUniqueThemes(dreams);

      expect(result).toHaveLength(0);
    });
  });

  describe('getUniqueDreamTypes', () => {
    it('given dreams with types when getting unique types then returns sorted unique types', () => {
      const dreams = mockDreams;

      const result = getUniqueDreamTypes(dreams);

      // Then: the Symbolic Dream among them was never analysed, so it shows no type.
      expect(result).toEqual(['Lucid Dream', 'Nightmare']);
    });

    it('given dreams with null types when getting unique types then excludes null types', () => {
      const dreamsWithNullType = [
        ...mockDreams,
        {
          ...mockDreams[0],
          dreamType: undefined as unknown as DreamType,
        },
      ];

      const result = getUniqueDreamTypes(dreamsWithNullType);

      expect(result).toEqual(['Lucid Dream', 'Nightmare']);
    });

    it('given empty array when getting unique types then returns empty array', () => {
      const dreams: DreamAnalysis[] = [];

      const result = getUniqueDreamTypes(dreams);

      expect(result).toHaveLength(0);
    });
  });

  // Isolation exception: a device journey types a few queries; it cannot compare every
  // narrowed keystroke, backspace and scope change against a full search.
  describe('createNarrowingFilter', () => {
    const remembered = buildDream({
      id: 1640259200000,
      title: 'Old House',
      transcript: 'The stairs again',
      interpretation: '',
      dreamType: 'Recurring Dream',
      memory: { origin: 'remembered', rememberedKind: 'old', approximatePeriod: 'teen_years' },
    });
    const journal = [...mockDreams, remembered];
    const labels = (language: string) => ({
      dreamTypeLabelResolver: (type: DreamType | null | undefined) => (type ? `${language}:${type}` : undefined),
      dreamMemoryLabelResolver: (_field: string, value: string) => `${language} ${value.replace(/_/g, ' ')}`,
    });
    const typed = (text: string) => Array.from({ length: text.length }, (_, index) => text.slice(0, index + 1));

    it('matches a full search at every keystroke, backspace and scope change', () => {
      const narrowing = createNarrowingFilter();
      let dreams = [...journal, buildDream({ id: 1640302400000, title: 'Falling leaves', isFavorite: false })];
      let language = 'fr';
      let filters: DreamFilters = {};
      const check = (searchQuery: string) => {
        const options = { searchOptions: labels(language), labelsSource: language };
        const expected = applyFilters(dreams, { ...filters, searchQuery }, options);
        expect(narrowing(dreams, { ...filters, searchQuery }, options)).toEqual(expected);
        return expected.length;
      };

      // Across fields (title then transcript) through the joined text, then back.
      typed('dream swimming').forEach(check);
      typed('dream swimming').reverse().forEach(check);
      // Localized labels and remembered fields.
      typed('fr:recurring').forEach(check);
      typed('fr teen years').forEach(check);
      // The same query matches more once the labels change language.
      expect(check('en teen years')).toBe(0);
      language = 'en';
      expect(check('en teen years')).toBe(1);
      // ...or once a filter is lifted.
      filters = { favoritesOnly: true };
      expect(check('fall')).toBe(1);
      filters = {};
      expect(check('fall')).toBe(2);
      // ...or once the journal gains a dream.
      dreams = [...dreams, buildDream({ id: 1640345600000, title: 'Falling again', transcript: 'Down' })];
      expect(check('fall')).toBe(3);
      typed('falling').forEach(check);
      // Accents and case fold away, key by key.
      typed('Océan').forEach(check);
      expect(check('Océan')).toBe(1);
      // A symbol's thread keeps only its dreams; another thread searches everything again.
      filters = { dreamIds: new Set([remembered.id]) };
      expect(check('the')).toBe(1);
      filters = { dreamIds: new Set([remembered.id, mockDreams[0].id]) };
      typed('the').forEach(check);
    });

    it('searches only the previous matches when the query grows', () => {
      // A dream's type label is resolved only when its own text did not match.
      const resolver = jest.fn((type: DreamType | null | undefined) => type ?? undefined);
      const options = { searchOptions: { dreamTypeLabelResolver: resolver }, labelsSource: 'fr' };
      const narrowing = createNarrowingFilter();
      expect(narrowing(journal, { searchQuery: 'ocean' }, options)).toHaveLength(1);

      resolver.mockClear();
      narrowing(journal, { searchQuery: 'oceans' }, options);
      const narrowedLookups = resolver.mock.calls.length;
      resolver.mockClear();
      applyFilters(journal, { searchQuery: 'oceans' }, options);

      expect(narrowedLookups).toBeLessThanOrEqual(1);
      expect(resolver.mock.calls.length).toBe(journal.length);
    });
  });

  describe('a capture never analysed, stored with the legacy default type', () => {
    // The journal card calls it Unclassified, so no type filter, type choice or type
    // search may treat it as a Symbolic dream.
    const legacy = mockDreams[2];
    const analysedSymbolic = buildDream({
      id: 1640259200000,
      title: 'Mirror Dream',
      dreamType: 'Symbolic Dream',
      isAnalyzed: true,
      analysisStatus: 'done',
      analyzedAt: 1640259200000,
    });
    const journal = [...mockDreams, analysedSymbolic];

    it('is not kept by the Symbolic dream filter', () => {
      expect(applyFilters(journal, { dreamType: 'Symbolic Dream' }).map((dream) => dream.title)).toEqual(['Mirror Dream']);
      expect(filterByDreamType(journal, 'Symbolic Dream').map((dream) => dream.title)).toEqual(['Mirror Dream']);
    });

    it('does not offer a Symbolic dream filter on its own', () => {
      expect(getUniqueDreamTypes(mockDreams)).toEqual(['Lucid Dream', 'Nightmare']);
      expect(getUniqueDreamTypes(journal)).toEqual(['Lucid Dream', 'Nightmare', 'Symbolic Dream']);
    });

    it('is not found by searching for its type', () => {
      const resolver = (dreamType: DreamType | null | undefined) => (dreamType === 'Symbolic Dream' ? 'Rêve symbolique' : undefined);
      expect(filterBySearch(journal, 'symbolic').map((dream) => dream.title)).toEqual(['Mirror Dream']);
      expect(filterBySearch(journal, 'symbolique', { dreamTypeLabelResolver: resolver }).map((dream) => dream.title)).toEqual(['Mirror Dream']);
      expect(filterBySearch([legacy], 'swimming')).toEqual([legacy]);
    });
  });
});
