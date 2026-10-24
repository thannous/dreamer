import { pickDreamAnniversary, upcomingAnniversaries } from '@/lib/dreamAnniversary';
import type { DreamAnalysis } from '@/lib/types';

const dream = (id: number, painted: boolean, title = `Dream ${id}`): DreamAnalysis => ({
  id,
  transcript: 'x',
  title,
  interpretation: '',
  shareableQuote: '',
  imageUrl: painted ? `https://paintings/${id}` : '',
  chatHistory: [],
  dreamType: 'Symbolic Dream',
});
const at = (year: number, month: number, day: number, hour = 7) => new Date(year, month - 1, day, hour).getTime();

it('brings back the dream of this date a year ago before the one of a month ago', () => {
  const monthAgo = dream(at(2026, 9, 21), true);
  const yearAgo = dream(at(2025, 10, 21), true);
  expect(pickDreamAnniversary([monthAgo, yearAgo], at(2026, 10, 21, 9))).toEqual({ dream: yearAgo, span: 'year' });
  expect(pickDreamAnniversary([monthAgo], at(2026, 10, 21, 9))).toEqual({ dream: monthAgo, span: 'month' });
  // The day before or after is not an anniversary.
  expect(pickDreamAnniversary([monthAgo], at(2026, 10, 22, 9))).toBeNull();
  expect(pickDreamAnniversary([dream(at(2026, 10, 14), true)], at(2026, 10, 21, 9))).toBeNull();
});

it('prefers the painted dream of that day, then its last one, and can keep to painted dreams', () => {
  const early = dream(at(2026, 9, 21, 5), true);
  const late = dream(at(2026, 9, 21, 8), true);
  const unpainted = dream(at(2026, 9, 21, 9), false);
  expect(pickDreamAnniversary([early, late, unpainted], at(2026, 10, 21))?.dream).toBe(late);
  expect(pickDreamAnniversary([unpainted], at(2026, 10, 21))?.dream).toBe(unpainted);
  expect(pickDreamAnniversary([unpainted], at(2026, 10, 21), { painted: true })).toBeNull();
});

it('gives no anniversary to a date the earlier month or year never had', () => {
  // 31 March: February has no 31st. 29 February: the year before had none.
  expect(pickDreamAnniversary([dream(at(2026, 3, 3), true)], at(2026, 3, 31))).toBeNull();
  expect(pickDreamAnniversary([dream(at(2027, 2, 28), true)], at(2028, 2, 29))).toBeNull();
  expect(pickDreamAnniversary([dream(at(2027, 2, 29), true)], at(2028, 2, 29))).toBeNull();
  expect(pickDreamAnniversary([dream(at(2028, 1, 29), true)], at(2028, 2, 29))?.span).toBe('month');
});

it('lays the coming week’s painted anniversaries, each from its midnight to the next', () => {
  const dreams = [dream(at(2026, 9, 23), true), dream(at(2026, 9, 25), false), dream(at(2025, 10, 28), true)];
  const days = upcomingAnniversaries(dreams, at(2026, 10, 21, 15), 7);
  expect(days.map(({ from, until, anniversary }) => [from, until, anniversary.span, anniversary.dream.id])).toEqual([
    [new Date(2026, 9, 23).getTime(), new Date(2026, 9, 24).getTime(), 'month', dreams[0].id],
    [new Date(2026, 9, 28).getTime(), new Date(2026, 9, 29).getTime(), 'year', dreams[2].id],
  ]);
});
