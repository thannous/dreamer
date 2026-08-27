/* @jest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';

import { useLucidNightAudio } from '@/hooks/useLucidNightAudio';
import type { LucidNightSignalPlan } from '@/lib/lucid/audio';
import { evaluateLucidSafetyPolicy, type LucidSafetyFacts } from '@/lib/lucid/safety';

const mockPlayer = {
  loop: false,
  pause: jest.fn(),
  play: jest.fn(),
  seekTo: jest.fn().mockResolvedValue(undefined),
  volume: 1,
};

const mockStatus = {
  currentTime: 0,
  didJustFinish: false,
  duration: 8,
  isBuffering: false,
  isLoaded: true,
  playing: false,
};

const mockCancelNightCues = jest.fn().mockResolvedValue(undefined);
const mockRestoreNightPlan = jest.fn().mockResolvedValue(null);
const mockScheduleNightCues = jest.fn();

jest.mock('expo-audio', () => ({
  setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
  useAudioPlayer: jest.fn(() => mockPlayer),
  useAudioPlayerStatus: jest.fn(() => mockStatus),
}));

jest.mock('@/services/lucidTrainerNotifications', () => ({
  cancelLucidNightCues: (...args: unknown[]) => mockCancelNightCues(...args),
  restoreLucidNightSignalPlan: (...args: unknown[]) => mockRestoreNightPlan(...args),
  scheduleLucidNightCues: (...args: unknown[]) => mockScheduleNightCues(...args),
}));

function policyFrom(overrides: Partial<LucidSafetyFacts> = {}) {
  return evaluateLucidSafetyPolicy({
    recoveryRequested: false,
    recentSleepDegraded: false,
    sleepIsFragile: false,
    hearingConcern: false,
    audioConsented: true,
    ...overrides,
  });
}

function restoredPlan(now = Date.now()): LucidNightSignalPlan {
  return {
    sessionId: `lucid-night-${now}`,
    sessionStartAt: now,
    timerEndsAt: now + 8 * 60 * 60 * 1000,
    volume: 0.3,
    volumeBand: 'gentle',
    soundId: 'rain',
    soundFile: 'lucid_cue_rain.wav',
    cues: [
      {
        id: `lucid-night-${now}:cue:1`,
        requestedIndex: 0,
        startsAt: now + 90 * 60 * 1000,
        stopAt: now + 90 * 60 * 1000 + 7_000,
      },
    ],
    rejectedCues: [],
    safetyRules: ['low_volume', 'speaker_only', 'stop_if_sleep_disrupted', 'no_medical_claim'],
  };
}

const baseParams = {
  soundId: 'rain' as const,
  volume: 0.25,
  timerMinutes: 360,
  safety: {
    acknowledged: true,
    playbackRoute: 'speaker' as const,
    sleepIsFragile: false,
    hearingConcern: false,
  },
  notificationTitle: 'Lucid Trainer',
  notificationBody: 'A gentle reality cue.',
};

describe('useLucidNightAudio policy cleanup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPlayer.pause.mockReset();
    mockPlayer.seekTo.mockResolvedValue(undefined);
    mockCancelNightCues.mockResolvedValue(undefined);
    mockRestoreNightPlan.mockResolvedValue(null);
    mockScheduleNightCues.mockResolvedValue({ permission: 'granted', scheduledIds: ['cue-1'] });
  });

  it('clears a restored plan when the policy becomes blocking and does not revive it later', async () => {
    const plan = restoredPlan();
    mockRestoreNightPlan.mockResolvedValue(plan);

    const { result, rerender } = renderHook(
      ({ policy }) => useLucidNightAudio({ ...baseParams, policy }),
      { initialProps: { policy: policyFrom() } }
    );

    await waitFor(() => {
      expect(result.current.plan?.sessionId).toBe(plan.sessionId);
    });

    await act(async () => {
      rerender({ policy: policyFrom({ recoveryRequested: true }) });
    });

    await waitFor(() => {
      expect(result.current.plan).toBeNull();
    });
    expect(result.current.error).toBe('recovery_requested');
    expect(result.current.remaining.getSnapshot()).toBe(0);
    expect(mockCancelNightCues).toHaveBeenCalled();

    const cancelCount = mockCancelNightCues.mock.calls.length;
    await act(async () => {
      rerender({ policy: policyFrom() });
    });

    expect(result.current.plan).toBeNull();
    expect(result.current.error).toBe('recovery_requested');
    expect(mockCancelNightCues.mock.calls.length).toBe(cancelCount);

    await act(async () => {
      await result.current.stopNight();
    });
    expect(result.current.plan).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('keeps the plan and remaining when cancel fails, then a later stop cleans up', async () => {
    const plan = restoredPlan();
    mockRestoreNightPlan.mockResolvedValue(plan);
    mockCancelNightCues.mockRejectedValueOnce(new Error('channel unavailable'));

    const { result, rerender } = renderHook(
      ({ policy }) => useLucidNightAudio({ ...baseParams, policy }),
      { initialProps: { policy: policyFrom() } }
    );

    await waitFor(() => {
      expect(result.current.plan?.sessionId).toBe(plan.sessionId);
    });
    expect(result.current.remaining.getSnapshot()).toBeGreaterThan(0);

    await act(async () => {
      rerender({ policy: policyFrom({ recoveryRequested: true }) });
    });

    await waitFor(() => {
      expect(result.current.error).toBe('notification_cancel_failed');
    });
    expect(result.current.plan?.sessionId).toBe(plan.sessionId);
    expect(result.current.remaining.getSnapshot()).toBeGreaterThan(0);
    expect(mockPlayer.pause).toHaveBeenCalled();

    await act(async () => {
      await result.current.stopNight();
    });

    expect(result.current.plan).toBeNull();
    expect(result.current.remaining.getSnapshot()).toBe(0);
    expect(result.current.error).toBeNull();
  });

  it('refuses a second startNight while the first is still scheduling', async () => {
    let releaseSchedule: (value: { permission: string; scheduledIds: string[] }) => void = () => {};
    mockScheduleNightCues.mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseSchedule = resolve;
        })
    );

    const { result } = renderHook(() => useLucidNightAudio({ ...baseParams, policy: policyFrom() }));
    await waitFor(() => expect(mockRestoreNightPlan).toHaveBeenCalled());

    const start = result.current.startNight;
    let first = Promise.resolve(false);
    let second = Promise.resolve(true);

    await act(async () => {
      first = start();
      second = start();
    });

    expect(mockScheduleNightCues).toHaveBeenCalledTimes(1);
    await expect(second).resolves.toBe(false);

    await act(async () => {
      releaseSchedule({ permission: 'granted', scheduledIds: ['cue-1'] });
      await first;
    });

    expect(await first).toBe(true);
    expect(mockScheduleNightCues).toHaveBeenCalledTimes(1);
    expect(result.current.plan).not.toBeNull();
  });

  it('keeps a restored blocked plan visible when the first cancellation fails', async () => {
    const plan = restoredPlan();
    mockRestoreNightPlan.mockResolvedValue(plan);
    mockCancelNightCues.mockRejectedValue(new Error('channel unavailable'));

    const { result } = renderHook(() =>
      useLucidNightAudio({ ...baseParams, policy: policyFrom({ recoveryRequested: true }) })
    );

    await waitFor(() => {
      expect(result.current.plan?.sessionId).toBe(plan.sessionId);
    });
    expect(result.current.remaining.getSnapshot()).toBeGreaterThan(0);
    expect(result.current.error).toBe('notification_cancel_failed');
    expect(mockPlayer.pause).toHaveBeenCalled();

    mockCancelNightCues.mockResolvedValue(undefined);
    await act(async () => {
      await result.current.stopNight();
    });

    expect(result.current.plan).toBeNull();
    expect(result.current.remaining.getSnapshot()).toBe(0);
  });

  it('cancels a newly scheduled session when policy becomes recovery before schedule resolves', async () => {
    let releaseSchedule: (value: { permission: string; scheduledIds: string[] }) => void = () => {};
    mockScheduleNightCues.mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseSchedule = resolve;
        })
    );

    const { result, rerender } = renderHook(
      ({ policy }) => useLucidNightAudio({ ...baseParams, policy }),
      { initialProps: { policy: policyFrom() } }
    );
    await waitFor(() => expect(mockRestoreNightPlan).toHaveBeenCalled());

    let started = Promise.resolve(true);
    await act(async () => {
      started = result.current.startNight();
    });
    expect(mockScheduleNightCues).toHaveBeenCalledTimes(1);
    const scheduledPlan = mockScheduleNightCues.mock.calls[0]?.[0] as { sessionId: string };

    await act(async () => {
      rerender({ policy: policyFrom({ recoveryRequested: true }) });
    });

    await act(async () => {
      releaseSchedule({ permission: 'granted', scheduledIds: ['cue-1'] });
      await started;
    });

    expect(await started).toBe(false);
    expect(result.current.plan).toBeNull();
    expect(mockCancelNightCues).toHaveBeenCalledWith({ sessionId: scheduledPlan.sessionId });
  });

  it('exposes the scheduled plan when policy-blocked session cancel fails', async () => {
    let releaseSchedule: (value: { permission: string; scheduledIds: string[] }) => void = () => {};
    mockScheduleNightCues.mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseSchedule = resolve;
        })
    );
    mockCancelNightCues.mockRejectedValue(new Error('channel unavailable'));

    const { result, rerender } = renderHook(
      ({ policy }) => useLucidNightAudio({ ...baseParams, policy }),
      { initialProps: { policy: policyFrom() } }
    );
    await waitFor(() => expect(mockRestoreNightPlan).toHaveBeenCalled());

    let started = Promise.resolve(true);
    await act(async () => {
      started = result.current.startNight();
    });
    const scheduledPlan = mockScheduleNightCues.mock.calls[0]?.[0] as LucidNightSignalPlan;

    await act(async () => {
      rerender({ policy: policyFrom({ recoveryRequested: true }) });
    });
    await act(async () => {
      releaseSchedule({ permission: 'granted', scheduledIds: ['cue-1'] });
      await started;
    });

    expect(await started).toBe(false);
    expect(result.current.plan?.sessionId).toBe(scheduledPlan.sessionId);
    expect(result.current.remaining.getSnapshot()).toBeGreaterThan(0);
    expect(result.current.error).toBe('notification_cancel_failed');
    expect(mockPlayer.pause).toHaveBeenCalled();
    expect(mockCancelNightCues).toHaveBeenCalledWith({ sessionId: scheduledPlan.sessionId });

    mockCancelNightCues.mockResolvedValue(undefined);
    await act(async () => {
      await result.current.stopNight();
    });
    expect(result.current.plan).toBeNull();
    expect(result.current.remaining.getSnapshot()).toBe(0);
  });

  it('exposes the just-scheduled plan when Stop made start stale and scoped cancel fails', async () => {
    let releaseSchedule: (value: { permission: string; scheduledIds: string[] }) => void = () => {};
    mockScheduleNightCues.mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseSchedule = resolve;
        })
    );
    mockCancelNightCues.mockImplementation(async (filter?: { sessionId?: string }) => {
      if (filter?.sessionId) throw new Error('channel unavailable');
    });

    const { result } = renderHook(() => useLucidNightAudio({ ...baseParams, policy: policyFrom() }));
    await waitFor(() => expect(mockRestoreNightPlan).toHaveBeenCalled());

    let started = Promise.resolve(true);
    await act(async () => {
      started = result.current.startNight();
    });
    const scheduledPlan = mockScheduleNightCues.mock.calls[0]?.[0] as LucidNightSignalPlan;

    await act(async () => {
      await result.current.stopNight();
    });

    await act(async () => {
      releaseSchedule({ permission: 'granted', scheduledIds: ['cue-1'] });
      await started;
    });

    expect(await started).toBe(false);
    expect(result.current.plan?.sessionId).toBe(scheduledPlan.sessionId);
    expect(result.current.remaining.getSnapshot()).toBeGreaterThan(0);
    expect(result.current.error).toBe('notification_cancel_failed');
    expect(mockCancelNightCues).toHaveBeenCalledWith({ sessionId: scheduledPlan.sessionId });
  });

  it('does not resurrect a scheduled plan after a newer Stop succeeds during scoped cancel', async () => {
    let releaseSchedule: (value: { permission: string; scheduledIds: string[] }) => void = () => {};
    let rejectScopedCancel: (error: Error) => void = () => {};
    mockScheduleNightCues.mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseSchedule = resolve;
        })
    );
    mockCancelNightCues.mockImplementation((filter?: { sessionId?: string }) => {
      if (filter?.sessionId) {
        return new Promise((_resolve, reject) => {
          rejectScopedCancel = reject;
        });
      }
      return Promise.resolve(undefined);
    });

    const { result, rerender } = renderHook(
      ({ policy }) => useLucidNightAudio({ ...baseParams, policy }),
      { initialProps: { policy: policyFrom() } }
    );
    await waitFor(() => expect(mockRestoreNightPlan).toHaveBeenCalled());

    let started = Promise.resolve(true);
    await act(async () => {
      started = result.current.startNight();
    });
    const scheduledPlan = mockScheduleNightCues.mock.calls[0]?.[0] as LucidNightSignalPlan;

    await act(async () => {
      rerender({ policy: policyFrom({ recoveryRequested: true }) });
    });
    await act(async () => {
      releaseSchedule({ permission: 'granted', scheduledIds: ['cue-1'] });
    });
    await waitFor(() => {
      expect(mockCancelNightCues).toHaveBeenCalledWith({ sessionId: scheduledPlan.sessionId });
    });

    await act(async () => {
      await result.current.stopNight();
    });
    expect(result.current.plan).toBeNull();
    expect(result.current.remaining.getSnapshot()).toBe(0);
    expect(result.current.error).toBeNull();

    await act(async () => {
      rejectScopedCancel(new Error('channel unavailable'));
      await started;
    });

    expect(await started).toBe(false);
    expect(result.current.plan).toBeNull();
    expect(result.current.remaining.getSnapshot()).toBe(0);
    expect(result.current.error).toBeNull();
  });
});
