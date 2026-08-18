import {
  applyLucidSyncEntity,
  createInitialLucidTrainerState,
  createLucidProgramProgress,
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
});
