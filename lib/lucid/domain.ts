import {
  LUCID_TRAINER_SCHEMA_VERSION,
  type LucidOnboardingState,
  type LucidProgramProgress,
  type LucidSyncEntity,
  type LucidTechnique,
  type LucidTrainerPreferences,
  type LucidTrainerState,
} from '@/lib/lucid/model';

export type { LucidTrainerState } from '@/lib/lucid/model';

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalize(nested)])
    );
  }
  return value;
}

export function canonicalLucidJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function chooseNewest<T extends { updatedAt: number }>(left: T, right: T): T {
  if (left.updatedAt !== right.updatedAt) {
    return left.updatedAt > right.updatedAt ? left : right;
  }
  return canonicalLucidJson(left) >= canonicalLucidJson(right) ? left : right;
}

function minNullable(left: number | null, right: number | null): number | null {
  if (left === null) return right;
  if (right === null) return left;
  return Math.min(left, right);
}

function maxNullable(left: number | null, right: number | null): number | null {
  if (left === null) return right;
  if (right === null) return left;
  return Math.max(left, right);
}

export function mergeLucidProgramProgress(
  left: LucidProgramProgress,
  right: LucidProgramProgress
): LucidProgramProgress {
  if (left.technique !== right.technique) {
    throw new Error('Cannot merge progress for different techniques');
  }

  const newest = chooseNewest(left, right);
  const status =
    left.status === 'completed' || right.status === 'completed' ? 'completed' : newest.status;

  return {
    technique: left.technique,
    programId: newest.programId,
    status,
    currentDay: Math.max(left.currentDay, right.currentDay),
    completedExerciseIds: sortedUnique([
      ...left.completedExerciseIds,
      ...right.completedExerciseIds,
    ]),
    practiceDates: sortedUnique([...left.practiceDates, ...right.practiceDates]),
    startedAt: minNullable(left.startedAt, right.startedAt),
    completedAt: status === 'completed' ? maxNullable(left.completedAt, right.completedAt) : null,
    updatedAt: Math.max(left.updatedAt, right.updatedAt),
  };
}

/**
 * At most one program may be `active`. Extra actives are paused in place so
 * their cursor, completed sessions and practice dates are preserved.
 * A local user action may pass `preferredTechnique`. Sync/apply must omit it
 * so the newest `updatedAt` wins, then the earliest technique name.
 */
export function enforceLucidSingleActiveProgram(
  progressList: readonly LucidProgramProgress[],
  preferredTechnique?: LucidTechnique
): LucidProgramProgress[] {
  const sorted = [...progressList].sort((left, right) => left.technique.localeCompare(right.technique));
  const active = sorted.filter((item) => item.status === 'active');
  if (active.length <= 1) return sorted;

  const preferred = preferredTechnique
    ? active.find((item) => item.technique === preferredTechnique)
    : undefined;
  const winner =
    preferred ??
    [...active].sort((left, right) => {
      if (left.updatedAt !== right.updatedAt) return right.updatedAt - left.updatedAt;
      return left.technique.localeCompare(right.technique);
    })[0];

  const pauseUpdatedAt = Math.max(winner.updatedAt, ...active.map((item) => item.updatedAt));
  return sorted.map((item) =>
    item.status === 'active' && item.technique !== winner.technique
      ? { ...item, status: 'paused' as const, updatedAt: pauseUpdatedAt }
      : item
  );
}

export function applyLucidProgramProgress(
  state: LucidTrainerState,
  progress: LucidProgramProgress,
  preferredTechnique?: LucidTechnique
): LucidTrainerState {
  return {
    ...state,
    updatedAt: Math.max(state.updatedAt, progress.updatedAt),
    progress: enforceLucidSingleActiveProgram(
      [
        ...state.progress.filter((item) => item.technique !== progress.technique),
        progress,
      ],
      preferredTechnique
    ),
  };
}

export function createInitialLucidTrainerState(params: {
  now: number;
  timeZone: string;
  locale?: LucidTrainerPreferences['locale'];
}): LucidTrainerState {
  const { now, timeZone, locale = 'en' } = params;
  return {
    schemaVersion: LUCID_TRAINER_SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now,
    onboarding: {
      status: 'not_started',
      goal: null,
      experience: null,
      weeklyTarget: 3,
      sleepSchedule: {
        bedtime: '22:30',
        wakeTime: '07:00',
        timeZone,
      },
      notificationsPermission: 'unknown',
      notificationsExplained: false,
      audioSafetyAccepted: false,
      analyticsConsent: null,
      accessibility: {
        reduceMotion: false,
        largerText: false,
        screenReaderOptimized: false,
      },
      completedAt: null,
      updatedAt: now,
    },
    preferences: {
      locale,
      theme: 'dynamic',
      cloudSyncEnabled: false,
      noctaliaLinkEnabled: false,
      notificationsEnabled: false,
      realityCheckRemindersPerDay: 3,
      audioCuesEnabled: false,
      audioVolume: 0.25,
      timeZone,
      updatedAt: now,
    },
    progress: [],
    experiments: [],
    realityChecks: [],
    weeklyReviews: [],
  };
}

export function createLucidProgramProgress(
  technique: LucidTechnique,
  now: number
): LucidProgramProgress {
  return {
    technique,
    programId: `${technique}-foundations`,
    status: 'not_started',
    currentDay: 1,
    completedExerciseIds: [],
    practiceDates: [],
    startedAt: null,
    completedAt: null,
    updatedAt: now,
  };
}

function assertMatchingEntities(left: LucidSyncEntity, right: LucidSyncEntity): void {
  if (left.entityType !== right.entityType || left.entityKey !== right.entityKey) {
    throw new Error('Cannot resolve a conflict between different Lucid Trainer entities');
  }
}

export function resolveLucidEntityConflict(
  left: LucidSyncEntity,
  right: LucidSyncEntity
): LucidSyncEntity {
  assertMatchingEntities(left, right);

  if (left.entityType === 'progress' && right.entityType === 'progress') {
    return {
      entityType: 'progress',
      entityKey: left.entityKey,
      value: mergeLucidProgramProgress(left.value, right.value),
    };
  }

  const leftUpdatedAt = left.value.updatedAt;
  const rightUpdatedAt = right.value.updatedAt;
  if (leftUpdatedAt !== rightUpdatedAt) {
    return leftUpdatedAt > rightUpdatedAt ? left : right;
  }

  return canonicalLucidJson(left) >= canonicalLucidJson(right) ? left : right;
}

function mergeEntities(
  left: readonly LucidSyncEntity[],
  right: readonly LucidSyncEntity[]
): LucidSyncEntity[] {
  const merged = new Map<string, LucidSyncEntity>();
  [...left, ...right].forEach((entity) => {
    const mapKey = `${entity.entityType}:${entity.entityKey}`;
    const existing = merged.get(mapKey);
    merged.set(mapKey, existing ? resolveLucidEntityConflict(existing, entity) : entity);
  });
  return [...merged.values()].sort((a, b) => {
    const typeOrder = a.entityType.localeCompare(b.entityType);
    return typeOrder !== 0 ? typeOrder : a.entityKey.localeCompare(b.entityKey);
  });
}

export function getLucidSyncEntities(state: LucidTrainerState): LucidSyncEntity[] {
  return [
    { entityType: 'onboarding', entityKey: 'onboarding', value: state.onboarding },
    { entityType: 'preferences', entityKey: 'preferences', value: state.preferences },
    ...state.progress.map(
      (value): LucidSyncEntity => ({
        entityType: 'progress',
        entityKey: value.technique,
        value,
      })
    ),
    ...state.experiments.map(
      (value): LucidSyncEntity => ({ entityType: 'experiment', entityKey: value.id, value })
    ),
    ...state.realityChecks.map(
      (value): LucidSyncEntity => ({
        entityType: 'reality_check',
        entityKey: value.id,
        value,
      })
    ),
    ...state.weeklyReviews.map(
      (value): LucidSyncEntity => ({
        entityType: 'weekly_review',
        entityKey: value.id,
        value,
      })
    ),
  ];
}

export function applyLucidSyncEntity(
  state: LucidTrainerState,
  entity: LucidSyncEntity
): LucidTrainerState {
  const updatedAt = Math.max(state.updatedAt, entity.value.updatedAt);
  switch (entity.entityType) {
    case 'onboarding':
      return { ...state, onboarding: entity.value, updatedAt };
    case 'preferences':
      return { ...state, preferences: entity.value, updatedAt };
    case 'progress':
      // Remote/apply order must not decide the active program. The newest
      // active entity wins deterministically on every device.
      return applyLucidProgramProgress(state, entity.value);
    case 'experiment':
      return {
        ...state,
        updatedAt,
        experiments: [
          ...state.experiments.filter((item) => item.id !== entity.entityKey),
          entity.value,
        ].sort((a, b) => b.occurredAt - a.occurredAt || a.id.localeCompare(b.id)),
      };
    case 'reality_check':
      return {
        ...state,
        updatedAt,
        realityChecks: [
          ...state.realityChecks.filter((item) => item.id !== entity.entityKey),
          entity.value,
        ].sort((a, b) => b.occurredAt - a.occurredAt || a.id.localeCompare(b.id)),
      };
    case 'weekly_review':
      return {
        ...state,
        updatedAt,
        weeklyReviews: [
          ...state.weeklyReviews.filter((item) => item.id !== entity.entityKey),
          entity.value,
        ].sort((a, b) => b.weekStart.localeCompare(a.weekStart) || a.id.localeCompare(b.id)),
      };
  }
}

export function diffLucidProgramProgress(
  previous: readonly LucidProgramProgress[],
  next: readonly LucidProgramProgress[]
): LucidProgramProgress[] {
  const previousByTechnique = new Map(previous.map((item) => [item.technique, item]));
  return next.filter((item) => {
    const before = previousByTechnique.get(item.technique);
    return !before || canonicalLucidJson(before) !== canonicalLucidJson(item);
  });
}

/**
 * Activates `technique` and pauses every other active program in place.
 * Progress, cursor and practice dates of paused programs are preserved.
 */
export function activateExclusiveLucidProgram(
  state: LucidTrainerState,
  technique: LucidTechnique,
  now: number
): { next: LucidTrainerState; changed: LucidProgramProgress[] } {
  const existing =
    state.progress.find((item) => item.technique === technique) ??
    createLucidProgramProgress(technique, now);
  const mutationUpdatedAt =
    Math.max(now, state.updatedAt, ...state.progress.map((item) => item.updatedAt)) + 1;
  const progress: LucidProgramProgress = {
    ...existing,
    status: 'active',
    startedAt: existing.startedAt ?? now,
    updatedAt: mutationUpdatedAt,
  };
  const next = applyLucidProgramProgress(state, progress, technique);
  return { next, changed: diffLucidProgramProgress(state.progress, next.progress) };
}

export function removeLucidSyncEntity(
  state: LucidTrainerState,
  entityType: LucidSyncEntity['entityType'],
  entityKey: string,
  updatedAt: number
): LucidTrainerState {
  const nextUpdatedAt = Math.max(state.updatedAt, updatedAt);
  switch (entityType) {
    case 'onboarding':
    case 'preferences':
      // Singleton records are required for a valid local state. A server deletion
      // is represented by resetting the whole local state, not by deleting one.
      return state;
    case 'progress':
      return {
        ...state,
        updatedAt: nextUpdatedAt,
        progress: state.progress.filter((item) => item.technique !== entityKey),
      };
    case 'experiment':
      return {
        ...state,
        updatedAt: nextUpdatedAt,
        experiments: state.experiments.filter((item) => item.id !== entityKey),
      };
    case 'reality_check':
      return {
        ...state,
        updatedAt: nextUpdatedAt,
        realityChecks: state.realityChecks.filter((item) => item.id !== entityKey),
      };
    case 'weekly_review':
      return {
        ...state,
        updatedAt: nextUpdatedAt,
        weeklyReviews: state.weeklyReviews.filter((item) => item.id !== entityKey),
      };
  }
}

export function mergeLucidTrainerStates(
  left: LucidTrainerState,
  right: LucidTrainerState
): LucidTrainerState {
  const mergedEntities = mergeEntities(getLucidSyncEntities(left), getLucidSyncEntities(right));
  const onboarding = mergedEntities.find(
    (entity): entity is Extract<LucidSyncEntity, { entityType: 'onboarding' }> =>
      entity.entityType === 'onboarding'
  );
  const preferences = mergedEntities.find(
    (entity): entity is Extract<LucidSyncEntity, { entityType: 'preferences' }> =>
      entity.entityType === 'preferences'
  );
  if (!onboarding || !preferences) {
    throw new Error('Lucid Trainer state is missing required singleton entities');
  }

  return {
    schemaVersion: LUCID_TRAINER_SCHEMA_VERSION,
    createdAt: Math.min(left.createdAt, right.createdAt),
    updatedAt: Math.max(left.updatedAt, right.updatedAt),
    onboarding: onboarding.value,
    preferences: preferences.value,
    progress: enforceLucidSingleActiveProgram(
      mergedEntities
        .filter(
          (entity): entity is Extract<LucidSyncEntity, { entityType: 'progress' }> =>
            entity.entityType === 'progress'
        )
        .map((entity) => entity.value)
    ),
    experiments: mergedEntities
      .filter(
        (entity): entity is Extract<LucidSyncEntity, { entityType: 'experiment' }> =>
          entity.entityType === 'experiment'
      )
      .map((entity) => entity.value)
      .sort((a, b) => b.occurredAt - a.occurredAt || a.id.localeCompare(b.id)),
    realityChecks: mergedEntities
      .filter(
        (entity): entity is Extract<LucidSyncEntity, { entityType: 'reality_check' }> =>
          entity.entityType === 'reality_check'
      )
      .map((entity) => entity.value)
      .sort((a, b) => b.occurredAt - a.occurredAt || a.id.localeCompare(b.id)),
    weeklyReviews: mergedEntities
      .filter(
        (entity): entity is Extract<LucidSyncEntity, { entityType: 'weekly_review' }> =>
          entity.entityType === 'weekly_review'
      )
      .map((entity) => entity.value)
      .sort((a, b) => b.weekStart.localeCompare(a.weekStart) || a.id.localeCompare(b.id)),
  };
}

export function updateLucidOnboarding(
  state: LucidTrainerState,
  onboarding: LucidOnboardingState
): LucidTrainerState {
  return applyLucidSyncEntity(state, {
    entityType: 'onboarding',
    entityKey: 'onboarding',
    value: onboarding,
  });
}

export function updateLucidPreferences(
  state: LucidTrainerState,
  preferences: LucidTrainerPreferences
): LucidTrainerState {
  return applyLucidSyncEntity(state, {
    entityType: 'preferences',
    entityKey: 'preferences',
    value: preferences,
  });
}
