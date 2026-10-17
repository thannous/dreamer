import { buildSymbolIndex } from '../symbolLinks';
import { getPeriodSymbols } from '../trendsSymbols';
import type { DreamAnalysis, DreamSymbolInsight } from '../types';

// Isolation control: the web journey's mock readings all fall inside the period. A symbol
// that came back before the period, and not within it, must not read as returning now.

const night = (day: number, symbols: DreamSymbolInsight[]): DreamAnalysis => ({
  id: Date.UTC(2026, 9, day, 6),
  transcript: 'x',
  title: `Dream ${day}`,
  interpretation: 'Reading',
  shareableQuote: '',
  imageUrl: '',
  chatHistory: [],
  dreamType: 'Symbolic Dream',
  isAnalyzed: true,
  analysisStatus: 'done',
  symbols,
});

const water = { name: 'Water', meaning: 'Calm.', symbolId: 'water' };
const cat = { name: 'Cat', meaning: 'Waiting.', symbolId: 'cat' };
const lamp = { name: 'Lamp', meaning: 'Mine.', key: 'grandmother-lamp' };

describe('getPeriodSymbols', () => {
  it('counts only the period’s dreams and keeps the symbols that came back in it', () => {
    const dreams = [
      night(1, [cat]),
      night(2, [cat]),
      night(10, [cat, water]),
      night(12, [water, lamp]),
      night(14, [water, lamp]),
    ];
    const index = buildSymbolIndex(dreams, 'en');
    const period = dreams.slice(2).map((dream) => dream.id);

    expect(getPeriodSymbols(index, period).map(({ symbol, count }) => [symbol.linkKey, count])).toEqual([
      ['d:water', 3],
      ['p:grandmother-lamp', 2],
    ]);
  });
});
