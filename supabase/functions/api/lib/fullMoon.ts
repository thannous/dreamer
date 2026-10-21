/**
 * The full moons, as the app computes them (lib/fullMoon.ts, kept identical by
 * lib/__tests__/moonLetter.test.ts): Meeus, Astronomical Algorithms, chapter 49,
 * within a minute or two of the published tables.
 */

const SYNODIC_MONTH = 29.530588861;
const DAY_MS = 24 * 60 * 60 * 1000;
const UNIX_EPOCH_JD = 2440587.5;
/** Terrestrial Time runs about 69 s ahead of UTC in these years; a minute is all it changes. */
const DELTA_T_DAYS = 69 / 86400;

const rad = (degrees: number) => (degrees * Math.PI) / 180;
const sin = (degrees: number) => Math.sin(rad(degrees));

/** The full moon of lunation `k` (k + 0.5 counted from the new moon of 6 January 2000), in ms. */
function fullMoonOfLunation(lunation: number): number {
  const k = Math.floor(lunation) + 0.5;
  const T = k / 1236.85;
  const T2 = T * T;
  const T3 = T2 * T;
  const T4 = T3 * T;
  const mean = 2451550.09766 + SYNODIC_MONTH * k + 0.00015437 * T2 - 0.00000015 * T3 + 0.00000000073 * T4;
  const E = 1 - 0.002516 * T - 0.0000074 * T2;
  const M = 2.5534 + 29.1053567 * k - 0.0000014 * T2 - 0.00000011 * T3;
  const Mp = 201.5643 + 385.81693528 * k + 0.0107582 * T2 + 0.00001238 * T3 - 0.000000058 * T4;
  const F = 160.7108 + 390.67050284 * k - 0.0016118 * T2 - 0.00000227 * T3 + 0.000000011 * T4;
  const omega = 124.7746 - 1.56375588 * k + 0.0020672 * T2 + 0.00000215 * T3;

  const phase = -0.40614 * sin(Mp)
    + 0.17302 * E * sin(M)
    + 0.01614 * sin(2 * Mp)
    + 0.01043 * sin(2 * F)
    + 0.00734 * E * sin(Mp - M)
    - 0.00515 * E * sin(Mp + M)
    + 0.00209 * E * E * sin(2 * M)
    - 0.00111 * sin(Mp - 2 * F)
    - 0.00057 * sin(Mp + 2 * F)
    + 0.00056 * E * sin(2 * Mp + M)
    - 0.00042 * sin(3 * Mp)
    + 0.00042 * E * sin(M + 2 * F)
    + 0.00038 * E * sin(M - 2 * F)
    - 0.00024 * E * sin(2 * Mp - M)
    - 0.00017 * sin(omega)
    - 0.00007 * sin(Mp + 2 * M)
    + 0.00004 * sin(2 * Mp - 2 * F)
    + 0.00004 * sin(3 * M)
    + 0.00003 * sin(Mp + M - 2 * F)
    + 0.00003 * sin(2 * Mp + 2 * F)
    - 0.00003 * sin(Mp + M + 2 * F)
    + 0.00003 * sin(Mp - M + 2 * F)
    - 0.00002 * sin(Mp - M - 2 * F)
    - 0.00002 * sin(3 * Mp + M)
    + 0.00002 * sin(4 * Mp);

  const planets = 0.000325 * sin(299.77 + 0.107408 * k - 0.009173 * T2)
    + 0.000165 * sin(251.88 + 0.016321 * k)
    + 0.000164 * sin(251.83 + 26.651886 * k)
    + 0.000126 * sin(349.42 + 36.412478 * k)
    + 0.00011 * sin(84.66 + 18.206239 * k)
    + 0.000062 * sin(141.74 + 53.303771 * k)
    + 0.00006 * sin(207.14 + 2.453732 * k)
    + 0.000056 * sin(154.84 + 7.30686 * k)
    + 0.000047 * sin(34.52 + 27.261239 * k)
    + 0.000042 * sin(207.19 + 0.121824 * k)
    + 0.00004 * sin(291.34 + 1.844379 * k)
    + 0.000037 * sin(161.72 + 24.198154 * k)
    + 0.000035 * sin(239.56 + 25.513099 * k)
    + 0.000023 * sin(331.55 + 3.592518 * k);

  return Math.round((mean + phase + planets - DELTA_T_DAYS - UNIX_EPOCH_JD) * DAY_MS);
}

const lunationAt = (timestamp: number) => (timestamp / DAY_MS + UNIX_EPOCH_JD - 2451550.09766) / SYNODIC_MONTH;

/** The full moon nearest to a moment, in ms. */
export function nearestFullMoon(timestamp: number): number {
  const around = Math.floor(lunationAt(timestamp) - 0.5);
  let nearest = fullMoonOfLunation(around);
  for (const lunation of [around - 1, around + 1]) {
    const candidate = fullMoonOfLunation(lunation);
    if (Math.abs(candidate - timestamp) < Math.abs(nearest - timestamp)) nearest = candidate;
  }
  return nearest;
}

/** The full moons from `start` to `end`, oldest first. */
export function fullMoonsBetween(start: number, end: number): number[] {
  const moons: number[] = [];
  for (let lunation = Math.floor(lunationAt(start) - 0.5) - 1; ; lunation += 1) {
    const moon = fullMoonOfLunation(lunation);
    if (moon > end) return moons;
    if (moon >= start) moons.push(moon);
  }
}

const HOUR_MS = 60 * 60 * 1000;

/**
 * The lunar cycle a moment belongs to, for its full moon letter: it opens 12 hours before
 * a full moon, the earliest its night can begin anywhere, and ends 12 hours before the next.
 * Its dreams are those noted from the day after the previous full moon to the day after this one.
 */
export function moonCycleAt(now: number): { fullMoonAt: number; previousFullMoonAt: number; dreamsFrom: number; dreamsUntil: number } {
  const moons = fullMoonsBetween(now - 62 * DAY_MS, now + 12 * HOUR_MS);
  const fullMoonAt = moons[moons.length - 1];
  const previousFullMoonAt = moons[moons.length - 2];
  return { fullMoonAt, previousFullMoonAt, dreamsFrom: previousFullMoonAt + DAY_MS, dreamsUntil: fullMoonAt + DAY_MS };
}
