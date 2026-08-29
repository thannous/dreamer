/**
 * Pure VNext contract for Noctalia Dreamer local notifications.
 *
 * Essential families:
 * - morning capture (`daily`) -> `/recording`
 * - analysis ready (`analysis_ready`) -> `/journal/{id}`
 * - weekly recap (`weekly_recap`) -> `/weekly-recap`
 *
 * Optional families, off unless the user explicitly enables them:
 * - streak risk (`streak_risk`) -> `/recording`
 * - inactivity (`inactivity`) -> `/recording`
 *
 * Ritual reminders and unmarked leftovers are treated as orphans and cancelled.
 * Lucid Trainer notifications are never touched.
 *
 * Timezone / DST model:
 * every owned request is stamped with the device IANA zone and the numeric
 * UTC offset at schedule time. A later reconcile compares that stamp to the
 * current context. An offset change (spring-forward, fall-back, travel)
 * invalidates the signature, so wall-clock families are cancelled and
 * rebuilt against the new local time. Dated one-shots are rebuilt from the
 * current local evening so they still fire on the intended calendar night.
 *
 * No React, Expo, or platform imports - this module is the part tests pin down.
 */

import type { InactivityReminderPlan, StreakRiskReminderPlan } from './engagementReminders';
import type { NotificationSettings } from './types';

export const DREAMER_NOTIFICATION_OWNER = 'dreamer';
export const DREAMER_REMINDER_TYPE_KEY = 'dreamerReminderType';
export const DREAMER_OCCURRENCE_ID_KEY = 'dreamerReminderOccurrenceId';
export const DREAMER_SIGNATURE_KEY = 'dreamerReminderSignature';
export const DREAMER_TIME_ZONE_KEY = 'dreamerReminderTimeZone';
export const DREAMER_OFFSET_KEY = 'dreamerReminderOffsetMinutes';
export const DREAMER_OWNER_KEY = 'noctaliaNotificationOwner';
export const LUCID_TRAINER_NOTIFICATION_OWNER = 'lucid-trainer';

export const DREAMER_NOTIFICATION_PLAN_VERSION = 1;

export const RECORDING_NOTIFICATION_URL = '/recording';
export const WEEKLY_RECAP_NOTIFICATION_URL = '/weekly-recap';

/** Sunday, 10:00 local: late enough for a lie-in, early enough to plan the week. */
export const WEEKLY_RECAP_WEEKDAY = 1;
export const WEEKLY_RECAP_TIME = '10:00';

export const WEEKDAY_WEEKDAYS: readonly number[] = [2, 3, 4, 5, 6];
export const WEEKEND_WEEKDAYS: readonly number[] = [1, 7];

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  weekdayEnabled: false,
  weekdayTime: '07:00',
  weekendEnabled: false,
  weekendTime: '10:00',
  weeklyRecapEnabled: false,
  streakRiskEnabled: false,
  inactivityNudgeEnabled: false,
};

export type DreamerEssentialReminderType = 'daily' | 'weekly_recap' | 'analysis_ready';
export type DreamerOptionalReminderType = 'streak_risk' | 'inactivity';
export type DreamerReminderType = DreamerEssentialReminderType | DreamerOptionalReminderType;

export const ESSENTIAL_REMINDER_TYPES: readonly DreamerEssentialReminderType[] = [
  'daily',
  'weekly_recap',
  'analysis_ready',
];
export const OPTIONAL_REMINDER_TYPES: readonly DreamerOptionalReminderType[] = [
  'streak_risk',
  'inactivity',
];
export const DREAMER_REMINDER_TYPES: readonly DreamerReminderType[] = [
  ...ESSENTIAL_REMINDER_TYPES,
  ...OPTIONAL_REMINDER_TYPES,
];

export type DreamerNotificationUrl =
  | typeof RECORDING_NOTIFICATION_URL
  | typeof WEEKLY_RECAP_NOTIFICATION_URL
  | `/journal/${number}`;

export type DreamerTimeContext = {
  timeZone: string;
  offsetMinutes: number;
};

export type DreamerScheduledRequest = {
  identifier: string;
  title?: string;
  data?: unknown;
};

export type DreamerDesiredOccurrence = {
  occurrenceId: string;
  reminderType: DreamerReminderType;
  url: DreamerNotificationUrl;
  weekday?: number;
  time?: string;
  triggerAt?: number;
  inactivityStage?: 3 | 7;
  dreamId?: number;
  streakLength?: number;
  signature: string;
};

export type DreamerNotificationPlanInput = {
  settings: NotificationSettings;
  timeContext: DreamerTimeContext;
  now?: number;
  streakRisk?: StreakRiskReminderPlan | null;
  inactivity?: readonly InactivityReminderPlan[];
  analysisReady?: { dreamId: number; triggerAt?: number } | null;
};

export type DreamerReconciliationDecision = {
  toCancel: string[];
  toSchedule: DreamerDesiredOccurrence[];
  unchangedOccurrenceIds: string[];
  orphanIdentifiers: string[];
  timeContextChanged: boolean;
};

export type AnalysisReadyNotifyDecision = {
  dreamId: number;
} | null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
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

export function canonicalDreamerJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export function isDreamerReminderType(value: unknown): value is DreamerReminderType {
  return typeof value === 'string' && (DREAMER_REMINDER_TYPES as readonly string[]).includes(value);
}

export function analysisReadyNotificationUrl(dreamId: number): `/journal/${number}` {
  return `/journal/${dreamId}`;
}

export function isJournalNotificationUrl(value: unknown): value is `/journal/${number}` {
  return typeof value === 'string' && /^\/journal\/\d+$/.test(value);
}

export function parseJournalNotificationDreamId(url: string): number | null {
  const match = /^\/journal\/(\d+)$/.exec(url);
  if (!match) return null;
  const dreamId = Number(match[1]);
  return Number.isSafeInteger(dreamId) ? dreamId : null;
}

export function isSafeDreamerNotificationRoute(value: unknown): value is DreamerNotificationUrl {
  return (
    value === WEEKLY_RECAP_NOTIFICATION_URL ||
    value === RECORDING_NOTIFICATION_URL ||
    isJournalNotificationUrl(value)
  );
}

export function resolveDreamerTimeContext(params?: {
  now?: number;
  timeZone?: string;
  offsetMinutes?: number;
}): DreamerTimeContext {
  const now = params?.now ?? Date.now();
  let timeZone = params?.timeZone;
  if (!timeZone) {
    try {
      timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
      timeZone = 'UTC';
    }
  }
  return {
    timeZone,
    offsetMinutes: params?.offsetMinutes ?? new Date(now).getTimezoneOffset(),
  };
}

function parseClock(time: string): { hours: number; minutes: number } | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }
  return { hours, minutes };
}

function clockOrFallback(time: string, fallback: string): string {
  return parseClock(time) ? time : fallback;
}

export function normalizeNotificationSettings(raw: unknown): NotificationSettings {
  if (!isRecord(raw)) {
    return { ...DEFAULT_NOTIFICATION_SETTINGS };
  }

  if ('isEnabled' in raw && !('weekdayEnabled' in raw)) {
    const enabled = raw.isEnabled === true;
    return {
      weekdayEnabled: enabled,
      weekdayTime: clockOrFallback(
        typeof raw.weekdayTime === 'string' ? raw.weekdayTime : DEFAULT_NOTIFICATION_SETTINGS.weekdayTime,
        DEFAULT_NOTIFICATION_SETTINGS.weekdayTime
      ),
      weekendEnabled: enabled,
      weekendTime: clockOrFallback(
        typeof raw.weekendTime === 'string' ? raw.weekendTime : DEFAULT_NOTIFICATION_SETTINGS.weekendTime,
        DEFAULT_NOTIFICATION_SETTINGS.weekendTime
      ),
      weeklyRecapEnabled: false,
      streakRiskEnabled: false,
      inactivityNudgeEnabled: false,
    };
  }

  return {
    weekdayEnabled: raw.weekdayEnabled === true,
    weekdayTime: clockOrFallback(
      typeof raw.weekdayTime === 'string' ? raw.weekdayTime : DEFAULT_NOTIFICATION_SETTINGS.weekdayTime,
      DEFAULT_NOTIFICATION_SETTINGS.weekdayTime
    ),
    weekendEnabled: raw.weekendEnabled === true,
    weekendTime: clockOrFallback(
      typeof raw.weekendTime === 'string' ? raw.weekendTime : DEFAULT_NOTIFICATION_SETTINGS.weekendTime,
      DEFAULT_NOTIFICATION_SETTINGS.weekendTime
    ),
    weeklyRecapEnabled: raw.weeklyRecapEnabled === true,
    streakRiskEnabled: raw.streakRiskEnabled === true,
    inactivityNudgeEnabled: raw.inactivityNudgeEnabled === true,
  };
}

export function occurrenceSignature(
  occurrence: Omit<DreamerDesiredOccurrence, 'signature'>,
  timeContext: DreamerTimeContext
): string {
  return canonicalDreamerJson({
    version: DREAMER_NOTIFICATION_PLAN_VERSION,
    timeZone: timeContext.timeZone,
    offsetMinutes: timeContext.offsetMinutes,
    occurrenceId: occurrence.occurrenceId,
    reminderType: occurrence.reminderType,
    url: occurrence.url,
    weekday: occurrence.weekday ?? null,
    time: occurrence.time ?? null,
    triggerAt: occurrence.triggerAt ?? null,
    inactivityStage: occurrence.inactivityStage ?? null,
    dreamId: occurrence.dreamId ?? null,
    streakLength: occurrence.streakLength ?? null,
  });
}

function withSignature(
  occurrence: Omit<DreamerDesiredOccurrence, 'signature'>,
  timeContext: DreamerTimeContext
): DreamerDesiredOccurrence {
  return { ...occurrence, signature: occurrenceSignature(occurrence, timeContext) };
}

function weeklyOccurrences(
  reminderType: Extract<DreamerReminderType, 'daily' | 'weekly_recap'>,
  days: readonly number[],
  time: string,
  url: DreamerNotificationUrl,
  timeContext: DreamerTimeContext
): DreamerDesiredOccurrence[] {
  const clock = parseClock(time);
  if (!clock) return [];
  const normalizedTime = `${String(clock.hours).padStart(2, '0')}:${String(clock.minutes).padStart(2, '0')}`;
  return [...days]
    .sort((left, right) => left - right)
    .map((weekday) =>
      withSignature(
        {
          occurrenceId: `${reminderType}:weekday:${weekday}`,
          reminderType,
          url,
          weekday,
          time: normalizedTime,
        },
        timeContext
      )
    );
}

export function buildDreamerNotificationPlan(
  input: DreamerNotificationPlanInput
): DreamerDesiredOccurrence[] {
  const settings = normalizeNotificationSettings(input.settings);
  const { timeContext } = input;
  const now = input.now ?? Date.now();
  const desired: DreamerDesiredOccurrence[] = [];

  if (settings.weekdayEnabled) {
    desired.push(
      ...weeklyOccurrences(
        'daily',
        WEEKDAY_WEEKDAYS,
        settings.weekdayTime,
        RECORDING_NOTIFICATION_URL,
        timeContext
      )
    );
  }
  if (settings.weekendEnabled) {
    desired.push(
      ...weeklyOccurrences(
        'daily',
        WEEKEND_WEEKDAYS,
        settings.weekendTime,
        RECORDING_NOTIFICATION_URL,
        timeContext
      )
    );
  }
  if (settings.weeklyRecapEnabled) {
    desired.push(
      ...weeklyOccurrences(
        'weekly_recap',
        [WEEKLY_RECAP_WEEKDAY],
        WEEKLY_RECAP_TIME,
        WEEKLY_RECAP_NOTIFICATION_URL,
        timeContext
      )
    );
  }

  if (settings.streakRiskEnabled && input.streakRisk && input.streakRisk.triggerAt > now) {
    desired.push(
      withSignature(
        {
          occurrenceId: 'streak_risk:once',
          reminderType: 'streak_risk',
          url: RECORDING_NOTIFICATION_URL,
          triggerAt: input.streakRisk.triggerAt,
          streakLength: input.streakRisk.streakLength,
        },
        timeContext
      )
    );
  }

  if (settings.inactivityNudgeEnabled) {
    for (const plan of input.inactivity ?? []) {
      if (plan.triggerAt <= now) continue;
      desired.push(
        withSignature(
          {
            occurrenceId: `inactivity:${plan.stage}`,
            reminderType: 'inactivity',
            url: RECORDING_NOTIFICATION_URL,
            triggerAt: plan.triggerAt,
            inactivityStage: plan.stage,
          },
          timeContext
        )
      );
    }
  }

  const analysisReady = input.analysisReady;
  if (analysisReady && Number.isSafeInteger(analysisReady.dreamId) && analysisReady.dreamId > 0) {
    const triggerAt = analysisReady.triggerAt ?? now + 1_000;
    if (triggerAt > now) {
      desired.push(
        withSignature(
          {
            occurrenceId: `analysis_ready:${analysisReady.dreamId}`,
            reminderType: 'analysis_ready',
            url: analysisReadyNotificationUrl(analysisReady.dreamId),
            triggerAt,
            dreamId: analysisReady.dreamId,
          },
          timeContext
        )
      );
    }
  }

  return desired.sort((left, right) => left.occurrenceId.localeCompare(right.occurrenceId));
}

export function getScheduledRequestData(
  request: DreamerScheduledRequest
): Record<string, unknown> | null {
  return isRecord(request.data) ? request.data : null;
}

export function isLucidOwnedRequest(request: DreamerScheduledRequest): boolean {
  return getScheduledRequestData(request)?.[DREAMER_OWNER_KEY] === LUCID_TRAINER_NOTIFICATION_OWNER;
}

export function isDreamerOwnedRequest(request: DreamerScheduledRequest): boolean {
  const data = getScheduledRequestData(request);
  if (data?.[DREAMER_OWNER_KEY] === DREAMER_NOTIFICATION_OWNER) return true;
  return isDreamerReminderType(data?.[DREAMER_REMINDER_TYPE_KEY]);
}

export function isLegacyDailyRequest(request: DreamerScheduledRequest): boolean {
  const data = getScheduledRequestData(request);
  if (!data || isDreamerReminderType(data[DREAMER_REMINDER_TYPE_KEY])) return false;
  if (data.ritualId != null || data.test === true) return false;
  return request.title === 'Dream Journal Reminder' && data.url === RECORDING_NOTIFICATION_URL;
}

export function isLegacyRitualRequest(request: DreamerScheduledRequest): boolean {
  const data = getScheduledRequestData(request);
  if (!data) return false;
  if (data[DREAMER_REMINDER_TYPE_KEY] === 'ritual') return true;
  return typeof data.ritualId === 'string' && !isDreamerReminderType(data[DREAMER_REMINDER_TYPE_KEY]);
}

export function isDreamerOrphanRequest(request: DreamerScheduledRequest): boolean {
  if (isLucidOwnedRequest(request)) return false;
  if (isLegacyRitualRequest(request)) return true;
  if (isLegacyDailyRequest(request)) return true;
  const data = getScheduledRequestData(request);
  if (!data) return false;
  if (data[DREAMER_REMINDER_TYPE_KEY] === 'ritual') return true;
  if (isDreamerOwnedRequest(request)) return false;
  return data.url === RECORDING_NOTIFICATION_URL || data.url === WEEKLY_RECAP_NOTIFICATION_URL;
}

export function requestTimeContextChanged(
  request: DreamerScheduledRequest,
  timeContext: DreamerTimeContext
): boolean {
  const data = getScheduledRequestData(request);
  if (!data) return true;
  return (
    data[DREAMER_TIME_ZONE_KEY] !== timeContext.timeZone ||
    data[DREAMER_OFFSET_KEY] !== timeContext.offsetMinutes
  );
}

export function reconcileDreamerNotificationPlan(
  scheduled: readonly DreamerScheduledRequest[],
  desired: readonly DreamerDesiredOccurrence[],
  timeContext: DreamerTimeContext,
  options: { preserveReminderTypes?: readonly DreamerReminderType[] } = {}
): DreamerReconciliationDecision {
  const desiredById = new Map(desired.map((occurrence) => [occurrence.occurrenceId, occurrence]));
  const preserve = new Set(options.preserveReminderTypes ?? []);
  const toCancel: string[] = [];
  const orphanIdentifiers: string[] = [];
  const retainedOccurrenceIds = new Set<string>();
  let timeContextChanged = false;

  for (const request of scheduled) {
    if (isLucidOwnedRequest(request)) continue;

    const data = getScheduledRequestData(request);
    const occurrenceId =
      typeof data?.[DREAMER_OCCURRENCE_ID_KEY] === 'string'
        ? data[DREAMER_OCCURRENCE_ID_KEY]
        : undefined;
    const signature =
      typeof data?.[DREAMER_SIGNATURE_KEY] === 'string' ? data[DREAMER_SIGNATURE_KEY] : undefined;
    const reminderType = isDreamerReminderType(data?.[DREAMER_REMINDER_TYPE_KEY])
      ? data[DREAMER_REMINDER_TYPE_KEY]
      : undefined;
    const wanted = occurrenceId ? desiredById.get(occurrenceId) : undefined;
    const contextChanged = isDreamerOwnedRequest(request)
      ? requestTimeContextChanged(request, timeContext)
      : false;

    if (contextChanged) timeContextChanged = true;

    if (
      wanted &&
      signature === wanted.signature &&
      !contextChanged &&
      !retainedOccurrenceIds.has(wanted.occurrenceId)
    ) {
      retainedOccurrenceIds.add(wanted.occurrenceId);
      continue;
    }

    if (reminderType && preserve.has(reminderType) && !wanted && !isDreamerOrphanRequest(request)) {
      continue;
    }

    if (isDreamerOrphanRequest(request) || isDreamerOwnedRequest(request) || wanted) {
      toCancel.push(request.identifier);
      if (!wanted || isDreamerOrphanRequest(request)) {
        orphanIdentifiers.push(request.identifier);
      }
    }
  }

  const toSchedule = desired.filter(
    (occurrence) => !retainedOccurrenceIds.has(occurrence.occurrenceId)
  );

  return {
    toCancel,
    toSchedule,
    unchangedOccurrenceIds: [...retainedOccurrenceIds].sort((left, right) =>
      left.localeCompare(right)
    ),
    orphanIdentifiers,
    timeContextChanged,
  };
}

export function shouldPresentAnalysisReadyNotification(params: {
  appState: 'active' | 'background' | 'inactive' | 'unknown' | 'extension';
  outcome: { dreamId: number; status: 'done' | 'failed'; completedAt: number } | null;
  lastNotified: { dreamId: number; completedAt: number } | null;
}): AnalysisReadyNotifyDecision {
  const { appState, outcome, lastNotified } = params;
  if (!outcome || outcome.status !== 'done') return null;
  if (appState === 'active') return null;
  if (
    lastNotified &&
    lastNotified.dreamId === outcome.dreamId &&
    lastNotified.completedAt === outcome.completedAt
  ) {
    return null;
  }
  if (!Number.isSafeInteger(outcome.dreamId) || outcome.dreamId <= 0) return null;
  return { dreamId: outcome.dreamId };
}

export function buildDreamerNotificationContentData(
  occurrence: DreamerDesiredOccurrence,
  timeContext: DreamerTimeContext
): Record<string, unknown> {
  return {
    url: occurrence.url,
    [DREAMER_OWNER_KEY]: DREAMER_NOTIFICATION_OWNER,
    [DREAMER_REMINDER_TYPE_KEY]: occurrence.reminderType,
    [DREAMER_OCCURRENCE_ID_KEY]: occurrence.occurrenceId,
    [DREAMER_SIGNATURE_KEY]: occurrence.signature,
    [DREAMER_TIME_ZONE_KEY]: timeContext.timeZone,
    [DREAMER_OFFSET_KEY]: timeContext.offsetMinutes,
    ...(occurrence.inactivityStage != null
      ? { inactivityStage: occurrence.inactivityStage }
      : {}),
    ...(occurrence.dreamId != null ? { dreamId: occurrence.dreamId } : {}),
  };
}
