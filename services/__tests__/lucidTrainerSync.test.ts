import {
  createInitialLucidTrainerState,
  createLucidProgramProgress,
} from '@/lib/lucid/domain';
import type {
  LucidSyncEntity,
  LucidSyncMutation,
  LucidTrainerState,
} from '@/lib/lucid/model';
import {
  computeLucidSyncBackoffMs,
  claimLucidTrainerGuestScope,
  createLucidTrainerMutation,
  hasLucidTrainerGuestData,
  parseLucidRemoteEntityRecords,
  parseLucidRemoteSnapshot,
  pullLucidTrainerRemoteState,
  replayLucidTrainerQueue,
  type LucidPullTransport,
  type LucidScopeMigrationStorageAdapter,
  type LucidSyncStorageAdapter,
  type LucidSyncTransport,
  type LucidSyncTransportResult,
} from '@/services/lucidTrainerSync';

describe('lucidTrainerSync', () => {
  const NOW = 1_700_000_000_000;
  const SCOPE = 'user:user-1';

  function state(cloudSyncEnabled = true): LucidTrainerState {
    const value = createInitialLucidTrainerState({ now: NOW, timeZone: 'UTC' });
    value.preferences = { ...value.preferences, cloudSyncEnabled };
    return value;
  }

  function preferencesEntity(current = state()): LucidSyncEntity {
    return {
      entityType: 'preferences',
      entityKey: 'preferences',
      value: current.preferences,
    };
  }

  function mutation(
    entity: LucidSyncEntity = preferencesEntity(),
    overrides: Partial<LucidSyncMutation> = {}
  ): LucidSyncMutation {
    return {
      version: 1,
      id: 'mutation-1',
      userScope: SCOPE,
      entityType: entity.entityType,
      entityKey: entity.entityKey,
      operation: 'upsert',
      clientRequestId: 'request-1',
      clientUpdatedAt: entity.value.updatedAt,
      payload: { entity },
      status: 'pending',
      retryCount: 0,
      createdAt: NOW,
      ...overrides,
    };
  }

  function memoryAdapter(initialState = state(), initialQueue: LucidSyncMutation[] = []) {
    let currentState = initialState;
    let currentQueue = [...initialQueue];
    const adapter: LucidSyncStorageAdapter = {
      loadQueue: jest.fn(async () => [...currentQueue]),
      updateQueue: jest.fn(async (_scope, updater) => {
        currentQueue = [...updater([...currentQueue])];
        return [...currentQueue];
      }),
      loadState: jest.fn(async () => currentState),
      updateState: jest.fn(async (_scope, updater) => {
        currentState = updater(currentState);
        return currentState;
      }),
    };
    return {
      adapter,
      get queue() {
        return currentQueue;
      },
      get state() {
        return currentState;
      },
    };
  }

  it('computes an equal-jitter exponential backoff with a hard cap', () => {
    expect(computeLucidSyncBackoffMs(1, () => 0)).toBe(2_500);
    expect(computeLucidSyncBackoffMs(1, () => 1)).toBe(5_000);
    expect(computeLucidSyncBackoffMs(99, () => 1)).toBe(6 * 60 * 60 * 1_000);
    expect(computeLucidSyncBackoffMs(2, () => -100)).toBe(5_000);
  });

  it('creates stable idempotency fields without enabling sync implicitly', () => {
    const ids = ['mutation-id', 'request-id'];
    const current = state(false);
    const created = createLucidTrainerMutation(
      { userScope: SCOPE, operation: 'upsert', entity: preferencesEntity(current) },
      { now: () => NOW, idFactory: () => ids.shift()! }
    );

    expect(created).toMatchObject({
      id: 'mutation-id',
      clientRequestId: 'request-id',
      status: 'pending',
      retryCount: 0,
      userScope: SCOPE,
    });
    expect(current.preferences.cloudSyncEnabled).toBe(false);
  });

  it('never contacts the network until cloud sync is explicitly enabled', async () => {
    const store = memoryAdapter(state(false), [mutation()]);
    const transport: LucidSyncTransport = { push: jest.fn(async () => []) };

    const result = await replayLucidTrainerQueue(SCOPE, {
      storage: store.adapter,
      transport,
      isNetworkReachable: jest.fn(async () => true),
      now: () => NOW,
    });

    expect(result.outcome).toBe('disabled');
    expect(transport.push).not.toHaveBeenCalled();
    expect(store.queue).toHaveLength(1);
  });

  it('leaves the durable queue untouched while offline', async () => {
    const store = memoryAdapter(state(), [mutation()]);
    const transport: LucidSyncTransport = { push: jest.fn(async () => []) };

    const result = await replayLucidTrainerQueue(SCOPE, {
      storage: store.adapter,
      transport,
      isNetworkReachable: async () => false,
      now: () => NOW,
    });

    expect(result.outcome).toBe('offline');
    expect(transport.push).not.toHaveBeenCalled();
    expect(store.queue[0]?.status).toBe('pending');
  });

  it('persists sending before transport and removes acknowledged mutations', async () => {
    const queued = mutation();
    const store = memoryAdapter(state(), [queued]);
    const transport: LucidSyncTransport = {
      push: jest.fn(async (): Promise<LucidSyncTransportResult[]> => {
        expect(store.queue[0]).toMatchObject({
          status: 'sending',
          clientRequestId: 'request-1',
        });
        return [
          { mutationId: queued.id, status: 'ack', remoteEntity: queued.payload.entity },
        ];
      }),
    };

    const result = await replayLucidTrainerQueue(SCOPE, {
      storage: store.adapter,
      transport,
      isNetworkReachable: async () => true,
      now: () => NOW,
    });

    expect(result).toMatchObject({ outcome: 'completed', attempted: 1, acknowledged: 1 });
    expect(store.queue).toEqual([]);
    expect(store.adapter.updateQueue).toHaveBeenCalledTimes(2);
  });

  it('merges progress conflicts and queues a fresh idempotent resolution', async () => {
    const current = state();
    const localProgress = {
      ...createLucidProgramProgress('mild', NOW),
      status: 'active' as const,
      currentDay: 3,
      completedExerciseIds: ['local-exercise'],
      updatedAt: NOW + 20,
    };
    current.progress = [localProgress];
    const localEntity: LucidSyncEntity = {
      entityType: 'progress',
      entityKey: 'mild',
      value: localProgress,
    };
    const remoteEntity: LucidSyncEntity = {
      entityType: 'progress',
      entityKey: 'mild',
      value: {
        ...createLucidProgramProgress('mild', NOW),
        currentDay: 2,
        completedExerciseIds: ['remote-exercise'],
        updatedAt: NOW + 10,
      },
    };
    const queued = mutation(localEntity);
    const store = memoryAdapter(current, [queued]);
    const ids = ['resolved-mutation', 'resolved-request'];

    const result = await replayLucidTrainerQueue(SCOPE, {
      storage: store.adapter,
      transport: {
        push: async () => [
          {
            mutationId: queued.id,
            status: 'conflict',
            remoteEntity,
            remoteRevision: 'revision-2',
          },
        ],
      },
      isNetworkReachable: async () => true,
      now: () => NOW + 30,
      idFactory: () => ids.shift()!,
    });

    expect(result.conflicts).toBe(1);
    expect(store.state.progress[0]?.completedExerciseIds).toEqual([
      'local-exercise',
      'remote-exercise',
    ]);
    expect(store.queue[0]).toMatchObject({
      id: 'resolved-mutation',
      clientRequestId: 'resolved-request',
      baseRevision: 'revision-2',
      status: 'pending',
      retryCount: 0,
    });
  });

  it('schedules bounded retries and blocks a poison mutation at the retry limit', async () => {
    const queued = mutation(preferencesEntity(), { retryCount: 7, status: 'failed' });
    const store = memoryAdapter(state(), [queued]);

    const result = await replayLucidTrainerQueue(SCOPE, {
      storage: store.adapter,
      transport: { push: async () => [{ mutationId: queued.id, status: 'failed' }] },
      isNetworkReachable: async () => true,
      now: () => NOW,
      jitter: () => 0,
      maxRetries: 8,
    });

    expect(result).toMatchObject({ failed: 1, blocked: 1 });
    expect(store.queue[0]).toMatchObject({ status: 'blocked', retryCount: 8 });
    expect(store.queue[0]?.nextAttemptAt).toBeUndefined();
  });

  it('resolves delete conflicts by timestamp and uses a new idempotency key', async () => {
    const current = state();
    const experiment: LucidSyncEntity = {
      entityType: 'experiment',
      entityKey: 'experiment-1',
      value: {
        id: 'experiment-1',
        occurredAt: NOW,
        technique: 'mild',
        preparationMinutes: 10,
        result: 'none',
        lucidityLevel: 0,
        recallLevel: 2,
        sleepQuality: 3,
        factors: [],
        updatedAt: NOW + 10,
      },
    };
    const deletionIds = ['delete-1', 'delete-request-1'];
    const deletion = createLucidTrainerMutation(
      {
        userScope: SCOPE,
        operation: 'delete',
        entityType: 'experiment',
        entityKey: 'experiment-1',
      },
      { now: () => NOW + 20, idFactory: () => deletionIds.shift()! }
    );
    const store = memoryAdapter(current, [deletion]);
    const resolvedIds = ['delete-2', 'delete-request-2'];

    await replayLucidTrainerQueue(SCOPE, {
      storage: store.adapter,
      transport: {
        push: async () => [
          {
            mutationId: deletion.id,
            status: 'conflict',
            remoteEntity: experiment,
            remoteRevision: 'remote-revision',
          },
        ],
      },
      isNetworkReachable: async () => true,
      now: () => NOW + 30,
      idFactory: () => resolvedIds.shift()!,
    });

    expect(store.queue[0]).toMatchObject({
      operation: 'delete',
      id: 'delete-2',
      clientRequestId: 'delete-request-2',
      baseRevision: 'remote-revision',
      status: 'pending',
    });

    const olderDeletion = { ...deletion, clientUpdatedAt: NOW + 5 };
    const remoteWinsStore = memoryAdapter(current, [olderDeletion]);
    await replayLucidTrainerQueue(SCOPE, {
      storage: remoteWinsStore.adapter,
      transport: {
        push: async () => [
          { mutationId: olderDeletion.id, status: 'conflict', remoteEntity: experiment },
        ],
      },
      isNetworkReachable: async () => true,
      now: () => NOW + 30,
    });
    expect(remoteWinsStore.queue).toEqual([]);
    expect(remoteWinsStore.state.experiments[0]?.id).toBe('experiment-1');
  });

  it('keeps the same client request id across transient transport retries', async () => {
    const queued = mutation();
    const store = memoryAdapter(state(), [queued]);

    await replayLucidTrainerQueue(SCOPE, {
      storage: store.adapter,
      transport: { push: async () => Promise.reject(new Error('network timeout')) },
      isNetworkReachable: async () => true,
      now: () => NOW,
      jitter: () => 0,
    });

    expect(store.queue[0]).toMatchObject({
      clientRequestId: 'request-1',
      status: 'failed',
      retryCount: 1,
      nextAttemptAt: NOW + 2_500,
    });
  });

  it('strictly parses pulled entities and tombstones', () => {
    const remotePreferences = preferencesEntity();
    const parsed = parseLucidRemoteEntityRecords([
      {
        entity_type: 'preferences',
        entity_key: 'preferences',
        revision: '4',
        client_updated_at: new Date(NOW).toISOString(),
        entity: remotePreferences,
      },
      {
        entity_type: 'experiment',
        entity_key: 'deleted-experiment',
        revision: '2',
        client_updated_at: new Date(NOW + 10).toISOString(),
        deleted_at: new Date(NOW + 10).toISOString(),
      },
    ]);

    expect(parsed).toEqual([
      expect.objectContaining({
        entityType: 'preferences',
        revision: '4',
        entity: remotePreferences,
      }),
      expect.objectContaining({
        entityType: 'experiment',
        revision: '2',
        deletedAt: NOW + 10,
      }),
    ]);
    expect(() =>
      parseLucidRemoteEntityRecords([
        {
          entity_type: 'preferences',
          entity_key: 'preferences',
          revision: '04',
          client_updated_at: 'not-a-date',
          entity: remotePreferences,
        },
      ])
    ).toThrow('Invalid Lucid Trainer pull entity');
    expect(() => parseLucidRemoteEntityRecords([parsed[0], parsed[0]])).toThrow();

    expect(
      parseLucidRemoteSnapshot({
        reset_revision: '9',
        reset_at: new Date(NOW + 20).toISOString(),
        entities: [],
      })
    ).toEqual({ records: [], resetRevision: '9', resetAt: NOW + 20 });
    expect(() =>
      parseLucidRemoteSnapshot({ reset_revision: '9', entities: [] })
    ).toThrow('Invalid Lucid Trainer reset fence');
    expect(() => parseLucidRemoteSnapshot([])).toThrow(
      'Invalid Lucid Trainer pull snapshot'
    );
  });

  it('merges remote progress, preserves local work and rebases the upload', async () => {
    const current = state();
    const localProgress = {
      ...createLucidProgramProgress('mild', NOW),
      status: 'active' as const,
      currentDay: 3,
      completedExerciseIds: ['local'],
      updatedAt: NOW + 20,
    };
    current.progress = [localProgress];
    const store = memoryAdapter(current);
    const remoteProgress: LucidSyncEntity = {
      entityType: 'progress',
      entityKey: 'mild',
      value: {
        ...createLucidProgramProgress('mild', NOW),
        currentDay: 2,
        completedExerciseIds: ['remote'],
        updatedAt: NOW + 10,
      },
    };
    const ids = ['pull-mutation', 'pull-request'];

    const result = await pullLucidTrainerRemoteState(SCOPE, {
      storage: store.adapter,
      transport: {
        pull: async () => ({
          entities: [
            {
              entity_type: 'progress',
              entity_key: 'mild',
              revision: '7',
              client_updated_at: new Date(NOW + 10).toISOString(),
              entity: remoteProgress,
            },
          ],
        }),
      },
      isNetworkReachable: async () => true,
      now: () => NOW + 30,
      idFactory: () => ids.shift()!,
    });

    expect(result).toMatchObject({ received: 1, merged: 1, reset: false });
    expect(store.state.progress[0]?.completedExerciseIds).toEqual(['local', 'remote']);
    expect(store.queue[0]).toMatchObject({
      baseRevision: '7',
      id: 'pull-mutation',
      clientRequestId: 'pull-request',
      payload: {
        entity: { value: { completedExerciseIds: ['local', 'remote'] } },
      },
    });
  });

  it('applies collection tombstones without deleting a newer local edit', async () => {
    const current = state();
    current.experiments = [
      {
        id: 'experiment-1',
        occurredAt: NOW,
        technique: 'mild',
        preparationMinutes: 5,
        result: 'none',
        lucidityLevel: 0,
        recallLevel: 2,
        sleepQuality: 3,
        factors: [],
        updatedAt: NOW + 20,
      },
    ];
    const store = memoryAdapter(current);
    const ids = ['rebase-mutation', 'rebase-request'];

    await pullLucidTrainerRemoteState(SCOPE, {
      storage: store.adapter,
      transport: {
        pull: async () => ({
          entities: [
            {
              entity_type: 'experiment',
              entity_key: 'experiment-1',
              revision: '3',
              client_updated_at: new Date(NOW + 10).toISOString(),
              deleted_at: new Date(NOW + 10).toISOString(),
            },
          ],
        }),
      },
      isNetworkReachable: async () => true,
      now: () => NOW + 30,
      idFactory: () => ids.shift()!,
    });

    expect(store.state.experiments).toHaveLength(1);
    expect(store.queue[0]).toMatchObject({ operation: 'upsert', baseRevision: '3' });

    store.state.experiments[0] = { ...store.state.experiments[0], updatedAt: NOW + 5 };
    await pullLucidTrainerRemoteState(SCOPE, {
      storage: store.adapter,
      transport: {
        pull: async () => ({
          entities: [
            {
              entity_type: 'experiment',
              entity_key: 'experiment-1',
              revision: '4',
              client_updated_at: new Date(NOW + 10).toISOString(),
              deleted_at: new Date(NOW + 10).toISOString(),
            },
          ],
        }),
      },
      isNetworkReachable: async () => true,
      now: () => NOW + 40,
    });
    expect(store.state.experiments).toHaveLength(0);
  });

  it('treats singleton tombstones as a durable full reset and clears stale uploads', async () => {
    const current = state();
    current.experiments = [
      {
        id: 'offline-experiment',
        occurredAt: NOW,
        technique: 'ssild',
        preparationMinutes: 10,
        result: 'pre_lucid',
        lucidityLevel: 2,
        recallLevel: 3,
        sleepQuality: 4,
        factors: [],
        updatedAt: NOW + 10,
      },
    ];
    const store = memoryAdapter(current, [
      mutation(preferencesEntity(current), { id: 'offline-upload' }),
    ]);
    const deletedAt = NOW + 100;

    const result = await pullLucidTrainerRemoteState(SCOPE, {
      storage: store.adapter,
      transport: {
        pull: async () => ({
          entities: [
            {
              entity_type: 'preferences',
              entity_key: 'preferences',
              revision: '9',
              client_updated_at: new Date(deletedAt).toISOString(),
              deleted_at: new Date(deletedAt).toISOString(),
            },
          ],
        }),
      },
      isNetworkReachable: async () => true,
      now: () => deletedAt + 1,
    });

    expect(result).toMatchObject({ reset: true, deleted: 1 });
    expect(store.queue).toEqual([]);
    expect(store.state).toMatchObject({
      createdAt: deletedAt + 1,
      preferences: { cloudSyncEnabled: false },
      experiments: [],
    });
  });

  it('keeps a full reset effective after singleton tombstones are recreated', async () => {
    const current = state();
    current.progress = [createLucidProgramProgress('ssild', NOW + 10)];
    const store = memoryAdapter(current, [mutation()]);
    const deletedAt = NOW + 100;

    const result = await pullLucidTrainerRemoteState(SCOPE, {
      storage: store.adapter,
      transport: {
        pull: async () => ({
          reset_revision: '10',
          reset_at: new Date(deletedAt).toISOString(),
          // Both singleton rows were recreated remotely; only the independent
          // reset fence can still protect this stale device.
          entities: [],
        }),
      },
      isNetworkReachable: async () => true,
      now: () => deletedAt + 1,
    });

    expect(result).toMatchObject({ reset: true, received: 0 });
    expect(store.queue).toEqual([]);
    expect(store.state.progress).toEqual([]);
    expect(store.state.preferences.cloudSyncEnabled).toBe(false);
  });

  it('carries the durable reset proof on work created after a remote deletion', async () => {
    const queued = mutation(preferencesEntity(), {
      id: 'post-reset-mutation',
      clientRequestId: 'post-reset-request',
    });
    const store = memoryAdapter(state(), [queued]);

    const result = await pullLucidTrainerRemoteState(SCOPE, {
      storage: store.adapter,
      transport: {
        // Another device has already recreated the singleton rows, so the
        // durable fence is the only remaining deletion proof.
        pull: async () => ({
          reset_revision: '12',
          reset_at: new Date(NOW - 100).toISOString(),
          entities: [],
        }),
      },
      isNetworkReachable: async () => true,
      now: () => NOW + 20,
    });

    expect(result).toMatchObject({ reset: false, received: 0 });
    expect(store.queue[0]).toMatchObject({
      id: 'post-reset-mutation',
      clientRequestId: 'post-reset-request',
      resetRevision: '12',
    });
    expect(store.queue[0]?.baseRevision).toBeUndefined();
  });

  it('does not pull before consent or while offline', async () => {
    const transport: LucidPullTransport = {
      pull: jest.fn(async () => ({ entities: [] })),
    };
    const disabled = memoryAdapter(state(false));
    await expect(
      pullLucidTrainerRemoteState(SCOPE, {
        storage: disabled.adapter,
        transport,
        isNetworkReachable: async () => true,
      })
    ).resolves.toMatchObject({ outcome: 'disabled' });
    expect(transport.pull).not.toHaveBeenCalled();

    const offline = memoryAdapter(state(true));
    await expect(
      pullLucidTrainerRemoteState(SCOPE, {
        storage: offline.adapter,
        transport,
        isNetworkReachable: async () => false,
      })
    ).resolves.toMatchObject({ outcome: 'offline' });
    expect(transport.pull).not.toHaveBeenCalled();
  });

  it('claims guest data into the authenticated scope once, then safely clears guest', async () => {
    const guest = state(false);
    guest.experiments = [
      {
        id: 'guest-experiment',
        occurredAt: NOW,
        technique: 'mild',
        preparationMinutes: 8,
        result: 'pre_lucid',
        lucidityLevel: 2,
        recallLevel: 4,
        sleepQuality: 3,
        factors: [],
        updatedAt: NOW + 10,
      },
    ];
    const account = state(true);
    const states = new Map<string, LucidTrainerState>([
      ['guest', guest],
      [SCOPE, account],
    ]);
    const queues = new Map<string, LucidSyncMutation[]>([['guest', []], [SCOPE, []]]);
    const cleared: string[] = [];
    const adapter: LucidScopeMigrationStorageAdapter = {
      loadState: async (scope) => states.get(scope)!,
      updateState: async (scope, updater) => {
        const next = updater(states.get(scope)!);
        states.set(scope, next);
        return next;
      },
      loadQueue: async (scope) => queues.get(scope) ?? [],
      updateQueue: async (scope, updater) => {
        const next = [...updater(queues.get(scope) ?? [])];
        queues.set(scope, next);
        return next;
      },
      clearScope: async (scope) => {
        cleared.push(scope);
        states.set(scope, createInitialLucidTrainerState({ now: NOW + 20, timeZone: 'UTC' }));
        queues.set(scope, []);
      },
    };
    let id = 0;

    const first = await claimLucidTrainerGuestScope(SCOPE, {
      storage: adapter,
      now: () => NOW + 30,
      idFactory: () => `00000000-0000-4000-8000-${String(++id).padStart(12, '0')}`,
    });
    const second = await claimLucidTrainerGuestScope(SCOPE, {
      storage: adapter,
      now: () => NOW + 40,
      idFactory: () => `00000000-0000-4000-8000-${String(++id).padStart(12, '0')}`,
    });

    expect(first).toMatchObject({ claimed: true });
    expect(second).toEqual({ claimed: false, queued: 0 });
    expect(states.get(SCOPE)?.experiments.map((item) => item.id)).toContain(
      'guest-experiment'
    );
    expect(queues.get(SCOPE)?.some((item) => item.entityKey === 'guest-experiment')).toBe(
      true
    );
    expect(cleared).toEqual(['guest']);
  });

  it('detects guest data without changing or clearing the guest scope', async () => {
    const guest = state(false);
    guest.realityChecks = [{
      id: 'guest-check',
      occurredAt: NOW,
      context: 'scheduled',
      method: 'finger_count',
      outcome: 'awake',
      mindful: true,
      updatedAt: NOW,
    }];
    const loadState = jest.fn(async () => guest);

    await expect(hasLucidTrainerGuestData({ loadState })).resolves.toBe(true);
    expect(loadState).toHaveBeenCalledWith('guest');
    expect(guest.realityChecks).toHaveLength(1);
  });

  it('rolls back both scopes and preserves guest data when an explicit import fails', async () => {
    const guest = state(false);
    guest.experiments = [{
      id: 'guest-experiment', occurredAt: NOW, technique: 'mild', preparationMinutes: 5,
      result: 'none', lucidityLevel: 0, recallLevel: 2, sleepQuality: 3, factors: [], updatedAt: NOW,
    }];
    const account = state(true);
    const states = new Map<string, LucidTrainerState>([['guest', guest], [SCOPE, account]]);
    const queues = new Map<string, LucidSyncMutation[]>([['guest', []], [SCOPE, []]]);
    const adapter: LucidScopeMigrationStorageAdapter = {
      loadState: async (scope) => states.get(scope)!,
      loadQueue: async (scope) => queues.get(scope) ?? [],
      updateState: async (scope, updater) => {
        const next = updater(states.get(scope)!);
        states.set(scope, next);
        return next;
      },
      updateQueue: async (scope, updater) => {
        const next = [...updater(queues.get(scope) ?? [])];
        queues.set(scope, next);
        return next;
      },
      clearScope: async () => {
        states.set('guest', state(false));
        queues.set('guest', []);
        throw new Error('storage failure');
      },
    };

    await expect(claimLucidTrainerGuestScope(SCOPE, { storage: adapter })).rejects.toThrow(
      'storage failure'
    );
    expect(states.get('guest')?.experiments.map((item) => item.id)).toEqual(['guest-experiment']);
    expect(states.get(SCOPE)?.experiments).toEqual([]);
    expect(queues.get(SCOPE)).toEqual([]);
  });
});
