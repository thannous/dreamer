import type { LinkedSymbol, SymbolIndex } from '@/lib/symbolLinks';
import type { DreamAnalysis, DreamTheme } from '@/lib/types';
import {
  canStillForm, getFormedWeeks, getWeekNights, nameWeek, startOfWeek, starHeight,
} from '@/lib/weekConstellations';

const at = (month: number, day: number, hour = 7) => new Date(2026, month - 1, day, hour).getTime();
const dream = (id: number, extra: Partial<DreamAnalysis> = {}): DreamAnalysis => ({
  id,
  transcript: 'x',
  title: `Dream ${id}`,
  interpretation: '',
  shareableQuote: '',
  imageUrl: '',
  chatHistory: [],
  dreamType: 'Symbolic Dream',
  ...extra,
});
const read = (id: number, theme?: DreamTheme) => dream(id, { isAnalyzed: true, analyzedAt: id + 1, interpretation: 'A reading', theme });
// Monday 19 October 2026 to Sunday 25.
const MONDAY = at(10, 19, 0);

it('opens each week on its Monday, Sunday included', () => {
  expect(startOfWeek(at(10, 19))).toBe(MONDAY);
  expect(startOfWeek(at(10, 25, 23))).toBe(MONDAY);
  expect(startOfWeek(at(10, 26, 0))).toBe(at(10, 26, 0));
});

it('counts the nights noted since Monday, two dreams of one night as one', () => {
  const week = getWeekNights([dream(at(10, 19)), dream(at(10, 19, 9)), dream(at(10, 21)), dream(at(10, 18))], at(10, 21, 20));
  expect(week.nights).toEqual([true, false, true, false, false, false, false]);
  expect(week.count).toBe(2);
  expect(week.dreams).toHaveLength(3);
  expect(week.formed).toBe(false);
});

it('forms at five nights, keeps every formed week, the newest first, and never a lesser one', () => {
  const thisWeek = [19, 20, 21, 23, 25].map((day) => dream(at(10, day)));
  const lastWeek = [12, 13, 14, 15, 16, 17].map((day) => dream(at(10, day)));
  const thin = [5, 6, 7, 8].map((day) => dream(at(10, day)));
  const weeks = getFormedWeeks([...thin, ...thisWeek, ...lastWeek]);
  expect(weeks.map((week) => [week.start, week.count])).toEqual([[MONDAY, 5], [at(10, 12, 0), 6]]);
});

it('stops promising a constellation once the days left cannot bring it', () => {
  const two = getWeekNights([dream(at(10, 19)), dream(at(10, 20))], at(10, 23, 9));
  // Two noted: Friday to Sunday still make five, Saturday and Sunday no longer do.
  expect(canStillForm(two, at(10, 23, 9))).toBe(true);
  expect(canStillForm(two, at(10, 24, 9))).toBe(false);
  const none = getWeekNights([], at(10, 23, 9));
  expect(canStillForm(none, at(10, 23, 9))).toBe(false);
  expect(canStillForm(none, at(10, 21, 9))).toBe(true);
});

describe('naming', () => {
  const symbol = (linkKey: string, kind: LinkedSymbol['kind'], dreams: DreamAnalysis[]): LinkedSymbol => ({
    linkKey, kind, name: linkKey, confirmed: false, companions: [],
    appearances: dreams.map((seen) => ({ dream: seen, insight: { symbol: linkKey, meaning: '' } as never })),
  });
  const index = (...symbols: LinkedSymbol[]): SymbolIndex => ({
    symbols: new Map(symbols.map((entry) => [entry.linkKey, entry])),
    dreamCount: 0,
    aliases: new Map(),
  });
  const days = [19, 20, 21, 22, 23].map((day) => read(at(10, day), day < 22 ? 'calm' : 'noir'));
  const week = getWeekNights(days, at(10, 25));

  it('takes the symbol its readings hold most, the latest then the dreamer’s own on a tie', () => {
    const sea = symbol('d:sea', 'dictionary', [days[0], days[1]]);
    const house = symbol('d:house', 'dictionary', [days[2], days[4]]);
    const mother = symbol('p:mother', 'personal', [days[0], days[4]]);
    expect(nameWeek(week, index(sea, mother, house))).toEqual({ symbol: mother });
    expect(nameWeek(week, index(sea, house))).toEqual({ symbol: house });
    // A symbol seen only in other weeks does not count.
    const elsewhere = symbol('d:key', 'dictionary', [read(at(10, 12)), read(at(10, 13)), read(at(10, 14))]);
    expect(nameWeek(week, index(elsewhere, sea))).toEqual({ symbol: sea });
  });

  it('falls back on the theme most of its dreams share, then on nothing', () => {
    expect(nameWeek(week, index())).toEqual({ theme: 'calm' });
    expect(nameWeek(week, null)).toEqual({ theme: 'calm' });
    expect(nameWeek(getWeekNights([19, 20, 21, 22, 23].map((day) => dream(at(10, day))), at(10, 25)), null)).toBeNull();
  });
});

it('scatters the stars the same way at every visit', () => {
  const heights = Array.from({ length: 7 }, (_, day) => starHeight(MONDAY, day));
  expect(heights.every((height) => height >= 0 && height < 1)).toBe(true);
  expect(new Set(heights).size).toBe(7);
  expect(starHeight(MONDAY, 3)).toBe(heights[3]);
});
