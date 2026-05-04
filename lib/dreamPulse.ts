import type { DreamAnalysis } from './types';

export type DreamPulseState = 'empty' | 'today' | 'stale' | 'analyze' | 'steady';

export type DreamPulse = {
  state: DreamPulseState;
  totalCount: number;
  analyzedCount: number;
  favoriteCount: number;
  lastDreamAt: number | null;
  daysSinceLastDream: number | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function getLocalDayStart(timestamp: number): number {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function isAnalyzed(dream: DreamAnalysis): boolean {
  return dream.isAnalyzed === true || dream.analysisStatus === 'done';
}

export function getDreamPulse(dreams: DreamAnalysis[], now = Date.now()): DreamPulse {
  const totalCount = dreams.length;
  const analyzedCount = dreams.filter(isAnalyzed).length;
  const favoriteCount = dreams.filter((dream) => dream.isFavorite === true).length;
  const lastDreamAt = dreams.reduce<number | null>((latest, dream) => {
    if (typeof dream.id !== 'number') return latest;
    if (latest === null || dream.id > latest) return dream.id;
    return latest;
  }, null);

  if (totalCount === 0 || lastDreamAt === null) {
    return {
      state: 'empty',
      totalCount,
      analyzedCount,
      favoriteCount,
      lastDreamAt: null,
      daysSinceLastDream: null,
    };
  }

  const daysSinceLastDream = Math.max(
    0,
    Math.floor((getLocalDayStart(now) - getLocalDayStart(lastDreamAt)) / DAY_MS)
  );

  let state: DreamPulseState = 'steady';
  if (daysSinceLastDream === 0) {
    state = 'today';
  } else if (daysSinceLastDream >= 3) {
    state = 'stale';
  } else if (analyzedCount < totalCount) {
    state = 'analyze';
  }

  return {
    state,
    totalCount,
    analyzedCount,
    favoriteCount,
    lastDreamAt,
    daysSinceLastDream,
  };
}
