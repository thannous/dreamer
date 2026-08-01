/* @jest-environment jsdom */
import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockHarness = ((factory: any) => factory())(() => {
  const defaultState = () => ({
    schemaVersion: 1,
    experienceVersion: 2,
    status: 'not_started',
    step: null,
    selectedPath: null,
    completionReason: null,
    pendingRecordingIntent: null,
    startedAt: null,
    completedAt: null,
    updatedAt: Date.now(),
  });
  return {
    auth: { user: { id: 'one' } as any, loading: false },
    defaultState,
    getState: jest.fn(),
    claim: jest.fn(async () => undefined),
    persist: jest.fn(),
  };
});

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => mockHarness.auth,
}));

jest.mock('@/lib/onboardingState', () => ({
  getDefaultOnboardingState: () => mockHarness.defaultState(),
  claimGuestOnboardingState: (userId: string) => mockHarness.claim(userId),
  getOnboardingState: (scope: string) => mockHarness.getState(scope),
  persistOnboardingState: (scope: string, state: unknown) =>
    mockHarness.persist(scope, state),
  reduceOnboardingState: (state: any, event: any) => {
    const now = Date.now();
    if (event.type === 'SKIP') {
      return {
        ...state,
        status: 'skipped',
        completionReason: 'skip',
        completedAt: now,
        updatedAt: now,
      };
    }
    if (event.type === 'COMPLETE') {
      const path = event.path;
      return {
        ...state,
        status: 'completed',
        selectedPath: path,
        completionReason: path,
        completedAt: now,
        updatedAt: now,
        pendingRecordingIntent:
          path === 'dictionary'
            ? null
            : {
                entryId: 'session-entry',
                intent: path === 'memory' ? 'remembered' : 'fresh',
                source: 'onboarding',
                postSave: path === 'memory' ? 'journal_first' : 'confirm_analysis',
                phase: 'capture',
                createdAt: now,
                expiresAt: now + 86_400_000,
              },
      };
    }
    if (event.type === 'START') {
      return {
        ...state,
        status: 'in_progress',
        step: state.step ?? 'intro',
        startedAt: state.startedAt ?? now,
        updatedAt: now,
      };
    }
    if (event.type === 'GO_TO_STEP') {
      return {
        ...state,
        status: 'in_progress',
        step: event.step,
        selectedPath: event.step === 'path' ? state.selectedPath ?? 'analyze' : state.selectedPath,
        startedAt: state.startedAt ?? now,
        updatedAt: now,
      };
    }
    if (event.type === 'SELECT_PATH') {
      return {
        ...state,
        status: 'in_progress',
        step: 'path',
        selectedPath: event.path,
        startedAt: state.startedAt ?? now,
        updatedAt: now,
      };
    }
    if (event.type === 'SET_PENDING_PHASE' && state.pendingRecordingIntent) {
      return {
        ...state,
        pendingRecordingIntent: {
          ...state.pendingRecordingIntent,
          phase: event.phase,
          ...(event.savedDreamId !== undefined ? { savedDreamId: event.savedDreamId } : {}),
        },
        updatedAt: now,
      };
    }
    return state;
  },
}));

const { OnboardingProvider, useOnboarding } = require('../OnboardingContext');

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <OnboardingProvider>{children}</OnboardingProvider>
);

describe('OnboardingContext scope isolation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHarness.auth = { user: { id: 'one' }, loading: false };
    mockHarness.getState.mockResolvedValue(mockHarness.defaultState());
    mockHarness.persist.mockImplementation(async (_scope: string, state: unknown) => state);
  });

  it('exposes loading and not_started while a new account scope is unresolved', async () => {
    const firstState = {
      ...mockHarness.defaultState(),
      status: 'completed',
      selectedPath: 'dictionary',
      completionReason: 'dictionary',
      completedAt: 10,
    };
    let resolveSecond!: (value: any) => void;
    const secondStatePromise = new Promise<any>((resolve) => {
      resolveSecond = resolve;
    });
    mockHarness.getState.mockImplementation((scope: string) =>
      scope === 'user:one' ? Promise.resolve(firstState) : secondStatePromise
    );

    const { result, rerender } = renderHook(() => useOnboarding(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.state.status).toBe('completed');

    mockHarness.auth = { user: { id: 'two' }, loading: false };
    rerender();

    expect(result.current.scope).toBe('user:two');
    expect(result.current.loading).toBe(true);
    expect(result.current.state.status).toBe('not_started');

    await act(async () => {
      resolveSecond(mockHarness.defaultState());
      await secondStatePromise;
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.state.status).toBe('not_started');
  });

  it('keeps the failed scope on a safe default and exposes the write/load error', async () => {
    mockHarness.getState.mockRejectedValueOnce(new Error('read failed'));
    const { result } = renderHook(() => useOnboarding(), { wrapper });

    await waitFor(() => expect(result.current.error?.message).toBe('read failed'));
    expect(result.current.loading).toBe(false);
    expect(result.current.state.status).toBe('not_started');
  });

  it('continues the selected action and later phases for this session without persisting', async () => {
    const { result } = renderHook(() => useOnboarding(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.continueForSession('analyze'));

    expect(result.current.state).toMatchObject({
      status: 'completed',
      selectedPath: 'analyze',
      completionReason: 'analyze',
      pendingRecordingIntent: { postSave: 'confirm_analysis' },
    });
    expect(mockHarness.persist).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.transition({
        type: 'SET_PENDING_PHASE',
        phase: 'analysis_confirmation',
        savedDreamId: 42,
      });
    });

    expect(result.current.state).toMatchObject({
      status: 'completed',
      completionReason: 'analyze',
      pendingRecordingIntent: {
        phase: 'analysis_confirmation',
        savedDreamId: 42,
      },
    });
    expect(mockHarness.persist).not.toHaveBeenCalled();
  });

  it('renders a nonterminal transition before its persistence completes', async () => {
    let resolvePersist!: (value: unknown) => void;
    const persistence = new Promise(resolve => {
      resolvePersist = resolve;
    });
    mockHarness.persist.mockReturnValueOnce(persistence);
    const { result } = renderHook(() => useOnboarding(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    let transitionPromise!: Promise<unknown>;
    act(() => {
      transitionPromise = result.current.transition({ type: 'GO_TO_STEP', step: 'path' });
    });

    expect(result.current.state).toMatchObject({ step: 'path', selectedPath: 'analyze' });
    expect(mockHarness.persist).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolvePersist(result.current.state);
      await transitionPromise;
    });
  });

  it('rolls back to the last durable state when the latest write fails', async () => {
    mockHarness.persist.mockRejectedValueOnce(new Error('write failed'));
    const { result } = renderHook(() => useOnboarding(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await expect(
        result.current.transition({ type: 'GO_TO_STEP', step: 'path' })
      ).rejects.toThrow('write failed');
    });

    expect(result.current.state).toMatchObject({ status: 'not_started', step: null });
    expect(result.current.error?.message).toBe('write failed');
  });

  it('does not let a stale failed write overwrite a newer optimistic state', async () => {
    let rejectFirst!: (error: Error) => void;
    mockHarness.persist
      .mockImplementationOnce(
        () => new Promise((_resolve, reject) => {
          rejectFirst = reject;
        })
      )
      .mockImplementationOnce(async (_scope: string, state: unknown) => state);
    const { result } = renderHook(() => useOnboarding(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    let first!: Promise<unknown>;
    let second!: Promise<unknown>;
    act(() => {
      first = result.current.transition({ type: 'GO_TO_STEP', step: 'path' });
      second = result.current.transition({ type: 'SELECT_PATH', path: 'memory' });
    });

    await act(async () => {
      await second;
      rejectFirst(new Error('stale write failed'));
      await expect(first).rejects.toThrow('stale write failed');
    });

    expect(result.current.state).toMatchObject({
      status: 'in_progress',
      step: 'path',
      selectedPath: 'memory',
    });
    expect(result.current.error).toBeNull();
  });
});
