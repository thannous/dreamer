import {
  adaptLucidExperimentForProgress,
  buildLucidWeeklyReview,
  compareLucidMethods,
  getDeterministicLucidCoaching,
  getLucidProgressTrend,
  summarizeLucidProgress,
} from '@/lib/lucid/progress';
import type { LucidExperiment } from '@/lib/lucid/model';

const DAY = 24 * 60 * 60 * 1000;

function record(
  overrides: Partial<LucidExperiment> & Pick<LucidExperiment, 'id' | 'occurredAt'>
): LucidExperiment {
  return {
    technique: 'mild',
    preparationMinutes: 10,
    result: 'none',
    lucidityLevel: 1,
    recallLevel: 3,
    sleepQuality: 3,
    factors: [],
    updatedAt: overrides.occurredAt,
    ...overrides,
  };
}

describe('lucid progress', () => {
  it('summarizes attempts, outcomes, scores, factors, and absolute boundaries', () => {
    const summary = summarizeLucidProgress(
      [
        record({
          id: 'lucid',
          occurredAt: DAY,
          result: 'lucid',
          lucidityLevel: 4,
          recallLevel: 5,
          sleepQuality: 4,
          factors: ['stress'],
        }),
        record({
          id: 'remembered',
          occurredAt: 2 * DAY,
          preparationMinutes: 3,
          lucidityLevel: 0,
          recallLevel: 3,
          sleepQuality: 2,
          factors: ['exercise'],
        }),
        record({
          id: 'none',
          occurredAt: 3 * DAY,
          technique: 'ssild',
          preparationMinutes: 0,
          result: 'none',
          lucidityLevel: 0,
          recallLevel: 0,
          sleepQuality: 1,
          factors: ['sleep_debt'],
        }),
        record({ id: 'end-boundary', occurredAt: 5 * DAY }),
      ],
      { startAt: DAY, endAt: 5 * DAY }
    );

    expect(summary).toEqual({
      records: 3,
      attempts: 3,
      lucidDreams: 1,
      recalledDreams: 2,
      preparedAttempts: 2,
      successRate: 0.333,
      recallRate: 0.667,
      preparationRate: 0.667,
      averageLucidity: 1.333,
      averageRecall: 2.667,
      averageSleepQuality: 2.333,
      factors: [
        { factor: 'exercise', count: 1 },
        { factor: 'low_sleep', count: 1 },
        { factor: 'stress', count: 1 },
      ],
    });
  });

  it('compares methods only after enough attempts and breaks ties deterministically', () => {
    const records = [
      ...[1, 2, 3].map((day) =>
        record({
          id: `mild-${day}`,
          occurredAt: day * DAY,
          result: day < 3 ? 'lucid' : 'none',
        })
      ),
      ...[4, 5, 6].map((day) =>
        record({
          id: `ssild-${day}`,
          occurredAt: day * DAY,
          technique: 'ssild',
          result: 'none',
        })
      ),
    ];

    const comparison = compareLucidMethods(records);
    expect(comparison.leader).toBe('mild');
    expect(comparison.evidence).toBe('early');
    expect(
      comparison.methods.map(({ technique, averageSleepQuality }) => ({
        technique,
        averageSleepQuality,
      }))
    ).toEqual([
      { technique: 'mild', averageSleepQuality: 3 },
      { technique: 'ssild', averageSleepQuality: 3 },
      { technique: 'wbtb', averageSleepQuality: null },
    ]);
    expect(comparison.methods.map(({ technique, attempts }) => ({ technique, attempts }))).toEqual([
      { technique: 'mild', attempts: 3 },
      { technique: 'ssild', attempts: 3 },
      { technique: 'wbtb', attempts: 0 },
    ]);

    const exactTie = compareLucidMethods(
      ['mild', 'ssild'].flatMap((technique, techniqueIndex) =>
        [1, 2, 3].map((attempt) =>
          record({
            id: `${technique}-${attempt}`,
            occurredAt: (techniqueIndex * 3 + attempt) * DAY,
            technique: technique as 'mild' | 'ssild',
          })
        )
      )
    );
    expect(exactTie.leader).toBe('mild');
  });

  it('builds an offline weekly review from explicit absolute windows', () => {
    const currentWindow = { startAt: 7 * DAY, endAt: 14 * DAY };
    const records = [
      record({ id: 'previous-1', occurredAt: DAY }),
      record({
        id: 'previous-2',
        occurredAt: 2 * DAY,
        recallLevel: 0,
        lucidityLevel: 0,
      }),
      record({
        id: 'current-1',
        occurredAt: 8 * DAY,
        result: 'lucid',
        sleepQuality: 5,
      }),
      record({
        id: 'current-2',
        occurredAt: 9 * DAY,
        result: 'lucid',
        sleepQuality: 3,
      }),
      record({ id: 'excluded-end', occurredAt: 14 * DAY, result: 'lucid' }),
    ];

    const first = buildLucidWeeklyReview(records, currentWindow);
    const second = buildLucidWeeklyReview(records, currentWindow);

    expect(first).toEqual(second);
    expect(first.previousWindow).toEqual({ startAt: 0, endAt: 7 * DAY });
    expect(first.current.attempts).toBe(2);
    expect(first.previous.attempts).toBe(2);
    expect(first.current.averageSleepQuality).toBe(4);
    expect(first.previous.averageSleepQuality).toBe(3);
    expect(first.trend).toEqual({
      direction: 'improving',
      successRateDelta: 1,
      recallRateDelta: 0.5,
    });
    expect(first.coaching.action).toBe('keep_routine');
  });

  it('prioritizes sleep protection in deterministic coaching', () => {
    const riskyRecords = [
      record({ id: 'one', occurredAt: DAY, factors: ['sleep_debt'] }),
      record({ id: 'two', occurredAt: 2 * DAY, factors: ['unusual_schedule'] }),
      record({ id: 'three', occurredAt: 3 * DAY }),
    ];
    const current = summarizeLucidProgress(riskyRecords);
    const previous = summarizeLucidProgress([]);
    const trend = getLucidProgressTrend(current, previous);
    const comparison = compareLucidMethods(riskyRecords);

    expect(
      getDeterministicLucidCoaching(
        riskyRecords,
        current,
        trend,
        comparison
      )
    ).toMatchObject({ action: 'protect_sleep', technique: null });
  });

  it('adapts the canonical persisted experiment without carrying notes', () => {
    const experiment = record({
      id: 'canonical',
      occurredAt: DAY,
      result: 'pre_lucid',
      preparationMinutes: 4,
      lucidityLevel: 2,
      recallLevel: 4,
      sleepQuality: 2,
      factors: ['sleep_debt', 'unusual_schedule', 'stress'],
      notes: 'private dream content',
    });

    expect(adaptLucidExperimentForProgress(experiment)).toEqual({
      id: 'canonical',
      occurredAt: DAY,
      technique: 'mild',
      preparationMinutes: 4,
      outcome: 'remembered',
      lucidity: 2,
      recall: 4,
      sleepQuality: 2,
      factors: ['low_sleep', 'interrupted_sleep', 'stress'],
    });
    expect(adaptLucidExperimentForProgress(experiment)).not.toHaveProperty('notes');
  });

  it('rejects invalid or overlapping review windows', () => {
    expect(() =>
      buildLucidWeeklyReview([], { startAt: DAY, endAt: DAY })
    ).toThrow(RangeError);
    expect(() =>
      buildLucidWeeklyReview(
        [],
        { startAt: 7 * DAY, endAt: 14 * DAY },
        { startAt: DAY, endAt: 8 * DAY }
      )
    ).toThrow(/overlap/i);
  });
});
