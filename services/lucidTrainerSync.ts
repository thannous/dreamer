import * as Crypto from 'expo-crypto';
import * as Network from 'expo-network';

import {
  applyLucidSyncEntity,
  canonicalLucidJson,
  createInitialLucidTrainerState,
  getLucidSyncEntities,
  mergeLucidTrainerStates,
  removeLucidSyncEntity,
  resolveLucidEntityConflict,
} from '@/lib/lucid/domain';
import {
  LUCID_TRAINER_MUTATION_VERSION,
  isLucidSyncEntity,
  type LucidSyncEntity,
  type LucidSyncMutation,
  type LucidTrainerState,
} from '@/lib/lucid/model';
import { supabase } from '@/lib/supabase';
import {
  getLucidTrainerState,
  loadLucidTrainerSyncQueue,
  updateLucidTrainerState,
  updateLucidTrainerSyncQueue,
} from '@/services/lucidTrainerStorage';

export const LUCID_SYNC_BATCH_SIZE = 25;
export const LUCID_SYNC_BASE_DELAY_MS = 5_000;
export const LUCID_SYNC_MAX_DELAY_MS = 6 * 60 * 60 * 1_000;
export const LUCID_SYNC_MAX_RETRIES = 8;

export type LucidSyncTransportResult =
  | {
      mutationId: string;
      status: 'ack';
      remoteEntity?: LucidSyncEntity;
      remoteRevision?: string;
    }
  | {
      mutationId: string;
      status: 'conflict';
      remoteEntity?: LucidSyncEntity;
      remoteRevision?: string;
      error?: string;
    }
  | {
      mutationId: string;
      status: 'failed';
      error?: string;
    };

export interface LucidSyncTransport {
  push(mutations: readonly LucidSyncMutation[]): Promise<LucidSyncTransportResult[]>;
}

export type LucidRemoteEntityRecord =
  | {
      entityType: LucidSyncEntity['entityType'];
      entityKey: string;
      revision: string;
      clientUpdatedAt: number;
      entity: LucidSyncEntity;
      deletedAt?: never;
    }
  | {
      entityType: LucidSyncEntity['entityType'];
      entityKey: string;
      revision: string;
      clientUpdatedAt: number;
      entity?: never;
      deletedAt: number;
    };

export interface LucidRemoteSnapshot {
  records: LucidRemoteEntityRecord[];
  resetRevision?: string;
  resetAt?: number;
}

export interface LucidPullTransport {
  pull(): Promise<unknown>;
}

export interface LucidSyncStorageAdapter {
  loadQueue(userScope: string): Promise<LucidSyncMutation[]>;
  updateQueue(
    userScope: string,
    updater: (current: LucidSyncMutation[]) => readonly LucidSyncMutation[]
  ): Promise<LucidSyncMutation[]>;
  loadState(userScope: string): Promise<LucidTrainerState>;
  updateState(
    userScope: string,
    updater: (current: LucidTrainerState) => LucidTrainerState
  ): Promise<LucidTrainerState>;
}

export interface LucidScopeMigrationStorageAdapter extends LucidSyncStorageAdapter {
  clearScope(userScope: string): Promise<void>;
}

export interface ReplayLucidTrainerQueueOptions {
  transport?: LucidSyncTransport;
  storage?: LucidSyncStorageAdapter;
  isNetworkReachable?: () => Promise<boolean>;
  now?: () => number;
  jitter?: () => number;
  idFactory?: () => string;
  maxRetries?: number;
  batchSize?: number;
}

export interface PullLucidTrainerRemoteStateOptions {
  transport?: LucidPullTransport;
  storage?: LucidSyncStorageAdapter;
  isNetworkReachable?: () => Promise<boolean>;
  now?: () => number;
  idFactory?: () => string;
}

export interface LucidPullResult {
  outcome: 'disabled' | 'offline' | 'completed';
  received: number;
  merged: number;
  deleted: number;
  reset: boolean;
}

export interface LucidGuestClaimResult {
  claimed: boolean;
  queued: number;
}

export interface LucidSyncReplayResult {
  outcome: 'disabled' | 'offline' | 'idle' | 'completed';
  attempted: number;
  acknowledged: number;
  failed: number;
  conflicts: number;
  blocked: number;
  pending: number;
}

function hasLucidTrainerStateData(state: LucidTrainerState): boolean {
  return (
    state.onboarding.status !== 'not_started' ||
    state.progress.length > 0 ||
    state.experiments.length > 0 ||
    state.realityChecks.length > 0 ||
    state.weeklyReviews.length > 0 ||
    (state.dreamSignDecisions?.length ?? 0) > 0 ||
    state.updatedAt > state.createdAt
  );
}

type CreateLucidMutationInput =
  | {
      userScope: string;
      operation: 'upsert';
      entity: LucidSyncEntity;
      baseRevision?: string;
    }
  | {
      userScope: string;
      operation: 'delete';
      entityType: LucidSyncEntity['entityType'];
      entityKey: string;
      baseRevision?: string;
    };

type ResetAwareLucidSyncMutation = LucidSyncMutation & { resetRevision?: string };

function defaultIdFactory(): string {
  return Crypto.randomUUID();
}

function boundedError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error || 'Sync failed');
  return message.slice(0, 2_000);
}

export function computeLucidSyncBackoffMs(
  retryCount: number,
  jitter: () => number = Math.random,
  baseDelayMs = LUCID_SYNC_BASE_DELAY_MS,
  maxDelayMs = LUCID_SYNC_MAX_DELAY_MS
): number {
  const safeRetryCount = Math.max(1, Math.min(32, Math.floor(retryCount)));
  const exponentialCap = Math.min(maxDelayMs, baseDelayMs * 2 ** (safeRetryCount - 1));
  const randomValue = Math.max(0, Math.min(1, jitter()));
  // Equal jitter avoids a retry storm without allowing a zero-delay tight loop.
  return Math.floor(exponentialCap / 2 + (exponentialCap / 2) * randomValue);
}

export function createLucidTrainerMutation(
  input: CreateLucidMutationInput,
  dependencies: { now?: () => number; idFactory?: () => string } = {}
): LucidSyncMutation {
  const now = dependencies.now?.() ?? Date.now();
  const idFactory = dependencies.idFactory ?? defaultIdFactory;
  const entityType = input.operation === 'upsert' ? input.entity.entityType : input.entityType;
  const entityKey = input.operation === 'upsert' ? input.entity.entityKey : input.entityKey;
  const clientUpdatedAt =
    input.operation === 'upsert' ? input.entity.value.updatedAt : now;

  return {
    version: LUCID_TRAINER_MUTATION_VERSION,
    id: idFactory(),
    userScope: input.userScope,
    entityType,
    entityKey,
    operation: input.operation,
    clientRequestId: idFactory(),
    baseRevision: input.baseRevision,
    clientUpdatedAt,
    payload: input.operation === 'upsert' ? { entity: input.entity } : {},
    status: 'pending',
    retryCount: 0,
    createdAt: now,
  };
}

export async function queueLucidTrainerMutation(
  mutation: LucidSyncMutation
): Promise<LucidSyncMutation[]> {
  return updateLucidTrainerSyncQueue(mutation.userScope, (current) => {
    if (current.some((entry) => entry.clientRequestId === mutation.clientRequestId)) {
      return current;
    }
    const resetRevision = current.find(
      (entry) => typeof (entry as ResetAwareLucidSyncMutation).resetRevision === 'string'
    );
    const next: ResetAwareLucidSyncMutation = resetRevision
      ? {
          ...mutation,
          resetRevision: (resetRevision as ResetAwareLucidSyncMutation).resetRevision,
        }
      : mutation;
    return [...current, next].sort(
      (left, right) => left.createdAt - right.createdAt || left.id.localeCompare(right.id)
    );
  });
}

async function defaultNetworkReachable(): Promise<boolean> {
  try {
    const state = await Network.getNetworkStateAsync();
    return state.isConnected !== false && state.isInternetReachable !== false;
  } catch {
    // Match the existing app convention: an unavailable network API is not proof
    // that the device is offline. The transport still has normal failure handling.
    return true;
  }
}

function parseTransportResult(value: unknown): LucidSyncTransportResult | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const mutationId = row.mutation_id ?? row.mutationId;
  const remoteRevision = row.remote_revision ?? row.remoteRevision;
  const remoteEntity = row.remote_entity ?? row.remoteEntity;
  if (typeof mutationId !== 'string') return null;
  if (remoteRevision !== undefined && typeof remoteRevision !== 'string') return null;
  if (remoteEntity !== undefined && !isLucidSyncEntity(remoteEntity)) return null;

  if (row.status === 'ack') {
    return { mutationId, status: 'ack', remoteEntity, remoteRevision };
  }
  if (row.status === 'conflict') {
    return {
      mutationId,
      status: 'conflict',
      remoteEntity,
      remoteRevision,
      error: typeof row.error === 'string' ? row.error.slice(0, 2_000) : undefined,
    };
  }
  if (row.status === 'failed') {
    return {
      mutationId,
      status: 'failed',
      error: typeof row.error === 'string' ? row.error.slice(0, 2_000) : undefined,
    };
  }
  return null;
}

const LUCID_REMOTE_ENTITY_TYPES = [
  'onboarding',
  'preferences',
  'progress',
  'experiment',
  'reality_check',
  'weekly_review',
  'dream_sign',
  'dream_atlas',
] as const satisfies readonly LucidSyncEntity['entityType'][];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseRemoteTimestamp(value: unknown): number | null {
  if (
    typeof value !== 'string' ||
    value.length > 64 ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
  ) {
    return null;
  }
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp >= 0 ? timestamp : null;
}

function parseRemoteRecord(value: unknown): LucidRemoteEntityRecord | null {
  if (!isRecord(value)) return null;
  const entityType = value.entity_type;
  const entityKey = value.entity_key;
  const revision = value.revision;
  const clientUpdatedAt = parseRemoteTimestamp(value.client_updated_at);
  if (
    typeof entityType !== 'string' ||
    !LUCID_REMOTE_ENTITY_TYPES.includes(entityType as LucidSyncEntity['entityType']) ||
    typeof entityKey !== 'string' ||
    entityKey.length < 1 ||
    entityKey.length > 256 ||
    typeof revision !== 'string' ||
    !/^[1-9]\d*$/.test(revision) ||
    clientUpdatedAt === null
  ) {
    return null;
  }
  // Dream atlas is a durable singleton. A mismatched key is not a collection
  // row and must never be interpreted as a full-account reset.
  if (entityType === 'dream_atlas' && entityKey !== 'dream_atlas') {
    return null;
  }

  const deletedAt = parseRemoteTimestamp(value.deleted_at);
  if (value.deleted_at !== undefined) {
    if (deletedAt === null || value.entity !== undefined) return null;
    return {
      entityType: entityType as LucidSyncEntity['entityType'],
      entityKey,
      revision,
      clientUpdatedAt,
      deletedAt,
    };
  }

  if (
    !isLucidSyncEntity(value.entity) ||
    value.entity.entityType !== entityType ||
    value.entity.entityKey !== entityKey
  ) {
    return null;
  }
  return {
    entityType: entityType as LucidSyncEntity['entityType'],
    entityKey,
    revision,
    clientUpdatedAt,
    entity: value.entity,
  };
}

export function parseLucidRemoteEntityRecords(value: unknown): LucidRemoteEntityRecord[] {
  if (!Array.isArray(value) || value.length > 10_000) {
    throw new Error('Invalid Lucid Trainer pull response');
  }
  const records = value.map(parseRemoteRecord);
  if (records.some((record) => record === null)) {
    throw new Error('Invalid Lucid Trainer pull entity');
  }
  const parsed = records as LucidRemoteEntityRecord[];
  const keys = parsed.map((record) => `${record.entityType}:${record.entityKey}`);
  if (new Set(keys).size !== keys.length) {
    throw new Error('Duplicate Lucid Trainer pull entity');
  }
  return parsed;
}

export function parseLucidRemoteSnapshot(value: unknown): LucidRemoteSnapshot {
  if (!isRecord(value) || !Object.prototype.hasOwnProperty.call(value, 'entities')) {
    throw new Error('Invalid Lucid Trainer pull snapshot');
  }
  const resetRevision = value.reset_revision;
  const resetAt = parseRemoteTimestamp(value.reset_at);
  const hasResetRevision = resetRevision !== undefined;
  const hasResetAt = value.reset_at !== undefined;
  if (
    hasResetRevision !== hasResetAt ||
    (hasResetRevision &&
      (typeof resetRevision !== 'string' ||
        !/^[1-9]\d*$/.test(resetRevision) ||
        resetAt === null))
  ) {
    throw new Error('Invalid Lucid Trainer reset fence');
  }
  return {
    records: parseLucidRemoteEntityRecords(value.entities),
    resetRevision: hasResetRevision ? (resetRevision as string) : undefined,
    resetAt: hasResetAt ? (resetAt as number) : undefined,
  };
}

export const supabaseLucidPullTransport: LucidPullTransport = {
  async pull() {
    const { data, error } = await supabase.rpc('get_lucid_trainer_entities');
    if (error) throw new Error(error.message || 'Lucid Trainer pull failed');
    return data;
  },
};

export const supabaseLucidSyncTransport: LucidSyncTransport = {
  async push(mutations) {
    const payload = mutations.map((mutation) => ({
      mutation_id: mutation.id,
      client_request_id: mutation.clientRequestId,
      entity_type: mutation.entityType,
      entity_key: mutation.entityKey,
      operation: mutation.operation,
      base_revision: mutation.baseRevision ?? null,
      reset_revision: (mutation as ResetAwareLucidSyncMutation).resetRevision ?? null,
      client_updated_at: new Date(mutation.clientUpdatedAt).toISOString(),
      payload: mutation.payload,
    }));
    const { data, error } = await supabase.rpc('sync_lucid_trainer_mutations', {
      mutations: payload,
    });
    if (error) throw new Error(error.message || 'Lucid Trainer sync failed');
    if (!Array.isArray(data)) throw new Error('Invalid Lucid Trainer sync response');

    const parsed = data.map(parseTransportResult);
    if (parsed.some((result) => result === null)) {
      throw new Error('Invalid Lucid Trainer sync result');
    }
    return parsed as LucidSyncTransportResult[];
  },
};

const defaultStorage: LucidSyncStorageAdapter = {
  loadQueue: loadLucidTrainerSyncQueue,
  updateQueue: updateLucidTrainerSyncQueue,
  loadState: getLucidTrainerState,
  updateState: (userScope, updater) => updateLucidTrainerState(userScope, updater),
};

type PullQueueDecision =
  | { kind: 'drop'; revision: string; cutoff: number }
  | { kind: 'upsert'; revision: string; entity: LucidSyncEntity };

function syncEntityKey(entityType: LucidSyncEntity['entityType'], entityKey: string): string {
  return `${entityType}:${entityKey}`;
}

function findSyncEntity(
  state: LucidTrainerState,
  entityType: LucidSyncEntity['entityType'],
  entityKey: string
): LucidSyncEntity | undefined {
  return getLucidSyncEntities(state).find(
    (entity) => entity.entityType === entityType && entity.entityKey === entityKey
  );
}

function withRemoteRevision(params: {
  mutation: LucidSyncMutation;
  baseRevision: string;
  resetRevision?: string;
  now: number;
  idFactory: () => string;
}): ResetAwareLucidSyncMutation {
  return {
    ...params.mutation,
    id: params.idFactory(),
    clientRequestId: params.idFactory(),
    baseRevision: params.baseRevision,
    resetRevision: params.resetRevision,
    status: 'pending',
    retryCount: 0,
    createdAt: params.now,
    lastAttemptAt: undefined,
    nextAttemptAt: undefined,
    lastError: undefined,
  };
}

function createRebasedUpsert(params: {
  userScope: string;
  entity: LucidSyncEntity;
  baseRevision: string;
  resetRevision?: string;
  now: number;
  idFactory: () => string;
}): ResetAwareLucidSyncMutation {
  return {
    ...createLucidTrainerMutation(
      {
        userScope: params.userScope,
        operation: 'upsert',
        entity: params.entity,
        baseRevision: params.baseRevision,
      },
      { now: () => params.now, idFactory: params.idFactory }
    ),
    resetRevision: params.resetRevision,
  };
}

export async function pullLucidTrainerRemoteState(
  userScope: string,
  options: PullLucidTrainerRemoteStateOptions = {}
): Promise<LucidPullResult> {
  const storage = options.storage ?? defaultStorage;
  const networkReachable = options.isNetworkReachable ?? defaultNetworkReachable;
  const nowFactory = options.now ?? Date.now;
  const idFactory = options.idFactory ?? defaultIdFactory;
  const initialState = await storage.loadState(userScope);
  if (!initialState.preferences.cloudSyncEnabled) {
    return { outcome: 'disabled', received: 0, merged: 0, deleted: 0, reset: false };
  }
  if (!(await networkReachable())) {
    return { outcome: 'offline', received: 0, merged: 0, deleted: 0, reset: false };
  }

  const raw = await (options.transport ?? supabaseLucidPullTransport).pull();
  const snapshot = parseLucidRemoteSnapshot(raw);
  const { records, resetAt, resetRevision } = snapshot;
  if (!records.length && !resetRevision) {
    return { outcome: 'completed', received: 0, merged: 0, deleted: 0, reset: false };
  }
  const pullNow = nowFactory();

  const singletonTombstoneResetAt = records.reduce<number | undefined>(
    (latest, record) =>
      record.deletedAt !== undefined &&
      (record.entityType === 'onboarding' || record.entityType === 'preferences')
        ? Math.max(latest ?? 0, record.deletedAt)
        : latest,
    undefined
  );
  const effectiveResetAt =
    resetAt === undefined
      ? singletonTombstoneResetAt
      : Math.max(resetAt, singletonTombstoneResetAt ?? 0);
  if (effectiveResetAt !== undefined && effectiveResetAt >= initialState.createdAt) {
    const resetTimestamp = Math.max(pullNow, effectiveResetAt + 1);
    await storage.updateState(userScope, (current) =>
      createInitialLucidTrainerState({
        now: resetTimestamp,
        timeZone: current.preferences.timeZone,
        locale: current.preferences.locale,
      })
    );
    await storage.updateQueue(userScope, () => []);
    return {
      outcome: 'completed',
      received: records.length,
      merged: 0,
      deleted: 1,
      reset: true,
    };
  }

  const decisions = new Map<string, PullQueueDecision>();
  let merged = 0;
  let deleted = 0;

  await storage.updateState(userScope, (current) => {
    let next = current;
    records.forEach((record) => {
      const key = syncEntityKey(record.entityType, record.entityKey);
      const local = findSyncEntity(next, record.entityType, record.entityKey);
      if (record.entity) {
        const resolved = local
          ? resolveLucidEntityConflict(local, record.entity)
          : record.entity;
        next = applyLucidSyncEntity(next, resolved);
        merged += 1;
        decisions.set(
          key,
          canonicalLucidJson(resolved) === canonicalLucidJson(record.entity)
            ? { kind: 'drop', revision: record.revision, cutoff: record.entity.value.updatedAt }
            : { kind: 'upsert', revision: record.revision, entity: resolved }
        );
        return;
      }

      if (local && local.value.updatedAt > record.deletedAt) {
        decisions.set(key, { kind: 'upsert', revision: record.revision, entity: local });
        return;
      }
      if (local) {
        next = removeLucidSyncEntity(next, record.entityType, record.entityKey, record.deletedAt);
        deleted += 1;
      }
      decisions.set(key, { kind: 'drop', revision: record.revision, cutoff: record.deletedAt });
    });
    return next;
  });

  await storage.updateQueue(userScope, (current) => {
    let next = [...current];
    decisions.forEach((decision, key) => {
      const matching = next.filter(
        (mutation) => syncEntityKey(mutation.entityType, mutation.entityKey) === key
      );
      next = next.filter(
        (mutation) => syncEntityKey(mutation.entityType, mutation.entityKey) !== key
      );
      const cutoff =
        decision.kind === 'drop' ? decision.cutoff : decision.entity.value.updatedAt;
      const newestConcurrent = matching
        .filter((mutation) => mutation.clientUpdatedAt > cutoff)
        .sort(
          (left, right) =>
            right.clientUpdatedAt - left.clientUpdatedAt || right.createdAt - left.createdAt
        )[0];
      if (newestConcurrent) {
        next.push(
          withRemoteRevision({
            mutation: newestConcurrent,
            baseRevision: decision.revision,
            resetRevision,
            now: pullNow,
            idFactory,
          })
        );
      } else if (decision.kind === 'upsert') {
        next.push(
          createRebasedUpsert({
            userScope,
            entity: decision.entity,
            baseRevision: decision.revision,
            resetRevision,
            now: pullNow,
            idFactory,
          })
        );
      }
    });

    if (resetRevision) {
      next = next.map((mutation) => {
        const resetAware = mutation as ResetAwareLucidSyncMutation;
        if (resetAware.resetRevision === resetRevision) return resetAware;
        // Attaching reset proof does not change the entity revision or the
        // idempotency identity of an otherwise untouched mutation.
        return { ...mutation, resetRevision };
      });
    }
    return next.sort(
      (left, right) => left.createdAt - right.createdAt || left.id.localeCompare(right.id)
    );
  });

  return {
    outcome: 'completed',
    received: records.length,
    merged,
    deleted,
    reset: false,
  };
}

export async function claimLucidTrainerGuestScope(
  targetUserScope: string,
  options: {
    storage: LucidScopeMigrationStorageAdapter;
    guestScope?: string;
    now?: () => number;
    idFactory?: () => string;
  }
): Promise<LucidGuestClaimResult> {
  const guestScope = options.guestScope ?? 'guest';
  if (targetUserScope === guestScope) return { claimed: false, queued: 0 };

  const guest = await options.storage.loadState(guestScope);
  if (!hasLucidTrainerStateData(guest)) return { claimed: false, queued: 0 };

  const account = await options.storage.loadState(targetUserScope);
  const accountQueue = await options.storage.loadQueue(targetUserScope);
  const guestQueue = await options.storage.loadQueue(guestScope);
  const merged = mergeLucidTrainerStates(account, guest);
  const now = options.now ?? Date.now;
  const idFactory = options.idFactory ?? defaultIdFactory;
  const mergedForAccount: LucidTrainerState = {
    ...merged,
    preferences: {
      ...merged.preferences,
      cloudSyncEnabled: account.preferences.cloudSyncEnabled,
      updatedAt: Math.max(merged.preferences.updatedAt, account.preferences.updatedAt),
    },
  };
  try {
    await options.storage.updateState(targetUserScope, () => mergedForAccount);

    let queued = 0;
    if (mergedForAccount.preferences.cloudSyncEnabled) {
      const entities = getLucidSyncEntities(mergedForAccount);
      await options.storage.updateQueue(targetUserScope, (current) => {
        const existingKeys = new Set(
          current
            .filter((mutation) => mutation.operation === 'upsert')
            .map((mutation) => syncEntityKey(mutation.entityType, mutation.entityKey))
        );
        const additions = entities.flatMap((entity) => {
          if (existingKeys.has(syncEntityKey(entity.entityType, entity.entityKey))) return [];
          const existing = findSyncEntity(account, entity.entityType, entity.entityKey);
          if (
            existing &&
            canonicalLucidJson(existing) === canonicalLucidJson(entity)
          ) {
            return [];
          }
          return [
            createLucidTrainerMutation(
              { userScope: targetUserScope, operation: 'upsert', entity },
              { now, idFactory }
            ),
          ];
        });
        queued = additions.length;
        return [...current, ...additions].sort(
          (left, right) => left.createdAt - right.createdAt || left.id.localeCompare(right.id)
        );
      });
    }

    await options.storage.clearScope(guestScope);
    return { claimed: true, queued };
  } catch (error) {
    // A guest import is consented data movement. If any step fails, restore both
    // scopes so a retry cannot silently lose or partially attach another
    // person's device-local training.
    const rollback = await Promise.allSettled([
      options.storage.updateState(targetUserScope, () => account),
      options.storage.updateQueue(targetUserScope, () => accountQueue),
      options.storage.updateState(guestScope, () => guest),
      options.storage.updateQueue(guestScope, () => guestQueue),
    ]);
    if (rollback.some((result) => result.status === 'rejected')) {
      throw new Error('Guest import failed and local rollback was incomplete');
    }
    throw error;
  }
}

export async function hasLucidTrainerGuestData(
  storage: Pick<LucidScopeMigrationStorageAdapter, 'loadState'>,
  guestScope = 'guest'
): Promise<boolean> {
  const guest = await storage.loadState(guestScope);
  return hasLucidTrainerStateData(guest);
}

function markFailed(params: {
  mutation: LucidSyncMutation;
  now: number;
  error: string;
  jitter: () => number;
  maxRetries: number;
}): LucidSyncMutation {
  const retryCount = params.mutation.retryCount + 1;
  const blocked = retryCount >= params.maxRetries;
  return {
    ...params.mutation,
    status: blocked ? 'blocked' : 'failed',
    retryCount,
    lastAttemptAt: params.now,
    nextAttemptAt: blocked
      ? undefined
      : params.now + computeLucidSyncBackoffMs(retryCount, params.jitter),
    lastError: params.error,
  };
}

function canAttempt(mutation: LucidSyncMutation, now: number): boolean {
  return (
    mutation.status !== 'blocked' &&
    (mutation.status === 'pending' ||
      mutation.status === 'failed' ||
      mutation.status === 'sending') &&
    (mutation.nextAttemptAt === undefined || mutation.nextAttemptAt <= now)
  );
}

function mergeEntityIntoLatestState(
  state: LucidTrainerState,
  incoming: LucidSyncEntity
): LucidTrainerState {
  const current = getLucidSyncEntities(state).find(
    (entity) =>
      entity.entityType === incoming.entityType && entity.entityKey === incoming.entityKey
  );
  return applyLucidSyncEntity(
    state,
    current ? resolveLucidEntityConflict(current, incoming) : incoming
  );
}

function applyAcknowledgedDeletion(
  state: LucidTrainerState,
  mutation: LucidSyncMutation,
  now: number
): LucidTrainerState {
  const current = getLucidSyncEntities(state).find(
    (entity) =>
      entity.entityType === mutation.entityType && entity.entityKey === mutation.entityKey
  );
  if (current && current.value.updatedAt > mutation.clientUpdatedAt) {
    return state;
  }
  return removeLucidSyncEntity(state, mutation.entityType, mutation.entityKey, now);
}

function replaySummary(
  outcome: LucidSyncReplayResult['outcome'],
  queue: readonly LucidSyncMutation[],
  counts: Omit<LucidSyncReplayResult, 'outcome' | 'pending' | 'blocked'>
): LucidSyncReplayResult {
  return {
    outcome,
    ...counts,
    blocked: queue.filter((mutation) => mutation.status === 'blocked').length,
    pending: queue.length,
  };
}

export async function replayLucidTrainerQueue(
  userScope: string,
  options: ReplayLucidTrainerQueueOptions = {}
): Promise<LucidSyncReplayResult> {
  const storage = options.storage ?? defaultStorage;
  const transport = options.transport ?? supabaseLucidSyncTransport;
  const networkReachable = options.isNetworkReachable ?? defaultNetworkReachable;
  const nowFactory = options.now ?? Date.now;
  const jitter = options.jitter ?? Math.random;
  const idFactory = options.idFactory ?? defaultIdFactory;
  const maxRetries = Math.max(1, options.maxRetries ?? LUCID_SYNC_MAX_RETRIES);
  const batchSize = Math.max(1, Math.min(100, options.batchSize ?? LUCID_SYNC_BATCH_SIZE));
  const queue = await storage.loadQueue(userScope);
  const emptyCounts = { attempted: 0, acknowledged: 0, failed: 0, conflicts: 0 };
  const state = await storage.loadState(userScope);

  if (!state.preferences.cloudSyncEnabled) {
    return replaySummary('disabled', queue, emptyCounts);
  }

  if (!(await networkReachable())) {
    return replaySummary('offline', queue, emptyCounts);
  }

  const now = nowFactory();
  const eligible = queue.filter((mutation) => canAttempt(mutation, now)).slice(0, batchSize);
  if (!eligible.length) {
    return replaySummary('idle', queue, emptyCounts);
  }

  const eligibleIds = new Set(eligible.map((mutation) => mutation.id));
  const sendingQueue = await storage.updateQueue(userScope, (current) =>
    current.map((mutation) =>
      eligibleIds.has(mutation.id)
        ? {
            ...mutation,
            status: 'sending' as const,
            lastAttemptAt: now,
            nextAttemptAt: undefined,
          }
        : mutation
    )
  );
  const sendingById = new Map(sendingQueue.map((mutation) => [mutation.id, mutation]));

  let results: LucidSyncTransportResult[];
  try {
    results = await transport.push(eligible);
  } catch (error) {
    const message = boundedError(error);
    const failedQueue = await storage.updateQueue(userScope, (current) =>
      current.map((mutation) =>
        eligibleIds.has(mutation.id)
          ? markFailed({ mutation, now, error: message, jitter, maxRetries })
          : mutation
      )
    );
    return replaySummary('completed', failedQueue, {
      attempted: eligible.length,
      acknowledged: 0,
      failed: eligible.length,
      conflicts: 0,
    });
  }

  const resultsByMutationId = new Map(results.map((result) => [result.mutationId, result]));
  let acknowledged = 0;
  let failed = 0;
  let conflicts = 0;
  const replacements = new Map<string, LucidSyncMutation | null>();
  const stateTransforms: ((current: LucidTrainerState) => LucidTrainerState)[] = [];

  for (const eligibleMutation of eligible) {
    const mutation = sendingById.get(eligibleMutation.id) ?? eligibleMutation;

    const result = resultsByMutationId.get(mutation.id);
    if (!result) {
      failed += 1;
      replacements.set(
        mutation.id,
        markFailed({
          mutation,
          now,
          error: 'Sync response omitted the mutation result',
          jitter,
          maxRetries,
        })
      );
      continue;
    }

    if (result.status === 'failed') {
      failed += 1;
      replacements.set(
        mutation.id,
        markFailed({
          mutation,
          now,
          error: result.error ?? 'Lucid Trainer sync failed',
          jitter,
          maxRetries,
        })
      );
      continue;
    }

    if (result.status === 'ack') {
      acknowledged += 1;
      replacements.set(mutation.id, null);
      if (result.remoteEntity) {
        const localEntity = mutation.payload.entity;
        const resolved =
          localEntity &&
          localEntity.entityType === result.remoteEntity.entityType &&
          localEntity.entityKey === result.remoteEntity.entityKey
            ? resolveLucidEntityConflict(localEntity, result.remoteEntity)
            : result.remoteEntity;
        stateTransforms.push((current) => mergeEntityIntoLatestState(current, resolved));
      } else if (mutation.operation === 'delete') {
        stateTransforms.push((current) => applyAcknowledgedDeletion(current, mutation, now));
      }
      continue;
    }

    conflicts += 1;
    const localEntity = mutation.payload.entity;
    const remoteEntity = result.remoteEntity;
    if (
      mutation.operation === 'delete' &&
      remoteEntity &&
      remoteEntity.entityType === mutation.entityType &&
      remoteEntity.entityKey === mutation.entityKey
    ) {
      if (mutation.clientUpdatedAt < remoteEntity.value.updatedAt) {
        stateTransforms.push((current) => mergeEntityIntoLatestState(current, remoteEntity));
        acknowledged += 1;
        replacements.set(mutation.id, null);
      } else {
        replacements.set(mutation.id, {
          ...mutation,
          id: idFactory(),
          clientRequestId: idFactory(),
          baseRevision: result.remoteRevision,
          status: 'pending',
          retryCount: 0,
          createdAt: now,
          lastAttemptAt: undefined,
          nextAttemptAt: undefined,
          lastError: undefined,
        });
      }
      continue;
    }
    if (
      !localEntity ||
      !remoteEntity ||
      localEntity.entityType !== remoteEntity.entityType ||
      localEntity.entityKey !== remoteEntity.entityKey
    ) {
      replacements.set(mutation.id, {
        ...mutation,
        status: 'blocked',
        lastAttemptAt: now,
        nextAttemptAt: undefined,
        lastError: result.error ?? 'Conflict response did not include a matching entity',
      });
      continue;
    }

    const resolved = resolveLucidEntityConflict(localEntity, remoteEntity);
    stateTransforms.push((current) => mergeEntityIntoLatestState(current, resolved));
    if (canonicalLucidJson(resolved) === canonicalLucidJson(remoteEntity)) {
      acknowledged += 1;
      replacements.set(mutation.id, null);
      continue;
    }

    replacements.set(mutation.id, {
      ...mutation,
      id: idFactory(),
      clientRequestId: idFactory(),
      baseRevision: result.remoteRevision,
      clientUpdatedAt: resolved.value.updatedAt,
      payload: { entity: resolved },
      status: 'pending',
      retryCount: 0,
      createdAt: now,
      lastAttemptAt: undefined,
      nextAttemptAt: undefined,
      lastError: undefined,
    });
  }

  if (stateTransforms.length) {
    await storage.updateState(userScope, (current) =>
      stateTransforms.reduce((next, transform) => transform(next), current)
    );
  }
  const nextQueue = await storage.updateQueue(userScope, (current) =>
    current.flatMap((mutation) => {
      if (!replacements.has(mutation.id)) return [mutation];
      const replacement = replacements.get(mutation.id);
      return replacement ? [replacement] : [];
    })
  );

  return replaySummary('completed', nextQueue, {
    attempted: eligible.length,
    acknowledged,
    failed,
    conflicts,
  });
}
