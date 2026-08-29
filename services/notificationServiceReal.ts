import * as Notifications from 'expo-notifications';
import { getLocales } from 'expo-localization';
import { Platform } from 'react-native';

import type {
  InactivityReminderPlan,
  InactivityReminderStage,
  StreakRiskReminderPlan,
} from '@/lib/engagementReminders';
import {
  DREAMER_REMINDER_TYPE_KEY,
  RECORDING_NOTIFICATION_URL,
  WEEKLY_RECAP_NOTIFICATION_URL,
  WEEKLY_RECAP_TIME,
  WEEKLY_RECAP_WEEKDAY,
  buildDreamerNotificationContentData,
  buildDreamerNotificationPlan,
  normalizeNotificationSettings,
  reconcileDreamerNotificationPlan,
  resolveDreamerTimeContext,
  type DreamerReminderType,
  type DreamerDesiredOccurrence,
  type DreamerScheduledRequest,
  type DreamerTimeContext,
} from '@/lib/dreamerNotifications';
import { getTranslator, loadTranslations } from '@/lib/i18n';
import { normalizeAppLanguage, resolveEffectiveLanguage } from '@/lib/language';
import type { RitualId } from '@/lib/inspirationRituals';
import type { LanguagePreference, NotificationSettings } from '@/lib/types';
import { getLanguagePreference, getNotificationSettings } from '@/services/storageService';

// Array of smart, motivational notification prompt keys
const NOTIFICATION_PROMPT_KEYS = [
  'notifications.prompt.morning_1',
  'notifications.prompt.morning_2',
  'notifications.prompt.morning_3',
  'notifications.prompt.morning_4',
  'notifications.prompt.morning_5',
  'notifications.prompt.morning_6',
  'notifications.prompt.morning_7',
  'notifications.prompt.morning_8',
  'notifications.prompt.morning_9',
  'notifications.prompt.morning_10',
  'notifications.prompt.morning_11',
  'notifications.prompt.morning_12',
  'notifications.prompt.morning_13',
  'notifications.prompt.morning_14',
  'notifications.prompt.morning_15',
];

// Notification channel for Android
const NOTIFICATION_CHANNEL_ID = 'dream-reminders';

/** Sunday, 10:00 local: late enough for a lie-in, early enough to plan the week. */
export const WEEKLY_RECAP_URL = WEEKLY_RECAP_NOTIFICATION_URL;
export { WEEKLY_RECAP_TIME, WEEKLY_RECAP_WEEKDAY };

type NotificationTranslator = ReturnType<typeof getTranslator>;

/**
 * Resolve the user's chosen language (stored preference, 'auto' → system
 * language) and return a translator with that pack already loaded.
 * Falls back to English when storage or locale detection fails.
 */
async function getNotificationTranslator(): Promise<NotificationTranslator> {
  let preference: LanguagePreference = 'auto';
  try {
    preference = await getLanguagePreference();
  } catch {
    // Keep 'auto' and fall back to the system language below.
  }

  const systemLanguage = normalizeAppLanguage(getLocales()[0]?.languageCode);
  const language = resolveEffectiveLanguage(preference, systemLanguage);
  await loadTranslations(language);
  return getTranslator(language);
}

const getTimeParts = (time: string): { hours: number; minutes: number } => {
  const [hours, minutes] = time.split(':').map(Number);
  return { hours, minutes };
};

function toDreamerScheduledRequest(
  request: Notifications.NotificationRequest
): DreamerScheduledRequest {
  return {
    identifier: request.identifier,
    title: request.content.title ?? undefined,
    data: request.content.data,
  };
}

function currentTimeContext(now = Date.now()): DreamerTimeContext {
  return resolveDreamerTimeContext({ now });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function matchesReminderType(
  request: Notifications.NotificationRequest,
  reminderType: DreamerReminderType | 'ritual'
): boolean {
  const data = request.content.data;
  if (isRecord(data) && (data[DREAMER_REMINDER_TYPE_KEY] === reminderType)) {
    return true;
  }

  const legacyUrl = isRecord(data) ? data.url : undefined;
  const legacyRitualId = isRecord(data) ? data.ritualId : undefined;
  const legacyIsTest = isRecord(data) ? data.test : undefined;

  if (reminderType === 'ritual') {
    return typeof legacyRitualId === 'string';
  }

  // Only 'daily' and 'ritual' ever shipped without the marker: without this
  // guard, cancelling a newer family would sweep away legacy daily reminders.
  if (reminderType !== 'daily') {
    return false;
  }

  return (
    request.content.title === 'Dream Journal Reminder' &&
    legacyUrl === RECORDING_NOTIFICATION_URL &&
    legacyRitualId == null &&
    legacyIsTest !== true
  );
}

async function cancelScheduledReminders(
  reminderType: DreamerReminderType | 'ritual'
): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const identifiers = scheduled
    .filter((request) => matchesReminderType(request, reminderType))
    .map((request) => request.identifier);

  await Promise.all(identifiers.map((id) => Notifications.cancelScheduledNotificationAsync(id)));

  if (__DEV__) {
    console.log(`Cancelled ${identifiers.length} scheduled ${reminderType} reminders`);
  }
}

/**
 * One-shot reminder fired at an exact local instant. Used by the engagement
 * families, whose deadline is a specific evening rather than a weekly rhythm.
 */
async function scheduleDatedReminder(params: {
  triggerAt: number;
  content: Notifications.NotificationContentInput;
}): Promise<void> {
  if (params.triggerAt <= Date.now()) {
    // Defensive: expo fires a past DATE trigger immediately, which would turn a
    // stale plan into an unexpected buzz.
    return;
  }

  await Notifications.scheduleNotificationAsync({
    content: params.content,
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(params.triggerAt),
      channelId: NOTIFICATION_CHANNEL_ID,
    },
  });
}

/**
 * Normalize permission status across platforms (handles iOS provisional/ephemeral)
 */
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

/**
 * Configure default notification behavior
 */
export function configureNotificationHandler(): void {
  if (Platform.OS === 'web') {
    return;
  }

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

/**
 * Request notification permissions from the user
 * Returns true if granted, false otherwise
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') {
    // Web notifications require different handling
    return false;
  }

  // Android 13+ only shows the notification permission prompt after at least
  // one notification channel exists. Create it before reading or requesting
  // permissions so first-run users can actually receive the system prompt.
  if (Platform.OS === 'android') {
    const t = await getNotificationTranslator();
    await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL_ID, {
      name: t('notifications.channel_name'),
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF6B6B',
    });
  }

  const existingPermissions = await Notifications.getPermissionsAsync();
  let permissionResult = existingPermissions;

  if (!allowsNotifications(existingPermissions)) {
    permissionResult = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });
  }

  const isGranted = allowsNotifications(permissionResult);

  return isGranted;
}

/**
 * Get a random notification prompt from the array
 */
function getRandomPrompt(t: NotificationTranslator): string {
  const randomIndex = Math.floor(Math.random() * NOTIFICATION_PROMPT_KEYS.length);
  return t(NOTIFICATION_PROMPT_KEYS[randomIndex]);
}

/**
 * Pick one distinct prompt per weekday (1 = Sunday … 7 = Saturday) so the
 * repeating weekly reminders do not show the same sentence every morning.
 * The rotation is reshuffled each time the schedule is rebuilt.
 */
export function buildWeeklyPromptRotation(
  t: NotificationTranslator,
  random: () => number = Math.random
): Record<number, string> {
  const keys = [...NOTIFICATION_PROMPT_KEYS];
  for (let index = keys.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [keys[index], keys[swap]] = [keys[swap], keys[index]];
  }
  const rotation: Record<number, string> = {};
  for (let weekday = 1; weekday <= 7; weekday += 1) {
    rotation[weekday] = t(keys[(weekday - 1) % keys.length]);
  }
  return rotation;
}

function copyForOccurrence(
  t: NotificationTranslator,
  occurrence: DreamerDesiredOccurrence,
  promptByWeekday: Record<number, string>
): { title: string; body: string; priority: Notifications.AndroidNotificationPriority } {
  switch (occurrence.reminderType) {
    case 'daily':
      return {
        title: t('notifications.reminder.title'),
        body: promptByWeekday[occurrence.weekday ?? 1] ?? getRandomPrompt(t),
        priority: Notifications.AndroidNotificationPriority.HIGH,
      };
    case 'weekly_recap':
      return {
        title: t('notifications.weekly_recap.title'),
        body: t('notifications.weekly_recap.body'),
        priority: Notifications.AndroidNotificationPriority.DEFAULT,
      };
    case 'analysis_ready':
      return {
        title: t('notifications.analysis_ready.title'),
        body: t('notifications.analysis_ready.body'),
        priority: Notifications.AndroidNotificationPriority.HIGH,
      };
    case 'streak_risk':
      return {
        title: t('notifications.streak_risk.title', { count: occurrence.streakLength ?? 0 }),
        body: t('notifications.streak_risk.body', { count: occurrence.streakLength ?? 0 }),
        priority: Notifications.AndroidNotificationPriority.DEFAULT,
      };
    case 'inactivity':
      return {
        ...getInactivityCopy(t, occurrence.inactivityStage ?? 3),
        priority: Notifications.AndroidNotificationPriority.DEFAULT,
      };
  }
}

function getInactivityCopy(
  t: NotificationTranslator,
  stage: InactivityReminderStage
): { title: string; body: string } {
  const prefix = stage === 3 ? 'notifications.inactivity.day3' : 'notifications.inactivity.day7';
  return { title: t(`${prefix}.title`), body: t(`${prefix}.body`) };
}

async function scheduleOwnedOccurrence(params: {
  occurrence: DreamerDesiredOccurrence;
  timeContext: DreamerTimeContext;
  title: string;
  body: string;
  priority?: Notifications.AndroidNotificationPriority;
}): Promise<void> {
  const { occurrence, timeContext, title, body } = params;
  const content: Notifications.NotificationContentInput = {
    title,
    body,
    data: buildDreamerNotificationContentData(occurrence, timeContext),
    sound: true,
    priority: params.priority ?? Notifications.AndroidNotificationPriority.DEFAULT,
  };

  if (occurrence.weekday != null && occurrence.time) {
    const { hours, minutes } = getTimeParts(occurrence.time);
    await Notifications.scheduleNotificationAsync({
      content,
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: occurrence.weekday,
        hour: hours,
        minute: minutes,
        channelId: NOTIFICATION_CHANNEL_ID,
      },
    });
    return;
  }

  if (occurrence.triggerAt != null) {
    await scheduleDatedReminder({ triggerAt: occurrence.triggerAt, content });
  }
}

export type ReconcileDreamerRemindersInput = {
  settings?: NotificationSettings;
  now?: number;
  timeContext?: DreamerTimeContext;
  streakRisk?: StreakRiskReminderPlan | null;
  inactivity?: readonly InactivityReminderPlan[];
  analysisReady?: { dreamId: number; triggerAt?: number } | null;
  preserveAnalysisReady?: boolean;
};

export type ReconcileDreamerRemindersResult = {
  scheduledIds: string[];
  cancelledIds: string[];
  unchangedOccurrenceIds: string[];
  orphanIdentifiers: string[];
  timeContextChanged: boolean;
};

/**
 * Rebuild Dreamer-owned reminders against the current settings, journal plan
 * and device timezone/DST offset. Lucid Trainer requests are never touched.
 */
export async function reconcileDreamerReminders(
  input: ReconcileDreamerRemindersInput = {}
): Promise<ReconcileDreamerRemindersResult> {
  if (Platform.OS === 'web') {
    return {
      scheduledIds: [],
      cancelledIds: [],
      unchangedOccurrenceIds: [],
      orphanIdentifiers: [],
      timeContextChanged: false,
    };
  }

  const now = input.now ?? Date.now();
  const timeContext = input.timeContext ?? currentTimeContext(now);
  const settings = normalizeNotificationSettings(
    input.settings ?? (await getNotificationSettings())
  );
  const desired = buildDreamerNotificationPlan({
    settings,
    timeContext,
    now,
    streakRisk: input.streakRisk,
    inactivity: input.inactivity,
    analysisReady: input.analysisReady,
  });
  const scheduled = (await Notifications.getAllScheduledNotificationsAsync()).map(
    toDreamerScheduledRequest
  );
  const decision = reconcileDreamerNotificationPlan(scheduled, desired, timeContext, {
    preserveReminderTypes: [
      ...(input.preserveAnalysisReady === false ? [] : (['analysis_ready'] as DreamerReminderType[])),
      ...(input.streakRisk === undefined && settings.streakRiskEnabled
        ? (['streak_risk'] as DreamerReminderType[])
        : []),
      ...(input.inactivity === undefined && settings.inactivityNudgeEnabled
        ? (['inactivity'] as DreamerReminderType[])
        : []),
    ],
  });

  await Promise.all(
    decision.toCancel.map((identifier) => Notifications.cancelScheduledNotificationAsync(identifier))
  );

  const t = decision.toSchedule.length > 0 ? await getNotificationTranslator() : null;
  const promptByWeekday = t ? buildWeeklyPromptRotation(t) : {};
  const scheduledIds: string[] = [];
  for (const occurrence of decision.toSchedule) {
    if (!t) break;
    const copy = copyForOccurrence(t, occurrence, promptByWeekday);
    await scheduleOwnedOccurrence({
      occurrence,
      timeContext,
      title: copy.title,
      body: copy.body,
      priority: copy.priority,
    });
    scheduledIds.push(occurrence.occurrenceId);
  }

  if (__DEV__) {
    console.log(
      `Reconciled Dreamer reminders: scheduled ${scheduledIds.length}, cancelled ${decision.toCancel.length}, tzChanged=${decision.timeContextChanged}`
    );
  }

  return {
    scheduledIds,
    cancelledIds: decision.toCancel,
    unchangedOccurrenceIds: decision.unchangedOccurrenceIds,
    orphanIdentifiers: decision.orphanIdentifiers,
    timeContextChanged: decision.timeContextChanged,
  };
}

async function scheduleOwnedFamily(params: {
  settings: NotificationSettings;
  reminderType: DreamerReminderType;
  streakRisk?: StreakRiskReminderPlan | null;
  inactivity?: readonly InactivityReminderPlan[];
}): Promise<void> {
  await cancelScheduledReminders(params.reminderType);
  const normalized = normalizeNotificationSettings(params.settings);
  const timeContext = currentTimeContext();
  const desired = buildDreamerNotificationPlan({
    settings: normalized,
    timeContext,
    streakRisk: params.streakRisk,
    inactivity: params.inactivity,
  }).filter((occurrence) => occurrence.reminderType === params.reminderType);
  if (desired.length === 0) return;

  const t = await getNotificationTranslator();
  const promptByWeekday = buildWeeklyPromptRotation(t);
  for (const occurrence of desired) {
    const copy = copyForOccurrence(t, occurrence, promptByWeekday);
    await scheduleOwnedOccurrence({
      occurrence,
      timeContext,
      title: copy.title,
      body: copy.body,
      priority: copy.priority,
    });
  }
}

/**
 * Schedule daily notification based on settings
 * Uses weekly triggers so weekday/weekend toggles actually control which days fire.
 */
export async function scheduleDailyNotification(settings: NotificationSettings): Promise<void> {
  if (Platform.OS === 'web') {
    // Web notifications not supported
    return;
  }
  await scheduleOwnedFamily({ settings, reminderType: 'daily' });
}

export async function scheduleRitualReminder(settings: NotificationSettings, ritualId: RitualId): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }

  // VNext: ritual reminders are no longer a Dreamer family. Cancel leftovers
  // only; the launch/foreground reconcile still sweeps orphans later.
  void ritualId;
  void settings;
  await cancelScheduledReminders('ritual');
}

export async function sendTestNotification(): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }

  const t = await getNotificationTranslator();

  await Notifications.scheduleNotificationAsync({
    content: {
      title: t('notifications.reminder.title'),
      body: getRandomPrompt(t),
      data: { url: RECORDING_NOTIFICATION_URL, test: true },
      sound: true,
      priority: Notifications.AndroidNotificationPriority.HIGH,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 5,
    },
  });

  if (__DEV__) {
    console.log('Scheduled test notification in 5 seconds');
  }
}

/**
 * Cancel all scheduled notifications
 */
/**
 * Schedule (or cancel) the weekly "your week in dreams" recap. It repeats every
 * Sunday morning and deep-links to the recap screen. Independent from the daily
 * reminders so a user can keep one without the other.
 */
export async function scheduleWeeklyRecapReminder(settings: NotificationSettings): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }
  await scheduleOwnedFamily({ settings, reminderType: 'weekly_recap' });
}

/**
 * Schedule (or clear) the single evening reminder for a streak that would end
 * at the next local midnight. Always replaces the previous one, so saving a
 * dream simply re-runs this with a fresh plan (or `null` to cancel).
 *
 * Independent from the daily reminders, the ritual reminders and the weekly
 * recap: only the `streak_risk` family is touched.
 */
export async function scheduleStreakRiskReminder(
  settings: NotificationSettings,
  plan: StreakRiskReminderPlan | null
): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }
  await scheduleOwnedFamily({ settings, reminderType: 'streak_risk', streakRisk: plan });
}

/**
 * Schedule (or clear) the comeback reminders. The plan carries at most the two
 * stages still ahead (3 and 7 silent nights) and nothing beyond, so a dormant
 * user is nudged twice and then left alone.
 */
export async function scheduleInactivityReminders(
  settings: NotificationSettings,
  plans: readonly InactivityReminderPlan[]
): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }
  await scheduleOwnedFamily({ settings, reminderType: 'inactivity', inactivity: plans });
}

export async function cancelAllNotifications(): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }

  await Notifications.cancelAllScheduledNotificationsAsync();

  if (__DEV__) {
    console.log('Cancelled all notifications');
  }
}

/**
 * Get list of scheduled notifications (useful for debugging)
 */
export async function getScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
  if (Platform.OS === 'web') {
    return [];
  }

  return await Notifications.getAllScheduledNotificationsAsync();
}

/**
 * Check if notification permissions are granted
 */
export async function hasNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return false;
  }

  const permissions = await Notifications.getPermissionsAsync();
  return allowsNotifications(permissions);
}

/**
 * Immediate local notice that an analysis finished while the user was away.
 * Deep-links to the existing journal detail screen. No-op when the user is
 * already looking at the app: the in-app progress UI owns that moment.
 */
export async function presentAnalysisReadyNotification(dreamId: number): Promise<void> {
  if (Platform.OS === 'web' || !Number.isSafeInteger(dreamId) || dreamId <= 0) {
    return;
  }

  const t = await getNotificationTranslator();
  const timeContext = currentTimeContext();
  const desired = buildDreamerNotificationPlan({
    settings: normalizeNotificationSettings({
      weekdayEnabled: false,
      weekdayTime: '07:00',
      weekendEnabled: false,
      weekendTime: '10:00',
    }),
    timeContext,
    now: Date.now(),
    analysisReady: { dreamId, triggerAt: Date.now() + 1_000 },
  }).find((occurrence) => occurrence.reminderType === 'analysis_ready');
  if (!desired) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: t('notifications.analysis_ready.title'),
      body: t('notifications.analysis_ready.body'),
      data: buildDreamerNotificationContentData(desired, timeContext),
      sound: true,
      priority: Notifications.AndroidNotificationPriority.HIGH,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 1,
      channelId: NOTIFICATION_CHANNEL_ID,
    },
  });
}
