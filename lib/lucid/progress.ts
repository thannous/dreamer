import {
  LUCID_TECHNIQUES,
  type LucidExperiment,
  type LucidPersonalFactor,
  type LucidTechnique,
} from './model';

export { LUCID_TECHNIQUES } from './model';
export type { LucidTechnique } from './model';

export type LucidOutcome = 'lucid' | 'remembered' | 'no_recall';
export type LucidFactor =
  | 'alcohol'
  | 'caffeine_late'
  | 'exercise'
  | 'interrupted_sleep'
  | 'low_sleep'
  | 'meditation'
  | 'screen_late'
  | 'stress';

export type LucidProgressObservation = {
  id: string;
  occurredAt: number;
  technique: LucidTechnique;
  preparationMinutes: number;
  outcome: LucidOutcome;
  lucidity: number | null;
  recall: number | null;
  sleepQuality: number | null;
  factors: readonly LucidFactor[];
};

export type LucidProgressWindow = {
  startAt: number;
  endAt: number;
};

export type LucidFactorCount = {
  factor: LucidFactor;
  count: number;
};

export type LucidProgressSummary = {
  records: number;
  attempts: number;
  lucidDreams: number;
  recalledDreams: number;
  preparedAttempts: number;
  successRate: number | null;
  recallRate: number | null;
  preparationRate: number | null;
  averageLucidity: number | null;
  averageRecall: number | null;
  averageSleepQuality: number | null;
  factors: readonly LucidFactorCount[];
};

export type LucidMethodSummary = LucidProgressSummary & {
  technique: LucidTechnique;
};

export type LucidMethodComparison = {
  methods: readonly LucidMethodSummary[];
  leader: LucidTechnique | null;
  evidence: 'none' | 'early' | 'usable';
  minimumAttempts: number;
};

export type LucidTrendDirection =
  | 'improving'
  | 'steady'
  | 'declining'
  | 'insufficient_data';

export type LucidProgressTrend = {
  direction: LucidTrendDirection;
  successRateDelta: number | null;
  recallRateDelta: number | null;
};

export type LucidCoachingAction =
  | 'start_first_session'
  | 'protect_sleep'
  | 'complete_preparation'
  | 'strengthen_recall'
  | 'repeat_best_method'
  | 'keep_routine'
  | 'try_another_method';

export type LucidCoachingRecommendation = {
  action: LucidCoachingAction;
  technique: LucidTechnique | null;
  evidence: {
    attempts: number;
    successRate: number | null;
    recallRate: number | null;
    preparationRate: number | null;
  };
};

export type LucidWeeklyProgressReview = {
  currentWindow: LucidProgressWindow;
  previousWindow: LucidProgressWindow;
  current: LucidProgressSummary;
  previous: LucidProgressSummary;
  trend: LucidProgressTrend;
  comparison: LucidMethodComparison;
  coaching: LucidCoachingRecommendation;
};

const SCORE_MIN = 0;
const SCORE_MAX = 5;
const DEFAULT_MINIMUM_METHOD_ATTEMPTS = 3;
const TREND_THRESHOLD = 0.1;
const SLEEP_RISK_FACTORS = new Set<LucidFactor>(['interrupted_sleep', 'low_sleep']);
const PERSONAL_FACTOR_MAP: Readonly<Record<LucidPersonalFactor, LucidFactor>> = {
  stress: 'stress',
  alcohol: 'alcohol',
  caffeine_late: 'caffeine_late',
  exercise: 'exercise',
  screen_late: 'screen_late',
  sleep_debt: 'low_sleep',
  unusual_schedule: 'interrupted_sleep',
};
const LUCID_FACTORS: readonly LucidFactor[] = [
  'alcohol',
  'caffeine_late',
  'exercise',
  'interrupted_sleep',
  'low_sleep',
  'meditation',
  'screen_late',
  'stress',
];

function roundMetric(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function getRate(numerator: number, denominator: number): number | null {
  return denominator > 0 ? roundMetric(numerator / denominator) : null;
}

function getAverage(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return roundMetric(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function getValidScore(value: unknown): number | null {
  return typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= SCORE_MIN &&
    value <= SCORE_MAX
    ? value
    : null;
}

function isLucidTechnique(value: unknown): value is LucidTechnique {
  return LUCID_TECHNIQUES.includes(value as LucidTechnique);
}

function isLucidFactor(value: unknown): value is LucidFactor {
  return LUCID_FACTORS.includes(value as LucidFactor);
}

function assertProgressWindow(window: LucidProgressWindow, label: string): void {
  if (
    !Number.isFinite(window.startAt) ||
    !Number.isFinite(window.endAt) ||
    window.endAt <= window.startAt
  ) {
    throw new RangeError(`${label} must have finite, increasing absolute boundaries.`);
  }
}

export function adaptLucidExperimentForProgress(
  experiment: LucidExperiment
): LucidProgressObservation {
  const outcome: LucidOutcome =
    experiment.result === 'lucid'
      ? 'lucid'
      : experiment.result === 'pre_lucid' || experiment.recallLevel > 0
        ? 'remembered'
        : 'no_recall';

  return {
    id: experiment.id,
    occurredAt: experiment.occurredAt,
    technique: experiment.technique,
    preparationMinutes: experiment.preparationMinutes,
    outcome,
    lucidity: getValidScore(experiment.lucidityLevel),
    recall: getValidScore(experiment.recallLevel),
    sleepQuality: getValidScore(experiment.sleepQuality),
    factors: [...new Set(experiment.factors.map((factor) => PERSONAL_FACTOR_MAP[factor]))],
  };
}

export function adaptLucidExperimentsForProgress(
  experiments: readonly LucidExperiment[]
): LucidProgressObservation[] {
  return experiments.map(adaptLucidExperimentForProgress);
}

function isRecordInWindow(
  record: LucidProgressObservation,
  window?: LucidProgressWindow
): boolean {
  if (!Number.isFinite(record.occurredAt) || !isLucidTechnique(record.technique)) {
    return false;
  }
  return !window ||
    (record.occurredAt >= window.startAt && record.occurredAt < window.endAt);
}

function getRecordsInWindow(
  experiments: readonly LucidExperiment[],
  window?: LucidProgressWindow
): LucidProgressObservation[] {
  if (window) assertProgressWindow(window, 'Progress window');
  return adaptLucidExperimentsForProgress(experiments).filter((record) =>
    isRecordInWindow(record, window)
  );
}

export function summarizeLucidProgress(
  experiments: readonly LucidExperiment[],
  window?: LucidProgressWindow
): LucidProgressSummary {
  const relevantRecords = getRecordsInWindow(experiments, window);
  let attempts = 0;
  let lucidDreams = 0;
  let recalledDreams = 0;
  let preparedAttempts = 0;
  const lucidityScores: number[] = [];
  const recallScores: number[] = [];
  const sleepQualityScores: number[] = [];
  const factorCounts = new Map<LucidFactor, number>();

  for (const record of relevantRecords) {
    attempts += 1;
    if (record.outcome === 'lucid') lucidDreams += 1;
    if (record.outcome === 'lucid' || record.outcome === 'remembered') {
      recalledDreams += 1;
    }
    if (record.preparationMinutes > 0) preparedAttempts += 1;

    const lucidity = getValidScore(record.lucidity);
    const recall = getValidScore(record.recall);
    const sleepQuality = getValidScore(record.sleepQuality);
    if (lucidity !== null) lucidityScores.push(lucidity);
    if (recall !== null) recallScores.push(recall);
    if (sleepQuality !== null) sleepQualityScores.push(sleepQuality);

    for (const factor of new Set(record.factors ?? [])) {
      if (isLucidFactor(factor)) {
        factorCounts.set(factor, (factorCounts.get(factor) ?? 0) + 1);
      }
    }
  }

  const factors = [...factorCounts.entries()]
    .map(([factor, count]) => ({ factor, count }))
    .sort(
      (left, right) =>
        right.count - left.count || LUCID_FACTORS.indexOf(left.factor) - LUCID_FACTORS.indexOf(right.factor)
    );

  return {
    records: relevantRecords.length,
    attempts,
    lucidDreams,
    recalledDreams,
    preparedAttempts,
    successRate: getRate(lucidDreams, attempts),
    recallRate: getRate(recalledDreams, attempts),
    preparationRate: getRate(preparedAttempts, attempts),
    averageLucidity: getAverage(lucidityScores),
    averageRecall: getAverage(recallScores),
    averageSleepQuality: getAverage(sleepQualityScores),
    factors,
  };
}

function compareMethodSummaries(
  left: LucidMethodSummary,
  right: LucidMethodSummary
): number {
  return (
    (right.successRate ?? -1) - (left.successRate ?? -1) ||
    (right.recallRate ?? -1) - (left.recallRate ?? -1) ||
    (right.averageLucidity ?? -1) - (left.averageLucidity ?? -1) ||
    right.attempts - left.attempts ||
    LUCID_TECHNIQUES.indexOf(left.technique) - LUCID_TECHNIQUES.indexOf(right.technique)
  );
}

export function compareLucidMethods(
  experiments: readonly LucidExperiment[],
  window?: LucidProgressWindow,
  minimumAttempts = DEFAULT_MINIMUM_METHOD_ATTEMPTS
): LucidMethodComparison {
  if (!Number.isInteger(minimumAttempts) || minimumAttempts < 1) {
    throw new RangeError('minimumAttempts must be a positive integer.');
  }

  const relevantExperiments = window
    ? experiments.filter(
        (experiment) =>
          experiment.occurredAt >= window.startAt && experiment.occurredAt < window.endAt
      )
    : [...experiments];
  if (window) assertProgressWindow(window, 'Progress window');
  const methods = LUCID_TECHNIQUES.map((technique) => ({
    technique,
    ...summarizeLucidProgress(
      relevantExperiments.filter((experiment) => experiment.technique === technique)
    ),
  }));
  const eligible = methods
    .filter((method) => method.attempts >= minimumAttempts)
    .sort(compareMethodSummaries);
  const leader = eligible[0] ?? null;

  return {
    methods,
    leader: leader?.technique ?? null,
    evidence: leader === null ? 'none' : leader.attempts >= 5 ? 'usable' : 'early',
    minimumAttempts,
  };
}

export function getLucidProgressTrend(
  current: LucidProgressSummary,
  previous: LucidProgressSummary,
  minimumAttempts = 2
): LucidProgressTrend {
  if (!Number.isInteger(minimumAttempts) || minimumAttempts < 1) {
    throw new RangeError('minimumAttempts must be a positive integer.');
  }

  const hasEnoughData =
    current.attempts >= minimumAttempts &&
    previous.attempts >= minimumAttempts &&
    current.successRate !== null &&
    previous.successRate !== null;
  const successRateDelta =
    current.successRate === null || previous.successRate === null
      ? null
      : roundMetric(current.successRate - previous.successRate);
  const recallRateDelta =
    current.recallRate === null || previous.recallRate === null
      ? null
      : roundMetric(current.recallRate - previous.recallRate);

  if (!hasEnoughData || successRateDelta === null) {
    return { direction: 'insufficient_data', successRateDelta, recallRateDelta };
  }

  const direction =
    successRateDelta >= TREND_THRESHOLD
      ? 'improving'
      : successRateDelta <= -TREND_THRESHOLD
        ? 'declining'
        : 'steady';

  return { direction, successRateDelta, recallRateDelta };
}

function hasFrequentSleepRisk(
  records: readonly LucidProgressObservation[],
  attempts: number
): boolean {
  if (attempts === 0) return false;
  const affectedAttempts = records.filter(
    (record) => record.factors.some((factor) => SLEEP_RISK_FACTORS.has(factor))
  ).length;
  return affectedAttempts / attempts >= 0.5;
}

function getLeastTestedTechnique(comparison: LucidMethodComparison): LucidTechnique {
  return [...comparison.methods].sort(
    (left, right) =>
      left.attempts - right.attempts ||
      LUCID_TECHNIQUES.indexOf(left.technique) - LUCID_TECHNIQUES.indexOf(right.technique)
  )[0].technique;
}

export function getDeterministicLucidCoaching(
  experiments: readonly LucidExperiment[],
  current: LucidProgressSummary,
  trend: LucidProgressTrend,
  comparison: LucidMethodComparison
): LucidCoachingRecommendation {
  const evidence = {
    attempts: current.attempts,
    successRate: current.successRate,
    recallRate: current.recallRate,
    preparationRate: current.preparationRate,
  };

  if (current.attempts === 0) {
    return { action: 'start_first_session', technique: 'mild', evidence };
  }
  if (
    hasFrequentSleepRisk(
      adaptLucidExperimentsForProgress(experiments),
      current.attempts
    )
  ) {
    return { action: 'protect_sleep', technique: null, evidence };
  }
  if ((current.preparationRate ?? 0) < 0.6) {
    return { action: 'complete_preparation', technique: null, evidence };
  }
  if ((current.recallRate ?? 0) < 0.5) {
    return { action: 'strengthen_recall', technique: null, evidence };
  }
  if (comparison.leader) {
    return { action: 'repeat_best_method', technique: comparison.leader, evidence };
  }
  if (trend.direction === 'improving' || (current.successRate ?? 0) > 0) {
    return { action: 'keep_routine', technique: null, evidence };
  }
  return {
    action: 'try_another_method',
    technique: getLeastTestedTechnique(comparison),
    evidence,
  };
}

export function buildLucidWeeklyReview(
  experiments: readonly LucidExperiment[],
  currentWindow: LucidProgressWindow,
  previousWindow?: LucidProgressWindow
): LucidWeeklyProgressReview {
  assertProgressWindow(currentWindow, 'Current week');
  const resolvedPreviousWindow = previousWindow ?? {
    startAt: currentWindow.startAt - (currentWindow.endAt - currentWindow.startAt),
    endAt: currentWindow.startAt,
  };
  assertProgressWindow(resolvedPreviousWindow, 'Previous week');
  if (resolvedPreviousWindow.endAt > currentWindow.startAt) {
    throw new RangeError('Previous week must not overlap the current week.');
  }

  const currentExperiments = experiments.filter(
    (experiment) =>
      experiment.occurredAt >= currentWindow.startAt &&
      experiment.occurredAt < currentWindow.endAt
  );
  const current = summarizeLucidProgress(currentExperiments);
  const previous = summarizeLucidProgress(experiments, resolvedPreviousWindow);
  const trend = getLucidProgressTrend(current, previous);
  const comparison = compareLucidMethods(currentExperiments);
  const coaching = getDeterministicLucidCoaching(
    currentExperiments,
    current,
    trend,
    comparison
  );

  return {
    currentWindow,
    previousWindow: resolvedPreviousWindow,
    current,
    previous,
    trend,
    comparison,
    coaching,
  };
}
