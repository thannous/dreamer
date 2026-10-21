import { nearestFullMoon } from '@/lib/fullMoon';
import { countCycleDreams, getMoonLetterInvite, moonCycleAt } from '@/lib/moonLetter';
import type { DreamAnalysis } from '@/lib/types';
import * as server from '@/supabase/functions/api/lib/fullMoon';

const dream = (id: number, transcript = 'A river of glass'): DreamAnalysis => ({
  id, transcript, title: '', interpretation: '', shareableQuote: '', imageUrl: '', chatHistory: [], dreamType: 'Symbolic Dream',
});
const at = (month: number, day: number, hour = 7) => new Date(2026, month - 1, day, hour).getTime();
// Full moons: 26 September 2026 16:49 UTC, 26 October 04:12 UTC, 24 November 14:53 UTC.
const OCTOBER = Date.parse('2026-10-26T04:11:49Z');

it('reckons the cycle and its full moons exactly as the api does', () => {
  for (let moment = Date.parse('2025-01-01T00:00:00Z'); moment < Date.parse('2028-01-01T00:00:00Z'); moment += 13 * 3_600_000 + 17 * 60_000) {
    expect(moonCycleAt(moment)).toEqual(server.moonCycleAt(moment));
    expect(nearestFullMoon(moment)).toBe(server.nearestFullMoon(moment));
  }
});

it('opens a cycle 12 hours before its full moon', () => {
  expect(Math.abs(moonCycleAt(OCTOBER - 11 * 3_600_000).fullMoonAt - OCTOBER)).toBeLessThan(60_000);
  expect(Math.abs(moonCycleAt(OCTOBER - 13 * 3_600_000).fullMoonAt - Date.parse('2026-09-26T16:49:04Z'))).toBeLessThan(60_000);
});

it('counts the dreams with words from the day after the previous full moon to the day after this one', () => {
  const cycle = moonCycleAt(OCTOBER + 3_600_000);
  const dreams = [
    dream(Date.parse('2026-09-27T10:00:00Z')),
    dream(Date.parse('2026-09-27T17:00:00Z')),
    dream(Date.parse('2026-10-10T06:00:00Z'), '  '),
    dream(Date.parse('2026-10-26T06:00:00Z')),
    dream(Date.parse('2026-10-27T05:00:00Z')),
  ];
  expect(countCycleDreams(dreams, cycle, OCTOBER + 30 * 3_600_000)).toBe(2);
  // Before the morning's dream is noted, it does not count yet.
  expect(countCycleDreams(dreams, cycle, OCTOBER + 3_600_000)).toBe(1);
});

it('offers the letter on the morning after the full moon and the two days after, once three dreams are noted', () => {
  const three = [dream(at(10, 2)), dream(at(10, 15)), dream(at(10, 26, 6))];
  const morning = getMoonLetterInvite(three, at(10, 26, 9));
  expect(morning?.dreamCount).toBe(3);
  expect(Math.abs((morning?.fullMoonAt ?? 0) - OCTOBER)).toBeLessThan(60_000);
  expect(getMoonLetterInvite(three, at(10, 28, 20))).not.toBeNull();
  expect(getMoonLetterInvite(three, at(10, 29, 9))).toBeNull();
  expect(getMoonLetterInvite(three, at(10, 25, 21))).toBeNull();
  expect(getMoonLetterInvite(three.slice(0, 2), at(10, 26, 9))).toBeNull();
});
