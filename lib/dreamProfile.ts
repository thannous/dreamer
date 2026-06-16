import type {
  DreamApproximatePeriod,
  DreamAnalysis,
  DreamMemoryMetadata,
  DreamStrongestFragment,
  DreamTheme,
  DreamType,
} from '@/lib/types';
import { isDreamAnalyzed, isDreamExplored } from '@/lib/dreamUsage';
import { normalizeDreamMemoryMetadata } from '@/lib/dreamUtils';

export type DreamProfileFacet<T extends string> = {
  value: T;
  count: number;
  percentage: number;
};

export type DreamProfileReadiness = 'empty' | 'seeded' | 'forming' | 'living';

export type DreamProfile = {
  readiness: DreamProfileReadiness;
  totalDreams: number;
  rememberedDreams: number;
  anchorDreams: number;
  recurringDreams: number;
  analyzedDreams: number;
  exploredDreams: number;
  topTypes: DreamProfileFacet<DreamType>[];
  topThemes: DreamProfileFacet<DreamTheme>[];
  topFragments: DreamProfileFacet<DreamStrongestFragment>[];
  topPeriods: DreamProfileFacet<DreamApproximatePeriod>[];
  hasAnchorDream: boolean;
  hasEnoughForPatterns: boolean;
  nextAction: 'add_anchor' | 'capture_more' | 'analyze_unanalyzed' | 'explore_more' | 'review_patterns';
};

const MIN_DREAMS_FOR_PATTERNS = 3;

function percentage(count: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((count / total) * 100);
}

function increment<T extends string>(map: Map<T, number>, value: T | undefined | null) {
  if (!value) return;
  map.set(value, (map.get(value) ?? 0) + 1);
}

function toFacets<T extends string>(map: Map<T, number>, total: number, limit = 5): DreamProfileFacet<T>[] {
  return Array.from(map.entries())
    .map(([value, count]) => ({
      value,
      count,
      percentage: percentage(count, total),
    }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
    .slice(0, limit);
}

function getRememberedSignals(memory: DreamMemoryMetadata | undefined) {
  const normalized = normalizeDreamMemoryMetadata(memory);
  return {
    memory: normalized,
    isRemembered: normalized?.origin === 'remembered' || normalized?.dejaVu === true,
    isAnchor: normalized?.anchorDream === true,
    isRecurring: normalized?.recurring === true || normalized?.rememberedKind === 'recurring',
  };
}

function getReadiness(totalDreams: number, anchorDreams: number): DreamProfileReadiness {
  if (totalDreams === 0) return 'empty';
  if (totalDreams < MIN_DREAMS_FOR_PATTERNS) return anchorDreams > 0 ? 'seeded' : 'forming';
  return 'living';
}

function getNextAction(params: {
  totalDreams: number;
  anchorDreams: number;
  analyzedDreams: number;
  exploredDreams: number;
}): DreamProfile['nextAction'] {
  if (params.totalDreams === 0 || params.anchorDreams === 0) {
    return 'add_anchor';
  }
  if (params.totalDreams < MIN_DREAMS_FOR_PATTERNS) {
    return 'capture_more';
  }
  if (params.analyzedDreams < params.totalDreams) {
    return 'analyze_unanalyzed';
  }
  if (params.exploredDreams < params.analyzedDreams) {
    return 'explore_more';
  }
  return 'review_patterns';
}

export function buildDreamProfile(dreams: DreamAnalysis[]): DreamProfile {
  const typeCounts = new Map<DreamType, number>();
  const themeCounts = new Map<DreamTheme, number>();
  const fragmentCounts = new Map<DreamStrongestFragment, number>();
  const periodCounts = new Map<DreamApproximatePeriod, number>();

  let rememberedDreams = 0;
  let anchorDreams = 0;
  let recurringDreams = 0;
  let analyzedDreams = 0;
  let exploredDreams = 0;

  for (const dream of dreams) {
    increment(typeCounts, dream.dreamType);
    increment(themeCounts, dream.theme);

    if (dream.dreamType === 'Recurring Dream') {
      recurringDreams += 1;
    }

    if (isDreamAnalyzed(dream)) {
      analyzedDreams += 1;
    }

    if (isDreamExplored(dream)) {
      exploredDreams += 1;
    }

    const signals = getRememberedSignals(dream.memory);
    if (signals.isRemembered) {
      rememberedDreams += 1;
    }
    if (signals.isAnchor) {
      anchorDreams += 1;
    }
    if (signals.isRecurring && dream.dreamType !== 'Recurring Dream') {
      recurringDreams += 1;
    }
    increment(fragmentCounts, signals.memory?.strongestFragment);
    increment(periodCounts, signals.memory?.approximatePeriod);
  }

  const totalDreams = dreams.length;
  return {
    readiness: getReadiness(totalDreams, anchorDreams),
    totalDreams,
    rememberedDreams,
    anchorDreams,
    recurringDreams,
    analyzedDreams,
    exploredDreams,
    topTypes: toFacets(typeCounts, totalDreams),
    topThemes: toFacets(themeCounts, totalDreams),
    topFragments: toFacets(fragmentCounts, Math.max(rememberedDreams, 1)),
    topPeriods: toFacets(periodCounts, Math.max(rememberedDreams, 1)),
    hasAnchorDream: anchorDreams > 0,
    hasEnoughForPatterns: totalDreams >= MIN_DREAMS_FOR_PATTERNS,
    nextAction: getNextAction({
      totalDreams,
      anchorDreams,
      analyzedDreams,
      exploredDreams,
    }),
  };
}
