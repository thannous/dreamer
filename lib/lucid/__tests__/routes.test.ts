import {
  closeLucidRoute,
  claimLucidOnboardingCompletionNavigation,
  hasLucidOnboardingCompletionNavigationClaim,
  isLucidHomePath,
  isLucidOnboardingPath,
  isSafeLucidNotificationRoute,
  LUCID_ONBOARDING_HREF,
  resetLucidOnboardingCompletionNavigationClaim,
  resolveLucidOnboardingGate,
} from '@/lib/lucid/routes';

afterEach(() => resetLucidOnboardingCompletionNavigationClaim());

describe('Lucid Trainer notification routes', () => {
  it.each([
    '/lucid/reality-check',
    '/lucid/morning',
    '/lucid/program/wbtb',
    '/lucid/(tabs)/night',
  ])('accepts the owned route %s', (route) => {
    expect(isSafeLucidNotificationRoute(route)).toBe(true);
  });

  it.each([
    '/lucid/night',
    '/lucid/review',
    '/lucid/program/unknown',
    '/lucid/(tabs)/night?redirect=/recording',
    '/recording',
    'https://example.com',
    null,
  ])('rejects an unowned or malformed route %s', (route) => {
    expect(isSafeLucidNotificationRoute(route)).toBe(false);
  });
});

describe('closeLucidRoute', () => {
  it('uses native back when history exists', () => {
    const navigation = {
      canGoBack: () => true,
      back: jest.fn(),
      replace: jest.fn(),
    };

    closeLucidRoute(navigation, '/lucid/(tabs)/settings');

    expect(navigation.back).toHaveBeenCalledTimes(1);
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it('replaces to a stable Lucid destination when history is empty', () => {
    const navigation = {
      canGoBack: () => false,
      back: jest.fn(),
      replace: jest.fn(),
    };

    closeLucidRoute(navigation, '/lucid/(tabs)/programs');

    expect(navigation.replace).toHaveBeenCalledWith('/lucid/(tabs)/programs');
    expect(navigation.back).not.toHaveBeenCalled();
  });
});

describe('resolveLucidOnboardingGate', () => {
  it('shares a completion-navigation claim across overlapping layouts', () => {
    claimLucidOnboardingCompletionNavigation();

    expect(hasLucidOnboardingCompletionNavigationClaim()).toBe(true);
    resetLucidOnboardingCompletionNavigationClaim();
    expect(hasLucidOnboardingCompletionNavigationClaim()).toBe(false);
  });

  it('sends incomplete trainers to onboarding from the home URL', () => {
    expect(
      resolveLucidOnboardingGate({
        pathname: '/lucid',
        onboardingStatus: 'not_started',
      })
    ).toBe(LUCID_ONBOARDING_HREF);
    expect(
      resolveLucidOnboardingGate({
        pathname: '/lucid/(tabs)',
        onboardingStatus: 'in_progress',
      })
    ).toBe(LUCID_ONBOARDING_HREF);
  });

  it('does not replace while already on onboarding, including a trailing slash', () => {
    expect(isLucidOnboardingPath('/lucid/onboarding/')).toBe(true);
    expect(
      resolveLucidOnboardingGate({
        pathname: '/lucid/onboarding/',
        onboardingStatus: 'in_progress',
      })
    ).toBeNull();
  });

  it('leaves the completed onboarding transition to the screen owner', () => {
    expect(
      resolveLucidOnboardingGate({
        pathname: '/lucid/onboarding',
        onboardingStatus: 'completed',
      })
    ).toBeNull();
    expect(isLucidHomePath('/lucid')).toBe(true);
    expect(isLucidHomePath('/lucid/(tabs)')).toBe(true);
    expect(
      resolveLucidOnboardingGate({
        pathname: '/lucid',
        onboardingStatus: 'completed',
      })
    ).toBeNull();
    expect(
      resolveLucidOnboardingGate({
        pathname: '/lucid/(tabs)',
        onboardingStatus: 'completed',
      })
    ).toBeNull();
  });

  it('stays put while state is still loading', () => {
    expect(
      resolveLucidOnboardingGate({
        pathname: '/lucid',
        onboardingStatus: 'not_started',
        loading: true,
      })
    ).toBeNull();
  });
});
