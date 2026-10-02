import { describe, expect, it } from '@jest/globals';

import {
  canUseExploration360Synthesis,
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

  it('unlocks a recap after one completed angle without requiring the other two', () => {
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

    expect(getExploration360SynthesisStatus(partialDream).canGenerateSynthesis).toBe(true);
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

  it('does not unlock a recap for a pending or failed angle', () => {
    const prompt = { id: 'u1', role: 'user' as const, text: 'symbols', meta: { category: 'symbols' as const } };
    expect(getExploration360SynthesisStatus(buildDream({ chatHistory: [prompt] })).canGenerateSynthesis).toBe(false);
    expect(getExploration360SynthesisStatus(buildDream({ chatHistory: [prompt,
      { id: 'm1', role: 'model', text: 'Network unavailable', meta: { isError: true } },
    ] })).canGenerateSynthesis).toBe(false);
  });

  it('allows refreshing a saved recap only after a successful new exchange', () => {
    const history: NonNullable<DreamAnalysis['chatHistory']> = [
      { id: 'u1', role: 'user', text: 'symbols', meta: { category: 'symbols' } },
      { id: 'm1', role: 'model', text: 'Symbol reply' },
      { id: 'u2', role: 'user', text: 'Recap', meta: { exploration360Synthesis: true } },
      { id: 'm2', role: 'model', text: 'Saved recap' },
    ];
    expect(getExploration360SynthesisStatus(buildDream({ chatHistory: history })).canGenerateSynthesis).toBe(false);
    const followUp = { id: 'u3', role: 'user' as const, text: 'What about my emotions?', meta: { category: 'emotions' as const } };
    expect(getExploration360SynthesisStatus(buildDream({ chatHistory: [...history, followUp] })).canGenerateSynthesis).toBe(false);
    expect(getExploration360SynthesisStatus(buildDream({ chatHistory: [...history, followUp,
      { id: 'm3', role: 'model', text: 'Failed reply', meta: { isError: true } },
    ] })).canGenerateSynthesis).toBe(false);
    const updated = [...history, followUp, { id: 'm3', role: 'model' as const, text: 'Emotional thread' }];
    expect(getExploration360SynthesisStatus(buildDream({ chatHistory: updated })).canGenerateSynthesis).toBe(true);
    expect(getExploration360SynthesisStatus(buildDream({ chatHistory: [...updated,
      { id: 'u4', role: 'user', text: 'Update recap', meta: { exploration360Synthesis: true } },
      { id: 'm4', role: 'model', text: 'Updated recap' },
    ] })).canGenerateSynthesis).toBe(false);
  });

  it('does not mistake a later unrelated answer for a missing recap reply', () => {
    const dream = buildDream({ chatHistory: [
      { id: 'u1', role: 'user', text: 'Recap', meta: { exploration360Synthesis: true } },
      { id: 'u2', role: 'user', text: 'symbols', meta: { category: 'symbols' } },
      { id: 'm2', role: 'model', text: 'A symbol answer, not a recap' },
    ] });
    expect(hasExploration360Synthesis(dream)).toBe(false);
    expect(getExploration360SynthesisStatus(dream).canGenerateSynthesis).toBe(true);
  });

  it('reserves final 360 synthesis generation for Plus users', () => {
    expect(canUseExploration360Synthesis('plus')).toBe(true);
    expect(canUseExploration360Synthesis('free')).toBe(false);
    expect(canUseExploration360Synthesis('guest')).toBe(false);
    expect(canUseExploration360Synthesis(undefined)).toBe(false);
  });
});
