import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockStorageHarness = ((factory: () => {
  snapshots: Map<string, string>;
  claimedBy: { value: string | null };
  legacyCompleted: { value: boolean };
  failClaimWrite: { value: boolean };
  failSnapshotScopes: Set<string>;
  operations: string[];
}) => factory())(() => ({
  snapshots: new Map<string, string>(),
  claimedBy: { value: null },
  legacyCompleted: { value: false },
  failClaimWrite: { value: false },
  failSnapshotScopes: new Set<string>(),
  operations: [],
}));

jest.mock('@/services/storageService', () => ({
  getFirstLaunchCompleted: jest.fn(async () => mockStorageHarness.legacyCompleted.value),
  getOnboardingStateSnapshot: jest.fn(async (scope: string) =>
    mockStorageHarness.snapshots.get(scope) ?? null
  ),
  saveOnboardingStateSnapshot: jest.fn(async (scope: string, value: string) => {
    mockStorageHarness.operations.push(`snapshot:${scope}`);
    if (mockStorageHarness.failSnapshotScopes.has(scope)) {
      throw new Error('snapshot write failed');
    }
    mockStorageHarness.snapshots.set(scope, value);
  }),
  getOnboardingGuestClaimedBy: jest.fn(async () => mockStorageHarness.claimedBy.value),
  saveOnboardingGuestClaimedBy: jest.fn(async (userId: string) => {
    mockStorageHarness.operations.push(`claim:${userId}`);
    if (mockStorageHarness.failClaimWrite.value) {
      throw new Error('claim write failed');
    }
    mockStorageHarness.claimedBy.value = userId;
  }),
}));

import {
  ONBOARDING_INTENT_TTL_MS,
  claimGuestOnboardingState,
  getDefaultOnboardingState,
  getOnboardingState,
  isStartupDestinationObserved,
  parseRecordingRouteParams,
  reduceOnboardingState,
  resolveRecordingEntryIntent,
  resolvePendingAnalysisRestart,
  resolveStartupDestination,
  resolveStartupDecision,
} from '@/lib/onboardingState';

describe('onboardingState', () => {
  beforeEach(() => {
    mockStorageHarness.snapshots.clear();
    mockStorageHarness.claimedBy.value = null;
    mockStorageHarness.legacyCompleted.value = false;
    mockStorageHarness.failClaimWrite.value = false;
    mockStorageHarness.failSnapshotScopes.clear();
    mockStorageHarness.operations.length = 0;
    jest.clearAllMocks();
  });

  it('creates a resumable 24-hour recording intent when a path completes', () => {
    const started = reduceOnboardingState(getDefaultOnboardingState(100), { type: 'START' }, 200);
    const selected = reduceOnboardingState(
      started,
      { type: 'SELECT_PATH', path: 'memory' },
      300
    );
    const completed = reduceOnboardingState(selected, { type: 'COMPLETE' }, 400);

    expect(completed).toMatchObject({
      status: 'completed',
      selectedPath: 'memory',
      completionReason: 'memory',
      pendingRecordingIntent: {
        intent: 'remembered',
        source: 'onboarding',
        postSave: 'journal_first',
        phase: 'capture',
        createdAt: 400,
        expiresAt: 400 + ONBOARDING_INTENT_TTL_MS,
      },
    });
  });

  it('resumes a persisted capture from a naked recording route and restores post-save', () => {
    const pending = {
      entryId: 'memory-entry',
      intent: 'remembered' as const,
      source: 'onboarding' as const,
      postSave: 'journal_first' as const,
      phase: 'capture' as const,
      createdAt: 100,
      expiresAt: 100 + ONBOARDING_INTENT_TTL_MS,
    };

    expect(
      resolveRecordingEntryIntent(parseRecordingRouteParams({}), pending)
    ).toEqual({
      entryId: 'memory-entry',
      intent: 'remembered',
      source: 'onboarding',
      postSave: 'journal_first',
      mode: null,
      origin: 'pending',
    });
  });

  it('uses a valid explicit route intent before a persisted capture', () => {
    const pending = {
      entryId: 'pending-memory',
      intent: 'remembered' as const,
      source: 'onboarding' as const,
      postSave: 'journal_first' as const,
      phase: 'capture' as const,
      createdAt: 100,
      expiresAt: 100 + ONBOARDING_INTENT_TTL_MS,
    };
    const route = parseRecordingRouteParams({
      entryId: 'profile-fresh',
      intent: 'fresh',
      source: 'profile',
      postSave: 'analyze',
    });

    expect(resolveRecordingEntryIntent(route, pending)).toEqual({
      entryId: 'profile-fresh',
      intent: 'fresh',
      source: 'profile',
      postSave: 'confirm_analysis',
      mode: null,
      origin: 'route',
    });
  });

  it('ignores a bare entry id, resumes the pending entry, and keeps explicit mode priority', () => {
    const pending = {
      entryId: 'pending-analysis',
      intent: 'fresh' as const,
      source: 'onboarding' as const,
      postSave: 'confirm_analysis' as const,
      phase: 'capture' as const,
      createdAt: 100,
      expiresAt: 100 + ONBOARDING_INTENT_TTL_MS,
    };
    const route = parseRecordingRouteParams({ entryId: 'orphan', mode: 'voice' });

    expect(resolveRecordingEntryIntent(route, pending)).toMatchObject({
      entryId: 'pending-analysis',
      postSave: 'confirm_analysis',
      mode: 'voice',
      origin: 'pending',
    });
  });

  it('does not restore a post-save phase as a new capture', () => {
    const pending = {
      entryId: 'saved-analysis',
      intent: 'fresh' as const,
      source: 'onboarding' as const,
      postSave: 'confirm_analysis' as const,
      phase: 'analysis_confirmation' as const,
      savedDreamId: 42,
      createdAt: 100,
      expiresAt: 100 + ONBOARDING_INTENT_TTL_MS,
    };

    expect(resolveRecordingEntryIntent(parseRecordingRouteParams({}), pending)).toBeNull();
  });

  it('updates and clears the pending intent without changing completion', () => {
    const completed = reduceOnboardingState(
      { ...getDefaultOnboardingState(0), selectedPath: 'analyze' },
      { type: 'COMPLETE' },
      100
    );
    const confirmation = reduceOnboardingState(
      completed,
      { type: 'SET_PENDING_PHASE', phase: 'analysis_confirmation', savedDreamId: 42 },
      200
    );
    const cleared = reduceOnboardingState(confirmation, { type: 'CLEAR_PENDING_INTENT' }, 300);

    expect(confirmation.pendingRecordingIntent).toMatchObject({
      phase: 'analysis_confirmation',
      savedDreamId: 42,
    });
    expect(cleared.pendingRecordingIntent).toBeNull();
    expect(cleared.status).toBe('completed');
  });

  it('can persist an analysis request directly after a failed confirmation write', () => {
    const completed = reduceOnboardingState(
      { ...getDefaultOnboardingState(0), selectedPath: 'analyze' },
      { type: 'COMPLETE' },
      100
    );

    const requested = reduceOnboardingState(
      completed,
      { type: 'SET_PENDING_PHASE', phase: 'analysis_requested', savedDreamId: 42 },
      200
    );

    expect(requested.pendingRecordingIntent).toMatchObject({
      phase: 'analysis_requested',
      savedDreamId: 42,
    });
  });

  it('migrates the legacy completed flag to a terminal guest state', async () => {
    mockStorageHarness.legacyCompleted.value = true;

    const state = await getOnboardingState('guest');

    expect(state.status).toBe('skipped');
    expect(state.completionReason).toBe('skip');
    expect(JSON.parse(mockStorageHarness.snapshots.get('guest') ?? '{}')).toMatchObject({
      schemaVersion: 1,
      experienceVersion: 2,
      status: 'skipped',
    });
  });

  it('normalizes old library values', async () => {
    mockStorageHarness.snapshots.set(
      'guest',
      JSON.stringify({
        ...getDefaultOnboardingState(1),
        status: 'completed',
        selectedPath: 'library',
        completionReason: 'library',
        completedAt: 2,
        pendingRecordingIntent: null,
      })
    );

    const state = await getOnboardingState('guest');

    expect(state.selectedPath).toBe('dictionary');
    expect(state.completionReason).toBe('dictionary');
    expect(state.pendingRecordingIntent).toBeNull();
  });

  it('expires a stale pending intent without reopening completed onboarding', async () => {
    mockStorageHarness.snapshots.set(
      'guest',
      JSON.stringify({
        ...getDefaultOnboardingState(1),
        status: 'completed',
        selectedPath: 'analyze',
        completionReason: 'analyze',
        completedAt: 2,
        pendingRecordingIntent: {
          entryId: 'expired',
          intent: 'fresh',
          source: 'onboarding',
          postSave: 'confirm_analysis',
          phase: 'capture',
          createdAt: 1,
          expiresAt: 2,
        },
      })
    );

    const state = await getOnboardingState('guest');
    expect(state.status).toBe('completed');
    expect(state.pendingRecordingIntent).toBeNull();
  });

  it('resets the full document when the schema or status is unknown', async () => {
    mockStorageHarness.snapshots.set(
      'guest',
      JSON.stringify({
        ...getDefaultOnboardingState(1),
        schemaVersion: 99,
        status: 'completed',
        selectedPath: 'memory',
        completionReason: 'memory',
        completedAt: 2,
        pendingRecordingIntent: {
          entryId: 'must-not-survive',
          intent: 'remembered',
          source: 'onboarding',
          postSave: 'journal_first',
          phase: 'capture',
          createdAt: Date.now(),
          expiresAt: Date.now() + ONBOARDING_INTENT_TTL_MS,
        },
      })
    );

    const unsupportedSchema = await getOnboardingState('guest');
    expect(unsupportedSchema).toMatchObject({
      schemaVersion: 1,
      experienceVersion: 2,
      status: 'not_started',
      selectedPath: null,
      completionReason: null,
      pendingRecordingIntent: null,
    });

    mockStorageHarness.snapshots.set(
      'user:broken',
      JSON.stringify({ ...getDefaultOnboardingState(1), status: 'unknown', selectedPath: 'analyze' })
    );
    const invalidStatus = await getOnboardingState('user:broken');
    expect(invalidStatus.status).toBe('not_started');
    expect(invalidStatus.selectedPath).toBeNull();
  });

  it('lets only the first authenticated user claim guest onboarding', async () => {
    mockStorageHarness.snapshots.set(
      'guest',
      JSON.stringify({
        ...getDefaultOnboardingState(1),
        status: 'skipped',
        completionReason: 'skip',
        completedAt: 2,
      })
    );

    await claimGuestOnboardingState('first');
    await claimGuestOnboardingState('second');

    expect(mockStorageHarness.claimedBy.value).toBe('first');
    expect(mockStorageHarness.operations.slice(0, 2)).toEqual([
      'claim:first',
      'snapshot:user:first',
    ]);
    expect(mockStorageHarness.snapshots.get('user:first')).toBe(
      mockStorageHarness.snapshots.get('guest')
    );
    expect(mockStorageHarness.snapshots.has('user:second')).toBe(false);
    expect((await getOnboardingState('user:second')).status).toBe('not_started');
  });

  it('reserves guest ownership before copying and lets only that user resume a failed copy', async () => {
    mockStorageHarness.snapshots.set(
      'guest',
      JSON.stringify({
        ...getDefaultOnboardingState(1),
        status: 'skipped',
        completionReason: 'skip',
        completedAt: 2,
      })
    );
    mockStorageHarness.failSnapshotScopes.add('user:first');

    await expect(claimGuestOnboardingState('first')).rejects.toThrow('snapshot write failed');
    expect(mockStorageHarness.claimedBy.value).toBe('first');
    await claimGuestOnboardingState('second');
    expect(mockStorageHarness.snapshots.has('user:second')).toBe(false);

    mockStorageHarness.failSnapshotScopes.delete('user:first');
    await claimGuestOnboardingState('first');
    expect(mockStorageHarness.snapshots.get('user:first')).toBe(
      mockStorageHarness.snapshots.get('guest')
    );
  });

  it('does not copy guest state when ownership reservation fails', async () => {
    mockStorageHarness.failClaimWrite.value = true;
    await expect(claimGuestOnboardingState('first')).rejects.toThrow('claim write failed');
    expect(mockStorageHarness.claimedBy.value).toBeNull();
    expect(mockStorageHarness.snapshots.has('user:first')).toBe(false);
  });

  it('resets terminal and pending-intent invariant violations to not_started', async () => {
    const future = Date.now() + ONBOARDING_INTENT_TTL_MS;
    const invalidDocuments = [
      {
        ...getDefaultOnboardingState(1),
        status: 'completed',
        selectedPath: 'analyze',
        completionReason: null,
        completedAt: null,
      },
      {
        ...getDefaultOnboardingState(1),
        status: 'completed',
        selectedPath: 'dictionary',
        completionReason: 'dictionary',
        completedAt: 2,
        pendingRecordingIntent: {
          entryId: 'dictionary-cannot-record',
          intent: 'fresh',
          source: 'onboarding',
          postSave: 'confirm_analysis',
          phase: 'capture',
          createdAt: 1,
          expiresAt: future,
        },
      },
      {
        ...getDefaultOnboardingState(1),
        status: 'completed',
        selectedPath: 'analyze',
        completionReason: 'analyze',
        completedAt: 2,
        pendingRecordingIntent: {
          entryId: 'missing-dream-id',
          intent: 'fresh',
          source: 'onboarding',
          postSave: 'confirm_analysis',
          phase: 'analysis_confirmation',
          createdAt: 1,
          expiresAt: future,
        },
      },
    ];

    for (const [index, document] of invalidDocuments.entries()) {
      const scope = `user:invalid-${index}` as const;
      mockStorageHarness.snapshots.set(scope, JSON.stringify(document));
      const normalized = await getOnboardingState(scope);
      expect(normalized.status).toBe('not_started');
      expect(normalized.selectedPath).toBeNull();
      expect(normalized.pendingRecordingIntent).toBeNull();
    }
  });

  it('parses current and legacy recording parameters safely', () => {
    expect(
      parseRecordingRouteParams({
        entryId: ['entry-1', 'ignored'],
        intent: 'remembered',
        source: 'onboarding',
        next: 'analyze',
        mode: 'voice',
        replayGuide: '1',
      })
    ).toEqual({
      entryId: 'entry-1',
      intent: 'remembered',
      source: 'onboarding',
      postSave: 'confirm_analysis',
      replayGuide: true,
      mode: 'voice',
      hasExplicitIntent: true,
    });
  });

  it('lets canonical postSave win over next and ignores invalid explicit values', () => {
    expect(parseRecordingRouteParams({ postSave: 'journal', next: 'analyze' }).postSave).toBe(
      'journal_first'
    );
    expect(
      parseRecordingRouteParams({
        intent: 'invalid',
        source: 'invalid',
        postSave: 'invalid',
        next: 'invalid',
        entryId: '   ',
      }).hasExplicitIntent
    ).toBe(false);
  });

  it('applies startup priority without letting notifications bypass onboarding', () => {
    const incomplete = getDefaultOnboardingState(1);
    expect(
      resolveStartupDestination({
        returningGuestBlocked: false,
        hasUser: false,
        onboardingState: incomplete,
        pendingNotificationUrl: '/recording',
      })
    ).toBe('/onboarding');

    expect(
      resolveStartupDestination({
        returningGuestBlocked: true,
        hasUser: false,
        onboardingState: incomplete,
      })
    ).toBe('/(tabs)/settings');
  });

  it('keeps a notification queued until it actually wins startup arbitration', () => {
    const completedWithIntent = reduceOnboardingState(
      { ...getDefaultOnboardingState(1), selectedPath: 'analyze' },
      { type: 'COMPLETE' },
      Date.now()
    );
    expect(
      resolveStartupDecision({
        returningGuestBlocked: false,
        hasUser: false,
        onboardingState: completedWithIntent,
        pendingNotificationUrl: '/recording',
      }).reason
    ).toBe('pending_intent');

    expect(
      resolveStartupDecision({
        returningGuestBlocked: false,
        hasUser: false,
        onboardingState: { ...completedWithIntent, pendingRecordingIntent: null },
        pendingNotificationUrl: '/recording',
      }).reason
    ).toBe('notification');
  });

  it('acknowledges startup only after the destination pathname is observed', () => {
    const destination = {
      pathname: '/recording',
      params: { entryId: 'entry-1' },
    } as const;
    expect(isStartupDestinationObserved(destination, '/onboarding')).toBe(false);
    expect(isStartupDestinationObserved(destination, '/recording')).toBe(true);
    expect(isStartupDestinationObserved('/(tabs)/settings', '/settings')).toBe(true);
  });

  it('opens an already completed pending analysis result after restart', () => {
    const pending = {
      entryId: 'analysis-entry',
      intent: 'fresh' as const,
      source: 'onboarding' as const,
      postSave: 'confirm_analysis' as const,
      phase: 'analysis_requested' as const,
      savedDreamId: 42,
      createdAt: 100,
      expiresAt: 100 + ONBOARDING_INTENT_TTL_MS,
    };

    expect(
      resolvePendingAnalysisRestart(pending, {
        id: 42,
        analysisStatus: 'done',
        isAnalyzed: true,
      })
    ).toBe('view_result');
  });

  it.each(['none', 'pending', 'failed'] as const)(
    'surfaces an explicit retry for a %s analysis after restart',
    (analysisStatus: 'none' | 'pending' | 'failed') => {
      const pending = {
        entryId: 'analysis-entry',
        intent: 'fresh' as const,
        source: 'onboarding' as const,
        postSave: 'confirm_analysis' as const,
        phase: 'analysis_requested' as const,
        savedDreamId: 42,
        createdAt: 100,
        expiresAt: 100 + ONBOARDING_INTENT_TTL_MS,
      };

      expect(
        resolvePendingAnalysisRestart(pending, {
          id: 42,
          analysisStatus,
          isAnalyzed: false,
        })
      ).toBe('offer_retry');
    }
  );
});
