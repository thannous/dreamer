/* @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import { useLucidDreamRehearsal } from '@/hooks/useLucidDreamRehearsal';
import {
  completeLucidDreamRehearsalSession,
  confirmLucidDreamRehearsalIntention,
  createLucidDreamRehearsalSession,
  createLucidDreamRehearsalSessionId,
  projectLucidDreamRehearsalCompletion,
  recognizeLucidDreamRehearsalSign,
  selectLucidDreamRehearsalScene,
  type LucidDreamRehearsalScene,
  type LucidDreamRehearsalSession,
} from '@/lib/lucid/dreamRehearsal';
import {
  LUCID_DREAM_REHEARSAL_MAX_STORED_COMPLETIONS,
  LucidDreamRehearsalStorageError,
  clearLucidDreamRehearsalCurrentSession,
  clearLucidDreamRehearsalState,
  loadLucidDreamRehearsalState,
  updateLucidDreamRehearsalState,
  type LucidDreamRehearsalStoredEnvelope,
} from '@/services/lucidDreamRehearsalStorage';

const NOW = 1_700_000_000_000;
const DREAM_ID = '1700000000000';
const SIGN_ID = 'sign:mirror';

jest.mock('@/services/lucidDreamRehearsalStorage', () => {
  const actual = jest.requireActual('@/services/lucidDreamRehearsalStorage');
  return {
    ...actual,
    loadLucidDreamRehearsalState: jest.fn(),
    updateLucidDreamRehearsalState: jest.fn(),
    clearLucidDreamRehearsalCurrentSession: jest.fn(),
    clearLucidDreamRehearsalState: jest.fn(),
  };
});

const loadState = jest.mocked(loadLucidDreamRehearsalState);
const updateState = jest.mocked(updateLucidDreamRehearsalState);
const clearCurrent = jest.mocked(clearLucidDreamRehearsalCurrentSession);
const clearAll = jest.mocked(clearLucidDreamRehearsalState);

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function scene(): LucidDreamRehearsalScene {
  const result = selectLucidDreamRehearsalScene(
    [{ id: Number(DREAM_ID), title: 'Hallway', transcript: 'I saw a hallway mirror.' }],
    [
      {
        id: SIGN_ID,
        label: 'Hallway mirror',
        category: 'object',
        distinctDreamCount: 2,
        sourceDreamIds: [DREAM_ID],
      },
    ],
    DREAM_ID,
    SIGN_ID
  );
  if (result.status !== 'ready') throw new Error('Expected a ready scene');
  return result.scene;
}

function session(sessionId = 'rehearse_one', now = NOW): LucidDreamRehearsalSession {
  return createLucidDreamRehearsalSession({
    scene: scene(),
    sessionId,
    sourceProgram: { kind: 'technique', technique: 'mild' },
    presentation: 'motion',
    now,
  });
}

function envelope(
  currentSession: LucidDreamRehearsalSession | null = null,
  completions: LucidDreamRehearsalStoredEnvelope['completions'] = [],
  userScope = 'guest'
): LucidDreamRehearsalStoredEnvelope {
  return {
    version: 1,
    userScope,
    currentSession,
    completions,
  };
}

function renderRehearsal(
  initial: { userScope?: string; now?: number | (() => number); entropy?: string | (() => string) } = {}
) {
  return renderHook(
    ({ userScope, now, entropy }) => useLucidDreamRehearsal({ userScope, now, entropy }),
    {
      initialProps: {
        userScope: initial.userScope ?? 'guest',
        now: initial.now ?? NOW + 10,
        entropy: initial.entropy ?? 'abc123',
      },
    }
  );
}

describe('useLucidDreamRehearsal', () => {
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    loadState.mockReset();
    updateState.mockReset();
    clearCurrent.mockReset();
    clearAll.mockReset();
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it('loads a copied current session and completions', async () => {
    const load = deferred<LucidDreamRehearsalStoredEnvelope>();
    loadState.mockReturnValueOnce(load.promise);
    const { result } = renderRehearsal();
    expect(result.current.currentSession).toBeNull();
    expect(result.current.completions).toEqual([]);
    expect(result.current.isLoading).toBe(true);

    const active = session('rehearse_live');
    await act(async () => {
      load.resolve(envelope(active));
      await load.promise;
    });

    expect(loadState).toHaveBeenCalledWith('guest');
    expect(result.current.currentSession).toEqual(active);
    expect(result.current.currentSession).not.toBe(active);
    expect(result.current.isLoading).toBe(false);
  });

  it('does not write before the current scope has loaded', async () => {
    const load = deferred<LucidDreamRehearsalStoredEnvelope>();
    loadState.mockReturnValueOnce(load.promise);
    const { result } = renderRehearsal();
    await act(async () => {
      await result.current.start(scene(), { kind: 'atlas' }, 'static');
      await result.current.recognize(SIGN_ID);
    });
    expect(updateState).not.toHaveBeenCalled();
    expect(result.current.isMutating).toBe(false);
    await act(async () => {
      load.resolve(envelope());
      await load.promise;
    });
  });

  it('starts a deterministic session and refuses to replace a live one', async () => {
    loadState.mockResolvedValueOnce(envelope());
    let stored = envelope();
    updateState.mockImplementation(async (_scope, updater) => {
      stored = await updater(stored);
      return stored;
    });
    const { result } = renderRehearsal({ now: NOW + 10, entropy: 'abc123' });
    await act(async () => undefined);

    await act(async () => {
      await result.current.start(scene(), { kind: 'technique', technique: 'mild' }, 'motion');
    });
    const expectedId = createLucidDreamRehearsalSessionId(NOW + 10, 'abc123');
    expect(result.current.currentSession?.sessionId).toBe(expectedId);
    expect(result.current.currentSession?.step).toBe('recognize_sign');

    const writes = updateState.mock.calls.length;
    await act(async () => {
      await result.current.start(scene(), { kind: 'atlas' }, 'static');
    });
    expect(updateState.mock.calls.length).toBe(writes);
    expect(result.current.currentSession?.sessionId).toBe(expectedId);
  });

  it('runs recognize then intention then completion against stored state', async () => {
    const active = session('rehearse_live');
    loadState.mockResolvedValue(envelope(active));
    let stored = envelope(active);
    updateState.mockImplementation(async (_scope, updater) => {
      stored = await updater(stored);
      return stored;
    });
    let clock = NOW + 20;
    const { result } = renderRehearsal({ now: () => clock, entropy: 'live' });
    await act(async () => undefined);

    await act(async () => {
      clock += 1;
      await result.current.confirmIntention().catch(() => undefined);
    });
    expect(result.current.currentSession?.recognizedAt).toBeNull();
    expect(result.current.error).toBe('invalid_metadata');

    await act(async () => {
      clock += 1;
      await result.current.recognize(SIGN_ID);
    });
    expect(result.current.currentSession?.step).toBe('set_lucid_intention');
    expect(result.current.currentSession?.recognizedAt).toBeGreaterThan(active.startedAt);

    await act(async () => {
      clock += 1;
      await result.current.confirmIntention();
    });
    expect(result.current.currentSession?.intentionConfirmedAt).not.toBeNull();

    await act(async () => {
      clock += 1;
      await result.current.complete();
    });
    expect(result.current.currentSession?.status).toBe('completed');
    expect(result.current.completions).toHaveLength(1);
    expect(Object.keys(result.current.completions[0])).toEqual([
      'version',
      'sessionId',
      'dreamId',
      'signId',
      'sourceProgram',
      'completedAt',
    ]);
    expect(JSON.stringify(result.current.completions)).not.toMatch(
      /transcript|excerpt|signLabel|intention|premium/i
    );
  });

  it('interrupts and resumes without losing recognition', async () => {
    const recognized = recognizeLucidDreamRehearsalSign(session('rehearse_live'), SIGN_ID, NOW + 1);
    loadState.mockResolvedValue(envelope(recognized));
    let stored = envelope(recognized);
    updateState.mockImplementation(async (_scope, updater) => {
      stored = await updater(stored);
      return stored;
    });
    let clock = NOW + 20;
    const { result } = renderRehearsal({ now: () => clock });
    await act(async () => undefined);

    await act(async () => {
      clock += 1;
      await result.current.interrupt();
    });
    expect(result.current.currentSession?.status).toBe('interrupted');
    expect(result.current.currentSession?.recognizedAt).toBe(recognized.recognizedAt);
    await act(async () => {
      clock += 1;
      await result.current.resume();
    });
    expect(result.current.currentSession?.status).toBe('active');
    expect(result.current.currentSession?.step).toBe('set_lucid_intention');
  });

  it('serializes concurrent recognize then intention against the latest stored session', async () => {
    const active = session('rehearse_race');
    loadState.mockResolvedValueOnce(envelope(active));
    let stored = envelope(active);
    let chain = Promise.resolve();
    updateState.mockImplementation(async (_scope, updater) => {
      const run = chain.then(async () => {
        stored = await updater(stored);
        return stored;
      });
      chain = run.then(() => undefined);
      return run;
    });
    let clock = NOW + 8;
    const { result } = renderRehearsal({ now: () => clock });
    await act(async () => undefined);

    let first!: Promise<void>;
    let second!: Promise<void>;
    await act(async () => {
      clock += 1;
      first = result.current.recognize(SIGN_ID);
      clock += 1;
      second = result.current.confirmIntention();
    });
    await act(async () => {
      await first;
      await second;
    });
    expect(result.current.currentSession?.recognizedAt).not.toBeNull();
    expect(result.current.currentSession?.intentionConfirmedAt).not.toBeNull();
    expect(result.current.currentSession?.intentionConfirmedAt).toBeGreaterThan(
      result.current.currentSession!.recognizedAt!
    );
  });

  it('clears immediately on scope change and ignores stale A loads and mutations', async () => {
    const guestLoad = deferred<LucidDreamRehearsalStoredEnvelope>();
    const signedLoad = deferred<LucidDreamRehearsalStoredEnvelope>();
    const guestUpdate = deferred<LucidDreamRehearsalStoredEnvelope>();
    loadState.mockReturnValueOnce(guestLoad.promise).mockReturnValueOnce(signedLoad.promise);
    updateState.mockReturnValueOnce(guestUpdate.promise);

    const { result, rerender } = renderRehearsal({ userScope: 'guest' });
    await act(async () => {
      guestLoad.resolve(envelope(session('rehearse_guest')));
      await guestLoad.promise;
    });

    let guestRecognize!: Promise<void>;
    await act(async () => {
      guestRecognize = result.current.recognize(SIGN_ID);
    });
    expect(result.current.isMutating).toBe(true);

    rerender({ userScope: 'user:abc', now: NOW + 10, entropy: 'abc123' });
    expect(result.current.currentSession).toBeNull();
    expect(result.current.completions).toEqual([]);
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(true);
    expect(result.current.isMutating).toBe(false);

    await act(async () => {
      guestUpdate.resolve(envelope(recognizeLucidDreamRehearsalSign(session('rehearse_guest'), SIGN_ID, NOW + 4)));
      await guestRecognize.catch(() => undefined);
    });
    await act(async () => {
      signedLoad.resolve(envelope(session('rehearse_user'), [], 'user:abc'));
      await signedLoad.promise;
    });

    expect(result.current.currentSession?.sessionId).toBe('rehearse_user');
    expect(result.current.isMutating).toBe(false);
  });

  it('lets the latest refresh win and keeps the last snapshot on a same-scope error', async () => {
    const initial = deferred<LucidDreamRehearsalStoredEnvelope>();
    const firstRefresh = deferred<LucidDreamRehearsalStoredEnvelope>();
    const secondRefresh = deferred<LucidDreamRehearsalStoredEnvelope>();
    const failedRefresh = deferred<LucidDreamRehearsalStoredEnvelope>();
    loadState
      .mockReturnValueOnce(initial.promise)
      .mockReturnValueOnce(firstRefresh.promise)
      .mockReturnValueOnce(secondRefresh.promise)
      .mockReturnValueOnce(failedRefresh.promise);

    const { result } = renderRehearsal();
    await act(async () => {
      initial.resolve(envelope(session('rehearse_first')));
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
      firstRefresh.resolve(envelope(session('rehearse_stale')));
      await first;
    });
    expect(result.current.currentSession?.sessionId).toBe('rehearse_first');

    await act(async () => {
      secondRefresh.resolve(envelope(session('rehearse_latest')));
      await second;
    });
    expect(result.current.currentSession?.sessionId).toBe('rehearse_latest');

    let failed!: Promise<void>;
    await act(async () => {
      failed = result.current.refresh();
    });
    await act(async () => {
      failedRefresh.reject(new LucidDreamRehearsalStorageError('persistence_failed'));
      await failed;
    });
    expect(result.current.currentSession?.sessionId).toBe('rehearse_latest');
    expect(result.current.error).toBe('persistence_failed');
    expect(result.current.isLoading).toBe(false);
  });

  it('does not show scope A after a failed load of scope B', async () => {
    const guestLoad = deferred<LucidDreamRehearsalStoredEnvelope>();
    const signedLoad = deferred<LucidDreamRehearsalStoredEnvelope>();
    loadState.mockReturnValueOnce(guestLoad.promise).mockReturnValueOnce(signedLoad.promise);
    const { result, rerender } = renderRehearsal({ userScope: 'guest' });
    await act(async () => {
      guestLoad.resolve(envelope(session('rehearse_from_a')));
      await guestLoad.promise;
    });
    rerender({ userScope: 'user:abc', now: NOW + 10, entropy: 'abc123' });
    expect(result.current.currentSession).toBeNull();
    await act(async () => {
      signedLoad.reject(new LucidDreamRehearsalStorageError('persistence_failed'));
      await signedLoad.promise.catch(() => undefined);
    });
    expect(result.current.currentSession).toBeNull();
    expect(result.current.completions).toEqual([]);
    expect(result.current.error).toBe('persistence_failed');
  });

  it('clears current and all, then stays unmount-safe after a late load', async () => {
    const finished = completeLucidDreamRehearsalSession(
      confirmLucidDreamRehearsalIntention(
        recognizeLucidDreamRehearsalSign(session('rehearse_clear'), SIGN_ID, NOW + 1),
        NOW + 2
      ),
      NOW + 3
    );
    const projected = projectLucidDreamRehearsalCompletion(finished);
    loadState.mockResolvedValueOnce(envelope(finished, projected ? [projected] : []));
    clearCurrent.mockResolvedValueOnce(envelope(null, projected ? [projected] : []));
    clearAll.mockResolvedValueOnce(undefined);
    const { result } = renderRehearsal();
    await act(async () => undefined);

    await act(async () => {
      await result.current.clearCurrent();
    });
    expect(clearCurrent).toHaveBeenCalledWith('guest');
    expect(result.current.currentSession).toBeNull();
    expect(result.current.completions).toEqual(projected ? [projected] : []);

    await act(async () => {
      await result.current.clearAll();
    });
    expect(clearAll).toHaveBeenCalledWith('guest');
    expect(result.current.completions).toEqual([]);

    const load = deferred<LucidDreamRehearsalStoredEnvelope>();
    loadState.mockReturnValueOnce(load.promise);
    const late = renderRehearsal();
    late.unmount();
    await act(async () => {
      load.resolve(envelope(session('rehearse_late')));
      await load.promise;
    });
  });

  it('caps completions at 500, evicts the oldest, and keeps duplicate session ids unique', async () => {
    const filled = Array.from(
      { length: LUCID_DREAM_REHEARSAL_MAX_STORED_COMPLETIONS },
      (_, index) => {
        const finished = completeLucidDreamRehearsalSession(
          confirmLucidDreamRehearsalIntention(
            recognizeLucidDreamRehearsalSign(
              session(`rehearse_${String(index).padStart(3, '0')}`, NOW + index),
              SIGN_ID,
              NOW + index + 1
            ),
            NOW + index + 2
          ),
          NOW + index + 3
        );
        const projected = projectLucidDreamRehearsalCompletion(finished);
        if (!projected) throw new Error('Expected a completion');
        return projected;
      }
    );
    const oldest = filled[0];
    const newestExisting = filled[filled.length - 1];
    const live = confirmLucidDreamRehearsalIntention(
      recognizeLucidDreamRehearsalSign(session('rehearse_new', NOW + 10_000), SIGN_ID, NOW + 10_001),
      NOW + 10_002
    );
    loadState.mockResolvedValue(envelope(live, filled));
    let stored = envelope(live, filled);
    updateState.mockImplementation(async (_scope, updater) => {
      stored = await updater(stored);
      return stored;
    });
    let clock = NOW + 20_000;
    const { result } = renderRehearsal({ now: () => clock });
    await act(async () => undefined);

    await act(async () => {
      clock += 1;
      await result.current.complete();
    });
    expect(result.current.completions).toHaveLength(LUCID_DREAM_REHEARSAL_MAX_STORED_COMPLETIONS);
    expect(result.current.completions[0]?.sessionId).toBe('rehearse_new');
    expect(result.current.completions.map((item) => item.sessionId)).toContain(newestExisting.sessionId);
    expect(result.current.completions.map((item) => item.sessionId)).not.toContain(oldest.sessionId);
    expect(result.current.error).toBeNull();

    const duplicateWrites = updateState.mock.calls.length;
    await act(async () => {
      clock += 1;
      await result.current.complete();
    });
    expect(updateState.mock.calls.length).toBeGreaterThan(duplicateWrites);
    expect(result.current.completions).toHaveLength(LUCID_DREAM_REHEARSAL_MAX_STORED_COMPLETIONS);
    expect(result.current.completions.filter((item) => item.sessionId === 'rehearse_new')).toHaveLength(1);
    expect(result.current.completions.map((item) => item.completedAt)).toEqual(
      [...result.current.completions].sort((left, right) => {
        if (left.completedAt !== right.completedAt) return right.completedAt - left.completedAt;
        return left.sessionId < right.sessionId ? -1 : 1;
      }).map((item) => item.completedAt)
    );
  });
});
