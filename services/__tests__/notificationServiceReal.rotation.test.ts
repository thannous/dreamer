import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockNotifications = {
  scheduleNotificationAsync: jest.fn(async () => 'id'),
  getAllScheduledNotificationsAsync: jest.fn(async () => []),
  cancelScheduledNotificationAsync: jest.fn(async () => undefined),
  cancelAllScheduledNotificationsAsync: jest.fn(async () => undefined),
  setNotificationChannelAsync: jest.fn(async () => undefined),
  getPermissionsAsync: jest.fn(async () => ({ granted: true, status: 'granted' })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: true, status: 'granted' })),
  setNotificationHandler: jest.fn(),
  AndroidImportance: { HIGH: 4 },
  AndroidNotificationPriority: { HIGH: 'high' },
  SchedulableTriggerInputTypes: { WEEKLY: 'weekly', TIME_INTERVAL: 'timeInterval' },
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
}));
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'en' }],
}));

describe('notificationServiceReal reminder rotation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('assigns a distinct prompt to each weekday', async () => {
    const { buildWeeklyPromptRotation } = require('../notificationServiceReal') as typeof import('../notificationServiceReal');
    const t = (key: string) => key;
    let seed = 0.13;
    const rotation = buildWeeklyPromptRotation(t, () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    });

    const bodies = Object.values(rotation);
    expect(bodies).toHaveLength(7);
    expect(new Set(bodies).size).toBe(7);
    bodies.forEach((body) => expect(body).toMatch(/^notifications\.prompt\.morning_\d+$/));
  });

  it('schedules seven weekly reminders with different bodies when weekdays and weekends are on', async () => {
    const { scheduleDailyNotification } = require('../notificationServiceReal') as typeof import('../notificationServiceReal');

    await scheduleDailyNotification({
      weekdayEnabled: true,
      weekdayTime: '07:00',
      weekendEnabled: true,
      weekendTime: '09:30',
    } as never);

    const calls = mockNotifications.scheduleNotificationAsync.mock.calls as unknown as [
      { content: { body: string; title: string }; trigger: { weekday: number; hour: number; minute: number } },
    ][];
    expect(calls).toHaveLength(7);
    const bodies = calls.map(([request]) => request.content.body);
    expect(new Set(bodies).size).toBe(7);
    const weekdays = calls.map(([request]) => request.trigger.weekday).sort((a, b) => a - b);
    expect(weekdays).toEqual([1, 2, 3, 4, 5, 6, 7]);
    const weekendCalls = calls.filter(([request]) => [1, 7].includes(request.trigger.weekday));
    weekendCalls.forEach(([request]) => {
      expect(request.trigger.hour).toBe(9);
      expect(request.trigger.minute).toBe(30);
    });
  });
});
