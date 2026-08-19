import { buildPersonalReading } from '../personalReading';
import type { DreamAnalysis } from '../types';

const DAY = 24 * 60 * 60 * 1000;
const now = Date.UTC(2026, 7, 19, 12);

function dream(overrides: Partial<DreamAnalysis>): DreamAnalysis {
  return {
    id: now - DAY,
    transcript: 'x',
    title: 'Dream',
    interpretation: '',
    shareableQuote: '',
    imageUrl: '',
    chatHistory: [],
    dreamType: 'Symbolic Dream',
    ...overrides,
  };
}
const analyzed = (overrides: Partial<DreamAnalysis>) =>
  dream({ isAnalyzed: true, analysisStatus: 'done', analyzedAt: now, interpretation: 'Full', ...overrides });

describe('buildPersonalReading', () => {
  it('finds the symbol that repeats across analyzed dreams of the last 30 days', () => {
    const reading = buildPersonalReading([
      analyzed({ id: now - 1 * DAY, symbols: [{ name: 'Water', meaning: '' }] }),
      analyzed({ id: now - 5 * DAY, symbols: [{ name: 'water ', meaning: '' }, { name: 'Door', meaning: '' }] }),
      analyzed({ id: now - 40 * DAY, symbols: [{ name: 'Door', meaning: '' }] }),
    ], now);
    expect(reading.windowDreamCount).toBe(2);
    expect(reading.recurringSymbol).toEqual({ name: 'Water', count: 2 });
    expect(reading.recurringTheme).toBeNull();
  });

  it('falls back to a repeated theme and points to the next dream to explore or analyze', () => {
    const reading = buildPersonalReading([
      dream({ id: now - 1 * DAY, title: 'Fresh' }),
      analyzed({ id: now - 2 * DAY, title: 'Calm one', theme: 'calm' }),
      analyzed({ id: now - 3 * DAY, title: 'Calm two', theme: 'calm', chatHistory: [{ id: '1', role: 'user', content: 'hi', timestamp: now } as never] }),
    ], now);
    expect(reading.recurringSymbol).toBeNull();
    expect(reading.recurringTheme).toEqual({ theme: 'calm', count: 2 });
    expect(reading.dreamToAnalyze?.title).toBe('Fresh');
    expect(reading.dreamToExplore?.title).toBe('Calm one');
  });

  it('reports nothing recurring when only one dream is analyzed', () => {
    const reading = buildPersonalReading([analyzed({ id: now - DAY, symbols: [{ name: 'Key', meaning: '' }] })], now);
    expect(reading.analyzedInWindow).toBe(1);
    expect(reading.recurringSymbol).toBeNull();
    expect(reading.recurringTheme).toBeNull();
    expect(reading.dreamToExplore?.id).toBe(now - DAY);
  });
});
