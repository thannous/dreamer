import { DreamPersistenceError } from '../../lib/dreamStorageRead';
import type { DreamAnalysis, DreamMutation } from '../../lib/types';
import { createJournalSyncEngine, type JournalSyncDependencies, type JournalSyncOptions } from '../journalSyncEngine';

const dream = (id = 1): DreamAnalysis => ({
  id, clientRequestId: `dream-${id}`, transcript: 'Dream', title: 'Dream',
  interpretation: '', shareableQuote: '', imageUrl: '', chatHistory: [], dreamType: 'Symbolic Dream',
});
const mutation = (id = 'receipt-1', scope = 'user:a'): DreamMutation => ({
  version: 1, id, userScope: scope, entityType: 'dream', entityKey: 'local:1',
  clientRequestId: 'dream-1', operation: 'create', payload: { dream: dream() },
  clientUpdatedAt: 1, createdAt: 1, status: 'pending', retryCount: 0,
});
const deferred = () => {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
const setup = (initialMutations: DreamMutation[] = []) => {
  const dependencies = {
    savePendingDreamMutations: jest.fn<Promise<void>, [DreamMutation[], (string | null)?]>(async () => undefined),
    createDreamInSupabase: jest.fn(async (value: DreamAnalysis) => ({ ...value, remoteId: 10 })),
    updateDreamInSupabase: jest.fn(async (value: DreamAnalysis) => value),
    deleteDreamFromSupabase: jest.fn(async () => undefined),
    reportSyncQueueMetrics: jest.fn(), recordSyncReplayMetrics: jest.fn(), logger: { warn: jest.fn() },
  } satisfies JournalSyncDependencies;
  let dreams: DreamAnalysis[] = [dream()];
  const persistRemoteDreams = jest.fn(async (updater: Parameters<JournalSyncOptions['persistRemoteDreams']>[0]) => {
    dreams = typeof updater === 'function' ? updater(dreams) : updater;
  });
  const options: JournalSyncOptions = {
    canUseRemoteSync: true, hasNetwork: true,
    userScope: 'user:a', resolveRemoteId: () => undefined, persistRemoteDreams, initialMutations
  };
  const engine = createJournalSyncEngine(dependencies, options);
  const commands = engine.bind(options, { id: 'a' });
  return { dependencies, options, engine, commands, persistRemoteDreams, getDreams: () => dreams };
};

describe('injected durable Journal sync engine', () => {
  it('serializes durable writes and permits a later write after storage rejection', async () => {
    const { dependencies, commands, persistRemoteDreams } = setup();
    const write = deferred();
    dependencies.savePendingDreamMutations.mockImplementationOnce(() => write.promise);
    const first = commands.queueOfflineOperation(mutation(), (prev) => prev);
    const failure = expect(first).rejects.toBeInstanceOf(DreamPersistenceError);
    const second = commands.queueOfflineOperation({ ...mutation('receipt-2'), clientRequestId: 'dream-2' }, (prev) => prev);
    await flush();
    expect(dependencies.savePendingDreamMutations).toHaveBeenCalledTimes(1);
    expect(persistRemoteDreams).not.toHaveBeenCalled();
    write.reject(new Error('Disk full'));
    await failure;
    await second;
    expect(dependencies.savePendingDreamMutations.mock.calls[1][0]).toHaveLength(2);
    expect(persistRemoteDreams).toHaveBeenCalledTimes(1);
  });

  it('keeps the original create receipt when a failed create is retried', async () => {
    const original = { ...mutation(), status: 'failed' as const, retryCount: 2, lastAttemptAt: 50 };
    const { commands } = setup([original]);
    await commands.queueOfflineOperation(mutation('new-receipt'), (prev) => prev);
    expect(commands.pendingMutationsRef.current).toEqual([expect.objectContaining({
      id: original.id, createdAt: original.createdAt, retryCount: 2, lastAttemptAt: 50,
    })]);
  });

  it('coalesces concurrent replays behind the single in-flight owner', async () => {
    const { commands, dependencies } = setup([mutation()]);
    const network = deferred();
    dependencies.createDreamInSupabase.mockImplementationOnce(async (value) => {
      await network.promise; return { ...value, remoteId: 10 };
    });
    const first = commands.syncPendingMutations();
    const second = commands.syncPendingMutations();
    await flush();
    expect(dependencies.createDreamInSupabase).toHaveBeenCalledTimes(1);
    network.resolve();
    await Promise.all([first, second]);
    expect(dependencies.createDreamInSupabase).toHaveBeenCalledTimes(1);
    expect(commands.pendingMutationsRef.current).toEqual([]);
  });

  it('cancels a never-sent create deleted while its sending marker is persisted', async () => {
    const { commands, dependencies } = setup([mutation()]);
    const write = deferred();
    dependencies.savePendingDreamMutations.mockImplementationOnce(() => write.promise);
    const replay = commands.syncPendingMutations();
    await flush();
    const deletion = commands.queueOfflineOperation({
      ...mutation('delete-1'), operation: 'delete',
      payload: { tombstone: dream() }
    }, () => []);
    write.resolve();
    await Promise.all([replay, deletion]);
    expect(dependencies.createDreamInSupabase).not.toHaveBeenCalled();
    expect(commands.pendingMutationsRef.current).toEqual([]);
  });

  it('waits for durable snapshot identity before replaying an unresolved delete', async () => {
    const { commands, dependencies } = setup([{ ...mutation(), operation: 'delete', payload: { tombstone: dream() } }]);
    const write = deferred();
    dependencies.savePendingDreamMutations.mockImplementationOnce(() => write.promise);
    const unsubscribe = commands.subscribeSnapshot({ userScope: 'user:a', dreams: [{ ...dream(), remoteId: 10 }] }, true);
    await flush();
    expect(dependencies.deleteDreamFromSupabase).not.toHaveBeenCalled();
    expect(dependencies.savePendingDreamMutations.mock.calls[0][0][0].payload.remoteId).toBe(10);
    write.resolve();
    await flush();
    await commands.syncPendingMutations();
    expect(dependencies.deleteDreamFromSupabase).toHaveBeenCalledTimes(1);
    expect(dependencies.deleteDreamFromSupabase).toHaveBeenCalledWith(10);
    unsubscribe();
  });

  it('does not activate a speculative binding and rejects stale commands after committed account switch', async () => {
    const { engine, options, commands, dependencies } = setup([mutation()]);
    const next = engine.bind({ ...options, userScope: 'user:b' }, { id: 'b' });
    expect(commands.pendingMutationsRef.current).toHaveLength(1);
    await expect(next.queueOfflineOperation(mutation('b', 'user:b'), (prev) => prev)).rejects.toBeInstanceOf(DreamPersistenceError);
    engine.activate('user:b', true);
    expect(next.pendingMutationsRef.current).toEqual([]);
    await expect(commands.queueOfflineOperation(mutation(), (prev) => prev)).rejects.toBeInstanceOf(DreamPersistenceError);
    expect(dependencies.savePendingDreamMutations).not.toHaveBeenCalled();
  });

  it('keeps an old account acknowledgement out of the newly active queue and dream cache', async () => {
    const { commands, engine, options, dependencies, persistRemoteDreams } = setup([mutation()]);
    const network = deferred();
    dependencies.createDreamInSupabase.mockImplementationOnce(async (value) => {
      await network.promise; return { ...value, remoteId: 10 };
    });
    const replay = commands.syncPendingMutations();
    await flush();
    engine.activate('user:b', true);
    const next = engine.bind({ ...options, userScope: 'user:b' }, { id: 'b' });
    next.setPendingMutations([mutation('b', 'user:b')]);
    network.resolve();
    await replay;
    expect(persistRemoteDreams).not.toHaveBeenCalled();
    expect(next.pendingMutationsRef.current[0].id).toBe('b');
  });

  it('ignores completion after unmount and permits lifecycle reactivation', async () => {
    const { commands, engine, dependencies, persistRemoteDreams } = setup([mutation()]);
    const network = deferred();
    dependencies.createDreamInSupabase.mockImplementationOnce(async (value) => {
      await network.promise; return { ...value, remoteId: 10 };
    });
    const replay = commands.syncPendingMutations();
    await flush();
    engine.setMounted(false);
    network.resolve();
    await replay;
    expect(persistRemoteDreams).not.toHaveBeenCalled();
    engine.setMounted(true);
    await commands.syncPendingMutations();
    expect(commands.pendingMutationsRef.current).toEqual([]);
    expect(persistRemoteDreams).toHaveBeenCalledTimes(1);
  });
});
