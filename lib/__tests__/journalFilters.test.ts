import { describe, expect, it } from 'vitest';

import { applyFilters } from '@/lib/dreamFilters';
import type { DreamAnalysis } from '@/lib/types';

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
  };
}

describe('Journal filters - analyzedOnly / exploredOnly', () => {
  const dreams: DreamAnalysis[] = [
    makeDream({
      id: 1,
      title: 'Analyzed & explored',
      isAnalyzed: true,
      analyzedAt: 1000,
      explorationStartedAt: 1000,
    }),
    makeDream({
      id: 2,
      title: 'Analyzed only',
      isAnalyzed: true,
      analyzedAt: 2000,
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
});
