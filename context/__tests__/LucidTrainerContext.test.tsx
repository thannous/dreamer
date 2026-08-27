/* @jest-environment jsdom */

import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';

import { trackProductEvent } from '@/lib/analytics';
import { getLucidDateKeyInTimeZone } from '@/lib/lucid/morningCapture';
import type { LucidTrainerState } from '@/lib/lucid/model';
import type { LucidReminderReconciliationResult } from '@/services/lucidTrainerNotifications';

const mockClaimGuestScope = jest.fn();
const mockHasGuestData = jest.fn();
const mockLoadState = jest.fn();
const mockGetState = jest.fn();
const mockLoadQueue = jest.fn();
const mockUpdateQueue = jest.fn();
const mockUpdateState = jest.fn();
const mockSaveState = jest.fn();
const mockClearLocalData = jest.fn();
const mockReconcileReminders = jest.fn();

jest.mock('react-native', () => jest.requireActual('../../tests/react-native-stub'));
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en-US' }] }));
jest.mock('expo-crypto', () => ({ randomUUID: () => '00000000-0000-4000-8000-000000000001' }));

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

jest.mock('@/lib/appVariant', () => ({ isLucidTrainer: true }));
jest.mock('@/lib/analytics', () => ({ trackProductEvent: jest.fn() }));
jest.mock('@/lib/productAnalytics', () => ({ setProductAnalyticsEnabled: jest.fn() }));
jest.mock('@/services/lucidTrainerNotifications', () => ({
  reconcileLucidTrainerReminders: (...args: unknown[]) => mockReconcileReminders(...args),
}));

jest.mock('@/services/lucidTrainerSync', () => ({
  claimLucidTrainerGuestScope: (...args: unknown[]) => mockClaimGuestScope(...args),
  hasLucidTrainerGuestData: (...args: unknown[]) => mockHasGuestData(...args),
  createLucidTrainerMutation: jest.fn(),
  pullLucidTrainerRemoteState: jest.fn(),
  queueLucidTrainerMutation: jest.fn(),
  replayLucidTrainerQueue: jest.fn(),
}));

jest.mock('@/services/lucidTrainerStorage', () => ({
  clearLucidTrainerLocalData: (...args: unknown[]) => mockClearLocalData(...args),
  getLucidTrainerState: (...args: unknown[]) => mockGetState(...args),
  loadLucidTrainerState: (...args: unknown[]) => mockLoadState(...args),
  loadLucidTrainerSyncQueue: (...args: unknown[]) => mockLoadQueue(...args),
  saveLucidTrainerState: (...args: unknown[]) => mockSaveState(...args),
  updateLucidTrainerState: (...args: unknown[]) => mockUpdateState(...args),
  updateLucidTrainerSyncQueue: (...args: unknown[]) => mockUpdateQueue(...args),
}));

const { createInitialLucidTrainerState, createLucidProgramProgress } = require('@/lib/lucid/domain');
const { LucidTrainerProvider, useLucidTrainer } = require('../LucidTrainerContext');

describe('LucidTrainerContext account boundary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const state = createInitialLucidTrainerState({ now: 1_700_000_000_000, timeZone: 'UTC' });
    mockLoadState.mockResolvedValue({ state, recovered: false });
    mockGetState.mockResolvedValue(state);
    mockHasGuestData.mockResolvedValue(true);
    mockClaimGuestScope.mockResolvedValue({ claimed: true, queued: 0 });
    mockLoadQueue.mockResolvedValue([]);
    mockUpdateQueue.mockImplementation(async (_scope, updater) => updater([]));
    mockUpdateState.mockImplementation(async (_scope, updater) => updater(state));
    mockClearLocalData.mockResolvedValue(undefined);
    mockReconcileReminders.mockResolvedValue({
      permission: 'undetermined',
      canAskAgain: true,
      scheduledIds: [],
      cancelledIds: [],
      unchangedOccurrenceIds: [],
      timeContextChanged: false,
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <LucidTrainerProvider>{children}</LucidTrainerProvider>
  );

  it('detects but never auto-claims device guest data when an account session appears', async () => {
    const { result } = renderHook(() => useLucidTrainer(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.guestImportAvailable).toBe(true);
    expect(mockClaimGuestScope).not.toHaveBeenCalled();
  });

  it('claims guest data only after the explicit context action', async () => {
    const { result } = renderHook(() => useLucidTrainer(), { wrapper });
    await waitFor(() => expect(result.current.guestImportAvailable).toBe(true));

    await act(async () => result.current.importGuestData());

    expect(mockClaimGuestScope).toHaveBeenCalledWith(
      'user:user-1',
      expect.objectContaining({ storage: expect.any(Object) })
    );
    expect(result.current.guestImportAvailable).toBe(false);
  });

  it('completes onboarding without waiting for native reminder reconciliation', async () => {
    const neverSettles = new Promise<LucidReminderReconciliationResult>(() => {});
    const { result } = renderHook(() => useLucidTrainer(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    mockReconcileReminders.mockReturnValueOnce(neverSettles);

    const completion = result.current.completeOnboarding({
      goal: 'improve_recall',
      experience: 'beginner',
      weeklyTarget: 3,
      sleepSchedule: { bedtime: '22:30', wakeTime: '07:00', timeZone: 'UTC' },
      notificationsPermission: 'unknown',
      notificationsExplained: false,
      audioSafetyAccepted: false,
      analyticsConsent: false,
      accessibility: {
        reduceMotion: false,
        largerText: false,
        screenReaderOptimized: false,
      },
      cloudSyncEnabled: false,
      noctaliaLinkEnabled: false,
    });

    await expect(Promise.race([
      completion.then(() => 'completed'),
      new Promise<string>((resolve) => setTimeout(() => resolve('timed-out'), 100)),
    ])).resolves.toBe('completed');
    await waitFor(() => expect(result.current.state?.onboarding.status).toBe('completed'));
    expect(result.current.state?.preferences.cloudSyncEnabled).toBe(false);
    expect(result.current.state?.preferences.noctaliaLinkEnabled).toBe(false);
  });

  it('pauses the previous program when another program starts', async () => {
    const initial = createInitialLucidTrainerState({
      now: 1_700_000_000_000,
      timeZone: 'UTC',
    }) as LucidTrainerState;
    let persistedState: LucidTrainerState = {
      ...initial,
      progress: [
        {
          ...createLucidProgramProgress('mild', initial.createdAt),
          status: 'active',
          currentDay: 3,
          completedExerciseIds: ['mild-01', 'mild-02'],
          startedAt: initial.createdAt,
        },
        {
          ...createLucidProgramProgress('ssild', initial.createdAt),
          status: 'paused',
          currentDay: 2,
          completedExerciseIds: ['ssild-01'],
          startedAt: initial.createdAt,
        },
      ],
    };

    mockLoadState.mockResolvedValue({ state: persistedState, source: 'stored' });
    mockGetState.mockImplementation(async () => persistedState);
    mockUpdateState.mockImplementation(
      async (
        _scope: string,
        updater: (current: LucidTrainerState) => LucidTrainerState | Promise<LucidTrainerState>
      ) => {
        persistedState = await updater(persistedState);
        return persistedState;
      }
    );

    const { result } = renderHook(() => useLucidTrainer(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.startProgram('ssild');
    });

    expect(result.current.state?.progress.filter(
      (item: LucidTrainerState['progress'][number]) => item.status === 'active'
    )).toEqual([
      expect.objectContaining({ technique: 'ssild' }),
    ]);
    expect(result.current.state?.progress.find(
      (item: LucidTrainerState['progress'][number]) => item.technique === 'mild'
    )).toEqual(
      expect.objectContaining({
        status: 'paused',
        currentDay: 3,
        completedExerciseIds: ['mild-01', 'mild-02'],
      })
    );
    expect(result.current.state?.progress.find(
      (item: LucidTrainerState['progress'][number]) => item.technique === 'ssild'
    )).toEqual(
      expect.objectContaining({
        status: 'active',
        currentDay: 2,
        completedExerciseIds: ['ssild-01'],
      })
    );
  });

  it('reviews a completed program without pausing the active program', async () => {
    const initial = createInitialLucidTrainerState({
      now: 1_700_000_000_000,
      timeZone: 'UTC',
    }) as LucidTrainerState;
    let persistedState: LucidTrainerState = {
      ...initial,
      progress: [
        {
          ...createLucidProgramProgress('mild', initial.createdAt),
          status: 'active',
          currentDay: 3,
          completedExerciseIds: ['mild-01', 'mild-02'],
          startedAt: initial.createdAt,
        },
        {
          ...createLucidProgramProgress('ssild', initial.createdAt),
          status: 'completed',
          currentDay: 7,
          completedExerciseIds: ['ssild-01', 'ssild-02', 'ssild-03', 'ssild-04', 'ssild-05', 'ssild-06', 'ssild-07'],
          startedAt: initial.createdAt,
          completedAt: initial.createdAt,
        },
      ],
    };

    mockLoadState.mockResolvedValue({ state: persistedState, source: 'stored' });
    mockGetState.mockImplementation(async () => persistedState);
    mockUpdateState.mockImplementation(
      async (
        _scope: string,
        updater: (current: LucidTrainerState) => LucidTrainerState | Promise<LucidTrainerState>
      ) => {
        persistedState = await updater(persistedState);
        return persistedState;
      }
    );

    const { result } = renderHook(() => useLucidTrainer(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.startProgram('ssild');
    });

    expect(result.current.state?.progress.filter(
      (item: LucidTrainerState['progress'][number]) => item.status === 'active'
    )).toEqual([
      expect.objectContaining({ technique: 'mild', currentDay: 3 }),
    ]);
    expect(result.current.state?.progress.find(
      (item: LucidTrainerState['progress'][number]) => item.technique === 'ssild'
    )).toEqual(
      expect.objectContaining({
        status: 'completed',
        currentDay: 7,
        completedAt: initial.createdAt,
      })
    );
  });

  it('rejects completing the current session of a paused program until it is resumed', async () => {
    const initial = createInitialLucidTrainerState({
      now: 1_700_000_000_000,
      timeZone: 'UTC',
    }) as LucidTrainerState;
    let persistedState: LucidTrainerState = {
      ...initial,
      progress: [
        {
          ...createLucidProgramProgress('mild', initial.createdAt),
          status: 'active',
          currentDay: 3,
          completedExerciseIds: ['mild-01', 'mild-02'],
          startedAt: initial.createdAt,
        },
        {
          ...createLucidProgramProgress('ssild', initial.createdAt),
          status: 'paused',
          currentDay: 2,
          completedExerciseIds: ['ssild-01'],
          startedAt: initial.createdAt,
        },
      ],
    };

    mockLoadState.mockResolvedValue({ state: persistedState, source: 'stored' });
    mockGetState.mockImplementation(async () => persistedState);
    mockUpdateState.mockImplementation(
      async (
        _scope: string,
        updater: (current: LucidTrainerState) => LucidTrainerState | Promise<LucidTrainerState>
      ) => {
        persistedState = await updater(persistedState);
        return persistedState;
      }
    );

    const { result } = renderHook(() => useLucidTrainer(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await expect(
        result.current.completeProgramSession('ssild', 'ssild-02', 2, 7)
      ).rejects.toThrow('Lucid session is locked');
    });

    expect(result.current.error).toBe('Lucid session is locked');
    expect(result.current.state?.progress.filter(
      (item: LucidTrainerState['progress'][number]) => item.status === 'active'
    )).toEqual([
      expect.objectContaining({ technique: 'mild' }),
    ]);
    expect(result.current.state?.progress.find(
      (item: LucidTrainerState['progress'][number]) => item.technique === 'ssild'
    )).toEqual(
      expect.objectContaining({
        status: 'paused',
        currentDay: 2,
        completedExerciseIds: ['ssild-01'],
      })
    );
  });

  it('reconciles notification permission without replacing progress completed in parallel', async () => {
    const initial = createInitialLucidTrainerState({
      now: 1_700_000_000_000,
      timeZone: 'UTC',
    }) as LucidTrainerState;
    let persistedState: LucidTrainerState = {
      ...initial,
      onboarding: {
        ...initial.onboarding,
        status: 'completed',
        completedAt: initial.createdAt,
      },
    };
    let resolveReconciliation!: (value: LucidReminderReconciliationResult) => void;
    const pendingReconciliation = new Promise<LucidReminderReconciliationResult>((resolve) => {
      resolveReconciliation = resolve;
    });

    mockLoadState.mockResolvedValue({ state: persistedState, source: 'stored' });
    mockGetState.mockImplementation(async () => persistedState);
    mockUpdateState.mockImplementation(
      async (
        _scope: string,
        updater: (current: LucidTrainerState) => LucidTrainerState | Promise<LucidTrainerState>
      ) => {
        persistedState = await updater(persistedState);
        return persistedState;
      }
    );
    mockSaveState.mockImplementation(async (_scope: string, next: LucidTrainerState) => {
      persistedState = next;
    });
    mockReconcileReminders.mockReturnValueOnce(pendingReconciliation);

    const { result } = renderHook(() => useLucidTrainer(), { wrapper });
    await waitFor(() => expect(result.current.state).not.toBeNull());

    await act(async () => {
      await result.current.completeProgramSession('mild', 'mild-session-1', 1, 7);
    });

    await act(async () => {
      resolveReconciliation({
        permission: 'granted',
        canAskAgain: false,
        scheduledIds: [],
        cancelledIds: [],
        unchangedOccurrenceIds: [],
        timeContextChanged: false,
      });
      await pendingReconciliation;
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.state?.onboarding.notificationsPermission).toBe('granted');
    expect(result.current.state?.progress[0]?.completedExerciseIds).toContain('mild-session-1');
    expect(persistedState.onboarding.notificationsPermission).toBe('granted');
    expect(persistedState.progress[0]?.completedExerciseIds).toContain('mild-session-1');
    expect(mockSaveState).not.toHaveBeenCalled();
  });

  it('persists audio safety consent independently of onboarding', async () => {
    const initial = createInitialLucidTrainerState({
      now: 1_700_000_000_000,
      timeZone: 'UTC',
    }) as LucidTrainerState;
    let persistedState: LucidTrainerState = {
      ...initial,
      onboarding: {
        ...initial.onboarding,
        status: 'completed',
        completedAt: initial.createdAt,
        audioSafetyAccepted: false,
      },
    };

    mockLoadState.mockResolvedValue({ state: persistedState, source: 'stored' });
    mockGetState.mockImplementation(async () => persistedState);
    mockUpdateState.mockImplementation(
      async (
        _scope: string,
        updater: (current: LucidTrainerState) => LucidTrainerState | Promise<LucidTrainerState>
      ) => {
        persistedState = await updater(persistedState);
        return persistedState;
      }
    );

    const { result } = renderHook(() => useLucidTrainer(), { wrapper });
    await waitFor(() => expect(result.current.state).not.toBeNull());
    expect(result.current.state?.onboarding.audioSafetyAccepted).toBe(false);

    await act(async () => {
      await result.current.updateAudioSafetyConsent(true);
    });

    expect(result.current.state?.onboarding.audioSafetyAccepted).toBe(true);
    expect(persistedState.onboarding.audioSafetyAccepted).toBe(true);
    expect(persistedState.onboarding.status).toBe('completed');
  });

  it('rejects a future session at the context boundary', async () => {
    const initial = createInitialLucidTrainerState({
      now: 1_700_000_000_000,
      timeZone: 'UTC',
    }) as LucidTrainerState;
    let persistedState: LucidTrainerState = {
      ...initial,
      progress: [{
        ...createLucidProgramProgress('mild', initial.createdAt),
        status: 'active',
        currentDay: 1,
        updatedAt: initial.createdAt,
      }],
    };

    mockLoadState.mockResolvedValue({ state: persistedState, source: 'stored' });
    mockGetState.mockImplementation(async () => persistedState);
    mockUpdateState.mockImplementation(
      async (
        _scope: string,
        updater: (current: LucidTrainerState) => LucidTrainerState | Promise<LucidTrainerState>
      ) => {
        persistedState = await updater(persistedState);
        return persistedState;
      }
    );

    const { result } = renderHook(() => useLucidTrainer(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await expect(
        result.current.completeProgramSession('mild', 'mild-03', 3, 7)
      ).rejects.toThrow('Lucid session is locked');
    });
    expect(result.current.error).toBe('Lucid session is locked');
  });

  it('pauses a program with a monotonic updatedAt that outranks the current state', async () => {
    const { result } = renderHook(() => useLucidTrainer(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const now = 1_700_000_000_000;
    const seeded: LucidTrainerState = {
      ...(result.current.state as LucidTrainerState),
      updatedAt: now + 50,
      progress: [{
        ...createLucidProgramProgress('mild', now),
        status: 'active',
        currentDay: 2,
        completedExerciseIds: ['mild-01'],
        startedAt: now,
        updatedAt: now + 40,
      }],
    };
    mockUpdateState.mockImplementation(async (_scope: string, updater: (current: LucidTrainerState) => LucidTrainerState) =>
      updater(seeded)
    );

    await act(async () => {
      await result.current.pauseProgram('mild');
    });

    const updater = mockUpdateState.mock.calls.at(-1)?.[1] as (current: LucidTrainerState) => LucidTrainerState;
    const next = updater(seeded);
    const paused = next.progress.find((item) => item.technique === 'mild');
    expect(paused).toMatchObject({
      status: 'paused',
      currentDay: 2,
      completedExerciseIds: ['mild-01'],
    });
    expect(paused?.updatedAt).toBeGreaterThan(Math.max(now, seeded.updatedAt, seeded.progress[0].updatedAt));
  });

  it('rejects starting or completing WBTB when the safety policy forbids it', async () => {
    const initial = createInitialLucidTrainerState({
      now: 1_700_000_000_000,
      timeZone: 'UTC',
    }) as LucidTrainerState;
    let persistedState: LucidTrainerState = {
      ...initial,
      progress: [{
        ...createLucidProgramProgress('wbtb', initial.createdAt),
        status: 'active',
        currentDay: 1,
        startedAt: initial.createdAt,
      }],
    };

    mockLoadState.mockResolvedValue({ state: persistedState, source: 'stored' });
    mockGetState.mockImplementation(async () => persistedState);
    mockUpdateState.mockImplementation(
      async (
        _scope: string,
        updater: (current: LucidTrainerState) => LucidTrainerState | Promise<LucidTrainerState>
      ) => {
        persistedState = await updater(persistedState);
        return persistedState;
      }
    );

    const { result } = renderHook(() => useLucidTrainer(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await expect(result.current.startProgram('wbtb')).rejects.toThrow('audio_not_consented');
    });
    await act(async () => {
      await expect(
        result.current.completeProgramSession('wbtb', 'wbtb-01', 1, 7)
      ).rejects.toThrow('audio_not_consented');
    });

    expect(result.current.state?.progress.find(
      (item: LucidTrainerState['progress'][number]) => item.technique === 'wbtb'
    )).toEqual(expect.objectContaining({
      status: 'active',
      currentDay: 1,
      completedExerciseIds: [],
    }));
  });

  it('starts WBTB and still advances MILD when audio safety is the only missing night fact', async () => {
    const initial = createInitialLucidTrainerState({
      now: 1_700_000_000_000,
      timeZone: 'UTC',
    }) as LucidTrainerState;
    let persistedState: LucidTrainerState = {
      ...initial,
      onboarding: {
        ...initial.onboarding,
        audioSafetyAccepted: true,
      },
    };

    mockLoadState.mockResolvedValue({ state: persistedState, source: 'stored' });
    mockGetState.mockImplementation(async () => persistedState);
    mockUpdateState.mockImplementation(
      async (
        _scope: string,
        updater: (current: LucidTrainerState) => LucidTrainerState | Promise<LucidTrainerState>
      ) => {
        persistedState = await updater(persistedState);
        return persistedState;
      }
    );

    const { result } = renderHook(() => useLucidTrainer(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.startProgram('wbtb');
    });
    expect(result.current.state?.progress.find(
      (item: LucidTrainerState['progress'][number]) => item.technique === 'wbtb'
    )).toEqual(expect.objectContaining({ status: 'active', technique: 'wbtb' }));

    await act(async () => {
      await result.current.startProgram('mild');
    });
    await act(async () => {
      await result.current.completeProgramSession('mild', 'mild-01', 1, 7);
    });

    expect(result.current.state?.progress.find(
      (item: LucidTrainerState['progress'][number]) => item.technique === 'mild'
    )).toEqual(expect.objectContaining({
      status: 'active',
      completedExerciseIds: ['mild-01'],
    }));
    expect(result.current.state?.progress.find(
      (item: LucidTrainerState['progress'][number]) => item.technique === 'wbtb'
    )).toEqual(expect.objectContaining({ status: 'paused', technique: 'wbtb' }));
  });

  it('does not create WBTB progress when reviewing a completed program under a blocking policy', async () => {
    const initial = createInitialLucidTrainerState({
      now: 1_700_000_000_000,
      timeZone: 'UTC',
    }) as LucidTrainerState;
    let persistedState: LucidTrainerState = {
      ...initial,
      progress: [{
        ...createLucidProgramProgress('wbtb', initial.createdAt),
        status: 'completed',
        currentDay: 7,
        completedExerciseIds: ['wbtb-01', 'wbtb-02', 'wbtb-03', 'wbtb-04', 'wbtb-05', 'wbtb-06', 'wbtb-07'],
        startedAt: initial.createdAt,
        completedAt: initial.createdAt,
      }],
    };

    mockLoadState.mockResolvedValue({ state: persistedState, source: 'stored' });
    mockGetState.mockImplementation(async () => persistedState);
    mockUpdateState.mockImplementation(
      async (
        _scope: string,
        updater: (current: LucidTrainerState) => LucidTrainerState | Promise<LucidTrainerState>
      ) => {
        persistedState = await updater(persistedState);
        return persistedState;
      }
    );

    const { result } = renderHook(() => useLucidTrainer(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.startProgram('wbtb');
    });
    await act(async () => {
      await result.current.completeProgramSession('wbtb', 'wbtb-01', 1, 7);
    });

    expect(result.current.state?.progress.find(
      (item: LucidTrainerState['progress'][number]) => item.technique === 'wbtb'
    )).toEqual(expect.objectContaining({
      status: 'completed',
      currentDay: 7,
      completedAt: initial.createdAt,
    }));
  });

  it('still starts SSILD while WBTB is blocked by missing audio consent', async () => {
    const { result } = renderHook(() => useLucidTrainer(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.startProgram('ssild');
    });

    expect(result.current.state?.progress.find(
      (item: LucidTrainerState['progress'][number]) => item.technique === 'ssild'
    )).toEqual(expect.objectContaining({ status: 'active', technique: 'ssild' }));
  });

  it('persists completed practice dates in the stored timezone, not the host calendar', async () => {
    const NOW = Date.UTC(2026, 7, 26, 12, 0, 0);
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(NOW);
    try {
      const host = new Date(NOW);
      const hostLocalDate = `${host.getFullYear()}-${String(host.getMonth() + 1).padStart(2, '0')}-${String(host.getDate()).padStart(2, '0')}`;
      const utcDate = getLucidDateKeyInTimeZone(NOW, 'UTC');
      const preferenceDate = getLucidDateKeyInTimeZone(NOW, 'Pacific/Auckland');
      expect(utcDate).toBe('2026-08-26');
      expect(preferenceDate).toBe('2026-08-27');

      const initial = createInitialLucidTrainerState({
        now: NOW,
        timeZone: 'Pacific/Auckland',
      }) as LucidTrainerState;
      let persistedState: LucidTrainerState = {
        ...initial,
        progress: [
          {
            ...createLucidProgramProgress('mild', NOW),
            status: 'active',
            startedAt: NOW,
            updatedAt: NOW,
          },
        ],
      };
      mockLoadState.mockResolvedValue({ state: persistedState, source: 'stored' });
      mockGetState.mockImplementation(async () => persistedState);
      mockUpdateState.mockImplementation(
        async (
          _scope: string,
          updater: (current: LucidTrainerState) => LucidTrainerState | Promise<LucidTrainerState>
        ) => {
          persistedState = await updater(persistedState);
          return persistedState;
        }
      );

      const { result } = renderHook(() => useLucidTrainer(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.completeProgramSession('mild', 'mild-01', 1, 7);
      });

      const practiceDates = result.current.state?.progress.find(
        (item: LucidTrainerState['progress'][number]) => item.technique === 'mild'
      )?.practiceDates;
      expect(practiceDates).toEqual(['2026-08-27']);
      expect(practiceDates).not.toEqual([utcDate]);
      if (hostLocalDate !== preferenceDate) {
        expect(practiceDates).not.toEqual([hostLocalDate]);
      }
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('creates a morning capture with a deterministic auto-link and no invented technique', async () => {
    const NOW = Date.UTC(2026, 7, 27, 8, 0, 0);
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(NOW);
    try {
      const initial = createInitialLucidTrainerState({
        now: NOW,
        timeZone: 'UTC',
      }) as LucidTrainerState;
      let persistedState: LucidTrainerState = {
        ...initial,
        onboarding: { ...initial.onboarding, analyticsConsent: true, status: 'completed' },
        progress: [
          {
            ...createLucidProgramProgress('wbtb', NOW),
            status: 'active',
            practiceDates: ['2026-08-27'],
            startedAt: NOW,
            updatedAt: NOW,
          },
        ],
      };
      mockLoadState.mockResolvedValue({ state: persistedState, source: 'stored' });
      mockGetState.mockImplementation(async () => persistedState);
      mockUpdateState.mockImplementation(
        async (
          _scope: string,
          updater: (current: LucidTrainerState) => LucidTrainerState | Promise<LucidTrainerState>
        ) => {
          persistedState = await updater(persistedState);
          return persistedState;
        }
      );

      const { result } = renderHook(() => useLucidTrainer(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));

      let created: LucidTrainerState['experiments'][number] | undefined;
      await act(async () => {
        created = await result.current.addExperiment({
          technique: null,
          preparationMinutes: null,
          result: null,
          lucidityLevel: null,
          recallLevel: null,
          sleepQuality: null,
          factors: [],
          captureMode: 'write',
          recallText: '  fragments of a garden  ',
          cueOutcome: 'indeterminate',
        });
      });

      expect(created).toMatchObject({
        technique: null,
        captureMode: 'write',
        recallText: 'fragments of a garden',
        cueOutcome: 'indeterminate',
        techniqueAutoLink: {
          technique: 'wbtb',
          source: 'program_practice',
          practiceDate: '2026-08-27',
        },
      });
      expect(result.current.state?.experiments[0]).toEqual(created);
      expect(trackProductEvent).not.toHaveBeenCalled();

      await act(async () => {
        await result.current.addExperiment({
          technique: 'mild',
          preparationMinutes: 10,
          result: 'pre_lucid',
          lucidityLevel: 2,
          recallLevel: 3,
          sleepQuality: 4,
          factors: [],
          captureMode: 'speak',
          recallText: 'typed after the voice stub',
          cueOutcome: 'heard_in_dream',
          voiceCapture: 'stub',
        });
      });
      expect(trackProductEvent).toHaveBeenCalledWith('lucid_training_completed', {
        technique: 'mild',
        phase: 'morning',
        outcome: 'completed',
        duration: 'under_5m',
      });

      await act(async () => {
        await expect(
          result.current.addExperiment({
            technique: null,
            preparationMinutes: null,
            result: null,
            lucidityLevel: null,
            recallLevel: null,
            sleepQuality: null,
            factors: [],
            captureMode: 'write',
            recallText: '   ',
            cueOutcome: 'not_heard',
          })
        ).rejects.toThrow('Invalid Lucid experiment');
      });
    } finally {
      nowSpy.mockRestore();
    }
  });

});
