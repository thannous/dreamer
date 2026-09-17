import { describe, expect, it } from '@jest/globals';

import { applyFilters } from '../dreamFilters';
import type { DreamAnalysis } from '../types';

function makeDream(partial: Partial<DreamAnalysis> & { id: number }): DreamAnalysis {
  return {
    id: partial.id,
    remoteId: partial.remoteId,
    transcript: partial.transcript ?? '',
    title: partial.title ?? '',
    interpretation: partial.interpretation ?? '',
    shareableQuote: partial.shareableQuote ?? '',
    imageUrl: partial.imageUrl ?? 'https://example.com/image.jpg',
    thumbnailUrl: partial.thumbnailUrl,
    chatHistory: partial.chatHistory ?? [],
    theme: partial.theme,
    dreamType: partial.dreamType ?? 'Symbolic Dream',
    isFavorite: partial.isFavorite,
    imageGenerationFailed: partial.imageGenerationFailed,
    pendingSync: partial.pendingSync,
    isAnalyzed: partial.isAnalyzed,
    analyzedAt: partial.analyzedAt,
    analysisStatus: partial.analysisStatus,
    analysisRequestId: partial.analysisRequestId,
    explorationStartedAt: partial.explorationStartedAt,
    memory: partial.memory,
  };
}

describe('Journal filters - analyzedOnly / exploredOnly', () => {
  const dreams: DreamAnalysis[] = [
    makeDream({
      id: 1,
      title: 'Analyzed & explored',
      isAnalyzed: true,
      analysisStatus: 'done',
      analyzedAt: 1000,
      interpretation: 'A complete reading.',
      explorationStartedAt: 1000,
    }),
    makeDream({
      id: 2,
      title: 'Analyzed only',
      isAnalyzed: true,
      analysisStatus: 'done',
      analyzedAt: 2000,
      interpretation: 'A complete reading.',
    }),
    makeDream({
      id: 3,
      title: 'Unanalyzed',
      isAnalyzed: false,
    }),
  ];

  it('returns only explored dreams when exploredOnly is true', () => {
    const result = applyFilters(dreams, { exploredOnly: true });
    expect(result.map((d) => d.id)).toEqual([1]);
  });

  it('returns only analyzed dreams when analyzedOnly is true', () => {
    const result = applyFilters(dreams, { analyzedOnly: true });
    expect(result.map((d) => d.id)).toEqual([1, 2]);
  });

  it('combines analyzedOnly and exploredOnly as logical AND', () => {
    const result = applyFilters(dreams, { analyzedOnly: true, exploredOnly: true });
    expect(result.map((d) => d.id)).toEqual([1]);
  });

  it('keeps all dreams when flags are not set', () => {
    const result = applyFilters(dreams, {});
    expect(result.map((d) => d.id)).toEqual([1, 2, 3]);
  });

  it('returns only remembered dreams when rememberedOnly is true', () => {
    const result = applyFilters([
      makeDream({
        id: 1,
        title: 'Anchor memory',
        memory: {
          origin: 'remembered',
          rememberedKind: 'recurring',
        },
      }),
      makeDream({
        id: 2,
        title: 'Fresh dream',
      }),
    ], { rememberedOnly: true });

    expect(result.map((d) => d.id)).toEqual([1]);
  });

  it('returns only analyzed and unexplored dreams when needsExplorationOnly is true', () => {
    const result = applyFilters(dreams, { needsExplorationOnly: true });
    expect(result.map((d) => d.id)).toEqual([2]);
  });

  it('applies analysisStatus unanalyzed/analyzed/explored strictly', () => {
    expect(applyFilters(dreams, { analysisStatus: 'unanalyzed' }).map((d) => d.id)).toEqual([3]);
    expect(applyFilters(dreams, { analysisStatus: 'analyzed' }).map((d) => d.id)).toEqual([1, 2]);
    expect(applyFilters(dreams, { analysisStatus: 'explored' }).map((d) => d.id)).toEqual([1]);
  });

  it('searches remembered dream metadata through localized labels', () => {
    const result = applyFilters([
      makeDream({
        id: 1,
        title: 'Old room',
        memory: {
          origin: 'remembered',
          rememberedKind: 'nightmare',
          approximatePeriod: 'childhood',
          strongestFragment: 'fear',
        },
      }),
      makeDream({
        id: 2,
        title: 'Beach',
      }),
    ], { searchQuery: 'enfance' }, {
      searchOptions: {
        dreamMemoryLabelResolver: (_field, value) => {
          const labels: Record<string, string> = {
            childhood: 'Enfance',
            fear: 'La peur',
            nightmare: 'Cauchemar',
          };
          return labels[value];
        },
      },
    });

    expect(result.map((d) => d.id)).toEqual([1]);
  });
});

describe('Journal filters - combinable advanced + quick access', () => {
  it('intersects favorites, theme, remembered, recurrence, type, analysis status and search', () => {
    const matching = makeDream({
      id: 20,
      title: 'Harbor lantern',
      isFavorite: true,
      theme: 'noir',
      dreamType: 'Nightmare',
      isAnalyzed: true,
      analysisStatus: 'done',
      analyzedAt: 1000,
      interpretation: 'A complete reading.',
      memory: { origin: 'remembered', rememberedKind: 'recurring', recurring: true },
    });
    const dreams: DreamAnalysis[] = [
      matching,
      makeDream({
        id: 21,
        title: 'Harbor lantern',
        isFavorite: true,
        theme: 'noir',
        dreamType: 'Nightmare',
        isAnalyzed: true,
        analysisStatus: 'done',
        analyzedAt: 1000,
        interpretation: 'A complete reading.',
        memory: { origin: 'remembered' },
      }),
      makeDream({
        id: 22,
        title: 'Harbor lantern',
        isFavorite: true,
        theme: 'noir',
        dreamType: 'Symbolic Dream',
        isAnalyzed: true,
        analysisStatus: 'done',
        analyzedAt: 1000,
        interpretation: 'A complete reading.',
        memory: { origin: 'remembered', rememberedKind: 'recurring', recurring: true },
      }),
    ];

    const result = applyFilters(dreams, {
      searchQuery: 'Harbor',
      theme: 'noir',
      dreamType: 'Nightmare',
      favoritesOnly: true,
      rememberedOnly: true,
      recurringOnly: true,
      analysisStatus: 'analyzed',
    });

    expect(result.map((dream) => dream.id)).toEqual([20]);
  });

  it('intersects favorites, theme, remembered, analysis status and search', () => {
    const matching = makeDream({
      id: 10,
      title: 'Harbor lantern',
      isFavorite: true,
      theme: 'noir',
      isAnalyzed: true,
      analysisStatus: 'done',
      analyzedAt: 1000,
      interpretation: 'A complete reading.',
      memory: { origin: 'remembered', rememberedKind: 'recurring' },
    });
    const dreams: DreamAnalysis[] = [
      matching,
      makeDream({
        id: 11,
        title: 'Harbor lantern',
        isFavorite: false,
        theme: 'noir',
        memory: { origin: 'remembered' },
      }),
      makeDream({
        id: 12,
        title: 'Harbor lantern',
        isFavorite: true,
        theme: 'calm',
        isAnalyzed: true,
        analysisStatus: 'done',
        analyzedAt: 1000,
        interpretation: 'A complete reading.',
        memory: { origin: 'remembered' },
      }),
    ];

    const result = applyFilters(dreams, {
      searchQuery: 'Harbor',
      theme: 'noir',
      favoritesOnly: true,
      rememberedOnly: true,
      analysisStatus: 'analyzed',
    });

    expect(result.map((dream) => dream.id)).toEqual([10]);
  });
});
