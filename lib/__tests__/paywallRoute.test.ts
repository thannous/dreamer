import { buildPaywallHref } from '@/lib/paywallRoute';

describe('paywallRoute', () => {
  it('builds a paywall route with contextual trigger params', () => {
    expect(buildPaywallHref('analysis_limit')).toEqual({
      pathname: '/paywall',
      params: { trigger: 'analysis_limit' },
    });
  });
});
