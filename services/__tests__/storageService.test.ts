import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  getMockMode,
  setMockMode,
  mockService,
  realService,
} = vi.hoisted(() => {
  let mockMode = false;
  const serviceMethodNames = [
    'getSavedDreams',
    'saveDreams',
    'getSavedTranscript',
    'saveTranscript',
    'clearSavedTranscript',
    'getNotificationSettings',
    'saveNotificationSettings',
    'getThemePreference',
    'saveThemePreference',
    'getLanguagePreference',
    'saveLanguagePreference',
    'getCachedRemoteDreams',
    'saveCachedRemoteDreams',
    'clearRemoteDreamStorage',
    'getPendingDreamMutations',
    'savePendingDreamMutations',
    'getRitualPreference',
    'saveRitualPreference',
    'getRitualStepProgress',
    'saveRitualStepProgress',
    'getFirstLaunchCompleted',
    'saveFirstLaunchCompleted',
    'getDreamsMigrationSynced',
    'setDreamsMigrationSynced',
  ];

  const buildService = () =>
    serviceMethodNames.reduce((acc, name) => {
      acc[name] = vi.fn();
      return acc;
    }, {} as Record<string, ReturnType<typeof vi.fn>>);

  return {
    getMockMode: () => mockMode,
    setMockMode: (value: boolean) => {
      mockMode = value;
    },
    mockService: buildService(),
    realService: buildService(),
  };
});

vi.mock('@/lib/env', () => ({
  isMockModeEnabled: () => getMockMode(),
}));

vi.mock('../mocks/storageServiceMock', () => mockService);
vi.mock('../storageServiceReal', () => realService);

describe('storageService', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    setMockMode(false);
  });

  it('given mock mode__when saving dreams__then uses mock implementation', async () => {
    setMockMode(true);

    const service = await import('../storageService');
    await service.saveDreams([]);

    expect(mockService.saveDreams).toHaveBeenCalled();
    expect(realService.saveDreams).not.toHaveBeenCalled();
  });

  it('given real mode__when reading dreams__then uses real implementation', async () => {
    setMockMode(false);

    const service = await import('../storageService');
    await service.getSavedDreams();

    expect(realService.getSavedDreams).toHaveBeenCalled();
    expect(mockService.getSavedDreams).not.toHaveBeenCalled();
  });
});
