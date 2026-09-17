import {
  getLucidHealthKitAvailability,
  LUCID_HK_SLEEP_QUERY_LIMIT,
  queryLucidHealthKitSleepAnalysis,
  requestLucidHealthKitSleepReadAuthorization,
  type LucidHealthKitNative,
} from '@/services/lucidHealthKit';

const range = {
  startDate: new Date('2026-08-27T20:00:00.000Z'),
  endDate: new Date('2026-08-28T08:00:00.000Z'),
};

describe('Lucid HealthKit adapter', () => {
  const originalOs = require('react-native').Platform.OS;

  afterEach(() => {
    require('react-native').Platform.OS = originalOs;
  });

  it('treats non-iOS as unavailable and never prompts', async () => {
    require('react-native').Platform.OS = 'android';
    const native: LucidHealthKitNative = {
      isHealthDataAvailable: () => true,
      requestAuthorization: jest.fn(),
    };
    await expect(getLucidHealthKitAvailability(native)).resolves.toBe('unavailable');
    await expect(requestLucidHealthKitSleepReadAuthorization(native)).resolves.toEqual({
      status: 'unavailable',
    });
    expect(native.requestAuthorization).not.toHaveBeenCalled();
  });

  it('requests only sleepAnalysis read authorization on an explicit connect', async () => {
    require('react-native').Platform.OS = 'ios';
    const native: LucidHealthKitNative = {
      isHealthDataAvailable: () => true,
      requestAuthorization: jest.fn(async (request) => {
        expect(request).toEqual({ toRead: ['HKCategoryTypeIdentifierSleepAnalysis'] });
        return true;
      }),
    };
    await expect(requestLucidHealthKitSleepReadAuthorization(native)).resolves.toEqual({
      status: 'prompted',
      authorized: true,
    });
  });

  it('guards query-before-auth, native failure and ambiguous empty without claiming denial', async () => {
    require('react-native').Platform.OS = 'ios';
    const native: LucidHealthKitNative = {
      isHealthDataAvailable: () => true,
      queryCategorySamples: jest.fn(async () => []),
    };

    await expect(
      queryLucidHealthKitSleepAnalysis(range, { hasRequestedAuthorization: false, native })
    ).resolves.toEqual(expect.objectContaining({ status: 'empty', reason: 'query_before_auth' }));
    expect(native.queryCategorySamples).not.toHaveBeenCalled();

    native.queryCategorySamples = jest.fn(async () => {
      throw new Error('store down');
    });
    await expect(
      queryLucidHealthKitSleepAnalysis(range, { hasRequestedAuthorization: true, native })
    ).resolves.toEqual(expect.objectContaining({ status: 'empty', reason: 'native_failure' }));

    native.queryCategorySamples = jest.fn(async () => []);
    await expect(
      queryLucidHealthKitSleepAnalysis(range, { hasRequestedAuthorization: true, native })
    ).resolves.toEqual(expect.objectContaining({ status: 'empty', reason: 'ambiguous_empty' }));
    expect(native.queryCategorySamples).toHaveBeenCalledWith(
      'HKCategoryTypeIdentifierSleepAnalysis',
      {
        filter: { date: { startDate: range.startDate, endDate: range.endDate } },
        limit: LUCID_HK_SLEEP_QUERY_LIMIT,
        ascending: true,
      }
    );
    expect(LUCID_HK_SLEEP_QUERY_LIMIT).toBeLessThanOrEqual(0);
  });

  it('rejects an invalid range before calling native HealthKit', async () => {
    require('react-native').Platform.OS = 'ios';
    const native: LucidHealthKitNative = {
      isHealthDataAvailable: () => true,
      queryCategorySamples: jest.fn(async () => []),
    };
    await expect(
      queryLucidHealthKitSleepAnalysis(
        { startDate: range.endDate, endDate: range.startDate },
        { hasRequestedAuthorization: true, native }
      )
    ).resolves.toEqual(expect.objectContaining({ status: 'empty', reason: 'invalid_range' }));
    expect(native.queryCategorySamples).not.toHaveBeenCalled();
  });

  it('returns malformed/non-positive issues when native samples exist but none are usable', async () => {
    require('react-native').Platform.OS = 'ios';
    const native: LucidHealthKitNative = {
      isHealthDataAvailable: () => true,
      queryCategorySamples: jest.fn(async () => [
        { uuid: 'bad-value', startDate: range.startDate, endDate: range.endDate, value: 9 },
        { uuid: 'zero', startDate: range.startDate, endDate: range.startDate, value: 1 },
      ]),
    };
    const result = await queryLucidHealthKitSleepAnalysis(range, {
      hasRequestedAuthorization: true,
      native,
    });
    expect(result.status).toBe('ready');
    if (result.status !== 'ready') throw new Error('Expected malformed samples to stay visible.');
    expect(result.normalization.samples).toEqual([]);
    expect(result.normalization.rejected.map((issue) => issue.kind).sort()).toEqual([
      'malformed',
      'non_positive_interval',
    ]);
    expect(result.normalization.hasAbsentData).toBe(true);
  });
});
