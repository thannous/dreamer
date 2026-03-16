import { logger } from '@/lib/logger';
import type { DreamMutation } from '@/lib/types';

const SYNC_LOG_PREFIX = '[dreamSyncObservability]';

export const SYNC_PENDING_AGE_ALERT_MS = 60 * 60 * 1000;
export const SYNC_SUCCESS_RATE_ALERT_THRESHOLD = 0.99;

export type SyncQueueMetrics = {
  userScope: string;
  pendingCount: number;
  sendingCount: number;
  failedCount: number;
  blockedCount: number;
  oldestPendingAgeMs: number | null;
  oldestPendingMutationId?: string;
  measuredAt: number;
};

export type SyncReplayBatchMetrics = {
  userScope: string;
  attemptedCount: number;
  ackCount: number;
  failedCount: number;
  conflictCount: number;
  successRate: number;
  conflictRate: number;
  durationMs: number;
  pendingCountAfter: number;
  oldestPendingAgeMs: number | null;
  measuredAt: number;
};

export type SyncReplayAggregateMetrics = {
  userScope: string;
  totalBatches: number;
  totalAttemptedCount: number;
  totalAckCount: number;
  totalFailedCount: number;
  totalConflictCount: number;
  successRate: number;
  conflictRate: number;
  lastDurationMs: number;
  measuredAt: number;
};

type QueueMetricsOptions = {
  mutations: DreamMutation[];
  now?: number;
  reason: string;
  userScope?: string | null;
};

type ReplayMetricsOptions = {
  attemptedCount: number;
  ackCount: number;
  failedCount: number;
  conflictCount: number;
  durationMs: number;
  pendingMutationsAfter: DreamMutation[];
  now?: number;
  reason: string;
  userScope?: string | null;
};

type QueueClearOptions = {
  mutations: DreamMutation[];
  reason: string;
  now?: number;
  userScope?: string | null;
};

const replayAggregates = new Map<string, SyncReplayAggregateMetrics>();

const normalizeScope = (userScope?: string | null): string => userScope ?? 'guest';

const getMutationTimestamp = (mutation: DreamMutation): number =>
  mutation.clientUpdatedAt || mutation.createdAt || 0;

const isPendingForAge = (mutation: DreamMutation): boolean =>
  (mutation.status ?? 'pending') === 'pending' || (mutation.status ?? 'pending') === 'failed';

export const summarizeSyncQueueMetrics = (
  mutations: DreamMutation[],
  userScope?: string | null,
  now: number = Date.now()
): SyncQueueMetrics => {
  const pendingForAge = mutations.filter(isPendingForAge);
  const oldestPendingMutation = pendingForAge.reduce<DreamMutation | null>((oldest, mutation) => {
    if (!oldest) {
      return mutation;
    }
    return getMutationTimestamp(mutation) < getMutationTimestamp(oldest) ? mutation : oldest;
  }, null);

  return {
    userScope: normalizeScope(userScope),
    pendingCount: mutations.filter((mutation) => (mutation.status ?? 'pending') === 'pending').length,
    sendingCount: mutations.filter((mutation) => mutation.status === 'sending').length,
    failedCount: mutations.filter((mutation) => mutation.status === 'failed').length,
    blockedCount: mutations.filter((mutation) => mutation.status === 'blocked').length,
    oldestPendingAgeMs: oldestPendingMutation ? Math.max(0, now - getMutationTimestamp(oldestPendingMutation)) : null,
    oldestPendingMutationId: oldestPendingMutation?.id,
    measuredAt: now,
  };
};

const maybeAlertPendingAge = (reason: string, metrics: SyncQueueMetrics): void => {
  if (metrics.oldestPendingAgeMs == null || metrics.oldestPendingAgeMs <= SYNC_PENDING_AGE_ALERT_MS) {
    return;
  }

  logger.error(`${SYNC_LOG_PREFIX} pending mutation age threshold exceeded`, {
    reason,
    thresholdMs: SYNC_PENDING_AGE_ALERT_MS,
    metrics,
  });
};

export const reportSyncQueueMetrics = ({
  mutations,
  now = Date.now(),
  reason,
  userScope,
}: QueueMetricsOptions): SyncQueueMetrics => {
  const metrics = summarizeSyncQueueMetrics(mutations, userScope, now);
  logger.debug(`${SYNC_LOG_PREFIX} queue metrics`, { reason, metrics });
  maybeAlertPendingAge(reason, metrics);
  return metrics;
};

const ratio = (numerator: number, denominator: number): number =>
  denominator <= 0 ? 1 : numerator / denominator;

export const recordSyncReplayMetrics = ({
  attemptedCount,
  ackCount,
  failedCount,
  conflictCount,
  durationMs,
  pendingMutationsAfter,
  now = Date.now(),
  reason,
  userScope,
}: ReplayMetricsOptions): { batch: SyncReplayBatchMetrics; aggregate: SyncReplayAggregateMetrics } => {
  const normalizedScope = normalizeScope(userScope);
  const queueMetrics = summarizeSyncQueueMetrics(pendingMutationsAfter, normalizedScope, now);

  const batch: SyncReplayBatchMetrics = {
    userScope: normalizedScope,
    attemptedCount,
    ackCount,
    failedCount,
    conflictCount,
    successRate: ratio(ackCount, attemptedCount),
    conflictRate: ratio(conflictCount, attemptedCount),
    durationMs,
    pendingCountAfter:
      queueMetrics.pendingCount + queueMetrics.failedCount + queueMetrics.sendingCount + queueMetrics.blockedCount,
    oldestPendingAgeMs: queueMetrics.oldestPendingAgeMs,
    measuredAt: now,
  };

  const previous = replayAggregates.get(normalizedScope);
  const aggregate: SyncReplayAggregateMetrics = {
    userScope: normalizedScope,
    totalBatches: (previous?.totalBatches ?? 0) + 1,
    totalAttemptedCount: (previous?.totalAttemptedCount ?? 0) + attemptedCount,
    totalAckCount: (previous?.totalAckCount ?? 0) + ackCount,
    totalFailedCount: (previous?.totalFailedCount ?? 0) + failedCount,
    totalConflictCount: (previous?.totalConflictCount ?? 0) + conflictCount,
    successRate: ratio(
      (previous?.totalAckCount ?? 0) + ackCount,
      (previous?.totalAttemptedCount ?? 0) + attemptedCount
    ),
    conflictRate: ratio(
      (previous?.totalConflictCount ?? 0) + conflictCount,
      (previous?.totalAttemptedCount ?? 0) + attemptedCount
    ),
    lastDurationMs: durationMs,
    measuredAt: now,
  };
  replayAggregates.set(normalizedScope, aggregate);

  logger.debug(`${SYNC_LOG_PREFIX} replay metrics`, {
    reason,
    batch,
    aggregate,
    queueMetrics,
  });

  if (attemptedCount > 0 && aggregate.successRate < SYNC_SUCCESS_RATE_ALERT_THRESHOLD) {
    logger.error(`${SYNC_LOG_PREFIX} replay success rate below threshold`, {
      reason,
      threshold: SYNC_SUCCESS_RATE_ALERT_THRESHOLD,
      batch,
      aggregate,
    });
  }

  maybeAlertPendingAge(`${reason}:post_replay_queue`, queueMetrics);

  return { batch, aggregate };
};

export const reportSyncQueueClearedWithPending = ({
  mutations,
  reason,
  now = Date.now(),
  userScope,
}: QueueClearOptions): SyncQueueMetrics => {
  const metrics = summarizeSyncQueueMetrics(mutations, userScope, now);
  logger.error(`${SYNC_LOG_PREFIX} queue cleared while pending mutations existed`, {
    reason,
    metrics,
  });
  return metrics;
};

export const resetSyncObservabilityState = (): void => {
  replayAggregates.clear();
};
