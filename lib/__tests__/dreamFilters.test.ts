/**
 * BDD-style tests for dreamFilters utility functions
 * Tests dream filtering, sorting, and data extraction functionality
 */
import { describe, expect, it, vi } from 'vitest';
import {
    applyFilters,
    filterByDateRange,
    filterByDreamType,
    filterByFavorites,
    filterBySearch,
    filterByTheme,
    getUniqueDreamTypes,
    getUniqueThemes,
    sortDreamsByDate,
    type DreamFilters,
} from '../dreamFilters';
import type { DreamAnalysis, DreamTheme, DreamType } from '../types';

// Mock the dreamUsage functions
vi.mock('../dreamUsage', () => ({
  isDreamAnalyzed: vi.fn((dream: DreamAnalysis) => Boolean(dream.isAnalyzed && typeof dream.analyzedAt === 'number')),
  isDreamExplored: vi.fn((dream: DreamAnalysis) => Boolean(dream.explorationStartedAt)),
}));

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
      // Given
      const query = '   '; // whitespace only

      // When
      const result = filterBySearch(mockDreams, query);

      // Then
      expect(result).toEqual(mockDreams);
    });

    it('given search term matching title when filtering then returns matching dreams', () => {
      // Given
      const query = 'Flying';

      // When
      const result = filterBySearch(mockDreams, query);

      // Then
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Flying Dream');
    });

    it('given search term matching transcript when filtering then returns matching dreams', () => {
      // Given
      const query = 'swimming';

      // When
      const result = filterBySearch(mockDreams, query);

      // Then
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Water Dream');
    });

    it('given search term matching interpretation when filtering then returns matching dreams', () => {
      // Given
      const query = 'freedom';

      // When
      const result = filterBySearch(mockDreams, query);

      // Then
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Flying Dream');
    });

    it('given search term matching dream type when filtering then returns matching dreams', () => {
      // Given
      const query = 'nightmare';

      // When
      const result = filterBySearch(mockDreams, query);

      // Then
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Falling Dream');
    });

    it('given localized dream type label when filtering then returns matching dreams', () => {
      // Given
      const query = 'cauchemar';

      // When
      const result = filterBySearch(mockDreams, query, {
        dreamTypeLabelResolver: (dreamType) => (dreamType === 'Nightmare' ? 'Cauchemar' : undefined),
      });

      // Then
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Falling Dream');
    });

    it('given search term with different case when filtering then returns matching dreams', () => {
      // Given
      const query = 'FLYING';

      // When
      const result = filterBySearch(mockDreams, query);

      // Then
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Flying Dream');
    });

    it('given search term with no matches when filtering then returns empty array', () => {
      // Given
      const query = 'nonexistent';

      // When
      const result = filterBySearch(mockDreams, query);

      // Then
      expect(result).toHaveLength(0);
    });

    it('given multi-word query spanning fields when filtering then matches via joined text', () => {
      // Given
      const dreams: DreamAnalysis[] = [
        buildDream({
          title: 'Hello',
          transcript: 'World',
          interpretation: '',
          dreamType: 'Symbolic Dream',
        }),
      ];
      const query = 'hello world';

      // When
      const result = filterBySearch(dreams, query);

      // Then
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Hello');
    });

    it('given a resolver when title already matches then does not resolve localized labels', () => {
      // Given
      const resolver = vi.fn(() => 'Should not be called');
      const dreams: DreamAnalysis[] = [
        buildDream({ title: 'Needle A', dreamType: 'Nightmare' }),
        buildDream({ title: 'Needle B', dreamType: 'Nightmare' }),
      ];
      const query = 'needle';

      // When
      const result = filterBySearch(dreams, query, { dreamTypeLabelResolver: resolver });

      // Then
      expect(result).toHaveLength(2);
      expect(resolver).not.toHaveBeenCalled();
    });
  });

  describe('filterByTheme', () => {
    it('given null theme when filtering then returns all dreams', () => {
      // Given
      const theme = null;

      // When
      const result = filterByTheme(mockDreams, theme);

      // Then
      expect(result).toEqual(mockDreams);
    });

    it('given valid theme when filtering then returns dreams with that theme', () => {
      // Given
      const theme = 'surreal';

      // When
      const result = filterByTheme(mockDreams, theme);

      // Then
      expect(result).toHaveLength(1);
      expect(result[0].theme).toBe('surreal');
    });

    it('given theme with no matches when filtering then returns empty array', () => {
      // Given
      const theme = 'nonexistent' as DreamTheme;

      // When
      const result = filterByTheme(mockDreams, theme);

      // Then
      expect(result).toHaveLength(0);
    });
  });

  describe('filterByDreamType', () => {
    it('given null dream type when filtering then returns all dreams', () => {
      // Given
      const dreamType = null;

      // When
      const result = filterByDreamType(mockDreams, dreamType);

      // Then
      expect(result).toEqual(mockDreams);
    });

    it('given valid dream type when filtering then returns dreams with that type', () => {
      // Given
      const dreamType: DreamType = 'Lucid Dream';

      // When
      const result = filterByDreamType(mockDreams, dreamType);

      // Then
      expect(result).toHaveLength(1);
      expect(result[0].dreamType).toBe('Lucid Dream');
    });

    it('given dream type with no matches when filtering then returns empty array', () => {
      // Given
      const dreamType = 'nonexistent' as DreamType;

      // When
      const result = filterByDreamType(mockDreams, dreamType);

      // Then
      expect(result).toHaveLength(0);
    });
  });

  describe('filterByFavorites', () => {
    it('given favoritesOnly false when filtering then returns all dreams', () => {
      // Given
      const favoritesOnly = false;

      // When
      const result = filterByFavorites(mockDreams, favoritesOnly);

      // Then
      expect(result).toEqual(mockDreams);
    });

    it('given favoritesOnly true when filtering then returns only favorite dreams', () => {
      // Given
      const favoritesOnly = true;

      // When
      const result = filterByFavorites(mockDreams, favoritesOnly);

      // Then
      expect(result).toHaveLength(1);
      expect(result[0].isFavorite).toBe(true);
      expect(result[0].title).toBe('Falling Dream');
    });
  });

  describe('filterByDateRange', () => {
    it('given null start and end dates when filtering then returns all dreams', () => {
      // Given
      const startDate = null;
      const endDate = null;

      // When
      const result = filterByDateRange(mockDreams, startDate, endDate);

      // Then
      expect(result).toEqual(mockDreams);
    });

    it('given start date only when filtering then returns dreams after start date', () => {
      // Given
      const startDate = new Date('2021-12-21');
      const endDate = null;

      // When
      const result = filterByDateRange(mockDreams, startDate, endDate);

      // Then
      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('Falling Dream');
      expect(result[1].title).toBe('Water Dream');
    });

    it('given end date only when filtering then returns dreams before end date', () => {
      // Given
      const startDate = null;
      const endDate = new Date('2021-12-21');

      // When
      const result = filterByDateRange(mockDreams, startDate, endDate);

      // Then
      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('Flying Dream');
      expect(result[1].title).toBe('Falling Dream');
    });

    it('given date range when filtering then returns dreams within range', () => {
      // Given
      const startDate = new Date('2021-12-21');
      const endDate = new Date('2021-12-21');

      // When
      const result = filterByDateRange(mockDreams, startDate, endDate);

      // Then
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Falling Dream');
    });

    it('given date range with end date when filtering then includes dreams up to end of day', () => {
      // Given
      const startDate = new Date('2021-12-20');
      const endDate = new Date('2021-12-21');

      // When
      const result = filterByDateRange(mockDreams, startDate, endDate);

      // Then
      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('Flying Dream');
      expect(result[1].title).toBe('Falling Dream');
    });
  });

  describe('applyFilters', () => {
    it('given empty filters when applying then returns all dreams', () => {
      // Given
      const filters: DreamFilters = {};

      // When
      const result = applyFilters(mockDreams, filters);

      // Then
      expect(result).toEqual(mockDreams);
    });

    it('given search filter when applying then returns filtered dreams', () => {
      // Given
      const filters: DreamFilters = { searchQuery: 'Flying' };

      // When
      const result = applyFilters(mockDreams, filters);

      // Then
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Flying Dream');
    });

    it('given localized search term and resolver when applying then returns filtered dreams', () => {
      // Given
      const filters: DreamFilters = { searchQuery: 'pesadilla' };

      // When
      const result = applyFilters(mockDreams, filters, {
        searchOptions: {
          dreamTypeLabelResolver: (dreamType) => (dreamType === 'Nightmare' ? 'Pesadilla' : undefined),
        },
      });

      // Then
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Falling Dream');
    });

    it('given theme filter when applying then returns filtered dreams', () => {
      // Given
      const filters: DreamFilters = { theme: 'surreal' };

      // When
      const result = applyFilters(mockDreams, filters);

      // Then
      expect(result).toHaveLength(1);
      expect(result[0].theme).toBe('surreal');
    });

    it('given dream type filter when applying then returns filtered dreams', () => {
      // Given
      const filters: DreamFilters = { dreamType: 'Nightmare' };

      // When
      const result = applyFilters(mockDreams, filters);

      // Then
      expect(result).toHaveLength(1);
      expect(result[0].dreamType).toBe('Nightmare');
    });

    it('given favorites filter when applying then returns filtered dreams', () => {
      // Given
      const filters: DreamFilters = { favoritesOnly: true };

      // When
      const result = applyFilters(mockDreams, filters);

      // Then
      expect(result).toHaveLength(1);
      expect(result[0].isFavorite).toBe(true);
    });

    it('given analyzed only filter when applying then returns analyzed dreams', () => {
      // Given
      const filters: DreamFilters = { analyzedOnly: true };

      // When
      const result = applyFilters(mockDreams, filters);

      // Then
      expect(result).toHaveLength(2);
      expect(result.every(dream => dream.isAnalyzed)).toBe(true);
    });

    it('given explored only filter when applying then returns explored dreams', () => {
      // Given
      const filters: DreamFilters = { exploredOnly: true };

      // When
      const result = applyFilters(mockDreams, filters);

      // Then
      expect(result).toHaveLength(1);
      expect(result[0].explorationStartedAt).toBeDefined();
    });

    it('given date range filter when applying then returns filtered dreams', () => {
      // Given
      const filters: DreamFilters = {
        startDate: new Date('2021-12-21'),
        endDate: new Date('2021-12-21'),
      };

      // When
      const result = applyFilters(mockDreams, filters);

      // Then
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Falling Dream');
    });

    it('given multiple filters when applying then returns dreams matching all criteria', () => {
      // Given
      const filters: DreamFilters = {
        theme: 'noir',
        dreamType: 'Nightmare',
        favoritesOnly: true,
        analyzedOnly: true,
        exploredOnly: true,
      };

      // When
      const result = applyFilters(mockDreams, filters);

      // Then
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Falling Dream');
    });
  });

  describe('sortDreamsByDate', () => {
    it('given dreams when sorting descending then returns dreams newest first', () => {
      // Given
      const ascending = false;

      // When
      const result = sortDreamsByDate(mockDreams, ascending);

      // Then
      expect(result[0].title).toBe('Water Dream'); // 2021-12-22
      expect(result[1].title).toBe('Falling Dream'); // 2021-12-21
      expect(result[2].title).toBe('Flying Dream'); // 2021-12-20
    });

    it('given dreams when sorting ascending then returns dreams oldest first', () => {
      // Given
      const ascending = true;

      // When
      const result = sortDreamsByDate(mockDreams, ascending);

      // Then
      expect(result[0].title).toBe('Flying Dream'); // 2021-12-20
      expect(result[1].title).toBe('Falling Dream'); // 2021-12-21
      expect(result[2].title).toBe('Water Dream'); // 2021-12-22
    });

    it('given empty array when sorting then returns empty array', () => {
      // Given
      const dreams: DreamAnalysis[] = [];

      // When
      const result = sortDreamsByDate(dreams);

      // Then
      expect(result).toHaveLength(0);
    });
  });

  describe('getUniqueThemes', () => {
    it('given dreams with themes when getting unique themes then returns sorted unique themes', () => {
      // Given
      const dreams = mockDreams;

      // When
      const result = getUniqueThemes(dreams);

      // Then
      expect(result).toEqual(['calm', 'noir', 'surreal']);
    });

    it('given dreams with null themes when getting unique themes then excludes null themes', () => {
      // Given
      const dreamsWithNullTheme = [
        ...mockDreams,
        {
          ...mockDreams[0],
          theme: undefined,
        },
      ];

      // When
      const result = getUniqueThemes(dreamsWithNullTheme);

      // Then
      expect(result).toEqual(['calm', 'noir', 'surreal']);
    });

    it('given empty array when getting unique themes then returns empty array', () => {
      // Given
      const dreams: DreamAnalysis[] = [];

      // When
      const result = getUniqueThemes(dreams);

      // Then
      expect(result).toHaveLength(0);
    });
  });

  describe('getUniqueDreamTypes', () => {
    it('given dreams with types when getting unique types then returns sorted unique types', () => {
      // Given
      const dreams = mockDreams;

      // When
      const result = getUniqueDreamTypes(dreams);

      // Then
      expect(result).toEqual(['Lucid Dream', 'Nightmare', 'Symbolic Dream']);
    });

    it('given dreams with null types when getting unique types then excludes null types', () => {
      // Given
      const dreamsWithNullType = [
        ...mockDreams,
        {
          ...mockDreams[0],
          dreamType: undefined as unknown as DreamType,
        },
      ];

      // When
      const result = getUniqueDreamTypes(dreamsWithNullType);

      // Then
      expect(result).toEqual(['Lucid Dream', 'Nightmare', 'Symbolic Dream']);
    });

    it('given empty array when getting unique types then returns empty array', () => {
      // Given
      const dreams: DreamAnalysis[] = [];

      // When
      const result = getUniqueDreamTypes(dreams);

      // Then
      expect(result).toHaveLength(0);
    });
  });
});
