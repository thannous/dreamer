import {
  createLucidGuidedRitualPlan,
  type LucidGuidedRitualPhase,
  type LucidGuidedRitualPhaseId,
  type LucidGuidedRitualPlan,
} from '@/lib/lucid/guidedRitual';
import type { LucidSafetyPolicy } from '@/lib/lucid/safety';

export const LUCID_SSILD_SENSORY_LAB_VERSION = 1 as const;
export const LUCID_SSILD_SENSORY_LAB_MAX_SESSION_ID_LENGTH = 64 as const;
export const LUCID_SSILD_SENSORY_LAB_MAX_SAFE_TIMESTAMP = 8_640_000_000_000_000;

export const LUCID_SSILD_SENSORY_LAB_STATUSES = [
  'idle',
  'running',
  'paused',
  'interrupted',
  'completed',
] as const;
export type LucidSsildSensoryLabStatus =
  (typeof LUCID_SSILD_SENSORY_LAB_STATUSES)[number];

export const LUCID_SSILD_SENSORY_LAB_PLAN_MODES = ['full', 'reduced'] as const;
export type LucidSsildSensoryLabPlanMode =
  (typeof LUCID_SSILD_SENSORY_LAB_PLAN_MODES)[number];

export const LUCID_SSILD_SENSORY_FOCUSES = [
  'settle',
  'sight',
  'sound',
  'body',
  'release',
] as const;
export type LucidSsildSensoryFocus = (typeof LUCID_SSILD_SENSORY_FOCUSES)[number];

export const LUCID_SSILD_SENSORY_CYCLES = ['direct', 'slow', 'transition'] as const;
export type LucidSsildSensoryCycle = (typeof LUCID_SSILD_SENSORY_CYCLES)[number];

export const LUCID_SSILD_SENSORY_VISUAL_STATES = ['emphasis', 'dim', 'neutral'] as const;
export type LucidSsildSensoryVisualState =
  (typeof LUCID_SSILD_SENSORY_VISUAL_STATES)[number];

export const LUCID_SSILD_SENSORY_HAPTIC_POLICIES = ['none', 'subtle'] as const;
export type LucidSsildSensoryHapticPolicy =
  (typeof LUCID_SSILD_SENSORY_HAPTIC_POLICIES)[number];

export const LUCID_SSILD_SENSORY_AUDIO_POLICIES = ['silent', 'cue'] as const;
export type LucidSsildSensoryAudioPolicy =
  (typeof LUCID_SSILD_SENSORY_AUDIO_POLICIES)[number];

export const LUCID_SSILD_SENSORY_PHASE_IDS = [
  'ssild_settle',
  'ssild_sight_direct',
  'ssild_sound_direct',
  'ssild_body_direct',
  'ssild_sight_slow',
  'ssild_sound_slow',
  'ssild_body_slow',
  'ssild_release',
] as const;
export type LucidSsildSensoryPhaseId =
  (typeof LUCID_SSILD_SENSORY_PHASE_IDS)[number];

export const LUCID_SSILD_SENSORY_INTERRUPTION_REASONS = [
  'none',
  'audio_route',
  'user_exit',
  'external',
] as const;
export type LucidSsildSensoryInterruptionReason =
  (typeof LUCID_SSILD_SENSORY_INTERRUPTION_REASONS)[number];

export const LUCID_SSILD_SENSORY_ACTIVE_INTERRUPTION_REASONS = [
  'audio_route',
  'user_exit',
  'external',
] as const;
export type LucidSsildSensoryActiveInterruptionReason =
  (typeof LUCID_SSILD_SENSORY_ACTIVE_INTERRUPTION_REASONS)[number];

export type LucidSsildSensoryPhase = Readonly<{
  id: LucidSsildSensoryPhaseId;
  sourcePhaseId: LucidGuidedRitualPhaseId;
  focus: LucidSsildSensoryFocus;
  cycle: LucidSsildSensoryCycle;
  durationMs: number;
  visual: LucidSsildSensoryVisualState;
  haptic: LucidSsildSensoryHapticPolicy;
  audio: LucidSsildSensoryAudioPolicy;
  audioCueId: 'none' | LucidSsildSensoryPhaseId;
  a11yStateId: `ssild.${LucidSsildSensoryPhaseId}`;
}>;

export type LucidSsildSensoryLabPlan = Readonly<{
  mode: LucidSsildSensoryLabPlanMode;
  soundAllowed: boolean;
  totalDurationMs: number;
  phases: readonly LucidSsildSensoryPhase[];
}>;

export type LucidSsildSensoryLabSession = Readonly<{
  version: typeof LUCID_SSILD_SENSORY_LAB_VERSION;
  sessionId: string;
  planMode: LucidSsildSensoryLabPlanMode;
  soundAllowed: boolean;
  status: LucidSsildSensoryLabStatus;
  phaseIndex: number;
  phaseCount: number;
  elapsedInPhaseMs: number;
  accumulatedElapsedMs: number;
  startedAt: number | null;
  lastResumedAt: number | null;
  pausedAt: number | null;
  completedAt: number | null;
  updatedAt: number;
  interruptionReason: LucidSsildSensoryInterruptionReason;
}>;

export type LucidSsildSensoryLabFeedback = Readonly<{
  phaseChanged: boolean;
  enteredFocus: LucidSsildSensoryFocus | null;
  previousPhaseIndex: number;
  phaseIndex: number;
  a11yStateId: LucidSsildSensoryPhase['a11yStateId'];
}>;

export type LucidSsildSensoryLabTickResult = Readonly<{
  session: LucidSsildSensoryLabSession;
  feedback: LucidSsildSensoryLabFeedback;
}>;

const SESSION_KEYS = [
  'version',
  'sessionId',
  'planMode',
  'soundAllowed',
  'status',
  'phaseIndex',
  'phaseCount',
  'elapsedInPhaseMs',
  'accumulatedElapsedMs',
  'startedAt',
  'lastResumedAt',
  'pausedAt',
  'completedAt',
  'updatedAt',
  'interruptionReason',
] as const;

const SESSION_ID_PATTERN = /^[A-Za-z0-9:_-]{1,64}$/;
const FORBIDDEN_SESSION_IDS = new Set(['__proto__', 'constructor', 'prototype']);

const FULL_SOURCE_PHASE_IDS: readonly LucidGuidedRitualPhaseId[] = [
  'ssild_settle',
  'ssild_sight',
  'ssild_sound',
  'ssild_body',
  'ssild_slow_cycle',
  'ssild_release',
];

const REDUCED_SOURCE_PHASE_IDS: readonly LucidGuidedRitualPhaseId[] = [
  'ssild_sight',
  'ssild_sound',
  'ssild_body',
  'ssild_release',
];

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
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= LUCID_SSILD_SENSORY_LAB_MAX_SAFE_TIMESTAMP
  );
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

function isEnumValue<T extends string>(
  values: readonly T[],
  value: unknown
): value is T {
  return typeof value === 'string' && values.includes(value as T);
}

function isDurationMs(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function assertTimestamp(value: number): void {
  if (!isFiniteTimestamp(value)) {
    throw new Error('Invalid SSILD sensory lab timestamp');
  }
}

function assertSessionId(value: string): void {
  if (!isSessionId(value)) {
    throw new Error('Invalid SSILD sensory lab session id');
  }
}

function stamp(session: LucidSsildSensoryLabSession, now: number): number {
  assertTimestamp(now);
  if (now < session.updatedAt) {
    throw new Error('SSILD sensory lab timestamp cannot regress');
  }
  return now;
}

function clonePhase(phase: LucidSsildSensoryPhase): LucidSsildSensoryPhase {
  return {
    id: phase.id,
    sourcePhaseId: phase.sourcePhaseId,
    focus: phase.focus,
    cycle: phase.cycle,
    durationMs: phase.durationMs,
    visual: phase.visual,
    haptic: phase.haptic,
    audio: phase.audio,
    audioCueId: phase.audioCueId,
    a11yStateId: phase.a11yStateId,
  };
}

function cloneSession(session: LucidSsildSensoryLabSession): LucidSsildSensoryLabSession {
  return {
    version: LUCID_SSILD_SENSORY_LAB_VERSION,
    sessionId: session.sessionId,
    planMode: session.planMode,
    soundAllowed: session.soundAllowed,
    status: session.status,
    phaseIndex: session.phaseIndex,
    phaseCount: session.phaseCount,
    elapsedInPhaseMs: session.elapsedInPhaseMs,
    accumulatedElapsedMs: session.accumulatedElapsedMs,
    startedAt: session.startedAt,
    lastResumedAt: session.lastResumedAt,
    pausedAt: session.pausedAt,
    completedAt: session.completedAt,
    updatedAt: session.updatedAt,
    interruptionReason: session.interruptionReason,
  };
}

function secondsToMs(durationSeconds: number): number {
  if (!Number.isSafeInteger(durationSeconds) || durationSeconds <= 0) {
    throw new Error('Invalid SSILD sensory lab phase duration');
  }
  return durationSeconds * 1000;
}

function splitSlowCycleDurationMs(durationMs: number): readonly [number, number, number] {
  if (!isDurationMs(durationMs)) {
    throw new Error('Invalid SSILD sensory lab slow-cycle duration');
  }
  const base = Math.floor(durationMs / 3);
  const remainder = durationMs % 3;
  const sight = base + (remainder > 0 ? 1 : 0);
  const sound = base + (remainder > 1 ? 1 : 0);
  const body = durationMs - sight - sound;
  if (!isDurationMs(sight) || !isDurationMs(sound) || !isDurationMs(body)) {
    throw new Error('Invalid SSILD sensory lab slow-cycle split');
  }
  if (sight + sound + body !== durationMs) {
    throw new Error('SSILD sensory lab slow-cycle split must preserve duration');
  }
  return [sight, sound, body];
}

function presentationForFocus(
  focus: LucidSsildSensoryFocus,
  soundAllowed: boolean,
  phaseId: LucidSsildSensoryPhaseId
): Pick<LucidSsildSensoryPhase, 'visual' | 'haptic' | 'audio' | 'audioCueId' | 'a11yStateId'> {
  return {
    visual: focus === 'sound' ? 'dim' : focus === 'sight' ? 'emphasis' : 'neutral',
    haptic: focus === 'body' ? 'subtle' : 'none',
    audio: soundAllowed ? 'cue' : 'silent',
    audioCueId: soundAllowed ? phaseId : 'none',
    a11yStateId: `ssild.${phaseId}`,
  };
}

function sensoryPhase(params: {
  id: LucidSsildSensoryPhaseId;
  sourcePhaseId: LucidGuidedRitualPhaseId;
  focus: LucidSsildSensoryFocus;
  cycle: LucidSsildSensoryCycle;
  durationMs: number;
  soundAllowed: boolean;
}): LucidSsildSensoryPhase {
  if (!isDurationMs(params.durationMs)) {
    throw new Error('Invalid SSILD sensory lab phase duration');
  }
  return {
    id: params.id,
    sourcePhaseId: params.sourcePhaseId,
    focus: params.focus,
    cycle: params.cycle,
    durationMs: params.durationMs,
    ...presentationForFocus(params.focus, params.soundAllowed, params.id),
  };
}

function expectedSourceIds(
  mode: LucidSsildSensoryLabPlanMode
): readonly LucidGuidedRitualPhaseId[] {
  return mode === 'full' ? FULL_SOURCE_PHASE_IDS : REDUCED_SOURCE_PHASE_IDS;
}

function assertReadySsildPlan(plan: LucidGuidedRitualPlan): LucidSsildSensoryLabPlanMode {
  if (plan.status !== 'ready') {
    throw new Error('SSILD sensory lab requires a ready guided ritual plan');
  }
  if (plan.technique !== 'ssild') {
    throw new Error('SSILD sensory lab requires an SSILD guided ritual plan');
  }
  if (plan.mode === 'replacement' || plan.objective === 'protect_sleep') {
    throw new Error('SSILD sensory lab does not accept recovery replacement plans');
  }
  if (plan.mode !== 'full' && plan.mode !== 'reduced') {
    throw new Error('SSILD sensory lab requires a full or reduced SSILD plan');
  }
  if (typeof plan.soundAllowed !== 'boolean') {
    throw new Error('SSILD sensory lab requires an explicit sound policy');
  }
  const expected = expectedSourceIds(plan.mode);
  if (plan.phases.length !== expected.length) {
    throw new Error('SSILD sensory lab plan phases are inconsistent');
  }
  let totalSeconds = 0;
  for (const [index, phase] of plan.phases.entries()) {
    if (phase.id !== expected[index]) {
      throw new Error('SSILD sensory lab plan phases are inconsistent');
    }
    if (!Number.isSafeInteger(phase.durationSeconds) || phase.durationSeconds <= 0) {
      throw new Error('Invalid SSILD sensory lab phase duration');
    }
    totalSeconds += phase.durationSeconds;
  }
  if (plan.totalDurationSeconds !== totalSeconds) {
    throw new Error('SSILD sensory lab plan duration is inconsistent');
  }
  return plan.mode;
}

function expandSourcePhase(
  phase: LucidGuidedRitualPhase,
  soundAllowed: boolean
): readonly LucidSsildSensoryPhase[] {
  const durationMs = secondsToMs(phase.durationSeconds);
  if (phase.id === 'ssild_settle') {
    return [
      sensoryPhase({
        id: 'ssild_settle',
        sourcePhaseId: phase.id,
        focus: 'settle',
        cycle: 'transition',
        durationMs,
        soundAllowed,
      }),
    ];
  }
  if (phase.id === 'ssild_sight') {
    return [
      sensoryPhase({
        id: 'ssild_sight_direct',
        sourcePhaseId: phase.id,
        focus: 'sight',
        cycle: 'direct',
        durationMs,
        soundAllowed,
      }),
    ];
  }
  if (phase.id === 'ssild_sound') {
    return [
      sensoryPhase({
        id: 'ssild_sound_direct',
        sourcePhaseId: phase.id,
        focus: 'sound',
        cycle: 'direct',
        durationMs,
        soundAllowed,
      }),
    ];
  }
  if (phase.id === 'ssild_body') {
    return [
      sensoryPhase({
        id: 'ssild_body_direct',
        sourcePhaseId: phase.id,
        focus: 'body',
        cycle: 'direct',
        durationMs,
        soundAllowed,
      }),
    ];
  }
  if (phase.id === 'ssild_slow_cycle') {
    const [sight, sound, body] = splitSlowCycleDurationMs(durationMs);
    return [
      sensoryPhase({
        id: 'ssild_sight_slow',
        sourcePhaseId: phase.id,
        focus: 'sight',
        cycle: 'slow',
        durationMs: sight,
        soundAllowed,
      }),
      sensoryPhase({
        id: 'ssild_sound_slow',
        sourcePhaseId: phase.id,
        focus: 'sound',
        cycle: 'slow',
        durationMs: sound,
        soundAllowed,
      }),
      sensoryPhase({
        id: 'ssild_body_slow',
        sourcePhaseId: phase.id,
        focus: 'body',
        cycle: 'slow',
        durationMs: body,
        soundAllowed,
      }),
    ];
  }
  if (phase.id === 'ssild_release') {
    return [
      sensoryPhase({
        id: 'ssild_release',
        sourcePhaseId: phase.id,
        focus: 'release',
        cycle: 'transition',
        durationMs,
        soundAllowed,
      }),
    ];
  }
  throw new Error('SSILD sensory lab plan phases are inconsistent');
}

function policyForStoredPlan(
  mode: LucidSsildSensoryLabPlanMode,
  soundAllowed: boolean
): LucidSafetyPolicy {
  return {
    mode: mode === 'reduced' ? 'reducedIntensity' : 'normal',
    allowWbtb: mode === 'full',
    allowNightSignals: soundAllowed,
    nightSignalIntensity: soundAllowed ? 'normal' : 'blocked',
    emergencyStopAllowed: true,
    reasons: [],
  };
}

function phasePrefixMs(plan: LucidSsildSensoryLabPlan, phaseIndex: number): number {
  return plan.phases.slice(0, phaseIndex).reduce((total, phase) => total + phase.durationMs, 0);
}

function resolveElapsedPosition(
  plan: LucidSsildSensoryLabPlan,
  elapsedMs: number
): Readonly<{
  phaseIndex: number;
  elapsedInPhaseMs: number;
  accumulatedElapsedMs: number;
  completed: boolean;
}> {
  const total = plan.totalDurationMs;
  if (!Number.isSafeInteger(elapsedMs) || elapsedMs < 0) {
    throw new Error('Invalid SSILD sensory lab elapsed time');
  }
  const accumulatedElapsedMs = Math.min(elapsedMs, total);
  if (accumulatedElapsedMs >= total) {
    const lastIndex = plan.phases.length - 1;
    return {
      phaseIndex: lastIndex,
      elapsedInPhaseMs: plan.phases[lastIndex].durationMs,
      accumulatedElapsedMs: total,
      completed: true,
    };
  }

  let remaining = accumulatedElapsedMs;
  for (let index = 0; index < plan.phases.length; index += 1) {
    const durationMs = plan.phases[index].durationMs;
    if (remaining < durationMs) {
      return {
        phaseIndex: index,
        elapsedInPhaseMs: remaining,
        accumulatedElapsedMs,
        completed: false,
      };
    }
    remaining -= durationMs;
  }

  const lastIndex = plan.phases.length - 1;
  return {
    phaseIndex: lastIndex,
    elapsedInPhaseMs: plan.phases[lastIndex].durationMs,
    accumulatedElapsedMs: total,
    completed: true,
  };
}

export function createLucidSsildSensoryLabPlan(
  plan: LucidGuidedRitualPlan
): LucidSsildSensoryLabPlan {
  const mode = assertReadySsildPlan(plan);
  const phases = plan.phases.flatMap((phase) => expandSourcePhase(phase, plan.soundAllowed));
  const totalDurationMs = phases.reduce((total, phase) => total + phase.durationMs, 0);
  if (totalDurationMs !== plan.totalDurationSeconds * 1000) {
    throw new Error('SSILD sensory lab plan duration is inconsistent');
  }
  return {
    mode,
    soundAllowed: plan.soundAllowed,
    totalDurationMs,
    phases,
  };
}

export function deriveLucidSsildSensoryLabPlan(
  session: Pick<LucidSsildSensoryLabSession, 'planMode' | 'soundAllowed'>
): LucidSsildSensoryLabPlan {
  const guided = createLucidGuidedRitualPlan(
    'ssild',
    policyForStoredPlan(session.planMode, session.soundAllowed)
  );
  if (guided.status !== 'ready') {
    throw new Error('SSILD sensory lab requires a ready guided ritual plan');
  }
  return createLucidSsildSensoryLabPlan(guided);
}

function planForSession(session: LucidSsildSensoryLabSession): LucidSsildSensoryLabPlan {
  const plan = deriveLucidSsildSensoryLabPlan(session);
  if (plan.phases.length !== session.phaseCount) {
    throw new Error('SSILD sensory lab session phase count is inconsistent');
  }
  return plan;
}

function assertKnownSession(session: LucidSsildSensoryLabSession): LucidSsildSensoryLabPlan {
  if (!isLucidSsildSensoryLabSession(session)) {
    throw new Error('Invalid SSILD sensory lab session');
  }
  return planForSession(session);
}

function currentElapsedMs(session: LucidSsildSensoryLabSession, now: number): number {
  assertTimestamp(now);
  if (session.status !== 'running' || session.lastResumedAt === null) {
    return session.accumulatedElapsedMs;
  }
  if (now < session.lastResumedAt) {
    throw new Error('SSILD sensory lab timestamp cannot regress');
  }
  return session.accumulatedElapsedMs + (now - session.lastResumedAt);
}

function withSession(
  session: LucidSsildSensoryLabSession,
  now: number,
  patch: Partial<LucidSsildSensoryLabSession>
): LucidSsildSensoryLabSession {
  const next = cloneSession({
    ...session,
    ...patch,
    updatedAt: stamp(session, now),
  });
  if (!isLucidSsildSensoryLabSession(next)) {
    throw new Error('Invalid SSILD sensory lab session');
  }
  return next;
}

function feedbackFrom(
  previous: LucidSsildSensoryLabSession,
  next: LucidSsildSensoryLabSession,
  plan: LucidSsildSensoryLabPlan
): LucidSsildSensoryLabFeedback {
  const phase = plan.phases[next.phaseIndex];
  const phaseChanged = previous.phaseIndex !== next.phaseIndex;
  return {
    phaseChanged,
    enteredFocus: phaseChanged ? phase.focus : null,
    previousPhaseIndex: previous.phaseIndex,
    phaseIndex: next.phaseIndex,
    a11yStateId: phase.a11yStateId,
  };
}

function applyElapsed(
  session: LucidSsildSensoryLabSession,
  plan: LucidSsildSensoryLabPlan,
  now: number,
  elapsedMs: number,
  options: {
    status: Exclude<LucidSsildSensoryLabStatus, 'idle'>;
    interruptionReason: LucidSsildSensoryInterruptionReason;
    lastResumedAt: number | null;
    pausedAt: number | null;
    completedAt: number | null;
    allowComplete: boolean;
  }
): LucidSsildSensoryLabSession {
  const position = resolveElapsedPosition(plan, elapsedMs);
  if (position.completed && options.allowComplete) {
    return withSession(session, now, {
      status: 'completed',
      phaseIndex: position.phaseIndex,
      elapsedInPhaseMs: position.elapsedInPhaseMs,
      accumulatedElapsedMs: position.accumulatedElapsedMs,
      lastResumedAt: null,
      pausedAt: null,
      completedAt: now,
      interruptionReason: 'none',
    });
  }
  return withSession(session, now, {
    status: options.status,
    phaseIndex: position.phaseIndex,
    elapsedInPhaseMs: position.elapsedInPhaseMs,
    accumulatedElapsedMs: position.accumulatedElapsedMs,
    lastResumedAt: options.lastResumedAt,
    pausedAt: options.pausedAt,
    completedAt: options.completedAt,
    interruptionReason: options.interruptionReason,
  });
}

export function createLucidSsildSensoryLabSessionId(now: number, entropy: string): string {
  assertTimestamp(now);
  const cleaned = String(entropy).replace(/[^A-Za-z0-9_-]/g, '');
  const sessionId = `ssild_${now.toString(36)}_${cleaned || 'x'}`.slice(
    0,
    LUCID_SSILD_SENSORY_LAB_MAX_SESSION_ID_LENGTH
  );
  assertSessionId(sessionId);
  return sessionId;
}

export function createLucidSsildSensoryLabSession(params: {
  plan: LucidGuidedRitualPlan;
  sessionId: string;
  now: number;
}): LucidSsildSensoryLabSession {
  assertTimestamp(params.now);
  assertSessionId(params.sessionId);
  const plan = createLucidSsildSensoryLabPlan(params.plan);
  if (plan.phases.length === 0) {
    throw new Error('SSILD sensory lab plan has no phases');
  }
  return {
    version: LUCID_SSILD_SENSORY_LAB_VERSION,
    sessionId: params.sessionId,
    planMode: plan.mode,
    soundAllowed: plan.soundAllowed,
    status: 'idle',
    phaseIndex: 0,
    phaseCount: plan.phases.length,
    elapsedInPhaseMs: 0,
    accumulatedElapsedMs: 0,
    startedAt: null,
    lastResumedAt: null,
    pausedAt: null,
    completedAt: null,
    updatedAt: params.now,
    interruptionReason: 'none',
  };
}

export function startLucidSsildSensoryLabSession(
  session: LucidSsildSensoryLabSession,
  now: number
): LucidSsildSensoryLabSession {
  assertKnownSession(session);
  if (session.status === 'running' && session.startedAt !== null) {
    return session;
  }
  if (session.status !== 'idle') {
    throw new Error('Only an idle SSILD sensory lab session can start');
  }
  return withSession(session, now, {
    status: 'running',
    startedAt: now,
    lastResumedAt: now,
    pausedAt: null,
    completedAt: null,
    interruptionReason: 'none',
  });
}

export function tickLucidSsildSensoryLabSession(
  session: LucidSsildSensoryLabSession,
  now: number
): LucidSsildSensoryLabTickResult {
  const plan = assertKnownSession(session);
  if (session.status === 'completed') {
    return {
      session,
      feedback: feedbackFrom(session, session, plan),
    };
  }
  if (session.status !== 'running') {
    throw new Error('Only a running SSILD sensory lab session can tick');
  }
  const next = applyElapsed(session, plan, now, currentElapsedMs(session, now), {
    status: 'running',
    interruptionReason: 'none',
    lastResumedAt: now,
    pausedAt: null,
    completedAt: null,
    allowComplete: true,
  });
  return {
    session: next,
    feedback: feedbackFrom(session, next, plan),
  };
}

export function pauseLucidSsildSensoryLabSession(
  session: LucidSsildSensoryLabSession,
  now: number
): LucidSsildSensoryLabSession {
  const plan = assertKnownSession(session);
  if (session.status === 'paused') return session;
  if (session.status !== 'running') {
    throw new Error('Only a running SSILD sensory lab session can pause');
  }
  return applyElapsed(session, plan, now, currentElapsedMs(session, now), {
    status: 'paused',
    interruptionReason: 'none',
    lastResumedAt: null,
    pausedAt: now,
    completedAt: null,
    allowComplete: false,
  });
}

export function interruptLucidSsildSensoryLabSession(
  session: LucidSsildSensoryLabSession,
  now: number,
  reason: LucidSsildSensoryActiveInterruptionReason = 'audio_route'
): LucidSsildSensoryLabSession {
  const plan = assertKnownSession(session);
  if (!isEnumValue(LUCID_SSILD_SENSORY_ACTIVE_INTERRUPTION_REASONS, reason)) {
    throw new Error('Invalid SSILD sensory lab interruption reason');
  }
  if (session.status === 'interrupted') return session;
  if (session.status === 'completed' || session.status === 'idle') {
    throw new Error('SSILD sensory lab session cannot be interrupted');
  }
  const elapsedMs =
    session.status === 'running' ? currentElapsedMs(session, now) : session.accumulatedElapsedMs;
  return applyElapsed(session, plan, now, elapsedMs, {
    status: 'interrupted',
    interruptionReason: reason,
    lastResumedAt: null,
    pausedAt: now,
    completedAt: null,
    allowComplete: false,
  });
}

export function exitLucidSsildSensoryLabSession(
  session: LucidSsildSensoryLabSession,
  now: number
): LucidSsildSensoryLabSession {
  return interruptLucidSsildSensoryLabSession(session, now, 'user_exit');
}

export function resumeLucidSsildSensoryLabSession(
  session: LucidSsildSensoryLabSession,
  now: number
): LucidSsildSensoryLabSession {
  assertKnownSession(session);
  if (session.status === 'running') return session;
  if (session.status !== 'paused' && session.status !== 'interrupted') {
    throw new Error('Only a paused or interrupted SSILD sensory lab session can resume');
  }
  return withSession(session, now, {
    status: 'running',
    lastResumedAt: now,
    pausedAt: null,
    completedAt: null,
    interruptionReason: 'none',
  });
}

export function completeLucidSsildSensoryLabSession(
  session: LucidSsildSensoryLabSession,
  now: number
): LucidSsildSensoryLabSession {
  const plan = assertKnownSession(session);
  if (session.status === 'completed') return session;
  if (session.status === 'interrupted' || session.status === 'idle') {
    throw new Error('SSILD sensory lab session cannot complete from this state');
  }
  const elapsedMs =
    session.status === 'running' ? currentElapsedMs(session, now) : session.accumulatedElapsedMs;
  if (elapsedMs < plan.totalDurationMs) {
    throw new Error('SSILD sensory lab must reach its full duration before completion');
  }
  return applyElapsed(session, plan, now, elapsedMs, {
    status: 'completed',
    interruptionReason: 'none',
    lastResumedAt: null,
    pausedAt: null,
    completedAt: now,
    allowComplete: true,
  });
}

export function getLucidSsildSensoryLabCurrentPhase(
  session: LucidSsildSensoryLabSession
): LucidSsildSensoryPhase {
  const plan = assertKnownSession(session);
  return clonePhase(plan.phases[session.phaseIndex]);
}

export function getLucidSsildSensoryLabElapsedMs(
  session: LucidSsildSensoryLabSession,
  now?: number
): number {
  const plan = assertKnownSession(session);
  const elapsedMs =
    now === undefined || session.status !== 'running'
      ? session.accumulatedElapsedMs
      : currentElapsedMs(session, now);
  return Math.min(Math.max(elapsedMs, 0), plan.totalDurationMs);
}

export function getLucidSsildSensoryLabProgression(
  session: LucidSsildSensoryLabSession,
  now?: number
): number {
  const plan = assertKnownSession(session);
  if (plan.totalDurationMs <= 0) return 0;
  const ratio = getLucidSsildSensoryLabElapsedMs(session, now) / plan.totalDurationMs;
  if (ratio <= 0) return 0;
  if (ratio >= 1) return 1;
  return ratio;
}

export function getLucidSsildSensoryLabRemainingMs(
  session: LucidSsildSensoryLabSession,
  now?: number
): number {
  const plan = assertKnownSession(session);
  return plan.totalDurationMs - getLucidSsildSensoryLabElapsedMs(session, now);
}

export function getLucidSsildSensoryLabFeedback(
  previous: LucidSsildSensoryLabSession,
  next: LucidSsildSensoryLabSession
): LucidSsildSensoryLabFeedback {
  const plan = assertKnownSession(next);
  assertKnownSession(previous);
  return feedbackFrom(previous, next, plan);
}

function elapsedMatchesPosition(
  plan: LucidSsildSensoryLabPlan,
  session: Pick<
    LucidSsildSensoryLabSession,
    'phaseIndex' | 'elapsedInPhaseMs' | 'accumulatedElapsedMs'
  >
): boolean {
  if (session.phaseIndex < 0 || session.phaseIndex >= plan.phases.length) return false;
  const phase = plan.phases[session.phaseIndex];
  if (
    !Number.isSafeInteger(session.elapsedInPhaseMs) ||
    session.elapsedInPhaseMs < 0 ||
    session.elapsedInPhaseMs > phase.durationMs
  ) {
    return false;
  }
  if (
    !Number.isSafeInteger(session.accumulatedElapsedMs) ||
    session.accumulatedElapsedMs < 0 ||
    session.accumulatedElapsedMs > plan.totalDurationMs
  ) {
    return false;
  }
  return (
    session.accumulatedElapsedMs ===
    phasePrefixMs(plan, session.phaseIndex) + session.elapsedInPhaseMs
  );
}

export function isLucidSsildSensoryLabSession(
  value: unknown
): value is LucidSsildSensoryLabSession {
  if (!isPlainObject(value) || !hasExactKeys(value, SESSION_KEYS)) return false;
  if (value.version !== LUCID_SSILD_SENSORY_LAB_VERSION) return false;
  if (!isSessionId(value.sessionId)) return false;
  if (!isEnumValue(LUCID_SSILD_SENSORY_LAB_PLAN_MODES, value.planMode)) return false;
  if (typeof value.soundAllowed !== 'boolean') return false;
  if (!isEnumValue(LUCID_SSILD_SENSORY_LAB_STATUSES, value.status)) return false;
  if (
    typeof value.phaseIndex !== 'number' ||
    !Number.isSafeInteger(value.phaseIndex) ||
    value.phaseIndex < 0
  ) {
    return false;
  }
  if (
    typeof value.phaseCount !== 'number' ||
    !Number.isSafeInteger(value.phaseCount) ||
    value.phaseCount <= 0
  ) {
    return false;
  }
  if (value.phaseIndex >= value.phaseCount) return false;
  if (!isNullableTimestamp(value.startedAt)) return false;
  if (!isNullableTimestamp(value.lastResumedAt)) return false;
  if (!isNullableTimestamp(value.pausedAt)) return false;
  if (!isNullableTimestamp(value.completedAt)) return false;
  if (!isFiniteTimestamp(value.updatedAt)) return false;
  if (!isEnumValue(LUCID_SSILD_SENSORY_INTERRUPTION_REASONS, value.interruptionReason)) {
    return false;
  }

  let plan: LucidSsildSensoryLabPlan;
  try {
    plan = deriveLucidSsildSensoryLabPlan({
      planMode: value.planMode,
      soundAllowed: value.soundAllowed,
    });
  } catch {
    return false;
  }
  if (plan.mode !== value.planMode) return false;
  if (plan.soundAllowed !== value.soundAllowed) return false;
  if (plan.phases.length !== value.phaseCount) return false;
  if (
    !elapsedMatchesPosition(plan, {
      phaseIndex: value.phaseIndex,
      elapsedInPhaseMs: value.elapsedInPhaseMs as number,
      accumulatedElapsedMs: value.accumulatedElapsedMs as number,
    })
  ) {
    return false;
  }

  const status = value.status as LucidSsildSensoryLabStatus;
  const startedAt = value.startedAt as number | null;
  const lastResumedAt = value.lastResumedAt as number | null;
  const pausedAt = value.pausedAt as number | null;
  const completedAt = value.completedAt as number | null;
  const updatedAt = value.updatedAt as number;
  const interruptionReason = value.interruptionReason as LucidSsildSensoryInterruptionReason;
  const accumulatedElapsedMs = value.accumulatedElapsedMs as number;

  if (status === 'idle') {
    return (
      startedAt === null &&
      lastResumedAt === null &&
      pausedAt === null &&
      completedAt === null &&
      value.phaseIndex === 0 &&
      value.elapsedInPhaseMs === 0 &&
      accumulatedElapsedMs === 0 &&
      interruptionReason === 'none'
    );
  }

  if (startedAt === null || startedAt > updatedAt) return false;

  if (status === 'running') {
    return (
      lastResumedAt !== null &&
      pausedAt === null &&
      completedAt === null &&
      interruptionReason === 'none' &&
      lastResumedAt >= startedAt &&
      lastResumedAt <= updatedAt
    );
  }

  if (status === 'paused') {
    return (
      lastResumedAt === null &&
      pausedAt !== null &&
      completedAt === null &&
      interruptionReason === 'none' &&
      pausedAt >= startedAt &&
      pausedAt <= updatedAt
    );
  }

  if (status === 'interrupted') {
    return (
      lastResumedAt === null &&
      pausedAt !== null &&
      completedAt === null &&
      interruptionReason !== 'none' &&
      pausedAt >= startedAt &&
      pausedAt <= updatedAt
    );
  }

  return (
    lastResumedAt === null &&
    pausedAt === null &&
    completedAt !== null &&
    interruptionReason === 'none' &&
    accumulatedElapsedMs === plan.totalDurationMs &&
    value.phaseIndex === plan.phases.length - 1 &&
    value.elapsedInPhaseMs === plan.phases[plan.phases.length - 1].durationMs &&
    completedAt >= startedAt &&
    completedAt <= updatedAt
  );
}

export function parseLucidSsildSensoryLabSession(
  value: unknown
): LucidSsildSensoryLabSession | null {
  if (!isLucidSsildSensoryLabSession(value)) return null;
  return cloneSession(value);
}
