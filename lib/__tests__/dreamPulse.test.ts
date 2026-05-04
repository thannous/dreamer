import { getDreamPulse } from '../dreamPulse';
import type { DreamAnalysis } from '../types';

function dream(overrides: Partial<DreamAnalysis>): DreamAnalysis {
  return {
    id: Date.UTC(2026, 0, 1),
    transcript: 'I saw a quiet shore.',
    title: 'Quiet shore',
    interpretation: '',
    shareableQuote: '',
    imageUrl: '',
    chatHistory: [],
    dreamType: 'Symbolic Dream',
    ...overrides,
  };
}

describe('getDreamPulse', () => {
  const now = Date.UTC(2026, 4, 4, 12);

  it('returns empty state without dreams', () => {
    expect(getDreamPulse([], now)).toEqual({
      state: 'empty',
      totalCount: 0,
      analyzedCount: 0,
      favoriteCount: 0,
      lastDreamAt: null,
      daysSinceLastDream: null,
    });
  });

  it('returns today state when the latest dream is from today', () => {
    const pulse = getDreamPulse([
      dream({ id: Date.UTC(2026, 4, 4, 7), isAnalyzed: true }),
      dream({ id: Date.UTC(2026, 4, 1, 7), isFavorite: true }),
    ], now);

    expect(pulse.state).toBe('today');
    expect(pulse.totalCount).toBe(2);
    expect(pulse.analyzedCount).toBe(1);
    expect(pulse.favoriteCount).toBe(1);
    expect(pulse.daysSinceLastDream).toBe(0);
  });

  it('returns stale state after three days without a dream', () => {
    const pulse = getDreamPulse([
      dream({ id: Date.UTC(2026, 4, 1, 7), isAnalyzed: true }),
    ], now);

    expect(pulse.state).toBe('stale');
    expect(pulse.daysSinceLastDream).toBe(3);
  });

  it('returns analyze state for recent unanalyzed dreams', () => {
    const pulse = getDreamPulse([
      dream({ id: Date.UTC(2026, 4, 3, 7), isAnalyzed: false }),
      dream({ id: Date.UTC(2026, 4, 2, 7), analysisStatus: 'done' }),
    ], now);

    expect(pulse.state).toBe('analyze');
    expect(pulse.analyzedCount).toBe(1);
  });
});
