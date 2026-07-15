/** @jest-environment jsdom */
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { NotificationSettings } from '@/lib/types';

const mockGetNotificationSettings = jest.fn();
const mockSaveNotificationSettings = jest.fn();
const mockHasNotificationPermissions = jest.fn();
const mockRequestNotificationPermissions = jest.fn();
const mockScheduleDailyNotification = jest.fn();
const mockCancelAllNotifications = jest.fn();
const mockSendTestNotification = jest.fn();
const mockAlert = jest.fn();
const mockAddAppStateListener = jest.fn();
const mockRemoveAppStateListener = jest.fn();
const mockTranslate = jest.fn();

let mockPlatformOS = 'ios';
let mockAppStateChange: ((state: string) => void) | undefined;

jest.mock('react-native', () => ({
  Alert: { alert: (...args: unknown[]) => mockAlert(...args) },
  AppState: {
    addEventListener: (...args: unknown[]) => mockAddAppStateListener(...args),
  },
  Platform: {
    get OS() {
      return mockPlatformOS;
    },
  },
}));

jest.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: mockTranslate }),
}));

jest.mock('@/services/notificationService', () => ({
  cancelAllNotifications: (...args: unknown[]) => mockCancelAllNotifications(...args),
  hasNotificationPermissions: (...args: unknown[]) => mockHasNotificationPermissions(...args),
  requestNotificationPermissions: (...args: unknown[]) => mockRequestNotificationPermissions(...args),
  scheduleDailyNotification: (...args: unknown[]) => mockScheduleDailyNotification(...args),
  sendTestNotification: (...args: unknown[]) => mockSendTestNotification(...args),
}));

jest.mock('@/services/storageService', () => ({
  getNotificationSettings: (...args: unknown[]) => mockGetNotificationSettings(...args),
  saveNotificationSettings: (...args: unknown[]) => mockSaveNotificationSettings(...args),
}));

const { useNotificationSettingsController } = require('../useNotificationSettingsController') as typeof import('../useNotificationSettingsController');

const defaultSettings: NotificationSettings = {
  weekdayEnabled: false,
  weekdayTime: '07:00',
  weekendEnabled: false,
  weekendTime: '10:00',
};

describe('useNotificationSettingsController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    (globalThis as any).__DEV__ = false;
    mockPlatformOS = 'ios';
    mockAppStateChange = undefined;
    mockGetNotificationSettings.mockResolvedValue({ ...defaultSettings });
    mockSaveNotificationSettings.mockResolvedValue(undefined);
    mockHasNotificationPermissions.mockResolvedValue(true);
    mockRequestNotificationPermissions.mockResolvedValue(true);
    mockScheduleDailyNotification.mockResolvedValue(undefined);
    mockCancelAllNotifications.mockResolvedValue(undefined);
    mockSendTestNotification.mockResolvedValue(undefined);
    mockTranslate.mockImplementation((key: string, values?: Record<string, unknown>) => (
      values ? `${key}:${JSON.stringify(values)}` : key
    ));
    mockAddAppStateListener.mockImplementation((...args: unknown[]) => {
      mockAppStateChange = args[1] as (state: string) => void;
      return { remove: mockRemoveAppStateListener };
    });
  });

  it('loads persisted settings and permissions, then removes the AppState listener', async () => {
    const savedSettings = { ...defaultSettings, weekendEnabled: true, weekendTime: '09:30' };
    mockGetNotificationSettings.mockResolvedValue(savedSettings);

    const { result, unmount } = renderHook(() => useNotificationSettingsController());

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.settings).toEqual(savedSettings);
    expect(result.current.hasPermissions).toBe(true);
    expect(mockAddAppStateListener).toHaveBeenCalledWith('change', expect.any(Function));

    unmount();
    expect(mockRemoveAppStateListener).toHaveBeenCalledTimes(1);
  });

  it('keeps web preferences editable without calling native notification services', async () => {
    mockPlatformOS = 'web';
    const { result } = renderHook(() => useNotificationSettingsController());

    expect(result.current.unsupported).toBe(true);
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.toggleWeekday(true);
    });
    await waitFor(() => expect(result.current.settings.weekdayEnabled).toBe(true));
    await act(async () => {
      await result.current.setWeekdayTime('06:45');
      await result.current.sendTest();
    });

    expect(result.current.settings).toMatchObject({
      weekdayEnabled: true,
      weekdayTime: '06:45',
    });
    expect(mockGetNotificationSettings).toHaveBeenCalledTimes(1);
    expect(mockSaveNotificationSettings).toHaveBeenCalledTimes(2);
    expect(mockHasNotificationPermissions).not.toHaveBeenCalled();
    expect(mockRequestNotificationPermissions).not.toHaveBeenCalled();
    expect(mockScheduleDailyNotification).not.toHaveBeenCalled();
    expect(mockCancelAllNotifications).not.toHaveBeenCalled();
    expect(mockSendTestNotification).not.toHaveBeenCalled();
    expect(mockAddAppStateListener).not.toHaveBeenCalled();
  });

  it('asks for permission before enabling and stops when permission is denied', async () => {
    mockHasNotificationPermissions.mockResolvedValue(false);
    mockRequestNotificationPermissions.mockResolvedValue(false);
    const { result } = renderHook(() => useNotificationSettingsController());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => result.current.toggleWeekday(true));

    expect(result.current.settings.weekdayEnabled).toBe(false);
    expect(mockSaveNotificationSettings).not.toHaveBeenCalled();
    expect(mockScheduleDailyNotification).not.toHaveBeenCalled();
    expect(mockAlert).toHaveBeenCalledWith(
      'notifications.alert.permission_required.title',
      'notifications.alert.permission_required.message',
      [{ text: 'common.done' }]
    );
  });

  it('persists and schedules an enabled reminder', async () => {
    const { result } = renderHook(() => useNotificationSettingsController());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => result.current.toggleWeekend(true));

    const expected = { ...defaultSettings, weekendEnabled: true };
    expect(result.current.settings).toEqual(expected);
    expect(mockSaveNotificationSettings).toHaveBeenCalledWith(expected);
    expect(mockScheduleDailyNotification).toHaveBeenCalledWith(expected);
    expect(mockCancelAllNotifications).not.toHaveBeenCalled();
  });

  it('cancels notifications when the last enabled reminder is disabled', async () => {
    mockGetNotificationSettings.mockResolvedValue({ ...defaultSettings, weekdayEnabled: true });
    const { result } = renderHook(() => useNotificationSettingsController());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => result.current.toggleWeekday(false));

    expect(mockSaveNotificationSettings).toHaveBeenCalledWith(defaultSettings);
    expect(mockCancelAllNotifications).toHaveBeenCalledTimes(1);
    expect(mockScheduleDailyNotification).not.toHaveBeenCalled();
  });

  it('rolls a toggle back and alerts when scheduling fails', async () => {
    mockScheduleDailyNotification.mockRejectedValueOnce(new Error('schedule failed'));
    const { result } = renderHook(() => useNotificationSettingsController());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => result.current.toggleWeekday(true));

    expect(result.current.settings).toEqual(defaultSettings);
    expect(mockAlert).toHaveBeenCalledWith(
      'notifications.alert.update_failed.title',
      'notifications.alert.update_failed.message'
    );
  });

  it('refreshes permissions only when AppState becomes active', async () => {
    mockHasNotificationPermissions.mockResolvedValue(false);
    const { result } = renderHook(() => useNotificationSettingsController());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockHasNotificationPermissions).toHaveBeenCalledTimes(1);

    mockHasNotificationPermissions.mockResolvedValue(true);
    act(() => mockAppStateChange?.('background'));
    expect(mockHasNotificationPermissions).toHaveBeenCalledTimes(1);

    act(() => mockAppStateChange?.('active'));
    await waitFor(() => expect(result.current.hasPermissions).toBe(true));
    expect(mockHasNotificationPermissions).toHaveBeenCalledTimes(2);
  });

  it('formats, persists and reschedules time changes when reminders are enabled', async () => {
    mockGetNotificationSettings.mockResolvedValue({ ...defaultSettings, weekdayEnabled: true });
    const { result } = renderHook(() => useNotificationSettingsController());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => result.current.setWeekdayTime(new Date(2026, 0, 1, 6, 45)));

    const expected = { ...defaultSettings, weekdayEnabled: true, weekdayTime: '06:45' };
    expect(result.current.settings).toEqual(expected);
    expect(mockSaveNotificationSettings).toHaveBeenCalledWith(expected);
    expect(mockScheduleDailyNotification).toHaveBeenCalledWith(expected);
  });

  it('persists a time change without scheduling when reminders are disabled', async () => {
    const { result } = renderHook(() => useNotificationSettingsController());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => result.current.setWeekendTime('11:20'));

    expect(mockSaveNotificationSettings).toHaveBeenCalledWith({ ...defaultSettings, weekendTime: '11:20' });
    expect(mockScheduleDailyNotification).not.toHaveBeenCalled();
  });

  it('requests permission, sends a test notification and confirms it', async () => {
    mockHasNotificationPermissions.mockResolvedValue(false);
    const { result } = renderHook(() => useNotificationSettingsController());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => result.current.sendTest());

    expect(result.current.hasPermissions).toBe(true);
    expect(mockRequestNotificationPermissions).toHaveBeenCalledTimes(1);
    expect(mockSendTestNotification).toHaveBeenCalledTimes(1);
    expect(mockAlert).toHaveBeenCalledWith(
      'notifications.alert.test_scheduled.title',
      'notifications.alert.test_scheduled.message',
      [{ text: 'common.done' }]
    );
  });

  it('alerts when a test notification fails', async () => {
    mockSendTestNotification.mockRejectedValueOnce(new Error('send failed'));
    const { result } = renderHook(() => useNotificationSettingsController());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => result.current.sendTest());

    expect(mockAlert).toHaveBeenCalledWith(
      'notifications.alert.update_failed.title',
      'notifications.alert.update_failed.message'
    );
  });

  it('describes the next reminder using the existing relative-day translation', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 6, 14, 6, 30));
    mockGetNotificationSettings.mockResolvedValue({ ...defaultSettings, weekdayEnabled: true });
    const { result } = renderHook(() => useNotificationSettingsController());
    await act(async () => {});

    expect(result.current.nextReminderText).toBe(
      'notifications.next_reminder_today:{"time":"07:00"}'
    );
  });
});
