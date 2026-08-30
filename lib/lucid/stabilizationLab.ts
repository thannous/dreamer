export const LUCID_STABILIZATION_LAB_VERSION = 1 as const;
export const LUCID_STABILIZATION_LAB_MAX_DURATION_MS = 270_000 as const;
export const LUCID_STABILIZATION_LAB_MAX_SESSION_ID_LENGTH = 64 as const;
export const LUCID_STABILIZATION_LAB_MAX_COMPLETED_STEPS = 5 as const;
export const LUCID_STABILIZATION_LAB_MAX_REPEAT_COUNT = 99 as const;
export const LUCID_STABILIZATION_LAB_MAX_INSIGHT_SESSIONS = 200 as const;

export const LUCID_STABILIZATION_LAB_STEP_IDS = [
  'hands',
  'surface',
  'three_details',
  'intention',
  'slow_before_control',
] as const;

export type LucidStabilizationLabStepId =
  (typeof LUCID_STABILIZATION_LAB_STEP_IDS)[number];

export const LUCID_STABILIZATION_LAB_STATUSES = [
  'idle',
  'active',
  'paused',
  'interrupted',
  'completed',
] as const;

export type LucidStabilizationLabStatus =
  (typeof LUCID_STABILIZATION_LAB_STATUSES)[number];

export type LucidStabilizationLabStep = Readonly<{
  id: LucidStabilizationLabStepId;
  domain: 'orientation' | 'contact' | 'attention' | 'intention' | 'restraint';
  recommendedDurationMs: number;
}>;

export const LUCID_STABILIZATION_LAB_STEPS: readonly LucidStabilizationLabStep[] = [
  { id: 'hands', domain: 'orientation', recommendedDurationMs: 45_000 },
  { id: 'surface', domain: 'contact', recommendedDurationMs: 45_000 },
  { id: 'three_details', domain: 'attention', recommendedDurationMs: 60_000 },
  { id: 'intention', domain: 'intention', recommendedDurationMs: 60_000 },
  { id: 'slow_before_control', domain: 'restraint', recommendedDurationMs: 60_000 },
];

export const LUCID_STABILIZATION_LAB_STEP_COUNT = LUCID_STABILIZATION_LAB_STEPS.length;

export const LUCID_STABILIZATION_LAB_TOTAL_DURATION_MS =
  LUCID_STABILIZATION_LAB_STEPS.reduce(
    (total, step) => total + step.recommendedDurationMs,
    0
  );

export type LucidStabilizationLabRepeatCounts = Readonly<{
  [K in LucidStabilizationLabStepId]: number;
}>;

export type LucidStabilizationLabSession = Readonly<{
  version: typeof LUCID_STABILIZATION_LAB_VERSION;
  sessionId: string;
  status: LucidStabilizationLabStatus;
  stepIndex: number;
  stepCount: typeof LUCID_STABILIZATION_LAB_STEP_COUNT;
  completedStepIds: readonly LucidStabilizationLabStepId[];
  repeatCounts: LucidStabilizationLabRepeatCounts;
  startedAt: number | null;
  stepStartedAt: number | null;
  completedAt: number | null;
  updatedAt: number;
}>;

export type LucidStabilizationLabInsights = Readonly<{
  completionCount: number;
  practiceCount: number;
  repeatCount: number;
  lastPracticedAt: number | null;
  recentCompletedAt: number | null;
}>;

const SESSION_KEYS = [
  'version',
  'sessionId',
  'status',
  'stepIndex',
  'stepCount',
  'completedStepIds',
  'repeatCounts',
  'startedAt',
  'stepStartedAt',
  'completedAt',
  'updatedAt',
] as const;

const REPEAT_KEYS = LUCID_STABILIZATION_LAB_STEP_IDS;
const MAX_SAFE_TIMESTAMP = 8_640_000_000_000_000;
const SESSION_ID_PATTERN = /^[A-Za-z0-9:_-]{1,64}$/;
const FORBIDDEN_SESSION_IDS = new Set(['__proto__', 'constructor', 'prototype']);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
function hasExactKeys(value: object, expected: readonly string[]): boolean {
  const actual = Object.keys(value);
  return (
    actual.length === expected.length &&
    actual.every((key) => expected.includes(key)) &&
    expected.every((key) => Object.prototype.hasOwnProperty.call(value, key))
  );
}

function isFiniteTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= MAX_SAFE_TIMESTAMP;
}

function isNullableTimestamp(value: unknown): value is number | null {
  return value === null || isFiniteTimestamp(value);
}

function isSessionId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.trim() === value &&
    SESSION_ID_PATTERN.test(value) &&
    !FORBIDDEN_SESSION_IDS.has(value)
  );
}

function emptyRepeatCounts(): LucidStabilizationLabRepeatCounts {
  return {
    hands: 0,
    surface: 0,
    three_details: 0,
    intention: 0,
    slow_before_control: 0,
  };
}

function cloneRepeatCounts(
  counts: LucidStabilizationLabRepeatCounts
): LucidStabilizationLabRepeatCounts {
  return {
    hands: counts.hands,
    surface: counts.surface,
    three_details: counts.three_details,
    intention: counts.intention,
    slow_before_control: counts.slow_before_control,
  };
}

function currentStepId(session: LucidStabilizationLabSession): LucidStabilizationLabStepId {
  return LUCID_STABILIZATION_LAB_STEP_IDS[session.stepIndex];
}

function assertTimestamp(now: number): void {
  if (!isFiniteTimestamp(now)) {
    throw new Error('Invalid stabilization lab timestamp');
  }
}

function assertSessionId(sessionId: string): void {
  if (!isSessionId(sessionId)) {
    throw new Error('Invalid stabilization lab session id');
  }
}

function assertKnownSession(session: LucidStabilizationLabSession): void {
  if (!isLucidStabilizationLabSession(session)) {
    throw new Error('Invalid stabilization lab session');
  }
}

function nextTimestamp(session: LucidStabilizationLabSession, now: number): number {
  assertTimestamp(now);
  if (now < session.updatedAt) {
    throw new Error('Stabilization lab timestamp cannot regress');
  }
  const next = now === session.updatedAt ? now + 1 : now;
  assertTimestamp(next);
  return next;
}

function withUpdate(
  session: LucidStabilizationLabSession,
  now: number,
  patch: Partial<LucidStabilizationLabSession>
): LucidStabilizationLabSession {
  const next: LucidStabilizationLabSession = {
    ...session,
    ...patch,
    completedStepIds: patch.completedStepIds
      ? [...patch.completedStepIds]
      : [...session.completedStepIds],
    repeatCounts: cloneRepeatCounts(patch.repeatCounts ?? session.repeatCounts),
    updatedAt: nextTimestamp(session, now),
  };
  if (!isLucidStabilizationLabSession(next)) {
    throw new Error('Invalid stabilization lab session');
  }
  return next;
}

export function getLucidStabilizationLabCurrentStep(
  session: LucidStabilizationLabSession
): LucidStabilizationLabStep {
  assertKnownSession(session);
  return LUCID_STABILIZATION_LAB_STEPS[session.stepIndex];
}

export function createLucidStabilizationLabSessionId(now: number, entropy: string): string {
  assertTimestamp(now);
  const cleaned = String(entropy).replace(/[^A-Za-z0-9_-]/g, '');
  const sessionId = `stab_${now.toString(36)}_${cleaned || 'x'}`.slice(
    0,
    LUCID_STABILIZATION_LAB_MAX_SESSION_ID_LENGTH
  );
  assertSessionId(sessionId);
  return sessionId;
}

export function createLucidStabilizationLabSession(params: {
  now: number;
  sessionId: string;
}): LucidStabilizationLabSession {
  assertTimestamp(params.now);
  assertSessionId(params.sessionId);
  return {
    version: LUCID_STABILIZATION_LAB_VERSION,
    sessionId: params.sessionId,
    status: 'idle',
    stepIndex: 0,
    stepCount: LUCID_STABILIZATION_LAB_STEP_COUNT,
    completedStepIds: [],
    repeatCounts: emptyRepeatCounts(),
    startedAt: null,
    stepStartedAt: null,
    completedAt: null,
    updatedAt: params.now,
  };
}

export function startLucidStabilizationLabSession(
  session: LucidStabilizationLabSession,
  now: number
): LucidStabilizationLabSession {
  assertKnownSession(session);
  if (session.status === 'active' && session.startedAt !== null) {
    return session;
  }
  if (session.status !== 'idle') {
    throw new Error('Only an idle stabilization lab session can start');
  }
  const updatedAt = nextTimestamp(session, now);
  return withUpdate(session, now, {
    status: 'active',
    startedAt: updatedAt,
    stepStartedAt: updatedAt,
  });
}

export function advanceLucidStabilizationLabSession(
  session: LucidStabilizationLabSession,
  now: number
): LucidStabilizationLabSession {
  assertKnownSession(session);
  if (session.status !== 'active') {
    throw new Error('Only an active stabilization lab session can advance');
  }
  const stepId = currentStepId(session);
  const alreadyCompleted = session.completedStepIds.includes(stepId);
  if (session.stepIndex >= session.stepCount - 1) {
    if (alreadyCompleted) {
      throw new Error('Stabilization lab is ready to complete');
    }
    return withUpdate(session, now, {
      completedStepIds: [...session.completedStepIds, stepId],
    });
  }
  return withUpdate(session, now, {
    stepIndex: session.stepIndex + 1,
    completedStepIds: alreadyCompleted
      ? session.completedStepIds
      : [...session.completedStepIds, stepId],
    stepStartedAt: nextTimestamp(session, now),
  });
}

export function repeatLucidStabilizationLabStep(
  session: LucidStabilizationLabSession,
  now: number
): LucidStabilizationLabSession {
  assertKnownSession(session);
  if (session.status !== 'active') {
    throw new Error('Only an active stabilization lab session can repeat a step');
  }
  const stepId = currentStepId(session);
  const nextCount = session.repeatCounts[stepId] + 1;
  if (nextCount > LUCID_STABILIZATION_LAB_MAX_REPEAT_COUNT) {
    throw new Error('Stabilization lab repeat cap exceeded');
  }
  return withUpdate(session, now, {
    repeatCounts: { ...cloneRepeatCounts(session.repeatCounts), [stepId]: nextCount },
    stepStartedAt: nextTimestamp(session, now),
  });
}

export function pauseLucidStabilizationLabSession(
  session: LucidStabilizationLabSession,
  now: number
): LucidStabilizationLabSession {
  assertKnownSession(session);
  if (session.status === 'paused') return session;
  if (session.status !== 'active') {
    throw new Error('Only an active stabilization lab session can pause');
  }
  return withUpdate(session, now, { status: 'paused' });
}

export function interruptLucidStabilizationLabSession(
  session: LucidStabilizationLabSession,
  now: number
): LucidStabilizationLabSession {
  assertKnownSession(session);
  if (session.status === 'interrupted') return session;
  if (session.status === 'completed' || session.status === 'idle') {
    throw new Error('Stabilization lab session cannot be interrupted');
  }
  return withUpdate(session, now, { status: 'interrupted' });
}

export function resumeLucidStabilizationLabSession(
  session: LucidStabilizationLabSession,
  now: number
): LucidStabilizationLabSession {
  assertKnownSession(session);
  if (session.status === 'active') return session;
  if (session.status !== 'paused' && session.status !== 'interrupted') {
    throw new Error('Only a paused or interrupted stabilization lab session can resume');
  }
  const updatedAt = nextTimestamp(session, now);
  return withUpdate(session, now, {
    status: 'active',
    stepStartedAt: updatedAt,
  });
}

export function completeLucidStabilizationLabSession(
  session: LucidStabilizationLabSession,
  now: number
): LucidStabilizationLabSession {
  assertKnownSession(session);
  if (session.status === 'completed') return session;
  if (session.status !== 'active' || session.stepIndex !== session.stepCount - 1) {
    throw new Error('Stabilization lab must finish its last step before completion');
  }
  const lastStepId = currentStepId(session);
  if (!session.completedStepIds.includes(lastStepId)) {
    throw new Error('Stabilization lab last step must be completed before finishing');
  }
  const updatedAt = nextTimestamp(session, now);
  return withUpdate(session, now, {
    status: 'completed',
    completedAt: updatedAt,
  });
}

function isRepeatCounts(value: unknown): value is LucidStabilizationLabRepeatCounts {
  if (!isPlainObject(value) || !hasExactKeys(value, REPEAT_KEYS)) return false;
  return REPEAT_KEYS.every((id) => {
    const count = value[id];
    return (
      typeof count === 'number' &&
      Number.isSafeInteger(count) &&
      count >= 0 &&
      count <= LUCID_STABILIZATION_LAB_MAX_REPEAT_COUNT
    );
  });
}

function isCompletedStepIds(
  value: unknown
): value is readonly LucidStabilizationLabStepId[] {
  if (!Array.isArray(value) || value.length > LUCID_STABILIZATION_LAB_MAX_COMPLETED_STEPS) {
    return false;
  }
  const seen = new Set<string>();
  for (const [index, id] of value.entries()) {
    if (!LUCID_STABILIZATION_LAB_STEP_IDS.includes(id as LucidStabilizationLabStepId)) {
      return false;
    }
    if (seen.has(id) || LUCID_STABILIZATION_LAB_STEP_IDS.indexOf(id) !== index) {
      return false;
    }
    seen.add(id);
  }
  return true;
}

export function isLucidStabilizationLabSession(
  value: unknown
): value is LucidStabilizationLabSession {
  if (!isPlainObject(value) || !hasExactKeys(value, SESSION_KEYS)) return false;
  if (value.version !== LUCID_STABILIZATION_LAB_VERSION) return false;
  if (!isSessionId(value.sessionId)) return false;
  if (!LUCID_STABILIZATION_LAB_STATUSES.includes(value.status as LucidStabilizationLabStatus)) {
    return false;
  }
  if (value.stepCount !== LUCID_STABILIZATION_LAB_STEP_COUNT) return false;
  if (
    typeof value.stepIndex !== 'number' ||
    !Number.isSafeInteger(value.stepIndex) ||
    value.stepIndex < 0 ||
    value.stepIndex >= LUCID_STABILIZATION_LAB_STEP_COUNT
  ) {
    return false;
  }
  if (!isCompletedStepIds(value.completedStepIds)) return false;
  if (!isRepeatCounts(value.repeatCounts)) return false;
  if (!isNullableTimestamp(value.startedAt)) return false;
  if (!isNullableTimestamp(value.stepStartedAt)) return false;
  if (!isNullableTimestamp(value.completedAt)) return false;
  if (!isFiniteTimestamp(value.updatedAt)) return false;

  const status = value.status as LucidStabilizationLabStatus;
  const completedStepIds = value.completedStepIds as LucidStabilizationLabStepId[];
  const repeatCounts = value.repeatCounts as LucidStabilizationLabRepeatCounts;
  const lastStepIndex = LUCID_STABILIZATION_LAB_STEP_COUNT - 1;
  const reachedStepIds = LUCID_STABILIZATION_LAB_STEP_IDS.slice(0, value.stepIndex + 1);
  const futureStepIds = LUCID_STABILIZATION_LAB_STEP_IDS.slice(value.stepIndex + 1);
  const lastStepReady =
    value.stepIndex === lastStepIndex &&
    completedStepIds.length === LUCID_STABILIZATION_LAB_STEP_COUNT &&
    completedStepIds.every((id, index) => id === LUCID_STABILIZATION_LAB_STEP_IDS[index]);

  if (completedStepIds.length > value.stepIndex + 1) return false;
  if (completedStepIds.length === value.stepIndex + 1) {
    if (!lastStepReady) return false;
  } else if (completedStepIds.length !== value.stepIndex) {
    return false;
  } else if (!completedStepIds.every((id, index) => id === LUCID_STABILIZATION_LAB_STEP_IDS[index])) {
    return false;
  }

  if (futureStepIds.some((id) => repeatCounts[id] !== 0)) return false;
  if (reachedStepIds.some((id) => repeatCounts[id] < 0)) return false;

  if (status === 'idle') {
    return (
      value.startedAt === null &&
      value.stepStartedAt === null &&
      value.completedAt === null &&
      value.stepIndex === 0 &&
      completedStepIds.length === 0 &&
      REPEAT_KEYS.every((id) => repeatCounts[id] === 0)
    );
  }

  if (value.startedAt === null || value.stepStartedAt === null) return false;
  if (value.startedAt > value.stepStartedAt || value.stepStartedAt > value.updatedAt) return false;

  if (status === 'completed') {
    return (
      lastStepReady &&
      isFiniteTimestamp(value.completedAt) &&
      value.completedAt >= value.stepStartedAt &&
      value.completedAt <= value.updatedAt
    );
  }

  return value.completedAt === null;
}

export function parseLucidStabilizationLabSession(
  value: unknown
): LucidStabilizationLabSession | null {
  if (!isLucidStabilizationLabSession(value)) return null;
  return {
    version: LUCID_STABILIZATION_LAB_VERSION,
    sessionId: value.sessionId,
    status: value.status,
    stepIndex: value.stepIndex,
    stepCount: LUCID_STABILIZATION_LAB_STEP_COUNT,
    completedStepIds: [...value.completedStepIds],
    repeatCounts: cloneRepeatCounts(value.repeatCounts),
    startedAt: value.startedAt,
    stepStartedAt: value.stepStartedAt,
    completedAt: value.completedAt,
    updatedAt: value.updatedAt,
  };
}

export function projectLucidStabilizationLabInsights(
  sessions: readonly unknown[]
): LucidStabilizationLabInsights {
  const bounded = sessions.slice(0, LUCID_STABILIZATION_LAB_MAX_INSIGHT_SESSIONS);
  const valid = bounded
    .map((session) => parseLucidStabilizationLabSession(session))
    .filter((session): session is LucidStabilizationLabSession => session !== null);

  let completionCount = 0;
  let practiceCount = 0;
  let repeatCount = 0;
  let lastPracticedAt: number | null = null;
  let recentCompletedAt: number | null = null;

  for (const session of valid) {
    if (session.status === 'idle') continue;
    practiceCount += 1;
    repeatCount += REPEAT_KEYS.reduce((total, id) => total + session.repeatCounts[id], 0);
    if (lastPracticedAt === null || session.updatedAt > lastPracticedAt) {
      lastPracticedAt = session.updatedAt;
    }
    if (session.status === 'completed' && session.completedAt !== null) {
      completionCount += 1;
      if (recentCompletedAt === null || session.completedAt > recentCompletedAt) {
        recentCompletedAt = session.completedAt;
      }
    }
  }

  return {
    completionCount,
    practiceCount,
    repeatCount,
    lastPracticedAt,
    recentCompletedAt,
  };
}

export function assertLucidStabilizationLabCatalog(): void {
  if (LUCID_STABILIZATION_LAB_STEP_COUNT !== 5) {
    throw new Error('Stabilization lab must expose five ordered steps');
  }
  if (
    LUCID_STABILIZATION_LAB_TOTAL_DURATION_MS <= 0 ||
    LUCID_STABILIZATION_LAB_TOTAL_DURATION_MS > LUCID_STABILIZATION_LAB_MAX_DURATION_MS
  ) {
    throw new Error('Stabilization lab recommended duration is out of bounds');
  }
}
