import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const {
  mockGetMockMode,
  mockSetMockMode,
  mockService,
  mockRealService,
} = ((factory: any) => factory())(() => {
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
    'getPendingImageJobs',
    'savePendingImageJobs',
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
      acc[name] = jest.fn();
      return acc;
    }, {} as Record<string, ReturnType<typeof jest.fn>>);

  return {
    mockGetMockMode: () => mockMode,
    mockSetMockMode: (value: boolean) => {
      mockMode = value;
    },
    mockService: buildService(),
    mockRealService: buildService(),
  };
});

jest.mock('@/lib/env', () => ({
  isMockModeEnabled: () => mockGetMockMode(),
}));

jest.mock('../mocks/storageServiceMock', () => mockService);
jest.mock('../storageServiceReal', () => mockRealService);

describe('storageService', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockSetMockMode(false);
  });

  it('given mock mode__when saving dreams__then uses mock implementation', async () => {
    mockSetMockMode(true);

    const service = require('../storageService');
    await service.saveDreams([]);

    expect(mockService.saveDreams).toHaveBeenCalled();
    expect(mockRealService.saveDreams).not.toHaveBeenCalled();
  });

  it('given real mode__when reading dreams__then uses real implementation', async () => {
    mockSetMockMode(false);

    const service = require('../storageService');
    await service.getSavedDreams();

    expect(mockRealService.getSavedDreams).toHaveBeenCalled();
    expect(mockService.getSavedDreams).not.toHaveBeenCalled();
  });
});
