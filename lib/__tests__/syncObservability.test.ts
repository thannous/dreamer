import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockLogger = {
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  log: jest.fn(),
};

jest.mock('@/lib/logger', () => ({
  logger: mockLogger,
}));

const buildMutation = (overrides: Record<string, unknown> = {}) =>
  ({
    version: 1,
    id: `mutation-${Math.random().toString(36).slice(2, 8)}`,
    userScope: 'user:user-1',
    entityType: 'dream',
    entityKey: 'local:1',
    operation: 'update',
    clientRequestId: 'request-1',
    clientUpdatedAt: 1_000,
    payload: {},
    status: 'pending',
    retryCount: 0,
    createdAt: 1_000,
    ...overrides,
  }) as any;

describe('syncObservability', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('summarizes queue depth and oldest pending age', () => {
    const { summarizeSyncQueueMetrics } = require('@/lib/syncObservability');

    const metrics = summarizeSyncQueueMetrics(
      [
        buildMutation({ id: 'pending-old', createdAt: 1_000, clientUpdatedAt: 1_000, status: 'pending' }),
        buildMutation({ id: 'failed-new', createdAt: 2_000, clientUpdatedAt: 2_000, status: 'failed' }),
        buildMutation({ id: 'blocked', createdAt: 3_000, clientUpdatedAt: 3_000, status: 'blocked' }),
      ],
      'user:user-1',
      5_000
    );

    expect(metrics.userScope).toBe('user:user-1');
    expect(metrics.pendingCount).toBe(1);
    expect(metrics.failedCount).toBe(1);
    expect(metrics.blockedCount).toBe(1);
    expect(metrics.oldestPendingMutationId).toBe('pending-old');
    expect(metrics.oldestPendingAgeMs).toBe(4_000);
  });

  it('alerts when the oldest pending mutation exceeds the age threshold', () => {
    const { reportSyncQueueMetrics, SYNC_PENDING_AGE_ALERT_MS } = require('@/lib/syncObservability');

    reportSyncQueueMetrics({
      mutations: [
        buildMutation({
          id: 'stale',
          createdAt: 1_000,
          clientUpdatedAt: 1_000,
          status: 'pending',
        }),
      ],
      now: 1_000 + SYNC_PENDING_AGE_ALERT_MS + 1,
      reason: 'test_pending_age',
      userScope: 'user:user-1',
    });

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('pending mutation age threshold exceeded'),
      expect.objectContaining({
        reason: 'test_pending_age',
      })
    );
  });

  it('alerts when aggregate replay success rate drops below threshold', () => {
    const { recordSyncReplayMetrics, resetSyncObservabilityState } = require('@/lib/syncObservability');
    resetSyncObservabilityState();

    recordSyncReplayMetrics({
      attemptedCount: 2,
      ackCount: 1,
      failedCount: 1,
      conflictCount: 0,
      durationMs: 42,
      pendingMutationsAfter: [buildMutation({ status: 'failed' })],
      reason: 'test_replay_failure_rate',
      userScope: 'user:user-1',
      now: 10_000,
    });

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('replay success rate below threshold'),
      expect.objectContaining({
        reason: 'test_replay_failure_rate',
        threshold: 0.99,
      })
    );
  });

  it('alerts when a queue is cleared while mutations still exist', () => {
    const { reportSyncQueueClearedWithPending } = require('@/lib/syncObservability');

    reportSyncQueueClearedWithPending({
      mutations: [buildMutation({ id: 'pending-clear' })],
      reason: 'test_clear',
      userScope: 'user:user-1',
      now: 5_000,
    });

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('queue cleared while pending mutations existed'),
      expect.objectContaining({
        reason: 'test_clear',
      })
    );
  });
});
