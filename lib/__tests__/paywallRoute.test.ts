import { buildPaywallHref, getAnalysisReturnRoute } from '@/lib/paywallRoute';

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
    expect(getAnalysisReturnRoute(params, 'owner')).toBeNull();
  });

  it('preserves stable identity when two dreams have the same timestamp', () => {
    expect(getAnalysisReturnRoute({ dreamId: '42', dreamRemoteId: '17', dreamClientRequestId: 'request-17', dreamOwnerId: 'owner' }, 'owner')).toEqual({
      pathname: '/journal/[id]',
      params: { id: '42', remoteId: '17', clientRequestId: 'request-17', analyzeAfterPurchase: '1', analysisOwnerId: 'owner' },
    });
  });
});
