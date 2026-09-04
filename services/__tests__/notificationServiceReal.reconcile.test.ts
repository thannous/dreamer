import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { NotificationSettings } from '@/lib/types';
import {
  DREAMER_OCCURRENCE_ID_KEY,
  DREAMER_OFFSET_KEY,
  DREAMER_OWNER_KEY,
  DREAMER_REMINDER_TYPE_KEY,
  DREAMER_SIGNATURE_KEY,
  DREAMER_TIME_ZONE_KEY,
  LUCID_TRAINER_NOTIFICATION_OWNER,
  buildDreamerNotificationContentData,
  buildDreamerNotificationPlan,
  type DreamerTimeContext,
} from '@/lib/dreamerNotifications';

const mockNotifications = {
  scheduleNotificationAsync: jest.fn(async () => 'id'),
  getAllScheduledNotificationsAsync: jest.fn(async () => [] as any[]),
  cancelScheduledNotificationAsync: jest.fn(async () => undefined),
  cancelAllScheduledNotificationsAsync: jest.fn(async () => undefined),
  setNotificationChannelAsync: jest.fn(async () => undefined),
  getPermissionsAsync: jest.fn(async () => ({ granted: true, status: 'granted' })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: true, status: 'granted' })),
  setNotificationHandler: jest.fn(),
  AndroidImportance: { HIGH: 4 },
  AndroidNotificationPriority: { HIGH: 'high', DEFAULT: 'default' },
  SchedulableTriggerInputTypes: { WEEKLY: 'weekly', TIME_INTERVAL: 'timeInterval', DATE: 'date' },
  IosAuthorizationStatus: { AUTHORIZED: 2, PROVISIONAL: 3, EPHEMERAL: 4 },
};

jest.mock('expo-notifications', () => mockNotifications);
jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));
jest.mock('@/lib/i18n', () => ({
  getTranslator: () => (key: string) => key,
  loadTranslations: jest.fn(async () => ({})),
}));
jest.mock('@/services/storageService', () => ({
  getLanguagePreference: jest.fn(async () => 'auto'),
  getNotificationSettings: jest.fn(async () => ({
    weekdayEnabled: false,
    weekdayTime: '07:00',
    weekendEnabled: false,
    weekendTime: '10:00',
  })),
}));
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'en' }],
}));

const settings: NotificationSettings = {
  weekdayEnabled: true,
  weekdayTime: '07:00',
  weekendEnabled: false,
  weekendTime: '10:00',
  weeklyRecapEnabled: true,
  streakRiskEnabled: true,
  inactivityNudgeEnabled: false,
};

const PARIS_CEST: DreamerTimeContext = { timeZone: 'Europe/Paris', offsetMinutes: -120 };
const PARIS_CET: DreamerTimeContext = { timeZone: 'Europe/Paris', offsetMinutes: -60 };
const NOW = Date.UTC(2026, 2, 28, 12, 0, 0);
const IN_TWO_HOURS = NOW + 2 * 60 * 60 * 1000;

const scheduled = (identifier: string, data: Record<string, unknown>, title = 'x') => ({
  identifier,
  content: { title, data },
});

describe('reconcileDreamerReminders', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNotifications.getAllScheduledNotificationsAsync.mockResolvedValue([]);
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
  });

  it('rebuilds wall-clock reminders across a DST offset change and never cancels Lucid', async () => {
    const desired = buildDreamerNotificationPlan({
      settings,
      timeContext: PARIS_CEST,
      now: NOW,
      streakRisk: { triggerAt: IN_TWO_HOURS, streakLength: 3 },
    });
    const monday = desired.find((item) => item.occurrenceId === 'daily:weekday:2');
    if (!monday) throw new Error('expected weekday occurrence');

    mockNotifications.getAllScheduledNotificationsAsync.mockResolvedValue([
      scheduled('dreamer-mon', buildDreamerNotificationContentData(monday, PARIS_CEST)),
      scheduled('lucid-night', {
        [DREAMER_OWNER_KEY]: LUCID_TRAINER_NOTIFICATION_OWNER,
        url: '/lucid/(tabs)/night',
      }),
      scheduled('legacy-ritual', { url: '/recording', ritualId: 'starter' }, "Today's ritual"),
    ]);

    const { reconcileDreamerReminders } = require('../notificationServiceReal') as typeof import('../notificationServiceReal');
    const result = await reconcileDreamerReminders({
      settings,
      now: NOW,
      timeContext: PARIS_CET,
      streakRisk: { triggerAt: IN_TWO_HOURS, streakLength: 3 },
    });

    expect(result.timeContextChanged).toBe(true);
    expect(result.cancelledIds).toEqual(expect.arrayContaining(['dreamer-mon', 'legacy-ritual']));
    expect(result.cancelledIds).not.toContain('lucid-night');
    expect(mockNotifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(mockNotifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith('lucid-night');
  });

  it('preserves enabled optional families when the caller does not recompute them', async () => {
    const desired = buildDreamerNotificationPlan({
      settings,
      timeContext: PARIS_CEST,
      now: NOW,
      streakRisk: { triggerAt: IN_TWO_HOURS, streakLength: 4 },
    });
    const streak = desired.find((item) => item.reminderType === 'streak_risk');
    if (!streak) throw new Error('expected streak occurrence');

    mockNotifications.getAllScheduledNotificationsAsync.mockResolvedValue([
      scheduled('keep-streak', buildDreamerNotificationContentData(streak, PARIS_CEST)),
    ]);

    const { reconcileDreamerReminders } = require('../notificationServiceReal') as typeof import('../notificationServiceReal');
    const result = await reconcileDreamerReminders({
      settings,
      now: NOW,
      timeContext: PARIS_CEST,
    });

    expect(result.cancelledIds).not.toContain('keep-streak');
    expect(mockNotifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith('keep-streak');
  });
});

describe('presentAnalysisReadyNotification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNotifications.getAllScheduledNotificationsAsync.mockResolvedValue([]);
  });

  it('deep-links to the existing journal detail screen', async () => {
    const { presentAnalysisReadyNotification } = require('../notificationServiceReal') as typeof import('../notificationServiceReal');
    await presentAnalysisReadyNotification(42);

    expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    const call = mockNotifications.scheduleNotificationAsync.mock.calls[0][0] as any;
    expect(call.content.data).toEqual(
      expect.objectContaining({
        url: '/journal/42',
        [DREAMER_REMINDER_TYPE_KEY]: 'analysis_ready',
        [DREAMER_OCCURRENCE_ID_KEY]: 'analysis_ready:42',
        [DREAMER_OWNER_KEY]: 'dreamer',
        [DREAMER_TIME_ZONE_KEY]: expect.any(String),
        [DREAMER_OFFSET_KEY]: expect.any(Number),
        [DREAMER_SIGNATURE_KEY]: expect.any(String),
        dreamId: 42,
      })
    );
    expect(call.trigger.type).toBe('timeInterval');
    expect(mockNotifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('replaces the previous occurrence for the same dream and never duplicates it', async () => {
    const existing = buildDreamerNotificationPlan({
      settings,
      timeContext: PARIS_CEST,
      now: NOW,
      analysisReady: { dreamId: 42, triggerAt: IN_TWO_HOURS },
    }).find((item) => item.reminderType === 'analysis_ready');
    if (!existing) throw new Error('expected analysis-ready occurrence');
    const later = buildDreamerNotificationPlan({
      settings,
      timeContext: PARIS_CEST,
      now: NOW,
      analysisReady: { dreamId: 91, triggerAt: IN_TWO_HOURS },
    }).find((item) => item.reminderType === 'analysis_ready');
    if (!later) throw new Error('expected later analysis-ready occurrence');

    mockNotifications.getAllScheduledNotificationsAsync.mockResolvedValue([
      scheduled('ready-42', buildDreamerNotificationContentData(existing, PARIS_CEST)),
      scheduled('ready-42-dup', buildDreamerNotificationContentData(existing, PARIS_CEST)),
      scheduled('ready-91', buildDreamerNotificationContentData(later, PARIS_CEST)),
      scheduled('lucid-night', {
        [DREAMER_OWNER_KEY]: LUCID_TRAINER_NOTIFICATION_OWNER,
        url: '/lucid/(tabs)/night',
      }),
    ]);

    const { presentAnalysisReadyNotification } = require('../notificationServiceReal') as typeof import('../notificationServiceReal');
    await presentAnalysisReadyNotification(42);

    expect(mockNotifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('ready-42');
    expect(mockNotifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('ready-42-dup');
    expect(mockNotifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith('ready-91');
    expect(mockNotifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith('lucid-night');
    expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  });
});

describe('reconcileDreamerReminders analysis_ready obsolescence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNotifications.getAllScheduledNotificationsAsync.mockResolvedValue([]);
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
  });

  it('cancels a ready notice for a deleted or no-longer-ready dream without touching Lucid or morning families', async () => {
    const ready = buildDreamerNotificationPlan({
      settings,
      timeContext: PARIS_CEST,
      now: NOW,
      analysisReady: { dreamId: 42, triggerAt: IN_TWO_HOURS },
    }).find((item) => item.reminderType === 'analysis_ready');
    const later = buildDreamerNotificationPlan({
      settings,
      timeContext: PARIS_CEST,
      now: NOW,
      analysisReady: { dreamId: 91, triggerAt: IN_TWO_HOURS },
    }).find((item) => item.reminderType === 'analysis_ready');
    const monday = buildDreamerNotificationPlan({
      settings,
      timeContext: PARIS_CEST,
      now: NOW,
    }).find((item) => item.occurrenceId === 'daily:weekday:2');
    if (!ready || !later || !monday) throw new Error('expected occurrences');

    mockNotifications.getAllScheduledNotificationsAsync.mockResolvedValue([
      scheduled('ready-42', buildDreamerNotificationContentData(ready, PARIS_CEST)),
      scheduled('ready-91', buildDreamerNotificationContentData(later, PARIS_CEST)),
      scheduled('dreamer-mon', buildDreamerNotificationContentData(monday, PARIS_CEST)),
      scheduled('lucid-night', {
        [DREAMER_OWNER_KEY]: LUCID_TRAINER_NOTIFICATION_OWNER,
        url: '/lucid/(tabs)/night',
      }),
    ]);

    const { reconcileDreamerReminders } = require('../notificationServiceReal') as typeof import('../notificationServiceReal');
    const result = await reconcileDreamerReminders({
      settings,
      now: NOW,
      timeContext: PARIS_CEST,
      analysisReadyJournal: [
        { id: 91, analysisStatus: 'done' },
        { id: 7, analysisStatus: 'pending' },
      ],
    });

    expect(result.cancelledIds).toEqual(expect.arrayContaining(['ready-42']));
    expect(result.cancelledIds).not.toContain('ready-91');
    expect(result.cancelledIds).not.toContain('dreamer-mon');
    expect(result.cancelledIds).not.toContain('lucid-night');
    expect(mockNotifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith('lucid-night');
  });

  it('cancels every ready notice when preserveAnalysisReady is false', async () => {
    const ready = buildDreamerNotificationPlan({
      settings,
      timeContext: PARIS_CEST,
      now: NOW,
      analysisReady: { dreamId: 42, triggerAt: IN_TWO_HOURS },
    }).find((item) => item.reminderType === 'analysis_ready');
    if (!ready) throw new Error('expected analysis-ready occurrence');

    mockNotifications.getAllScheduledNotificationsAsync.mockResolvedValue([
      scheduled('ready-42', buildDreamerNotificationContentData(ready, PARIS_CEST)),
      scheduled('lucid-night', {
        [DREAMER_OWNER_KEY]: LUCID_TRAINER_NOTIFICATION_OWNER,
        url: '/lucid/(tabs)/night',
      }),
    ]);

    const { reconcileDreamerReminders } = require('../notificationServiceReal') as typeof import('../notificationServiceReal');
    const result = await reconcileDreamerReminders({
      settings,
      now: NOW,
      timeContext: PARIS_CEST,
      preserveAnalysisReady: false,
    });

    expect(result.cancelledIds).toEqual(expect.arrayContaining(['ready-42']));
    expect(result.cancelledIds).not.toContain('lucid-night');
  });
});
