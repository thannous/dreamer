/* @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import { useLucidSsildSensoryLab } from '@/hooks/useLucidSsildSensoryLab';
import { createLucidGuidedRitualPlan } from '@/lib/lucid/guidedRitual';
import type { LucidSafetyMode, LucidSafetyPolicy } from '@/lib/lucid/safety';
import {
  createLucidSsildSensoryLabSession,
  createLucidSsildSensoryLabSessionId,
  startLucidSsildSensoryLabSession,
  tickLucidSsildSensoryLabSession,
  type LucidSsildSensoryLabSession,
} from '@/lib/lucid/ssildSensoryLab';
import {
  LucidSsildSensoryLabStorageError,
  clearLucidSsildSensoryLabCurrentSession,
  loadLucidSsildSensoryLabCurrentSession,
  updateLucidSsildSensoryLabCurrentSession,
} from '@/services/lucidSsildSensoryLabStorage';

const NOW = 1_700_000_000_000;

jest.mock('@/services/lucidSsildSensoryLabStorage', () => {
  const actual = jest.requireActual('@/services/lucidSsildSensoryLabStorage');
  return {
    ...actual,
    loadLucidSsildSensoryLabCurrentSession: jest.fn(),
    updateLucidSsildSensoryLabCurrentSession: jest.fn(),
    clearLucidSsildSensoryLabCurrentSession: jest.fn(),
  };
});

const loadSession = jest.mocked(loadLucidSsildSensoryLabCurrentSession);
const updateSession = jest.mocked(updateLucidSsildSensoryLabCurrentSession);
const clearSession = jest.mocked(clearLucidSsildSensoryLabCurrentSession);

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function policy(
  mode: LucidSafetyMode,
  overrides: Partial<LucidSafetyPolicy> = {}
): LucidSafetyPolicy {
  return {
    mode,
    allowWbtb: mode === 'normal',
    allowNightSignals: mode === 'normal',
    nightSignalIntensity: mode === 'normal' ? 'normal' : 'blocked',
    emergencyStopAllowed: true,
    reasons: [],
    ...overrides,
  };
}

function readyPlan(mode: LucidSafetyMode = 'normal') {
  const plan = createLucidGuidedRitualPlan(
    'ssild',
    policy(
      mode,
      mode === 'reducedIntensity'
        ? { allowNightSignals: false, nightSignalIntensity: 'blocked' }
        : {}
    )
  );
  if (plan.status !== 'ready') throw new Error('Expected a ready SSILD plan');
  return plan;
}

function idle(sessionId = 'ssild_one', now = NOW): LucidSsildSensoryLabSession {
  return createLucidSsildSensoryLabSession({
    plan: readyPlan(),
    sessionId,
    now,
  });
}

function started(sessionId = 'ssild_one', now = NOW + 1): LucidSsildSensoryLabSession {
  return startLucidSsildSensoryLabSession(idle(sessionId, NOW), now);
}

function renderLab(
  initial: { userScope?: string; now?: number | (() => number); entropy?: string | (() => string) } = {}
) {
  return renderHook(
    ({ userScope, now, entropy }) => useLucidSsildSensoryLab({ userScope, now, entropy }),
    {
      initialProps: {
        userScope: initial.userScope ?? 'guest',
        now: initial.now ?? NOW + 10,
        entropy: initial.entropy ?? 'abc123',
      },
    }
  );
}

describe('useLucidSsildSensoryLab', () => {
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    loadSession.mockReset();
    updateSession.mockReset();
    clearSession.mockReset();
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it('starts a full 300s plan and a reduced 180s plan without duplicating a resumable session', async () => {
    loadSession.mockResolvedValue(null);
    let stored: LucidSsildSensoryLabSession | null = null;
    updateSession.mockImplementation(async (_scope, updater) => {
      stored = await updater(stored);
      return stored;
    });
    const { result } = renderLab({ now: NOW + 10, entropy: 'abc123' });
    await act(async () => undefined);

    await act(async () => {
      await result.current.startNew(readyPlan('normal'));
    });
    const expectedId = createLucidSsildSensoryLabSessionId(NOW + 10, 'abc123');
    expect(result.current.currentSession?.sessionId).toBe(expectedId);
    expect(result.current.currentSession?.status).toBe('running');
    expect(result.current.plan?.totalDurationMs).toBe(300_000);
    expect(result.current.phase?.focus).toBe('settle');
    expect(result.current.remainingMs).toBe(300_000);
    expect(result.current.progression).toBe(0);

    const writes = updateSession.mock.calls.length;
    await act(async () => {
      await result.current.startNew(readyPlan('reducedIntensity'));
    });
    expect(updateSession.mock.calls.length).toBe(writes);
    expect(result.current.plan?.totalDurationMs).toBe(300_000);

    loadSession.mockResolvedValueOnce(null);
    stored = null;
    const reduced = renderLab({ now: NOW + 20, entropy: 'reduced1', userScope: 'user:abc' });
    await act(async () => undefined);
    await act(async () => {
      await reduced.result.current.startNew(readyPlan('reducedIntensity'));
    });
    expect(reduced.result.current.plan?.totalDurationMs).toBe(180_000);
    expect(reduced.result.current.plan?.soundAllowed).toBe(false);
    expect(reduced.result.current.phase?.id).toBe('ssild_sight_direct');
  });

  it('serializes concurrent ticks against the stored session without drift', async () => {
    const active = started('ssild_race');
    loadSession.mockResolvedValueOnce(active);
    let stored: LucidSsildSensoryLabSession | null = active;
    let chain = Promise.resolve();
    updateSession.mockImplementation(async (_scope, updater) => {
      const run = chain.then(async () => {
        stored = await updater(stored);
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
      clock = active.startedAt! + 20_000;
      first = result.current.tick();
      clock = active.startedAt! + 90_000;
      second = result.current.tick();
    });
    await act(async () => {
      await first;
      await second;
    });
    expect(result.current.currentSession?.accumulatedElapsedMs).toBe(90_000);
    expect(result.current.currentSession?.phaseIndex).toBe(2);
    expect(result.current.progression).toBe(90_000 / 300_000);
    expect(result.current.remainingMs).toBe(210_000);
  });

  it('excludes a long pause, then persists audio interruption, resume and exit', async () => {
    const active = started('ssild_live');
    loadSession.mockResolvedValueOnce(active);
    let stored: LucidSsildSensoryLabSession | null = active;
    updateSession.mockImplementation(async (_scope, updater) => {
      stored = await updater(stored);
      return stored;
    });
    let clock = active.startedAt! + 11_000;
    const { result } = renderLab({ now: () => clock });
    await act(async () => undefined);

    await act(async () => {
      await result.current.pause();
    });
    expect(result.current.currentSession).toMatchObject({
      status: 'paused',
      accumulatedElapsedMs: 11_000,
    });

    clock += 80_000;
    await act(async () => {
      await result.current.resume();
    });
    expect(result.current.currentSession?.status).toBe('running');
    expect(result.current.currentSession?.accumulatedElapsedMs).toBe(11_000);

    clock += 1_000;
    await act(async () => {
      await result.current.tick();
    });
    expect(result.current.currentSession?.accumulatedElapsedMs).toBe(12_000);

    clock += 2_000;
    await act(async () => {
      await result.current.interruptAudio();
    });
    expect(result.current.currentSession).toMatchObject({
      status: 'interrupted',
      interruptionReason: 'audio_route',
    });

    clock += 5_000;
    await act(async () => {
      await result.current.resume();
    });
    clock += 500;
    await act(async () => {
      await result.current.exit();
    });
    expect(result.current.currentSession).toMatchObject({
      status: 'interrupted',
      interruptionReason: 'user_exit',
      completedAt: null,
    });
    expect(stored).toEqual(result.current.currentSession);
  });

  it('auto-completes through tick at totalDurationMs', async () => {
    const active = started('ssild_done');
    loadSession.mockResolvedValueOnce(active);
    let stored: LucidSsildSensoryLabSession | null = active;
    updateSession.mockImplementation(async (_scope, updater) => {
      stored = await updater(stored);
      return stored;
    });
    const { result } = renderLab({ now: active.startedAt! + 300_000 });
    await act(async () => undefined);
    await act(async () => {
      await result.current.tick();
    });
    expect(result.current.currentSession).toMatchObject({
      status: 'completed',
      accumulatedElapsedMs: 300_000,
    });
    expect(result.current.progression).toBe(1);
    expect(result.current.remainingMs).toBe(0);
  });

  it('maps illegal domain transitions to invalid_metadata without dropping the last session', async () => {
    const active = started('ssild_kept');
    loadSession.mockResolvedValueOnce(active);
    let stored: LucidSsildSensoryLabSession | null = active;
    updateSession.mockImplementation(async (_scope, updater) => {
      stored = await updater(stored);
      return stored;
    });
    const { result } = renderLab({ now: NOW + 20 });
    await act(async () => undefined);
    await act(async () => {
      await result.current.complete().catch(() => undefined);
    });
    expect(result.current.error).toBe('invalid_metadata');
    expect(result.current.currentSession).toEqual(active);
  });

  it('clears immediately on scope change and ignores stale A loads and mutations', async () => {
    const guestLoad = deferred<LucidSsildSensoryLabSession | null>();
    const signedLoad = deferred<LucidSsildSensoryLabSession | null>();
    const guestUpdate = deferred<LucidSsildSensoryLabSession | null>();
    loadSession.mockReturnValueOnce(guestLoad.promise).mockReturnValueOnce(signedLoad.promise);
    updateSession.mockReturnValueOnce(guestUpdate.promise);

    const { result, rerender } = renderLab({ userScope: 'guest' });
    await act(async () => {
      guestLoad.resolve(started('ssild_guest'));
      await guestLoad.promise;
    });

    let guestTick!: Promise<void>;
    await act(async () => {
      guestTick = result.current.tick();
    });
    expect(result.current.isMutating).toBe(true);

    rerender({ userScope: 'user:abc', now: NOW + 10, entropy: 'abc123' });
    expect(result.current.currentSession).toBeNull();
    expect(result.current.plan).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(true);
    expect(result.current.isMutating).toBe(false);

    await act(async () => {
      guestUpdate.resolve(
        tickLucidSsildSensoryLabSession(started('ssild_guest'), NOW + 40_000).session
      );
      await guestTick.catch(() => undefined);
    });
    await act(async () => {
      signedLoad.resolve(started('ssild_user'));
      await signedLoad.promise;
    });

    expect(result.current.currentSession?.sessionId).toBe('ssild_user');
    expect(result.current.isMutating).toBe(false);
  });

  it('lets the latest refresh win and keeps the last session on a same-scope error', async () => {
    const initial = deferred<LucidSsildSensoryLabSession | null>();
    const firstRefresh = deferred<LucidSsildSensoryLabSession | null>();
    const secondRefresh = deferred<LucidSsildSensoryLabSession | null>();
    const failedRefresh = deferred<LucidSsildSensoryLabSession | null>();
    loadSession
      .mockReturnValueOnce(initial.promise)
      .mockReturnValueOnce(firstRefresh.promise)
      .mockReturnValueOnce(secondRefresh.promise)
      .mockReturnValueOnce(failedRefresh.promise);

    const { result } = renderLab();
    await act(async () => {
      initial.resolve(started('ssild_first'));
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
      firstRefresh.resolve(started('ssild_stale'));
      await first;
    });
    expect(result.current.currentSession?.sessionId).toBe('ssild_first');

    await act(async () => {
      secondRefresh.resolve(started('ssild_latest'));
      await second;
    });
    expect(result.current.currentSession?.sessionId).toBe('ssild_latest');

    let failed!: Promise<void>;
    await act(async () => {
      failed = result.current.refresh();
    });
    await act(async () => {
      failedRefresh.reject(new LucidSsildSensoryLabStorageError('persistence_failed'));
      await failed;
    });
    expect(result.current.currentSession?.sessionId).toBe('ssild_latest');
    expect(result.current.error).toBe('persistence_failed');
    expect(result.current.isLoading).toBe(false);
  });

  it('clears the frozen scope and stays unmount-safe after a late load', async () => {
    loadSession.mockResolvedValueOnce(started('ssild_clear'));
    clearSession.mockResolvedValueOnce(undefined);
    const { result } = renderLab();
    await act(async () => undefined);
    await act(async () => {
      await result.current.clear();
    });
    expect(clearSession).toHaveBeenCalledWith('guest');
    expect(result.current.currentSession).toBeNull();
    expect(result.current.plan).toBeNull();

    const load = deferred<LucidSsildSensoryLabSession | null>();
    loadSession.mockReturnValueOnce(load.promise);
    const late = renderLab();
    late.unmount();
    await act(async () => {
      load.resolve(started('ssild_late'));
      await load.promise;
    });
  });

  it('does not write before the current scope has loaded', async () => {
    const load = deferred<LucidSsildSensoryLabSession | null>();
    loadSession.mockReturnValueOnce(load.promise);
    const { result } = renderLab();
    await act(async () => {
      await result.current.startNew(readyPlan());
      await result.current.tick();
    });
    expect(updateSession).not.toHaveBeenCalled();
    expect(result.current.isMutating).toBe(false);
    await act(async () => {
      load.resolve(null);
      await load.promise;
    });
  });
});
