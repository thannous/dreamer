import {
  activateExclusiveLucidProgram,
  applyLucidSyncEntity,
  createInitialLucidTrainerState,
  createLucidProgramProgress,
  enforceLucidSingleActiveProgram,
  mergeLucidProgramProgress,
  mergeLucidTrainerStates,
  removeLucidSyncEntity,
  resolveLucidEntityConflict,
} from '@/lib/lucid/domain';
import type { LucidExperiment, LucidSyncEntity } from '@/lib/lucid/model';

describe('Lucid Trainer domain', () => {
  const NOW = 1_700_000_000_000;

  it('merges program progress without losing exercises or practice dates', () => {
    const left = {
      ...createLucidProgramProgress('mild', NOW),
      status: 'active' as const,
      currentDay: 3,
      completedExerciseIds: ['mild-1'],
      practiceDates: ['2026-08-10'],
      startedAt: NOW,
      updatedAt: NOW + 10,
    };
    const right = {
      ...createLucidProgramProgress('mild', NOW),
      status: 'completed' as const,
      currentDay: 7,
      completedExerciseIds: ['mild-2', 'mild-1'],
      practiceDates: ['2026-08-11'],
      startedAt: NOW + 5,
      completedAt: NOW + 20,
      updatedAt: NOW + 20,
    };

    const merged = mergeLucidProgramProgress(left, right);
    expect(merged).toMatchObject({
      status: 'completed',
      currentDay: 7,
      completedExerciseIds: ['mild-1', 'mild-2'],
      practiceDates: ['2026-08-10', '2026-08-11'],
      startedAt: NOW,
      completedAt: NOW + 20,
    });
    expect(mergeLucidProgramProgress(right, left)).toEqual(merged);
  });

  it('allows a newer active state to resume an older paused program', () => {
    const paused = {
      ...createLucidProgramProgress('ssild', NOW),
      status: 'paused' as const,
      updatedAt: NOW + 10,
    };
    const resumed = {
      ...paused,
      status: 'active' as const,
      updatedAt: NOW + 20,
    };

    expect(mergeLucidProgramProgress(paused, resumed).status).toBe('active');
    expect(mergeLucidProgramProgress(resumed, paused).status).toBe('active');
  });

  it('uses a stable tie break for conflicting immutable records', () => {
    const experiment = (id: string, notes: string): LucidExperiment => ({
      id,
      occurredAt: NOW,
      technique: 'ssild',
      preparationMinutes: 15,
      result: 'pre_lucid',
      lucidityLevel: 2,
      recallLevel: 4,
      sleepQuality: 3,
      factors: ['stress'],
      notes,
      updatedAt: NOW,
    });
    const left: LucidSyncEntity = {
      entityType: 'experiment',
      entityKey: 'exp-1',
      value: experiment('exp-1', 'alpha'),
    };
    const right: LucidSyncEntity = {
      entityType: 'experiment',
      entityKey: 'exp-1',
      value: experiment('exp-1', 'omega'),
    };

    expect(resolveLucidEntityConflict(left, right)).toEqual(
      resolveLucidEntityConflict(right, left)
    );
  });

  it('merges complete states and applies deterministic deletions', () => {
    const left = createInitialLucidTrainerState({ now: NOW, timeZone: 'UTC' });
    const right = createInitialLucidTrainerState({ now: NOW + 10, timeZone: 'UTC' });
    left.progress = [
      {
        ...createLucidProgramProgress('wbtb', NOW),
        status: 'active',
        completedExerciseIds: ['wbtb-1'],
      },
    ];
    right.progress = [
      {
        ...createLucidProgramProgress('wbtb', NOW + 10),
        currentDay: 2,
        completedExerciseIds: ['wbtb-2'],
      },
    ];

    const merged = mergeLucidTrainerStates(left, right);
    expect(merged.progress[0]).toMatchObject({
      currentDay: 2,
      completedExerciseIds: ['wbtb-1', 'wbtb-2'],
    });

    const withCheck = applyLucidSyncEntity(merged, {
      entityType: 'reality_check',
      entityKey: 'check-1',
      value: {
        id: 'check-1',
        occurredAt: NOW + 20,
        context: 'scheduled',
        method: 'nose_breathing',
        outcome: 'awake',
        mindful: true,
        updatedAt: NOW + 20,
      },
    });
    expect(withCheck.realityChecks).toHaveLength(1);
    expect(
      removeLucidSyncEntity(withCheck, 'reality_check', 'check-1', NOW + 30)
        .realityChecks
    ).toHaveLength(0);
  });

  it('pauses extra active programs without losing their sequential progress', () => {
    const mild = {
      ...createLucidProgramProgress('mild', NOW),
      status: 'active' as const,
      currentDay: 4,
      completedExerciseIds: ['mild-01', 'mild-02', 'mild-03'],
      practiceDates: ['2026-08-10'],
      startedAt: NOW,
      updatedAt: NOW + 10,
    };
    const ssild = {
      ...createLucidProgramProgress('ssild', NOW),
      status: 'active' as const,
      currentDay: 2,
      completedExerciseIds: ['ssild-01'],
      practiceDates: ['2026-08-11'],
      startedAt: NOW + 5,
      updatedAt: NOW + 20,
    };

    const normalized = enforceLucidSingleActiveProgram([mild, ssild], 'mild');
    expect(normalized.map((item) => [item.technique, item.status])).toEqual([
      ['mild', 'active'],
      ['ssild', 'paused'],
    ]);
    expect(normalized.find((item) => item.technique === 'ssild')).toMatchObject({
      currentDay: 2,
      completedExerciseIds: ['ssild-01'],
      practiceDates: ['2026-08-11'],
    });
  });

  it('keeps a deterministic winner when two active programs arrive through merge or apply', () => {
    const left = createInitialLucidTrainerState({ now: NOW, timeZone: 'UTC' });
    const right = createInitialLucidTrainerState({ now: NOW + 10, timeZone: 'UTC' });
    left.progress = [
      {
        ...createLucidProgramProgress('mild', NOW),
        status: 'active',
        currentDay: 3,
        completedExerciseIds: ['mild-01'],
        updatedAt: NOW + 30,
      },
    ];
    right.progress = [
      {
        ...createLucidProgramProgress('wbtb', NOW + 10),
        status: 'active',
        currentDay: 2,
        completedExerciseIds: ['wbtb-01'],
        updatedAt: NOW + 40,
      },
    ];

    const merged = mergeLucidTrainerStates(left, right);
    expect(merged.progress.filter((item) => item.status === 'active')).toHaveLength(1);
    expect(merged.progress.find((item) => item.status === 'active')?.technique).toBe('wbtb');
    expect(merged.progress.find((item) => item.technique === 'mild')).toMatchObject({
      status: 'paused',
      currentDay: 3,
      completedExerciseIds: ['mild-01'],
    });

    const applied = applyLucidSyncEntity(merged, {
      entityType: 'progress',
      entityKey: 'mild',
      value: {
        ...merged.progress.find((item) => item.technique === 'mild')!,
        status: 'active',
        updatedAt: NOW + 50,
      },
    });
    expect(applied.progress.filter((item) => item.status === 'active').map((item) => item.technique)).toEqual([
      'mild',
    ]);
    expect(applied.progress.find((item) => item.technique === 'wbtb')?.status).toBe('paused');
  });

  it('does not let a stale remote active displace a newer local active program', () => {
    const state = createInitialLucidTrainerState({ now: NOW, timeZone: 'UTC' });
    state.progress = [
      {
        ...createLucidProgramProgress('ssild', NOW),
        status: 'active',
        currentDay: 3,
        completedExerciseIds: ['ssild-01'],
        startedAt: NOW + 40,
        updatedAt: NOW + 40,
      },
      {
        ...createLucidProgramProgress('mild', NOW),
        status: 'paused',
        currentDay: 2,
        completedExerciseIds: ['mild-01'],
        startedAt: NOW,
        updatedAt: NOW + 10,
      },
    ];

    const applied = applyLucidSyncEntity(state, {
      entityType: 'progress',
      entityKey: 'mild',
      value: {
        ...state.progress.find((item) => item.technique === 'mild')!,
        status: 'active',
        updatedAt: NOW + 10,
      },
    });

    expect(applied.progress.filter((item) => item.status === 'active').map((item) => item.technique)).toEqual([
      'ssild',
    ]);
    expect(applied.progress.find((item) => item.technique === 'mild')).toMatchObject({
      status: 'paused',
      currentDay: 2,
      completedExerciseIds: ['mild-01'],
    });
  });

  it('converges on the same active program regardless of remote apply order', () => {
    const initial = createInitialLucidTrainerState({ now: NOW, timeZone: 'UTC' });
    const entities = [
      {
        entityType: 'progress' as const,
        entityKey: 'mild',
        value: {
          ...createLucidProgramProgress('mild', NOW),
          status: 'active' as const,
          updatedAt: NOW + 30,
        },
      },
      {
        entityType: 'progress' as const,
        entityKey: 'wbtb',
        value: {
          ...createLucidProgramProgress('wbtb', NOW),
          status: 'active' as const,
          updatedAt: NOW + 40,
        },
      },
    ];
    const forward = entities.reduce(applyLucidSyncEntity, initial);
    const reverse = [...entities].reverse().reduce(applyLucidSyncEntity, initial);

    expect(forward.progress).toEqual(reverse.progress);
    expect(forward.progress.filter((item) => item.status === 'active').map((item) => item.technique)).toEqual([
      'wbtb',
    ]);
  });

  it('queues paused programs when a new technique is started exclusively', () => {
    const state = createInitialLucidTrainerState({ now: NOW, timeZone: 'UTC' });
    state.progress = [
      {
        ...createLucidProgramProgress('mild', NOW),
        status: 'active',
        currentDay: 3,
        completedExerciseIds: ['mild-01'],
        startedAt: NOW,
        updatedAt: NOW + 100,
      },
    ];

    const { next, changed } = activateExclusiveLucidProgram(state, 'ssild', NOW + 5);
    expect(next.progress.filter((item) => item.status === 'active').map((item) => item.technique)).toEqual([
      'ssild',
    ]);
    expect(changed.map((item) => [item.technique, item.status])).toEqual([
      ['mild', 'paused'],
      ['ssild', 'active'],
    ]);
    expect(next.progress.find((item) => item.technique === 'mild')).toMatchObject({
      currentDay: 3,
      completedExerciseIds: ['mild-01'],
    });
    expect(next.progress.find((item) => item.technique === 'ssild')!.updatedAt).toBeGreaterThan(
      NOW + 100
    );

    const replayedInReverse = [...changed]
      .reverse()
      .map((value) => ({ entityType: 'progress' as const, entityKey: value.technique, value }))
      .reduce(applyLucidSyncEntity, state);
    expect(replayedInReverse.progress).toEqual(next.progress);
  });

  it('gives concurrent exclusive activations a deterministic batch winner', () => {
    const state = createInitialLucidTrainerState({ now: NOW, timeZone: 'UTC' });
    const mildBaseline = {
      ...createLucidProgramProgress('mild', NOW),
      status: 'active' as const,
      currentDay: 4,
      completedExerciseIds: ['mild-01', 'mild-02'],
      practiceDates: ['2026-08-10'],
      startedAt: NOW - 20,
      updatedAt: NOW,
    };
    const ssildBaseline = {
      ...createLucidProgramProgress('ssild', NOW),
      status: 'paused' as const,
      currentDay: 2,
      completedExerciseIds: ['ssild-01'],
      practiceDates: ['2026-08-11'],
      startedAt: NOW - 10,
      updatedAt: NOW,
    };
    state.progress = [mildBaseline, ssildBaseline];
    const baseline = Math.max(state.updatedAt, ...state.progress.map((item) => item.updatedAt));

    const deviceA = activateExclusiveLucidProgram(state, 'mild', NOW);
    const deviceB = activateExclusiveLucidProgram(state, 'ssild', NOW);

    const mildTimestamp = deviceA.next.progress.find((item) => item.technique === 'mild')!.updatedAt;
    const ssildTimestamp = deviceB.next.progress.find((item) => item.technique === 'ssild')!
      .updatedAt;

    expect(mildTimestamp).toBeGreaterThan(baseline);
    expect(ssildTimestamp).toBeGreaterThan(baseline);
    expect(mildTimestamp).not.toBe(ssildTimestamp);
    expect(new Set(deviceA.changed.map((item) => item.updatedAt))).toEqual(new Set([mildTimestamp]));
    expect(new Set(deviceB.changed.map((item) => item.updatedAt))).toEqual(new Set([ssildTimestamp]));

    const identicalStamp = baseline + 1;
    const staleA = {
      ...deviceA.next,
      progress: deviceA.next.progress.map((item) => ({ ...item, updatedAt: identicalStamp })),
      updatedAt: identicalStamp,
    };
    const staleB = {
      ...deviceB.next,
      progress: deviceB.next.progress.map((item) => ({ ...item, updatedAt: identicalStamp })),
      updatedAt: identicalStamp,
    };
    const staleMerged = mergeLucidTrainerStates(staleA, staleB);
    expect(staleA.progress.find((item) => item.technique === 'mild')?.status).toBe('active');
    expect(staleA.progress.find((item) => item.technique === 'ssild')?.status).toBe('paused');
    expect(staleB.progress.find((item) => item.technique === 'mild')?.status).toBe('paused');
    expect(staleB.progress.find((item) => item.technique === 'ssild')?.status).toBe('active');
    expect(
      staleMerged.progress.filter((item) => item.status === 'active').map((item) => item.technique)
    ).toEqual([]);

    const merged = mergeLucidTrainerStates(deviceA.next, deviceB.next);
    const reversed = mergeLucidTrainerStates(deviceB.next, deviceA.next);
    expect(merged).toEqual(reversed);
    expect(
      merged.progress.filter((item) => item.status === 'active').map((item) => item.technique)
    ).toEqual(['ssild']);
    expect(merged.progress.find((item) => item.technique === 'mild')).toMatchObject({
      status: 'paused',
      currentDay: 4,
      completedExerciseIds: ['mild-01', 'mild-02'],
      practiceDates: ['2026-08-10'],
    });
    expect(merged.progress.find((item) => item.technique === 'ssild')).toMatchObject({
      status: 'active',
      currentDay: 2,
      completedExerciseIds: ['ssild-01'],
      practiceDates: ['2026-08-11'],
    });
  });
});
