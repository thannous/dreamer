import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { canonicalLucidJson } from '@/lib/lucid/domain';
import {
  LUCID_AUDIO_SAFETY_RULES,
  LUCID_NIGHT_SOUND_FILES,
  LUCID_NIGHT_SOUND_IDS,
  MAX_LUCID_NIGHT_VOLUME,
  getLucidNightVolumeBand,
  type LucidNightSignalPlan,
  type LucidNightSoundId,
  type LucidNightVolumeBand,
} from '@/lib/lucid/audio';
import { isLucidLocalTime, isLucidTimeZone } from '@/lib/lucid/model';
import {
  isSafeLucidNotificationRoute,
  type LucidNotificationRoute,
} from '@/lib/lucid/routes';

export const LUCID_TRAINER_NOTIFICATION_CHANNEL_ID = 'lucid-trainer-reminders';
export const LUCID_TRAINER_NOTIFICATION_OWNER = 'lucid-trainer';
export const LUCID_NIGHT_CUE_NOTIFICATION_CHANNEL_IDS: Readonly<
  Record<LucidNightSoundId, Readonly<Record<LucidNightVolumeBand, string>>>
> = {
  rain: {
    very_low: 'lucid-night-cue-rain-very-low-v1',
    low: 'lucid-night-cue-rain-low-v1',
    gentle: 'lucid-night-cue-rain-gentle-v1',
  },
  ocean: {
    very_low: 'lucid-night-cue-ocean-very-low-v1',
    low: 'lucid-night-cue-ocean-low-v1',
    gentle: 'lucid-night-cue-ocean-gentle-v1',
  },
  'brown-noise': {
    very_low: 'lucid-night-cue-brown-noise-very-low-v1',
    low: 'lucid-night-cue-brown-noise-low-v1',
    gentle: 'lucid-night-cue-brown-noise-gentle-v1',
  },
};

const OWNER_DATA_KEY = 'noctaliaNotificationOwner';
const KIND_DATA_KEY = 'lucidNotificationKind';
const FAMILY_DATA_KEY = 'lucidReminderFamily';
const REMINDER_ID_DATA_KEY = 'lucidReminderId';
const OCCURRENCE_ID_DATA_KEY = 'lucidReminderOccurrenceId';
const SIGNATURE_DATA_KEY = 'lucidReminderSignature';
const TIME_ZONE_DATA_KEY = 'lucidReminderTimeZone';
const OFFSET_DATA_KEY = 'lucidReminderOffsetMinutes';
const NIGHT_SESSION_ID_DATA_KEY = 'lucidNightSessionId';
const NIGHT_SESSION_START_DATA_KEY = 'lucidNightSessionStartAt';
const NIGHT_CUE_ID_DATA_KEY = 'lucidNightCueId';
const NIGHT_CUE_START_DATA_KEY = 'lucidNightCueStartsAt';
const NIGHT_CUE_STOP_DATA_KEY = 'lucidNightCueStopAt';
const NIGHT_TIMER_END_DATA_KEY = 'lucidNightTimerEndsAt';
const NIGHT_SOUND_ID_DATA_KEY = 'lucidNightSoundId';
const NIGHT_SOUND_FILE_DATA_KEY = 'lucidNightSoundFile';
const NIGHT_VOLUME_DATA_KEY = 'lucidNightVolume';
const NIGHT_VOLUME_BAND_DATA_KEY = 'lucidNightVolumeBand';

const REMINDER_NOTIFICATION_KIND = 'reminder';
const NIGHT_CUE_NOTIFICATION_KIND = 'night_cue';

export type LucidReminderFamily =
  | 'reality_check'
  | 'bedtime'
  | 'wbtb'
  | 'morning_review';

export interface LucidReminderDefinition {
  id: string;
  family: LucidReminderFamily;
  enabled: boolean;
  weekdays: number[];
  time: string;
  title: string;
  body: string;
  url: LucidNotificationRoute;
  sound?: boolean;
}

export interface LucidReminderPlan {
  version: 1;
  timeZone: string;
  reminders: LucidReminderDefinition[];
}

export type LucidNotificationPermission =
  | 'granted'
  | 'denied'
  | 'undetermined'
  | 'unsupported';

export interface LucidNotificationPermissionResult {
  status: LucidNotificationPermission;
  canAskAgain: boolean;
}

export interface LucidNotificationAdapter {
  platform: 'android' | 'ios' | 'web' | 'other';
  getPermissions(): Promise<Notifications.NotificationPermissionsStatus>;
  requestPermissions(): Promise<Notifications.NotificationPermissionsStatus>;
  configureChannel(): Promise<void>;
  configureNightCueChannel(
    soundId: LucidNightSoundId,
    volumeBand: LucidNightVolumeBand
  ): Promise<void>;
  getScheduled(): Promise<Notifications.NotificationRequest[]>;
  schedule(request: Notifications.NotificationRequestInput): Promise<string>;
  cancel(identifier: string): Promise<void>;
}

export interface ReconcileLucidReminderOptions {
  adapter?: LucidNotificationAdapter;
  requestPermissionIfNeeded?: boolean;
  now?: number;
  timeZoneOffsetMinutes?: number;
}

export interface LucidReminderReconciliationResult {
  permission: LucidNotificationPermission;
  canAskAgain: boolean;
  scheduledIds: string[];
  cancelledIds: string[];
  unchangedOccurrenceIds: string[];
  timeContextChanged: boolean;
}

export interface LucidNightCueNotificationContent {
  title: string;
  body: string;
  url: LucidNotificationRoute;
}

export interface ScheduleLucidNightCuesOptions {
  adapter?: LucidNotificationAdapter;
  requestPermissionIfNeeded?: boolean;
  now?: number;
  content: LucidNightCueNotificationContent;
}

export interface LucidNightCueScheduleResult {
  permission: LucidNotificationPermission;
  canAskAgain: boolean;
  sessionId: string;
  scheduledIds: string[];
  cancelledIds: string[];
  skippedCueIds: string[];
}

export interface RestoreLucidNightCueOptions {
  adapter?: LucidNotificationAdapter;
  now?: number;
}

type DesiredOccurrence = {
  occurrenceId: string;
  signature: string;
  reminder: LucidReminderDefinition;
  weekday: number;
};

function platformName(): LucidNotificationAdapter['platform'] {
  if (Platform.OS === 'android' || Platform.OS === 'ios' || Platform.OS === 'web') {
    return Platform.OS;
  }
  return 'other';
}

export const expoLucidNotificationAdapter: LucidNotificationAdapter = {
  platform: platformName(),
  getPermissions: Notifications.getPermissionsAsync,
  requestPermissions: () =>
    Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: false, allowSound: true },
    }),
  configureChannel: async () => {
    if (Platform.OS !== 'android') return;
    await Notifications.setNotificationChannelAsync(LUCID_TRAINER_NOTIFICATION_CHANNEL_ID, {
      name: 'Lucid Trainer reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 150],
    });
  },
  configureNightCueChannel: async (soundId, volumeBand) => {
    if (Platform.OS !== 'android') return;
    await Notifications.setNotificationChannelAsync(
      LUCID_NIGHT_CUE_NOTIFICATION_CHANNEL_IDS[soundId][volumeBand],
      {
        name: `Lucid Trainer night cue — ${soundId} — ${volumeBand}`,
        description: 'Optional, brief and low-intensity lucid dreaming cue.',
        importance: Notifications.AndroidImportance.DEFAULT,
        enableVibrate: false,
        vibrationPattern: [0],
        showBadge: false,
        sound: LUCID_NIGHT_SOUND_FILES[soundId][volumeBand],
      }
    );
  },
  getScheduled: Notifications.getAllScheduledNotificationsAsync,
  schedule: Notifications.scheduleNotificationAsync,
  cancel: Notifications.cancelScheduledNotificationAsync,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function allowsNotifications(permission: Notifications.NotificationPermissionsStatus): boolean {
  const iosStatus = permission.ios?.status;
  return (
    permission.granted ||
    permission.status === 'granted' ||
    iosStatus === Notifications.IosAuthorizationStatus.AUTHORIZED ||
    iosStatus === Notifications.IosAuthorizationStatus.PROVISIONAL ||
    iosStatus === Notifications.IosAuthorizationStatus.EPHEMERAL
  );
}

export function normalizeLucidNotificationPermission(
  permission: Notifications.NotificationPermissionsStatus
): LucidNotificationPermissionResult {
  if (allowsNotifications(permission)) {
    return { status: 'granted', canAskAgain: permission.canAskAgain };
  }
  if (permission.status === 'denied' || permission.canAskAgain === false) {
    return { status: 'denied', canAskAgain: permission.canAskAgain };
  }
  return { status: 'undetermined', canAskAgain: permission.canAskAgain };
}

function assertReminderPlan(plan: LucidReminderPlan): void {
  if (
    plan.version !== 1 ||
    !isLucidTimeZone(plan.timeZone) ||
    !Array.isArray(plan.reminders) ||
    plan.reminders.length > 64
  ) {
    throw new Error('Invalid Lucid Trainer reminder plan');
  }

  const ids = new Set<string>();
  for (const reminder of plan.reminders) {
    if (
      typeof reminder.id !== 'string' ||
      !reminder.id.trim() ||
      reminder.id.length > 128 ||
      ids.has(reminder.id) ||
      !['reality_check', 'bedtime', 'wbtb', 'morning_review'].includes(reminder.family) ||
      typeof reminder.enabled !== 'boolean' ||
      !Array.isArray(reminder.weekdays) ||
      reminder.weekdays.some((weekday) => !Number.isInteger(weekday) || weekday < 1 || weekday > 7) ||
      new Set(reminder.weekdays).size !== reminder.weekdays.length ||
      !isLucidLocalTime(reminder.time) ||
      typeof reminder.title !== 'string' ||
      !reminder.title.trim() ||
      reminder.title.length > 160 ||
      typeof reminder.body !== 'string' ||
      !reminder.body.trim() ||
      reminder.body.length > 500 ||
      !isSafeLucidNotificationRoute(reminder.url)
    ) {
      throw new Error('Invalid Lucid Trainer reminder definition');
    }
    ids.add(reminder.id);
  }
}

function getNotificationData(
  request: Notifications.NotificationRequest
): Record<string, unknown> | null {
  return isRecord(request.content.data) ? request.content.data : null;
}

function isOwnedNotification(request: Notifications.NotificationRequest): boolean {
  return getNotificationData(request)?.[OWNER_DATA_KEY] === LUCID_TRAINER_NOTIFICATION_OWNER;
}

function isNightCueNotification(request: Notifications.NotificationRequest): boolean {
  return (
    isOwnedNotification(request) &&
    getNotificationData(request)?.[KIND_DATA_KEY] === NIGHT_CUE_NOTIFICATION_KIND
  );
}

function isReminderNotification(request: Notifications.NotificationRequest): boolean {
  return isOwnedNotification(request) && !isNightCueNotification(request);
}

function getOwnedString(
  request: Notifications.NotificationRequest,
  key: string
): string | undefined {
  const value = getNotificationData(request)?.[key];
  return typeof value === 'string' ? value : undefined;
}

function desiredOccurrences(
  plan: LucidReminderPlan,
  timeZoneOffsetMinutes: number
): DesiredOccurrence[] {
  return plan.reminders
    .filter((reminder) => reminder.enabled)
    .flatMap((reminder) =>
      [...reminder.weekdays]
        .sort((left, right) => left - right)
        .map((weekday) => {
          const occurrenceId = `${reminder.id}:weekday:${weekday}`;
          return {
            occurrenceId,
            weekday,
            reminder,
            signature: canonicalLucidJson({
              version: plan.version,
              timeZone: plan.timeZone,
              timeZoneOffsetMinutes,
              occurrenceId,
              family: reminder.family,
              time: reminder.time,
              title: reminder.title,
              body: reminder.body,
              url: reminder.url,
              sound: reminder.sound !== false,
            }),
          };
        })
    )
    .sort((left, right) => left.occurrenceId.localeCompare(right.occurrenceId));
}

function triggerForOccurrence(
  occurrence: DesiredOccurrence,
  plan: LucidReminderPlan,
  platform: LucidNotificationAdapter['platform']
): Notifications.SchedulableNotificationTriggerInput {
  const [hour, minute] = occurrence.reminder.time.split(':').map(Number);
  if (platform === 'ios') {
    return {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      repeats: true,
      timezone: plan.timeZone,
      weekday: occurrence.weekday,
      hour,
      minute,
    };
  }
  return {
    type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
    weekday: occurrence.weekday,
    hour,
    minute,
    channelId:
      platform === 'android' ? LUCID_TRAINER_NOTIFICATION_CHANNEL_ID : undefined,
  };
}

function occurrenceRequest(
  occurrence: DesiredOccurrence,
  plan: LucidReminderPlan,
  timeZoneOffsetMinutes: number,
  platform: LucidNotificationAdapter['platform']
): Notifications.NotificationRequestInput {
  return {
    content: {
      title: occurrence.reminder.title,
      body: occurrence.reminder.body,
      sound: occurrence.reminder.sound !== false,
      priority: Notifications.AndroidNotificationPriority.DEFAULT,
      data: {
        url: occurrence.reminder.url,
        [OWNER_DATA_KEY]: LUCID_TRAINER_NOTIFICATION_OWNER,
        [KIND_DATA_KEY]: REMINDER_NOTIFICATION_KIND,
        [FAMILY_DATA_KEY]: occurrence.reminder.family,
        [REMINDER_ID_DATA_KEY]: occurrence.reminder.id,
        [OCCURRENCE_ID_DATA_KEY]: occurrence.occurrenceId,
        [SIGNATURE_DATA_KEY]: occurrence.signature,
        [TIME_ZONE_DATA_KEY]: plan.timeZone,
        [OFFSET_DATA_KEY]: timeZoneOffsetMinutes,
      },
    },
    trigger: triggerForOccurrence(occurrence, plan, platform),
  };
}

async function permissionForReconciliation(
  adapter: LucidNotificationAdapter,
  requestIfNeeded: boolean
): Promise<LucidNotificationPermissionResult> {
  if (adapter.platform === 'web') {
    return { status: 'unsupported', canAskAgain: false };
  }
  if (adapter.platform === 'android') await adapter.configureChannel();

  let permission = await adapter.getPermissions();
  let normalized = normalizeLucidNotificationPermission(permission);
  if (
    normalized.status === 'undetermined' &&
    normalized.canAskAgain &&
    requestIfNeeded
  ) {
    permission = await adapter.requestPermissions();
    normalized = normalizeLucidNotificationPermission(permission);
  }
  return normalized;
}

export async function cancelLucidTrainerReminders(
  filter: { family?: LucidReminderFamily; reminderId?: string } = {},
  adapter: LucidNotificationAdapter = expoLucidNotificationAdapter
): Promise<string[]> {
  if (adapter.platform === 'web') return [];
  const scheduled = await adapter.getScheduled();
  const matches = scheduled.filter((request) => {
    if (!isReminderNotification(request)) return false;
    if (filter.family && getOwnedString(request, FAMILY_DATA_KEY) !== filter.family) return false;
    if (filter.reminderId && getOwnedString(request, REMINDER_ID_DATA_KEY) !== filter.reminderId) {
      return false;
    }
    return true;
  });
  await Promise.all(matches.map((request) => adapter.cancel(request.identifier)));
  return matches.map((request) => request.identifier);
}

export async function reconcileLucidTrainerReminders(
  plan: LucidReminderPlan,
  options: ReconcileLucidReminderOptions = {}
): Promise<LucidReminderReconciliationResult> {
  assertReminderPlan(plan);
  const adapter = options.adapter ?? expoLucidNotificationAdapter;
  if (adapter.platform === 'web') {
    return {
      permission: 'unsupported',
      canAskAgain: false,
      scheduledIds: [],
      cancelledIds: [],
      unchangedOccurrenceIds: [],
      timeContextChanged: false,
    };
  }

  const now = options.now ?? Date.now();
  const timeZoneOffsetMinutes =
    options.timeZoneOffsetMinutes ?? new Date(now).getTimezoneOffset();
  const permission = await permissionForReconciliation(
    adapter,
    options.requestPermissionIfNeeded === true
  );
  const scheduled = await adapter.getScheduled();
  const owned = scheduled.filter(isReminderNotification);
  const timeContextChanged = owned.some((request) => {
    const data = getNotificationData(request);
    return (
      data?.[TIME_ZONE_DATA_KEY] !== plan.timeZone ||
      data?.[OFFSET_DATA_KEY] !== timeZoneOffsetMinutes
    );
  });

  if (permission.status !== 'granted') {
    await Promise.all(owned.map((request) => adapter.cancel(request.identifier)));
    return {
      permission: permission.status,
      canAskAgain: permission.canAskAgain,
      scheduledIds: [],
      cancelledIds: owned.map((request) => request.identifier),
      unchangedOccurrenceIds: [],
      timeContextChanged,
    };
  }

  const desired = desiredOccurrences(plan, timeZoneOffsetMinutes);
  const desiredById = new Map(desired.map((occurrence) => [occurrence.occurrenceId, occurrence]));
  const retainedOccurrenceIds = new Set<string>();
  const toCancel: Notifications.NotificationRequest[] = [];

  for (const request of owned) {
    const occurrenceId = getOwnedString(request, OCCURRENCE_ID_DATA_KEY);
    const signature = getOwnedString(request, SIGNATURE_DATA_KEY);
    const wanted = occurrenceId ? desiredById.get(occurrenceId) : undefined;
    if (
      wanted &&
      signature === wanted.signature &&
      !retainedOccurrenceIds.has(wanted.occurrenceId)
    ) {
      retainedOccurrenceIds.add(wanted.occurrenceId);
    } else {
      toCancel.push(request);
    }
  }

  await Promise.all(toCancel.map((request) => adapter.cancel(request.identifier)));
  const toSchedule = desired.filter(
    (occurrence) => !retainedOccurrenceIds.has(occurrence.occurrenceId)
  );
  const scheduledIds: string[] = [];
  for (const occurrence of toSchedule) {
    scheduledIds.push(
      await adapter.schedule(
        occurrenceRequest(occurrence, plan, timeZoneOffsetMinutes, adapter.platform)
      )
    );
  }

  return {
    permission: permission.status,
    canAskAgain: permission.canAskAgain,
    scheduledIds,
    cancelledIds: toCancel.map((request) => request.identifier),
    unchangedOccurrenceIds: [...retainedOccurrenceIds].sort((a, b) => a.localeCompare(b)),
    timeContextChanged,
  };
}

function isFiniteAbsoluteTime(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 0
  );
}

function assertNightCueContent(content: LucidNightCueNotificationContent): void {
  if (
    typeof content.title !== 'string' ||
    !content.title.trim() ||
    content.title.length > 160 ||
    typeof content.body !== 'string' ||
    !content.body.trim() ||
    content.body.length > 500 ||
    !isSafeLucidNotificationRoute(content.url)
  ) {
    throw new Error('Invalid Lucid Trainer night cue content');
  }
}

function assertNightSignalPlan(plan: LucidNightSignalPlan): void {
  if (
    typeof plan.sessionId !== 'string' ||
    plan.sessionId !== `lucid-night-${plan.sessionStartAt}` ||
    !isFiniteAbsoluteTime(plan.sessionStartAt) ||
    !isFiniteAbsoluteTime(plan.timerEndsAt) ||
    plan.timerEndsAt <= plan.sessionStartAt ||
    typeof plan.volume !== 'number' ||
    !Number.isFinite(plan.volume) ||
    plan.volume <= 0 ||
    plan.volume > MAX_LUCID_NIGHT_VOLUME ||
    !LUCID_NIGHT_SOUND_IDS.includes(plan.soundId) ||
    plan.volumeBand !== getLucidNightVolumeBand(plan.volume) ||
    plan.soundFile !== LUCID_NIGHT_SOUND_FILES[plan.soundId][plan.volumeBand] ||
    !Array.isArray(plan.cues) ||
    plan.cues.length === 0 ||
    plan.cues.length > 4
  ) {
    throw new Error('Invalid Lucid Trainer night signal plan');
  }

  const cueIds = new Set<string>();
  for (const cue of plan.cues) {
    if (
      typeof cue.id !== 'string' ||
      !cue.id.startsWith(`${plan.sessionId}:cue:`) ||
      cueIds.has(cue.id) ||
      !Number.isInteger(cue.requestedIndex) ||
      cue.requestedIndex < 0 ||
      !isFiniteAbsoluteTime(cue.startsAt) ||
      !isFiniteAbsoluteTime(cue.stopAt) ||
      cue.startsAt <= plan.sessionStartAt ||
      cue.stopAt <= cue.startsAt ||
      cue.stopAt > plan.timerEndsAt
    ) {
      throw new Error('Invalid Lucid Trainer night cue');
    }
    cueIds.add(cue.id);
  }
}

async function permissionForNightCues(
  adapter: LucidNotificationAdapter,
  soundId: LucidNightSoundId,
  volumeBand: LucidNightVolumeBand,
  requestIfNeeded: boolean
): Promise<LucidNotificationPermissionResult> {
  if (adapter.platform === 'web') {
    return { status: 'unsupported', canAskAgain: false };
  }
  if (adapter.platform === 'android') {
    await adapter.configureNightCueChannel(soundId, volumeBand);
  }

  let permission = await adapter.getPermissions();
  let normalized = normalizeLucidNotificationPermission(permission);
  if (
    normalized.status === 'undetermined' &&
    normalized.canAskAgain &&
    requestIfNeeded
  ) {
    permission = await adapter.requestPermissions();
    normalized = normalizeLucidNotificationPermission(permission);
  }
  return normalized;
}

function nightCueRequest(
  plan: LucidNightSignalPlan,
  cue: LucidNightSignalPlan['cues'][number],
  content: LucidNightCueNotificationContent,
  platform: LucidNotificationAdapter['platform']
): Notifications.NotificationRequestInput {
  return {
    content: {
      title: content.title,
      body: content.body,
      sound: plan.soundFile,
      priority: Notifications.AndroidNotificationPriority.DEFAULT,
      vibrate: [0],
      data: {
        url: content.url,
        [OWNER_DATA_KEY]: LUCID_TRAINER_NOTIFICATION_OWNER,
        [KIND_DATA_KEY]: NIGHT_CUE_NOTIFICATION_KIND,
        [NIGHT_SESSION_ID_DATA_KEY]: plan.sessionId,
        [NIGHT_SESSION_START_DATA_KEY]: plan.sessionStartAt,
        [NIGHT_CUE_ID_DATA_KEY]: cue.id,
        [NIGHT_CUE_START_DATA_KEY]: cue.startsAt,
        [NIGHT_CUE_STOP_DATA_KEY]: cue.stopAt,
        [NIGHT_TIMER_END_DATA_KEY]: plan.timerEndsAt,
        [NIGHT_SOUND_ID_DATA_KEY]: plan.soundId,
        [NIGHT_SOUND_FILE_DATA_KEY]: plan.soundFile,
        [NIGHT_VOLUME_DATA_KEY]: plan.volume,
        [NIGHT_VOLUME_BAND_DATA_KEY]: plan.volumeBand,
        lucidNightCueRequestedIndex: cue.requestedIndex,
      },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: cue.startsAt,
      channelId:
        platform === 'android'
          ? LUCID_NIGHT_CUE_NOTIFICATION_CHANNEL_IDS[plan.soundId][plan.volumeBand]
          : undefined,
    },
  };
}

export async function cancelLucidNightCues(
  filter: { sessionId?: string } = {},
  adapter: LucidNotificationAdapter = expoLucidNotificationAdapter
): Promise<string[]> {
  if (adapter.platform === 'web') return [];
  const scheduled = await adapter.getScheduled();
  const matches = scheduled.filter((request) => {
    if (!isNightCueNotification(request)) return false;
    if (
      filter.sessionId &&
      getOwnedString(request, NIGHT_SESSION_ID_DATA_KEY) !== filter.sessionId
    ) {
      return false;
    }
    return true;
  });
  await Promise.all(matches.map((request) => adapter.cancel(request.identifier)));
  return matches.map((request) => request.identifier);
}

/** Cancels every scheduled notification owned by Lucid Trainer. */
export async function cancelAllLucidTrainerNotifications(
  adapter: LucidNotificationAdapter = expoLucidNotificationAdapter
): Promise<string[]> {
  if (adapter.platform === 'web') return [];
  const scheduled = await adapter.getScheduled();
  const owned = scheduled.filter(isOwnedNotification);
  await Promise.all(owned.map((request) => adapter.cancel(request.identifier)));
  return owned.map((request) => request.identifier);
}

export async function scheduleLucidNightCues(
  plan: LucidNightSignalPlan,
  options: ScheduleLucidNightCuesOptions
): Promise<LucidNightCueScheduleResult> {
  assertNightSignalPlan(plan);
  assertNightCueContent(options.content);
  const adapter = options.adapter ?? expoLucidNotificationAdapter;
  const now = options.now ?? Date.now();
  if (!isFiniteAbsoluteTime(now)) {
    throw new Error('Invalid Lucid Trainer night cue scheduling time');
  }
  if (adapter.platform === 'web') {
    return {
      permission: 'unsupported',
      canAskAgain: false,
      sessionId: plan.sessionId,
      scheduledIds: [],
      cancelledIds: [],
      skippedCueIds: plan.cues.map((cue) => cue.id),
    };
  }

  const permission = await permissionForNightCues(
    adapter,
    plan.soundId,
    plan.volumeBand,
    options.requestPermissionIfNeeded === true
  );
  const existing = (await adapter.getScheduled()).filter(isNightCueNotification);
  if (permission.status !== 'granted') {
    await Promise.all(existing.map((request) => adapter.cancel(request.identifier)));
    return {
      permission: permission.status,
      canAskAgain: permission.canAskAgain,
      sessionId: plan.sessionId,
      scheduledIds: [],
      cancelledIds: existing.map((request) => request.identifier),
      skippedCueIds: plan.cues.map((cue) => cue.id),
    };
  }

  const eligible =
    plan.timerEndsAt > now
      ? plan.cues.filter((cue) => cue.startsAt > now && cue.stopAt > cue.startsAt)
      : [];
  const eligibleIds = new Set(eligible.map((cue) => cue.id));
  const skippedCueIds = plan.cues
    .filter((cue) => !eligibleIds.has(cue.id))
    .map((cue) => cue.id);
  const scheduledIds: string[] = [];

  try {
    for (const cue of eligible) {
      scheduledIds.push(
        await adapter.schedule(
          nightCueRequest(plan, cue, options.content, adapter.platform)
        )
      );
    }
  } catch (error) {
    await Promise.allSettled(
      scheduledIds.map((identifier) => adapter.cancel(identifier))
    );
    throw error;
  }

  try {
    await Promise.all(existing.map((request) => adapter.cancel(request.identifier)));
  } catch (error) {
    await Promise.allSettled(
      scheduledIds.map((identifier) => adapter.cancel(identifier))
    );
    throw error;
  }
  return {
    permission: permission.status,
    canAskAgain: permission.canAskAgain,
    sessionId: plan.sessionId,
    scheduledIds,
    cancelledIds: existing.map((request) => request.identifier),
    skippedCueIds,
  };
}

type ParsedNightCue = {
  request: Notifications.NotificationRequest;
  sessionId: string;
  sessionStartAt: number;
  cueId: string;
  requestedIndex: number;
  startsAt: number;
  stopAt: number;
  timerEndsAt: number;
  soundId: LucidNightSoundId;
  soundFile: string;
  volume: number;
  volumeBand: LucidNightVolumeBand;
};

function parseScheduledNightCue(
  request: Notifications.NotificationRequest
): ParsedNightCue | null {
  if (!isNightCueNotification(request)) return null;
  const data = getNotificationData(request);
  if (!data) return null;
  const sessionId = data[NIGHT_SESSION_ID_DATA_KEY];
  const sessionStartAt = data[NIGHT_SESSION_START_DATA_KEY];
  const cueId = data[NIGHT_CUE_ID_DATA_KEY];
  const requestedIndex = data.lucidNightCueRequestedIndex;
  const startsAt = data[NIGHT_CUE_START_DATA_KEY];
  const stopAt = data[NIGHT_CUE_STOP_DATA_KEY];
  const timerEndsAt = data[NIGHT_TIMER_END_DATA_KEY];
  const soundId = data[NIGHT_SOUND_ID_DATA_KEY];
  const soundFile = data[NIGHT_SOUND_FILE_DATA_KEY];
  const volume = data[NIGHT_VOLUME_DATA_KEY];
  const volumeBand = data[NIGHT_VOLUME_BAND_DATA_KEY];

  if (
    typeof sessionId !== 'string' ||
    !isFiniteAbsoluteTime(sessionStartAt) ||
    sessionId !== `lucid-night-${sessionStartAt}` ||
    typeof cueId !== 'string' ||
    !cueId.startsWith(`${sessionId}:cue:`) ||
    !Number.isInteger(requestedIndex) ||
    (requestedIndex as number) < 0 ||
    !isFiniteAbsoluteTime(startsAt) ||
    !isFiniteAbsoluteTime(stopAt) ||
    !isFiniteAbsoluteTime(timerEndsAt) ||
    startsAt <= sessionStartAt ||
    stopAt <= startsAt ||
    timerEndsAt < stopAt ||
    !LUCID_NIGHT_SOUND_IDS.includes(soundId as LucidNightSoundId) ||
    typeof soundFile !== 'string' ||
    typeof volume !== 'number' ||
    !Number.isFinite(volume) ||
    volume <= 0 ||
    volume > MAX_LUCID_NIGHT_VOLUME ||
    volumeBand !== getLucidNightVolumeBand(volume)
  ) {
    return null;
  }
  const validSoundId = soundId as LucidNightSoundId;
  const validVolumeBand = volumeBand as LucidNightVolumeBand;
  if (soundFile !== LUCID_NIGHT_SOUND_FILES[validSoundId][validVolumeBand]) {
    return null;
  }

  return {
    request,
    sessionId,
    sessionStartAt,
    cueId,
    requestedIndex: requestedIndex as number,
    startsAt,
    stopAt,
    timerEndsAt,
    soundId: validSoundId,
    soundFile,
    volume,
    volumeBand: validVolumeBand,
  };
}

export async function restoreLucidNightSignalPlan(
  options: RestoreLucidNightCueOptions = {}
): Promise<LucidNightSignalPlan | null> {
  const adapter = options.adapter ?? expoLucidNotificationAdapter;
  if (adapter.platform === 'web') return null;
  const now = options.now ?? Date.now();
  if (!isFiniteAbsoluteTime(now)) {
    throw new Error('Invalid Lucid Trainer night cue restore time');
  }

  const scheduled = (await adapter.getScheduled()).filter(isNightCueNotification);
  const parsed: ParsedNightCue[] = [];
  const toCancel = new Map<string, Notifications.NotificationRequest>();
  for (const request of scheduled) {
    const cue = parseScheduledNightCue(request);
    if (!cue || cue.startsAt <= now || cue.timerEndsAt <= now) {
      toCancel.set(request.identifier, request);
    } else {
      parsed.push(cue);
    }
  }

  const newestSessionStartAt = parsed.reduce(
    (latest, cue) => Math.max(latest, cue.sessionStartAt),
    -1
  );
  const selected = parsed.filter((cue) => {
    if (cue.sessionStartAt === newestSessionStartAt) return true;
    toCancel.set(cue.request.identifier, cue.request);
    return false;
  });
  const first = selected[0];
  if (!first) {
    await Promise.all([...toCancel.values()].map((request) => adapter.cancel(request.identifier)));
    return null;
  }

  const cuesById = new Map<string, ParsedNightCue>();
  for (const cue of selected) {
    const consistent =
      cue.sessionId === first.sessionId &&
      cue.timerEndsAt === first.timerEndsAt &&
      cue.soundId === first.soundId &&
      cue.soundFile === first.soundFile &&
      cue.volume === first.volume &&
      cue.volumeBand === first.volumeBand;
    if (!consistent || cuesById.has(cue.cueId)) {
      toCancel.set(cue.request.identifier, cue.request);
    } else {
      cuesById.set(cue.cueId, cue);
    }
  }
  await Promise.all([...toCancel.values()].map((request) => adapter.cancel(request.identifier)));

  const cues = [...cuesById.values()]
    .sort((left, right) => left.startsAt - right.startsAt)
    .map((cue) => ({
      id: cue.cueId,
      requestedIndex: cue.requestedIndex,
      startsAt: cue.startsAt,
      stopAt: cue.stopAt,
    }));
  if (cues.length === 0) return null;

  return {
    sessionId: first.sessionId,
    sessionStartAt: first.sessionStartAt,
    timerEndsAt: first.timerEndsAt,
    volume: first.volume,
    volumeBand: first.volumeBand,
    soundId: first.soundId,
    soundFile: first.soundFile,
    cues,
    rejectedCues: [],
    safetyRules: LUCID_AUDIO_SAFETY_RULES,
  };
}
