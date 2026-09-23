import { buildPaywallHref, requestAnalysisReturnRoute, consumePurchasedAnalysisReturn, getSavedDreamReturnRoute, hasPendingPurchasedAnalysisReturn } from '@/lib/paywallRoute';

describe('paywallRoute', () => {
  it('builds a paywall route with contextual trigger params', () => {
    expect(buildPaywallHref('analysis_limit')).toEqual({
      pathname: '/paywall',
      params: { trigger: 'analysis_limit' },
    });
  });
});


describe('analysis return route', () => {
  it.each([
    {},
    { dreamId: '42', dreamOwnerId: 'other' },
    { dreamId: '', dreamOwnerId: 'owner' },
    { dreamId: 'invalid', dreamOwnerId: 'owner' },
    { dreamId: '42', dreamOwnerId: 'owner', dreamRemoteId: '-1' },
    { dreamId: '42', dreamOwnerId: 'owner', dreamRemoteId: '9007199254740993' },
    { dreamId: '42', dreamOwnerId: 'owner', dreamClientRequestId: '' },
  ])('rejects a missing, malformed or foreign dream destination: %j', (params) => {
    expect(requestAnalysisReturnRoute(params, 'owner')).toBeNull();
  });

  it('preserves stable identity when two dreams have the same timestamp', () => {
    expect(requestAnalysisReturnRoute({ dreamId: '42', dreamRemoteId: '17', dreamClientRequestId: 'request-17', dreamOwnerId: 'owner' }, 'owner')).toEqual({
      pathname: '/journal/[id]',
      params: { id: '42', remoteId: '17', clientRequestId: 'request-17', analyzeAfterPurchase: '1', analysisOwnerId: 'owner' },
    });
  });
});


it('allows only a matching, one-time purchase return and rejects an old route flag', () => {
  requestAnalysisReturnRoute({ dreamId: '42', dreamRemoteId: '17', dreamOwnerId: 'owner' }, 'owner');
  expect(hasPendingPurchasedAnalysisReturn({ id: '42', remoteId: '18' }, 'owner')).toBe(false);
  expect(hasPendingPurchasedAnalysisReturn({ id: '42', remoteId: '17' }, 'owner')).toBe(true);
  expect(consumePurchasedAnalysisReturn({ id: '42', remoteId: '18' }, 'owner')).toBe(false);
  expect(consumePurchasedAnalysisReturn({ id: '42', remoteId: '17' }, 'other')).toBe(false);
  expect(consumePurchasedAnalysisReturn({ id: '42', remoteId: '17' }, 'owner')).toBe(true);
  expect(consumePurchasedAnalysisReturn({ id: '42', remoteId: '17' }, 'owner')).toBe(false);
  expect(hasPendingPurchasedAnalysisReturn({ id: '42', remoteId: '17' }, 'owner')).toBe(false);
});

it('expires an abandoned purchase return', () => {
  const clock = jest.spyOn(Date, 'now');
  try {
    clock.mockReturnValue(0);
    requestAnalysisReturnRoute({ dreamId: '42', dreamOwnerId: 'owner' }, 'owner');
    clock.mockReturnValue(11 * 60 * 1000);
    expect(consumePurchasedAnalysisReturn({ id: '42' }, 'owner')).toBe(false);
  } finally { clock.mockRestore(); }
});


it('returns to the saved dream without authorizing analysis when the direct offer is dismissed', () => {
  expect(getSavedDreamReturnRoute({ afterSave: '1', dreamId: '456', dreamClientRequestId: 'saved-456', dreamOwnerId: 'owner' }, 'owner')).toEqual({
    pathname: '/journal/[id]', params: { id: '456', clientRequestId: 'saved-456' },
  });
  expect(consumePurchasedAnalysisReturn({ id: '456', clientRequestId: 'saved-456' }, 'owner')).toBe(false);
  expect(getSavedDreamReturnRoute({ afterSave: '1', dreamId: '456', dreamOwnerId: 'other' }, 'owner')).toBeNull();
  expect(getSavedDreamReturnRoute({ dreamId: '456', dreamOwnerId: 'owner' }, 'owner')).toBeNull();
});
