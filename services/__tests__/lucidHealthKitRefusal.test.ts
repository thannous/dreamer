import { queryLucidHealthKitSleepAnalysis, requestLucidHealthKitSleepReadAuthorization } from '../lucidHealthKit';

// A successful OS prompt does not prove read access; denial/revocation and an
// empty store are intentionally indistinguishable to the app.
describe('Lucid optional sleep permission refusal', () => {
  const platform = require('react-native').Platform;
  const original = platform.OS;
  afterEach(() => { platform.OS = original; });

  it('returns a recoverable refusal and subsequently an ambiguous empty result', async () => {
    platform.OS = 'ios';
    const native = {
      isHealthDataAvailable: () => true,
      requestAuthorization: jest.fn(async () => false),
      queryCategorySamples: jest.fn(async () => []),
    };
    await expect(requestLucidHealthKitSleepReadAuthorization(native)).resolves.toEqual({
      status: 'prompted', authorized: false,
    });
    expect(native.queryCategorySamples).not.toHaveBeenCalled();
    const result = await queryLucidHealthKitSleepAnalysis({
      startDate: new Date('2026-09-01'), endDate: new Date('2026-09-02'),
    }, { hasRequestedAuthorization: true, native });
    expect(result).toMatchObject({ status: 'empty', reason: 'ambiguous_empty' });
    expect(native.requestAuthorization).toHaveBeenCalledTimes(1);
    expect(native.requestAuthorization).toHaveBeenCalledWith({ toRead: ['HKCategoryTypeIdentifierSleepAnalysis'] });
  });
});
