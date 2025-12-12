import AsyncStorage from '@react-native-async-storage/async-storage';

import { getAnalyzedDreamCount, getExploredDreamCount, isDreamExplored } from '@/lib/dreamUsage';
import type { DreamAnalysis } from '@/lib/types';
import { getSavedDreams } from '@/services/storageService';

type MockQuotaState = {
  analysisCount: number;
  explorationCount: number;
  analyzedDreamIds: number[];
  exploredDreamIds: number[];
};

const STORAGE_KEY = 'mock_quota_events_v1';
const MIGRATION_KEY = 'mock_quota_events_migrated_v1';
const DEFAULT_STATE: MockQuotaState = {
  analysisCount: 0,
  explorationCount: 0,
  analyzedDreamIds: [],
  exploredDreamIds: [],
};

let cache: { state: MockQuotaState; expiresAt: number } | null = null;
const CACHE_TTL = 15_000;

const safeParseState = (raw: string | null): MockQuotaState => {
  if (!raw) return DEFAULT_STATE;
  try {
    const parsed = JSON.parse(raw) as Partial<MockQuotaState>;
    return {
      analysisCount: typeof parsed.analysisCount === 'number' ? parsed.analysisCount : 0,
      explorationCount: typeof parsed.explorationCount === 'number' ? parsed.explorationCount : 0,
      analyzedDreamIds: Array.isArray(parsed.analyzedDreamIds) ? parsed.analyzedDreamIds : [],
      exploredDreamIds: Array.isArray(parsed.exploredDreamIds) ? parsed.exploredDreamIds : [],
    };
  } catch {
    return DEFAULT_STATE;
  }
};

function mergeIds(existing: number[], incoming: number[]): number[] {
  const merged = new Set<number>(existing);
  incoming.forEach((id) => merged.add(id));
  return Array.from(merged);
}

async function syncWithDreams(state: MockQuotaState): Promise<MockQuotaState> {
  const dreams = (await getSavedDreams()) ?? [];
  const analysisFromDreams = getAnalyzedDreamCount(dreams);
  const explorationFromDreams = getExploredDreamCount(dreams);

  const analyzedIds = dreams
    .filter((dream) => dream.isAnalyzed && typeof dream.analyzedAt === 'number')
    .map((dream) => dream.id);
  const exploredIds = dreams
    .filter((dream) => isDreamExplored(dream))
    .map((dream) => dream.id);

  const next: MockQuotaState = {
    analysisCount: Math.max(state.analysisCount, analysisFromDreams),
    explorationCount: Math.max(state.explorationCount, explorationFromDreams),
    analyzedDreamIds: mergeIds(state.analyzedDreamIds, analyzedIds),
    exploredDreamIds: mergeIds(state.exploredDreamIds, exploredIds),
  };

  const changed =
    next.analysisCount !== state.analysisCount ||
    next.explorationCount !== state.explorationCount ||
    next.analyzedDreamIds.length !== state.analyzedDreamIds.length ||
    next.exploredDreamIds.length !== state.exploredDreamIds.length;

  if (changed) {
    await saveState(next);
  }

  return next;
}

async function loadState(): Promise<MockQuotaState> {
  if (cache && cache.expiresAt > Date.now()) {
    return cache.state;
  }

  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  const state = await syncWithDreams(safeParseState(raw));
  cache = { state, expiresAt: Date.now() + CACHE_TTL };
  return state;
}

async function saveState(state: MockQuotaState): Promise<void> {
  cache = { state, expiresAt: Date.now() + CACHE_TTL };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export async function resetMockQuotaEvents(): Promise<void> {
  cache = null;
  await AsyncStorage.multiRemove([STORAGE_KEY, MIGRATION_KEY]);
}

async function migrateFromDreamsIfNeeded(): Promise<void> {
  const migrated = await AsyncStorage.getItem(MIGRATION_KEY);
  if (migrated) return;

  const dreams = (await getSavedDreams()) ?? [];
  const analysisCount = getAnalyzedDreamCount(dreams);
  const explorationCount = getExploredDreamCount(dreams);

  const analyzedDreamIds = dreams
    .filter((dream) => dream.isAnalyzed && typeof dream.analyzedAt === 'number')
    .map((dream) => dream.id);
  const exploredDreamIds = dreams
    .filter((dream) => typeof dream.explorationStartedAt === 'number')
    .map((dream) => dream.id);

  const next: MockQuotaState = {
    analysisCount,
    explorationCount,
    analyzedDreamIds,
    exploredDreamIds,
  };

  await saveState(next);
  await AsyncStorage.setItem(MIGRATION_KEY, 'true');
}

export async function getMockAnalysisCount(): Promise<number> {
  await migrateFromDreamsIfNeeded();
  const state = await loadState();
  return state.analysisCount;
}

export async function getMockExplorationCount(): Promise<number> {
  await migrateFromDreamsIfNeeded();
  const state = await loadState();
  return state.explorationCount;
}

export async function isDreamAnalyzedMock(dreamId?: number): Promise<boolean> {
  if (!dreamId) return false;
  await migrateFromDreamsIfNeeded();
  const state = await loadState();
  return state.analyzedDreamIds.includes(dreamId);
}

export async function isDreamExploredMock(dreamId?: number): Promise<boolean> {
  if (!dreamId) return false;
  await migrateFromDreamsIfNeeded();
  const state = await loadState();
  return state.exploredDreamIds.includes(dreamId);
}

export async function markMockAnalysis(dream?: Pick<DreamAnalysis, 'id'>): Promise<number> {
  await migrateFromDreamsIfNeeded();
  const state = await loadState();
  const dreamId = dream?.id;

  if (dreamId && state.analyzedDreamIds.includes(dreamId)) {
    return state.analysisCount;
  }

  const updated: MockQuotaState = {
    ...state,
    analysisCount: state.analysisCount + 1,
    analyzedDreamIds: dreamId
      ? [...state.analyzedDreamIds, dreamId]
      : state.analyzedDreamIds,
  };

  await saveState(updated);
  return updated.analysisCount;
}

export async function markMockExploration(dream?: Pick<DreamAnalysis, 'id'>): Promise<number> {
  await migrateFromDreamsIfNeeded();
  const state = await loadState();
  const dreamId = dream?.id;

  if (dreamId && state.exploredDreamIds.includes(dreamId)) {
    return state.explorationCount;
  }

  const updated: MockQuotaState = {
    ...state,
    explorationCount: state.explorationCount + 1,
    exploredDreamIds: dreamId
      ? [...state.exploredDreamIds, dreamId]
      : state.exploredDreamIds,
  };

  await saveState(updated);
  return updated.explorationCount;
}

export function invalidateMockQuotaCache(): void {
  cache = null;
}
