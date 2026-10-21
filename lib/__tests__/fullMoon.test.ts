import {
  fullMoonMorningKey,
  fullMoonsBetween,
  getFullMoonMoment,
  isFullMoonDream,
  nearestFullMoon,
} from '@/lib/fullMoon';
import { getLocalDateKey } from '@/lib/ritualProgressUtils';

// Full moons as the US Naval Observatory publishes them (aa.usno.navy.mil, Moon phases API),
// in UTC to the minute. The computation was checked against all 99 of 2000, 2020, 2024-2028
// and 2035 (worst gap 45 s); these keep it honest.
const USNO_FULL_MOONS = [
  '2000-01-21T04:40Z',
  '2025-11-05T13:19Z',
  '2026-03-03T11:38Z',
  '2026-10-26T04:12Z',
  '2026-11-24T14:53Z',
  '2026-12-24T01:28Z',
  '2035-10-17T02:35Z',
];
const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;
const noonOf = (key: string, shift = 0) => {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day + shift, 12).getTime();
};

it('finds the full moon within two minutes of the published tables, from anywhere in its month', () => {
  for (const iso of USNO_FULL_MOONS) {
    const published = Date.parse(iso);
    for (const away of [-14, -3, 0, 6, 14]) {
      expect(Math.abs(nearestFullMoon(published + away * DAY) - published)).toBeLessThan(2 * MINUTE);
    }
  }
});

it('lists every full moon of a year once, in order', () => {
  const moons = fullMoonsBetween(Date.parse('2026-01-01T00:00Z'), Date.parse('2027-01-01T00:00Z'));
  expect(moons).toHaveLength(13);
  expect(moons.every((moon, index) => index === 0 || moon - moons[index - 1] > 29 * DAY)).toBe(true);
  expect(Math.abs(moons[10] - Date.parse('2026-10-26T04:12Z'))).toBeLessThan(2 * MINUTE);
});

it('gives the night to the midnight nearest the full moon', () => {
  // Before dawn, the full moon ends the night it shines in.
  expect(fullMoonMorningKey(new Date(2026, 9, 26, 5, 12).getTime())).toBe('2026-10-26');
  // In the afternoon it leads into the night that follows.
  expect(fullMoonMorningKey(new Date(2026, 10, 24, 15, 53).getTime())).toBe('2026-11-25');
  expect(fullMoonMorningKey(new Date(2026, 10, 24, 11, 0).getTime())).toBe('2026-11-24');
});

it('seals the dreams of one day per full moon, at any hour of it', () => {
  const morning = fullMoonMorningKey(nearestFullMoon(Date.parse('2026-10-26T04:12Z')));
  const [year, month, day] = morning.split('-').map(Number);
  expect(isFullMoonDream(new Date(year, month - 1, day, 0, 30).getTime())).toBe(true);
  expect(isFullMoonDream(noonOf(morning))).toBe(true);
  expect(isFullMoonDream(new Date(year, month - 1, day, 23, 50).getTime())).toBe(true);
  expect(isFullMoonDream(noonOf(morning, -1))).toBe(false);
  expect(isFullMoonDream(noonOf(morning, 1))).toBe(false);
  expect(isFullMoonDream(noonOf(morning, 15))).toBe(false);
  expect(isFullMoonDream(Number.NaN)).toBe(false);
});

it('says on the eve that the night is coming, and on its morning that it came', () => {
  const morning = fullMoonMorningKey(nearestFullMoon(Date.parse('2026-11-24T14:53Z')));
  expect(getFullMoonMoment(noonOf(morning, -1))).toMatchObject({ kind: 'eve', morningKey: morning });
  expect(getFullMoonMoment(new Date(noonOf(morning, -1) + 11 * 60 * MINUTE).getTime()))
    .toMatchObject({ kind: 'eve', morningKey: morning });
  expect(getFullMoonMoment(noonOf(morning) - 11 * 60 * MINUTE)).toMatchObject({ kind: 'morning', morningKey: morning });
  expect(getFullMoonMoment(noonOf(morning))).toMatchObject({ kind: 'morning', morningKey: morning });
  expect(getFullMoonMoment(noonOf(morning, -2))).toBeNull();
  expect(getFullMoonMoment(noonOf(morning, 1))).toBeNull();
  expect(getLocalDateKey(new Date(noonOf(morning)))).toBe(morning);
});
