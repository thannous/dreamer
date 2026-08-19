/**
 * @jest-environment jsdom
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockTrackProductEvent = jest.fn();
const mockRequestPermissions = jest.fn();
const mockScheduleDaily = jest.fn();
const mockScheduleWeekly = jest.fn();
const mockScheduleStreakRisk = jest.fn();
const mockScheduleInactivity = jest.fn();
const mockGetSettings = jest.fn();
const mockSaveSettings = jest.fn();
const mockGetDismissed = jest.fn();
const mockSaveDismissed = jest.fn();
let mockDreams: { id: number }[] = [];
let mockLoaded = true;
let mockPlatform = 'android';

jest.mock('react-native', () => ({
  Platform: {
    get OS() {
      return mockPlatform;
    },
  },
}));
jest.mock('@/context/DreamsContext', () => ({
  useDreamsData: () => ({ dreams: mockDreams, loaded: mockLoaded }),
}));
jest.mock('@/lib/analytics', () => ({
  trackProductEvent: (...args: unknown[]) => mockTrackProductEvent(...args),
}));
jest.mock('@/lib/appVariant', () => ({ isLucidTrainer: false }));
jest.mock('@/lib/logger', () => ({
  createScopedLogger: () => ({ warn: jest.fn(), debug: jest.fn() }),
}));
jest.mock('@/services/notificationService', () => ({
  requestNotificationPermissions: () => mockRequestPermissions(),
  scheduleDailyNotification: (settings: unknown) => mockScheduleDaily(settings),
  scheduleWeeklyRecapReminder: (settings: unknown) => mockScheduleWeekly(settings),
  scheduleStreakRiskReminder: (settings: unknown, plan: unknown) => mockScheduleStreakRisk(settings, plan),
  scheduleInactivityReminders: (settings: unknown, plans: unknown) => mockScheduleInactivity(settings, plans),
}));
jest.mock('@/services/storageService', () => ({
  getNotificationSettings: () => mockGetSettings(),
  saveNotificationSettings: (settings: unknown) => mockSaveSettings(settings),
  getReminderPromptDismissed: () => mockGetDismissed(),
  saveReminderPromptDismissed: (value: boolean) => mockSaveDismissed(value),
}));

const { useReminderOptIn } = require('../useReminderOptIn');

const offSettings = { weekdayEnabled: false, weekdayTime: '07:00', weekendEnabled: false, weekendTime: '10:00' };

describe('useReminderOptIn', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDreams = [{ id: 1 }];
    mockLoaded = true;
    mockPlatform = 'android';
    mockGetSettings.mockResolvedValue(offSettings);
    mockGetDismissed.mockResolvedValue(false);
    mockSaveSettings.mockResolvedValue(undefined);
    mockSaveDismissed.mockResolvedValue(undefined);
    mockScheduleDaily.mockResolvedValue(undefined);
    mockScheduleWeekly.mockResolvedValue(undefined);
    mockRequestPermissions.mockResolvedValue(true);
  });

  it('is visible only for native users with a dream, reminders off and no prior dismissal', async () => {
    const { result } = renderHook(() => useReminderOptIn('home'));
    await waitFor(() => expect(result.current.visible).toBe(true));
  });

  it('stays hidden without a dream, when reminders are already on, or after a dismissal', async () => {
    mockDreams = [];
    const empty = renderHook(() => useReminderOptIn('home'));
    await act(async () => {});
    expect(empty.result.current.visible).toBe(false);
    expect(mockGetSettings).not.toHaveBeenCalled();

    mockDreams = [{ id: 1 }];
    mockGetSettings.mockResolvedValue({ ...offSettings, weekdayEnabled: true });
    const remindersOn = renderHook(() => useReminderOptIn('home'));
    await act(async () => {});
    expect(remindersOn.result.current.visible).toBe(false);

    mockGetSettings.mockResolvedValue(offSettings);
    mockGetDismissed.mockResolvedValue(true);
    const dismissed = renderHook(() => useReminderOptIn('home'));
    await act(async () => {});
    expect(dismissed.result.current.visible).toBe(false);
  });

  it('is never offered on web', async () => {
    mockPlatform = 'web';
    const { result } = renderHook(() => useReminderOptIn('home'));
    await act(async () => {});
    expect(result.current.visible).toBe(false);
    expect(mockGetSettings).not.toHaveBeenCalled();
  });

  it('enables weekday and weekend reminders at the chosen time and records the opt-in', async () => {
    const { result } = renderHook(() => useReminderOptIn('journal_detail'));
    await waitFor(() => expect(result.current.visible).toBe(true));

    act(() => result.current.selectTime('07:30'));
    await act(async () => {
      await result.current.enable();
    });

    expect(mockRequestPermissions).toHaveBeenCalledTimes(1);
    const expected = {
      weekdayEnabled: true,
      weekdayTime: '07:30',
      weekendEnabled: true,
      weekendTime: '08:30',
      weeklyRecapEnabled: true,
      streakRiskEnabled: true,
      inactivityNudgeEnabled: true,
    };
    expect(mockSaveSettings).toHaveBeenCalledWith(expected);
    expect(mockScheduleDaily).toHaveBeenCalledWith(expected);
    expect(mockScheduleWeekly).toHaveBeenCalledWith(expected);
    expect(mockSaveDismissed).toHaveBeenCalledWith(true);
    expect(mockTrackProductEvent).toHaveBeenCalledWith('reminder_prompt_action', {
      surface: 'journal_detail',
      action: 'enabled',
      time_bucket: '7_8',
    });
    expect(result.current.enabled).toBe(true);
    expect(result.current.visible).toBe(true);
  });

  it('hides the card and records a denial when permission is refused', async () => {
    mockRequestPermissions.mockResolvedValue(false);
    const { result } = renderHook(() => useReminderOptIn('home'));
    await waitFor(() => expect(result.current.visible).toBe(true));

    await act(async () => {
      await result.current.enable();
    });

    expect(mockSaveSettings).not.toHaveBeenCalled();
    expect(mockScheduleDaily).not.toHaveBeenCalled();
    expect(mockTrackProductEvent).toHaveBeenCalledWith('reminder_prompt_action', {
      surface: 'home',
      action: 'denied',
      time_bucket: '7_8',
    });
    expect(result.current.visible).toBe(false);
  });

  it('persists a dismissal so the card never comes back', async () => {
    const { result } = renderHook(() => useReminderOptIn('home'));
    await waitFor(() => expect(result.current.visible).toBe(true));

    await act(async () => {
      await result.current.dismiss();
    });

    expect(mockSaveDismissed).toHaveBeenCalledWith(true);
    expect(mockTrackProductEvent).toHaveBeenCalledWith('reminder_prompt_action', {
      surface: 'home',
      action: 'dismissed',
      time_bucket: '7_8',
    });
    expect(result.current.visible).toBe(false);
  });
});
