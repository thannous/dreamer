import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { NotificationSettings } from '@/lib/types';

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

const baseSettings: NotificationSettings = {
  weekdayEnabled: true,
  weekdayTime: '07:00',
  weekendEnabled: true,
  weekendTime: '10:00',
};

const quietSettings: NotificationSettings = {
  weekdayEnabled: false,
  weekdayTime: '07:00',
  weekendEnabled: false,
  weekendTime: '10:00',
  weeklyRecapEnabled: false,
  streakRiskEnabled: false,
  inactivityNudgeEnabled: false,
};

const IN_TWO_HOURS = () => Date.now() + 2 * 60 * 60 * 1000;

/** A reminder request as `getAllScheduledNotificationsAsync` returns it. */
const scheduled = (identifier: string, data: Record<string, unknown>, title = 'x') => ({
  identifier,
  content: { title, data },
});

describe('scheduleStreakRiskReminder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNotifications.getAllScheduledNotificationsAsync.mockResolvedValue([]);
  });

  it('schedules a single dated reminder carrying the streak length', async () => {
    const { scheduleStreakRiskReminder } = require('../notificationServiceReal') as typeof import('../notificationServiceReal');
    const triggerAt = IN_TWO_HOURS();

    await scheduleStreakRiskReminder(
      { ...quietSettings, streakRiskEnabled: true },
      { triggerAt, streakLength: 5 }
    );

    expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    const call = mockNotifications.scheduleNotificationAsync.mock.calls[0][0] as any;
    expect(call.trigger).toEqual({
      type: 'date',
      date: new Date(triggerAt),
      channelId: 'dream-reminders',
    });
    expect(call.content.title).toBe('notifications.streak_risk.title');
    expect(call.content.body).toBe('notifications.streak_risk.body');
    expect(call.content.data).toEqual(
      expect.objectContaining({
        url: '/recording',
        dreamerReminderType: 'streak_risk',
        noctaliaNotificationOwner: 'dreamer',
        dreamerReminderOccurrenceId: 'streak_risk:once',
      })
    );
  });

  it('cancels the previous streak reminder without touching the other families', async () => {
    mockNotifications.getAllScheduledNotificationsAsync.mockResolvedValue([
      scheduled('streak-old', { dreamerReminderType: 'streak_risk' }),
      scheduled('daily', { dreamerReminderType: 'daily' }),
      scheduled('recap', { dreamerReminderType: 'weekly_recap' }),
      scheduled('ritual', { dreamerReminderType: 'ritual' }),
      scheduled('inactivity', { dreamerReminderType: 'inactivity' }),
    ]);

    const { scheduleStreakRiskReminder } = require('../notificationServiceReal') as typeof import('../notificationServiceReal');
    await scheduleStreakRiskReminder(
      { ...baseSettings, streakRiskEnabled: true },
      { triggerAt: IN_TWO_HOURS(), streakLength: 2 }
    );

    expect(mockNotifications.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(1);
    expect(mockNotifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('streak-old');
  });

  it('never sweeps a legacy daily reminder that predates the family marker', async () => {
    mockNotifications.getAllScheduledNotificationsAsync.mockResolvedValue([
      scheduled('legacy-daily', { url: '/recording' }, 'Dream Journal Reminder'),
    ]);

    const { scheduleStreakRiskReminder } = require('../notificationServiceReal') as typeof import('../notificationServiceReal');
    await scheduleStreakRiskReminder(
      { ...baseSettings, streakRiskEnabled: true },
      { triggerAt: IN_TWO_HOURS(), streakLength: 2 }
    );

    expect(mockNotifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
  });

  it('cancels and schedules nothing when the toggle is off', async () => {
    mockNotifications.getAllScheduledNotificationsAsync.mockResolvedValue([
      scheduled('streak-old', { dreamerReminderType: 'streak_risk' }),
    ]);

    const { scheduleStreakRiskReminder } = require('../notificationServiceReal') as typeof import('../notificationServiceReal');
    await scheduleStreakRiskReminder(
      { ...quietSettings, streakRiskEnabled: false },
      { triggerAt: IN_TWO_HOURS(), streakLength: 4 }
    );

    expect(mockNotifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('streak-old');
    expect(mockNotifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('schedules nothing for a null plan', async () => {
    const { scheduleStreakRiskReminder } = require('../notificationServiceReal') as typeof import('../notificationServiceReal');
    await scheduleStreakRiskReminder({ ...quietSettings, streakRiskEnabled: true }, null);

    expect(mockNotifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('refuses a trigger already in the past instead of firing immediately', async () => {
    const { scheduleStreakRiskReminder } = require('../notificationServiceReal') as typeof import('../notificationServiceReal');
    await scheduleStreakRiskReminder(
      { ...quietSettings, streakRiskEnabled: true },
      { triggerAt: Date.now() - 1000, streakLength: 3 }
    );

    expect(mockNotifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });
});

describe('scheduleInactivityReminders', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNotifications.getAllScheduledNotificationsAsync.mockResolvedValue([]);
  });

  it('gives the J+3 and J+7 stages distinct copy', async () => {
    const { scheduleInactivityReminders } = require('../notificationServiceReal') as typeof import('../notificationServiceReal');
    const day3 = IN_TWO_HOURS();
    const day7 = day3 + 4 * 24 * 60 * 60 * 1000;

    await scheduleInactivityReminders({ ...baseSettings, inactivityNudgeEnabled: true }, [
      { stage: 3, triggerAt: day3 },
      { stage: 7, triggerAt: day7 },
    ]);

    expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
    const [first, second] = mockNotifications.scheduleNotificationAsync.mock.calls.map(
      (call: unknown[]) => call[0] as any
    );
    expect(first.content.title).toBe('notifications.inactivity.day3.title');
    expect(first.content.body).toBe('notifications.inactivity.day3.body');
    expect(first.content.data).toEqual(
      expect.objectContaining({
        url: '/recording',
        dreamerReminderType: 'inactivity',
        inactivityStage: 3,
        noctaliaNotificationOwner: 'dreamer',
      })
    );
    expect(second.content.title).toBe('notifications.inactivity.day7.title');
    expect(second.content.body).toBe('notifications.inactivity.day7.body');
    expect(second.trigger).toEqual({ type: 'date', date: new Date(day7), channelId: 'dream-reminders' });
    expect(first.content.title).not.toBe(second.content.title);
  });

  it('cancels only the inactivity family', async () => {
    mockNotifications.getAllScheduledNotificationsAsync.mockResolvedValue([
      scheduled('inactivity-a', { dreamerReminderType: 'inactivity' }),
      scheduled('inactivity-b', { dreamerReminderType: 'inactivity' }),
      scheduled('streak', { dreamerReminderType: 'streak_risk' }),
      scheduled('daily', { dreamerReminderType: 'daily' }),
    ]);

    const { scheduleInactivityReminders } = require('../notificationServiceReal') as typeof import('../notificationServiceReal');
    await scheduleInactivityReminders({ ...baseSettings, inactivityNudgeEnabled: true }, []);

    expect(
      mockNotifications.cancelScheduledNotificationAsync.mock.calls.map(
        (call: unknown[]) => call[0]
      )
    ).toEqual([
      'inactivity-a',
      'inactivity-b',
    ]);
    expect(mockNotifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('schedules nothing when the toggle is off', async () => {
    const { scheduleInactivityReminders } = require('../notificationServiceReal') as typeof import('../notificationServiceReal');
    await scheduleInactivityReminders({ ...baseSettings, inactivityNudgeEnabled: false }, [
      { stage: 3, triggerAt: IN_TWO_HOURS() },
    ]);

    expect(mockNotifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });
});
