import { describe, expect, it } from '@jest/globals';

import { buildDreamProfile } from '../dreamProfile';
import type { DreamAnalysis } from '../types';

const buildDream = (overrides: Partial<DreamAnalysis> = {}): DreamAnalysis => ({
  id: 1,
  transcript: 'Dream',
  title: 'Dream',
  interpretation: '',
  shareableQuote: '',
  imageUrl: '',
  dreamType: 'Symbolic Dream',
  chatHistory: [],
  ...overrides,
});

describe('dreamProfile', () => {
  it('returns an empty profile with anchor prompt as next action', () => {
    const profile = buildDreamProfile([]);

    expect(profile.readiness).toBe('empty');
    expect(profile.totalDreams).toBe(0);
    expect(profile.nextAction).toBe('add_anchor');
  });

  it('counts remembered anchor dreams and strongest fragments', () => {
    const profile = buildDreamProfile([
      buildDream({
        id: 3,
        dreamType: 'Recurring Dream',
        memory: {
          origin: 'remembered',
          anchorDream: true,
          dejaVu: true,
          rememberedKind: 'recurring',
          strongestFragment: 'place',
        },
      }),
      buildDream({
        id: 2,
        dreamType: 'Nightmare',
        memory: {
          origin: 'remembered',
          rememberedKind: 'nightmare',
          strongestFragment: 'fear',
        },
      }),
      buildDream({
        id: 1,
        dreamType: 'Symbolic Dream',
        theme: 'calm',
      }),
    ]);

    expect(profile.readiness).toBe('living');
    expect(profile.rememberedDreams).toBe(2);
    expect(profile.anchorDreams).toBe(1);
    expect(profile.recurringDreams).toBe(1);
    expect(profile.hasAnchorDream).toBe(true);
    expect(profile.hasEnoughForPatterns).toBe(true);
    expect(profile.topFragments.map((facet) => facet.value)).toEqual(['fear', 'place']);
  });

  it('prioritizes analysis before exploration once enough dreams exist', () => {
    const profile = buildDreamProfile([
      buildDream({
        id: 3,
        isAnalyzed: true,
        analyzedAt: 3,
        analysisStatus: 'done',
        interpretation: 'Analysis',
        memory: { origin: 'remembered', anchorDream: true, dejaVu: true },
      }),
      buildDream({
        id: 2,
        isAnalyzed: true,
        analyzedAt: 2,
        analysisStatus: 'done',
        interpretation: 'Analysis',
      }),
      buildDream({ id: 1, isAnalyzed: false, analysisStatus: 'none' }),
    ]);

    expect(profile.nextAction).toBe('analyze_unanalyzed');
  });

  it('prompts exploration when all dreams are analyzed but not explored', () => {
    const profile = buildDreamProfile([
      buildDream({
        id: 3,
        isAnalyzed: true,
        analyzedAt: 3,
        analysisStatus: 'done',
        interpretation: 'Analysis',
        memory: { origin: 'remembered', anchorDream: true, dejaVu: true },
      }),
      buildDream({
        id: 2,
        isAnalyzed: true,
        analyzedAt: 2,
        analysisStatus: 'done',
        interpretation: 'Analysis',
      }),
      buildDream({
        id: 1,
        isAnalyzed: true,
        analyzedAt: 1,
        analysisStatus: 'done',
        interpretation: 'Analysis',
      }),
    ]);

    expect(profile.nextAction).toBe('explore_more');
  });
});
