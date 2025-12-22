import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  getMockMode,
  setMockMode,
  providers,
  getLastRemoteGuestProviderArg,
  GuestQuotaProvider,
  RemoteGuestQuotaProvider,
  SupabaseQuotaProvider,
  MockQuotaProvider,
} = vi.hoisted(() => {
  let mockMode = false;
  let lastRemoteGuestProviderArg: unknown = null;

  const buildProvider = () => ({
    getUsedAnalysisCount: vi.fn().mockResolvedValue(0),
    getUsedExplorationCount: vi.fn().mockResolvedValue(0),
    getUsedMessagesCount: vi.fn().mockResolvedValue(0),
    canAnalyzeDream: vi.fn().mockResolvedValue(true),
    canExploreDream: vi.fn().mockResolvedValue(true),
    canSendChatMessage: vi.fn().mockResolvedValue(true),
    getQuotaStatus: vi.fn().mockResolvedValue({ tier: 'free', isActive: false }),
    invalidate: vi.fn(),
  });

  const providers = {
    guest: buildProvider(),
    remote: buildProvider(),
    supabase: buildProvider(),
    mock: buildProvider(),
  };

  class GuestQuotaProvider {
    getUsedAnalysisCount = providers.guest.getUsedAnalysisCount;
    getUsedExplorationCount = providers.guest.getUsedExplorationCount;
    getUsedMessagesCount = providers.guest.getUsedMessagesCount;
    canAnalyzeDream = providers.guest.canAnalyzeDream;
    canExploreDream = providers.guest.canExploreDream;
    canSendChatMessage = providers.guest.canSendChatMessage;
    getQuotaStatus = providers.guest.getQuotaStatus;
    invalidate = providers.guest.invalidate;
  }

  class RemoteGuestQuotaProvider {
    constructor(guestProvider: unknown) {
      lastRemoteGuestProviderArg = guestProvider;
    }
    getUsedAnalysisCount = providers.remote.getUsedAnalysisCount;
    getUsedExplorationCount = providers.remote.getUsedExplorationCount;
    getUsedMessagesCount = providers.remote.getUsedMessagesCount;
    canAnalyzeDream = providers.remote.canAnalyzeDream;
    canExploreDream = providers.remote.canExploreDream;
    canSendChatMessage = providers.remote.canSendChatMessage;
    getQuotaStatus = providers.remote.getQuotaStatus;
    invalidate = providers.remote.invalidate;
  }

  class SupabaseQuotaProvider {
    getUsedAnalysisCount = providers.supabase.getUsedAnalysisCount;
    getUsedExplorationCount = providers.supabase.getUsedExplorationCount;
    getUsedMessagesCount = providers.supabase.getUsedMessagesCount;
    canAnalyzeDream = providers.supabase.canAnalyzeDream;
    canExploreDream = providers.supabase.canExploreDream;
    canSendChatMessage = providers.supabase.canSendChatMessage;
    getQuotaStatus = providers.supabase.getQuotaStatus;
    invalidate = providers.supabase.invalidate;
  }

  class MockQuotaProvider {
    getUsedAnalysisCount = providers.mock.getUsedAnalysisCount;
    getUsedExplorationCount = providers.mock.getUsedExplorationCount;
    getUsedMessagesCount = providers.mock.getUsedMessagesCount;
    canAnalyzeDream = providers.mock.canAnalyzeDream;
    canExploreDream = providers.mock.canExploreDream;
    canSendChatMessage = providers.mock.canSendChatMessage;
    getQuotaStatus = providers.mock.getQuotaStatus;
    invalidate = providers.mock.invalidate;
  }

  return {
    getMockMode: () => mockMode,
    setMockMode: (value: boolean) => {
      mockMode = value;
    },
    providers,
    getLastRemoteGuestProviderArg: () => lastRemoteGuestProviderArg,
    GuestQuotaProvider,
    RemoteGuestQuotaProvider,
    SupabaseQuotaProvider,
    MockQuotaProvider,
  };
});

vi.mock('@/lib/env', () => ({
  isMockModeEnabled: () => getMockMode(),
}));

vi.mock('../quota/GuestQuotaProvider', () => ({ GuestQuotaProvider }));
vi.mock('../quota/RemoteGuestQuotaProvider', () => ({ RemoteGuestQuotaProvider }));
vi.mock('../quota/SupabaseQuotaProvider', () => ({ SupabaseQuotaProvider }));
vi.mock('../quota/MockQuotaProvider', () => ({ MockQuotaProvider }));

describe('quotaService', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    setMockMode(false);
  });

  it('given mock mode__when reading analysis count__then uses mock provider', async () => {
    setMockMode(true);

    const { quotaService } = await import('../quotaService');
    await quotaService.getUsedAnalysisCount(null);

    expect(providers.mock.getUsedAnalysisCount).toHaveBeenCalled();
    expect(providers.supabase.getUsedAnalysisCount).not.toHaveBeenCalled();
    expect(providers.guest.getUsedAnalysisCount).not.toHaveBeenCalled();
  });

  it('given guest user__when reading exploration count__then uses remote guest provider', async () => {
    setMockMode(false);

    const { quotaService } = await import('../quotaService');
    await quotaService.getUsedExplorationCount(null);

    expect(providers.remote.getUsedExplorationCount).toHaveBeenCalled();
    expect(providers.guest.getUsedExplorationCount).not.toHaveBeenCalled();
    expect(getLastRemoteGuestProviderArg()).toBeInstanceOf(GuestQuotaProvider);
  });

  it('given authenticated user__when reading messages count__then uses supabase provider', async () => {
    setMockMode(false);

    const { quotaService } = await import('../quotaService');
    await quotaService.getUsedMessagesCount({ dreamId: 'dream-1' } as any, { id: 'user-1' } as any);

    expect(providers.supabase.getUsedMessagesCount).toHaveBeenCalled();
    expect(providers.remote.getUsedMessagesCount).not.toHaveBeenCalled();
  });

  it('given a subscriber__when invalidating__then notifies and invalidates provider', async () => {
    setMockMode(true);

    const { quotaService } = await import('../quotaService');
    const listener = vi.fn();
    quotaService.subscribe(listener);

    quotaService.invalidate(null);

    expect(providers.mock.invalidate).toHaveBeenCalled();
    expect(listener).toHaveBeenCalled();
  });

  it('given mixed providers__when invalidating all__then clears every cache', async () => {
    setMockMode(false);

    const { quotaService } = await import('../quotaService');
    quotaService.invalidateAll();

    expect(providers.guest.invalidate).toHaveBeenCalled();
    expect(providers.remote.invalidate).toHaveBeenCalled();
    expect(providers.supabase.invalidate).toHaveBeenCalled();
  });
});
