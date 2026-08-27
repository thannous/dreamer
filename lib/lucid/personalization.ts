import type {
  LucidDreamCaptureMode,
  LucidExperienceLevel,
  LucidExperimentResult,
  LucidGoal,
  LucidNightCueOutcome,
  LucidPersonalFactor,
  LucidSleepSchedule,
} from './model';

export type LucidGuidanceFocus = 'notice' | 'recall' | 'frequency' | 'stability';
export type LucidGuidanceTone = 'guided' | 'balanced' | 'concise';
export type LucidRecommendedTechnique = 'mild' | 'ssild';
export type LucidDayPhase = 'morning' | 'day' | 'bedtime' | 'sleep';

export type LucidGuidanceProfile = {
  focus: LucidGuidanceFocus;
  guidance: LucidGuidanceTone;
  recommendedTechnique: LucidRecommendedTechnique;
  cautionWbtb: boolean;
};

export type LucidGuidanceProfileInput = {
  goal: LucidGoal | null;
  experience: LucidExperienceLevel | null;
};

export const LUCID_RECENT_OBSERVATION_LIMIT = 7 as const;

export type LucidRecallEvidence = 'sufficient' | 'weak' | 'unknown';
export type LucidPlanIntensity = 'normal' | 'reduced' | 'recovery';
export type LucidPlanPrimaryAction =
  | 'notice_more'
  | 'strengthen_recall'
  | 'practice_mild'
  | 'practice_ssild'
  | 'protect_sleep'
  | 'reduce_night_signals';
export type LucidPlanReasonCode =
  | 'prudent_defaults'
  | 'weak_recall'
  | 'beginner_weak_recall'
  | 'first_lucid_mild'
  | 'frequent_lucidity_ssild'
  | 'recall_goal'
  | 'sleep_recovery'
  | 'repeated_signal_wakeups'
  | 'policy_recovery'
  | 'policy_reduced';

export type LucidPlanObservation = {
  id: string;
  occurredAt: number;
  updatedAt?: number;
  captureMode?: LucidDreamCaptureMode;
  recallText?: string;
  recallLevel?: number | null;
  result?: LucidExperimentResult | null;
  sleepQuality?: number | null;
  factors?: readonly LucidPersonalFactor[];
  cueOutcome?: LucidNightCueOutcome | null;
};

export type LucidPlanPolicy = {
  mode: 'normal' | 'reducedIntensity' | 'recovery' | 'nightFeaturesBlocked';
  allowWbtb: boolean;
  allowNightSignals: boolean;
  reasons?: readonly string[];
};

export type LucidPersonalizedPlanInput = {
  goal: LucidGoal | null;
  experience: LucidExperienceLevel | null;
  observations?: readonly LucidPlanObservation[] | null;
  policy?: LucidPlanPolicy | null;
};

export type LucidPersonalizedPlan = {
  reasonCode: LucidPlanReasonCode;
  primaryAction: LucidPlanPrimaryAction;
  intensity: LucidPlanIntensity;
  recommendedTechnique: LucidRecommendedTechnique | null;
  focus: LucidGuidanceFocus;
  guidance: LucidGuidanceTone;
  cautionWbtb: boolean;
  allowWbtb: boolean;
  allowNightSignals: boolean;
};

export type LucidDerivedSafetyObservationFacts = {
  recentSleepDegraded: boolean;
  repeatedSignalWakeups: boolean;
};

const MINUTES_PER_DAY = 24 * 60;
const MORNING_WINDOW_MINUTES = 120;
const BEDTIME_WINDOW_MINUTES = 90;

const GOAL_FOCUS: Record<LucidGoal, LucidGuidanceFocus> = {
  first_lucid_dream: 'notice',
  improve_recall: 'recall',
  more_frequent_lucidity: 'frequency',
  stabilize_lucidity: 'stability',
};

const EXPERIENCE_GUIDANCE: Record<LucidExperienceLevel, LucidGuidanceTone> = {
  beginner: 'guided',
  occasional: 'balanced',
  experienced: 'concise',
};

function wrapMinutes(value: number): number {
  return ((value % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}

function minuteOfClock(time: string): number {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
}

function isInHalfOpenWindow(now: number, start: number, end: number): boolean {
  if (start === end) return false;
  if (start < end) return now >= start && now < end;
  return now >= start || now < end;
}

function minuteOfInstant(now: number | Date, timeZone: string): number {
  const date = now instanceof Date ? now : new Date(now);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? 0);
  return hour * 60 + minute;
}

export function getLucidGuidanceProfile(
  input: LucidGuidanceProfileInput
): LucidGuidanceProfile {
  const focus = input.goal ? GOAL_FOCUS[input.goal] : 'notice';
  const guidance = input.experience
    ? EXPERIENCE_GUIDANCE[input.experience]
    : 'guided';
  const beginnerOrUnknown =
    input.experience === 'beginner' || input.experience == null;
  const recommendedTechnique: LucidRecommendedTechnique =
    !beginnerOrUnknown && input.goal === 'more_frequent_lucidity'
      ? 'ssild'
      : 'mild';

  return {
    focus,
    guidance,
    recommendedTechnique,
    cautionWbtb: beginnerOrUnknown,
  };
}

function compareLucidPlanObservations(
  left: LucidPlanObservation,
  right: LucidPlanObservation
): number {
  return (
    right.occurredAt - left.occurredAt ||
    (right.updatedAt ?? 0) - (left.updatedAt ?? 0) ||
    left.id.localeCompare(right.id)
  );
}

export function selectRecentLucidPlanObservations(
  observations: readonly LucidPlanObservation[],
  limit = LUCID_RECENT_OBSERVATION_LIMIT
): LucidPlanObservation[] {
  return [...observations].sort(compareLucidPlanObservations).slice(0, limit);
}

function isNothingForNow(observation: LucidPlanObservation): boolean {
  return observation.captureMode === 'nothing_for_now';
}

function isRememberedObservation(observation: LucidPlanObservation): boolean {
  if (isNothingForNow(observation)) return false;
  if (typeof observation.recallText === 'string' && observation.recallText.trim().length > 0) {
    return true;
  }
  if (typeof observation.recallLevel === 'number' && observation.recallLevel > 0) {
    return true;
  }
  return observation.result === 'pre_lucid' || observation.result === 'lucid';
}

function isExplicitNoRecallObservation(observation: LucidPlanObservation): boolean {
  if (isNothingForNow(observation) || isRememberedObservation(observation)) return false;
  return observation.result === 'none' && observation.recallLevel === 0;
}

export function classifyLucidRecallEvidence(
  observations: readonly LucidPlanObservation[]
): LucidRecallEvidence {
  const recent = selectRecentLucidPlanObservations(observations);
  let remembered = 0;
  let explicitNoRecall = 0;
  for (const observation of recent) {
    if (isRememberedObservation(observation)) remembered += 1;
    else if (isExplicitNoRecallObservation(observation)) explicitNoRecall += 1;
  }
  if (remembered >= 2) return 'sufficient';
  if (explicitNoRecall >= 2) return 'weak';
  return 'unknown';
}

export function isLucidRecentSleepDegraded(
  observations: readonly LucidPlanObservation[]
): boolean {
  const recent = selectRecentLucidPlanObservations(observations);
  const relevant = recent.find((observation) => {
    const hasQuality =
      typeof observation.sleepQuality === 'number' && Number.isFinite(observation.sleepQuality);
    return hasQuality || (observation.factors ?? []).includes('sleep_debt');
  });
  if (!relevant) return false;
  if (typeof relevant.sleepQuality === 'number' && relevant.sleepQuality <= 2) return true;
  return (relevant.factors ?? []).includes('sleep_debt');
}

export function countLucidHeardWokeCues(observations: readonly LucidPlanObservation[]): number {
  return selectRecentLucidPlanObservations(observations).filter(
    (observation) => observation.cueOutcome === 'heard_woke'
  ).length;
}

export function deriveLucidSafetyObservationFacts(
  observations: readonly LucidPlanObservation[]
): LucidDerivedSafetyObservationFacts {
  return {
    recentSleepDegraded: isLucidRecentSleepDegraded(observations),
    repeatedSignalWakeups: countLucidHeardWokeCues(observations) >= 2,
  };
}

function techniquePlanFromProfile(
  input: LucidPersonalizedPlanInput,
  recall: LucidRecallEvidence
): Pick<
  LucidPersonalizedPlan,
  'reasonCode' | 'primaryAction' | 'recommendedTechnique' | 'focus' | 'guidance' | 'cautionWbtb'
> {
  const profile = getLucidGuidanceProfile({
    goal: input.goal,
    experience: input.experience,
  });
  const beginnerOrUnknown = input.experience === 'beginner' || input.experience == null;

  if (recall === 'weak') {
    return {
      reasonCode: beginnerOrUnknown ? 'beginner_weak_recall' : 'weak_recall',
      primaryAction: 'strengthen_recall',
      recommendedTechnique: null,
      focus: 'recall',
      guidance: beginnerOrUnknown ? 'guided' : profile.guidance,
      cautionWbtb: true,
    };
  }

  if (recall === 'sufficient' && input.goal === 'first_lucid_dream') {
    return {
      reasonCode: 'first_lucid_mild',
      primaryAction: 'practice_mild',
      recommendedTechnique: 'mild',
      focus: 'notice',
      guidance: 'guided',
      cautionWbtb: beginnerOrUnknown,
    };
  }

  if (input.goal === 'improve_recall') {
    return {
      reasonCode: 'recall_goal',
      primaryAction: 'strengthen_recall',
      recommendedTechnique: 'mild',
      focus: 'recall',
      guidance: profile.guidance,
      cautionWbtb: profile.cautionWbtb,
    };
  }

  return {
    reasonCode:
      profile.recommendedTechnique === 'ssild' ? 'frequent_lucidity_ssild' : 'prudent_defaults',
    primaryAction: profile.recommendedTechnique === 'ssild' ? 'practice_ssild' : 'practice_mild',
    recommendedTechnique: profile.recommendedTechnique,
    focus: profile.focus,
    guidance: profile.guidance,
    cautionWbtb: profile.cautionWbtb,
  };
}

function combinePlanAvailability(
  planAllows: boolean,
  policy: LucidPlanPolicy | null | undefined,
  allowedByPolicy: boolean | undefined
): boolean {
  return Boolean(policy) && allowedByPolicy === true && planAllows;
}

export function getLucidPersonalizedPlan(
  input: LucidPersonalizedPlanInput
): LucidPersonalizedPlan {
  const observations = input.observations ?? [];
  const recall = classifyLucidRecallEvidence(observations);
  const sleepDegraded = isLucidRecentSleepDegraded(observations);
  const repeatedWakeups = countLucidHeardWokeCues(observations) >= 2;
  const technique = techniquePlanFromProfile(input, recall);
  const policy = input.policy;

  const policyReasons = policy?.reasons ?? [];
  const policyHas = (code: string) => policyReasons.includes(code);
  const observationRecovery = sleepDegraded;
  const observationReduced = repeatedWakeups && !sleepDegraded;
  const policyRecovery =
    policy?.mode === 'recovery' ||
    policyHas('recent_sleep_degraded') ||
    policyHas('recovery_requested');
  const policyReduced =
    !policyRecovery &&
    (policy?.mode === 'reducedIntensity' ||
      (policy?.mode === 'nightFeaturesBlocked' &&
        (policyHas('repeated_signal_wakeups') || policyHas('fragile_sleep'))));

  let draft: Omit<LucidPersonalizedPlan, 'allowWbtb' | 'allowNightSignals'> & {
    planAllowWbtb: boolean;
    planAllowNightSignals: boolean;
  };

  if (observationRecovery) {
    draft = {
      reasonCode: 'sleep_recovery',
      primaryAction: 'protect_sleep',
      intensity: 'recovery',
      recommendedTechnique: null,
      focus: technique.focus,
      guidance: technique.guidance,
      cautionWbtb: true,
      planAllowWbtb: false,
      planAllowNightSignals: false,
    };
  } else if (observationReduced) {
    draft = {
      reasonCode: 'repeated_signal_wakeups',
      primaryAction: 'reduce_night_signals',
      intensity: 'reduced',
      recommendedTechnique: technique.recommendedTechnique,
      focus: technique.focus,
      guidance: technique.guidance,
      cautionWbtb: true,
      planAllowWbtb: false,
      planAllowNightSignals: true,
    };
  } else if (policyRecovery) {
    draft = {
      reasonCode: 'policy_recovery',
      primaryAction: 'protect_sleep',
      intensity: 'recovery',
      recommendedTechnique: null,
      focus: technique.focus,
      guidance: technique.guidance,
      cautionWbtb: true,
      planAllowWbtb: false,
      planAllowNightSignals: false,
    };
  } else if (policyReduced) {
    draft = {
      reasonCode: 'policy_reduced',
      primaryAction: 'reduce_night_signals',
      intensity: 'reduced',
      recommendedTechnique: technique.recommendedTechnique,
      focus: technique.focus,
      guidance: technique.guidance,
      cautionWbtb: true,
      planAllowWbtb: false,
      planAllowNightSignals: true,
    };
  } else {
    draft = {
      ...technique,
      intensity: 'normal',
      planAllowWbtb: !technique.cautionWbtb,
      planAllowNightSignals: true,
    };
  }

  const { planAllowWbtb, planAllowNightSignals, ...rest } = draft;
  return {
    ...rest,
    allowWbtb: combinePlanAvailability(planAllowWbtb, policy, policy?.allowWbtb),
    allowNightSignals: combinePlanAvailability(
      planAllowNightSignals,
      policy,
      policy?.allowNightSignals
    ),
  };
}

export function getLucidDayPhase(
  now: number | Date,
  sleepSchedule: LucidSleepSchedule
): LucidDayPhase {
  const current = minuteOfInstant(now, sleepSchedule.timeZone || 'UTC');
  const wake = minuteOfClock(sleepSchedule.wakeTime);
  const bed = minuteOfClock(sleepSchedule.bedtime);
  const morningEnd = wrapMinutes(wake + MORNING_WINDOW_MINUTES);
  const bedtimeStart = wrapMinutes(bed - BEDTIME_WINDOW_MINUTES);

  // Sleep is the protected window. Morning and bedtime only apply while awake,
  // and morning wins if a short waking day makes those two overlap.
  if (isInHalfOpenWindow(current, bed, wake)) return 'sleep';
  if (isInHalfOpenWindow(current, wake, morningEnd)) return 'morning';
  if (isInHalfOpenWindow(current, bedtimeStart, bed)) return 'bedtime';
  return 'day';
}
