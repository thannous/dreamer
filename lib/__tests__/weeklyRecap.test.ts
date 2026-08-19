import { buildWeeklyRecap } from '../weeklyRecap';
import type { DreamAnalysis } from '../types';

const DAY = 24 * 60 * 60 * 1000;
const now = new Date(2026, 7, 16, 9, 0).getTime(); // Sunday 16 Aug 2026 09:00 local

function dream(overrides: Partial<DreamAnalysis>): DreamAnalysis {
  return {
    id: now - DAY,
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

const analyzed = (overrides: Partial<DreamAnalysis>): DreamAnalysis =>
  dream({
    isAnalyzed: true,
    analysisStatus: 'done',
    analyzedAt: now,
    interpretation: 'A full reading.',
    ...overrides,
  });

describe('buildWeeklyRecap', () => {
  it('returns an empty recap without dreams', () => {
    const recap = buildWeeklyRecap([], now);
    expect(recap.dreamCount).toBe(0);
    expect(recap.previousWeekCount).toBe(0);
    expect(recap.topTheme).toBeNull();
    expect(recap.topEmotion).toBeNull();
    expect(recap.topSymbol).toBeNull();
    expect(recap.dreamToExplore).toBeNull();
    expect(recap.dreamToAnalyze).toBeNull();
    expect(recap.currentStreak).toBe(0);
  });

  it('aggregates the last seven days and compares with the previous week', () => {
    const dreams = [
      analyzed({ id: now - 1 * DAY, theme: 'calm', symbols: [{ name: 'Water', meaning: '' }, { name: 'Door', meaning: '' }], emotions: [{ name: 'fear', insight: '' }] }),
      analyzed({ id: now - 2 * DAY, theme: 'calm', symbols: [{ name: 'water', meaning: '' }], emotions: [{ name: 'fear', insight: '' }, { name: 'joy', insight: '' }] }),
      analyzed({ id: now - 3 * DAY, theme: 'noir', symbols: [{ name: 'Wolf', meaning: '' }], emotions: [{ name: 'joy', insight: '' }] }),
      dream({ id: now - 4 * DAY }), // not analyzed
      dream({ id: now - 9 * DAY }), // previous week
      dream({ id: now - 12 * DAY }), // previous week
      dream({ id: now - 20 * DAY }), // older
    ];

    const recap = buildWeeklyRecap(dreams, now);

    expect(recap.dreamCount).toBe(4);
    expect(recap.previousWeekCount).toBe(2);
    expect(recap.analyzedCount).toBe(3);
    expect(recap.topTheme).toEqual({ theme: 'calm', count: 2 });
    expect(recap.topSymbol).toEqual({ name: 'Water', count: 2 });
    expect(recap.topEmotion?.family).toBe('fear');
    expect(recap.dreamToExplore?.id).toBe(now - 1 * DAY);
    expect(recap.dreamToAnalyze?.id).toBe(now - 4 * DAY);
    expect(recap.currentStreak).toBe(4);
  });

  it('never surfaces a symbol or emotion seen in a single dream only', () => {
    const recap = buildWeeklyRecap([
      analyzed({ id: now - DAY, symbols: [{ name: 'Key', meaning: '' }], emotions: [{ name: 'fear', insight: '' }] }),
    ], now);
    expect(recap.topSymbol).toBeNull();
    expect(recap.topEmotion).toBeNull();
  });
});
