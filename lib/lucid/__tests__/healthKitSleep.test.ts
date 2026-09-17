import {
  normalizeLucidHkSleepCategoryValue,
  normalizeLucidHkSleepSamples,
} from '@/lib/lucid/healthKitSleep';

const start = Date.UTC(2026, 7, 27, 22, 0, 0);
const hour = 60 * 60 * 1000;

describe('Lucid HealthKit sleep normalization', () => {
  it('maps HKCategoryValueSleepAnalysis 0..5 without inventing REM', () => {
    expect(normalizeLucidHkSleepCategoryValue(0)).toBe('inBed');
    expect(normalizeLucidHkSleepCategoryValue(1)).toBe('asleepUnspecified');
    expect(normalizeLucidHkSleepCategoryValue(2)).toBe('awake');
    expect(normalizeLucidHkSleepCategoryValue(3)).toBe('asleepCore');
    expect(normalizeLucidHkSleepCategoryValue(4)).toBe('asleepDeep');
    expect(normalizeLucidHkSleepCategoryValue(5)).toBe('asleepREM');
    expect(normalizeLucidHkSleepCategoryValue(6)).toBeNull();
    expect(normalizeLucidHkSleepCategoryValue(-1)).toBeNull();
  });

  it('keeps source, interval and category, and rejects malformed or non-positive samples', () => {
    const result = normalizeLucidHkSleepSamples([
      {
        uuid: 'ok',
        startDate: new Date(start),
        endDate: new Date(start + hour),
        value: 5,
        sourceRevision: { source: { name: 'Apple Watch', bundleIdentifier: 'com.apple.NanoSleep' } },
      },
      { uuid: 'bad-value', startDate: new Date(start), endDate: new Date(start + hour), value: 9 },
      { uuid: 'zero', startDate: new Date(start), endDate: new Date(start), value: 1 },
      { uuid: 'missing', value: 1 },
    ]);

    expect(result.samples).toEqual([
      {
        id: 'ok',
        startMs: start,
        endMs: start + hour,
        categoryValue: 5,
        category: 'asleepREM',
        sourceName: 'Apple Watch',
        sourceBundleId: 'com.apple.NanoSleep',
      },
    ]);
    expect(result.rejected.map((issue) => issue.kind).sort()).toEqual([
      'malformed',
      'malformed',
      'non_positive_interval',
    ]);
    expect(result.granularity).toBe('detailed');
  });

  it('surfaces overlaps, contradictions, coarse samples and absent data without resolving them', () => {
    const overlapping = normalizeLucidHkSleepSamples([
      {
        uuid: 'asleep',
        startDate: start,
        endDate: start + 2 * hour,
        value: 5,
        sourceRevision: { source: { name: 'Watch', bundleIdentifier: 'com.apple.NanoSleep' } },
      },
      {
        uuid: 'awake',
        startDate: start + hour,
        endDate: start + 3 * hour,
        value: 2,
        sourceRevision: { source: { name: 'iPhone', bundleIdentifier: 'com.apple.Health' } },
      },
      {
        uuid: 'in-bed',
        startDate: start,
        endDate: start + 4 * hour,
        value: 0,
        sourceRevision: { source: { name: 'iPhone', bundleIdentifier: 'com.apple.Health' } },
      },
    ]);

    expect(overlapping.hasOverlaps).toBe(true);
    expect(overlapping.hasContradictions).toBe(true);
    expect(overlapping.hasCoarseSamples).toBe(true);
    expect(overlapping.granularity).toBe('mixed');
    expect(overlapping.issues.map((issue) => issue.kind).sort()).toEqual([
      'coarse',
      'contradiction',
      'overlap',
    ]);

    const absent = normalizeLucidHkSleepSamples([]);
    expect(absent.hasAbsentData).toBe(true);
    expect(absent.granularity).toBe('unknown');
    expect(absent.issues).toEqual([
      expect.objectContaining({ kind: 'absent' }),
    ]);
  });
});
