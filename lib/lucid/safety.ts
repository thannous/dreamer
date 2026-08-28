import type { LucidProgramCalendarStatus } from '@/lib/lucid/calendar';
import type { LucidProgramProgress, LucidWakeSensitivity } from '@/lib/lucid/model';
import {
  deriveLucidSafetyObservationFacts,
  type LucidPlanObservation,
} from '@/lib/lucid/personalization';

export type LucidSessionAccessReason =
  | 'invalid'
  | 'completed'
  | 'current'
  | 'previous'
  | 'sequential_lock'
  | 'paused';

export type LucidSessionAccess = {
  allowed: boolean;
  reason: LucidSessionAccessReason;
};

export type LucidSessionAccessInput = {
  sessionNumber: number;
  sessionCount: number;
  exerciseId?: string;
  progress?: Pick<LucidProgramProgress, 'currentDay' | 'completedExerciseIds' | 'status'> | null;
  /**
   * Recommended cadence only. Calendar statuses such as `upcoming` never lock
   * or unlock a session; sequential progress is the only access gate.
   */
  calendarStatus?: LucidProgramCalendarStatus;
};

export function getLucidSequentialSessionCursor(
  progress?: Pick<LucidProgramProgress, 'currentDay'> | null
): number {
  const day = progress?.currentDay ?? 1;
  return Number.isInteger(day) && day >= 1 ? day : 1;
}

export function isLucidSessionCompleted(
  progress: Pick<LucidProgramProgress, 'completedExerciseIds'> | null | undefined,
  exerciseId: string
): boolean {
  return Boolean(exerciseId) && Boolean(progress?.completedExerciseIds.includes(exerciseId));
}

/**
 * Sequential lock: a later session cannot run until the program cursor reaches it.
 * Completed sessions stay reopenable. A paused program cannot enter or complete
 * the current session until Resume; history already completed remains readable.
 * The practice calendar is not consulted.
 */
export function evaluateLucidSessionAccess(input: LucidSessionAccessInput): LucidSessionAccess {
  const { sessionNumber, sessionCount, exerciseId, progress } = input;
  if (
    !Number.isInteger(sessionNumber) ||
    !Number.isInteger(sessionCount) ||
    sessionNumber < 1 ||
    sessionCount < 1 ||
    sessionNumber > sessionCount
  ) {
    return { allowed: false, reason: 'invalid' };
  }

  if (exerciseId && isLucidSessionCompleted(progress, exerciseId)) {
    return { allowed: true, reason: 'completed' };
  }

  if (progress?.status === 'paused') {
    return { allowed: false, reason: 'paused' };
  }

  const cursor = getLucidSequentialSessionCursor(progress);
  if (sessionNumber < cursor) {
    return { allowed: true, reason: 'previous' };
  }
  if (sessionNumber === cursor) {
    return { allowed: true, reason: 'current' };
  }
  return { allowed: false, reason: 'sequential_lock' };
}

export function canAccessLucidSession(input: LucidSessionAccessInput): boolean {
  return evaluateLucidSessionAccess(input).allowed;
}

export const LUCID_SAFETY_MODES = [
  'normal',
  'reducedIntensity',
  'recovery',
  'nightFeaturesBlocked',
] as const;
export type LucidSafetyMode = (typeof LUCID_SAFETY_MODES)[number];

/** Most restrictive applicable mode wins. */
export const LUCID_SAFETY_MODE_PRECEDENCE: readonly LucidSafetyMode[] = [
  'nightFeaturesBlocked',
  'recovery',
  'reducedIntensity',
  'normal',
];

export const LUCID_SAFETY_REASON_CODES = [
  'audio_not_consented',
  'hearing_concern',
  'recovery_requested',
  'fragile_sleep',
  'recent_sleep_degraded',
  'repeated_signal_wakeups',
] as const;
export type LucidSafetyReasonCode = (typeof LUCID_SAFETY_REASON_CODES)[number];

export const LUCID_NIGHT_SIGNAL_INTENSITIES = ['normal', 'reduced', 'blocked'] as const;
export type LucidNightSignalIntensity = (typeof LUCID_NIGHT_SIGNAL_INTENSITIES)[number];

/**
 * Current/persisted facts supplied by callers. This policy never infers
 * pharmacological or supplement recommendations.
 */
export type LucidSafetyFacts = {
  recoveryRequested: boolean;
  recentSleepDegraded: boolean;
  sleepIsFragile: boolean;
  hearingConcern: boolean;
  audioConsented: boolean;
  /** Optional on public input; `readLucidSafetyFacts` normalizes a missing value to false. */
  repeatedSignalWakeups?: boolean;
};

/** Fail-closed: audio stays unconsented until a caller supplies an explicit yes. */
export const DEFAULT_LUCID_SAFETY_FACTS: LucidSafetyFacts = {
  recoveryRequested: false,
  recentSleepDegraded: false,
  sleepIsFragile: false,
  hearingConcern: false,
  audioConsented: false,
  repeatedSignalWakeups: false,
};

/**
 * Persisted slice the adapter may read. Callers pass current facts to force
 * recovery, sleep degradation, fragility, hearing, audio consent, or repeated
 * signal wakeups. Experiments already on state can derive sleep and cue facts.
 * No extra schema or dead preference is required.
 */
export type LucidSafetyPersistedState = {
  onboarding?: {
    audioSafetyAccepted?: boolean;
    wakeSensitivity?: LucidWakeSensitivity | null;
  } | null;
  experiments?: readonly LucidPlanObservation[] | null;
};

/** Explicit values override persisted/default facts, including `false`. */
export type LucidSafetyCurrentFacts = Partial<LucidSafetyFacts>;

export type LucidSafetyPolicy = {
  mode: LucidSafetyMode;
  allowWbtb: boolean;
  allowNightSignals: boolean;
  nightSignalIntensity: LucidNightSignalIntensity;
  emergencyStopAllowed: true;
  reasons: readonly LucidSafetyReasonCode[];
};

const REASON_WHEN: Readonly<Record<LucidSafetyReasonCode, (facts: LucidSafetyFacts) => boolean>> = {
  audio_not_consented: (facts) => facts.audioConsented !== true,
  hearing_concern: (facts) => facts.hearingConcern === true,
  recovery_requested: (facts) => facts.recoveryRequested === true,
  fragile_sleep: (facts) => facts.sleepIsFragile === true,
  recent_sleep_degraded: (facts) => facts.recentSleepDegraded === true,
  repeated_signal_wakeups: (facts) => facts.repeatedSignalWakeups === true,
};

function readLucidSafetyFacts(facts: LucidSafetyFacts): LucidSafetyFacts {
  return {
    recoveryRequested: facts.recoveryRequested === true,
    recentSleepDegraded: facts.recentSleepDegraded === true,
    sleepIsFragile: facts.sleepIsFragile === true,
    hearingConcern: facts.hearingConcern === true,
    audioConsented: facts.audioConsented === true,
    repeatedSignalWakeups: facts.repeatedSignalWakeups === true,
  };
}

function collectLucidSafetyReasons(facts: LucidSafetyFacts): LucidSafetyReasonCode[] {
  return LUCID_SAFETY_REASON_CODES.filter((code) => REASON_WHEN[code](facts));
}

function resolveLucidSafetyMode(facts: LucidSafetyFacts): LucidSafetyMode {
  if (!facts.audioConsented || facts.hearingConcern) return 'nightFeaturesBlocked';
  if (facts.recoveryRequested || facts.recentSleepDegraded) return 'recovery';
  if (facts.sleepIsFragile || facts.repeatedSignalWakeups) return 'reducedIntensity';
  return 'normal';
}

function isLucidSafetyPolicy(
  value: LucidSafetyFacts | LucidSafetyPolicy
): value is LucidSafetyPolicy {
  return 'mode' in value && 'emergencyStopAllowed' in value;
}

/**
 * Central night-practice safety decision. Sequential session access stays on
 * `evaluateLucidSessionAccess` and is not gated here.
 */
export function evaluateLucidSafetyPolicy(facts: LucidSafetyFacts): LucidSafetyPolicy {
  const resolved = readLucidSafetyFacts(facts);
  const mode = resolveLucidSafetyMode(resolved);
  const reasons = collectLucidSafetyReasons(resolved);
  const allowWbtb = mode === 'normal';
  const allowNightSignals =
    resolved.audioConsented &&
    !resolved.hearingConcern &&
    !resolved.sleepIsFragile &&
    !resolved.recoveryRequested &&
    !resolved.recentSleepDegraded &&
    !resolved.repeatedSignalWakeups;

  let nightSignalIntensity: LucidNightSignalIntensity = 'normal';
  if (!allowNightSignals) {
    nightSignalIntensity = 'blocked';
  } else if (mode === 'reducedIntensity' || resolved.repeatedSignalWakeups) {
    nightSignalIntensity = 'reduced';
  }

  return {
    mode,
    allowWbtb,
    allowNightSignals,
    nightSignalIntensity,
    emergencyStopAllowed: true,
    reasons,
  };
}

export function canUseLucidWbtb(input: LucidSafetyFacts | LucidSafetyPolicy): boolean {
  return isLucidSafetyPolicy(input) ? input.allowWbtb : evaluateLucidSafetyPolicy(input).allowWbtb;
}

export function canUseLucidNightSignals(input: LucidSafetyFacts | LucidSafetyPolicy): boolean {
  return isLucidSafetyPolicy(input)
    ? input.allowNightSignals
    : evaluateLucidSafetyPolicy(input).allowNightSignals;
}

export function getLucidNightSignalIntensity(
  input: LucidSafetyFacts | LucidSafetyPolicy
): LucidNightSignalIntensity {
  return isLucidSafetyPolicy(input)
    ? input.nightSignalIntensity
    : evaluateLucidSafetyPolicy(input).nightSignalIntensity;
}

export function isLucidNightSignalIntensityReduced(
  input: LucidSafetyFacts | LucidSafetyPolicy
): boolean {
  return getLucidNightSignalIntensity(input) === 'reduced';
}

export function isLucidEmergencyNightStopAllowed(
  _input?: LucidSafetyFacts | LucidSafetyPolicy
): true {
  return true;
}

function policyFrom(input: LucidSafetyFacts | LucidSafetyPolicy): LucidSafetyPolicy {
  return isLucidSafetyPolicy(input) ? input : evaluateLucidSafetyPolicy(input);
}

/**
 * Maps available persisted state plus optional current facts onto
 * `LucidSafetyFacts`. `audioSafetyAccepted` is read from onboarding. A stored
 * `wakeSensitivity` of `sensitive` maps to fragile sleep; absent or
 * `not_sensitive` does not invent fragility. Recent sleep degradation and
 * repeated cue-wakeups can be derived from experiments already on state.
 * Explicit current values, including `false`, always win.
 */
export function resolveLucidSafetyFacts(
  state?: LucidSafetyPersistedState | null,
  current?: LucidSafetyCurrentFacts | null
): LucidSafetyFacts {
  const derived = deriveLucidSafetyObservationFacts(state?.experiments ?? []);
  return readLucidSafetyFacts({
    recoveryRequested: current?.recoveryRequested ?? DEFAULT_LUCID_SAFETY_FACTS.recoveryRequested,
    recentSleepDegraded: current?.recentSleepDegraded ?? derived.recentSleepDegraded,
    sleepIsFragile:
      current?.sleepIsFragile ??
      (state?.onboarding?.wakeSensitivity === 'sensitive'),
    hearingConcern: current?.hearingConcern ?? DEFAULT_LUCID_SAFETY_FACTS.hearingConcern,
    audioConsented:
      current?.audioConsented ?? state?.onboarding?.audioSafetyAccepted === true,
    repeatedSignalWakeups: current?.repeatedSignalWakeups ?? derived.repeatedSignalWakeups,
  });
}

export function evaluateLucidSafetyPolicyFromState(
  state?: LucidSafetyPersistedState | null,
  current?: LucidSafetyCurrentFacts | null
): LucidSafetyPolicy {
  return evaluateLucidSafetyPolicy(resolveLucidSafetyFacts(state, current));
}

/** First canonical reason when WBTB is denied; `null` when it is allowed. */
export function getLucidWbtbDenialReason(
  input: LucidSafetyFacts | LucidSafetyPolicy
): LucidSafetyReasonCode | null {
  const policy = policyFrom(input);
  if (policy.allowWbtb) return null;
  return policy.reasons[0] ?? null;
}
