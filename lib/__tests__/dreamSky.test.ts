import { buildDreamSky, MAX_SKY_STARS } from '../dreamSky';
import { buildSymbolIndex } from '../symbolLinks';
import { getPeriodSymbols } from '../trendsSymbols';
import type { DreamAnalysis, DreamSymbolInsight } from '../types';

// A constellation must join only the dreams the sky shows, in the order they came: a line
// drawn to a dream outside the period would point at a star that is not there.

const night = (day: number, symbols: DreamSymbolInsight[], analyzed = true): DreamAnalysis => ({
  id: new Date(2026, 9, day, 6).getTime(),
  ...(analyzed ? { analyzedAt: new Date(2026, 9, day, 7).getTime() } : {}),
  transcript: 'x',
  title: `Dream ${day}`,
  interpretation: analyzed ? 'Reading' : '',
  shareableQuote: '',
  imageUrl: '',
  chatHistory: [],
  dreamType: 'Symbolic Dream',
  isAnalyzed: analyzed,
  analysisStatus: analyzed ? 'done' : 'none',
  symbols,
});

const water = { name: 'Water', meaning: 'Calm.', symbolId: 'water' };
const cat = { name: 'Cat', meaning: 'Waiting.', symbolId: 'cat' };

describe('buildDreamSky', () => {
  it('draws each dream of the period once and joins a returning symbol through them, oldest first', () => {
    const dreams = [
      night(14, [water]),
      night(2, [water, cat]),
      night(10, [cat]),
      night(12, [water, cat]),
      night(13, [], false),
    ];
    const period = dreams.filter((dream) => new Date(dream.id).getDate() >= 10);
    const index = buildSymbolIndex(dreams, 'en');
    const symbols = getPeriodSymbols(index, period.filter((dream) => dream.isAnalyzed).map((dream) => dream.id));
    const range = { start: new Date(2026, 9, 10).getTime(), end: new Date(2026, 9, 14).getTime() };

    const sky = buildDreamSky(dreams, range, symbols);

    expect(sky.stars.map((star) => new Date(star.dream.id).getDate())).toEqual([10, 12, 13, 14]);
    expect(sky.stars.map((star) => star.analyzed)).toEqual([true, true, false, true]);
    expect(sky.stars.every((star) => star.x > 0 && star.x < 1 && star.y >= 0 && star.y < 1)).toBe(true);
    const joined = Object.fromEntries(sky.constellations.map(({ symbol, stars }) => [
      symbol.linkKey,
      stars.map((at) => new Date(sky.stars[at].dream.id).getDate()),
    ]));
    // The dream of the 2nd is outside the period: neither symbol reaches back to it.
    expect(joined).toEqual({ 'd:water': [12, 14], 'd:cat': [10, 12] });
  });

  it('keeps every dream at its height from one period to the next', () => {
    const dreams = [night(10, []), night(12, [])];
    const week = buildDreamSky(dreams, { start: new Date(2026, 9, 8).getTime(), end: new Date(2026, 9, 14).getTime() }, []);
    const month = buildDreamSky(dreams, { start: new Date(2026, 8, 15).getTime(), end: new Date(2026, 9, 14).getTime() }, []);

    expect(month.stars.map((star) => star.y)).toEqual(week.stars.map((star) => star.y));
    expect(month.stars[0].x).toBeGreaterThan(week.stars[0].x);
  });

  it('draws the newest dreams once the sky is full, from the first night it still shows', () => {
    const first = new Date(2024, 0, 1, 6);
    const dreams = Array.from({ length: 2 * MAX_SKY_STARS }, (_, day) => ({
      ...night(1, []),
      id: new Date(first.getFullYear(), first.getMonth(), first.getDate() + day, 6).getTime(),
    }));
    const last = new Date(dreams[dreams.length - 1].id);
    const range = {
      start: new Date(2024, 0, 1).getTime(),
      end: new Date(last.getFullYear(), last.getMonth(), last.getDate()).getTime(),
    };

    const sky = buildDreamSky(dreams, range, []);

    expect(sky.total).toBe(2 * MAX_SKY_STARS);
    expect(sky.stars).toHaveLength(MAX_SKY_STARS);
    expect(sky.stars[0].dream.id).toBe(dreams[MAX_SKY_STARS].id);
    // Measured from the period's start, the first star drawn would sit halfway across.
    expect(sky.stars[0].x).toBeLessThan(0.01);
    expect(sky.stars[MAX_SKY_STARS - 1].x).toBeGreaterThan(0.99);
  });
});
