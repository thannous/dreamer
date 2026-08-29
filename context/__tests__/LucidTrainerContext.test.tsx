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
const mockQueueMutation = jest.fn();
const mockCreateMutation = jest.fn((input: unknown) => input);
let mockDreams: { id: number; title: string; transcript: string }[] = [];
let mockDreamsLoaded = true;

jest.mock('react-native', () => jest.requireActual('../../tests/react-native-stub'));
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en-US' }] }));
jest.mock('expo-crypto', () => ({ randomUUID: () => '00000000-0000-4000-8000-000000000001' }));

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));
jest.mock('@/context/DreamsContext', () => ({
  useDreamsData: () => ({ dreams: mockDreams, loaded: mockDreamsLoaded }),
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
  createLucidTrainerMutation: (input: unknown) => mockCreateMutation(input),
  pullLucidTrainerRemoteState: jest.fn(),
  queueLucidTrainerMutation: (...args: unknown[]) => mockQueueMutation(...args),
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
    mockDreams = [];
    mockDreamsLoaded = true;
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
      wakeSensitivity: 'not_sensitive',
      weeklyTarget: 3,
      sleepSchedule: { bedtime: '22:30', wakeTime: '07:00', timeZone: 'UTC' },
      sleepScheduleConfirmed: true,
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

  it('merges durable onboarding draft answers without triggering optional services', async () => {
    let persistedState = createInitialLucidTrainerState({
      now: 1_700_000_000_000,
      timeZone: 'UTC',
    }) as LucidTrainerState;
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
      await result.current.saveOnboardingDraft({
        draftStep: 0,
        goal: 'first_lucid_dream',
        sleepScheduleDraft: { bedtime: '23:15', wakeTime: null },
      });
      await result.current.saveOnboardingDraft({
        draftStep: 2,
        experience: 'beginner',
        sleepSchedule: { bedtime: '23:15', wakeTime: '07:45', timeZone: 'UTC' },
        sleepScheduleDraft: { bedtime: '23:15', wakeTime: '07:45' },
        sleepScheduleConfirmed: true,
        wakeSensitivity: 'sensitive',
      });
    });

    expect(persistedState.onboarding).toMatchObject({
      status: 'in_progress',
      draftStep: 2,
      goal: 'first_lucid_dream',
      experience: 'beginner',
      wakeSensitivity: 'sensitive',
      sleepSchedule: { bedtime: '23:15', wakeTime: '07:45', timeZone: 'UTC' },
      sleepScheduleDraft: { bedtime: '23:15', wakeTime: '07:45' },
      sleepScheduleConfirmed: true,
    });
    expect(result.current.state?.onboarding).toMatchObject(persistedState.onboarding);
    expect(mockReconcileReminders).not.toHaveBeenCalled();
    expect(mockQueueMutation).not.toHaveBeenCalled();
    expect(trackProductEvent).not.toHaveBeenCalled();
  });

  it('never downgrades a completed onboarding when a late draft save arrives', async () => {
    const initial = createInitialLucidTrainerState({
      now: 1_700_000_000_000,
      timeZone: 'UTC',
    }) as LucidTrainerState;
    let persistedState: LucidTrainerState = {
      ...initial,
      onboarding: {
        ...initial.onboarding,
        status: 'completed',
        goal: 'improve_recall',
        experience: 'beginner',
        wakeSensitivity: 'not_sensitive',
        sleepScheduleConfirmed: true,
        completedAt: initial.createdAt,
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
    const before = persistedState;

    await act(async () => {
      await result.current.saveOnboardingDraft({
        draftStep: 1,
        goal: 'stabilize_lucidity',
      });
    });

    expect(persistedState).toBe(before);
    expect(result.current.state?.onboarding).toMatchObject({
      status: 'completed',
      goal: 'improve_recall',
      draftStep: 0,
    });
    expect(mockQueueMutation).not.toHaveBeenCalled();
  });

  it('rejects an incomplete completion payload without persisting completion', async () => {
    let persistedState = createInitialLucidTrainerState({
      now: 1_700_000_000_000,
      timeZone: 'UTC',
    }) as LucidTrainerState;
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
    const incomplete = {
      goal: 'improve_recall',
      experience: 'beginner',
      wakeSensitivity: null,
      weeklyTarget: 3,
      sleepSchedule: { bedtime: '22:30', wakeTime: '07:00', timeZone: 'UTC' },
      sleepScheduleConfirmed: false,
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
    } as unknown as Parameters<typeof result.current.completeOnboarding>[0];

    await act(async () => {
      await expect(result.current.completeOnboarding(incomplete)).rejects.toThrow(
        'Lucid onboarding is incomplete: wakeSensitivity, sleepScheduleConfirmed'
      );
    });

    expect(persistedState.onboarding.status).toBe('not_started');
    expect(persistedState.onboarding.completedAt).toBeNull();
    expect(mockQueueMutation).not.toHaveBeenCalled();
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

  it('persists guided-ritual start, progress, abandon, resume and atomic completion', async () => {
    let persistedState = createInitialLucidTrainerState({
      now: 1_700_000_000_000,
      timeZone: 'UTC',
    }) as LucidTrainerState;
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
    const mutation = {
      technique: 'mild' as const,
      exerciseId: 'mild-01',
      sessionNumber: 1,
      sessionCount: 7,
    };

    await act(async () => {
      await result.current.updateGuidedRitual({ ...mutation, action: 'start' });
    });
    expect(result.current.state?.progress[0]?.guidedRitual).toMatchObject({
      sessionId: 'mild:mild-01',
      status: 'in_progress',
      stepIndex: 0,
      stepCount: 5,
      mode: 'full',
    });

    await act(async () => {
      await result.current.updateGuidedRitual({ ...mutation, action: 'advance' });
      await result.current.updateGuidedRitual({ ...mutation, action: 'abandon' });
    });
    expect(result.current.state?.progress[0]?.guidedRitual).toMatchObject({
      status: 'abandoned',
      stepIndex: 1,
    });

    await act(async () => {
      await result.current.updateGuidedRitual({ ...mutation, action: 'resume' });
    });
    expect(result.current.state?.progress[0]?.guidedRitual).toMatchObject({
      status: 'in_progress',
      stepIndex: 1,
    });

    await act(async () => {
      await result.current.updateGuidedRitual({ ...mutation, action: 'advance' });
      await result.current.updateGuidedRitual({ ...mutation, action: 'advance' });
      await result.current.updateGuidedRitual({ ...mutation, action: 'advance' });
      await result.current.completeGuidedRitualSession('mild', 'mild-01', 1, 7);
    });

    expect(result.current.state?.progress[0]).toMatchObject({
      technique: 'mild',
      status: 'active',
      currentDay: 2,
      completedExerciseIds: ['mild-01'],
      guidedRitual: {
        status: 'completed',
        stepIndex: 4,
        stepCount: 5,
      },
    });
    expect(persistedState.progress[0]?.guidedRitual?.completedAt).not.toBeNull();
  });

  it('never partially completes a guided ritual and enforces sequential access', async () => {
    let persistedState = createInitialLucidTrainerState({
      now: 1_700_000_000_000,
      timeZone: 'UTC',
    }) as LucidTrainerState;
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
      await result.current.updateGuidedRitual({
        technique: 'ssild',
        exerciseId: 'ssild-01',
        sessionNumber: 1,
        sessionCount: 7,
        action: 'start',
      });
      await expect(
        result.current.completeGuidedRitualSession('ssild', 'ssild-01', 1, 7)
      ).rejects.toThrow('final phase');
    });

    expect(persistedState.progress[0]?.completedExerciseIds).toEqual([]);
    expect(persistedState.progress[0]?.guidedRitual?.status).toBe('in_progress');

    await act(async () => {
      await expect(result.current.updateGuidedRitual({
        technique: 'ssild',
        exerciseId: 'ssild-03',
        sessionNumber: 3,
        sessionCount: 7,
        action: 'start',
      })).rejects.toThrow('Lucid session is locked');
    });
    expect(persistedState.progress[0]?.guidedRitual?.sessionId).toBe('ssild:ssild-01');
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

  it('persists only explicit dream-sign decisions and deletes them when source evidence disappears', async () => {
    const initial = createInitialLucidTrainerState({
      now: 1_700_000_000_000,
      timeZone: 'UTC',
    }) as LucidTrainerState;
    let persistedState: LucidTrainerState = {
      ...initial,
      preferences: { ...initial.preferences, cloudSyncEnabled: true },
    };
    mockDreams = [
      { id: 101, title: 'Mirror hallway', transcript: 'A mirror stood in the hallway.' },
      { id: 102, title: 'Mirror room', transcript: 'The same mirror appeared again.' },
    ];
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

    const { result, rerender } = renderHook(() => useLucidTrainer(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.activeDreamSigns).toEqual([]);
    const mirror = result.current.dreamSignCandidates.find(
      (item: { id: string; sourceDreamIds: string[] }) => item.id === 'sign:mirror'
    );
    expect(mirror?.sourceDreamIds).toEqual(['101', '102']);

    await act(async () => {
      await result.current.saveDreamSignDecision({
        id: mirror!.id,
        decision: 'confirmed',
        customLabel: 'My mirror',
        sourceDreamIds: mirror!.sourceDreamIds,
      });
    });

    expect(persistedState.dreamSignDecisions).toEqual([
      expect.objectContaining({
        id: 'sign:mirror',
        decision: 'confirmed',
        customLabel: 'My mirror',
        sourceDreamIds: ['101', '102'],
      }),
    ]);
    expect(result.current.activeDreamSigns).toEqual([
      expect.objectContaining({ id: 'sign:mirror', label: 'My mirror' }),
    ]);
    expect(mockCreateMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'upsert',
        entity: expect.objectContaining({ entityType: 'dream_sign', entityKey: 'sign:mirror' }),
      })
    );

    mockCreateMutation.mockClear();
    mockQueueMutation.mockClear();
    mockDreams = [mockDreams[0]];
    rerender();

    await waitFor(() => expect(persistedState.dreamSignDecisions).toEqual([]));
    expect(result.current.activeDreamSigns).toEqual([]);
    expect(mockCreateMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'delete',
        entityType: 'dream_sign',
        entityKey: 'sign:mirror',
      })
    );
  });

  it('updates dream atlas preferences and queues a cloud upsert', async () => {
    const now = 1_720_000_000_000;
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(now);
    const initial = createInitialLucidTrainerState({
      now: 1_700_000_000_000,
      timeZone: 'UTC',
    }) as LucidTrainerState;
    let persistedState: LucidTrainerState = {
      ...initial,
      preferences: { ...initial.preferences, cloudSyncEnabled: true },
      dreamSignDecisions: [
        {
          id: 'sign:mirror',
          decision: 'confirmed',
          sourceDreamIds: ['101', '102'],
          updatedAt: 1_705_000_000_000,
        },
      ],
    };
    mockDreams = [
      { id: 101, title: 'Mirror hallway', transcript: 'A mirror stood in the hallway.' },
      { id: 102, title: 'Mirror room', transcript: 'The same mirror appeared again.' },
    ];
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

    try {
      const { result } = renderHook(() => useLucidTrainer(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));
      await act(async () => {
        await Promise.resolve();
      });
      mockCreateMutation.mockClear();
      mockQueueMutation.mockClear();

      let saved: unknown;
      await act(async () => {
        saved = await result.current.updateDreamAtlasPreferences((current: {
          hidden: string[];
        }) => ({
          ...current,
          hidden: ['sign:mirror'],
        }));
      });

      expect(saved).toEqual({
        version: 1,
        renamed: {},
        hidden: ['sign:mirror'],
        merges: {},
        deleted: [],
      });
      expect(persistedState.dreamAtlas).toEqual({
        version: 1,
        renamed: {},
        hidden: ['sign:mirror'],
        merges: {},
        deleted: [],
        updatedAt: now,
      });
      expect(result.current.state?.dreamAtlas).toEqual(persistedState.dreamAtlas);
      expect(mockCreateMutation).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'upsert',
          entity: expect.objectContaining({
            entityType: 'dream_atlas',
            entityKey: 'dream_atlas',
            value: persistedState.dreamAtlas,
          }),
        })
      );
      expect(mockQueueMutation).toHaveBeenCalled();
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('does not queue a dream atlas mutation when the updater is a no-op', async () => {
    const initial = createInitialLucidTrainerState({
      now: 1_700_000_000_000,
      timeZone: 'UTC',
    }) as LucidTrainerState;
    let persistedState: LucidTrainerState = {
      ...initial,
      preferences: { ...initial.preferences, cloudSyncEnabled: true },
      dreamSignDecisions: [
        {
          id: 'sign:mirror',
          decision: 'confirmed',
          sourceDreamIds: ['101', '102'],
          updatedAt: 1_705_000_000_000,
        },
      ],
      dreamAtlas: {
        version: 1,
        renamed: {},
        hidden: ['sign:mirror'],
        merges: {},
        deleted: [],
        updatedAt: 1_710_000_000_000,
      },
    };
    mockDreams = [
      { id: 101, title: 'Mirror hallway', transcript: 'A mirror stood in the hallway.' },
      { id: 102, title: 'Mirror room', transcript: 'The same mirror appeared again.' },
    ];
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
    const before = persistedState;
    mockCreateMutation.mockClear();
    mockQueueMutation.mockClear();

    let saved: unknown;
    await act(async () => {
      saved = await result.current.updateDreamAtlasPreferences((current: unknown) => current);
    });

    expect(saved).toEqual({
      version: 1,
      renamed: {},
      hidden: ['sign:mirror'],
      merges: {},
      deleted: [],
    });
    expect(persistedState).toBe(before);
    expect(persistedState.dreamAtlas?.updatedAt).toBe(1_710_000_000_000);
    expect(mockCreateMutation).not.toHaveBeenCalled();
    expect(mockQueueMutation).not.toHaveBeenCalled();
  });

  it('clears dream atlas preferences with an empty overlay upsert and leaves onboarding and preferences intact', async () => {
    const now = 1_730_000_000_000;
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(now);
    const initial = createInitialLucidTrainerState({
      now: 1_700_000_000_000,
      timeZone: 'UTC',
    }) as LucidTrainerState;
    let persistedState: LucidTrainerState = {
      ...initial,
      onboarding: {
        ...initial.onboarding,
        status: 'completed',
        goal: 'improve_recall',
        experience: 'beginner',
        wakeSensitivity: 'not_sensitive',
        sleepScheduleConfirmed: true,
        completedAt: initial.createdAt,
      },
      preferences: { ...initial.preferences, cloudSyncEnabled: true, noctaliaLinkEnabled: true },
      dreamAtlas: {
        version: 1,
        renamed: { 'sign:marie': 'Marie' },
        hidden: ['sign:marie'],
        merges: {},
        deleted: ['sign:old'],
        updatedAt: 1_710_000_000_000,
      },
    };
    const onboardingBefore = persistedState.onboarding;
    const preferencesBefore = persistedState.preferences;
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

    try {
      const { result } = renderHook(() => useLucidTrainer(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));
      await waitFor(() =>
        expect(persistedState.dreamAtlas).toEqual({
          version: 1,
          renamed: {},
          hidden: [],
          merges: {},
          deleted: ['sign:old'],
          updatedAt: now,
        })
      );
      mockCreateMutation.mockClear();
      mockQueueMutation.mockClear();

      await act(async () => {
        await result.current.clearDreamAtlasPreferences();
        await result.current.clearDreamAtlasPreferences();
      });

      const emptyOverlay = {
        version: 1,
        renamed: {},
        hidden: [],
        merges: {},
        deleted: [],
        updatedAt: now,
      };
      expect(persistedState.dreamAtlas).toEqual(emptyOverlay);
      expect(result.current.state?.dreamAtlas).toEqual(emptyOverlay);
      expect(persistedState.onboarding).toBe(onboardingBefore);
      expect(persistedState.preferences).toBe(preferencesBefore);
      expect(mockCreateMutation).toHaveBeenCalledTimes(2);
      expect(mockCreateMutation).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          operation: 'upsert',
          entity: expect.objectContaining({
            entityType: 'dream_atlas',
            entityKey: 'dream_atlas',
            value: emptyOverlay,
          }),
        })
      );
      expect(mockCreateMutation).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          operation: 'upsert',
          entity: expect.objectContaining({
            entityType: 'dream_atlas',
            entityKey: 'dream_atlas',
            value: emptyOverlay,
          }),
        })
      );
      expect(mockQueueMutation).toHaveBeenCalledTimes(2);
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('does not purge dream atlas orphans while dreams are still loading', async () => {
    const initial = createInitialLucidTrainerState({
      now: 1_700_000_000_000,
      timeZone: 'UTC',
    }) as LucidTrainerState;
    const overlay = {
      version: 1,
      renamed: { 'sign:ghost': 'Ghost' },
      hidden: ['sign:ghost'],
      merges: { 'sign:ghost': 'sign:mirror' },
      deleted: ['sign:old'],
      updatedAt: 1_710_000_000_000,
    };
    let persistedState: LucidTrainerState = {
      ...initial,
      dreamAtlas: overlay,
    };
    mockDreamsLoaded = false;
    mockDreams = [];
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
      await Promise.resolve();
    });

    expect(persistedState.dreamAtlas).toEqual(overlay);
    expect(result.current.state?.dreamAtlas).toEqual(overlay);
    expect(mockCreateMutation).not.toHaveBeenCalled();
    expect(mockQueueMutation).not.toHaveBeenCalled();
  });

  it('purges orphan atlas overlays after dreams load and keeps deleted tombstones', async () => {
    const now = 1_740_000_000_000;
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(now);
    const initial = createInitialLucidTrainerState({
      now: 1_700_000_000_000,
      timeZone: 'UTC',
    }) as LucidTrainerState;
    let persistedState: LucidTrainerState = {
      ...initial,
      preferences: { ...initial.preferences, cloudSyncEnabled: true },
      dreamSignDecisions: [
        {
          id: 'sign:mirror',
          decision: 'confirmed',
          sourceDreamIds: ['101', '102'],
          updatedAt: 1_705_000_000_000,
        },
      ],
      dreamAtlas: {
        version: 1,
        renamed: { 'sign:mirror': 'My mirror', 'sign:ghost': 'Ghost' },
        hidden: ['sign:ghost', 'sign:mirror'],
        merges: { 'sign:ghost': 'sign:mirror' },
        deleted: ['sign:old'],
        updatedAt: 1_710_000_000_000,
      },
    };
    mockDreams = [
      { id: 101, title: 'Mirror hallway', transcript: 'A mirror stood in the hallway.' },
      { id: 102, title: 'Mirror room', transcript: 'The same mirror appeared again.' },
    ];
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

    try {
      const { result } = renderHook(() => useLucidTrainer(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));
      await waitFor(() =>
        expect(persistedState.dreamAtlas).toEqual({
          version: 1,
          renamed: { 'sign:mirror': 'My mirror' },
          hidden: ['sign:mirror'],
          merges: {},
          deleted: ['sign:old'],
          updatedAt: now,
        })
      );

      expect(result.current.state?.dreamAtlas).toEqual(persistedState.dreamAtlas);
      expect(persistedState.dreamSignDecisions).toEqual([
        expect.objectContaining({
          id: 'sign:mirror',
          decision: 'confirmed',
          sourceDreamIds: ['101', '102'],
        }),
      ]);
      expect(mockCreateMutation).toHaveBeenCalledTimes(1);
      expect(mockCreateMutation).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'upsert',
          entity: expect.objectContaining({
            entityType: 'dream_atlas',
            entityKey: 'dream_atlas',
            value: persistedState.dreamAtlas,
          }),
        })
      );
      expect(mockQueueMutation).toHaveBeenCalledTimes(1);
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('does not commit a dream atlas upsert when preferences are already equivalent', async () => {
    const initial = createInitialLucidTrainerState({
      now: 1_700_000_000_000,
      timeZone: 'UTC',
    }) as LucidTrainerState;
    const overlay = {
      version: 1,
      renamed: { 'sign:mirror': 'My mirror' },
      hidden: ['sign:mirror'],
      merges: {},
      deleted: ['sign:old'],
      updatedAt: 1_710_000_000_000,
    };
    let persistedState: LucidTrainerState = {
      ...initial,
      preferences: { ...initial.preferences, cloudSyncEnabled: true },
      dreamSignDecisions: [
        {
          id: 'sign:mirror',
          decision: 'confirmed',
          sourceDreamIds: ['101', '102'],
          updatedAt: 1_705_000_000_000,
        },
      ],
      dreamAtlas: overlay,
    };
    mockDreams = [
      { id: 101, title: 'Mirror hallway', transcript: 'A mirror stood in the hallway.' },
      { id: 102, title: 'Mirror room', transcript: 'The same mirror appeared again.' },
    ];
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
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(persistedState.dreamAtlas).toEqual(overlay);
    expect(result.current.state?.dreamAtlas).toEqual(overlay);
    expect(mockCreateMutation).not.toHaveBeenCalled();
    expect(mockQueueMutation).not.toHaveBeenCalled();
  });

  it('tolerates a missing dream atlas overlay without writing an empty equivalent', async () => {
    const initial = createInitialLucidTrainerState({
      now: 1_700_000_000_000,
      timeZone: 'UTC',
    }) as LucidTrainerState;
    let persistedState = { ...initial } as LucidTrainerState;
    delete persistedState.dreamAtlas;
    mockDreams = [
      { id: 101, title: 'Mirror hallway', transcript: 'A mirror stood in the hallway.' },
      { id: 102, title: 'Mirror room', transcript: 'The same mirror appeared again.' },
    ];
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
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(persistedState.dreamAtlas).toBeUndefined();
    expect(result.current.state?.dreamAtlas).toBeUndefined();
    expect(mockCreateMutation).not.toHaveBeenCalled();
    expect(mockQueueMutation).not.toHaveBeenCalled();
  });

});
