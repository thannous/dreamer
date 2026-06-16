import { describe, expect, it } from '@jest/globals';

import {
  EXPLORATION_360_AXES,
  getExploration360Progress,
  getExploration360SynthesisStatus,
  getNextExploration360Axis,
  hasExploration360Synthesis,
} from '../exploration360';
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

describe('exploration360', () => {
  it('exposes the three guided exploration axes in product order', () => {
    expect(EXPLORATION_360_AXES.map((axis) => axis.id)).toEqual([
      'symbols',
      'emotions',
      'growth',
    ]);
  });

  it('returns empty progress for a dream without category replies', () => {
    const progress = getExploration360Progress(buildDream());

    expect(progress.completedCount).toBe(0);
    expect(progress.totalCount).toBe(3);
    expect(progress.isComplete).toBe(false);
    expect(progress.nextAxis?.id).toBe('symbols');
  });

  it('marks an axis complete only after a non-error model reply', () => {
    const dream = buildDream({
      chatHistory: [
        {
          id: 'u1',
          role: 'user',
          text: 'Tell me about symbols',
          meta: { category: 'symbols' },
        },
        {
          id: 'm1',
          role: 'model',
          text: 'The river may represent movement.',
        },
      ],
    });

    const progress = getExploration360Progress(dream);

    expect(progress.completedCount).toBe(1);
    expect(progress.axes.find((axis) => axis.id === 'symbols')?.completed).toBe(true);
    expect(progress.nextAxis?.id).toBe('emotions');
  });

  it('returns null next axis when all axes are complete', () => {
    const dream = buildDream({
      chatHistory: [
        { id: 'u1', role: 'user', text: 'symbols', meta: { category: 'symbols' } },
        { id: 'm1', role: 'model', text: 'Symbol reply' },
        { id: 'u2', role: 'user', text: 'emotions', meta: { category: 'emotions' } },
        { id: 'm2', role: 'model', text: 'Emotion reply' },
        { id: 'u3', role: 'user', text: 'growth', meta: { category: 'growth' } },
        { id: 'm3', role: 'model', text: 'Growth reply' },
      ],
    });

    expect(getExploration360Progress(dream).isComplete).toBe(true);
    expect(getNextExploration360Axis(dream)).toBeNull();
  });

  it('unlocks synthesis only after all three axes are complete', () => {
    const partialDream = buildDream({
      chatHistory: [
        { id: 'u1', role: 'user', text: 'symbols', meta: { category: 'symbols' } },
        { id: 'm1', role: 'model', text: 'Symbol reply' },
      ],
    });
    const completeDream = buildDream({
      chatHistory: [
        { id: 'u1', role: 'user', text: 'symbols', meta: { category: 'symbols' } },
        { id: 'm1', role: 'model', text: 'Symbol reply' },
        { id: 'u2', role: 'user', text: 'emotions', meta: { category: 'emotions' } },
        { id: 'm2', role: 'model', text: 'Emotion reply' },
        { id: 'u3', role: 'user', text: 'growth', meta: { category: 'growth' } },
        { id: 'm3', role: 'model', text: 'Growth reply' },
      ],
    });

    expect(getExploration360SynthesisStatus(partialDream).canGenerateSynthesis).toBe(false);
    expect(getExploration360SynthesisStatus(completeDream).canGenerateSynthesis).toBe(true);
  });

  it('detects a generated 360 synthesis after a successful model reply', () => {
    const dream = buildDream({
      chatHistory: [
        { id: 'u1', role: 'user', text: 'symbols', meta: { category: 'symbols' } },
        { id: 'm1', role: 'model', text: 'Symbol reply' },
        { id: 'u2', role: 'user', text: 'emotions', meta: { category: 'emotions' } },
        { id: 'm2', role: 'model', text: 'Emotion reply' },
        { id: 'u3', role: 'user', text: 'growth', meta: { category: 'growth' } },
        { id: 'm3', role: 'model', text: 'Growth reply' },
        { id: 'u4', role: 'user', text: 'Synthesis', meta: { exploration360Synthesis: true } },
        { id: 'm4', role: 'model', text: 'Final synthesis' },
      ],
    });

    const status = getExploration360SynthesisStatus(dream);

    expect(hasExploration360Synthesis(dream)).toBe(true);
    expect(status.hasSynthesis).toBe(true);
    expect(status.canGenerateSynthesis).toBe(false);
  });

  it('does not treat a failed synthesis response as final', () => {
    const dream = buildDream({
      chatHistory: [
        { id: 'u1', role: 'user', text: 'Synthesis', meta: { exploration360Synthesis: true } },
        { id: 'm1', role: 'model', text: 'Sorry', meta: { isError: true } },
      ],
    });

    expect(hasExploration360Synthesis(dream)).toBe(false);
  });
});
