import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  getMockMode,
  setMockMode,
  getPlatformOS,
  setPlatformOS,
  mockService,
  realService,
} = vi.hoisted(() => {
  let mockMode = false;
  let platformOS = 'ios';

  const buildService = () => ({
    initialize: vi.fn(),
    isInitialized: vi.fn(),
    getStatus: vi.fn(),
    refreshStatus: vi.fn(),
    loadOfferings: vi.fn(),
    purchasePackage: vi.fn(),
    restorePurchases: vi.fn(),
  });

  return {
    getMockMode: () => mockMode,
    setMockMode: (value: boolean) => {
      mockMode = value;
    },
    getPlatformOS: () => platformOS,
    setPlatformOS: (value: string) => {
      platformOS = value;
    },
    mockService: buildService(),
    realService: buildService(),
  };
});

vi.mock('@/lib/env', () => ({
  isMockModeEnabled: () => getMockMode(),
}));

vi.mock('react-native', () => ({
  Platform: {
    get OS() {
      return getPlatformOS();
    },
    select: (spec: Record<string, unknown>) => (spec as any)[getPlatformOS()] ?? spec.default,
  },
}));

vi.mock('../mocks/subscriptionServiceMock', () => mockService);
vi.mock('../subscriptionServiceReal', () => realService);

describe('subscriptionService', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    setMockMode(false);
    setPlatformOS('ios');
    delete (process.env as Record<string, string | undefined>).EXPO_PUBLIC_REVENUECAT_WEB_KEY;
    mockService.refreshStatus = vi.fn();
    realService.refreshStatus = vi.fn();
  });

  it('given mock mode__when initializing subscription__then uses mock implementation', async () => {
    setMockMode(true);

    const service = await import('../subscriptionService');
    await service.initializeSubscription();

    expect(mockService.initialize).toHaveBeenCalled();
    expect(realService.initialize).not.toHaveBeenCalled();
  });

  it('given web without key__when loading service__then uses mock implementation', async () => {
    setMockMode(false);
    setPlatformOS('web');

    const service = await import('../subscriptionService');
    await service.getSubscriptionStatus();

    expect(mockService.getStatus).toHaveBeenCalled();
    expect(realService.getStatus).not.toHaveBeenCalled();
  });

  it('given web with key__when loading service__then uses real implementation', async () => {
    setMockMode(false);
    setPlatformOS('web');
    process.env.EXPO_PUBLIC_REVENUECAT_WEB_KEY = 'rc-web-key';

    const service = await import('../subscriptionService');
    await service.getSubscriptionStatus();

    expect(realService.getStatus).toHaveBeenCalled();
    expect(mockService.getStatus).not.toHaveBeenCalled();
  });

  it('given native without mock__when loading service__then uses real implementation', async () => {
    setMockMode(false);
    setPlatformOS('ios');

    const service = await import('../subscriptionService');
    await service.getSubscriptionStatus();

    expect(realService.getStatus).toHaveBeenCalled();
    expect(mockService.getStatus).not.toHaveBeenCalled();
  });

  it('given missing refreshStatus__when refreshing__then falls back to getStatus', async () => {
    setMockMode(false);
    setPlatformOS('ios');
    realService.refreshStatus = undefined as unknown as typeof realService.refreshStatus;

    const service = await import('../subscriptionService');
    await service.refreshSubscriptionStatus();

    expect(realService.getStatus).toHaveBeenCalled();
  });
});
