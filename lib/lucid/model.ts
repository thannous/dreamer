import { isLucidDreamAtlasOverlay, type LucidDreamAtlasOverlay } from '@/lib/lucid/dreamAtlas';
import type { LucidDreamSignDecision, LucidDreamSignDecisionRecord } from '@/lib/lucid/dreamSignModel';

export { LUCID_DREAM_SIGN_DECISIONS } from '@/lib/lucid/dreamSignModel';
export type { LucidDreamSignDecision, LucidDreamSignDecisionRecord } from '@/lib/lucid/dreamSignModel';

export const LUCID_TRAINER_SCHEMA_VERSION = 1 as const;
export const LUCID_TRAINER_MUTATION_VERSION = 1 as const;

export const LUCID_TECHNIQUES = ['mild', 'ssild', 'wbtb'] as const;
export type LucidTechnique = (typeof LUCID_TECHNIQUES)[number];

export const LUCID_GUIDED_RITUAL_TECHNIQUES = ['mild', 'ssild'] as const;
export type LucidGuidedRitualTechnique =
  (typeof LUCID_GUIDED_RITUAL_TECHNIQUES)[number];
export const LUCID_GUIDED_RITUAL_STATUSES = [
  'in_progress',
  'abandoned',
  'completed',
] as const;
export type LucidGuidedRitualStatus =
  (typeof LUCID_GUIDED_RITUAL_STATUSES)[number];
export const LUCID_GUIDED_RITUAL_MODES = ['full', 'reduced', 'replacement'] as const;
export type LucidGuidedRitualMode = (typeof LUCID_GUIDED_RITUAL_MODES)[number];
export const MAX_LUCID_GUIDED_RITUAL_STEPS = 12;

export const LUCID_LOCALES = ['fr', 'en', 'es', 'de', 'it'] as const;
export type LucidLocale = (typeof LUCID_LOCALES)[number];

export type LucidGoal =
  | 'first_lucid_dream'
  | 'more_frequent_lucidity'
  | 'stabilize_lucidity'
  | 'improve_recall';

export type LucidExperienceLevel = 'beginner' | 'occasional' | 'experienced';
export const LUCID_WAKE_SENSITIVITIES = ['sensitive', 'not_sensitive'] as const;
export type LucidWakeSensitivity = (typeof LUCID_WAKE_SENSITIVITIES)[number];
export type LucidOnboardingDraftStep = 0 | 1 | 2 | 3;
export type LucidPermissionState = 'unknown' | 'granted' | 'denied';
export type LucidProgramStatus = 'not_started' | 'active' | 'paused' | 'completed';
export type LucidExperimentResult = 'none' | 'pre_lucid' | 'lucid';

export const LUCID_DREAM_CAPTURE_MODES = ['speak', 'write', 'nothing_for_now'] as const;
export type LucidDreamCaptureMode = (typeof LUCID_DREAM_CAPTURE_MODES)[number];

export const LUCID_NIGHT_CUE_OUTCOMES = [
  'not_heard',
  'heard_in_dream',
  'heard_woke',
  'indeterminate',
] as const;
export type LucidNightCueOutcome = (typeof LUCID_NIGHT_CUE_OUTCOMES)[number];

export const LUCID_VOICE_CAPTURE_STATES = [
  'stub',
  'permission_denied',
  'unavailable',
  'local_note',
] as const;
export type LucidVoiceCaptureState = (typeof LUCID_VOICE_CAPTURE_STATES)[number];

export const LUCID_TECHNIQUE_AUTO_LINK_SOURCES = ['program_practice'] as const;
export type LucidTechniqueAutoLinkSource =
  (typeof LUCID_TECHNIQUE_AUTO_LINK_SOURCES)[number];

export interface LucidTechniqueAutoLink {
  technique: LucidTechnique;
  source: LucidTechniqueAutoLinkSource;
  practiceDate: string;
}

export const LUCID_REALITY_CHECK_CONTEXTS = [
  'scheduled',
  'transition',
  'emotion',
  'dream_sign',
  'spontaneous',
] as const;
export type LucidRealityCheckContext = (typeof LUCID_REALITY_CHECK_CONTEXTS)[number];

export const LUCID_MINDFUL_PAUSE_ANCHORS = [
  'transition',
  'emotion',
  'unusual_event',
  'dream_sign',
] as const;
export type LucidMindfulPauseAnchor = (typeof LUCID_MINDFUL_PAUSE_ANCHORS)[number];

export const LUCID_MINDFUL_PAUSE_TRIGGERS = [
  'scheduled',
  'transition',
  'emotion',
  'unusual_event',
  'dream_sign',
] as const;
export type LucidMindfulPauseTrigger = (typeof LUCID_MINDFUL_PAUSE_TRIGGERS)[number];
export const DEFAULT_LUCID_MINDFUL_PAUSE_REMINDER_ANCHORS: readonly LucidMindfulPauseAnchor[] =
  ['transition'];

export const MAX_LUCID_REALITY_CHECK_RESPONSE_LENGTH = 500;
export type LucidRealityCheckMethod =
  | 'nose_breathing'
  | 'finger_count'
  | 'text_reread'
  | 'memory_trace';
export type LucidRealityCheckOutcome = 'awake' | 'dreaming' | 'uncertain';
export type LucidPersonalFactor =
  | 'stress'
  | 'alcohol'
  | 'caffeine_late'
  | 'exercise'
  | 'screen_late'
  | 'sleep_debt'
  | 'unusual_schedule';

export interface LucidSleepSchedule {
  bedtime: string;
  wakeTime: string;
  timeZone: string;
}

export interface LucidSleepScheduleDraft {
  bedtime: string | null;
  wakeTime: string | null;
}

export interface LucidAccessibilityPreferences {
  reduceMotion: boolean;
  // Vestigiaux. Aucun écran ne les positionne — l'onboarding ne propose plus que
  // `reduceMotion` — et personne ne les lit : la taille de texte et la sémantique
  // lecteur d'écran appartiennent au système, pas à un mode applicatif, et
  // `settings.tsx` le dit désormais au lieu de le promettre. Les retirer d'ici
  // suppose de toucher `lib/lucid/domain.ts`, `app/lucid/onboarding.tsx` et les
  // deux tests d'écran, qui fournissent encore les deux clés.
  largerText: boolean;
  screenReaderOptimized: boolean;
}

export interface LucidOnboardingState {
  status: 'not_started' | 'in_progress' | 'completed';
  goal: LucidGoal | null;
  experience: LucidExperienceLevel | null;
  weeklyTarget: number;
  sleepSchedule: LucidSleepSchedule;
  notificationsPermission: LucidPermissionState;
  notificationsExplained: boolean;
  audioSafetyAccepted: boolean;
  analyticsConsent: boolean | null;
  accessibility: LucidAccessibilityPreferences;
  completedAt: number | null;
  updatedAt: number;
  /** Absent on historical v1 states. Null until the user answers. */
  wakeSensitivity?: LucidWakeSensitivity | null;
  /** Absent on historical v1 states. 0..3 four-step draft cursor. */
  draftStep?: LucidOnboardingDraftStep;
  /** Absent on historical v1 states. True only after the user confirms the sleep window. */
  sleepScheduleConfirmed?: boolean;
  /** Absent on historical v1 states. Preserves each explicitly entered time independently. */
  sleepScheduleDraft?: LucidSleepScheduleDraft;
}

export interface LucidTrainerPreferences {
  locale: LucidLocale;
  theme: 'dynamic' | 'system' | 'light' | 'dark';
  cloudSyncEnabled: boolean;
  noctaliaLinkEnabled: boolean;
  notificationsEnabled: boolean;
  realityCheckRemindersPerDay: number;
  audioCuesEnabled: boolean;
  audioVolume: number;
  timeZone: string;
  updatedAt: number;
  /** Absent on historical v1 preferences. Unique chosen pause anchors. */
  mindfulPauseReminderAnchors?: LucidMindfulPauseAnchor[];
}

export interface LucidGuidedRitualProgress {
  version: 1;
  sessionId: string;
  technique: LucidGuidedRitualTechnique;
  status: LucidGuidedRitualStatus;
  stepIndex: number;
  stepCount: number;
  mode: LucidGuidedRitualMode;
  startedAt: number;
  stepStartedAt: number;
  completedAt: number | null;
  updatedAt: number;
}

export interface LucidProgramProgress {
  technique: LucidTechnique;
  programId: string;
  status: LucidProgramStatus;
  currentDay: number;
  completedExerciseIds: string[];
  practiceDates: string[];
  startedAt: number | null;
  completedAt: number | null;
  updatedAt: number;
  /** Absent on historical v1 progress. Older clients safely ignore this additive key. */
  guidedRitual?: LucidGuidedRitualProgress;
}

export interface LucidExperiment {
  id: string;
  occurredAt: number;
  technique: LucidTechnique | null;
  preparationMinutes: number | null;
  result: LucidExperimentResult | null;
  lucidityLevel: number | null;
  recallLevel: number | null;
  sleepQuality: number | null;
  factors: LucidPersonalFactor[];
  notes?: string;
  updatedAt: number;
  captureMode?: LucidDreamCaptureMode;
  recallText?: string;
  cueOutcome?: LucidNightCueOutcome;
  techniqueAutoLink?: LucidTechniqueAutoLink | null;
  voiceCapture?: LucidVoiceCaptureState;
}

export interface LucidRealityCheck {
  id: string;
  occurredAt: number;
  context: LucidRealityCheckContext;
  method: LucidRealityCheckMethod;
  outcome: LucidRealityCheckOutcome;
  mindful: boolean;
  /** Present only when a confirmed personal dream sign initiated the pause. */
  dreamSignId?: string;
  dreamSignLabel?: string;
  /** Absent on historical v1 checks. Selected pause trigger, if any. */
  mindfulPauseAnchor?: LucidMindfulPauseAnchor;
  /** Optional short observation of a potentially impossible detail. */
  observedDetail?: string;
  /** Optional reconstruction of how the user arrived here. */
  arrivalPath?: string;
  /** Optional intention to carry into the next dream. */
  nextDreamIntention?: string;
  updatedAt: number;
}

export interface LucidWeeklyReview {
  id: string;
  weekStart: string;
  completedAt: number;
  practiceDays: number;
  recallDays: number;
  lucidDreams: number;
  recommendedTechnique: LucidTechnique | null;
  notes?: string;
  updatedAt: number;
}

export interface LucidPersistedDreamSignDecision extends LucidDreamSignDecisionRecord {
  decision: Exclude<LucidDreamSignDecision, 'pending'>;
  sourceDreamIds: string[];
  updatedAt: number;
}

export interface LucidTrainerState {
  schemaVersion: typeof LUCID_TRAINER_SCHEMA_VERSION;
  createdAt: number;
  updatedAt: number;
  onboarding: LucidOnboardingState;
  preferences: LucidTrainerPreferences;
  progress: LucidProgramProgress[];
  experiments: LucidExperiment[];
  realityChecks: LucidRealityCheck[];
  weeklyReviews: LucidWeeklyReview[];
  /** Absent on historical v1 states; candidates remain derived from the dream journal. */
  dreamSignDecisions?: LucidPersistedDreamSignDecision[];
  /** Absent on historical v1 states. Overlay only; the atlas graph stays derived. */
  dreamAtlas?: LucidDreamAtlasOverlay;
}

export type LucidSyncEntity =
  | { entityType: 'onboarding'; entityKey: 'onboarding'; value: LucidOnboardingState }
  | { entityType: 'preferences'; entityKey: 'preferences'; value: LucidTrainerPreferences }
  | { entityType: 'progress'; entityKey: string; value: LucidProgramProgress }
  | { entityType: 'experiment'; entityKey: string; value: LucidExperiment }
  | { entityType: 'reality_check'; entityKey: string; value: LucidRealityCheck }
  | { entityType: 'weekly_review'; entityKey: string; value: LucidWeeklyReview }
  | { entityType: 'dream_sign'; entityKey: string; value: LucidPersistedDreamSignDecision }
  | { entityType: 'dream_atlas'; entityKey: 'dream_atlas'; value: LucidDreamAtlasOverlay };

export type LucidSyncOperation = 'upsert' | 'delete';
export type LucidSyncMutationStatus = 'pending' | 'sending' | 'failed' | 'blocked';

export interface LucidSyncMutation {
  version: typeof LUCID_TRAINER_MUTATION_VERSION;
  id: string;
  userScope: string;
  entityType: LucidSyncEntity['entityType'];
  entityKey: string;
  operation: LucidSyncOperation;
  clientRequestId: string;
  baseRevision?: string;
  clientUpdatedAt: number;
  payload: { entity?: LucidSyncEntity };
  status: LucidSyncMutationStatus;
  retryCount: number;
  createdAt: number;
  lastAttemptAt?: number;
  nextAttemptAt?: number;
  lastError?: string;
}

const GOALS: readonly LucidGoal[] = [
  'first_lucid_dream',
  'more_frequent_lucidity',
  'stabilize_lucidity',
  'improve_recall',
];
const EXPERIENCE_LEVELS: readonly LucidExperienceLevel[] = [
  'beginner',
  'occasional',
  'experienced',
];
const PROGRAM_STATUSES: readonly LucidProgramStatus[] = [
  'not_started',
  'active',
  'paused',
  'completed',
];
const EXPERIMENT_RESULTS: readonly LucidExperimentResult[] = ['none', 'pre_lucid', 'lucid'];
const MAX_NOTE_LENGTH = 4_000;
const REALITY_CONTEXTS: readonly LucidRealityCheckContext[] = LUCID_REALITY_CHECK_CONTEXTS;
const REALITY_METHODS: readonly LucidRealityCheckMethod[] = [
  'nose_breathing',
  'finger_count',
  'text_reread',
  'memory_trace',
];
const REALITY_OUTCOMES: readonly LucidRealityCheckOutcome[] = [
  'awake',
  'dreaming',
  'uncertain',
];
const PERSONAL_FACTORS: readonly LucidPersonalFactor[] = [
  'stress',
  'alcohol',
  'caffeine_late',
  'exercise',
  'screen_late',
  'sleep_debt',
  'unusual_schedule',
];
const ENTITY_TYPES: readonly LucidSyncEntity['entityType'][] = [
  'onboarding',
  'preferences',
  'progress',
  'experiment',
  'reality_check',
  'weekly_review',
  'dream_sign',
  'dream_atlas',
];
const MAX_COLLECTION_LENGTH = 10_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isEnumValue<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && values.includes(value as T);
}

function isFiniteTimestamp(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 8_640_000_000_000_000
  );
}

function isIntegerInRange(value: unknown, min: number, max: number): value is number {
  return Number.isInteger(value) && (value as number) >= min && (value as number) <= max;
}

function isBoundedString(value: unknown, maxLength = 256): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength;
}

export function isLucidLocalTime(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return false;
  return Number(match[1]) <= 23 && Number(match[2]) <= 59;
}

export function isLucidTimeZone(value: unknown): value is string {
  if (!isBoundedString(value, 128)) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: value }).format(0);
    return true;
  } catch {
    return false;
  }
}

export function isLucidDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isStringList(value: unknown, itemMaxLength = 256): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= MAX_COLLECTION_LENGTH &&
    value.every((item) => isBoundedString(item, itemMaxLength))
  );
}

function hasUniqueStrings(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

function isSleepSchedule(value: unknown): value is LucidSleepSchedule {
  return (
    isRecord(value) &&
    isLucidLocalTime(value.bedtime) &&
    isLucidLocalTime(value.wakeTime) &&
    isLucidTimeZone(value.timeZone)
  );
}

function isAccessibilityPreferences(value: unknown): value is LucidAccessibilityPreferences {
  return (
    isRecord(value) &&
    typeof value.reduceMotion === 'boolean' &&
    typeof value.largerText === 'boolean' &&
    typeof value.screenReaderOptimized === 'boolean'
  );
}

function isOptionalWakeSensitivity(value: unknown): boolean {
  return value === undefined || value === null || isEnumValue(LUCID_WAKE_SENSITIVITIES, value);
}

function isOptionalDraftStep(value: unknown): boolean {
  return value === undefined || (typeof value === 'number' && [0, 1, 2, 3].includes(value));
}

function isOptionalSleepScheduleConfirmed(value: unknown): boolean {
  return value === undefined || typeof value === 'boolean';
}

function isOptionalSleepScheduleDraft(value: unknown): boolean {
  return value === undefined || (
    isRecord(value) &&
    (value.bedtime === null || isLucidLocalTime(value.bedtime)) &&
    (value.wakeTime === null || isLucidLocalTime(value.wakeTime))
  );
}

export function isLucidOnboardingState(value: unknown): value is LucidOnboardingState {
  if (!isRecord(value)) return false;
  return (
    isEnumValue(['not_started', 'in_progress', 'completed'] as const, value.status) &&
    (value.goal === null || isEnumValue(GOALS, value.goal)) &&
    (value.experience === null || isEnumValue(EXPERIENCE_LEVELS, value.experience)) &&
    isIntegerInRange(value.weeklyTarget, 1, 7) &&
    isSleepSchedule(value.sleepSchedule) &&
    isEnumValue(['unknown', 'granted', 'denied'] as const, value.notificationsPermission) &&
    typeof value.notificationsExplained === 'boolean' &&
    typeof value.audioSafetyAccepted === 'boolean' &&
    (value.analyticsConsent === null || typeof value.analyticsConsent === 'boolean') &&
    isAccessibilityPreferences(value.accessibility) &&
    (value.completedAt === null || isFiniteTimestamp(value.completedAt)) &&
    isFiniteTimestamp(value.updatedAt) &&
    isOptionalWakeSensitivity(value.wakeSensitivity) &&
    isOptionalDraftStep(value.draftStep) &&
    isOptionalSleepScheduleConfirmed(value.sleepScheduleConfirmed) &&
    isOptionalSleepScheduleDraft(value.sleepScheduleDraft)
  );
}

function isOptionalMindfulPauseReminderAnchors(value: unknown): boolean {
  return (
    value === undefined ||
    (Array.isArray(value) &&
      value.length <= LUCID_MINDFUL_PAUSE_ANCHORS.length &&
      value.every((item) => isEnumValue(LUCID_MINDFUL_PAUSE_ANCHORS, item)) &&
      hasUniqueStrings(value as string[]))
  );
}

export function isLucidTrainerPreferences(value: unknown): value is LucidTrainerPreferences {
  if (!isRecord(value)) return false;
  return (
    isEnumValue(LUCID_LOCALES, value.locale) &&
    isEnumValue(['dynamic', 'system', 'light', 'dark'] as const, value.theme) &&
    typeof value.cloudSyncEnabled === 'boolean' &&
    typeof value.noctaliaLinkEnabled === 'boolean' &&
    typeof value.notificationsEnabled === 'boolean' &&
    isIntegerInRange(value.realityCheckRemindersPerDay, 0, 12) &&
    typeof value.audioCuesEnabled === 'boolean' &&
    typeof value.audioVolume === 'number' &&
    Number.isFinite(value.audioVolume) &&
    value.audioVolume >= 0 &&
    value.audioVolume <= 0.5 &&
    isLucidTimeZone(value.timeZone) &&
    isFiniteTimestamp(value.updatedAt) &&
    isOptionalMindfulPauseReminderAnchors(value.mindfulPauseReminderAnchors)
  );
}

export function isLucidGuidedRitualProgress(
  value: unknown,
  technique?: LucidTechnique
): value is LucidGuidedRitualProgress {
  if (!isRecord(value)) return false;
  if (
    value.version !== 1 ||
    !isBoundedString(value.sessionId, 128) ||
    !isEnumValue(LUCID_GUIDED_RITUAL_TECHNIQUES, value.technique) ||
    (technique !== undefined && value.technique !== technique) ||
    !isEnumValue(LUCID_GUIDED_RITUAL_STATUSES, value.status) ||
    !isIntegerInRange(value.stepCount, 1, MAX_LUCID_GUIDED_RITUAL_STEPS) ||
    !isIntegerInRange(value.stepIndex, 0, value.stepCount - 1) ||
    !isEnumValue(LUCID_GUIDED_RITUAL_MODES, value.mode) ||
    !isFiniteTimestamp(value.startedAt) ||
    !isFiniteTimestamp(value.stepStartedAt) ||
    !isFiniteTimestamp(value.updatedAt) ||
    value.startedAt > value.stepStartedAt ||
    value.stepStartedAt > value.updatedAt
  ) {
    return false;
  }

  if (value.status === 'completed') {
    return (
      value.stepIndex === value.stepCount - 1 &&
      isFiniteTimestamp(value.completedAt) &&
      value.completedAt >= value.stepStartedAt &&
      value.completedAt <= value.updatedAt
    );
  }
  return value.completedAt === null;
}

export function isLucidProgramProgress(value: unknown): value is LucidProgramProgress {
  if (!isRecord(value)) return false;
  return (
    isEnumValue(LUCID_TECHNIQUES, value.technique) &&
    isBoundedString(value.programId, 128) &&
    isEnumValue(PROGRAM_STATUSES, value.status) &&
    isIntegerInRange(value.currentDay, 1, 365) &&
    isStringList(value.completedExerciseIds) &&
    Array.isArray(value.practiceDates) &&
    value.practiceDates.length <= MAX_COLLECTION_LENGTH &&
    value.practiceDates.every(isLucidDateKey) &&
    (value.startedAt === null || isFiniteTimestamp(value.startedAt)) &&
    (value.completedAt === null || isFiniteTimestamp(value.completedAt)) &&
    isFiniteTimestamp(value.updatedAt) &&
    (value.guidedRitual === undefined ||
      isLucidGuidedRitualProgress(value.guidedRitual, value.technique as LucidTechnique))
  );
}

function isNullableEnum<T extends string>(
  values: readonly T[],
  value: unknown
): value is T | null {
  return value === null || isEnumValue(values, value);
}

function isNullableIntegerInRange(value: unknown, min: number, max: number): boolean {
  return value === null || isIntegerInRange(value, min, max);
}

function isOptionalNote(value: unknown): boolean {
  return value === undefined || (typeof value === 'string' && value.length <= MAX_NOTE_LENGTH);
}

function isNonEmptyBoundedText(value: unknown, maxLength = MAX_NOTE_LENGTH): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength;
}

export function isLucidTechniqueAutoLink(value: unknown): value is LucidTechniqueAutoLink {
  return (
    isRecord(value) &&
    isEnumValue(LUCID_TECHNIQUES, value.technique) &&
    isEnumValue(LUCID_TECHNIQUE_AUTO_LINK_SOURCES, value.source) &&
    isLucidDateKey(value.practiceDate)
  );
}

function isOptionalTechniqueAutoLink(value: unknown): boolean {
  return value === undefined || value === null || isLucidTechniqueAutoLink(value);
}

function isLegacyCaptureFields(value: Record<string, unknown>): boolean {
  return (
    isEnumValue(LUCID_TECHNIQUES, value.technique) &&
    isIntegerInRange(value.preparationMinutes, 0, 240) &&
    isEnumValue(EXPERIMENT_RESULTS, value.result) &&
    isIntegerInRange(value.lucidityLevel, 0, 5) &&
    isIntegerInRange(value.recallLevel, 0, 5) &&
    isIntegerInRange(value.sleepQuality, 0, 5)
  );
}

function isNewCaptureFields(value: Record<string, unknown>): boolean {
  return (
    isNullableEnum(LUCID_TECHNIQUES, value.technique) &&
    isNullableIntegerInRange(value.preparationMinutes, 0, 240) &&
    isNullableEnum(EXPERIMENT_RESULTS, value.result) &&
    isNullableIntegerInRange(value.lucidityLevel, 0, 5) &&
    isNullableIntegerInRange(value.recallLevel, 0, 5) &&
    isNullableIntegerInRange(value.sleepQuality, 0, 5)
  );
}

function isSharedExperimentShape(value: Record<string, unknown>): boolean {
  return (
    isBoundedString(value.id, 128) &&
    isFiniteTimestamp(value.occurredAt) &&
    Array.isArray(value.factors) &&
    value.factors.length <= PERSONAL_FACTORS.length &&
    value.factors.every((factor) => isEnumValue(PERSONAL_FACTORS, factor)) &&
    hasUniqueStrings(value.factors as string[]) &&
    isOptionalNote(value.notes) &&
    isFiniteTimestamp(value.updatedAt)
  );
}

function isLegacyExperiment(value: Record<string, unknown>): boolean {
  if (value.captureMode !== undefined) return false;
  if (
    value.recallText !== undefined ||
    value.cueOutcome !== undefined ||
    value.voiceCapture !== undefined ||
    value.techniqueAutoLink !== undefined
  ) {
    return false;
  }
  return isLegacyCaptureFields(value) && isSharedExperimentShape(value);
}

function isNewExperiment(value: Record<string, unknown>): boolean {
  if (!isEnumValue(LUCID_DREAM_CAPTURE_MODES, value.captureMode)) return false;
  if (!isNewCaptureFields(value) || !isSharedExperimentShape(value)) return false;
  if (!isOptionalTechniqueAutoLink(value.techniqueAutoLink)) return false;
  if (!isEnumValue(LUCID_NIGHT_CUE_OUTCOMES, value.cueOutcome)) return false;

  const captureMode = value.captureMode;
  if (captureMode === 'nothing_for_now') {
    return value.recallText === undefined && value.voiceCapture === undefined;
  }

  if (captureMode === 'write') {
    return isNonEmptyBoundedText(value.recallText) && value.voiceCapture === undefined;
  }

  if (!isEnumValue(LUCID_VOICE_CAPTURE_STATES, value.voiceCapture)) return false;
  if (value.voiceCapture === 'local_note') {
    return value.recallText === undefined || isNonEmptyBoundedText(value.recallText);
  }
  return isNonEmptyBoundedText(value.recallText);
}

export function isLucidExperiment(value: unknown): value is LucidExperiment {
  if (!isRecord(value)) return false;
  return value.captureMode === undefined ? isLegacyExperiment(value) : isNewExperiment(value);
}

function isOptionalRealityCheckResponse(value: unknown): boolean {
  return (
    value === undefined ||
    (typeof value === 'string' &&
      value.trim().length > 0 &&
      value.length <= MAX_LUCID_REALITY_CHECK_RESPONSE_LENGTH)
  );
}

function isCompatibleMindfulPauseAnchor(
  context: LucidRealityCheckContext,
  anchor: unknown
): boolean {
  if (anchor === undefined) return true;
  if (!isEnumValue(LUCID_MINDFUL_PAUSE_ANCHORS, anchor)) return false;
  if (context === 'scheduled') return false;
  if (context === 'spontaneous') return anchor === 'unusual_event';
  return context === anchor;
}

export function persistLucidMindfulPauseTrigger(trigger: LucidMindfulPauseTrigger): {
  context: LucidRealityCheckContext;
  mindfulPauseAnchor?: LucidMindfulPauseAnchor;
} {
  if (trigger === 'scheduled') return { context: 'scheduled' };
  if (trigger === 'unusual_event') {
    return { context: 'spontaneous', mindfulPauseAnchor: 'unusual_event' };
  }
  return { context: trigger, mindfulPauseAnchor: trigger };
}

export function isLucidRealityCheck(value: unknown): value is LucidRealityCheck {
  if (!isRecord(value)) return false;
  const hasDreamSign = value.dreamSignId !== undefined || value.dreamSignLabel !== undefined;
  const requiresDreamSignIdentity = hasDreamSign || value.mindfulPauseAnchor === 'dream_sign';
  return (
    isBoundedString(value.id, 128) &&
    isFiniteTimestamp(value.occurredAt) &&
    isEnumValue(REALITY_CONTEXTS, value.context) &&
    isEnumValue(REALITY_METHODS, value.method) &&
    isEnumValue(REALITY_OUTCOMES, value.outcome) &&
    typeof value.mindful === 'boolean' &&
    isCompatibleMindfulPauseAnchor(value.context, value.mindfulPauseAnchor) &&
    (!requiresDreamSignIdentity ||
      (value.context === 'dream_sign' &&
        isBoundedString(value.dreamSignId, 128) &&
        value.dreamSignId.startsWith('sign:') &&
        isBoundedString(value.dreamSignLabel, 80))) &&
    isOptionalRealityCheckResponse(value.observedDetail) &&
    isOptionalRealityCheckResponse(value.arrivalPath) &&
    isOptionalRealityCheckResponse(value.nextDreamIntention) &&
    isFiniteTimestamp(value.updatedAt)
  );
}

export function isLucidWeeklyReview(value: unknown): value is LucidWeeklyReview {
  if (!isRecord(value)) return false;
  return (
    isBoundedString(value.id, 128) &&
    isLucidDateKey(value.weekStart) &&
    isFiniteTimestamp(value.completedAt) &&
    isIntegerInRange(value.practiceDays, 0, 7) &&
    isIntegerInRange(value.recallDays, 0, 7) &&
    isIntegerInRange(value.lucidDreams, 0, 100) &&
    (value.recommendedTechnique === null ||
      isEnumValue(LUCID_TECHNIQUES, value.recommendedTechnique)) &&
    isOptionalNote(value.notes) &&
    isFiniteTimestamp(value.updatedAt)
  );
}

export function isLucidPersistedDreamSignDecision(
  value: unknown
): value is LucidPersistedDreamSignDecision {
  if (!isRecord(value)) return false;
  return (
    isBoundedString(value.id, 128) &&
    value.id.startsWith('sign:') &&
    isEnumValue(['confirmed', 'rejected'] as const, value.decision) &&
    (value.customLabel === undefined ||
      value.customLabel === null ||
      (typeof value.customLabel === 'string' &&
        value.customLabel.trim().length > 0 &&
        value.customLabel.length <= 80)) &&
    isStringList(value.sourceDreamIds, 128) &&
    value.sourceDreamIds.length > 0 &&
    hasUniqueStrings(value.sourceDreamIds) &&
    isFiniteTimestamp(value.updatedAt)
  );
}

export function isLucidTrainerState(value: unknown): value is LucidTrainerState {
  if (!isRecord(value) || value.schemaVersion !== LUCID_TRAINER_SCHEMA_VERSION) return false;
  return (
    isFiniteTimestamp(value.createdAt) &&
    isFiniteTimestamp(value.updatedAt) &&
    isLucidOnboardingState(value.onboarding) &&
    isLucidTrainerPreferences(value.preferences) &&
    Array.isArray(value.progress) &&
    value.progress.length <= LUCID_TECHNIQUES.length &&
    value.progress.every(isLucidProgramProgress) &&
    hasUniqueStrings(value.progress.map((item) => item.technique)) &&
    Array.isArray(value.experiments) &&
    value.experiments.length <= MAX_COLLECTION_LENGTH &&
    value.experiments.every(isLucidExperiment) &&
    hasUniqueStrings(value.experiments.map((item) => item.id)) &&
    Array.isArray(value.realityChecks) &&
    value.realityChecks.length <= MAX_COLLECTION_LENGTH &&
    value.realityChecks.every(isLucidRealityCheck) &&
    hasUniqueStrings(value.realityChecks.map((item) => item.id)) &&
    Array.isArray(value.weeklyReviews) &&
    value.weeklyReviews.length <= MAX_COLLECTION_LENGTH &&
    value.weeklyReviews.every(isLucidWeeklyReview) &&
    hasUniqueStrings(value.weeklyReviews.map((item) => item.id)) &&
    (value.dreamSignDecisions === undefined ||
      (Array.isArray(value.dreamSignDecisions) &&
        value.dreamSignDecisions.length <= MAX_COLLECTION_LENGTH &&
        value.dreamSignDecisions.every(isLucidPersistedDreamSignDecision) &&
        hasUniqueStrings(value.dreamSignDecisions.map((item) => item.id)))) &&
    (value.dreamAtlas === undefined || isLucidDreamAtlasOverlay(value.dreamAtlas))
  );
}

export function assertLucidTrainerState(value: unknown): asserts value is LucidTrainerState {
  if (!isLucidTrainerState(value)) {
    throw new Error('Invalid Lucid Trainer state');
  }
}

export function parseLucidTrainerState(raw: string): LucidTrainerState | null {
  try {
    const value: unknown = JSON.parse(raw);
    return isLucidTrainerState(value) ? value : null;
  } catch {
    return null;
  }
}

export function isLucidSyncEntity(value: unknown): value is LucidSyncEntity {
  if (!isRecord(value) || !isEnumValue(ENTITY_TYPES, value.entityType)) return false;
  if (!isBoundedString(value.entityKey, 256)) return false;

  switch (value.entityType) {
    case 'onboarding':
      return value.entityKey === 'onboarding' && isLucidOnboardingState(value.value);
    case 'preferences':
      return value.entityKey === 'preferences' && isLucidTrainerPreferences(value.value);
    case 'progress':
      return isLucidProgramProgress(value.value) && value.entityKey === value.value.technique;
    case 'experiment':
      return isLucidExperiment(value.value) && value.entityKey === value.value.id;
    case 'reality_check':
      return isLucidRealityCheck(value.value) && value.entityKey === value.value.id;
    case 'weekly_review':
      return isLucidWeeklyReview(value.value) && value.entityKey === value.value.id;
    case 'dream_sign':
      return isLucidPersistedDreamSignDecision(value.value) && value.entityKey === value.value.id;
    case 'dream_atlas':
      return value.entityKey === 'dream_atlas' && isLucidDreamAtlasOverlay(value.value);
  }
}

export function isLucidSyncMutation(value: unknown): value is LucidSyncMutation {
  if (!isRecord(value) || value.version !== LUCID_TRAINER_MUTATION_VERSION) return false;
  if (
    !isBoundedString(value.id, 256) ||
    !isBoundedString(value.userScope, 256) ||
    !isEnumValue(ENTITY_TYPES, value.entityType) ||
    !isBoundedString(value.entityKey, 256) ||
    !isEnumValue(['upsert', 'delete'] as const, value.operation) ||
    !isBoundedString(value.clientRequestId, 256) ||
    !isFiniteTimestamp(value.clientUpdatedAt) ||
    !isRecord(value.payload) ||
    !isEnumValue(['pending', 'sending', 'failed', 'blocked'] as const, value.status) ||
    !isIntegerInRange(value.retryCount, 0, 100) ||
    !isFiniteTimestamp(value.createdAt) ||
    (value.baseRevision !== undefined && !isBoundedString(value.baseRevision, 256)) ||
    (value.lastAttemptAt !== undefined && !isFiniteTimestamp(value.lastAttemptAt)) ||
    (value.nextAttemptAt !== undefined && !isFiniteTimestamp(value.nextAttemptAt)) ||
    (value.lastError !== undefined &&
      !(typeof value.lastError === 'string' && value.lastError.length <= 2_000))
  ) {
    return false;
  }

  if (value.operation === 'upsert') {
    return (
      isLucidSyncEntity(value.payload.entity) &&
      value.payload.entity.entityType === value.entityType &&
      value.payload.entity.entityKey === value.entityKey
    );
  }

  return value.payload.entity === undefined;
}

export function parseLucidSyncQueue(raw: string): LucidSyncMutation[] | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value) || value.length > MAX_COLLECTION_LENGTH) return null;
    return value.every(isLucidSyncMutation) ? value : null;
  } catch {
    return null;
  }
}
