/**
 * Mock implementation of storageService for development mode
 * Uses in-memory storage and can optionally preload predefined dreams
 */

import type {
  DreamAnalysis,
  DreamMutation,
  LanguagePreference,
  NotificationSettings,
  RitualStepProgress,
  ThemePreference,
} from '@/lib/types';
import { getPredefinedDreamsWithTimestamps } from '@/mock-data/predefinedDreams';

// In-memory storage
const mockStorage: Record<string, string> = {};

// Flag to track if we've pre-loaded dreams
let dreamsPreloaded = false;
let shouldPreloadDreams = false;

const REMOTE_DREAMS_CACHE_KEY = 'gemini_dream_journal_remote_dreams_cache';
const DREAM_MUTATIONS_KEY = 'gemini_dream_journal_pending_mutations';

const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  weekdayEnabled: false,
  weekdayTime: '07:00',
  weekendEnabled: false,
  weekendTime: '10:00',
};

const DEFAULT_THEME_PREFERENCE: ThemePreference = 'auto';

const DEFAULT_LANGUAGE_PREFERENCE: LanguagePreference = 'auto';
const RITUAL_PREFERENCE_KEY = 'gemini_dream_journal_ritual_preference';
const RITUAL_PROGRESS_KEY = 'gemini_dream_journal_ritual_progress';
const FIRST_LAUNCH_COMPLETED_KEY = 'gemini_dream_journal_first_launch_completed';
const DREAMS_MIGRATION_SYNCED_PREFIX = 'gemini_dream_journal_dreams_migration_synced_';

export function setPreloadDreamsEnabled(enabled: boolean): void {
  shouldPreloadDreams = enabled;
  if (!enabled) {
    dreamsPreloaded = false;
    delete mockStorage['gemini_dream_journal_dreams'];
  }
  console.log('[MOCK STORAGE] Dream preloading', enabled ? 'enabled' : 'disabled');
}

export function preloadDreamsNow(): void {
  if (!shouldPreloadDreams) {
    console.log('[MOCK STORAGE] Skipping preload because it is disabled');
    return;
  }
  ensureDreamsPreloaded();
}

/**
 * Pre-load predefined dreams on first access
 */
function ensureDreamsPreloaded(): void {
  if (dreamsPreloaded || !shouldPreloadDreams) return;

  console.log('[MOCK STORAGE] Pre-loading predefined dreams...');
  const predefinedDreams = getPredefinedDreamsWithTimestamps();
  mockStorage['gemini_dream_journal_dreams'] = JSON.stringify(predefinedDreams);
  dreamsPreloaded = true;
  console.log(`[MOCK STORAGE] Loaded ${predefinedDreams.length} predefined dreams`);
}

/**
 * Mock get saved dreams
 * Returns predefined dreams on first load, then returns saved state
 */
export async function getSavedDreams(): Promise<DreamAnalysis[]> {
  console.log('[MOCK STORAGE] getSavedDreams called');
  ensureDreamsPreloaded();

  try {
    const savedDreams = mockStorage['gemini_dream_journal_dreams'];
    if (savedDreams) {
      const dreams = JSON.parse(savedDreams) as DreamAnalysis[];
      const sorted = dreams.sort((a, b) => b.id - a.id);
      console.log(`[MOCK STORAGE] Returning ${sorted.length} dreams`);
      return sorted;
    }
    return [];
  } catch (error) {
    console.error('[MOCK STORAGE] Failed to retrieve dreams:', error);
    return [];
  }
}

/**
 * Mock save dreams
 */
export async function saveDreams(dreams: DreamAnalysis[]): Promise<void> {
  console.log(`[MOCK STORAGE] saveDreams called with ${dreams.length} dreams`);
  try {
    mockStorage['gemini_dream_journal_dreams'] = JSON.stringify(dreams);
    console.log('[MOCK STORAGE] Dreams saved successfully');
  } catch (error) {
    console.error('[MOCK STORAGE] Failed to save dreams:', error);
    throw new Error('Failed to persist dreams to storage');
  }
}

/**
 * Mock get saved transcript
 */
export async function getSavedTranscript(): Promise<string> {
  console.log('[MOCK STORAGE] getSavedTranscript called');
  try {
    return mockStorage['gemini_dream_journal_recording_transcript'] || '';
  } catch (error) {
    console.error('[MOCK STORAGE] Failed to retrieve transcript:', error);
    return '';
  }
}

/**
 * Mock save transcript
 */
export async function saveTranscript(transcript: string): Promise<void> {
  console.log('[MOCK STORAGE] saveTranscript called with:', transcript.slice(0, 50) + '...');
  try {
    if (transcript) {
      mockStorage['gemini_dream_journal_recording_transcript'] = transcript;
    } else {
      delete mockStorage['gemini_dream_journal_recording_transcript'];
    }
    console.log('[MOCK STORAGE] Transcript saved');
  } catch (error) {
    console.error('[MOCK STORAGE] Failed to save transcript:', error);
    throw new Error('Failed to save transcript');
  }
}

/**
 * Mock clear saved transcript
 */
export async function clearSavedTranscript(): Promise<void> {
  console.log('[MOCK STORAGE] clearSavedTranscript called');
  try {
    delete mockStorage['gemini_dream_journal_recording_transcript'];
    console.log('[MOCK STORAGE] Transcript cleared');
  } catch (error) {
    console.error('[MOCK STORAGE] Failed to clear transcript:', error);
  }
}

/**
 * Mock get notification settings
 */
export async function getNotificationSettings(): Promise<NotificationSettings> {
  console.log('[MOCK STORAGE] getNotificationSettings called');
  try {
    const savedSettings = mockStorage['gemini_dream_journal_notification_settings'];
    if (savedSettings) {
      const settings = JSON.parse(savedSettings) as NotificationSettings;
      console.log('[MOCK STORAGE] Returning saved notification settings');
      return settings;
    }
  } catch (error) {
    console.error('[MOCK STORAGE] Failed to retrieve notification settings:', error);
  }
  console.log('[MOCK STORAGE] Returning default notification settings');
  return DEFAULT_NOTIFICATION_SETTINGS;
}

/**
 * Mock save notification settings
 */
export async function saveNotificationSettings(settings: NotificationSettings): Promise<void> {
  console.log('[MOCK STORAGE] saveNotificationSettings called:', settings);
  try {
    mockStorage['gemini_dream_journal_notification_settings'] = JSON.stringify(settings);
    console.log('[MOCK STORAGE] Notification settings saved');
  } catch (error) {
    console.error('[MOCK STORAGE] Failed to save notification settings:', error);
    throw new Error('Failed to save notification settings');
  }
}

/**
 * Mock get theme preference
 */
export async function getThemePreference(): Promise<ThemePreference> {
  console.log('[MOCK STORAGE] getThemePreference called');
  try {
    const savedPreference = mockStorage['gemini_dream_journal_theme_preference'];
    if (savedPreference) {
      const preference = JSON.parse(savedPreference) as ThemePreference;
      console.log('[MOCK STORAGE] Returning saved theme preference:', preference);
      return preference;
    }
  } catch (error) {
    console.error('[MOCK STORAGE] Failed to retrieve theme preference:', error);
  }
  console.log('[MOCK STORAGE] Returning default theme preference');
  return DEFAULT_THEME_PREFERENCE;
}

/**
 * Mock save theme preference
 */
export async function saveThemePreference(preference: ThemePreference): Promise<void> {
  console.log('[MOCK STORAGE] saveThemePreference called:', preference);
  try {
    mockStorage['gemini_dream_journal_theme_preference'] = JSON.stringify(preference);
    console.log('[MOCK STORAGE] Theme preference saved');
  } catch (error) {
    console.error('[MOCK STORAGE] Failed to save theme preference:', error);
    throw new Error('Failed to save theme preference');
  }
}

/**
 * Mock get language preference
 */
export async function getLanguagePreference(): Promise<LanguagePreference> {
  console.log('[MOCK STORAGE] getLanguagePreference called');
  try {
    const savedPreference = mockStorage['gemini_dream_journal_language_preference'];
    if (savedPreference) {
      const preference = JSON.parse(savedPreference) as LanguagePreference;
      console.log('[MOCK STORAGE] Returning saved language preference:', preference);
      return preference;
    }
  } catch (error) {
    console.error('[MOCK STORAGE] Failed to retrieve language preference:', error);
  }
  console.log('[MOCK STORAGE] Returning default language preference');
  return DEFAULT_LANGUAGE_PREFERENCE;
}

/**
 * Mock save language preference
 */
export async function saveLanguagePreference(preference: LanguagePreference): Promise<void> {
  console.log('[MOCK STORAGE] saveLanguagePreference called:', preference);
  try {
    mockStorage['gemini_dream_journal_language_preference'] = JSON.stringify(preference);
    console.log('[MOCK STORAGE] Language preference saved');
  } catch (error) {
    console.error('[MOCK STORAGE] Failed to save language preference:', error);
    throw new Error('Failed to save language preference');
  }
}

export async function getRitualPreference(): Promise<string | null> {
  console.log('[MOCK STORAGE] getRitualPreference called');
  try {
    const savedPreference = mockStorage[RITUAL_PREFERENCE_KEY];
    if (savedPreference) {
      const preference = JSON.parse(savedPreference) as string;
      console.log('[MOCK STORAGE] Returning saved ritual preference:', preference);
      return preference;
    }
  } catch (error) {
    console.error('[MOCK STORAGE] Failed to retrieve ritual preference:', error);
  }
  console.log('[MOCK STORAGE] No ritual preference set yet');
  return null;
}

export async function saveRitualPreference(preference: string): Promise<void> {
  console.log('[MOCK STORAGE] saveRitualPreference called:', preference);
  try {
    mockStorage[RITUAL_PREFERENCE_KEY] = JSON.stringify(preference);
    console.log('[MOCK STORAGE] Ritual preference saved');
  } catch (error) {
    console.error('[MOCK STORAGE] Failed to save ritual preference:', error);
    throw new Error('Failed to save ritual preference');
  }
}

export async function getRitualStepProgress(): Promise<RitualStepProgress | null> {
  console.log('[MOCK STORAGE] getRitualStepProgress called');
  try {
    const savedProgress = mockStorage[RITUAL_PROGRESS_KEY];
    if (savedProgress) {
      const parsed = JSON.parse(savedProgress) as RitualStepProgress;
      console.log('[MOCK STORAGE] Returning ritual step progress');
      return parsed;
    }
  } catch (error) {
    console.error('[MOCK STORAGE] Failed to retrieve ritual step progress:', error);
  }
  console.log('[MOCK STORAGE] No ritual step progress set yet');
  return null;
}

export async function saveRitualStepProgress(progress: RitualStepProgress): Promise<void> {
  console.log('[MOCK STORAGE] saveRitualStepProgress called');
  try {
    mockStorage[RITUAL_PROGRESS_KEY] = JSON.stringify(progress);
    console.log('[MOCK STORAGE] Ritual step progress saved');
  } catch (error) {
    console.error('[MOCK STORAGE] Failed to save ritual step progress:', error);
    throw new Error('Failed to save ritual step progress');
  }
}

export async function getFirstLaunchCompleted(): Promise<boolean> {
  console.log('[MOCK STORAGE] getFirstLaunchCompleted called');
  try {
    const savedFlag = mockStorage[FIRST_LAUNCH_COMPLETED_KEY];
    if (savedFlag) {
      const completed = JSON.parse(savedFlag) as boolean;
      console.log('[MOCK STORAGE] Returning first launch flag:', completed);
      return completed;
    }
  } catch (error) {
    console.error('[MOCK STORAGE] Failed to retrieve first launch flag:', error);
  }
  console.log('[MOCK STORAGE] No first launch flag set yet, defaulting to false');
  return false;
}

export async function saveFirstLaunchCompleted(completed: boolean): Promise<void> {
  console.log('[MOCK STORAGE] saveFirstLaunchCompleted called:', completed);
  try {
    mockStorage[FIRST_LAUNCH_COMPLETED_KEY] = JSON.stringify(completed);
    console.log('[MOCK STORAGE] First launch flag saved');
  } catch (error) {
    console.error('[MOCK STORAGE] Failed to save first launch flag:', error);
    throw new Error('Failed to save first launch flag');
  }
}

export async function getDreamsMigrationSynced(userId: string): Promise<boolean> {
  if (!userId) return false;
  const key = `${DREAMS_MIGRATION_SYNCED_PREFIX}${userId}`;
  return mockStorage[key] === 'true';
}

export async function setDreamsMigrationSynced(userId: string, synced: boolean): Promise<void> {
  if (!userId) return;
  const key = `${DREAMS_MIGRATION_SYNCED_PREFIX}${userId}`;
  mockStorage[key] = synced ? 'true' : 'false';
}

export async function getCachedRemoteDreams(): Promise<DreamAnalysis[]> {
  console.log('[MOCK STORAGE] getCachedRemoteDreams called');
  try {
    const cached = mockStorage[REMOTE_DREAMS_CACHE_KEY];
    if (cached) {
      return JSON.parse(cached) as DreamAnalysis[];
    }
  } catch (error) {
    console.error('[MOCK STORAGE] Failed to read cached remote dreams:', error);
  }
  return [];
}

export async function saveCachedRemoteDreams(dreams: DreamAnalysis[]): Promise<void> {
  console.log('[MOCK STORAGE] saveCachedRemoteDreams called with', dreams.length, 'dreams');
  try {
    mockStorage[REMOTE_DREAMS_CACHE_KEY] = JSON.stringify(dreams);
  } catch (error) {
    console.error('[MOCK STORAGE] Failed to cache remote dreams:', error);
    throw new Error('Failed to cache remote dreams');
  }
}

export async function getPendingDreamMutations(): Promise<DreamMutation[]> {
  console.log('[MOCK STORAGE] getPendingDreamMutations called');
  try {
    const pending = mockStorage[DREAM_MUTATIONS_KEY];
    if (pending) {
      return JSON.parse(pending) as DreamMutation[];
    }
  } catch (error) {
    console.error('[MOCK STORAGE] Failed to read pending dream mutations:', error);
  }
  return [];
}

export async function savePendingDreamMutations(mutations: DreamMutation[]): Promise<void> {
  console.log('[MOCK STORAGE] savePendingDreamMutations called with', mutations.length, 'mutations');
  try {
    mockStorage[DREAM_MUTATIONS_KEY] = JSON.stringify(mutations);
  } catch (error) {
    console.error('[MOCK STORAGE] Failed to save pending dream mutations:', error);
    throw new Error('Failed to save pending dream mutations');
  }
}

/**
 * Utility function to reset mock storage (useful for testing)
 */
export function resetMockStorage(): void {
  console.log('[MOCK STORAGE] Resetting all mock storage');
  Object.keys(mockStorage).forEach(key => delete mockStorage[key]);
  dreamsPreloaded = false;
}
