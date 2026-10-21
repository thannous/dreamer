import { fullMoonMorningKey, fullMoonsBetween } from '@/lib/fullMoon';
import { getLocalDateKey } from '@/lib/ritualProgressUtils';
import type { DreamAnalysis } from '@/lib/types';

/** The full moon letter's route. */
export const MOON_LETTER_ROUTE = '/moon-letter' as const;
/** Dreams a cycle needs before it gets its letter, as the api counts them. */
export const MOON_LETTER_MIN_DREAMS = 3;
/** Today offers the letter on the morning after its full moon and the two days after. */
const INVITE_DAYS = 3;

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

export type MoonCycle = {
  fullMoonAt: number;
  previousFullMoonAt: number;
  /** The dreams it reads: noted from the day after the previous full moon to the day after this one. */
  dreamsFrom: number;
  dreamsUntil: number;
};

/**
 * The lunar cycle a moment belongs to, as the api reckons it (supabase/functions/api/lib/fullMoon.ts):
 * it opens 12 hours before its full moon, the earliest its night begins anywhere.
 */
export function moonCycleAt(now: number): MoonCycle {
  const moons = fullMoonsBetween(now - 62 * DAY_MS, now + 12 * HOUR_MS);
  const fullMoonAt = moons[moons.length - 1];
  const previousFullMoonAt = moons[moons.length - 2];
  return { fullMoonAt, previousFullMoonAt, dreamsFrom: previousFullMoonAt + DAY_MS, dreamsUntil: fullMoonAt + DAY_MS };
}

/** The dreams with words noted in a cycle, up to now. */
export function countCycleDreams(dreams: readonly DreamAnalysis[], cycle: MoonCycle, now: number): number {
  const until = Math.min(now, cycle.dreamsUntil);
  return dreams.filter((dream) => dream.id >= cycle.dreamsFrom && dream.id < until && Boolean(dream.transcript?.trim())).length;
}

/** A full moon named by a link may differ from ours by rounding. */
const NAMED_TOLERANCE_MS = 60 * 60 * 1000;

/**
 * The full moon the letter screen asks for: an earlier one a link names, whose letter is only
 * read, or none for the cycle under way, whose letter may then be written. Before the morning
 * after its full moon that cycle still misses its last night, so the screen shows the previous
 * letter instead.
 */
export function moonLetterTarget(named: string | undefined, now: number): string | undefined {
  const cycle = moonCycleAt(now);
  const asked = named ? Date.parse(named) : NaN;
  if (Number.isFinite(asked) && asked < cycle.fullMoonAt - NAMED_TOLERANCE_MS) return named;
  if (getLocalDateKey(new Date(now)) < fullMoonMorningKey(cycle.fullMoonAt)) {
    return new Date(cycle.previousFullMoonAt).toISOString();
  }
  return undefined;
}

export type MoonLetterInvite = { fullMoonAt: number; dreamCount: number };

/**
 * Whether Today offers this cycle's letter: on the morning after its full moon and the two
 * days after, once the cycle holds enough dreams to write one.
 */
export function getMoonLetterInvite(dreams: readonly DreamAnalysis[], now: number): MoonLetterInvite | null {
  const cycle = moonCycleAt(now);
  const morning = fullMoonMorningKey(cycle.fullMoonAt);
  const [year, month, day] = morning.split('-').map(Number);
  const today = getLocalDateKey(new Date(now));
  const days = Array.from({ length: INVITE_DAYS }, (_, offset) => getLocalDateKey(new Date(year, month - 1, day + offset, 12)));
  if (!days.includes(today)) return null;
  const dreamCount = countCycleDreams(dreams, cycle, now);
  return dreamCount >= MOON_LETTER_MIN_DREAMS ? { fullMoonAt: cycle.fullMoonAt, dreamCount } : null;
}
