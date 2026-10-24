import type { LinkedSymbol } from '@/lib/symbolLinks';
import type { PeriodSymbol } from '@/lib/trendsSymbols';
import { isDreamAnalyzed } from '@/lib/dreamUsage';
import { isFullMoonDream } from '@/lib/fullMoon';
import type { DreamAnalysis } from '@/lib/types';

/** Beyond a year of nightly dreams, the oldest stars give way to the newest. */
export const MAX_SKY_STARS = 365;

/** A dream's star: across the sky by the hour it was noted, at a height of its own. */
export type SkyStar = {
  dream: DreamAnalysis;
  /** 0 at the period's first night, 1 past its last one. */
  x: number;
  /** 0 at the top of the sky, 1 at the bottom; the same for a dream in every period. */
  y: number;
  analyzed: boolean;
  /** Noted after a full moon's night: the star wears a silver ring. */
  fullMoon: boolean;
};

/** A symbol that came back in the period, drawn through its dreams in the order they came. */
export type SkyConstellation = {
  symbol: LinkedSymbol;
  /** The stars it joins, oldest first: indexes into `stars`. */
  stars: number[];
};

export type DreamSky = {
  /** Oldest first. */
  stars: SkyStar[];
  constellations: SkyConstellation[];
  /** Every dream of the period, drawn or not: more than `stars` once the cap applies. */
  total: number;
};

/** A height between 0 and 1 drawn from the dream's id: scattered, yet always the same. */
function heightOf(id: number): number {
  let hash = (Math.floor(id) ^ Math.floor(id / 4294967296) ^ 0x9e3779b9) >>> 0;
  hash = Math.imul(hash ^ (hash >>> 16), 0x85ebca6b);
  hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35);
  hash ^= hash >>> 16;
  return (hash >>> 0) / 4294967296;
}

const startOfLocalDay = (timestamp: number) => {
  const day = new Date(timestamp);
  day.setHours(0, 0, 0, 0);
  return day.getTime();
};

/** The midnight that ends a local day: 23 or 25 hours on, the nights the clocks change. */
const endOfLocalDay = (timestamp: number) => {
  const day = new Date(startOfLocalDay(timestamp));
  day.setDate(day.getDate() + 1);
  return day.getTime();
};

/**
 * The period's dreams as a sky: each dream a star, set across by when it was noted, and
 * each symbol that came back drawn as a constellation through the dreams it came back in.
 * `range` is the period's first and last local day, as Tendances counts them.
 */
export function buildDreamSky(
  dreams: readonly DreamAnalysis[],
  range: { start: number; end: number },
  symbols: readonly PeriodSymbol[],
): DreamSky {
  const inPeriod = dreams
    .filter((dream) => Number.isFinite(dream.id))
    .filter((dream) => {
      const day = startOfLocalDay(dream.id);
      return day >= range.start && day <= range.end;
    })
    .sort((a, b) => a.id - b.id);
  const shown = inPeriod.slice(-MAX_SKY_STARS);
  // Once the oldest dreams give way, the sky opens on the first night it still draws:
  // measured from the period's start, the newest stars would crowd into its last part.
  const start = shown.length < inPeriod.length ? startOfLocalDay(shown[0].id) : range.start;
  const span = Math.max(1, endOfLocalDay(range.end) - start);
  const stars = shown.map((dream) => ({
    dream,
    x: Math.min(1, Math.max(0, (dream.id - start) / span)),
    y: heightOf(dream.id),
    analyzed: isDreamAnalyzed(dream),
    fullMoon: isFullMoonDream(dream.id),
  }));
  const at = new Map(stars.map((star, index) => [star.dream.id, index]));
  const constellations = symbols
    .map(({ symbol }) => ({
      symbol,
      // Only analyzed dreams, as Tendances counts a symbol's returns: a dream read again
      // keeps its symbols in the index while its new reading is on its way.
      stars: symbol.appearances
        .map(({ dream }) => at.get(dream.id))
        .filter((index): index is number => index !== undefined && stars[index].analyzed),
    }))
    .filter((constellation) => constellation.stars.length >= 2);
  return { stars, constellations, total: inPeriod.length };
}
