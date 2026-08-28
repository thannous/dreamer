import type { DreamAnalysis } from '@/lib/types';
import type { LucidActiveDreamSign } from '@/lib/lucid/dreamSigns';
import type {
  LucidGuidedRitualMode,
  LucidGuidedRitualProgress,
  LucidGuidedRitualTechnique,
  LucidTechnique,
} from '@/lib/lucid/model';
import type { LucidSafetyPolicy } from '@/lib/lucid/safety';

export const LUCID_GUIDED_RITUAL_PHASE_IDS = [
  'mild_intention',
  'mild_recall',
  'mild_recognize',
  'mild_rehearse',
  'mild_release',
  'ssild_settle',
  'ssild_sight',
  'ssild_sound',
  'ssild_body',
  'ssild_slow_cycle',
  'ssild_release',
  'recovery_settle',
  'recovery_release',
] as const;

export type LucidGuidedRitualPhaseId =
  (typeof LUCID_GUIDED_RITUAL_PHASE_IDS)[number];

export type LucidGuidedRitualPhase = Readonly<{
  id: LucidGuidedRitualPhaseId;
  durationSeconds: number;
}>;

export type LucidGuidedRitualObjective =
  | 'remember_and_recognize'
  | 'notice_the_senses'
  | 'protect_sleep';

export type LucidGuidedRitualPlan = Readonly<{
  status: 'ready';
  technique: LucidGuidedRitualTechnique;
  mode: LucidGuidedRitualMode;
  objective: LucidGuidedRitualObjective;
  totalDurationSeconds: number;
  soundAllowed: boolean;
  phases: readonly LucidGuidedRitualPhase[];
}>;

export type LucidGuidedRitualPlanResult =
  | LucidGuidedRitualPlan
  | Readonly<{
      status: 'blocked';
      reason: 'wbtb_blocked' | 'unsupported_technique';
    }>;

const FULL_MILD_PHASES: readonly LucidGuidedRitualPhase[] = [
  { id: 'mild_intention', durationSeconds: 45 },
  { id: 'mild_recall', durationSeconds: 60 },
  { id: 'mild_recognize', durationSeconds: 75 },
  { id: 'mild_rehearse', durationSeconds: 75 },
  { id: 'mild_release', durationSeconds: 45 },
];

const REDUCED_MILD_PHASES: readonly LucidGuidedRitualPhase[] = [
  { id: 'mild_intention', durationSeconds: 45 },
  { id: 'mild_recognize', durationSeconds: 60 },
  { id: 'mild_release', durationSeconds: 75 },
];

const FULL_SSILD_PHASES: readonly LucidGuidedRitualPhase[] = [
  { id: 'ssild_settle', durationSeconds: 30 },
  { id: 'ssild_sight', durationSeconds: 60 },
  { id: 'ssild_sound', durationSeconds: 60 },
  { id: 'ssild_body', durationSeconds: 60 },
  { id: 'ssild_slow_cycle', durationSeconds: 60 },
  { id: 'ssild_release', durationSeconds: 30 },
];

const REDUCED_SSILD_PHASES: readonly LucidGuidedRitualPhase[] = [
  { id: 'ssild_sight', durationSeconds: 45 },
  { id: 'ssild_sound', durationSeconds: 45 },
  { id: 'ssild_body', durationSeconds: 45 },
  { id: 'ssild_release', durationSeconds: 45 },
];

const RECOVERY_PHASES: readonly LucidGuidedRitualPhase[] = [
  { id: 'recovery_settle', durationSeconds: 60 },
  { id: 'recovery_release', durationSeconds: 120 },
];

function totalDuration(phases: readonly LucidGuidedRitualPhase[]): number {
  return phases.reduce((total, phase) => total + phase.durationSeconds, 0);
}

export function createLucidGuidedRitualPlan(
  technique: LucidTechnique | string,
  policy: LucidSafetyPolicy
): LucidGuidedRitualPlanResult {
  if (technique === 'wbtb') {
    return { status: 'blocked', reason: 'wbtb_blocked' };
  }
  if (technique !== 'mild' && technique !== 'ssild') {
    return { status: 'blocked', reason: 'unsupported_technique' };
  }

  let mode: LucidGuidedRitualMode = 'full';
  let phases = technique === 'mild' ? FULL_MILD_PHASES : FULL_SSILD_PHASES;
  let objective: LucidGuidedRitualObjective =
    technique === 'mild' ? 'remember_and_recognize' : 'notice_the_senses';

  if (policy.mode === 'recovery') {
    mode = 'replacement';
    phases = RECOVERY_PHASES;
    objective = 'protect_sleep';
  } else if (policy.mode === 'reducedIntensity') {
    mode = 'reduced';
    phases = technique === 'mild' ? REDUCED_MILD_PHASES : REDUCED_SSILD_PHASES;
  }

  return {
    status: 'ready',
    technique,
    mode,
    objective,
    totalDurationSeconds: totalDuration(phases),
    soundAllowed: policy.allowNightSignals,
    phases,
  };
}

function assertTimestamp(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error('Invalid guided ritual timestamp');
  }
}

function assertSessionId(value: string): void {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > 128) {
    throw new Error('Invalid guided ritual session id');
  }
}

function nextTimestamp(current: LucidGuidedRitualProgress, now: number): number {
  assertTimestamp(now);
  const next = Math.max(now, current.updatedAt + 1);
  assertTimestamp(next);
  return next;
}

export function createLucidGuidedRitualProgress(params: {
  plan: LucidGuidedRitualPlan;
  sessionId: string;
  now: number;
}): LucidGuidedRitualProgress {
  assertSessionId(params.sessionId);
  assertTimestamp(params.now);
  if (params.plan.phases.length === 0) {
    throw new Error('Guided ritual plan has no phases');
  }
  return {
    version: 1,
    sessionId: params.sessionId.trim(),
    technique: params.plan.technique,
    status: 'in_progress',
    stepIndex: 0,
    stepCount: params.plan.phases.length,
    mode: params.plan.mode,
    startedAt: params.now,
    stepStartedAt: params.now,
    completedAt: null,
    updatedAt: params.now,
  };
}

export function advanceLucidGuidedRitualProgress(
  current: LucidGuidedRitualProgress,
  now: number
): LucidGuidedRitualProgress {
  if (current.status !== 'in_progress') {
    throw new Error('Only an active guided ritual can advance');
  }
  if (current.stepIndex >= current.stepCount - 1) {
    throw new Error('Guided ritual is ready to complete');
  }
  const updatedAt = nextTimestamp(current, now);
  return {
    ...current,
    stepIndex: current.stepIndex + 1,
    stepStartedAt: updatedAt,
    updatedAt,
  };
}

export function abandonLucidGuidedRitualProgress(
  current: LucidGuidedRitualProgress,
  now: number
): LucidGuidedRitualProgress {
  if (current.status === 'completed') {
    throw new Error('A completed guided ritual cannot be abandoned');
  }
  if (current.status === 'abandoned') return current;
  return {
    ...current,
    status: 'abandoned',
    updatedAt: nextTimestamp(current, now),
  };
}

export function resumeLucidGuidedRitualProgress(
  current: LucidGuidedRitualProgress,
  now: number
): LucidGuidedRitualProgress {
  if (current.status === 'completed') {
    throw new Error('A completed guided ritual cannot resume');
  }
  if (current.status === 'in_progress') return current;
  const updatedAt = nextTimestamp(current, now);
  return {
    ...current,
    status: 'in_progress',
    stepStartedAt: updatedAt,
    updatedAt,
  };
}

export function completeLucidGuidedRitualProgress(
  current: LucidGuidedRitualProgress,
  now: number
): LucidGuidedRitualProgress {
  if (current.status === 'completed') return current;
  if (current.status !== 'in_progress' || current.stepIndex !== current.stepCount - 1) {
    throw new Error('Guided ritual must reach its final phase before completion');
  }
  const updatedAt = nextTimestamp(current, now);
  return {
    ...current,
    status: 'completed',
    completedAt: updatedAt,
    updatedAt,
  };
}

const MAX_MILD_SOURCE_TITLE_LENGTH = 80;
const MAX_MILD_SOURCE_EXCERPT_LENGTH = 180;

function boundedVerbatim(value: string, maximum: number): string {
  const compact = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (compact.length <= maximum) return compact;
  return `${compact.slice(0, maximum - 1).trimEnd()}…`;
}

export type LucidMildRehearsalSource = Readonly<{
  dreamId: string;
  dreamTitle: string;
  dreamExcerpt: string;
  signId: string;
  signLabel: string;
}>;

export function selectLucidMildRehearsalSource(
  dreams: readonly Pick<DreamAnalysis, 'id' | 'title' | 'transcript'>[],
  confirmedSigns: readonly LucidActiveDreamSign[]
): LucidMildRehearsalSource | null {
  const signs = confirmedSigns
    .filter((sign) => sign.id.trim().length > 0 && sign.label.trim().length > 0)
    .sort((left, right) => left.id.localeCompare(right.id));
  const recentDreams = dreams
    .filter(
      (dream) =>
        Number.isSafeInteger(dream.id) &&
        dream.id >= 0 &&
        `${dream.title ?? ''}${dream.transcript ?? ''}`.trim().length > 0
    )
    .sort((left, right) => right.id - left.id);

  for (const dream of recentDreams) {
    const dreamId = String(dream.id);
    const sign = signs.find((candidate) => candidate.sourceDreamIds.includes(dreamId));
    if (!sign) continue;
    const dreamTitle = boundedVerbatim(dream.title, MAX_MILD_SOURCE_TITLE_LENGTH);
    const dreamExcerpt = boundedVerbatim(
      dream.transcript || dream.title,
      MAX_MILD_SOURCE_EXCERPT_LENGTH
    );
    if (!dreamExcerpt) continue;
    return {
      dreamId,
      dreamTitle,
      dreamExcerpt,
      signId: sign.id,
      signLabel: boundedVerbatim(sign.label, MAX_MILD_SOURCE_TITLE_LENGTH),
    };
  }
  return null;
}
