/** @jest-environment jsdom */
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { NotificationSettings } from '@/lib/types';

const mockScheduleStreakRisk = jest.fn();
const mockScheduleInactivity = jest.fn();
const mockGetNotificationSettings = jest.fn();

let mockDreams: { id: number }[] = [];
let mockLoaded = true;
let mockPlatformOS = 'ios';
let mockForeground: (() => void) | undefined;

jest.mock('react-native', () => ({
  Platform: {
    get OS() {
      return mockPlatformOS;
    },
  },
}));

jest.mock('@/context/DreamsContext', () => ({
  useDreamsData: () => ({ dreams: mockDreams, loaded: mockLoaded }),
}));

jest.mock('@/hooks/useAppState', () => ({
  useAppState: (onForeground?: () => void) => {
    mockForeground = onForeground;
  },
}));

jest.mock('@/lib/appVariant', () => ({ isLucidTrainer: false }));

jest.mock('@/services/notificationService', () => ({
  scheduleStreakRiskReminder: (...args: unknown[]) => mockScheduleStreakRisk(...args),
  scheduleInactivityReminders: (...args: unknown[]) => mockScheduleInactivity(...args),
}));

jest.mock('@/services/storageService', () => ({
  getNotificationSettings: () => mockGetNotificationSettings(),
}));

const { useEngagementReminders } = require('../useEngagementReminders') as typeof import('../useEngagementReminders');

const settings: NotificationSettings = {
  weekdayEnabled: true,
  weekdayTime: '07:00',
  weekendEnabled: true,
  weekendTime: '10:00',
  streakRiskEnabled: true,
  inactivityNudgeEnabled: true,
};

/**
 * The streak deadline is an evening slot (21:00 local), so a journal built from the
 * real clock yields a plan in the morning and `null` once that hour has passed.
 * `now` is pinned to a fixed afternoon and the journal derived from it, so the
 * assertions below hold whatever time of day the suite runs at.
 */
const NOW = new Date(2026, 4, 12, 14, 0, 0, 0).getTime();

const daysAgo = (days: number, hour = 8): number => {
  const date = new Date(NOW);
  date.setDate(date.getDate() - days);
  date.setHours(hour, 0, 0, 0);
  return date.getTime();
};

describe('useEngagementReminders', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
    (globalThis as any).__DEV__ = false;
    mockPlatformOS = 'ios';
    mockLoaded = true;
    mockForeground = undefined;
    mockDreams = [{ id: daysAgo(1) }, { id: daysAgo(2) }];
    mockGetNotificationSettings.mockResolvedValue({ ...settings });
    mockScheduleStreakRisk.mockResolvedValue(undefined);
    mockScheduleInactivity.mockResolvedValue(undefined);
  });

  it('schedules both families from the journal on mount', async () => {
    renderHook(() => useEngagementReminders());

    await waitFor(() => expect(mockScheduleStreakRisk).toHaveBeenCalledTimes(1));
    expect(mockScheduleStreakRisk).toHaveBeenCalledWith(
      { ...settings },
      expect.objectContaining({ streakLength: 2 })
    );
    expect(mockScheduleInactivity).toHaveBeenCalledWith(
      { ...settings },
      [expect.objectContaining({ stage: 3 }), expect.objectContaining({ stage: 7 })]
    );
  });

  it('reschedules when a dream is saved', async () => {
    const { rerender } = renderHook(() => useEngagementReminders());
    await waitFor(() => expect(mockScheduleStreakRisk).toHaveBeenCalledTimes(1));

    mockDreams = [{ id: Date.now() }, ...mockDreams];
    rerender();

    await waitFor(() => expect(mockScheduleStreakRisk).toHaveBeenCalledTimes(2));
    // Recording today pushes the deadline to the next evening and restarts the
    // inactivity countdown, so the plan is genuinely different.
    const firstTrigger = (mockScheduleStreakRisk.mock.calls[0][1] as any).triggerAt;
    const secondTrigger = (mockScheduleStreakRisk.mock.calls[1][1] as any).triggerAt;
    expect(secondTrigger).toBeGreaterThan(firstTrigger);
  });

  it('replays the journal that changed while a sync was in flight', async () => {
    let releaseSettings: ((value: NotificationSettings) => void) | undefined;
    mockGetNotificationSettings.mockImplementationOnce(
      () => new Promise<NotificationSettings>((resolve) => {
        releaseSettings = resolve;
      })
    );

    const { rerender } = renderHook(() => useEngagementReminders());
    await waitFor(() => expect(mockGetNotificationSettings).toHaveBeenCalledTimes(1));

    // A remote dream recorded this morning is merged while the first run is
    // still awaiting storage: the stale plan must not be the last word.
    mockDreams = [{ id: Date.now() }, ...mockDreams];
    rerender();
    expect(mockScheduleStreakRisk).not.toHaveBeenCalled();

    releaseSettings?.({ ...settings });

    await waitFor(() => expect(mockScheduleStreakRisk).toHaveBeenCalledTimes(2));
    const stalePlan = mockScheduleStreakRisk.mock.calls[0][1] as any;
    const freshPlan = mockScheduleStreakRisk.mock.calls[1][1] as any;
    // Recording today pushes the deadline to the following evening.
    expect(freshPlan.triggerAt).toBeGreaterThan(stalePlan.triggerAt);
  });

  it('skips a redundant reschedule when nothing changed', async () => {
    renderHook(() => useEngagementReminders());
    await waitFor(() => expect(mockScheduleStreakRisk).toHaveBeenCalledTimes(1));

    mockForeground?.();
    await waitFor(() => expect(mockGetNotificationSettings).toHaveBeenCalledTimes(2));
    expect(mockScheduleStreakRisk).toHaveBeenCalledTimes(1);
  });

  it('waits for the journal to finish loading', async () => {
    mockLoaded = false;
    renderHook(() => useEngagementReminders());

    await waitFor(() => expect(mockGetNotificationSettings).not.toHaveBeenCalled());
    expect(mockScheduleStreakRisk).not.toHaveBeenCalled();
  });

  it('does nothing on web, where local notifications are unsupported', async () => {
    mockPlatformOS = 'web';
    renderHook(() => useEngagementReminders());

    await waitFor(() => expect(mockGetNotificationSettings).not.toHaveBeenCalled());
    expect(mockScheduleStreakRisk).not.toHaveBeenCalled();
  });

  it('still cancels stale reminders when both toggles are off', async () => {
    mockGetNotificationSettings.mockResolvedValue({
      ...settings,
      streakRiskEnabled: false,
      inactivityNudgeEnabled: false,
    });
    renderHook(() => useEngagementReminders());

    // The schedulers own the cancellation, so they must still be invoked.
    await waitFor(() => expect(mockScheduleStreakRisk).toHaveBeenCalledTimes(1));
    expect(mockScheduleInactivity).toHaveBeenCalledTimes(1);
  });
});
