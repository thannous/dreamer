/**
 * Conditional export for storageService
 * Uses mock implementation if EXPO_PUBLIC_MOCK_MODE is enabled,
 * otherwise uses real implementation
 */

// Import both implementations
import * as mockService from './mocks/storageServiceMock';
import * as realService from './storageServiceReal';
import { isMockModeEnabled } from '@/lib/env';
import { createScopedLogger } from '@/lib/logger';

const log = createScopedLogger('[StorageService]');

// Select which implementation to use based on environment
const isMockMode = isMockModeEnabled();
const service = isMockMode ? mockService : realService;

if (__DEV__) {
  if (isMockMode) {
    log.debug('Using MOCK implementation');
  } else {
    log.debug('Using REAL implementation');
  }
}

// Re-export all functions from the selected service
export const getSavedDreams = service.getSavedDreams;
export const saveDreams = service.saveDreams;
export const getSavedTranscript = service.getSavedTranscript;
export const saveTranscript = service.saveTranscript;
export const clearSavedTranscript = service.clearSavedTranscript;
export const getNotificationSettings = service.getNotificationSettings;
export const saveNotificationSettings = service.saveNotificationSettings;
export const getThemePreference = service.getThemePreference;
export const saveThemePreference = service.saveThemePreference;
export const getLanguagePreference = service.getLanguagePreference;
export const saveLanguagePreference = service.saveLanguagePreference;
export const getCachedRemoteDreams = service.getCachedRemoteDreams;
export const saveCachedRemoteDreams = service.saveCachedRemoteDreams;
export const clearRemoteDreamStorage = service.clearRemoteDreamStorage;
export const getPendingDreamMutations = service.getPendingDreamMutations;
export const savePendingDreamMutations = service.savePendingDreamMutations;
export const getRitualPreference = service.getRitualPreference;
export const saveRitualPreference = service.saveRitualPreference;
export const getRitualStepProgress = service.getRitualStepProgress;
export const saveRitualStepProgress = service.saveRitualStepProgress;
export const getFirstLaunchCompleted = service.getFirstLaunchCompleted;
export const saveFirstLaunchCompleted = service.saveFirstLaunchCompleted;
export const getDreamsMigrationSynced = service.getDreamsMigrationSynced;
export const setDreamsMigrationSynced = service.setDreamsMigrationSynced;
