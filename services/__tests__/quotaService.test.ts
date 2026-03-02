import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const {
  mockGetMockMode,
  mockSetMockMode,
  providers,
  mockGetLastRemoteGuestProviderArg,
  mockGuestQuotaProviderClass,
  mockRemoteGuestQuotaProviderClass,
  mockSupabaseQuotaProviderClass,
  mockQuotaProviderClass,
} = ((factory: any) => factory())(() => {
  let mockMode = false;
  let lastRemoteGuestProviderArg: unknown = null;

  const buildProvider = () => ({
    getUsedAnalysisCount: jest.fn().mockResolvedValue(0),
    getUsedExplorationCount: jest.fn().mockResolvedValue(0),
    getUsedMessagesCount: jest.fn().mockResolvedValue(0),
    canAnalyzeDream: jest.fn().mockResolvedValue(true),
    canExploreDream: jest.fn().mockResolvedValue(true),
    canSendChatMessage: jest.fn().mockResolvedValue(true),
    getQuotaStatus: jest.fn().mockResolvedValue({ tier: 'free', isActive: false }),
    invalidate: jest.fn(),
  });

  const providers = {
    guest: buildProvider(),
    remote: buildProvider(),
    supabase: buildProvider(),
    mock: buildProvider(),
  };

  class mockGuestQuotaProviderClass {
    getUsedAnalysisCount = providers.guest.getUsedAnalysisCount;
    getUsedExplorationCount = providers.guest.getUsedExplorationCount;
    getUsedMessagesCount = providers.guest.getUsedMessagesCount;
    canAnalyzeDream = providers.guest.canAnalyzeDream;
    canExploreDream = providers.guest.canExploreDream;
    canSendChatMessage = providers.guest.canSendChatMessage;
    getQuotaStatus = providers.guest.getQuotaStatus;
    invalidate = providers.guest.invalidate;
  }

  class mockRemoteGuestQuotaProviderClass {
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

  class mockSupabaseQuotaProviderClass {
    getUsedAnalysisCount = providers.supabase.getUsedAnalysisCount;
    getUsedExplorationCount = providers.supabase.getUsedExplorationCount;
    getUsedMessagesCount = providers.supabase.getUsedMessagesCount;
    canAnalyzeDream = providers.supabase.canAnalyzeDream;
    canExploreDream = providers.supabase.canExploreDream;
    canSendChatMessage = providers.supabase.canSendChatMessage;
    getQuotaStatus = providers.supabase.getQuotaStatus;
    invalidate = providers.supabase.invalidate;
  }

  class mockQuotaProviderClass {
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
    mockGetMockMode: () => mockMode,
    mockSetMockMode: (value: boolean) => {
      mockMode = value;
    },
    providers,
    mockGetLastRemoteGuestProviderArg: () => lastRemoteGuestProviderArg,
    mockGuestQuotaProviderClass,
    mockRemoteGuestQuotaProviderClass,
    mockSupabaseQuotaProviderClass,
    mockQuotaProviderClass,
  };
});

jest.mock('@/lib/env', () => ({
  isMockModeEnabled: () => mockGetMockMode(),
}));

jest.mock('../quota/GuestQuotaProvider', () => ({ GuestQuotaProvider: mockGuestQuotaProviderClass }));
jest.mock('../quota/RemoteGuestQuotaProvider', () => ({ RemoteGuestQuotaProvider: mockRemoteGuestQuotaProviderClass }));
jest.mock('../quota/SupabaseQuotaProvider', () => ({ SupabaseQuotaProvider: mockSupabaseQuotaProviderClass }));
jest.mock('../quota/MockQuotaProvider', () => ({ MockQuotaProvider: mockQuotaProviderClass }));

describe('quotaService', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockSetMockMode(false);
  });

  it('given mock mode__when reading analysis count__then uses mock provider', async () => {
    mockSetMockMode(true);

    const { quotaService } = require('../quotaService');
    await quotaService.getUsedAnalysisCount(null);

    expect(providers.mock.getUsedAnalysisCount).toHaveBeenCalled();
    expect(providers.supabase.getUsedAnalysisCount).not.toHaveBeenCalled();
    expect(providers.guest.getUsedAnalysisCount).not.toHaveBeenCalled();
  });

  it('given guest user__when reading exploration count__then uses remote guest provider', async () => {
    mockSetMockMode(false);

    const { quotaService } = require('../quotaService');
    await quotaService.getUsedExplorationCount(null);

    expect(providers.remote.getUsedExplorationCount).toHaveBeenCalled();
    expect(providers.guest.getUsedExplorationCount).not.toHaveBeenCalled();
    expect(mockGetLastRemoteGuestProviderArg()).toBeInstanceOf(mockGuestQuotaProviderClass);
  });

  it('given authenticated user__when reading messages count__then uses supabase provider', async () => {
    mockSetMockMode(false);

    const { quotaService } = require('../quotaService');
    await quotaService.getUsedMessagesCount({ dreamId: 'dream-1' } as any, { id: 'user-1' } as any);

    expect(providers.supabase.getUsedMessagesCount).toHaveBeenCalled();
    expect(providers.remote.getUsedMessagesCount).not.toHaveBeenCalled();
  });

  it('given a subscriber__when invalidating__then notifies and invalidates provider', async () => {
    mockSetMockMode(true);

    const { quotaService } = require('../quotaService');
    const listener = jest.fn();
    quotaService.subscribe(listener);

    quotaService.invalidate(null);

    expect(providers.mock.invalidate).toHaveBeenCalled();
    expect(listener).toHaveBeenCalled();
  });

  it('given mixed providers__when invalidating all__then clears every cache', async () => {
    mockSetMockMode(false);

    const { quotaService } = require('../quotaService');
    quotaService.invalidateAll();

    expect(providers.guest.invalidate).toHaveBeenCalled();
    expect(providers.remote.invalidate).toHaveBeenCalled();
    expect(providers.supabase.invalidate).toHaveBeenCalled();
  });
});
