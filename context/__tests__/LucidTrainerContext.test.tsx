/* @jest-environment jsdom */

import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';

import type { LucidTrainerState } from '@/lib/lucid/model';

const mockClaimGuestScope = jest.fn();
const mockHasGuestData = jest.fn();
const mockLoadState = jest.fn();
const mockGetState = jest.fn();
const mockLoadQueue = jest.fn();
const mockUpdateQueue = jest.fn();
const mockUpdateState = jest.fn();
const mockClearLocalData = jest.fn();

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
  reconcileLucidTrainerReminders: jest.fn(),
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
  saveLucidTrainerState: jest.fn(),
  updateLucidTrainerState: (...args: unknown[]) => mockUpdateState(...args),
  updateLucidTrainerSyncQueue: (...args: unknown[]) => mockUpdateQueue(...args),
}));

const { createInitialLucidTrainerState } = require('@/lib/lucid/domain');
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

  it('pauses other active programs when startProgram is called', async () => {
    const { createLucidProgramProgress } = require('@/lib/lucid/domain');
    const { result } = renderHook(() => useLucidTrainer(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const seeded: LucidTrainerState = {
      ...(result.current.state as LucidTrainerState),
      progress: [
        {
          ...createLucidProgramProgress('mild', 1_700_000_000_000),
          status: 'active',
          currentDay: 3,
          completedExerciseIds: ['mild-01'],
          startedAt: 1_700_000_000_000,
          updatedAt: 1_700_000_000_000,
        },
      ],
    };
    mockUpdateState.mockImplementation(async (_scope: string, updater: (current: typeof seeded) => typeof seeded) =>
      updater(seeded)
    );

    await act(async () => {
      await result.current.startProgram('ssild');
    });

    const updater = mockUpdateState.mock.calls.at(-1)?.[1] as (current: typeof seeded) => typeof seeded;
    const next = updater(seeded);
    expect(next.progress.filter((item) => item.status === 'active').map((item) => item.technique)).toEqual([
      'ssild',
    ]);
    expect(next.progress.find((item) => item.technique === 'mild')).toMatchObject({
      status: 'paused',
      currentDay: 3,
      completedExerciseIds: ['mild-01'],
    });
  });

  it('rejects a future session at the context boundary', async () => {
    const { createLucidProgramProgress } = require('@/lib/lucid/domain');
    const { result } = renderHook(() => useLucidTrainer(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const seeded: LucidTrainerState = {
      ...(result.current.state as LucidTrainerState),
      progress: [{
        ...createLucidProgramProgress('mild', 1_700_000_000_000),
        status: 'active',
        currentDay: 1,
        updatedAt: 1_700_000_000_000,
      }],
    };
    mockUpdateState.mockImplementation(async (_scope: string, updater: (current: LucidTrainerState) => LucidTrainerState) =>
      updater(seeded)
    );

    await act(async () => {
      await expect(
        result.current.completeProgramSession('mild', 'mild-03', 3, 7)
      ).rejects.toThrow('Lucid session is locked');
    });
    expect(result.current.error).toBe('Lucid session is locked');
  });

  it('pauses a program with a monotonic updatedAt that outranks the current state', async () => {
    const { createLucidProgramProgress } = require('@/lib/lucid/domain');
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
});
