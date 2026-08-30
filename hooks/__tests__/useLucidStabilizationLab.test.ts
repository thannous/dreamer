/* @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import { useLucidStabilizationLab } from '@/hooks/useLucidStabilizationLab';
import {
  advanceLucidStabilizationLabSession,
  completeLucidStabilizationLabSession,
  createLucidStabilizationLabSession,
  createLucidStabilizationLabSessionId,
  interruptLucidStabilizationLabSession,
  pauseLucidStabilizationLabSession,
  projectLucidStabilizationLabInsights,
  repeatLucidStabilizationLabStep,
  startLucidStabilizationLabSession,
  type LucidStabilizationLabSession,
} from '@/lib/lucid/stabilizationLab';
import {
  LucidStabilizationLabStorageError,
  clearLucidStabilizationLabSessions,
  loadLucidStabilizationLabSessions,
  updateLucidStabilizationLabSessions,
} from '@/services/lucidStabilizationLabStorage';

const NOW = 1_700_000_000_000;

jest.mock('@/services/lucidStabilizationLabStorage', () => {
  const actual = jest.requireActual('@/services/lucidStabilizationLabStorage');
  return {
    ...actual,
    loadLucidStabilizationLabSessions: jest.fn(),
    updateLucidStabilizationLabSessions: jest.fn(),
    clearLucidStabilizationLabSessions: jest.fn(),
  };
});

const loadSessions = jest.mocked(loadLucidStabilizationLabSessions);
const updateSessions = jest.mocked(updateLucidStabilizationLabSessions);
const clearSessions = jest.mocked(clearLucidStabilizationLabSessions);

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function idle(sessionId = 'stab_one', now = NOW): LucidStabilizationLabSession {
  return createLucidStabilizationLabSession({ now, sessionId });
}

function started(sessionId = 'stab_one', now = NOW + 1): LucidStabilizationLabSession {
  return startLucidStabilizationLabSession(idle(sessionId, NOW), now);
}

function renderLab(
  initial: { userScope?: string; now?: number | (() => number); entropy?: string | (() => string) } = {}
) {
  return renderHook(
    ({ userScope, now, entropy }) => useLucidStabilizationLab({ userScope, now, entropy }),
    {
      initialProps: {
        userScope: initial.userScope ?? 'guest',
        now: initial.now ?? NOW + 10,
        entropy: initial.entropy ?? 'abc123',
      },
    }
  );
}

describe('useLucidStabilizationLab', () => {
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    loadSessions.mockReset();
    updateSessions.mockReset();
    clearSessions.mockReset();
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it('loads copied sessions, current practice and domain insights', async () => {
    const load = deferred<LucidStabilizationLabSession[]>();
    loadSessions.mockReturnValueOnce(load.promise);
    const { result } = renderLab();
    expect(result.current.sessions).toEqual([]);
    expect(result.current.currentSession).toBeNull();
    expect(result.current.isLoading).toBe(true);

    const active = started();
    await act(async () => {
      load.resolve([active]);
      await load.promise;
    });

    expect(loadSessions).toHaveBeenCalledWith('guest');
    expect(result.current.sessions).toEqual([active]);
    expect(result.current.sessions[0]).not.toBe(active);
    expect(result.current.currentSession).toEqual(active);
    expect(result.current.insights).toEqual(projectLucidStabilizationLabInsights([active]));
    expect(result.current.isLoading).toBe(false);
  });

  it('does not write before the current scope has loaded', async () => {
    const load = deferred<LucidStabilizationLabSession[]>();
    loadSessions.mockReturnValueOnce(load.promise);
    const { result } = renderLab();
    await act(async () => {
      await result.current.startNew();
      await result.current.advance();
    });
    expect(updateSessions).not.toHaveBeenCalled();
    expect(result.current.isMutating).toBe(false);
    await act(async () => {
      load.resolve([]);
      await load.promise;
    });
  });

  it('starts a deterministic session and refuses to duplicate a resumable one', async () => {
    loadSessions.mockResolvedValueOnce([]);
    let stored: LucidStabilizationLabSession[] = [];
    updateSessions.mockImplementation(async (_scope, updater) => {
      stored = [...(await updater(stored))];
      return stored;
    });
    const { result } = renderLab({ now: NOW + 10, entropy: 'abc123' });
    await act(async () => undefined);

    await act(async () => {
      await result.current.startNew();
    });
    const expectedId = createLucidStabilizationLabSessionId(NOW + 10, 'abc123');
    expect(result.current.currentSession?.sessionId).toBe(expectedId);
    expect(result.current.currentSession?.status).toBe('active');
    expect(result.current.sessions).toHaveLength(1);

    const writes = updateSessions.mock.calls.length;
    await act(async () => {
      await result.current.startNew();
    });
    expect(updateSessions.mock.calls.length).toBe(writes);
    expect(result.current.sessions).toHaveLength(1);
  });

  it('does not let a newer idle session hide an older resumable practice', async () => {
    const olderPaused = pauseLucidStabilizationLabSession(started('stab_paused', NOW + 1), NOW + 2);
    const newerIdle = idle('stab_idle', NOW + 50);
    loadSessions.mockResolvedValueOnce([olderPaused, newerIdle]);
    let stored = [olderPaused, newerIdle];
    updateSessions.mockImplementation(async (_scope, updater) => {
      stored = [...(await updater(stored))];
      return stored;
    });
    const { result } = renderLab({ now: NOW + 80, entropy: 'no-new' });
    await act(async () => undefined);

    expect(result.current.currentSession?.sessionId).toBe('stab_paused');
    expect(result.current.currentSession?.status).toBe('paused');
    const writes = updateSessions.mock.calls.length;
    await act(async () => {
      await result.current.startNew();
    });
    expect(updateSessions.mock.calls.length).toBeGreaterThan(writes);
    expect(result.current.currentSession?.sessionId).toBe('stab_paused');
    expect(result.current.currentSession?.status).toBe('active');
    expect(result.current.sessions.filter((item) => item.status !== 'idle' && item.status !== 'completed')).toHaveLength(1);
    expect(result.current.sessions.find((item) => item.sessionId === 'stab_idle')?.status).toBe('idle');
  });

  it('does not revive an older interruption when a newer idle sits above a completion', async () => {
    const olderInterrupted = interruptLucidStabilizationLabSession(started('stab_old', NOW + 1), NOW + 2);
    const middleCompleted = completeLucidStabilizationLabSession(
      {
        ...started('stab_done', NOW + 10),
        stepIndex: 4,
        completedStepIds: [
          'hands',
          'surface',
          'three_details',
          'intention',
          'slow_before_control',
        ],
        stepStartedAt: NOW + 14,
        updatedAt: NOW + 14,
      },
      NOW + 15
    );
    const newerIdle = idle('stab_idle', NOW + 40);
    loadSessions.mockResolvedValueOnce([olderInterrupted, middleCompleted, newerIdle]);
    let stored = [olderInterrupted, middleCompleted, newerIdle];
    updateSessions.mockImplementation(async (_scope, updater) => {
      stored = [...(await updater(stored))];
      return stored;
    });
    const { result } = renderLab({ now: NOW + 80, entropy: 'fresh-idle' });
    await act(async () => undefined);

    expect(result.current.currentSession).toBeNull();
    await act(async () => {
      await result.current.startNew();
    });
    expect(result.current.currentSession?.sessionId).toBe('stab_idle');
    expect(result.current.currentSession?.status).toBe('active');
    expect(result.current.sessions.find((item) => item.sessionId === 'stab_old')?.status).toBe('interrupted');
    expect(result.current.sessions.filter((item) => item.status === 'active')).toHaveLength(1);
  });

  it('does not revive an older interrupted session after a newer completion', async () => {
    const olderInterrupted = interruptLucidStabilizationLabSession(started('stab_old', NOW + 1), NOW + 2);
    const newerCompleted = completeLucidStabilizationLabSession(
      {
        ...started('stab_done', NOW + 10),
        stepIndex: 4,
        completedStepIds: [
          'hands',
          'surface',
          'three_details',
          'intention',
          'slow_before_control',
        ],
        stepStartedAt: NOW + 14,
        updatedAt: NOW + 14,
      },
      NOW + 15
    );
    loadSessions.mockResolvedValueOnce([olderInterrupted, newerCompleted]);
    let stored = [olderInterrupted, newerCompleted];
    updateSessions.mockImplementation(async (_scope, updater) => {
      stored = [...(await updater(stored))];
      return stored;
    });
    const { result } = renderLab({ now: NOW + 20, entropy: 'fresh' });
    await act(async () => undefined);

    expect(result.current.currentSession).toBeNull();
    expect(result.current.insights).toEqual(
      projectLucidStabilizationLabInsights([olderInterrupted, newerCompleted])
    );
    expect(result.current.insights.completionCount).toBe(1);
    expect(result.current.insights.practiceCount).toBe(2);

    await act(async () => {
      await result.current.startNew();
    });
    const expectedId = createLucidStabilizationLabSessionId(NOW + 20, 'fresh');
    expect(result.current.currentSession?.sessionId).toBe(expectedId);
    expect(result.current.currentSession?.status).toBe('active');
    expect(result.current.sessions.map((item) => item.sessionId)).toEqual([
      expectedId,
      'stab_done',
      'stab_old',
    ]);
    expect(result.current.sessions.find((item) => item.sessionId === 'stab_old')?.status).toBe(
      'interrupted'
    );
  });

  it('runs the full transition path, resumes after pause/interrupt, then completes into insights', async () => {
    const active = started('stab_live');
    loadSessions.mockResolvedValue([active]);
    let stored = [active];
    updateSessions.mockImplementation(async (_scope, updater) => {
      stored = [...(await updater(stored))];
      return stored;
    });
    let clock = NOW + 20;
    const { result, rerender } = renderLab({ now: () => clock, entropy: 'live' });
    await act(async () => undefined);

    await act(async () => {
      clock += 1;
      await result.current.repeat();
    });
    expect(result.current.currentSession?.repeatCounts.hands).toBe(1);
    expect(result.current.currentSession?.stepIndex).toBe(0);

    await act(async () => {
      clock += 1;
      await result.current.advance();
    });
    expect(result.current.currentSession?.stepIndex).toBe(1);

    await act(async () => {
      clock += 1;
      await result.current.pause();
    });
    expect(result.current.currentSession?.status).toBe('paused');
    await act(async () => {
      clock += 1;
      await result.current.resume();
    });
    expect(result.current.currentSession?.status).toBe('active');
    await act(async () => {
      clock += 1;
      await result.current.interrupt();
    });
    expect(result.current.currentSession?.status).toBe('interrupted');
    await act(async () => {
      clock += 1;
      await result.current.resume();
    });
    expect(result.current.currentSession?.status).toBe('active');

    await act(async () => {
      clock += 1;
      await result.current.advance();
    });
    await act(async () => {
      clock += 1;
      await result.current.advance();
    });
    await act(async () => {
      clock += 1;
      await result.current.advance();
    });
    expect(result.current.currentSession?.stepIndex).toBe(4);
    await act(async () => {
      clock += 1;
      await result.current.advance();
    });
    await act(async () => {
      clock += 1;
      await result.current.complete();
    });
    expect(result.current.currentSession).toBeNull();
    expect(result.current.sessions[0]?.status).toBe('completed');
    expect(result.current.insights.completionCount).toBe(1);
    expect(JSON.stringify(result.current.insights)).not.toMatch(/dream|premium|result/i);

    rerender({ userScope: 'guest', now: () => clock, entropy: 'live' });
    await act(async () => undefined);
    expect(result.current.currentSession).toBeNull();
    expect(result.current.sessions[0]?.status).toBe('completed');
  });

  it('recovers an active session after a remount', async () => {
    const active = started('stab_keep');
    loadSessions.mockResolvedValue([active]);
    const first = renderLab();
    await act(async () => undefined);
    expect(first.result.current.currentSession?.sessionId).toBe('stab_keep');
    first.unmount();

    const second = renderLab();
    await act(async () => undefined);
    expect(second.result.current.currentSession).toEqual(active);
  });

  it('clears immediately on scope change and ignores stale A loads and mutations', async () => {
    const guestLoad = deferred<LucidStabilizationLabSession[]>();
    const signedLoad = deferred<LucidStabilizationLabSession[]>();
    const guestUpdate = deferred<LucidStabilizationLabSession[]>();
    loadSessions.mockReturnValueOnce(guestLoad.promise).mockReturnValueOnce(signedLoad.promise);
    updateSessions.mockReturnValueOnce(guestUpdate.promise);

    const { result, rerender } = renderLab({ userScope: 'guest' });
    await act(async () => {
      guestLoad.resolve([started('stab_guest')]);
      await guestLoad.promise;
    });

    let guestAdvance!: Promise<void>;
    await act(async () => {
      guestAdvance = result.current.advance();
    });
    expect(result.current.isMutating).toBe(true);

    rerender({ userScope: 'user:abc', now: NOW + 10, entropy: 'abc123' });
    expect(result.current.sessions).toEqual([]);
    expect(result.current.currentSession).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(true);
    expect(result.current.isMutating).toBe(false);

    await act(async () => {
      guestUpdate.resolve([advanceLucidStabilizationLabSession(started('stab_guest'), NOW + 4)]);
      await guestAdvance.catch(() => undefined);
    });
    await act(async () => {
      signedLoad.resolve([started('stab_user')]);
      await signedLoad.promise;
    });

    expect(result.current.currentSession?.sessionId).toBe('stab_user');
    expect(result.current.sessions.map((item) => item.sessionId)).toEqual(['stab_user']);
    expect(result.current.isMutating).toBe(false);
  });

  it('lets the latest refresh win and keeps the last sessions on a same-scope error', async () => {
    const initial = deferred<LucidStabilizationLabSession[]>();
    const firstRefresh = deferred<LucidStabilizationLabSession[]>();
    const secondRefresh = deferred<LucidStabilizationLabSession[]>();
    const failedRefresh = deferred<LucidStabilizationLabSession[]>();
    loadSessions
      .mockReturnValueOnce(initial.promise)
      .mockReturnValueOnce(firstRefresh.promise)
      .mockReturnValueOnce(secondRefresh.promise)
      .mockReturnValueOnce(failedRefresh.promise);

    const { result } = renderLab();
    await act(async () => {
      initial.resolve([started('stab_first')]);
      await initial.promise;
    });

    let first!: Promise<void>;
    let second!: Promise<void>;
    await act(async () => {
      first = result.current.refresh();
    });
    expect(result.current.isLoading).toBe(true);
    await act(async () => {
      second = result.current.refresh();
    });

    await act(async () => {
      firstRefresh.resolve([started('stab_stale')]);
      await first;
    });
    expect(result.current.currentSession?.sessionId).toBe('stab_first');

    await act(async () => {
      secondRefresh.resolve([started('stab_latest')]);
      await second;
    });
    expect(result.current.currentSession?.sessionId).toBe('stab_latest');

    let failed!: Promise<void>;
    await act(async () => {
      failed = result.current.refresh();
    });
    await act(async () => {
      failedRefresh.reject(new LucidStabilizationLabStorageError('persistence_failed'));
      await failed;
    });
    expect(result.current.currentSession?.sessionId).toBe('stab_latest');
    expect(result.current.error).toBe('persistence_failed');
    expect(result.current.isLoading).toBe(false);
  });

  it('does not show scope A after a failed load of scope B', async () => {
    const guestLoad = deferred<LucidStabilizationLabSession[]>();
    const signedLoad = deferred<LucidStabilizationLabSession[]>();
    loadSessions.mockReturnValueOnce(guestLoad.promise).mockReturnValueOnce(signedLoad.promise);
    const { result, rerender } = renderLab({ userScope: 'guest' });
    await act(async () => {
      guestLoad.resolve([started('stab_from_a')]);
      await guestLoad.promise;
    });
    rerender({ userScope: 'user:abc', now: NOW + 10, entropy: 'abc123' });
    expect(result.current.currentSession).toBeNull();
    await act(async () => {
      signedLoad.reject(new LucidStabilizationLabStorageError('persistence_failed'));
      await signedLoad.promise.catch(() => undefined);
    });
    expect(result.current.sessions).toEqual([]);
    expect(result.current.currentSession).toBeNull();
    expect(result.current.error).toBe('persistence_failed');
  });

  it('keeps isMutating true until every current-scope mutation finishes', async () => {
    const first = deferred<LucidStabilizationLabSession[]>();
    const second = deferred<LucidStabilizationLabSession[]>();
    const active = started();
    loadSessions.mockResolvedValueOnce([active]);
    updateSessions.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { result } = renderLab();
    await act(async () => undefined);

    let firstPromise!: Promise<void>;
    let secondPromise!: Promise<void>;
    await act(async () => {
      firstPromise = result.current.repeat();
      secondPromise = result.current.advance();
    });
    expect(result.current.isMutating).toBe(true);

    await act(async () => {
      second.resolve([advanceLucidStabilizationLabSession(repeatLucidStabilizationLabStep(active, NOW + 2), NOW + 3)]);
      await secondPromise;
    });
    expect(result.current.isMutating).toBe(true);
    await act(async () => {
      first.resolve([repeatLucidStabilizationLabStep(active, NOW + 2)]);
      await firstPromise;
    });
    expect(result.current.isMutating).toBe(false);
  });

  it('surfaces a mutation error without dropping the last healthy session', async () => {
    const active = started('stab_kept');
    loadSessions.mockResolvedValueOnce([active]);
    updateSessions.mockRejectedValueOnce(new LucidStabilizationLabStorageError('persistence_failed'));
    const { result } = renderLab();
    await act(async () => undefined);
    await act(async () => {
      await result.current.advance().catch(() => undefined);
    });
    expect(result.current.error).toBe('persistence_failed');
    expect(result.current.currentSession).toEqual(active);
  });

  it('serializes concurrent repeat then advance against the latest stored session', async () => {
    const active = started('stab_race');
    loadSessions.mockResolvedValueOnce([active]);
    let stored = [active];
    let chain = Promise.resolve();
    updateSessions.mockImplementation(async (_scope, updater) => {
      const run = chain.then(async () => {
        stored = [...(await updater(stored))];
        return stored;
      });
      chain = run.then(() => undefined);
      return run;
    });
    let clock = NOW + 8;
    const { result } = renderLab({ now: () => clock });
    await act(async () => undefined);

    let first!: Promise<void>;
    let second!: Promise<void>;
    await act(async () => {
      clock += 1;
      first = result.current.repeat();
      clock += 1;
      second = result.current.advance();
    });
    await act(async () => {
      await first;
      await second;
    });
    expect(result.current.currentSession?.repeatCounts.hands).toBe(1);
    expect(result.current.currentSession?.stepIndex).toBe(1);
    expect(result.current.currentSession?.completedStepIds).toEqual(['hands']);
  });

  it('clears the frozen scope and stays unmount-safe after a late load', async () => {
    loadSessions.mockResolvedValueOnce([started('stab_clear')]);
    clearSessions.mockResolvedValueOnce(undefined);
    const { result } = renderLab();
    await act(async () => undefined);
    await act(async () => {
      await result.current.clear();
    });
    expect(clearSessions).toHaveBeenCalledWith('guest');
    expect(result.current.sessions).toEqual([]);
    expect(result.current.currentSession).toBeNull();

    const load = deferred<LucidStabilizationLabSession[]>();
    loadSessions.mockReturnValueOnce(load.promise);
    const late = renderLab();
    late.unmount();
    await act(async () => {
      load.resolve([started('stab_late')]);
      await load.promise;
    });
    expect(consoleError).not.toHaveBeenCalled();
  });
});
