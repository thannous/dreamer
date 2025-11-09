/**
 * Conditional export for storageService
 * Uses mock implementation if EXPO_PUBLIC_MOCK_MODE is enabled,
 * otherwise uses real implementation
 */

// Import both implementations
import * as realService from './storageServiceReal';
import * as mockService from './mocks/storageServiceMock';

// Select which implementation to use based on environment
const isMockMode = process.env.EXPO_PUBLIC_MOCK_MODE === 'true';
const service = isMockMode ? mockService : realService;

if (isMockMode) {
  console.log('[STORAGE SERVICE] Using MOCK implementation');
} else {
  console.log('[STORAGE SERVICE] Using REAL implementation');
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
